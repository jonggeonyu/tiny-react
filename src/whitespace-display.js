const symbols = {
  ' ': ['space', '·'],
  '\t': ['tab', '→'],
  '\n': ['newline', '↵'],
};

export function showWhitespace(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  for (const node of nodes) {
    if (node.parentElement.closest('[data-whitespace]') || !/[ \t\n]/.test(node.data)) {
      continue;
    }
    const fragment = document.createDocumentFragment();
    for (const part of node.data.split(/([ \t\n])/)) {
      const symbol = Object.hasOwn(symbols, part) ? symbols[part] : null;
      if (!symbol) {
        if (part) {
          fragment.append(document.createTextNode(part));
        }
        continue;
      }
      const marker = document.createElement('span');
      marker.dataset.whitespace = symbol[0];
      marker.textContent = symbol[1];
      if (part === '\n') {
        marker.append(document.createElement('br'));
      } else {
        marker.append(document.createElement('wbr'));
      }
      fragment.append(marker);
    }
    node.replaceWith(fragment);
  }
}

export function hideWhitespace(container) {
  const characters = { space: ' ', tab: '\t', newline: '\n' };
  container.querySelectorAll('[data-whitespace]').forEach((marker) => {
    marker.replaceWith(document.createTextNode(characters[marker.dataset.whitespace]));
  });
  container.normalize();
}

export function updateWhitespaceDisplay(result, vdom, enabled) {
  hideWhitespace(result);
  hideWhitespace(vdom);
  if (!enabled) {
    return;
  }
  for (const line of result.querySelectorAll('[data-diff-line]:not([data-diff="context"])')) {
    showWhitespace(line.querySelector('[data-diff-highlight]') || line);
  }
  for (const value of vdom.querySelectorAll('[data-change-before], [data-change-after], [data-declaration-before], [data-declaration-after]')) {
    if (!value.hasAttribute('data-absent') && !value.hasAttribute('data-empty')) {
      showWhitespace(value);
    }
  }
}
