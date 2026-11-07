/**
 * 지금 렌더 중인 `FunctionComponent`이다. 렌더 밖과 자식 컴포넌트 안에서는 `null`이다.
 *
 * @private
 * @type {?FunctionComponent}
 */
let currentComponent = null;

/**
 * `run`을 실행하는 동안 현재 컴포넌트를 정한다.
 * 끝나면 성공과 실패에 상관없이 이전 값으로 되돌린다. 렌더 밖에서 부르면 이전 값은 `null`이다.
 *
 * @param {?FunctionComponent} component 현재 컴포넌트로 정할 인스턴스
 * @param {Function} run 실행할 함수
 * @returns {*} `run`의 반환값
 */
export function withCurrentComponent(component, run) {
  const previous = currentComponent;

  currentComponent = component;

  try {
    return run();
  } finally {
    currentComponent = previous;
  }
}

/**
 * `run`을 실행하는 동안 현재 컴포넌트를 비워 Hook을 쓰지 못하게 한다.
 * `h`가 자식 컴포넌트를 실행할 때 쓴다. 끝나면 루트 컴포넌트가 다시 현재 컴포넌트가 된다.
 *
 * @param {Function} run 실행할 함수
 * @returns {*} `run`의 반환값
 */
export function withoutHooks(run) {
  return withCurrentComponent(null, run);
}

/**
 * 현재 컴포넌트에서 이번 차례의 칸을 찾고 `hookIndex`를 다음으로 옮긴다.
 * 칸은 첫 렌더에서만 만든다. 첫 렌더가 실패한 뒤 다시 `mount()`하면 이미 있는 칸을 그대로 쓴다.
 *
 * @private
 * @param {'state' | 'effect' | 'memo'} kind 호출한 Hook의 종류
 * @param {function(FunctionComponent): object} createHook 새 칸을 만드는 함수
 * @returns {object} 이번 차례의 칸
 * @throws {Error} 렌더 밖이거나, Hook 개수나 종류가 첫 렌더와 다르면 던진다.
 */
function nextHook(kind, createHook) {
  const component = currentComponent;

  if (component === null) {
    throw new Error('Hook은 루트 컴포넌트의 렌더 중에만 호출할 수 있다.');
  }

  const index = component.hookIndex;

  if (index === component.hooks.length) {
    if (component.vdom !== null) {
      throw new Error('Hook 개수가 첫 렌더와 다르다.');
    }

    component.hooks.push(createHook(component));
  }

  const hook = component.hooks[index];

  if (hook.kind !== kind) {
    throw new Error(`Hook 종류가 첫 렌더와 다르다: ${hook.kind}, ${kind}`);
  }

  component.hookIndex += 1;

  return hook;
}

/**
 * `useState`의 칸을 만든다. `setState`는 여기에서 한 번만 만들어 렌더마다 재사용한다.
 *
 * @private
 * @param {FunctionComponent} component 칸을 가질 인스턴스
 * @param {*} initial 초기값
 * @returns {{kind: 'state', state: *, setState: Function}} 새 칸
 */
function createStateHook(component, initial) {
  const hook = { kind: 'state', state: initial };

  hook.setState = (next) => {
    if (component.isRendering) {
      throw new Error('렌더 중에는 setState를 호출할 수 없다.');
    }

    const value = typeof next === 'function' ? next(hook.state) : next;

    // 직전 update()가 실패했으면 칸과 화면이 다르므로 같은 값이어도 다시 렌더한다.
    if (Object.is(value, hook.state) && !component.isStale) return;

    hook.state = value;
    component.scheduleUpdate();
  };

  return hook;
}

/**
 * 렌더 사이에 유지되는 상태를 만든다. 루트 컴포넌트의 렌더 중에만 호출할 수 있다.
 * `setState(next)`는 `next`가 함수이면 `next(이전 값)`으로 새 값을 구한다.
 * 값이 `Object.is`로 같고 직전 `update()`가 성공했으면 아무것도 하지 않고, 아니면 칸의 값을 바로 바꾼 뒤 `update()`를 예약한다.
 * 화면은 `setState` 직후가 아니라 마이크로태스크에서 바뀐다.
 * 함수 초기값을 호출하는 지연 초기값은 지원하지 않는다.
 *
 * @param {*} initial 첫 렌더에서 쓸 초기값
 * @returns {Array} `[값, setState]`. `setState`는 렌더마다 같은 함수이다.
 * @throws {Error} 렌더 밖이나 자식 컴포넌트에서 호출했거나, Hook 개수나 종류가 첫 렌더와 다르면 던진다. `setState`는 렌더 중에 호출하거나, effect에서 연속으로 예약한 횟수가 50번을 넘으면 던진다.
 */
export function useState(initial) {
  const hook = nextHook('state', (component) => createStateHook(component, initial));

  return [hook.state, hook.setState];
}

/**
 * 두 deps가 달라서 다시 실행해야 하는지 판단한다.
 * deps가 없으면 항상 다르다. 길이가 다르면 다르고, 항목은 `Object.is`로 비교한다.
 *
 * @private
 * @param {Array} [oldDeps] 칸에 저장한 deps. 아직 저장하지 않았으면 없다.
 * @param {Array} [newDeps] 이번 렌더의 deps
 * @returns {boolean} 달라졌으면 `true`
 */
function depsChanged(oldDeps, newDeps) {
  if (!oldDeps || !newDeps) return true;
  if (oldDeps.length !== newDeps.length) return true;

  return newDeps.some((dep, index) => !Object.is(dep, oldDeps[index]));
}

/**
 * 화면을 반영한 뒤에 실행할 일을 등록한다. 루트 컴포넌트의 렌더 중에만 호출할 수 있다.
 * 렌더 중에는 deps만 비교하고, 달라졌으면 실행 목록에 넣는다.
 * deps가 없으면 렌더마다, `[]`이면 첫 렌더에만, 값이 있으면 값이 바뀐 렌더에 실행한다.
 * `effect`가 함수를 돌려주면 cleanup으로 저장해 다음 실행 전에 호출한다.
 * `unmount()`가 없으므로 마지막 cleanup은 실행되지 않는다.
 *
 * @param {Function} effect 화면 반영 뒤에 실행할 함수
 * @param {Array} [deps] 비교할 값의 배열
 * @returns {void}
 * @throws {Error} 렌더 밖이나 자식 컴포넌트에서 호출했거나, Hook 개수나 종류가 첫 렌더와 다르면 던진다.
 */
export function useEffect(effect, deps) {
  const hook = nextHook('effect', () => ({ kind: 'effect', deps: undefined, cleanup: undefined }));

  // 칸의 deps는 실행할 때 저장한다. 렌더나 patch가 실패하면 다음 렌더에서 다시 목록에 들어간다.
  if (depsChanged(hook.deps, deps)) {
    currentComponent.pendingEffects.push({ hook, effect, deps });
  }
}

/**
 * 계산한 값을 렌더 사이에 저장한다. 루트 컴포넌트의 렌더 중에만 호출할 수 있다.
 * deps가 같으면 `compute`를 실행하지 않고 저장한 값을 돌려준다. deps가 없으면 렌더마다 계산한다.
 * 값이 이번 Virtual DOM에 쓰이므로 렌더 중에 계산한다.
 *
 * @param {Function} compute 값을 계산하는 함수
 * @param {Array} [deps] 비교할 값의 배열
 * @returns {*} 계산했거나 저장해 둔 값
 * @throws {Error} 렌더 밖이나 자식 컴포넌트에서 호출했거나, Hook 개수나 종류가 첫 렌더와 다르면 던진다.
 */
export function useMemo(compute, deps) {
  const hook = nextHook('memo', () => ({ kind: 'memo', value: undefined, deps: undefined }));

  if (depsChanged(hook.deps, deps)) {
    hook.value = compute();
    hook.deps = deps;
  }

  return hook.value;
}
