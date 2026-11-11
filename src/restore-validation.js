import { createVirtualRoot } from './vdom.js';
import { inspectHtml } from './html-validation.js';

// 저장소는 신뢰할 수 없으므로 DOM을 만들기 전에 허용 목록과 폼 값의 타입을 검사한다.
export function validateStoredTree(tree) {
  let count = 0;
  function nodeToDom(node, depth) {
    if (!node || typeof node !== 'object' || depth > 100 || ++count > 10000 || !Array.isArray(node.children)) {
      throw new Error('손상된 화면 트리');
    }
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || node.children.length || node.formState !== null) throw new Error('손상된 텍스트');
      return { nodeType: 3, data: node.text };
    }
    if (node.type !== 'element' || typeof node.tag !== 'string' || !node.attributes || Array.isArray(node.attributes) || typeof node.attributes !== 'object') {
      throw new Error('손상된 요소');
    }
    const attributes = Object.entries(node.attributes).map(([name, value]) => {
      if (typeof value !== 'string') throw new Error('손상된 속성');
      return { name, value };
    });
    const type = attributes.find((attr) => attr.name === 'type')?.value.toLowerCase() || 'text';
    const stateKey = node.tag === 'option' ? 'selected' : node.tag === 'input' && ['checkbox', 'radio'].includes(type) ? 'checked' : ['input', 'textarea'].includes(node.tag) ? 'value' : null;
    if (stateKey) {
      if (!node.formState || Object.keys(node.formState).length !== 1 || typeof node.formState[stateKey] !== (stateKey === 'value' ? 'string' : 'boolean')) throw new Error('손상된 입력값');
    } else if (node.formState !== null) {
      throw new Error('손상된 입력 상태');
    }
    return { nodeType: 1, localName: node.tag, attributes, childNodes: node.children.map((child) => nodeToDom(child, depth + 1)), type, ...node.formState };
  }
  if (!tree || tree.type !== 'root' || !Array.isArray(tree.children) || tree.formState !== null) throw new Error('손상된 루트');
  return createVirtualRoot({ childNodes: tree.children.map((child) => nodeToDom(child, 0)) });
}

export function validateStoredHistory(state) {
  if (!Array.isArray(state.history) || !state.history.length || state.history.length > 10 || typeof state.base !== 'string') throw new Error('손상된 이력');
  inspectHtml(state.base);
  return state.history.map((entry) => {
    if (!entry || typeof entry.html !== 'string' || typeof entry.resultHtml !== 'string') throw new Error('손상된 HTML');
    inspectHtml(entry.html);
    inspectHtml(entry.resultHtml);
    return { ...entry, tree: validateStoredTree(entry.tree) };
  });
}
