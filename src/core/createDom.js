/**
 * 속성 하나를 실제 DOM에 넣는다.
 * `createDom`과 `patch`가 이 함수를 함께 써서 속성을 넣는 경로를 하나로 유지한다.
 *
 * @param {Element} element 속성을 넣을 요소
 * @param {string} name 속성 이름
 * @param {string} value 속성 값
 * @returns {void}
 * @throws {DOMException} 넣을 수 없는 속성 이름이면 `InvalidCharacterError`를 던진다.
 */
export function setProp(element, name, value) {
  element.setAttribute(name, value);
}

/**
 * Virtual DOM을 실제 DOM으로 변환한다.
 * 문자열은 텍스트 노드가 되고, 요소는 `props`와 `children`까지 재귀로 만든다.
 *
 * @param {VNode} vnode 변환할 노드
 * @returns {Text | Element} 새로 만든 DOM 노드
 * @throws {Error} 노드를 만들지 못하면 오류를 던진다. 만들 수 없는 태그 이름이나 속성 이름은 `InvalidCharacterError`이고, 중첩이 너무 깊으면 `RangeError`이다.
 */
export function createDom(vnode) {
  if (typeof vnode === 'string') {
    return document.createTextNode(vnode);
  }

  const element = document.createElement(vnode.type);

  // Object.entries는 자기 속성만 돌려주므로 __proto__ 같은 이름도 값으로 읽힌다.
  for (const [name, value] of Object.entries(vnode.props)) {
    setProp(element, name, value);
  }

  for (const child of vnode.children) {
    element.appendChild(createDom(child));
  }

  return element;
}

/**
 * 루트 Virtual DOM으로 영역의 내용을 다시 그린다.
 * 새 노드를 `DocumentFragment`에 모두 만든 뒤 한 번에 교체한다.
 * 영역 자체의 태그와 속성은 바꾸지 않는다.
 *
 * @param {Element} container 다시 그릴 영역
 * @param {VElement} root `type`이 `'root'`인 루트 노드
 * @returns {void}
 * @throws {Error} 노드를 만들지 못하면 오류를 던진다. 어떤 오류가 나도 교체 전에 멈추므로 기존 내용이 그대로 남는다.
 */
export function renderRoot(container, root) {
  // replaceChildren(...nodes)는 노드가 약 12만 개를 넘으면 인자 펼침에서 RangeError가 난다.
  const fragment = document.createDocumentFragment();

  for (const child of root.children) {
    fragment.appendChild(createDom(child));
  }

  container.replaceChildren(fragment);
}
