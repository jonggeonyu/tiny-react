import { h } from '../core/h.js';
import { FunctionComponent } from '../core/FunctionComponent.js';
import { describeChanges } from '../core/describeChanges.js';

const MAX_LOG = 8;
const MAX_VALUE = 80;

/**
 * 값을 `JSON.stringify`로 표시하고 80자가 넘으면 줄인다. 함수와 표시할 수 없는 값은 `(함수)`, `(표시 불가)`로 쓴다.
 *
 * @private
 * @param {*} value 표시할 값
 * @returns {string} 한 줄 문자열
 */
function formatValue(value) {
  if (typeof value === 'function') return '(함수)';

  let text;

  try {
    text = JSON.stringify(value, (key, v) => (typeof v === 'function' ? '(함수)' : v));
  } catch {
    return '(표시 불가)';
  }

  if (text === undefined) return 'undefined';

  const chars = Array.from(text);

  return chars.length > MAX_VALUE ? `${chars.slice(0, MAX_VALUE).join('')}…` : text;
}

/**
 * `hooks` 칸 하나를 한 줄로 설명한다. 예: `0 useState: "송"`, `3 useEffect: deps [1]`.
 *
 * @param {{kind: 'state' | 'effect' | 'memo'}} hook 칸
 * @param {number} index `hooks` 배열에서의 위치
 * @returns {string} 설명
 */
export function describeHook(hook, index) {
  switch (hook.kind) {
    case 'state':
      return `${index} useState: ${formatValue(hook.state)}`;
    case 'effect':
      return `${index} useEffect: ${hook.deps === undefined ? 'deps 없음' : `deps ${formatValue(hook.deps)}`}`;
    case 'memo':
      return `${index} useMemo: ${formatValue(hook.value)}`;
    default:
      return `${index} ${hook.kind}`;
  }
}

/**
 * 패널에 보여 줄 변경만 남긴다. `PROPS`의 `set`에서 함수 값과 `remove`에서 `on`으로 시작하는 이름을 빼고,
 * 남는 내용이 없는 `PROPS`는 뺀다. 입력은 바꾸지 않는다.
 *
 * @param {Array<Change>} changes `diff`가 돌려준 변경 목록
 * @returns {Array<Change>} 보여 줄 변경 목록
 */
export function visibleChanges(changes) {
  const result = [];

  for (const change of changes) {
    if (change.kind !== 'PROPS') {
      result.push(change);
      continue;
    }

    const set = Object.fromEntries(Object.entries(change.set ?? {}).filter(([, v]) => typeof v !== 'function'));
    const remove = (change.remove ?? []).filter((name) => !name.startsWith('on'));

    if (Object.keys(set).length > 0 || remove.length > 0) {
      result.push({ ...change, set, remove });
    }
  }

  return result;
}

/**
 * 게임 옆의 관찰 패널을 만들어 바로 마운트한다. 패널은 Hook 없는 `FunctionComponent`이고 게임을 다시 렌더하지 않는다.
 * 렌더 횟수, `hooks` 칸, 최근 변경 8줄(최신이 위)을 보여 준다.
 *
 * @param {Element} container 패널을 그릴 영역
 * @returns {{record: function(Array<Change>, Array<Object>): void}} `record(changes, hooks)`로 게임의 한 번의 렌더를 기록한다.
 */
export function createInspector(container) {
  let renderCount = 0;
  let lines = [];
  let hookLines = [];

  function Panel() {
    return h('div', null,
      h('p', { class: 'inspector-count' }, `렌더 ${renderCount}회`),
      h('pre', { class: 'inspector-hooks' }, hookLines.length > 0 ? hookLines.join('\n') : 'hooks 칸 없음'),
      h('ol', { class: 'inspector-log' },
        ...lines.map((line) => h('li', null, line))));
  }

  const panel = new FunctionComponent(Panel, container);

  panel.mount();

  return {
    record(changes, hooks) {
      const shown = visibleChanges(changes);

      renderCount += 1;
      hookLines = hooks.map(describeHook);
      lines = [describeChanges(shown) || '화면 변경 없음', ...lines].slice(0, MAX_LOG);
      panel.update();
    },
  };
}
