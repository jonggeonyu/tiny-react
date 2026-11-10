import { createVirtualRoot } from './vdom.js';
import { renderVirtualRoot } from './render.js';

const errorMessage = document.querySelector('[data-testid="error-message"]');

export let history = Object.freeze([]);

function serializeInitialHtml(actual) {
  const copy = actual.cloneNode(true);
  let marker = 'TEXTAREA_INITIAL_NEWLINE';
  while (copy.innerHTML.includes(marker)) {
    marker += '_';
  }
  for (const textarea of copy.querySelectorAll('textarea')) {
    const first = textarea.firstChild;
    if (first?.nodeType === 3 && first.data.startsWith('\n')) {
      first.data = marker + first.data.slice(1);
    }
  }
  // HTML 파서는 textarea 시작 직후 첫 줄바꿈을 제거한다.
  return copy.innerHTML.replaceAll(marker, '\n&#10;');
}

try {
  const actual = document.querySelector('[data-testid="actual-host"]')?.shadowRoot?.querySelector('[data-testid="content"]');
  const previewRoot = document.querySelector('[data-testid="preview-host"]')?.shadowRoot;
  const editor = document.querySelector('[data-testid="html-editor"]');
  const historyPosition = document.querySelector('[data-testid="history-position"]');
  const comparison = document.querySelector('[data-testid="comparison-result"]');
  if (!actual || !previewRoot || !editor || !historyPosition || !comparison || !errorMessage) {
    throw new Error('초기 화면에 필요한 영역을 찾을 수 없습니다.');
  }
  const tree = createVirtualRoot(actual);
  const preview = renderVirtualRoot(tree, document);
  const content = document.createElement('div');
  content.dataset.testid = 'content';
  content.appendChild(preview);
  const html = serializeInitialHtml(actual);
  const initialHistory = Object.freeze([Object.freeze({ tree, html })]);
  previewRoot.appendChild(content);
  editor.value = html;
  historyPosition.textContent = `1 / ${initialHistory.length}`;
  comparison.textContent = '초기 상태라 비교 결과가 없습니다';
  history = initialHistory;
} catch (error) {
  if (errorMessage) {
    errorMessage.textContent = `초기 콘텐츠를 불러올 수 없습니다: ${error.message}`;
    errorMessage.hidden = false;
  }
}

