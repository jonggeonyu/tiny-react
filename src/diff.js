const booleanAttributes = new Set(['checked', 'disabled', 'multiple', 'selected']);

function stylesEqual(first, second) {
  const parse = (value) => {
    const entries = value.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf(':');
      return [part.slice(0, index).trim().toLowerCase(), part.slice(index + 1).trim().toLowerCase()];
    });
    const names = entries.map(([name]) => name);
    if (new Set(names).size !== names.length) {
      return null;
    }
    return entries.sort(([a], [b]) => a.localeCompare(b));
  };
  const left = parse(first);
  const right = parse(second);
  return left && right && JSON.stringify(left) === JSON.stringify(right);
}

export function diff(oldRoot, nextRoot) {
  const changes = [];
  function visit(oldNode, nextNode, path, parentTag = '') {
    if (!oldNode || !nextNode) {
      changes.push({ type: oldNode ? 'remove' : 'add', path, oldNode, nextNode, parentTag });
      return;
    }
    if (oldNode.type !== nextNode.type || oldNode.tag !== nextNode.tag) {
      changes.push({ type: 'replace', path, oldNode, nextNode, parentTag });
      return;
    }
    if (oldNode.type === 'text') {
      if (oldNode.text !== nextNode.text) {
        changes.push({ type: 'text', path, oldNode, nextNode, parentTag });
      }
      return;
    }
    const oldAttrs = oldNode.attributes || {};
    const nextAttrs = nextNode.attributes || {};
    for (const name of new Set([...Object.keys(oldAttrs), ...Object.keys(nextAttrs)])) {
      const previous = oldAttrs[name];
      const next = nextAttrs[name];
      if (previous === next || (previous !== undefined && next !== undefined && (booleanAttributes.has(name) || (name === 'style' && stylesEqual(previous, next))))) {
        continue;
      }
      changes.push({ type: 'attribute', path, name, previous, next, oldNode, nextNode, parentTag: nextNode.tag });
    }
    const length = Math.max(oldNode.children.length, nextNode.children.length);
    for (let index = 0; index < length; index += 1) {
      visit(oldNode.children[index], nextNode.children[index], [...path, index], nextNode.tag || parentTag);
    }
    if (JSON.stringify(oldNode.formState) !== JSON.stringify(nextNode.formState)) {
      changes.push({ type: 'form', path, oldNode, nextNode, parentTag });
    }
  }
  visit(oldRoot, nextRoot, []);
  return changes;
}
