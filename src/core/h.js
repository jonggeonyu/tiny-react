import { withoutHooks } from './hooks.js';

/**
 * 자식 목록을 Virtual DOM 자식 배열로 정리한다.
 * 문자열과 요소는 그대로 두고, 숫자는 문자열로 바꾸며, `null`, `undefined`, `true`, `false`는 버린다.
 * 배열은 재귀로 펼치고, 나란한 문자열은 합치지 않는다.
 *
 * @param {Array<*>} children 정리할 자식 목록
 * @returns {Array<VNode>} 문자열과 요소만 담긴 배열
 * @throws {TypeError} 자식에 일반 객체나 함수가 있으면 던진다.
 */
export function normalizeChildren(children) {
  const result = [];

  for (const child of children) {
    if (child === null || child === undefined || typeof child === 'boolean') continue;

    if (Array.isArray(child)) {
      result.push(...normalizeChildren(child));
    } else if (typeof child === 'string') {
      result.push(child);
    } else if (typeof child === 'number') {
      result.push(String(child));
    } else if (typeof child === 'object' && typeof child.type === 'string' && Array.isArray(child.children)) {
      result.push(child);
    } else {
      throw new TypeError(`자식으로 쓸 수 없는 값이다: ${typeof child}`);
    }
  }

  return result;
}

/**
 * 속성 값을 정규화한다. 버릴 값은 객체에 넣지 않는다.
 * @private
 * @param {Object} props
 * @returns {Object}
 */
function normalizeProps(props) {
  const result = {};

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;

    if (value === true) result[key] = '';
    else if (typeof value === 'number') result[key] = String(value);
    else result[key] = value;
  }

  return result;
}

/**
 * Virtual DOM 노드를 만든다. JSX 대신 쓴다.
 * `type`이 함수이면 `type({ ...props, children })`을 바로 호출해 결과를 돌려준다.
 * 이때 `props`는 정규화하지 않고 `children`만 정규화한다.
 * 자식 컴포넌트를 실행하는 동안에는 Hook을 쓸 수 없다.
 *
 * @param {string|Function} type 태그 이름 또는 자식 컴포넌트 함수
 * @param {?Object} props 속성. `null`이나 `undefined`이면 `{}`로 본다.
 * @param {...*} children 자식들
 * @returns {VNode|*} 문자열 `type`이면 `{ type, props, children }`, 함수 `type`이면 그 함수의 반환값
 * @throws {TypeError} 자식에 일반 객체나 함수가 있으면 던진다.
 */
export function h(type, props, ...children) {
  const normalized = normalizeChildren(children);

  if (typeof type === 'function') {
    return withoutHooks(() => type({ ...(props ?? {}), children: normalized }));
  }

  return { type, props: normalizeProps(props ?? {}), children: normalized };
}
