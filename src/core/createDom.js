/**
 * `value` 프로퍼티를 속성과 함께 맞춰야 하는 요소인지 판단한다.
 *
 * @private
 * @param {Element} element 확인할 요소
 * @returns {boolean} `file` 타입을 뺀 `input`과 `textarea`이면 `true`이다.
 */
function hasValueProperty(element) {
  // file 타입은 빈 문자열이 아닌 값을 대입하면 InvalidStateError가 난다.
  return (element.tagName === 'INPUT' && element.type !== 'file') || element.tagName === 'TEXTAREA';
}

/**
 * 속성 하나를 실제 DOM에 넣는다.
 * `createDom`과 `patch`가 이 함수를 함께 써서 속성을 넣는 경로를 하나로 유지한다.
 * `on`으로 시작하는 이름의 함수는 이벤트 핸들러 프로퍼티에 대입하므로 이전 핸들러를 교체하고 속성에 나타나지 않는다.
 * `input`과 `textarea`의 `value`, `input`의 `checked`는 속성과 프로퍼티를 함께 맞춘다.
 *
 * @param {Element} element 속성을 넣을 요소
 * @param {string} name 속성 이름
 * @param {string | Function} value 속성 값이거나 이벤트 핸들러
 * @returns {void}
 * @throws {DOMException} 넣을 수 없는 속성 이름이면 `InvalidCharacterError`를 던진다.
 */
export function setProp(element, name, value) {
  if (typeof value === 'function' && name.startsWith('on')) {
    element[name.toLowerCase()] = value;
    return;
  }

  element.setAttribute(name, value);

  // 값이 같을 때 대입하면 입력 중인 커서와 한글 조합이 깨진다.
  if (name === 'value' && hasValueProperty(element) && element.value !== value) {
    element.value = value;
  }

  // 파서가 만드는 checked: ''를 그대로 대입하면 false가 되므로 true로 맞춘다.
  if (name === 'checked' && element.tagName === 'INPUT') {
    element.checked = true;
  }
}

/**
 * 속성 하나를 실제 DOM에서 지운다.
 * 이벤트 핸들러와 `checked`, `value` 프로퍼티는 속성을 지워도 남으므로 함께 되돌린다.
 *
 * @param {Element} element 속성을 지울 요소
 * @param {string} name 속성 이름
 * @returns {void}
 */
export function removeProp(element, name) {
  if (name.startsWith('on')) {
    element[name.toLowerCase()] = null;
  }

  if (name === 'checked') {
    element.checked = false;
  }

  if (name === 'value' && hasValueProperty(element)) {
    element.value = '';
  }

  // checkbox, hidden 같은 타입은 value 대입이 속성에 쓰이므로 속성을 마지막에 지운다.
  element.removeAttribute(name);
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
