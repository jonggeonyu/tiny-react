import { renderVirtualRoot } from './render.js';

function nodeAt(container, path) {
  return path.reduce((node, index) => node?.childNodes[index], container);
}

function renderNode(node, document) {
  return renderVirtualRoot({ type: 'root', children: [node] }, document).firstChild;
}

export function preparePatch(container, changes, oldTree) {
  const ordinaryChanges = changes.filter((change) => !change.managed);
  const resolved = ordinaryChanges.map((change) => ({ ...change, node: nodeAt(container, change.path), parent: nodeAt(container, change.path.slice(0, -1)) }));
  const reorders = prepareReorders(container, changes, oldTree);
  const additions = new Map();
  for (const change of resolved) {
    let currentDom = container;
    let currentTree = oldTree;
    const path = change.type === 'add' ? change.path.slice(0, -1) : change.path;
    for (const index of path) {
      currentDom = currentDom?.childNodes[index];
      currentTree = currentTree?.children[index];
      if (!currentDom || !currentTree ||
          (currentTree.type === 'text' && currentDom.nodeType !== 3) ||
          (currentTree.type === 'element' && (currentDom.nodeType !== 1 || currentDom.localName !== currentTree.tag))) {
        throw new Error('실제 DOM의 경로가 이전 상태와 다릅니다.');
      }
    }
    if (!change.parent || (change.type !== 'add' && !change.node)) {
      throw new Error('실제 DOM이 이전 상태와 다릅니다.');
    }
    if (change.type === 'add' && change.node) {
      throw new Error('추가할 위치가 비어 있지 않습니다.');
    }
    if (change.type === 'add') {
      const parentPath = change.path.slice(0, -1);
      const parentTree = parentPath.reduce((tree, index) => tree?.children[index], oldTree);
      const key = parentPath.join('/');
      if (!parentTree || change.parent.childNodes.length !== parentTree.children.length) {
        throw new Error('추가할 부모의 자식 목록이 이전 상태와 다릅니다.');
      }
      if (!additions.has(key)) {
        additions.set(key, { start: parentTree.children.length, indexes: [] });
      }
      additions.get(key).indexes.push(change.path.at(-1));
    }
    if (change.type !== 'add') {
      const expected = change.oldNode;
      if (expected && ((expected.type === 'text' && change.node.nodeType !== 3) ||
          (expected.type === 'element' && (change.node.nodeType !== 1 || change.node.localName !== expected.tag)))) {
        throw new Error('실제 DOM의 노드 종류가 이전 상태와 다릅니다.');
      }
    }
  }
  for (const { start, indexes } of additions.values()) {
    indexes.sort((first, second) => first - second);
    if (indexes.some((index, offset) => index !== start + offset)) {
      throw new Error('추가할 위치가 이전 부모의 끝과 이어지지 않습니다.');
    }
  }
  const actions = resolved.filter((change) => change.type !== 'form');
  const predecessors = actions.map(() => new Set());
  const sameParent = (a, b) => a.path.slice(0, -1).join('/') === b.path.slice(0, -1).join('/');
  actions.forEach((change, index) => {
    actions.forEach((other, otherIndex) => {
      if (index === otherIndex) {
        return;
      }
      if ((change.type === 'remove' || change.type === 'replace') &&
          other.path.length > change.path.length &&
          change.path.every((part, partIndex) => other.path[partIndex] === part)) {
        throw new Error('부모와 자식의 작업이 충돌합니다.');
      }
      if (!sameParent(change, other)) {
        return;
      }
      const position = change.path.at(-1);
      const otherPosition = other.path.at(-1);
      if (change.type === 'remove' && other.type !== 'remove') {
        predecessors[index].add(otherIndex);
      } else if (change.type === 'remove' && other.type === 'remove' && otherPosition > position) {
        predecessors[index].add(otherIndex);
      } else if (change.type === 'add' && other.type === 'add' && otherPosition < position) {
        predecessors[index].add(otherIndex);
      }
    });
  });
  const queue = actions.map((_, index) => index).filter((index) => predecessors[index].size === 0);
  const ordered = [];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    ordered.push(actions[index]);
    predecessors.forEach((before, waiting) => {
      if (before.delete(index) && before.size === 0) {
        queue.push(waiting);
      }
    });
  }
  if (ordered.length !== actions.length) {
    throw new Error('DOM 작업 순서를 결정하지 못했습니다.');
  }
  return [...ordered, ...reorders];
}

function prepareReorders(container, changes, oldTree) {
  const destructive = changes.filter((change) => ['remove', 'replace'].includes(change.type));
  const plans = changes.filter((change) => change.orderPlan).map((change) => change.orderPlan);
  const planPaths = new Set(plans.map((plan) => JSON.stringify(plan.path)));
  if (planPaths.size !== plans.length) {
    throw new Error('같은 부모에 대한 순서 정보가 중복되었습니다.');
  }
  for (const change of changes) {
    if (change.managed && (!Array.isArray(change.groupPath) || !planPaths.has(JSON.stringify(change.groupPath)))) {
      throw new Error('자식 변경에 필요한 순서 정보가 없습니다.');
    }
  }
  return plans.map((change) => {
    let parent = container;
    let previous = oldTree;
    for (const index of change.path) {
      parent = parent?.childNodes[index];
      previous = previous?.children[index];
      if (!parent || !previous ||
          (previous.type === 'text' && parent.nodeType !== 3) ||
          (previous.type === 'element' && (parent.nodeType !== 1 || parent.localName !== previous.tag))) {
        throw new Error('이동할 부모의 경로가 이전 상태와 다릅니다.');
      }
    }
    if (!parent || !previous || !Array.isArray(change.entries) ||
        parent.childNodes.length !== previous.children.length) {
      throw new Error('이동할 부모의 자식 목록이 이전 상태와 다릅니다.');
    }
    for (const operation of destructive) {
      if (operation.path.length <= change.path.length &&
          operation.path.every((index, depth) => change.path[depth] === index)) {
        throw new Error('부모 변경과 자식 순서 변경이 충돌합니다.');
      }
    }
    const oldNodes = Array.from(parent.childNodes);
    previous.children.forEach((child, index) => {
      const node = oldNodes[index];
      if ((child.type === 'text' && node.nodeType !== 3) ||
          (child.type === 'element' && (node.nodeType !== 1 || node.localName !== child.tag))) {
        throw new Error('이동할 자식의 노드 종류가 이전 상태와 다릅니다.');
      }
    });
    const used = new Set();
    for (const entry of change.entries) {
      if (!entry || !entry.nextNode || (entry.oldIndex !== null &&
          (!Number.isInteger(entry.oldIndex) || entry.oldIndex < 0 || entry.oldIndex >= oldNodes.length || used.has(entry.oldIndex)))) {
        throw new Error('자식 순서 변경 정보가 올바르지 않습니다.');
      }
      if (entry.oldIndex !== null) {
        used.add(entry.oldIndex);
      }
    }
    if (!Array.isArray(change.stable) || change.stable.some((index) =>
      !Number.isInteger(index) || index < 0 || index >= change.entries.length)) {
      throw new Error('유지할 자식의 순서 정보가 올바르지 않습니다.');
    }
    return { ...change, type: 'reorder', parent, oldNodes, used, stable: new Set(change.stable) };
  }).sort((first, second) => second.path.length - first.path.length);
}

export function applyPatch(container, resolved, targetTree) {
  const replacements = new Map();
  for (const change of resolved) {
    const { type, node, parent, nextNode, name, next } = change;
    if (type === 'add') {
      parent.appendChild(renderNode(nextNode, container.ownerDocument));
    } else if (type === 'replace') {
      const replacement = renderNode(nextNode, container.ownerDocument);
      parent.replaceChild(replacement, node);
      replacements.set(node, replacement);
    } else if (type === 'text') {
      node.data = nextNode.text;
    } else if (type === 'attribute') {
      if (next === undefined) {
        node.removeAttribute(name);
      } else {
        node.setAttribute(name, next);
      }
    } else if (type === 'remove') {
      parent.removeChild(node);
    } else if (type === 'reorder') {
      reorderChildren(change, replacements, container.ownerDocument);
    }
  }
  function synchronize(node, tree) {
    if (tree.type === 'element' && tree.formState) {
      for (const [property, value] of Object.entries(tree.formState)) {
        if (node[property] !== value) {
          node[property] = value;
        }
      }
    }
    tree.children.forEach((child, index) => synchronize(node.childNodes[index], child));
    if (tree.tag === 'select' && !node.multiple) {
      const options = [];
      function collectOptions(current) {
        if (current.tag === 'option') {
          options.push(current);
        }
        current.children.forEach(collectOptions);
      }
      tree.children.forEach(collectOptions);
      const selectedIndex = options.findIndex((option) => option.formState?.selected);
      if (node.selectedIndex !== selectedIndex) {
        node.selectedIndex = selectedIndex;
      }
    }
  }
  synchronize(container, targetTree);
  function verify(node, tree) {
    if (tree.formState && Object.entries(tree.formState).some(([property, value]) => node[property] !== value)) {
      throw new Error('최종 폼 상태를 맞추지 못했습니다.');
    }
    tree.children.forEach((child, index) => verify(node.childNodes[index], child));
  }
  verify(container, targetTree);
}

function reorderChildren(change, replacements, document) {
  const currentNode = (node) => replacements.get(node) || node;
  change.oldNodes.forEach((node, index) => {
    if (!change.used.has(index)) {
      change.parent.removeChild(currentNode(node));
    }
  });
  let anchor = null;
  for (let index = change.entries.length - 1; index >= 0; index -= 1) {
    const entry = change.entries[index];
    const node = entry.oldIndex === null
      ? renderNode(entry.nextNode, document)
      : currentNode(change.oldNodes[entry.oldIndex]);
    if (entry.oldIndex === null || !change.stable.has(index)) {
      change.parent.insertBefore(node, anchor);
    }
    anchor = node;
  }
}
