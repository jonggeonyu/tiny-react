const countElements = (node) => node.type === 'element' ? 1 + node.children.reduce((sum, child) => sum + countElements(child), 0) : 0;

function describeAttributeValue(value) {
  return value === undefined ? '없음' : JSON.stringify(value);
}

function summarizeRadioChanges(oldTree, nextTree, add, details) {
  function radioGroups(root) {
    const groups = new Map();
    function visit(node) {
      if (node.tag === 'input' && node.attributes.type?.toLowerCase() === 'radio' && node.attributes.name) {
        const name = node.attributes.name;
        if (!groups.has(name)) {
          groups.set(name, []);
        }
        groups.get(name).push(node);
      }
      node.children.forEach(visit);
    }
    visit(root);
    return groups;
  }
  const previousGroups = radioGroups(oldTree);
  const nextGroups = radioGroups(nextTree);
  for (const [name, previous] of previousGroups) {
    const next = nextGroups.get(name);
    if (!next) {
      continue;
    }
    const selected = (nodes) => {
      const index = nodes.findIndex((node) => node.formState.checked);
      return index < 0 ? '선택 없음' : `${nodes[index].attributes.value ?? 'on'} (${index + 1}번째)`;
    };
    const before = selected(previous);
    const after = selected(next);
    if (before !== after) {
      add('선택 변경');
      details.push(`선택 변경 1건: ${before} → ${after}`);
    }
  }
}

function summarizeSelectChanges(oldNode, nextNode, add, details) {
  if (!oldNode || !nextNode || oldNode.tag !== nextNode.tag) {
    return;
  }
  if (nextNode.tag === 'select') {
    const oldOptions = oldNode.children.filter((child) => child.tag === 'option');
    const nextOptions = nextNode.children.filter((child) => child.tag === 'option');
    const selectedIndexes = (options) => options.flatMap((option, index) => option.formState?.selected ? [index] : []);
    const before = selectedIndexes(oldOptions);
    const after = selectedIndexes(nextOptions);
    const label = (options, index) => {
      const text = options[index].children.map((child) => child.text || '').join('');
      const duplicate = options.filter((option) => option.children.map((child) => child.text || '').join('') === text).length > 1;
      return duplicate ? `${text} (${index + 1}번째)` : text;
    };
    const selectedText = (options, indexes) => indexes.map((index) => label(options, index)).join(', ') || '선택 없음';
    const fingerprint = (option) => JSON.stringify({
      value: option.attributes.value,
      text: option.children.map((child) => child.text || '').join(''),
    });
    const structureChanged = oldOptions.length !== nextOptions.length;
    const optionKeys = (options) => {
      const occurrences = new Map();
      return options.map((option) => {
        const key = fingerprint(option);
        const occurrence = (occurrences.get(key) || 0) + 1;
        occurrences.set(key, occurrence);
        return JSON.stringify([key, occurrence]);
      });
    };
    const oldKeys = structureChanged ? optionKeys(oldOptions) : [];
    const nextKeys = structureChanged ? optionKeys(nextOptions) : [];
    const beforeKeys = before.map((index) => structureChanged ? oldKeys[index] : index);
    const afterKeys = after.map((index) => structureChanged ? nextKeys[index] : index);
    const selectionChanged = JSON.stringify(beforeKeys) !== JSON.stringify(afterKeys);
    if (selectionChanged && 'multiple' in nextNode.attributes) {
      const removed = before.filter((index, position) => !afterKeys.includes(beforeKeys[position])).map((index) => `${label(oldOptions, index)} 선택 해제`);
      const added = after.filter((index, position) => !beforeKeys.includes(afterKeys[position])).map((index) => `${label(nextOptions, index)} 선택`);
      add('선택 목록 변경');
      details.push(`선택 목록 변경 1건: ${[...removed, ...added].join(', ')}`);
    } else if (selectionChanged) {
      add('선택 변경');
      details.push(`선택 변경 1건: ${selectedText(oldOptions, before)} → ${selectedText(nextOptions, after)}`);
    }
  }
  nextNode.children.forEach((child, index) => summarizeSelectChanges(oldNode.children[index], child, add, details));
}

export function describeChanges(changes, oldTree, nextTree) {
  const counts = new Map();
  const details = [];
  const formDetails = [];
  const add = (label, amount = 1) => counts.set(label, (counts.get(label) || 0) + amount);
  summarizeRadioChanges(oldTree, nextTree, add, details);
  formDetails.push(...details);
  for (const change of changes) {
    if (change.type === 'form') {
      if (change.nextNode.tag === 'option') {
        continue;
      }
      if (change.nextNode.tag === 'input' && change.nextNode.attributes.type?.toLowerCase() === 'radio' && change.nextNode.attributes.name) {
        continue;
      }
      add(change.nextNode.tag === 'input' && 'checked' in change.nextNode.formState ? '체크 상태 변경' : '입력창의 현재 값 변경');
      for (const field of Object.keys(change.nextNode.formState)) {
        if (change.oldNode.formState[field] !== change.nextNode.formState[field]) {
          const label = field === 'checked' ? '체크 상태' : field === 'value' ? '현재 값' : field;
          const line = `${change.nextNode.tag} ${label}: ${JSON.stringify(change.oldNode.formState[field])} → ${JSON.stringify(change.nextNode.formState[field])}`;
          details.push(line);
          formDetails.push(line);
        }
      }
    } else if (change.type === 'text') {
      add('텍스트 노드 변경');
      details.push(`${change.parentTag} ${change.oldNode.text} → ${change.nextNode.text}`);
    } else if (change.type === 'attribute') {
      add(change.name === 'style' ? 'style 속성 변경' : change.previous === undefined ? '속성 추가' : change.next === undefined ? '속성 삭제' : '속성 변경');
      details.push(`${change.parentTag} ${change.name}: ${describeAttributeValue(change.previous)} → ${describeAttributeValue(change.next)}`);
    } else if (change.type === 'replace') {
      add('요소 교체');
    } else {
      const node = change.nextNode || change.oldNode;
      const label = node.type === 'text' ? `텍스트 ${change.type === 'add' ? '추가' : '삭제'}` : `요소 ${change.type === 'add' ? '추가' : '삭제'}`;
      add(label, node.type === 'text' ? 1 : countElements(node));
    }
  }
  const previousDetailCount = details.length;
  summarizeSelectChanges(oldTree, nextTree, add, details);
  formDetails.push(...details.slice(previousDetailCount));
  const formLabels = ['체크 상태 변경', '입력창의 현재 값 변경', '선택 변경', '선택 목록 변경'];
  const format = ([label, count]) => `${label} ${count}${label.startsWith('요소 추가') || label.startsWith('요소 삭제') ? '개' : '건'}`;
  return { counts, details, formDetails, formLabels, format };
}

