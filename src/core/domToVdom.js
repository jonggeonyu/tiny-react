/**
 * Virtual DOM의 요소 노드이다.
 *
 * @typedef {object} VElement
 * @property {string} type 소문자 태그 이름
 * @property {Object<string, string>} props 속성 이름과 값. 속성이 없으면 `{}`이다.
 * @property {Array<VNode>} children 자식 노드 목록. 항상 배열이다.
 */

/**
 * Virtual DOM의 노드이다. 텍스트는 문자열, 요소는 `VElement`로 표현한다.
 *
 * @typedef {string | VElement} VNode
 */

// 정규식의 \s는 &nbsp; 같은 문자까지 공백으로 치므로 HTML 공백 문자만 직접 적는다.
const HTML_WHITESPACE_ONLY = /^[ \t\n\f\r]+$/;
const LINE_BREAK = /[\n\r]/;

/**
 * 공백만 있으면서 줄바꿈을 포함한 텍스트인지 확인한다.
 *
 * @private
 * @param {string} text 확인할 텍스트
 * @returns {boolean} 제외할 텍스트이면 `true`
 */
function isLineBreakWhitespace(text) {
  return HTML_WHITESPACE_ONLY.test(text) && LINE_BREAK.test(text);
}

/**
 * `childNodes`를 변환해 `children`을 만든다.
 * 제외 대상을 걸러 내고, 나란히 남은 텍스트를 하나의 문자열로 합친다.
 *
 * @private
 * @param {NodeList} childNodes 변환할 자식 노드 목록
 * @returns {Array<VNode>} 정리된 자식 목록
 */
function childNodesToVdom(childNodes) {
  const children = [];

  for (const childNode of childNodes) {
    const child = domToVdom(childNode);
    if (child === null) continue;

    const lastIndex = children.length - 1;
    if (typeof child === 'string' && typeof children[lastIndex] === 'string') {
      children[lastIndex] += child;
    } else {
      children.push(child);
    }
  }

  return children;
}

/**
 * DOM 노드 하나를 Virtual DOM으로 변환한다.
 * 주석과, 공백만 있으면서 줄바꿈을 포함한 텍스트는 제외 대상이므로 `null`을 돌려준다.
 * 요소와 텍스트가 아닌 다른 노드(`DocumentFragment`, doctype, 처리 명령 등)도 `null`을 돌려준다.
 *
 * @param {Node} node 변환할 DOM 노드
 * @returns {VNode | null} 변환한 노드. 제외 대상이면 `null`이다.
 */
export function domToVdom(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return isLineBreakWhitespace(node.nodeValue) ? null : node.nodeValue;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    return {
      type: node.tagName.toLowerCase(),
      // props[name] = value로 넣으면 __proto__ 속성이 저장되지 않는다.
      props: Object.fromEntries(Array.from(node.attributes, ({ name, value }) => [name, value])),
      children: childNodesToVdom(node.childNodes),
    };
  }

  return null;
}

/**
 * 영역의 자식들을 변환해 루트 Virtual DOM을 만든다.
 * 영역 자체의 태그와 속성은 루트 노드에 넣지 않는다.
 *
 * @param {Element | DocumentFragment} container 변환할 영역
 * @returns {VElement} `type`이 `'root'`인 루트 노드
 */
export function containerToVdom(container) {
  return { type: 'root', props: {}, children: childNodesToVdom(container.childNodes) };
}
