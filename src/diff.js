import { findStableChildren, getNodeKey, isFormattingWhitespace, matchChildren, validateSiblingKeys } from './keyed-children.js';

const booleanAttributes = new Set(['checked', 'disabled', 'multiple', 'selected']);

const independentStyles = new Set([
  'color', 'background-color', 'font-size', 'width', 'height', 'margin', 'padding',
  'font-weight', 'text-align', 'display', 'white-space',
]);

function parseIndependentStyles(value) {
  const declarations = new Map();
  for (const part of value.split(';')) {
    if (!part.trim()) {
      continue;
    }
    const match = /^\s*([a-z-]+)\s*:\s*([^:]+?)\s*$/i.exec(part);
    const name = match?.[1].toLowerCase();
    if (!match || !independentStyles.has(name) || declarations.has(name) || /[\\/()!]/.test(match[2])) {
      return null;
    }
    declarations.set(name, match[2].toLowerCase());
  }
  return [...declarations].sort(([first], [second]) => first.localeCompare(second));
}

function stylesEqual(first, second) {
  const left = parseIndependentStyles(first);
  const right = parseIndependentStyles(second);
  return left && right && JSON.stringify(left) === JSON.stringify(right);
}

export function diff(oldRoot, nextRoot) {
  validateSiblingKeys(oldRoot);
  validateSiblingKeys(nextRoot);
  const changes = [];
  function visit(oldNode, nextNode, path, parentTag = '', nextPath = path) {
    if (!oldNode || !nextNode) {
      changes.push({ type: oldNode ? 'remove' : 'add', path, nextPath, oldNode, nextNode, parentTag });
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
    compareChildren(oldNode, nextNode, path, nextPath, nextNode.tag || parentTag);
    if (JSON.stringify(oldNode.formState) !== JSON.stringify(nextNode.formState)) {
      changes.push({ type: 'form', path, oldNode, nextNode, parentTag });
    }
  }
  function compareChildren(oldNode, nextNode, path, nextPath, parentTag) {
    const oldChildren = oldNode.children;
    const nextChildren = nextNode.children;
    const hasKeys = [...oldChildren, ...nextChildren].some((child) => getNodeKey(child) !== null);
    if (!hasKeys) {
      const length = Math.max(oldChildren.length, nextChildren.length);
      for (let index = 0; index < length; index += 1) {
        visit(oldChildren[index], nextChildren[index], [...path, index], parentTag, [...nextPath, index]);
      }
      return;
    }

    const matches = matchChildren(oldChildren, nextChildren);
    const used = new Set(matches.filter((index) => index !== null));
    const entries = nextChildren.map((node, index) => ({
      oldIndex: matches[index],
      nextNode: node,
      keyed: getNodeKey(node) !== null,
      movable: isFormattingWhitespace(node),
    }));
    const stable = findStableChildren(entries);
    const groupedChanges = [];

    function addGroupedChange(change) {
      const grouped = { ...change, managed: true, groupPath: [...path] };
      groupedChanges.push(grouped);
      changes.push(grouped);
    }

    oldChildren.forEach((node, index) => {
      if (!used.has(index)) {
        addGroupedChange({ type: 'remove', path: [...path, index], oldNode: node, nextNode: undefined, parentTag });
      }
    });
    entries.forEach((entry, index) => {
      if (entry.oldIndex === null) {
        addGroupedChange({ type: 'add', path: [...nextPath, index], oldNode: undefined, nextNode: entry.nextNode, parentTag });
        return;
      }
      const oldPath = [...path, entry.oldIndex];
      const childNextPath = [...nextPath, index];
      visit(oldChildren[entry.oldIndex], entry.nextNode, oldPath, parentTag, childNextPath);
      if (entry.keyed && !stable.has(index)) {
        addGroupedChange({ type: 'move', path: oldPath, nextPath: childNextPath, oldNode: oldChildren[entry.oldIndex], nextNode: entry.nextNode, parentTag });
      }
    });
    if (groupedChanges.length) {
      groupedChanges[0].orderPlan = { path, nextPath, oldNode, nextNode, entries, stable: [...stable] };
    }
  }

  visit(oldRoot, nextRoot, []);
  return changes;
}
