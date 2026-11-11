import { createVirtualRoot } from './vdom.js';
import { renderVirtualRoot } from './render.js';
import { diff } from './diff.js';
import { applyPatch, preparePatch } from './patch.js';
import { serializeWithFormState, renderHtmlDiff } from './comparison.js';
import { createHistory, saveTemporaryState, clearTemporaryState, readTemporaryState } from './history.js';
import { describeChanges } from './change-summary.js';
import { createVdomDetails, renderVdomDetails, validVdomDetails } from './vdom-detail.js';
import { inspectHtml, renderDiagnostics, errorDiagnostic } from './html-validation.js';
import { prepareCarryOver } from './preview-refresh.js';
import { validateStoredHistory, validateStoredTree } from './restore-validation.js';
import { updateWhitespaceDisplay } from './whitespace-display.js';

const get = (name) => document.querySelector(`[data-testid="${name}"]`);
const sourceSideNames = { old: '이전 편집 기준 HTML', new: '새로 작성한 HTML' };

// Patch 계산은 동기 코드라 그대로 이어 실행하면 진행 표시가 화면에 그려지지 않는다.
// 다음 프레임이 그려진 뒤에 계산을 시작하고, 프레임이 오지 않는 숨은 탭에서는 타이머로 이어 간다.
function afterNextPaint(callback) {
  let started = false;
  const run = () => {
    if (!started) {
      started = true;
      callback();
    }
  };
  requestAnimationFrame(() => setTimeout(run, 0));
  setTimeout(run, document.hidden ? 0 : 1000);
}

export function setupPatch(initialHistory, previewController, showTree) {
  const actual = get('actual-host').shadowRoot.querySelector('[data-testid="content"]');
  const previewHost = get('preview-host');
  const preview = previewHost.shadowRoot.querySelector('[data-testid="content"]');
  const editor = get('html-editor');
  const button = get('patch-button');
  const dialog = get('patch-confirm-dialog');
  const status = get('patch-status');
  const progress = get('patch-progress');
  const source = get('source-html-diff');
  const result = get('result-html-diff');
  const vdom = get('vdom-diff');
  const whitespaceToggle = get('whitespace-toggle');
  const whitespaceLegend = get('whitespace-legend');
  whitespaceToggle.checked = false;
  whitespaceToggle.addEventListener('change', () => {
    whitespaceLegend.hidden = !whitespaceToggle.checked;
    updateWhitespaceDisplay(result, vdom, whitespaceToggle.checked);
  });
  const sourceStale = get('source-diff-stale-notice');
  const storageWarning = get('storage-warning');
  const history = createHistory({ ...initialHistory[0], resultHtml: serializeWithFormState(actual) });
  let editorBase = editor.value;
  let sourceHtml = editor.value;
  let savedSource = null;
  let pending = null;
  let previewSnapshot = null;
  let locked = false;
  let patchBusy = false;
  let refreshPending = false;
  let moveTarget = null;
  let positionWasUnknown = false;
  let restoreChoicePending = false;
  const back = get('back-button');
  const forward = get('forward-button');
  const moveDialog = get('history-move-dialog');
  const moveStatus = get('history-status');
  const previewRecoveryWarning = get('preview-recovery-warning');

  function updatePreviewRecoveryWarning() {
    previewRecoveryWarning.hidden = !previewController.hasRecoverySnapshot();
  }

  function updateHistoryControls() {
    back.disabled = locked || patchBusy || refreshPending || history.currentIndex === 0;
    forward.disabled = locked || patchBusy || refreshPending || history.currentIndex === history.length - 1;
    get('history-position').textContent = `${history.currentIndex + 1} / ${history.length}`;
  }

  function hasUnappliedChanges() {
    if (previewController.hasRecoverySnapshot() || editor.value !== editorBase) {
      return true;
    }
    const changes = diff(history.current.tree, createVirtualRoot(preview));
    if (!changes.length) {
      return false;
    }
    // 성공 후 편집기의 재직렬화 HTML은 이력 트리의 원래 폼 속성과 다를 수 있다.
    // 현재 값까지 반영한 두 HTML과 폼 상태가 같으면 그 차이는 자동 직렬화에서 생긴 것이다.
    const baseline = document.createElement('div');
    baseline.appendChild(renderVirtualRoot(history.current.tree, document));
    return changes.some((change) => change.type === 'form') ||
      serializeWithFormState(baseline) !== serializeWithFormState(preview);
  }

  function showMoveOutcome(value, message) {
    status.hidden = true;
    updatePreviewRecoveryWarning();
    moveStatus.dataset.outcome = value;
    moveStatus.textContent = message;
    moveStatus.hidden = false;
    updateHistoryControls();
  }

  function showEntryComparison(entry) {
    savedSource = entry.source && typeof entry.source.before === 'string' && typeof entry.source.after === 'string' ? entry.source : null;
    result.removeAttribute('data-comparison-error');
    vdom.removeAttribute('data-comparison-error');
    if (!entry.source) {
      result.replaceChildren();
      vdom.replaceChildren();
      get('comparison-result').textContent = '초기 상태라 비교 결과가 없습니다';
    } else {
      if (typeof entry.previousResultHtml === 'string') {
        renderHtmlDiff(result, entry.previousResultHtml, entry.resultHtml);
      } else {
        result.dataset.comparisonError = 'true';
        result.textContent = '결과 HTML 비교를 불러올 수 없습니다.';
      }
      if (typeof entry.vdomText === 'string' &&
          (!Object.hasOwn(entry, 'vdomDetails') || validVdomDetails(entry.vdomDetails))) {
        renderVdomDetails(vdom, entry.vdomText, entry.vdomDetails, entry.vdomSummary);
      } else {
        vdom.dataset.comparisonError = 'true';
        vdom.textContent = 'Virtual DOM 비교를 불러올 수 없습니다.';
      }
      get('comparison-result').textContent = '선택한 이력의 비교 결과를 표시합니다.';
    }
    updateWhitespaceDisplay(result, vdom, whitespaceToggle.checked);
    restoreSavedSource();
    sourceStale.hidden = true;
  }

  function applyMove() {
    const targetIndex = moveTarget;
    moveTarget = null;
    if (moveDialog.open) {
      moveDialog.close();
    }
    const previous = history.current;
    const target = history.entries[targetIndex];
    const snapshot = previewController.snapshot();
    let previewAttempted = false;
    try {
      const changes = diff(previous.tree, target.tree);
      const plan = preparePatch(actual, changes, previous.tree);
      applyPatch(actual, plan, target.tree);
      previewAttempted = true;
      previewController.restore({ tree: target.tree, html: target.html });
    } catch {
      try {
        actual.replaceChildren(renderVirtualRoot(previous.tree, document));
      } catch {
        locked = true;
        button.disabled = true;
        showMoveOutcome('recovery-failed', '실제 영역 복구에 실패했습니다. 새로고침해 주세요.');
        return;
      }
      let previewRecovered = true;
      if (previewAttempted) {
        try {
          previewController.restore(snapshot);
        } catch {
          previewRecovered = false;
        }
      }
      showMoveOutcome('recovered', previewRecovered && !previewController.hasRecoverySnapshot()
        ? '이동에 실패하여 이전 상태로 복구했습니다.'
        : '이동에 실패하여 실제 영역을 이전 상태로 복구했습니다.');
      return;
    }
    history.commitMove(targetIndex);
    editor.value = target.html;
    editorBase = target.html;
    previewController.setCurrentHtml(target.html);
    previewController.clearValidation();
    status.hidden = true;
    get('reserialize-notice').hidden = true;
    showEntryComparison(target);
    showTree(target.tree);
    showMoveOutcome('moved', '선택한 이력으로 이동했습니다.');
  }

  function beginMove(offset) {
    if (restoreChoicePending || locked || patchBusy || refreshPending || !history.move(offset)) {
      return;
    }
    moveTarget = history.currentIndex + offset;
    const changed = hasUnappliedChanges();
    if (changed) {
      moveDialog.showModal();
    } else {
      applyMove();
    }
  }

  back.addEventListener('click', () => beginMove(-1));
  forward.addEventListener('click', () => beginMove(1));
  get('history-move-continue').addEventListener('click', applyMove);
  function cancelMove() {
    moveDialog.close();
    moveTarget = null;
    showMoveOutcome('cancelled', '이력 이동을 취소했습니다.');
  }
  get('history-move-cancel').addEventListener('click', cancelMove);
  moveDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    cancelMove();
  });
  previewHost.addEventListener('preview-refresh-pending', () => {
    refreshPending = true;
    editor.readOnly = true;
    button.disabled = true;
    previewController.setBusy(true);
    updateHistoryControls();
  });
  previewHost.addEventListener('preview-refresh-result', (event) => {
    refreshPending = false;
    const hadRecoveryWarning = !previewRecoveryWarning.hidden;
    updatePreviewRecoveryWarning();
    if (!locked && hadRecoveryWarning && event.detail === 'success') {
      status.hidden = true;
    }
    if (!patchBusy) {
      if (!locked && event.detail === 'success') {
        moveStatus.hidden = true;
      }
      editor.readOnly = false;
      button.disabled = locked;
      previewController.setBusy(false);
    }
    updateHistoryControls();
  });
  updateHistoryControls();
  actual.inert = true;

  function outcome(value, message) {
    status.dataset.outcome = value;
    status.textContent = message;
    status.hidden = false;
    button.disabled = locked;
    updateHistoryControls();
  }
  function showSource(before, after, state) {
    renderHtmlDiff(source, before, after, state, sourceSideNames);
    sourceHtml = after;
    sourceStale.hidden = editor.value === sourceHtml;
  }
  function restoreSavedSource() {
    if (savedSource) {
      showSource(savedSource.before, savedSource.after, 'saved');
    } else {
      source.replaceChildren();
      source.dataset.diffState = 'saved';
      sourceHtml = editorBase;
      sourceStale.hidden = true;
    }
  }
  function showProgress(visible) {
    progress.hidden = !visible;
  }
  function unlock() {
    showProgress(false);
    patchBusy = false;
    updatePreviewRecoveryWarning();
    editor.readOnly = false;
    preview.inert = previewController.isStale();
    button.disabled = locked;
    previewController.setBusy(false);
    updateHistoryControls();
  }
  function runPreparation(action) {
    try {
      action();
    } catch {
      if (dialog.open) {
        dialog.close();
      }
      if (previewSnapshot) {
        try {
          previewController.restore(previewSnapshot);
        } catch {
          preview.inert = true;
        }
      }
      pending = null;
      previewSnapshot = null;
      unlock();
      outcome('invalid', 'Patch 준비 중 오류가 발생했습니다. 편집 내용을 확인하고 다시 시도해 주세요.');
    }
  }
  function cancel() {
    if (!pending) {
      return;
    }
    dialog.close();
    if (previewSnapshot) {
      try {
        previewController.restore(previewSnapshot);
      } catch {
        preview.inert = true;
      }
    }
    pending = null;
    previewSnapshot = null;
    restoreSavedSource();
    unlock();
    outcome('cancelled', 'Patch를 취소했습니다.');
  }
  function prepareConfirmation() {
    const old = history.current;
    const tree = createVirtualRoot(preview);
    const changes = hasUnappliedChanges() ? diff(old.tree, tree) : [];
    if (!changes.length) {
      const noEffect = editor.value !== editorBase;
      if (!noEffect) {
        restoreSavedSource();
      }
      previewSnapshot = null;
      unlock();
      outcome(noEffect ? 'no-effect' : 'no-change', noEffect ? '화면에 영향이 없어 이력에 저장하지 않았습니다.' : '변경 사항이 없습니다.');
      return;
    }
    const summary = describeChanges(changes, old.tree, tree);
    const total = Array.from(summary.counts.values()).reduce((sum, count) => sum + count, 0);
    const structural = [...summary.counts].filter(([label]) => !summary.formLabels.includes(label));
    const forms = [...summary.counts].filter(([label]) => summary.formLabels.includes(label));
    get('patch-confirm-vdom-changes').textContent = total >= 10 ? '다수의 변경 사항. 성공 후 비교 영역에서 상세 내용을 확인하세요.' : structural.map(summary.format).join(', ');
    const formRegion = get('patch-confirm-form-changes');
    formRegion.hidden = total >= 10 || forms.length === 0;
    formRegion.textContent = total >= 10 ? '' : forms.map(summary.format).join(', ') + ' ' + summary.details.filter((line) => line.startsWith('선택 변경') || line.startsWith('선택 목록 변경')).join(' ');
    const futureCount = history.length - history.currentIndex - 1;
    const futureLoss = get('patch-confirm-future-loss');
    futureLoss.hidden = futureCount === 0;
    futureLoss.textContent = futureCount ? `미래 이력 ${futureCount}개가 삭제됩니다.` : '';
    get('patch-confirm-history-loss').hidden = history.currentIndex + 1 < 10;
    get('patch-confirm-current-base').hidden = !positionWasUnknown;
    const vdomDetails = createVdomDetails(changes, old.tree, tree);
    pending = { tree, changes, summary, vdomDetails, authored: editor.value, resultHtml: serializeWithFormState(preview), before: old };
    showSource(editorBase, editor.value, 'unapplied');
    editor.readOnly = true;
    preview.inert = true;
    button.disabled = true;
    dialog.showModal();
  }
  function begin() {
    if (restoreChoicePending || locked || patchBusy || button.disabled) {
      return;
    }
    // 계산 전에 먼저 잠가, 진행 표시를 그리는 동안 들어온 편집·입력·중복 요청이 클릭 시점의 스냅샷을 바꾸지 못하게 한다.
    patchBusy = true;
    moveStatus.hidden = true;
    button.disabled = true;
    editor.readOnly = true;
    preview.inert = true;
    previewController.setBusy(true);
    updateHistoryControls();
    prepareAfterProgressPaint(calculatePatch);
  }
  // 첫 계산과 입력값 이월 확인 뒤의 재계산이 모두 진행 표시를 그린 다음 실행되도록 한 곳에서 처리한다.
  function prepareAfterProgressPaint(action) {
    showProgress(true);
    afterNextPaint(() => {
      try {
        runPreparation(action);
      } finally {
        showProgress(false);
      }
    });
  }
  function calculatePatch() {
    showSource(editorBase, editor.value, 'unapplied');
    previewSnapshot = previewController.isStale() ? previewController.snapshot() : null;
    if (previewSnapshot) {
      let waitingForCarryOverChoice = false;
      previewHost.addEventListener('preview-refresh-result', function onRefresh(event) {
        previewHost.removeEventListener('preview-refresh-result', onRefresh);
        if (event.detail === 'success' && !waitingForCarryOverChoice) {
          // 갱신이 바로 끝나면 이미 진행 표시가 그려진 계산 안이므로 이어서 계산한다.
          runPreparation(prepareConfirmation);
        } else if (event.detail === 'success') {
          // 입력값 확인을 기다리는 동안 진행 표시를 내렸으므로 다시 그린 뒤 계산한다.
          // 갱신 성공 시 미리보기가 다시 조작 가능해지므로 재계산 스냅샷을 잡기 전까지 다시 막는다.
          preview.inert = true;
          prepareAfterProgressPaint(prepareConfirmation);
        } else {
          previewSnapshot = null;
          if (event.detail === 'cancelled') {
            restoreSavedSource();
          }
          unlock();
          const isRenderFailure = event.detail === 'render-failed';
          const message = isRenderFailure
            ? '미리보기 갱신에 실패해 Patch를 적용하지 않았습니다.'
            : event.detail === 'invalid' ? '입력 오류로 적용하지 않았습니다.' : 'Patch를 취소했습니다.';
          outcome(isRenderFailure ? 'invalid' : event.detail, message);
        }
      });
      previewController.refresh();
      waitingForCarryOverChoice = true;
    } else {
      prepareConfirmation();
    }
  }
  function saveDraft() {
    storageWarning.hidden = true;
    let result = 'failed';
    let hadSavedState = false;
    try {
      const previous = readTemporaryState(window.sessionStorage);
      hadSavedState = Boolean(previous && previous.kind !== 'corrupted');
      result = saveTemporaryState(window.sessionStorage, {
      draft: pending.authored,
      base: editorBase,
      previewHtml: pending.authored,
      preview: pending.tree,
      history: history.entries,
      currentIndex: history.currentIndex,
      });
    } catch {
      result = 'failed';
    }
    storageWarning.dataset.storageResult = result;
    if (result === 'draft') {
      storageWarning.textContent = '전체 임시 저장에 실패해 HTML 초안만 저장했습니다.';
      storageWarning.hidden = false;
    }
    if (result === 'failed') {
      storageWarning.textContent = hadSavedState
        ? '이전 임시 저장본은 유지되며 최신 수정은 저장되지 않았을 수 있습니다. 편집 내용을 복사해 주세요.'
        : '이번 내용을 임시 저장하지 못했습니다. 최신 수정 내용을 복사해 주세요.';
      storageWarning.hidden = false;
    }
  }
  function commit() {
    if (!pending) {
      return;
    }
    dialog.close();
    let plan;
    try {
      plan = preparePatch(actual, pending.changes, pending.before.tree);
    } catch {
      pending = null;
      previewSnapshot = null;
      unlock();
      outcome('invalid', '실제 영역이 이전 이력과 달라 적용하지 못했습니다. 새로고침해 주세요.');
      return;
    }
    saveDraft();
    try {
      applyPatch(actual, plan, pending.tree);
    } catch {
      try {
        actual.replaceChildren(renderVirtualRoot(history.current.tree, document));
        if (history.current.source) {
          get('comparison-result').textContent = '이전 성공 결과를 표시합니다.';
        }
        outcome('recovered', '적용에 실패하여 이전 상태로 복구했습니다');
      } catch {
        locked = true;
        outcome('recovery-failed', '복구에 실패해 화면 상태가 불확실합니다. 편집 내용을 복사하고 새로고침해 주세요.');
      }
      pending = null;
      previewSnapshot = null;
      unlock();
      return;
    }
    const entry = { tree: pending.tree, html: pending.authored, resultHtml: pending.resultHtml, previousResultHtml: pending.before.resultHtml, source: { before: editorBase, after: pending.authored }, changes: pending.changes, vdomText: [...pending.summary.counts].map(pending.summary.format).join(', ') + ' ' + pending.summary.details.join(' '), vdomDetails: pending.vdomDetails, vdomSummary: { counts: [...pending.summary.counts].map(pending.summary.format).join(', '), details: pending.summary.formDetails } };
    history.append(entry);
    positionWasUnknown = false;
    savedSource = entry.source;
    renderHtmlDiff(result, pending.before.resultHtml, pending.resultHtml);
    renderVdomDetails(vdom, entry.vdomText, entry.vdomDetails, entry.vdomSummary);
    updateWhitespaceDisplay(result, vdom, whitespaceToggle.checked);
    showSource(savedSource.before, savedSource.after, 'saved');
    editor.value = pending.resultHtml;
    editorBase = editor.value;
    sourceStale.hidden = true;
    previewController.setCurrentHtml(editor.value);
    const reserializeNotice = get('reserialize-notice');
    const hasUnselectedSingle = Array.from(preview.querySelectorAll('select')).some((select) => !select.multiple && select.options.length > 0 && select.selectedIndex === -1);
    reserializeNotice.textContent = hasUnselectedSingle
      ? '편집기 HTML의 표기가 바뀔 수 있습니다. 선택 없음 상태는 현재 미리보기와 이력에 보관되며 HTML만으로는 재현되지 않을 수 있습니다.'
      : '성공 후 편집기 HTML의 표기가 달라질 수 있습니다.';
    reserializeNotice.hidden = false;
    updateHistoryControls();
    get('comparison-result').textContent = '마지막 성공 결과를 표시합니다.';
    showTree(entry.tree);
    result.removeAttribute('data-comparison-error');
    vdom.removeAttribute('data-comparison-error');
    try {
      clearTemporaryState(window.sessionStorage);
    } catch {
      // 저장소에 접근할 수 없으면 다음 작업에서 다시 시도한다.
    }
    if (storageWarning.dataset.storageResult === 'failed') {
      storageWarning.textContent = '적용 전 임시 저장에 실패했지만 Patch는 성공했습니다.';
    } else if (storageWarning.dataset.storageResult === 'draft') {
      storageWarning.textContent = '전체 임시 저장에 실패해 적용 전에 초안만 저장했습니다. Patch는 성공했습니다.';
    }
    pending = null;
    previewSnapshot = null;
    unlock();
    outcome('success', 'Patch를 적용하고 이력을 저장했습니다.');
  }
  button.addEventListener('click', () => {
    runPreparation(begin);
  });
  get('patch-confirm-continue').addEventListener('click', () => {
    try {
      commit();
    } catch {
      locked = true;
      pending = null;
      previewSnapshot = null;
      unlock();
      outcome('recovery-failed', '처리 중 오류가 발생해 화면 상태가 불확실합니다. 편집 내용을 복사하고 새로고침해 주세요.');
    }
  });
  get('patch-confirm-cancel').addEventListener('click', cancel);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    cancel();
  });
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (event.target === dialog && outside) {
      cancel();
    }
  });
  editor.addEventListener('input', () => {
    sourceStale.hidden = editor.value === sourceHtml;
  });

  function clearStored() {
    try {
      return clearTemporaryState(window.sessionStorage);
    } catch {
      // 저장소 접근이 차단된 경우 현재 화면은 유지한다.
      return false;
    }
  }

  function restoreOutcome(value, message, cleanupFailure = null) {
    const notice = get('restore-status');
    notice.dataset.outcome = value;
    const cleanupNotice = cleanupFailure === 'corrupted'
      ? ' 손상된 저장본을 삭제하지 못해 다음 새로고침에 다시 나타날 수 있습니다.'
      : cleanupFailure === 'all' ? ' 저장본을 모두 삭제하지 못해 다음 새로고침에 다시 나타날 수 있습니다.' : '';
    notice.textContent = message + (stash?.corruptedKeys?.length && stash.kind !== 'corrupted'
      ? ' 다른 저장본이 손상되어 어느 쪽이 최신인지 알 수 없습니다.' : '') + cleanupNotice;
    notice.hidden = false;
  }

  function restoreDraft(state, withForms) {
    editor.value = state.draft;
    const formNotice = get('restore-form-notice');
    formNotice.hidden = true;
    const notices = [];
    try {
      inspectHtml(state.draft, notices);
      const template = document.createElement('template');
      template.innerHTML = state.draft;
      createVirtualRoot(template.content);
      if (withForms) {
        try {
          const saved = document.createElement('div');
          saved.appendChild(renderVirtualRoot(validateStoredTree(state.preview), document));
          const originalHtml = state.previewHtml || state.draft;
          inspectHtml(originalHtml);
          const original = document.createElement('template');
          original.innerHTML = originalHtml;
          const originalTree = createVirtualRoot(original.content);
          const savedTree = createVirtualRoot(saved);
          if (diff(originalTree, savedTree).some((change) => change.type !== 'form')) {
            throw new Error('저장된 미리보기와 HTML이 일치하지 않습니다.');
          }
          const losses = prepareCarryOver(originalHtml, saved, template.content);
          if (losses.counts.size || losses.emptySelectionMayBeLost) {
            formNotice.textContent = `복원하지 못한 입력값: ${Array.from(losses.counts, ([name, count]) => `${name} ${count}개`).join(', ')}. `;
            formNotice.hidden = false;
          }
        } catch {
          formNotice.textContent = '저장된 입력값을 복원하지 못했습니다.';
          formNotice.hidden = false;
        }
      }
      const tree = createVirtualRoot(template.content);
      previewController.restore({ tree, html: state.draft });
      previewController.clearValidation();
      renderDiagnostics(get('validation-warnings'), notices);
    } catch (error) {
      previewController.discardFormState();
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      renderDiagnostics(get('validation-warnings'), notices);
      renderDiagnostics(get('validation-errors'), [errorDiagnostic(error)]);
      formNotice.textContent = '초안 오류로 입력값을 복원하지 못했습니다.';
      formNotice.hidden = false;
    }
    sourceStale.hidden = true;
  }

  function restoreSaved(stash, cleanupFailure = null) {
    const state = stash.state;
    let entries = null;
    if (stash.kind === 'full') {
      try {
        entries = validateStoredHistory(state);
      } catch {
        cleanupFailure = clearStored() ? null : 'all';
      }
    }
    if (!entries) {
      restoreDraft(state, false);
      restoreOutcome('draft-only', '이력과 입력값을 복원하지 못해 초안만 복원했습니다.', cleanupFailure);
      return;
    }
    const validIndex = Number.isInteger(state.currentIndex) && state.currentIndex >= 0 && state.currentIndex < entries.length;
    const index = validIndex ? state.currentIndex : entries.length - 1;
    positionWasUnknown = !validIndex;
    const current = entries[index];
    actual.replaceChildren(renderVirtualRoot(current.tree, document));
    history.restore(entries, index);
    editorBase = validIndex ? state.base : current.html;
    showEntryComparison(current);
    showTree(current.tree);
    updateHistoryControls();
    restoreDraft(state, true);
    restoreOutcome('restored', validIndex ? '임시 저장본을 복원했습니다.' : '저장된 위치를 알 수 없어 최신 이력을 선택했습니다.', cleanupFailure);
  }

  let stash = null;
  try {
    stash = readTemporaryState(window.sessionStorage);
  } catch {
    restoreOutcome('unavailable', '임시 저장소에 접근할 수 없습니다.');
  }
  if (stash?.kind === 'corrupted') {
    const cleared = clearStored();
    restoreOutcome('corrupted', '임시 저장본이 손상되어 복원할 수 없습니다.', cleared ? null : 'all');
  } else if (stash) {
    const restoreDialog = get('restore-dialog');
    if (stash.corruptedKeys.length) {
      const message = document.createElement('p');
      message.textContent = '다른 저장본이 손상되어 이 초안이 최신인지 알 수 없습니다.';
      restoreDialog.prepend(message);
    }
    restoreDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
    });
    restoreDialog.addEventListener('close', () => {
      if (restoreChoicePending && !restoreDialog.open) {
        restoreDialog.showModal();
      }
    });
    get('restore-accept').addEventListener('click', () => {
      restoreChoicePending = false;
      restoreDialog.close();
      let cleanupFailure = null;
      for (const key of stash.corruptedKeys) {
        try {
          const current = readTemporaryState(window.sessionStorage);
          if (current?.corruptedKeys.includes(key)) {
            window.sessionStorage.removeItem(key);
          }
        } catch {
          // 손상 키를 정리하지 못해도 유효한 저장본은 보존한다.
          cleanupFailure = 'corrupted';
        }
      }
      restoreSaved(stash, cleanupFailure);
    });
    get('restore-decline').addEventListener('click', () => {
      restoreChoicePending = false;
      restoreDialog.close();
      const cleared = clearStored();
      restoreOutcome('declined', '임시 저장본을 복원하지 않았습니다.', cleared ? null : 'all');
    });
    restoreChoicePending = true;
    restoreDialog.showModal();
  }

  window.addEventListener('beforeunload', (event) => {
    try {
      if (hasUnappliedChanges()) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });
}
