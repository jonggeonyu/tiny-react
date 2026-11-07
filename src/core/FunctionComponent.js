import { renderRoot } from './createDom.js';
import { diff } from './diff.js';
import { normalizeChildren } from './h.js';
import { withCurrentComponent } from './hooks.js';
import { patch } from './patch.js';

/**
 * effect를 실행하는 동안 `update()`를 연속으로 예약할 수 있는 횟수이다.
 *
 * @private
 * @type {number}
 */
const MAX_EFFECT_UPDATES = 50;

/**
 * 컴포넌트 함수를 실행해 새 루트 Virtual DOM을 만든다. 화면과 `vdom`은 건드리지 않는다.
 *
 * @private
 * @param {FunctionComponent} instance 렌더할 인스턴스
 * @returns {VElement} `type`이 `'root'`인 새 루트 노드
 * @throws {Error} 컴포넌트가 실패했거나 Hook 개수가 첫 렌더와 다르면 던진다.
 * @throws {TypeError} 컴포넌트가 자식으로 쓸 수 없는 값을 돌려주면 던진다.
 */
function render(instance) {
  const { component } = instance;
  let result;

  instance.hookIndex = 0;
  instance.pendingEffects = [];
  instance.isRendering = true;

  try {
    result = withCurrentComponent(instance, () => component({}));
  } finally {
    instance.isRendering = false;
  }

  if (instance.hookIndex !== instance.hooks.length) {
    throw new Error('Hook 개수가 첫 렌더와 다르다.');
  }

  // 맨 위 노드가 항상 root여야 path: []의 REPLACE가 나오지 않고, 배열과 null도 처리할 수 있다.
  return { type: 'root', props: {}, children: normalizeChildren([result]) };
}

/**
 * 렌더 중이면 오류를 던진다.
 * 안쪽 렌더가 끝나면 `isRendering`이 `false`가 되고 `hookIndex`도 바뀌어서, 렌더 중 `setState` 검사가 우회된다.
 *
 * @private
 * @param {FunctionComponent} instance 확인할 인스턴스
 * @returns {void}
 * @throws {Error} 렌더 중이면 던진다.
 */
function assertNotRendering(instance) {
  if (instance.isRendering) {
    throw new Error('렌더 중에는 mount()와 update()를 호출할 수 없다.');
  }
}

/**
 * 이번 렌더의 실행 목록을 비우고, 이전 cleanup을 모두 실행한 뒤 effect를 차례로 실행한다.
 * 화면은 이미 반영됐으므로 여기의 실패는 렌더 실패가 아니다.
 * 칸의 deps는 cleanup을 실행하기 전에 비우고, effect를 호출하기 직전에 저장한다.
 * 실패하면 나머지는 멈춘다. 정리했지만 실행하지 못한 effect는 칸의 deps가 비어 있으므로, deps가 이전 값으로 돌아가도 다음 렌더에서 다시 실행한다.
 * 오류를 던진 effect는 deps를 저장했으므로 deps가 바뀔 때까지 다시 실행하지 않는다.
 *
 * @private
 * @param {FunctionComponent} instance effect를 실행할 인스턴스
 * @returns {void}
 * @throws {*} cleanup이나 effect가 던진 값을 그대로 던진다.
 */
function runEffects(instance) {
  const effects = instance.pendingEffects;

  instance.pendingEffects = [];
  instance.isRunningEffects = true;

  try {
    for (const { hook } of effects) {
      const { cleanup } = hook;

      // 정리한 effect가 다시 실행되도록 deps를 비우고, cleanup이 실패해도 두 번 돌지 않도록 cleanup도 먼저 비운다.
      hook.deps = undefined;
      hook.cleanup = undefined;
      if (cleanup) cleanup();
    }

    for (const { hook, effect, deps } of effects) {
      hook.deps = deps;

      const result = effect();

      hook.cleanup = typeof result === 'function' ? result : undefined;
    }
  } finally {
    instance.isRunningEffects = false;
  }
}

/**
 * 함수형 루트 컴포넌트를 감싸 Hook 칸과 화면을 관리한다.
 * 렌더 순서는 컴포넌트 실행, 새 Virtual DOM 생성, `diff`, `patch`, effect 실행이다.
 *
 * @param {Function} component 루트 컴포넌트 함수. `{}`를 받아 화면 내용을 돌려준다.
 * @param {Element} container 화면을 그릴 영역. 영역의 내용만 바뀌고 영역 자체는 그대로이다.
 * @param {object} [options] 선택 값
 * @param {Function} [options.onCommit] 화면 반영 뒤에 쓸 함수. 지금은 저장만 하고 호출하지 않는다.
 */
class FunctionComponent {
  constructor(component, container, options = {}) {
    this.component = component;
    this.container = container;
    this.onCommit = options.onCommit;
    this.hooks = [];
    this.hookIndex = 0;
    this.pendingEffects = [];
    this.vdom = null;
    this.isRendering = false;
    this.isScheduled = false;
    this.isStale = false;
    this.isRunningEffects = false;
    this.effectUpdateCount = 0;
  }

  /**
   * 처음 렌더해서 영역의 내용을 그린 뒤 effect를 실행한다.
   * 렌더나 그리기가 실패하면 마운트되지 않은 상태로 남고 영역의 내용은 그대로이다.
   * effect가 실패하면 오류를 던지지만 마운트는 끝난 상태이다.
   *
   * @returns {void}
   * @throws {Error} 렌더 중에 호출했거나, 이미 마운트했거나, 렌더, 그리기, effect가 실패하면 던진다.
   */
  mount() {
    assertNotRendering(this);

    if (this.vdom !== null) {
      throw new Error('이미 마운트한 컴포넌트이다.');
    }

    const next = render(this);

    renderRoot(this.container, next);
    this.vdom = next;
    runEffects(this);
  }

  /**
   * 다시 렌더해서 바뀐 부분만 화면에 반영한 뒤 effect를 실행한다.
   * 변경 목록이 비어 있어도 effect는 실행한다.
   * 렌더가 실패하면 화면과 `vdom`은 그대로이다.
   * `patch`가 실패하면 이전 `vdom`으로 영역을 다시 그리고, `vdom`은 갱신하지 않는다.
   * 렌더나 `patch`가 실패하면 effect를 실행하지 않고 `isStale`이 `true`가 되고, 성공하면 `false`가 된다.
   * effect의 실패는 렌더 실패가 아니므로 오류만 던지고 `isStale`은 바꾸지 않는다.
   *
   * @returns {void}
   * @throws {Error} 렌더 중에 호출했거나, 마운트 전이거나, 렌더, `patch`, effect가 실패하면 던진다.
   */
  update() {
    assertNotRendering(this);

    if (this.vdom === null) {
      throw new Error('마운트 전에는 update()를 호출할 수 없다.');
    }

    try {
      const next = render(this);
      const changes = diff(this.vdom, next);

      try {
        patch(this.container, changes);
      } catch (error) {
        // patch는 적용한 변경을 되돌리지 않으므로, 다시 그려야 화면과 vdom이 어긋나지 않는다.
        renderRoot(this.container, this.vdom);
        throw error;
      }

      this.vdom = next;
      this.isStale = false;
    } catch (error) {
      // 칸의 값은 새 값인데 화면은 이전 값이므로, 같은 값의 setState도 다시 시도하게 표시한다.
      this.isStale = true;
      throw error;
    }

    runEffects(this);
  }

  /**
   * `update()`를 마이크로태스크로 예약한다. 이미 예약되어 있으면 아무것도 하지 않는다.
   * 한 핸들러의 여러 `setState`가 렌더 한 번으로 묶인다.
   * `update()`의 오류는 마이크로태스크에서 던져지므로 호출한 쪽으로 돌아오지 않는다.
   * effect를 실행하는 동안 예약한 횟수를 세고, effect 밖에서 예약하면 횟수를 0으로 되돌린다.
   *
   * @returns {void}
   * @throws {Error} effect에서 연속으로 예약한 횟수가 50번을 넘으면 던진다. 마이크로태스크가 끝나지 않아 탭이 멈추는 것을 막는다.
   */
  scheduleUpdate() {
    if (this.isScheduled) return;

    if (!this.isRunningEffects) {
      this.effectUpdateCount = 0;
    } else if (this.effectUpdateCount === MAX_EFFECT_UPDATES) {
      this.effectUpdateCount = 0;
      // 칸의 값은 이미 바뀌었는데 렌더를 예약하지 않으므로, 같은 값의 setState도 다시 시도하게 표시한다.
      this.isStale = true;
      throw new Error(`effect에서 update()를 연속 ${MAX_EFFECT_UPDATES}번 넘게 예약했다.`);
    } else {
      this.effectUpdateCount += 1;
    }

    this.isScheduled = true;

    queueMicrotask(() => {
      // update()가 실패해도 다음 setState가 다시 예약할 수 있도록 먼저 되돌린다.
      this.isScheduled = false;
      this.update();
    });
  }
}

// export class로 쓰면 생성자가 있는 클래스가 jsdoc2md 결과에서 빠진다.
export { FunctionComponent };
