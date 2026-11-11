import { inspectHtml, renderDiagnostics, errorDiagnostic } from './html-validation.js';
import { createVirtualRoot } from './vdom.js';
import { renderVirtualRoot } from './render.js';
import { getNodeKey, matchChildren } from './keyed-children.js';

const controls = 'input, textarea, select';

function pathOf(element, root) {
  const path = [];
  while (element !== root) {
    path.unshift(Array.prototype.indexOf.call(element.parentNode.children, element));
    element = element.parentNode;
  }
  return path.join('/');
}

function hasKeyedAncestor(element, root) {
  let current = element;
  while (current && current !== root) {
    if (current.nodeType === 1 && current.hasAttribute('data-key')) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}

function signature(element) {
  return element.outerHTML;
}

function valueNeutralSignature(element) {
  const clone = element.cloneNode(true);
  if (clone.localName === 'input') {
    if (clone.type === 'checkbox' || clone.type === 'radio') {
      clone.removeAttribute('checked');
    } else {
      clone.removeAttribute('value');
    }
  } else if (clone.localName === 'textarea') {
    clone.textContent = '';
  }
  return clone.outerHTML;
}

function copyState(source, target, keyedOptions = false) {
  if (source.localName === 'select') {
    if (keyedOptions) {
      const states = new Map(Array.from(source.options, (option) => [option.getAttribute('data-key'), option.selected]));
      const options = Array.from(target.options);
      if (source.multiple) {
        options.forEach((option) => {
          option.selected = states.get(option.getAttribute('data-key'));
        });
      } else {
        target.selectedIndex = options.findIndex((option) => states.get(option.getAttribute('data-key')));
      }
    } else if (source.multiple) {
      Array.from(source.options).forEach((option, index) => {
        target.options[index].selected = option.selected;
      });
    } else {
      target.selectedIndex = source.selectedIndex;
    }
  } else if (source.type === 'checkbox' || source.type === 'radio') {
    target.checked = source.checked;
  } else {
    target.value = source.value;
  }
}

function hasMatchingKeyedOptions(previous, next) {
  if (!next || previous.localName !== 'select' || next.localName !== 'select' ||
      !previous.cloneNode(false).isEqualNode(next.cloneNode(false))) {
    return false;
  }
  const oldOptions = Array.from(previous.options);
  const nextOptions = Array.from(next.options);
  if (!oldOptions.length || oldOptions.length !== nextOptions.length ||
      Array.from(previous.children).some((child) => child.localName !== 'option') ||
      Array.from(next.children).some((child) => child.localName !== 'option')) {
    return false;
  }
  const optionsByKey = new Map();
  for (const option of oldOptions) {
    const key = option.getAttribute('data-key');
    if (key === null || key.trim() === '' || optionsByKey.has(key)) {
      return false;
    }
    optionsByKey.set(key, option);
  }
  const seen = new Set();
  for (const option of nextOptions) {
    const key = option.getAttribute('data-key');
    const oldOption = optionsByKey.get(key);
    if (!oldOption || seen.has(key) || !oldOption.isEqualNode(option)) {
      return false;
    }
    seen.add(key);
  }
  return true;
}

function labelFor(element) {
  if (element.localName === 'select') {
    return element.multiple ? '다중 선택 항목' : '선택 목록';
  }
  if (element.type === 'checkbox') {
    return '체크박스';
  }
  if (element.type === 'radio') {
    return '라디오 버튼';
  }
  return '입력창';
}

function findKeyedControls(oldRoot, nextRoot) {
  const oldTree = createVirtualRoot(oldRoot);
  const nextTree = createVirtualRoot(nextRoot);
  const targets = new WeakMap();

  function visit(oldDom, nextDom, oldNode, nextNode, identified) {
    if (oldNode.type !== nextNode.type || oldNode.tag !== nextNode.tag) {
      return;
    }
    if (oldNode.type === 'element' && oldDom.matches(controls)) {
      targets.set(oldDom, { target: nextDom, identified });
    }
    const matches = matchChildren(oldNode.children, nextNode.children);
    nextNode.children.forEach((child, index) => {
      const oldIndex = matches[index];
      if (oldIndex === null) {
        return;
      }
      const previous = oldNode.children[oldIndex];
      const keyed = getNodeKey(previous) !== null && getNodeKey(previous) === getNodeKey(child);
      visit(oldDom.childNodes[oldIndex], nextDom.childNodes[index], previous, child, identified || keyed);
    });
  }

  visit(oldRoot, nextRoot, oldTree, nextTree, false);
  return targets;
}

export function prepareCarryOver(oldHtml, preview, next) {
  const oldTemplate = document.createElement('template');
  oldTemplate.innerHTML = oldHtml;
  const oldNodes = Array.from(oldTemplate.content.querySelectorAll(controls));
  const liveNodes = Array.from(preview.querySelectorAll(controls));
  const newNodes = Array.from(next.querySelectorAll(controls));
  const sameControlSequence = oldNodes.length === newNodes.length &&
    oldNodes.every((node, index) => signature(node) === signature(newNodes[index]));
  const counts = new Map();
  let emptySelectionMayBeLost = false;
  const oldRoot = oldTemplate.content;
  const keyedTargets = findKeyedControls(oldRoot, next);
  const matches = [];
  const radioLossGroups = new Set();
  const radioHtmlGroups = new Set();
  for (const [index, oldNode] of oldNodes.entries()) {
    const sig = signature(oldNode);
    const matchedControl = keyedTargets.get(oldNode);
    const keyedTarget = matchedControl?.identified ? matchedControl.target : null;
    if (hasMatchingKeyedOptions(oldNode, matchedControl?.target)) {
      matches.push({ oldNode, live: liveNodes[index], target: matchedControl.target, keyedOptions: true });
      continue;
    }
    if (keyedTarget && signature(keyedTarget) === sig) {
      matches.push({ oldNode, live: liveNodes[index], target: keyedTarget });
      continue;
    }
    if (keyedTarget && valueNeutralSignature(keyedTarget) === valueNeutralSignature(oldNode)) {
      continue;
    }
    const oldMatches = oldNodes.filter((node) => signature(node) === sig);
    const newMatches = newNodes.filter((node) => signature(node) === sig);
    const path = pathOf(oldNode, oldRoot);
    const match = newMatches.length === 1 && oldMatches.length === 1 ? newMatches[0] : null;
    const keyRequiresMatch = hasKeyedAncestor(oldNode, oldRoot) ||
      (match && hasKeyedAncestor(match, next));
    if (match && !keyRequiresMatch && (pathOf(match, next) === path || sameControlSequence)) {
      matches.push({ oldNode, live: liveNodes[index], target: match });
      continue;
    }
    const editedValue = newNodes.find((node) => pathOf(node, next) === path &&
      valueNeutralSignature(node) === valueNeutralSignature(oldNode));
    if (editedValue && !hasKeyedAncestor(oldNode, oldRoot) && !hasKeyedAncestor(editedValue, next) &&
        oldMatches.length === 1 && newNodes.filter((node) => valueNeutralSignature(node) === valueNeutralSignature(oldNode)).length === 1) {
      continue;
    }
    const label = labelFor(oldNode);
    const amount = oldNode.localName === 'select' && oldNode.multiple ? Array.from(liveNodes[index].options).filter((option) => option.selected).length : 1;
    const oldMultiple = oldNodes.filter((node) => node.localName === 'select' && node.multiple);
    const newMultiple = newNodes.filter((node) => node.localName === 'select' && node.multiple);
    const emptySelectionPreserved = oldMultiple.length === 1 && newMultiple.length === 1 &&
      pathOf(newMultiple[0], next) === path && newMultiple[0].selectedIndex === -1;
    const emptySelectionMayChange = oldNode.localName === 'select' && oldNode.multiple && amount === 0 && !emptySelectionPreserved;
    emptySelectionMayBeLost ||= emptySelectionMayChange;
    if (amount > 0) {
      counts.set(label, (counts.get(label) || 0) + amount);
    }
    if (oldNode.type === 'radio' && oldNode.name) {
      radioLossGroups.add(oldNode.name);
    }
  }
  for (const node of newNodes) {
    if (node.type === 'radio' && node.name && node.hasAttribute('checked') &&
        !oldNodes.some((oldNode) => signature(oldNode) === signature(node))) {
      radioHtmlGroups.add(node.name);
    }
  }
  for (const { oldNode, live, target, keyedOptions } of matches) {
    if (oldNode.type === 'radio' && oldNode.name && radioLossGroups.has(oldNode.name)) {
      counts.set('라디오 버튼', (counts.get('라디오 버튼') || 0) + 1);
    } else if (oldNode.type !== 'radio' || !oldNode.name || !radioHtmlGroups.has(oldNode.name)) {
      copyState(live, target, keyedOptions);
    }
  }
  return { counts, emptySelectionMayBeLost };
}

export function setupPreviewRefresh() {
  const editor = document.querySelector('[data-testid="html-editor"]');
  const host = document.querySelector('[data-testid="preview-host"]');
  const preview = host.shadowRoot.querySelector('[data-testid="content"]');
  if (!preview) {
    return;
  }
  const button = document.querySelector('[data-testid="refresh-preview-button"]');
  const staleNotice = document.querySelector('[data-testid="preview-stale-notice"]');
  const errors = document.querySelector('[data-testid="validation-errors"]');
  const warnings = document.querySelector('[data-testid="validation-warnings"]');
  const dialog = document.querySelector('[data-testid="carry-over-dialog"]');
  const description = document.querySelector('[data-testid="carry-over-description"]');
  let previewHtml = editor.value;
  let pending = null;
  let recoverySnapshot = null;
  let busy = false;
  let discardPreviousFormState = false;

  function updateStale() {
    const stale = discardPreviousFormState || recoverySnapshot !== null || editor.value !== previewHtml;
    staleNotice.hidden = !stale;
    preview.inert = stale;
    button.disabled = busy || !stale;
    dialog.hidden = true;
    pending = null;
  }

  function commit(candidate, html) {
    const snapshot = recoverySnapshot || { tree: createVirtualRoot(preview), html: previewHtml, discardPreviousFormState };
    const selections = Array.from(candidate.querySelectorAll('select'), (element) => ({
      element,
      index: element.selectedIndex,
      selected: Array.from(element.options, (option) => option.selected),
    }));
    const radios = Array.from(candidate.querySelectorAll('input[type="radio"]'), (element) => ({ element, checked: element.checked }));
    try {
      preview.replaceChildren(...candidate.childNodes);
      for (const { element, index, selected } of selections) {
        if (element.multiple) {
          selected.forEach((value, optionIndex) => {
            element.options[optionIndex].selected = value;
          });
        } else {
          element.selectedIndex = index;
        }
      }
      for (const { element, checked } of radios) {
        element.checked = checked;
      }
    } catch (error) {
      try {
        restoreSnapshot(snapshot);
      } catch {
        // 복구 데이터는 이후 갱신이나 이력 이동에 사용할 수 있도록 유지한다.
      }
      throw error;
    }
    previewHtml = html;
    discardPreviousFormState = false;
    recoverySnapshot = null;
    dialog.hidden = true;
    pending = null;
    updateStale();
    host.dispatchEvent(new CustomEvent('preview-refresh-result', { detail: 'success' }));
  }

  editor.addEventListener('input', () => {
    errors.hidden = true;
    warnings.hidden = true;
    updateStale();
  });
  function refresh() {
    const html = editor.value;
    if (html === previewHtml && !recoverySnapshot && !discardPreviousFormState) {
      return;
    }
    errors.hidden = true;
    warnings.hidden = true;
    const notices = [];
    let checkingInput = true;
    try {
      inspectHtml(html, notices);
      renderDiagnostics(warnings, notices);
      const template = document.createElement('template');
      template.innerHTML = html;
      createVirtualRoot(template.content);
      checkingInput = false;
      let source = preview;
      if (recoverySnapshot) {
        source = document.createElement('div');
        source.appendChild(renderVirtualRoot(recoverySnapshot.tree, document));
      }
      const losses = discardPreviousFormState
        ? { counts: new Map(), emptySelectionMayBeLost: false }
        : prepareCarryOver(previewHtml, source, template.content);
      if (losses.counts.size || losses.emptySelectionMayBeLost || recoverySnapshot) {
        const counts = Array.from(losses.counts, ([type, count]) => `${type} ${count}개`).join(', ');
        const countNotice = counts ? `이월하지 못하는 입력값: ${counts}. ` : '';
        const emptyNotice = losses.emptySelectionMayBeLost ? '다중 선택의 선택 없음 상태를 유지하지 못할 수 있음. ' : '';
        const recoveryNotice = recoverySnapshot ? '이전 미리보기를 복원하지 못했습니다. 이전 입력값이 사라질 수 있습니다. ' : '';
        description.textContent = `${recoveryNotice}${countNotice}${emptyNotice}계속하면 이 상태는 사라질 수 있습니다.`;
        pending = { candidate: template.content, html };
        dialog.hidden = false;
        host.dispatchEvent(new CustomEvent('preview-refresh-pending'));
      } else {
        commit(template.content, html);
      }
    } catch (error) {
      renderDiagnostics(warnings, notices);
      if (checkingInput) {
        renderDiagnostics(errors, [errorDiagnostic(error)]);
      } else {
        errors.textContent = '미리보기를 갱신하지 못했습니다. 다시 시도해 주세요.';
        errors.hidden = false;
      }
      host.dispatchEvent(new CustomEvent('preview-refresh-result', { detail: checkingInput ? 'invalid' : 'render-failed' }));
    }
  }
  button.addEventListener('click', refresh);
  document.querySelector('[data-testid="carry-over-continue"]').addEventListener('click', () => {
    if (pending && pending.html === editor.value) {
      try {
        commit(pending.candidate, pending.html);
      } catch {
        dialog.hidden = true;
        pending = null;
        errors.textContent = '미리보기를 갱신하지 못했습니다. 다시 시도해 주세요.';
        errors.hidden = false;
        host.dispatchEvent(new CustomEvent('preview-refresh-result', { detail: 'render-failed' }));
      }
    }
  });
  document.querySelector('[data-testid="carry-over-cancel"]').addEventListener('click', () => {
    pending = null;
    dialog.hidden = true;
    host.dispatchEvent(new CustomEvent('preview-refresh-result', { detail: 'cancelled' }));
  });
  function restoreSnapshot(snapshot) {
    recoverySnapshot = snapshot;
    previewHtml = snapshot.html;
    discardPreviousFormState = snapshot.discardPreviousFormState || false;
    try {
      preview.replaceChildren(renderVirtualRoot(snapshot.tree, document));
    } catch (error) {
      updateStale();
      throw error;
    }
    recoverySnapshot = null;
    updateStale();
  }

  updateStale();
  return {
    isStale: () => discardPreviousFormState || recoverySnapshot !== null || editor.value !== previewHtml,
    hasRecoverySnapshot: () => recoverySnapshot !== null,
    setBusy(value) {
      busy = value;
      button.disabled = busy || !this.isStale();
    },
    snapshot: () => recoverySnapshot || ({ tree: createVirtualRoot(preview), html: previewHtml, discardPreviousFormState }),
    restore: restoreSnapshot,
    discardFormState() {
      preview.replaceChildren();
      discardPreviousFormState = true;
      updateStale();
    },
    setCurrentHtml(html) {
      previewHtml = html;
      updateStale();
    },
    clearValidation() {
      errors.hidden = true;
      warnings.hidden = true;
    },
    refresh,
  };
}
