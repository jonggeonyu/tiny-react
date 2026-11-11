// 메인 페이지 디자인용 어댑터. 초기 로드는 기존 src/main.js가 import 시점에 수행하며,
// 이 파일은 그 결과(이력)를 읽어 상태 문구와 Virtual DOM 보기만 그린다.
import { history as stateHistory } from './src/main.js';
import { setupPreviewRefresh } from './src/preview-refresh.js';
import { setupPatch } from './src/patch-controller.js';
import { setupEditorKeys } from './src/editor-keys.js';

const statusMessage = document.getElementById('lab-status');
const treeContainer = document.getElementById('vdom-tree');
setupEditorKeys(document.getElementById('editor'));

function describeTextNode(node) {
  const isWhitespaceOnly = /^[ \t\n\r\f]*$/.test(node.text);
  return isWhitespaceOnly ? `공백 텍스트 ${JSON.stringify(node.text)}` : `텍스트 ${JSON.stringify(node.text)}`;
}

function describeElementNode(node) {
  const attributes = Object.entries(node.attributes).map(([name, value]) => `${name}="${value}"`);
  return `<${[node.tag, ...attributes].join(' ')}>`;
}

function createTreeItem(node, path) {
  const item = document.createElement('li');
  const row = document.createElement('div');
  row.className = 'tree-row';
  const pathLabel = document.createElement('span');
  pathLabel.className = 'tree-path';
  pathLabel.textContent = `[${path.join(', ')}]`;
  const nodeLabel = document.createElement('span');
  nodeLabel.className = node.type === 'text' ? 'tree-text' : 'tree-tag';
  nodeLabel.textContent = node.type === 'text' ? describeTextNode(node) : describeElementNode(node);
  row.append(pathLabel, nodeLabel);
  if (node.formState) {
    const formLabel = document.createElement('span');
    formLabel.className = 'tree-form';
    formLabel.textContent = `현재 상태 ${JSON.stringify(node.formState)}`;
    row.append(formLabel);
  }
  item.append(row);
  if (node.children.length > 0) {
    item.append(createTreeList(node.children, path));
  }
  return item;
}

function createTreeList(children, parentPath) {
  const list = document.createElement('ul');
  children.forEach((child, index) => {
    list.append(createTreeItem(child, [...parentPath, index]));
  });
  return list;
}

function showVirtualTree(tree) {
  if (tree.children.length === 0) {
    treeContainer.replaceChildren(Object.assign(document.createElement('p'), { className: 'help', textContent: '가상 루트에 자식 노드가 없습니다.' }));
    return;
  }
  const rootList = document.createElement('ul');
  rootList.className = 'tree-root';
  const rootItem = document.createElement('li');
  const rootRow = Object.assign(document.createElement('div'), { className: 'tree-row' });
  rootRow.append(Object.assign(document.createElement('span'), { className: 'tree-tag', textContent: '가상 루트' }));
  rootItem.append(rootRow, createTreeList(tree.children, []));
  rootList.append(rootItem);
  treeContainer.replaceChildren(rootList);
}

function showLoadFailure() {
  statusMessage.textContent = '초기 로드에 실패했습니다. 아래 오류 안내를 확인하세요.';
  statusMessage.dataset.state = 'error';
  treeContainer.replaceChildren(Object.assign(document.createElement('p'), { className: 'help', textContent: '초기 콘텐츠를 Virtual DOM으로 만들지 못해 보여 줄 트리가 없습니다.' }));
}

function showLoadSuccess(entry) {
  statusMessage.textContent = '초기 로드 완료: 실제 영역을 Virtual DOM으로 변환해 미리보기를 구성했습니다.';
  statusMessage.dataset.state = 'ready';
  showVirtualTree(entry.tree);
}

if (stateHistory.length === 0) {
  showLoadFailure();
} else {
  showLoadSuccess(stateHistory[0]);
  const previewController = setupPreviewRefresh();
  setupPatch(stateHistory, previewController, showVirtualTree);
}
