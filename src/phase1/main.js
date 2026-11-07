import { renderRoot } from '../core/createDom.js';
import { diff } from '../core/diff.js';
import { containerToVdom } from '../core/domToVdom.js';
import { htmlToVdom } from '../core/html.js';
import { patch } from '../core/patch.js';
import { describeChanges } from './describeChanges.js';
import { formatHtml } from './formatHtml.js';
import { StateHistory } from './StateHistory.js';

const actual = document.querySelector('#actual');
const source = document.querySelector('#source');
const preview = document.querySelector('#preview');
const errorMessage = document.querySelector('#error');
const historyStatus = document.querySelector('#history-status');
const patchLog = document.querySelector('#patch-log');

const history = new StateHistory();

/** History와 번호를 맞춘 Patch 설명 목록이다. 첫 항목은 초기 상태이다. */
const logEntries = [];

/**
 * `#history-status`와 `#patch-log`를 History의 현재 상태로 갱신한다.
 *
 * @private
 * @returns {void}
 */
function renderHistoryInfo() {
  historyStatus.textContent = `${history.position()} / ${history.size()}`;
  patchLog.replaceChildren(
    ...logEntries.map((text, index) => {
      const item = document.createElement('li');

      item.textContent = text;
      item.title = text;

      if (index === history.position() - 1) {
        item.setAttribute('aria-current', 'true');
      }

      return item;
    }),
  );
}

/**
 * 테스트 영역을 렌더링한다. `textarea`에 정렬한 HTML을 넣고 미리보기를 같은 내용으로 그린다.
 *
 * @private
 * @param {VElement} root 렌더링할 루트 Virtual DOM
 * @returns {void}
 */
function renderTestArea(root) {
  source.value = formatHtml(root);
  renderRoot(preview, root);
}

/**
 * 새 Virtual DOM을 실제 영역에 반영하고 History에 저장한다. 변경이 없으면 저장하지 않는다.
 * 실패하면 실제 영역과 미리보기를 현재 Virtual DOM으로 되돌린다. `textarea`는 사용자가 고칠 수 있게 그대로 둔다.
 *
 * @private
 * @param {VElement} next 새 루트 Virtual DOM
 * @returns {void}
 * @throws {Error} 비교나 적용의 오류를 호출하는 쪽에 그대로 던진다.
 */
function commit(next) {
  const current = history.current();

  try {
    const changes = diff(current, next);

    if (changes.length === 0) {
      return;
    }

    patch(actual, changes);
    history.push(next);
    logEntries.length = history.position() - 1;
    logEntries.push(describeChanges(changes));
  } catch (error) {
    // patch는 적용한 변경을 되돌리지 않으므로, 다시 그려야 실제 영역과 History가 어긋나지 않는다.
    renderRoot(actual, current);
    renderRoot(preview, current);
    throw error;
  }
}

/**
 * Patch 버튼의 동작이다. 어느 단계에서 오류가 나도 History에 저장하지 않고 오류를 보여 준다.
 *
 * @private
 * @returns {void}
 */
function handlePatch() {
  try {
    const next = htmlToVdom(source.value);

    // 실제 영역보다 미리보기를 먼저 그려서, 그릴 수 없는 입력이 실제 영역에 닿기 전에 멈추게 한다.
    renderRoot(preview, next);
    commit(next);
    errorMessage.textContent = '';
  } catch (error) {
    errorMessage.textContent = error.message;
  }

  renderHistoryInfo();
}

/**
 * 실제 영역을 이동할 상태로 바꾼다.
 * 포인터는 이미 옮겨졌으므로, `patch`가 실패하면 `target`으로 다시 그려서 이동을 마친다.
 *
 * @private
 * @param {VElement} before 이동 전 루트 Virtual DOM
 * @param {VElement} target 이동할 루트 Virtual DOM
 * @returns {void}
 */
function moveActual(before, target) {
  try {
    patch(actual, diff(before, target));
  } catch {
    renderRoot(actual, target);
  }
}

/**
 * 뒤로가기와 앞으로가기의 공통 동작이다. 이동할 항목이 없으면 화면과 오류 표시를 그대로 둔다.
 *
 * @private
 * @param {function(): (VElement | null)} move 포인터를 옮기고 목표 Virtual DOM을 돌려주는 함수
 * @returns {void}
 */
function handleMove(move) {
  const before = history.current();
  const target = move();

  if (target === null) {
    return;
  }

  try {
    moveActual(before, target);
    renderTestArea(target);
    errorMessage.textContent = '';
  } catch (error) {
    errorMessage.textContent = error.message;
  }

  renderHistoryInfo();
}

/**
 * 페이지를 처음 그린다.
 * 샘플 HTML의 들여쓰기 공백과 주석을 지워야 `childNodes`와 Virtual DOM의 번호가 맞으므로 실제 영역을 다시 그린다.
 *
 * @private
 * @returns {void}
 */
function initialize() {
  const root = containerToVdom(actual);

  renderRoot(actual, root);
  renderTestArea(root);
  history.push(root);
  logEntries.push('초기 상태');
  renderHistoryInfo();
}

initialize();

document.querySelector('#patch').addEventListener('click', handlePatch);
document.querySelector('#back').addEventListener('click', () => handleMove(() => history.back()));
document.querySelector('#forward').addEventListener('click', () => handleMove(() => history.forward()));
