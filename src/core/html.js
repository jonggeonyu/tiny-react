import { renderRoot } from './createDom.js';
import { containerToVdom } from './domToVdom.js';

/**
 * 루트 Virtual DOM을 HTML 문자열로 바꾼다.
 * 문서에 붙이지 않은 임시 요소에 그린 뒤 `innerHTML`을 읽으므로, 이스케이프는 브라우저가 처리한다.
 * 다만 `script`, `style`처럼 내용을 그대로 쓰는 요소의 텍스트는 이스케이프되지 않는다.
 * `htmlToVdom`과의 왕복은 파서가 만든 Virtual DOM을 기준으로 하며, 손으로 만든 Virtual DOM은 보장하지 않는다.
 *
 * @param {VElement} root `type`이 `'root'`인 루트 노드
 * @returns {string} 루트의 자식들을 직렬화한 HTML 문자열. 루트 자체의 태그는 들어가지 않는다.
 * @throws {Error} 노드를 만들지 못하면 `renderRoot`의 오류를 그대로 던진다.
 */
export function vdomToHtml(root) {
  // <template>은 자식이 content에 있어야 innerHTML로 읽히므로 임시 요소로 쓸 수 없다.
  const container = document.createElement('div');

  renderRoot(container, root);

  return container.innerHTML;
}

/**
 * HTML 문자열을 루트 Virtual DOM으로 바꾼다.
 * `<template>`에서 파싱하므로 내용이 화면에 그려지거나 실행되지 않고, `<tr>`로 시작하는 입력도 버려지지 않는다.
 * 다만 최상위 표 요소는 앞뒤 내용에 따라 파서가 버릴 수 있다.
 * `<p>` 같은 일반 요소나 `<td>` 뒤의 `<tr>`은 태그가 버려지고 내용만 남으며, `<col>` 뒤의 내용은 통째로 버려진다.
 * 닫지 않은 태그 같은 일반적인 잘못된 입력은 파서가 고쳐서 읽는다.
 *
 * @param {string} html 변환할 HTML 문자열
 * @returns {VElement} `type`이 `'root'`인 루트 노드
 * @throws {RangeError} 중첩이 너무 깊으면 오류를 던진다. jsdom에서는 2만 단계에서 확인했다.
 */
export function htmlToVdom(html) {
  const template = document.createElement('template');

  template.innerHTML = html;

  return containerToVdom(template.content);
}
