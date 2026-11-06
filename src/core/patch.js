import { createDom, setProp } from './createDom.js';

/**
 * 영역에서 `path`를 따라 `childNodes`로 내려가 노드를 찾는다.
 *
 * @private
 * @param {Element} container 시작할 영역
 * @param {Array<number>} path 영역에서 노드까지의 경로
 * @returns {Node} 찾은 노드. `path`가 비어 있으면 영역 자체이다.
 */
function findNode(container, path) {
  return path.reduce((node, index) => node.childNodes[index], container);
}

/**
 * 요소 하나의 속성 변경을 적용한다.
 *
 * @private
 * @param {Element} element 속성을 바꿀 요소
 * @param {Object<string, string>} set 새로 생기거나 값이 바뀐 속성
 * @param {Array<string>} remove 사라진 속성의 이름
 * @returns {void}
 */
function applyProps(element, set, remove) {
  // HTML 속성 이름은 대소문자를 구분하지 않으므로, set을 먼저 하면 { a: '1' }이 { A: '1' }로 바뀔 때 넣은 속성이 곧바로 지워진다.
  for (const name of remove) {
    element.removeAttribute(name);
  }

  // Object.entries는 자기 속성만 돌려주므로 __proto__ 같은 이름도 값으로 읽힌다.
  for (const [name, value] of Object.entries(set)) {
    setProp(element, name, value);
  }
}

/**
 * 변경 항목 하나를 실제 DOM에 적용한다.
 *
 * @private
 * @param {Element} container 변경을 적용할 영역
 * @param {Change} change 적용할 변경 항목
 * @returns {void}
 */
function applyChange(container, change) {
  const { kind, path } = change;

  switch (kind) {
    case 'ADD':
      // 추가할 자리에는 아직 노드가 없으므로 마지막 번호를 뺀 경로로 부모를 찾는다.
      findNode(container, path.slice(0, -1)).appendChild(createDom(change.node));
      break;
    case 'REMOVE':
      findNode(container, path).remove();
      break;
    case 'TEXT':
      findNode(container, path).nodeValue = change.value;
      break;
    case 'REPLACE':
      findNode(container, path).replaceWith(createDom(change.node));
      break;
    case 'PROPS':
      applyProps(findNode(container, path), change.set, change.remove);
      break;
  }
}

/**
 * 변경 목록을 받은 순서대로 실제 DOM에 적용한다.
 * 목록에 없는 노드는 건드리지 않으므로 같은 DOM 객체로 남는다.
 * `changes`는 `container`의 내용을 나타내는 루트 Virtual DOM과 새 루트를 `diff`로 비교한 결과여야 한다.
 * `path`가 맞으려면 `container`의 `childNodes`와 이전 Virtual DOM의 `children`이 번호까지 일치해야 한다.
 *
 * @param {Element} container 변경을 적용할 영역
 * @param {Array<Change>} changes `diff`가 돌려준 변경 목록
 * @returns {void}
 * @throws {Error} 노드나 속성을 만들지 못하면 `createDom`과 `setProp`의 오류를 그대로 던진다. 이미 적용한 변경은 되돌리지 않으므로, 호출하는 쪽에서 `renderRoot`로 이전 Virtual DOM을 다시 그려야 한다.
 */
export function patch(container, changes) {
  for (const change of changes) {
    applyChange(container, change);
  }
}
