import { vdomToHtml } from '../core/html.js';

const INDENT = '  ';

// 파서가 여는 태그 뒤의 첫 줄바꿈만 지워서, 줄을 나누면 들여쓰기가 내용으로 남는 요소이다.
const FIRST_LINE_BREAK_DROPPED = new Set(['pre', 'listing']);

/**
 * 요소 노드인지 확인한다.
 *
 * @private
 * @param {VNode} node 확인할 노드
 * @returns {boolean} 요소이면 `true`
 */
function isElement(node) {
  return typeof node !== 'string';
}

/**
 * 요소 하나를 `vdomToHtml`로 직렬화한다.
 *
 * @private
 * @param {VElement} node 직렬화할 요소
 * @returns {string} 요소의 HTML 문자열
 */
function elementToHtml(node) {
  return vdomToHtml({ type: 'root', props: {}, children: [node] });
}

/**
 * 자식 사이에 줄바꿈과 들여쓰기를 넣어도 Virtual DOM이 그대로인 요소인지 확인한다.
 * 줄바꿈을 포함한 공백은 `domToVdom`이 지우지만, 텍스트 옆에 넣으면 텍스트의 일부가 된다.
 *
 * @private
 * @param {VElement} node 확인할 요소
 * @returns {boolean} 줄을 나눌 수 있으면 `true`
 */
function canSplitLines(node) {
  return node.children.length > 0 && node.children.every(isElement) && !FIRST_LINE_BREAK_DROPPED.has(node.type);
}

/**
 * 요소 하나를 줄바꿈과 들여쓰기를 맞춘 HTML로 바꾼다.
 * 여는 태그와 닫는 태그는 자식을 뺀 요소의 직렬화 결과를 잘라서 얻는다.
 * 속성 값에 `</`가 있어도 맨 뒤의 `</`는 항상 닫는 태그이다.
 *
 * @private
 * @param {VElement} node 바꿀 요소
 * @param {number} depth 들여쓰기 깊이
 * @returns {string} 정렬한 HTML 문자열
 */
function formatElement(node, depth) {
  const indent = INDENT.repeat(depth);

  if (!canSplitLines(node)) {
    return indent + elementToHtml(node);
  }

  const shell = elementToHtml({ ...node, children: [] });
  const closeTagStart = shell.lastIndexOf('</');

  return [
    indent + shell.slice(0, closeTagStart),
    ...node.children.map((child) => formatElement(child, depth + 1)),
    indent + shell.slice(closeTagStart),
  ].join('\n');
}

/**
 * 루트 Virtual DOM을 줄바꿈과 2칸 들여쓰기를 맞춘 HTML 문자열로 바꾼다.
 * 자식이 모두 요소일 때만 줄을 나눠서, 결과를 `htmlToVdom`으로 다시 읽으면 같은 Virtual DOM이 된다.
 * 텍스트가 섞인 요소는 안쪽까지 `vdomToHtml` 결과 그대로 한 줄에 두고, 자식이 없는 요소와 `pre`, `listing`도 한 줄이다.
 * 루트도 같은 규칙이므로 루트에 텍스트가 섞이면 결과는 `vdomToHtml(root)`와 같다.
 * 이스케이프와 직렬화는 `vdomToHtml`을 그대로 쓰며, 왕복의 범위도 `vdomToHtml`과 같다.
 *
 * @param {VElement} root `type`이 `'root'`인 루트 노드
 * @returns {string} 정렬한 HTML 문자열. 루트 자체의 태그는 들어가지 않는다.
 * @throws {Error} 노드를 만들지 못하면 `vdomToHtml`의 오류를 그대로 던진다.
 */
export function formatHtml(root) {
  if (!root.children.every(isElement)) {
    return vdomToHtml(root);
  }

  return root.children.map((child) => formatElement(child, 0)).join('\n');
}
