import { createVirtualRoot } from './vdom.js';

export function sourcePosition(source, offset) {
  if (!Number.isInteger(offset) || offset < 0 || offset > source.length) {
    return null;
  }
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset;) {
    if (source[index] === '\r') {
      index += source[index + 1] === '\n' ? 2 : 1;
      line += 1;
      column = 1;
    } else if (source[index] === '\n') {
      index += 1;
      line += 1;
      column = 1;
    } else {
      index += source.codePointAt(index) > 0xffff ? 2 : 1;
      column += 1;
    }
  }
  return { line, column };
}

function diagnostic(source, message, offset) {
  return { message, position: sourcePosition(source, offset) };
}

function inputError(source, message, offset) {
  const error = new Error(message);
  error.diagnostic = diagnostic(source, message, offset);
  return error;
}

export function renderDiagnostics(region, diagnostics) {
  const elements = diagnostics.map((item) => {
    const element = document.createElement('span');
    element.dataset.diagnostic = '';
    if (item.position) {
      element.dataset.line = item.position.line;
      element.dataset.column = item.position.column;
      element.textContent = `${item.message} (${item.position.line}줄 ${item.position.column}열)`;
    } else {
      element.dataset.position = 'unknown';
      element.textContent = `${item.message} (위치를 알 수 없습니다)`;
    }
    return element;
  });
  const content = [];
  elements.forEach((element, index) => {
    if (index > 0) {
      content.push(document.createTextNode(' '));
    }
    content.push(element);
  });
  region.replaceChildren(...content);
  region.hidden = elements.length === 0;
}

export function errorDiagnostic(error) {
  return error.diagnostic || { message: error.message || '입력 검사 오류', position: null };
}

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

function findTagEnd(html, start) {
  let quote = null;
  let quoteStart = null;
  let valueState = 'none';
  for (let index = start + 1; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) {
        quote = null;
        valueState = 'none';
      }
      continue;
    }
    if (valueState === 'before') {
      if (/[ \t\n\r\f]/.test(char)) {
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        quoteStart = index;
        continue;
      }
      if (char !== '>') {
        valueState = 'unquoted';
      }
    }
    if (valueState === 'unquoted') {
      if (/[ \t\n\r\f]/.test(char)) {
        valueState = 'none';
        continue;
      }
      if (/["'<=`]/.test(char)) {
        throw inputError(html, '따옴표 없는 속성값에 허용하지 않는 글자가 있습니다.', index);
      }
    }
    if (char === '>') {
      return index;
    }
    if (char === '=' && valueState === 'none') {
      valueState = 'before';
    }
  }
  throw inputError(html, '태그 또는 속성 따옴표가 닫히지 않았습니다.', quote ? quoteStart : start);
}

// 원문을 먼저 검사해 네트워크 요청이나 이벤트 속성이 DOM에 들어가지 않게 한다.
export function inspectHtml(html, warnings = []) {
  const stack = [];
  const starts = [];
  let index = 0;
  while (index < html.length) {
    if (stack.at(-1) === 'textarea') {
      const close = /<\/textarea[ \t\n\r\f]*>/ig;
      close.lastIndex = index;
      const match = close.exec(html);
      if (!match) {
        throw inputError(html, '닫히지 않은 textarea가 있습니다.', starts.at(-1));
      }
      index = match.index;
    }
    if (html[index] !== '<' || !/[a-z!/?]/i.test(html[index + 1] || '')) {
      index += 1;
      continue;
    }
    const start = index;
    index = findTagEnd(html, start);
    const token = html.slice(start + 1, index);
    index += 1;
    const closing = /^\/([a-z][a-z0-9]*)[ \t\n\r\f]*$/i.exec(token);
    if (closing) {
      const tag = closing[1].toLowerCase();
      if (tag === 'input') {
        warnings.push(diagnostic(html, '불필요한 input 닫는 태그를 무시합니다.', start));
      } else if (stack.at(-1) !== tag) {
        throw inputError(html, '닫는 태그의 순서가 잘못되었습니다.', start);
      } else {
        stack.pop();
        starts.pop();
      }
      continue;
    }
    if (token.startsWith('/')) {
      throw inputError(html, '닫는 태그의 문법이 잘못되었습니다.', start);
    }
    const opening = /^([a-z][a-z0-9]*)(?=[ \t\n\r\f/]|$)/i.exec(token);
    if (!opening) {
      const message = token.startsWith('!') ? '주석은 지원하지 않습니다.' : '지원하지 않는 태그입니다.';
      throw inputError(html, message, start);
    }
    const tag = opening[1].toLowerCase();
    const fakeNode = { nodeType: 1, localName: tag, attributes: [], childNodes: [], type: 'text', value: '', checked: false };
    try {
      createVirtualRoot({ childNodes: [fakeNode] });
    } catch (error) {
      throw inputError(html, error.message, start);
    }
    let rest = token.slice(opening[0].length);
    let consumed = opening[0].length;
    while (!/^[ \t\n\r\f]*$/.test(rest)) {
      const match = /^[ \t\n\r\f]+([^ \t\n\r\f=/>"']+)(?:[ \t\n\r\f]*=[ \t\n\r\f]*(?:"([^"]*)"|'([^']*)'|([^ \t\n\r\f"'=<>`]+)))?/.exec(rest);
      if (!match) {
        if (/^[ \t\n\r\f]*\/[ \t\n\r\f]*$/.test(rest) && tag === 'input') {
          break;
        }
        const invalidOffset = rest.search(/[^ \t\n\r\f]/);
        throw inputError(html, '속성 문법이 잘못되었습니다.', start + 1 + consumed + invalidOffset);
      }
      const attr = { name: match[1].toLowerCase(), value: match[2] ?? match[3] ?? match[4] ?? '' };
      try {
        createVirtualRoot({ childNodes: [{ ...fakeNode, attributes: [attr] }] });
      } catch (error) {
        throw inputError(html, error.message, start + 1 + consumed + match[0].search(/[^ \t\n\r\f]/));
      }
      consumed += match[0].length;
      rest = rest.slice(match[0].length);
    }
    if (changesBrowserStructure(stack, tag)) {
      warnings.push(diagnostic(html, '브라우저가 HTML 구조를 보정할 수 있습니다.', start));
    }
    if (tag !== 'input') {
      stack.push(tag);
      starts.push(start);
    }
  }
  if (stack.length) {
    throw inputError(html, `닫히지 않은 태그가 있습니다: ${stack[0]}`, starts[0]);
  }
  return warnings;
}
