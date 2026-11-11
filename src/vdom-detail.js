function describeLocation(root, path) {
  let current = root;
  const parts = [];
  for (const index of path) {
    const child = current.children[index];
    if (!child) {
      break;
    }
    if (child.type === 'element') {
      const siblings = current.children.filter((node) => node.type === 'element' && node.tag === child.tag);
      const prefix = siblings.length > 1 ? `${siblings.indexOf(child) + 1}번째 ` : '';
      parts.push(`${prefix}${child.tag}`);
    }
    current = child;
  }
  return parts.length ? `${parts.join(' 안의 ')} 요소` : '가상 루트';
}

const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function describeNode(node) {
  if (!node) {
    return null;
  }
  if (node.type === 'text') {
    return escapeHtml(node.text);
  }
  const attributes = Object.entries(node.attributes).map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join('');
  const opening = `<${node.tag}${attributes}>`;
  if (voidElements.has(node.tag.toLowerCase())) {
    return opening;
  }
  return `${opening}${node.children.map(describeNode).join('')}</${node.tag}>`;
}

function parseStyle(value) {
  const declarations = new Map();
  for (const text of (value || '').split(';')) {
    if (!text.trim()) {
      continue;
    }
    const match = /^\s*([a-z-]+)\s*:\s*([^:]+?)\s*$/i.exec(text);
    if (!match) {
      return null;
    }
    const property = match[1].toLowerCase();
    if (declarations.has(property)) {
      return null;
    }
    declarations.set(property, match[2].trim());
  }
  return declarations;
}

function styleDetails(before, after) {
  const oldDeclarations = parseStyle(before);
  const newDeclarations = parseStyle(after);
  if (!oldDeclarations || !newDeclarations) {
    return { styleDetail: 'whole', declarations: [] };
  }
  const declarations = [];
  for (const property of new Set([...oldDeclarations.keys(), ...newDeclarations.keys()])) {
    const oldValue = oldDeclarations.get(property) ?? null;
    const newValue = newDeclarations.get(property) ?? null;
    if (oldValue?.toLowerCase() === newValue?.toLowerCase()) {
      continue;
    }
    declarations.push({ property, change: oldValue === null ? 'add' : newValue === null ? 'remove' : 'change', before: oldValue, after: newValue });
  }
  return { styleDetail: 'declarations', declarations };
}

export function createVdomDetails(changes, oldTree, nextTree) {
  return changes.filter((change) => change.type !== 'form').map((change) => {
    const isAdd = change.type === 'add';
    const isRemove = change.type === 'remove';
    const node = change.nextNode || change.oldNode;
    const tree = isAdd ? 'new' : 'old';
    const root = isAdd ? nextTree : oldTree;
    let type = change.type;
    let before = null;
    let after = null;
    if (type === 'attribute') {
      type = change.name === 'style' ? 'style' : change.previous === undefined ? 'attribute-add' : change.next === undefined ? 'attribute-remove' : 'attribute-change';
      before = change.previous ?? null;
      after = change.next ?? null;
    } else if (type === 'text') {
      before = change.oldNode.text;
      after = change.nextNode.text;
    } else if (type === 'replace') {
      before = describeNode(change.oldNode);
      after = describeNode(change.nextNode);
    } else {
      type = `${node.type === 'text' ? 'text' : 'element'}-${isAdd ? 'add' : 'remove'}`;
      before = isRemove ? describeNode(change.oldNode) : null;
      after = isAdd ? describeNode(change.nextNode) : null;
    }
    return {
      type,
      attributeName: change.type === 'attribute' && change.name !== 'style' ? change.name : null,
      path: [...change.path],
      tree,
      location: describeLocation(root, change.path),
      before,
      after,
      ...(type === 'style' ? styleDetails(before, after) : {}),
    };
  });
}

function appendValue(container, label, value, attribute) {
  const wrapper = document.createElement('div');
  wrapper.className = 'vdom-value';
  wrapper.append(document.createTextNode(`${label}: `));
  const text = document.createElement('span');
  text.setAttribute(attribute, '');
  text.style.whiteSpace = 'pre-wrap';
  if (value === null) {
    text.dataset.absent = '';
    text.textContent = '없음';
  } else if (value === '') {
    text.textContent = '(빈 문자열)';
    text.dataset.empty = '';
  } else {
    text.textContent = value;
    if (value === '없음') {
      wrapper.append(document.createTextNode('문자열 '));
    }
  }
  wrapper.append(text);
  container.append(wrapper);
}

function isValue(value) {
  return value === null || typeof value === 'string';
}

function isDeclaration(declaration) {
  return declaration !== null && typeof declaration === 'object' &&
    typeof declaration.property === 'string' &&
    ['add', 'remove', 'change'].includes(declaration.change) &&
    isValue(declaration.before) && isValue(declaration.after);
}

function isDetail(detail) {
  const types = ['text-add', 'text-remove', 'element-add', 'element-remove', 'text', 'replace',
    'attribute-add', 'attribute-remove', 'attribute-change', 'style'];
  if (!detail || typeof detail !== 'object' || !types.includes(detail.type) ||
      !Array.isArray(detail.path) || !detail.path.every((index) => Number.isInteger(index) && index >= 0) ||
      !['old', 'new'].includes(detail.tree) || typeof detail.location !== 'string' ||
      !isValue(detail.before) || !isValue(detail.after) ||
      !(detail.attributeName === null || typeof detail.attributeName === 'string')) {
    return false;
  }
  if (detail.type.startsWith('attribute-') && typeof detail.attributeName !== 'string') {
    return false;
  }
  if (detail.type === 'style') {
    return ['whole', 'declarations'].includes(detail.styleDetail) &&
      Array.isArray(detail.declarations) && detail.declarations.every(isDeclaration);
  }
  return true;
}

export function validVdomDetails(details) {
  return Array.isArray(details) && details.every(isDetail);
}

export function renderVdomDetails(region, text, details, summary) {
  region.replaceChildren();
  const heading = document.createElement('p');
  heading.className = 'vdom-summary';
  heading.textContent = summary?.counts || text;
  region.append(heading);
  if (Array.isArray(summary?.details) && summary.details.length) {
    const summaryDetails = document.createElement('ul');
    summaryDetails.className = 'vdom-summary-details';
    summaryDetails.setAttribute('aria-label', '변경 요약 상세');
    for (const line of summary.details) {
      const item = document.createElement('li');
      item.textContent = line;
      summaryDetails.append(item);
    }
    region.append(summaryDetails);
  }
  if (!Array.isArray(details) || !details.length) {
    return;
  }
  const list = document.createElement('ul');
  list.className = 'vdom-changes';
  list.setAttribute('aria-label', 'Virtual DOM 변경 상세');
  const labels = {
    text: '텍스트 노드 변경', 'text-add': '텍스트 추가', 'text-remove': '텍스트 삭제',
    'element-add': '요소 추가', 'element-remove': '요소 삭제', replace: '요소 교체',
    'attribute-add': '속성 추가', 'attribute-remove': '속성 삭제',
    'attribute-change': '속성 변경', style: 'style 속성 변경',
  };
  for (const detail of details) {
    const item = document.createElement('li');
    item.dataset.vdomChange = '';
    item.dataset.changeType = detail.type;
    if (typeof detail.attributeName === 'string') {
      item.dataset.attributeName = detail.attributeName;
    }
    if (['whole', 'declarations'].includes(detail.styleDetail)) {
      item.dataset.styleDetail = detail.styleDetail;
    }
    const title = document.createElement('strong');
    title.className = 'vdom-change-title';
    title.textContent = labels[detail.type];
    if (detail.attributeName) {
      const attribute = document.createElement('code');
      attribute.textContent = detail.attributeName;
      title.append(document.createTextNode(' · '), attribute);
    }
    const location = document.createElement('span');
    location.dataset.changeLocation = '';
    location.textContent = detail.location;
    const path = document.createElement('span');
    path.dataset.changePath = '';
    path.dataset.tree = detail.tree;
    path.dataset.path = detail.path.join('/');
    path.textContent = ` ${detail.tree === 'old' ? '이전' : '새'} 트리 childNodes 경로 [${detail.path.join(', ')}] `;
    item.append(title, location);
    appendValue(item, '이전', detail.before, 'data-change-before');
    appendValue(item, '새', detail.after, 'data-change-after');
    item.append(path);
    if (detail.styleDetail === 'declarations' && Array.isArray(detail.declarations)) {
      const declarations = document.createElement('ul');
      for (const declaration of detail.declarations) {
        const row = document.createElement('li');
        row.dataset.styleDeclaration = '';
        row.dataset.property = declaration.property;
        row.dataset.declarationChange = declaration.change;
        row.append(document.createTextNode(declaration.property));
        appendValue(row, ' 이전', declaration.before, 'data-declaration-before');
        appendValue(row, ' 새', declaration.after, 'data-declaration-after');
        declarations.append(row);
      }
      if (detail.declarations.length === 0) {
        declarations.textContent = '표시할 style 선언 변경이 없습니다.';
      }
      item.append(declarations);
    }
    list.append(item);
  }
  region.append(list);
}
