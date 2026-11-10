import { createVirtualRoot } from './vdom.js';

function changesBrowserStructure(stack, tag) {
  const paragraph = stack.lastIndexOf('p');
  const paragraphInScope = paragraph > stack.lastIndexOf('button') && paragraph > stack.lastIndexOf('select');
  const paragraphBreakers = ['div', 'section', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  if (paragraphInScope && paragraphBreakers.includes(tag)) {
    return true;
  }
  if (tag === 'button' && stack.lastIndexOf('button') > stack.lastIndexOf('select')) {
    return true;
  }
  if (/^h[1-6]$/.test(tag) && /^h[1-6]$/.test(stack.at(-1) || '')) {
    return true;
  }
  const listBoundaries = ['ul', 'ol', 'section', 'button', 'select', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const listBoundary = Math.max(...listBoundaries.map((name) => stack.lastIndexOf(name)));
  if (tag === 'li' && stack.lastIndexOf('li') > listBoundary) {
    return true;
  }
  if ((tag === 'option' && stack.at(-1) === 'option') ||
      (stack.includes('select') && (tag === 'select' || tag === 'input'))) {
    return true;
  }
  return false;
}

// 원문을 먼저 검사해 네트워크 요청이나 이벤트 속성이 DOM에 들어가지 않게 한다.
export function inspectHtml(html, warnings = []) {
  const stack = [];
  let index = 0;
  while (index < html.length) {
    if (stack.at(-1) === 'textarea') {
      const close = /<\/textarea\s*>/ig;
      close.lastIndex = index;
      const match = close.exec(html);
      if (!match) {
        throw new Error('닫히지 않은 textarea가 있습니다.');
      }
      index = match.index;
    }
    if (html[index] !== '<' || !/[a-z!/?]/i.test(html[index + 1] || '')) {
      index += 1;
      continue;
    }
    const start = index;
    let quote = null;
    index += 1;
    while (index < html.length) {
      const char = html[index];
      if (quote) {
        if (char === quote) {
          quote = null;
        }
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        break;
      }
      index += 1;
    }
    if (index >= html.length || quote) {
      throw new Error(`태그 또는 속성 따옴표가 닫히지 않았습니다 (${start + 1}).`);
    }
    const token = html.slice(start + 1, index);
    index += 1;
    const closing = /^\/\s*([a-z][a-z0-9]*)\s*$/i.exec(token);
    if (closing) {
      const tag = closing[1].toLowerCase();
      if (tag === 'input') {
        warnings.push('불필요한 input 닫는 태그를 무시합니다.');
      } else if (stack.pop() !== tag) {
        throw new Error(`닫는 태그의 순서가 잘못되었습니다 (${start + 1}).`);
      }
      continue;
    }
    const opening = /^([a-z][a-z0-9]*)(?=\s|\/|$)/i.exec(token);
    if (!opening) {
      throw new Error(`지원하지 않는 태그 또는 주석입니다 (${start + 1}).`);
    }
    const tag = opening[1].toLowerCase();
    let rest = token.slice(opening[0].length);
    const attrs = [];
    while (rest.trim()) {
      const match = /^\s+([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/.exec(rest);
      if (!match) {
        if (/^\s*\/\s*$/.test(rest) && tag === 'input') {
          break;
        }
        throw new Error(`속성 문법이 잘못되었습니다 (${start + 1}).`);
      }
      attrs.push({ name: match[1].toLowerCase(), value: match[2] ?? match[3] ?? match[4] ?? '' });
      rest = rest.slice(match[0].length);
    }
    createVirtualRoot({ childNodes: [{ nodeType: 1, localName: tag, attributes: attrs, childNodes: [], type: 'text', value: '', checked: false }] });
    if (changesBrowserStructure(stack, tag)) {
      warnings.push('브라우저가 HTML 구조를 보정할 수 있습니다.');
    }
    if (tag !== 'input') {
      stack.push(tag);
    }
  }
  if (stack.length) {
    throw new Error(`닫히지 않은 태그가 있습니다: ${stack.at(-1)}`);
  }
  return warnings;
}
