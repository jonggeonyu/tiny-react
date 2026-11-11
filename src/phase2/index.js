import { diff } from '../diff.js';
import { preparePatch, applyPatch } from '../patch.js';
import { copyDependencies } from '../hooks/dependencies.js';

const areas = new Map();
let context = null;

function containsAcrossShadow(ancestor, node) {
  for (let current = node; current; current = current.parentNode || current.host) {
    if (current === ancestor) {
      return true;
    }
  }
  return false;
}

function assertAvailable(container, ownArea = null) {
  for (const area of areas.values()) {
    if (area !== ownArea && (containsAcrossShadow(area.container, container) || containsAcrossShadow(container, area.container))) {
      throw new Error('관리 영역이 겹칩니다.');
    }
  }
}

function readTargetRoot(container) {
  function read(node) {
    if (node.nodeType === 3) {
      return { type: 'text', tag: null, attributes: {}, text: node.data, children: [], formState: null };
    }
    if (node.nodeType !== 1 || node.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      throw new Error('지원하지 않는 대상 노드입니다.');
    }
    const attributes = Object.fromEntries(Array.from(node.attributes, ({ name, value }) => [name, value]));
    if (Object.keys(attributes).some((name) => /^on/i.test(name))) {
      throw new Error('이벤트 속성은 지원하지 않습니다.');
    }
    let formState = null;
    if (node.localName === 'input') {
      formState = ['checkbox', 'radio'].includes(node.type) ? { checked: node.checked } : { value: node.value };
    } else if (node.localName === 'textarea') {
      formState = { value: node.value };
    } else if (node.localName === 'option') {
      formState = { selected: node.selected };
    }
    return { type: 'element', tag: node.localName, attributes, text: null, children: Array.from(node.childNodes, read), formState };
  }
  return emptyRoot(Array.from(container.childNodes, read));
}

export function registerArea(id, container) {
  if (typeof id !== 'string' || !id || !container || container.nodeType !== 1) {
    throw new TypeError('영역 식별자와 DOM 요소가 필요합니다.');
  }
  const area = areas.get(id);
  for (const [otherId, other] of areas) {
    if (otherId !== id && (containsAcrossShadow(other.container, container) || containsAcrossShadow(container, other.container))) {
      throw new Error('관리 영역이 겹칩니다.');
    }
  }
  if (area && area.container !== container && area.owner) {
    return area.owner.replaceTarget(container);
  }
  if (area) {
    area.container = container;
  } else {
    areas.set(id, { container, owner: null, blocked: false });
  }
}

function outsideRender(callback) {
  const priorContext = context;
  context = null;
  try {
    return callback();
  } finally {
    context = priorContext;
  }
}

function requireContext() {
  if (!context || context.childDepth) {
    throw new Error('Hook은 루트 렌더링에서만 사용할 수 있습니다.');
  }
  return context;
}

function slot(type) {
  const current = requireContext();
  const index = current.cursor++;
  const previous = current.previous[index];
  if (previous && previous.type !== type) {
    throw new Error('Hook 호출 순서나 종류가 바뀌었습니다.');
  }
  if (!previous && current.initialized) {
    throw new Error('Hook 호출 개수가 바뀌었습니다.');
  }
  return { current, index, previous };
}

function dependenciesEqual(left, right) {
  return left !== undefined && right !== undefined && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

export function useState(initial) {
  const { current, index, previous } = slot('state');
  const value = previous ? previous.value : typeof initial === 'function' ? initial() : initial;
  const setter = previous?.setter || ((next) => current.owner.setState(index, next));
  current.hooks[index] = { type: 'state', value, setter };
  return [value, setter];
}

export function useMemo(calculate, dependencies) {
  if (typeof calculate !== 'function') {
    throw new TypeError('계산 함수가 필요합니다.');
  }
  const { current, index, previous } = slot('memo');
  const deps = copyDependencies(dependencies);
  const value = previous && dependenciesEqual(previous.dependencies, deps) ? previous.value : calculate();
  current.hooks[index] = { type: 'memo', value, dependencies: deps };
  return value;
}

export function useEffect(effect, dependencies) {
  if (typeof effect !== 'function') {
    throw new TypeError('Effect 함수가 필요합니다.');
  }
  const { current, index, previous } = slot('effect');
  const deps = copyDependencies(dependencies);
  const changed = !previous || !dependenciesEqual(previous.dependencies, deps);
  current.hooks[index] = { type: 'effect', effect, dependencies: deps, cleanup: previous?.cleanup, changed };
}

export function renderChild(child, props = {}) {
  if (!context || typeof child !== 'function') {
    throw new Error('자식은 렌더링 중 함수로 호출해야 합니다.');
  }
  context.childDepth += 1;
  try {
    const result = child(props);
    validateNode(result);
    return result;
  } finally {
    context.childDepth -= 1;
  }
}

export function registerEvent(node, type, handler) {
  if (!context || !node || node.type !== 'element' || !['click', 'input', 'change'].includes(type) || typeof handler !== 'function') {
    throw new Error('렌더링 중 요소와 지원하는 이벤트, 처리 함수가 필요합니다.');
  }
  let handlers = context.events.get(node);
  if (!handlers) {
    handlers = new Map();
    context.events.set(node, handlers);
  }
  if (handlers.has(type)) {
    console.warn('중복 이벤트 등록: 마지막 함수를 사용합니다.');
  }
  handlers.set(type, handler);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function validateNode(node, ancestors = new Set()) {
  if (node === null) {
    return;
  }
  if (!isRecord(node) || !['text', 'element'].includes(node.type) || !Array.isArray(node.children) || !isRecord(node.attributes)) {
    throw new TypeError('Invalid VDOM node.');
  }
  if (ancestors.has(node)) {
    throw new TypeError('Cyclic VDOM is not supported.');
  }
  if (node.type === 'text' && (node.tag !== null || typeof node.text !== 'string' || node.children.length || Object.keys(node.attributes).length || node.formState !== null)) {
    throw new TypeError('Invalid VDOM text node.');
  }
  if (node.type === 'element' && (typeof node.tag !== 'string' || !/^[a-z][a-z0-9-]*$/.test(node.tag) || node.text !== null)) {
    throw new TypeError('Invalid VDOM element.');
  }
  if (Object.entries(node.attributes).some(([name, value]) => typeof value !== 'string' || /^on/i.test(name))) {
    throw new TypeError('Invalid VDOM attributes.');
  }
  if (node.formState !== null) {
    if (!isRecord(node.formState) || Object.entries(node.formState).some(([name, value]) => !((name === 'value' && typeof value === 'string') || (['checked', 'selected'].includes(name) && typeof value === 'boolean')))) {
      throw new TypeError('Invalid VDOM form state.');
    }
    const allowed = node.tag === 'input' ? ['value', 'checked'] : node.tag === 'textarea' ? ['value'] : node.tag === 'option' ? ['selected'] : [];
    if (Object.keys(node.formState).some((key) => !allowed.includes(key))) {
      throw new TypeError('Form state is not supported for this element.');
    }
  }
  ancestors.add(node);
  try {
    node.children.forEach((child) => validateNode(child, ancestors));
  } finally {
    ancestors.delete(node);
  }
}

function normalizeNode(node, events, copies = new WeakMap()) {
  if (node === null) {
    return null;
  }
  if (copies.has(node)) {
    return copies.get(node);
  }
  const children = Object.freeze(node.children.filter((child) => child !== null).map((child) => normalizeNode(child, events, copies)));
  const normalized = Object.freeze({
    type: node.type,
    tag: node.tag,
    attributes: Object.freeze({ ...node.attributes }),
    text: node.text,
    children,
    formState: node.formState === null ? null : Object.freeze({ ...node.formState }),
  });
  copies.set(node, normalized);
  if (events.has(node)) {
    events.set(normalized, events.get(node));
  }
  return normalized;
}

function snapshotContainer(container) {
  const copy = container.cloneNode(true);
  const originals = container.querySelectorAll('input, textarea, option, select');
  const copies = copy.querySelectorAll('input, textarea, option, select');
  originals.forEach((original, index) => {
    const clone = copies[index];
    if (original.localName === 'input') {
      clone.value = original.value;
      clone.checked = original.checked;
    } else if (original.localName === 'textarea') {
      clone.value = original.value;
    } else if (original.localName === 'option') {
      clone.selected = original.selected;
    } else if (!original.multiple) {
      clone.selectedIndex = original.selectedIndex;
    }
  });
  return copy;
}

function restoreUncontrolledForms(container, snapshot, beforeTree, afterTree) {
  function visit(dom, saved, before, after) {
    if (!dom || !saved || !before || !after || before.type !== after.type || before.tag !== after.tag) {
      return;
    }
    if (after.type === 'element' && after.tag === 'input' && ['type', 'name'].some((name) => before.attributes[name] !== after.attributes[name])) {
      return;
    }
    if (after.type === 'element' && after.formState === null) {
      if (after.tag === 'input') {
        if (dom.type === 'checkbox' || dom.type === 'radio') {
          dom.checked = saved.checked;
        } else {
          dom.value = saved.value;
        }
      } else if (after.tag === 'textarea') {
        dom.value = saved.value;
      }
    }
    after.children.forEach((child, index) => visit(dom.childNodes[index], saved.childNodes[index], before.children[index], child));
    if (after.tag === 'select') {
      const options = [];
      const collect = (node) => {
        if (node.tag === 'option') {
          options.push(node);
        }
        node.children.forEach(collect);
      };
      after.children.forEach(collect);
      if (options.every((option) => option.formState === null) && dom.options.length === saved.options.length) {
        if (dom.multiple) {
          Array.from(dom.options).forEach((option, index) => { option.selected = saved.options[index].selected; });
        } else {
          dom.selectedIndex = saved.selectedIndex;
        }
      }
    }
  }
  visit(container, snapshot, beforeTree, afterTree);
}

function emptyRoot(children = []) {
  return Object.freeze({ type: 'root', tag: null, attributes: Object.freeze({}), text: null, children: Object.freeze(children), formState: null });
}

function eventRecords(container, tree, events, owner) {
  const records = [];
  function visit(node, dom) {
    for (const [type, handler] of events.get(node) || []) {
      const listener = (event) => {
        try {
          outsideRender(() => handler(event));
        } catch (error) {
          event.stopPropagation();
          owner.report('event-handler', { ok: false, committed: false, errors: [{ phase: 'event', error }], eventType: type });
        }
      };
      records.push({ dom, type, listener });
    }
    node.children.forEach((child, index) => visit(child, dom.childNodes[index]));
  }
  tree.children.forEach((child, index) => visit(child, container.childNodes[index]));
  return records;
}

function detach(records) {
  for (const { dom, type, listener } of records) {
    dom.removeEventListener(type, listener);
  }
}

function attach(records) {
  for (const { dom, type, listener } of records) {
    dom.addEventListener(type, listener);
  }
}

function propsCopy(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props) || ![Object.prototype, null].includes(Object.getPrototypeOf(props))) {
    throw new TypeError('props는 일반 객체여야 합니다.');
  }
  return { ...props };
}

export class FunctionComponent {
  constructor(component, { onError } = {}) {
    if (typeof component !== 'function' || (onError !== undefined && typeof onError !== 'function')) {
      throw new TypeError('컴포넌트와 오류 처리 함수를 확인하세요.');
    }
    this.component = component;
    this.onError = onError;
    this.hooks = [];
    this.tree = emptyRoot();
    this.records = [];
    this.status = 'new';
    this.busy = false;
    this.effectBlocked = false;
    this.previousErrors = [];
  }

  report(operation, result) {
    if (!this.onError) {
      console.error(operation, result);
      return;
    }
    const wasBusy = this.busy;
    const priorContext = context;
    this.busy = true;
    context = null;
    try {
      this.onError({ operation, ...result });
    } catch (error) {
      console.error('오류 전달 실패', error, result);
    } finally {
      context = priorContext;
      this.busy = wasBusy;
    }
  }

  fail(operation, phase, error, recovery = 'not-needed') {
    const result = { ok: false, committed: false, recovery, errors: [{ phase, error }] };
    this.report(operation, result);
    return result;
  }

  mount(container, props = {}) {
    if (this.status !== 'new' || this.busy) {
      throw new Error('mount할 수 없는 상태입니다.');
    }
    const entry = [...areas.values()].find((area) => area.container === container);
    if (!entry || entry.owner || entry.blocked || !container.isConnected || container.childNodes.length) {
      throw new Error('등록된 연결된 빈 관리 영역이 필요합니다.');
    }
    assertAvailable(container, entry);
    const nextProps = propsCopy(props);
    this.area = entry;
    this.container = container;
    entry.owner = this;
    const result = this.perform('mount', nextProps, this.hooks);
    if (!result.committed && result.recovery !== 'failed') {
      entry.owner = null;
    }
    return result;
  }

  update(props) {
    if (this.status !== 'mounted' || this.busy) {
      throw new Error('update할 수 없는 상태입니다.');
    }
    return this.perform('update', arguments.length ? propsCopy(props) : this.props, this.hooks);
  }

  setState(index, update) {
    if (this.status === 'unmounted') {
      console.warn('제거된 컴포넌트의 상태 변경을 무시합니다.');
      return { ok: false, committed: false, reason: 'unmounted', errors: [] };
    }
    if (this.status !== 'mounted' || this.busy) {
      throw new Error('현재 상태를 변경할 수 없습니다.');
    }
    let value;
    this.busy = true;
    try {
      value = typeof update === 'function' ? update(this.hooks[index].value) : update;
    } catch (error) {
      return this.fail('setState', 'state', error);
    } finally {
      this.busy = false;
    }
    if (Object.is(value, this.hooks[index].value)) {
      return { ok: true, committed: false, reason: 'unchanged', errors: [] };
    }
    const staged = this.hooks.slice();
    staged[index] = { ...staged[index], value };
    return this.perform('setState', this.props, staged);
  }

  perform(operation, props, previous) {
    if (!this.container.isConnected) {
      return this.fail(operation, 'patch', new Error('대상이 문서에서 분리되었습니다.'));
    }
    try {
      assertAvailable(this.container, this.area);
    } catch (error) {
      return this.fail(operation, 'patch', error);
    }
    this.busy = true;
    const priorContext = context;
    const staged = { owner: this, hooks: [], previous, cursor: 0, initialized: this.status === 'mounted', events: new Map(), childDepth: 0 };
    let tree;
    let changes;
    try {
      context = staged;
      const node = this.component(props);
      validateNode(node);
      if (staged.initialized && staged.cursor !== previous.length) {
        throw new Error('Hook 호출 개수가 바뀌었습니다.');
      }
      const normalized = normalizeNode(node, staged.events);
      tree = emptyRoot(normalized === null ? [] : [normalized]);
    } catch (error) {
      context = priorContext;
      this.busy = false;
      return this.fail(operation, 'render', error);
    } finally {
      context = priorContext;
    }
    try {
      changes = diff(this.tree, tree);
    } catch (error) {
      this.busy = false;
      return this.fail(operation, 'diff', error);
    }
    let backup;
    let phase = 'patch';
    try {
      assertAvailable(this.container, this.area);
      const actions = preparePatch(this.container, changes, this.tree);
      backup = snapshotContainer(this.container);
      detach(this.records);
      applyPatch(this.container, actions, tree);
      restoreUncontrolledForms(this.container, backup, this.tree, tree);
      phase = 'event';
      const records = eventRecords(this.container, tree, staged.events, this);
      this.pendingRecords = records;
      attach(records);
      this.records = records;
      this.pendingRecords = null;
    } catch (error) {
      const errors = [{ phase, error }];
      let recovery = 'not-needed';
      if (backup) {
        try {
          detach(this.pendingRecords || []);
          this.container.replaceChildren(...backup.childNodes);
          this.records = eventRecords(this.container, this.tree, this.events || new Map(), this);
          attach(this.records);
          recovery = 'restored';
        } catch (restoreError) {
          errors.push({ phase: 'recovery', error: restoreError });
          recovery = 'failed';
          this.status = 'broken';
        }
      }
      this.pendingRecords = null;
      this.busy = false;
      const result = { ok: false, committed: false, recovery, errors };
      this.report(operation, result);
      return result;
    }
    this.tree = tree;
    this.events = staged.events;
    this.hooks = staged.hooks;
    this.props = props;
    this.status = 'mounted';
    const errors = [];
    const changed = this.hooks.filter((hook) => hook.type === 'effect' && hook.changed);
    for (const hook of changed) {
      if (hook.cleanup) {
        try {
          outsideRender(hook.cleanup);
        } catch (error) {
          errors.push({ phase: 'cleanup', error });
        }
        hook.cleanup = undefined;
      }
    }
    if (errors.length) {
      this.effectBlocked = true;
      this.previousErrors.push(...errors);
    }
    if (!this.effectBlocked) {
      for (const hook of changed) {
        try {
          const cleanup = outsideRender(hook.effect);
          if (cleanup !== undefined && typeof cleanup !== 'function') {
            throw new TypeError('Effect는 정리 함수 또는 undefined를 반환해야 합니다.');
          }
          hook.cleanup = cleanup;
        } catch (error) {
          errors.push({ phase: 'effect', error });
          this.effectBlocked = true;
          break;
        }
      }
    }
    this.busy = false;
    if (this.effectBlocked && (changed.length || errors.length)) {
      const result = { ok: false, committed: true, reason: 'effect-blocked', errors };
      this.report(operation, result);
      return result;
    }
    return { ok: true, committed: true, errors: [] };
  }

  replaceTarget(container) {
    if (this.status !== 'mounted' || this.busy || !container || container.nodeType !== 1 || !container.isConnected) {
      throw new Error('Cannot replace the target in the current state.');
    }
    assertAvailable(container, this.area);
    assertAvailable(this.container, this.area);
    if (containsAcrossShadow(this.container, container) || containsAcrossShadow(container, this.container)) {
      throw new Error('이전 대상과 새 대상이 겹칩니다.');
    }
    let existing;
    try {
      existing = readTargetRoot(container);
      const old = readTargetRoot(this.container);
      const hasForm = (node) => Boolean(node && ((node.type === 'element' && ['input', 'textarea', 'select', 'option'].includes(node.tag)) || node.children.some(hasForm)));
      const inspect = (before, after, target) => {
        if (hasForm(after) && (!target || target.type !== after.type || target.tag !== after.tag)) {
          throw new Error('Input correspondence to the target tree is uncertain.');
        }
        for (const tree of [before, after]) {
          const seen = new Set();
          for (const child of tree?.children || []) {
            if (child.type !== 'element' || !['input', 'textarea', 'select'].includes(child.tag)) {
              continue;
            }
            const key = JSON.stringify([child.tag, child.attributes.type, child.attributes.name]);
            if (seen.has(key)) {
              throw new Error('Duplicate input correspondence is uncertain.');
            }
            seen.add(key);
          }
        }
        const beforeForm = before?.type === 'element' && ['input', 'textarea', 'select', 'option'].includes(before.tag);
        const afterForm = after?.type === 'element' && ['input', 'textarea', 'select', 'option'].includes(after.tag);
        if (beforeForm || afterForm) {
          const identity = (node) => {
            if (!node) {
              return null;
            }
            if (node.tag === 'option') {
              return node.attributes.value ?? node.children.map((child) => child.text ?? '').join('');
            }
            if (node.tag === 'input' && ['checkbox', 'radio'].includes(node.attributes.type)) {
              return node.attributes.value ?? 'on';
            }
            return null;
          };
          if (!beforeForm || !afterForm || before.tag !== after.tag || !target || target.tag !== after.tag || ['type', 'name'].some((name) => before.attributes[name] !== after.attributes[name] || after.attributes[name] !== target.attributes[name]) || identity(before) !== identity(after) || identity(after) !== identity(target) || (target.formState && JSON.stringify(after.formState) !== JSON.stringify(target.formState))) {
            throw new Error('Input correspondence or state consistency is uncertain.');
          }
        }
        if (before && after && (before.type !== after.type || before.tag !== after.tag)) {
          throw new Error('Input correspondence path differs.');
        }
        const length = Math.max(before?.children.length || 0, after?.children.length || 0);
        for (let index = 0; index < length; index += 1) {
          inspect(before?.children[index], after?.children[index], target?.children[index]);
        }
      };
      inspect(old, existing, this.tree);
    } catch (error) {
      return this.fail('replaceTarget', 'render', error);
    }
    this.busy = true;
    try {
      const oldContainer = this.container;
      const oldRecords = this.records;
      let oldBackup;
      let backup;
      try {
        oldBackup = snapshotContainer(oldContainer);
        backup = snapshotContainer(container);
      } catch (error) {
        return this.fail('replaceTarget', 'patch', error);
      }
      let records = [];
      let oldRemovalStarted = false;
      let phase = 'patch';
      try {
        const changes = diff(existing, this.tree);
        const actions = preparePatch(container, changes, existing);
        applyPatch(container, actions, this.tree);
        restoreUncontrolledForms(container, backup, existing, this.tree);
        phase = 'event';
        records = eventRecords(container, this.tree, this.events, this);
        attach(records);
        detach(oldRecords);
        oldRemovalStarted = true;
        phase = 'patch';
        oldContainer.replaceChildren();
      } catch (error) {
        const errors = [{ phase, error }];
        let recovery = 'restored';
        try {
          detach(records);
          container.replaceChildren(...backup.childNodes);
          detach(oldRecords);
          if (oldRemovalStarted) {
            oldContainer.replaceChildren(...oldBackup.childNodes);
            this.records = eventRecords(oldContainer, this.tree, this.events, this);
            attach(this.records);
          } else {
            attach(oldRecords);
          }
        } catch (restoreError) {
          errors.push({ phase: 'recovery', error: restoreError });
          recovery = 'failed';
          this.status = 'broken';
          this.recoveryTarget = container;
          this.recoveryRecords = records;
        }
        this.busy = false;
        const result = { ok: false, committed: false, recovery, errors };
        this.report('replaceTarget', result);
        return result;
      }
      this.container = container;
      this.area.container = container;
      this.records = records;
      const errors = [];
      const effects = this.hooks.filter((hook) => hook.type === 'effect');
      for (const hook of effects) {
        if (hook.cleanup) {
          try {
            outsideRender(hook.cleanup);
          } catch (error) {
            errors.push({ phase: 'cleanup', error });
          }
          hook.cleanup = undefined;
        }
      }
      if (errors.length) {
        this.effectBlocked = true;
        this.previousErrors.push(...errors);
      }
      if (!this.effectBlocked) {
        for (const hook of effects) {
          try {
            const cleanup = outsideRender(hook.effect);
            if (cleanup !== undefined && typeof cleanup !== 'function') {
              throw new TypeError('Effect는 정리 함수 또는 undefined를 반환해야 합니다.');
            }
            hook.cleanup = cleanup;
          } catch (error) {
            errors.push({ phase: 'effect', error });
            this.effectBlocked = true;
            break;
          }
        }
      }
      this.busy = false;
      if (this.effectBlocked) {
        const result = { ok: false, committed: true, reason: 'effect-blocked', errors };
        this.report('replaceTarget', result);
        return result;
      }
      return { ok: true, committed: true, errors: [] };
    } finally {
      this.busy = false;
    }
  }

  unmount() {
    if (!['mounted', 'broken'].includes(this.status) || this.busy) {
      throw new Error('unmount할 수 없는 상태입니다.');
    }
    this.busy = true;
    try {
      assertAvailable(this.container, this.area);
      if (this.recoveryTarget) {
        assertAvailable(this.recoveryTarget, this.area);
        if (containsAcrossShadow(this.container, this.recoveryTarget) || containsAcrossShadow(this.recoveryTarget, this.container)) {
          throw new Error('정리 대상 영역이 겹칩니다.');
        }
      }
    } catch (error) {
      this.busy = false;
      return this.fail('unmount', 'patch', error);
    }
    try {
      if (this.recoveryTarget) {
        this.recoveryTarget.replaceChildren();
        detach(this.recoveryRecords || []);
        this.recoveryTarget = null;
        this.recoveryRecords = null;
      }
    } catch (error) {
      this.busy = false;
      return this.fail('unmount', 'patch', error, 'failed');
    }
    const backup = snapshotContainer(this.container);
    try {
      this.container.replaceChildren();
    } catch (error) {
      const errors = [{ phase: 'patch', error }];
      let recovery = 'restored';
      try {
        detach(this.records);
        this.container.replaceChildren(...backup.childNodes);
        this.records = eventRecords(this.container, this.tree, this.events || new Map(), this);
        attach(this.records);
      } catch (restoreError) {
        errors.push({ phase: 'recovery', error: restoreError });
        recovery = 'failed';
        this.status = 'broken';
      }
      this.busy = false;
      const result = { ok: false, committed: false, recovery, errors };
      this.report('unmount', result);
      return result;
    }
    const errors = [];
    try {
      detach(this.records);
    } catch (error) {
      errors.push({ phase: 'event', error });
    }
    for (const hook of this.hooks) {
      if (hook.type === 'effect' && hook.cleanup) {
        try {
          outsideRender(hook.cleanup);
        } catch (error) {
          errors.push({ phase: 'cleanup', error });
        }
      }
    }
    this.status = 'unmounted';
    this.area.owner = null;
    this.area.blocked = errors.length > 0 || this.previousErrors.length > 0;
    this.busy = false;
    if (this.area.blocked) {
      const result = { ok: false, committed: true, reason: this.previousErrors.length ? 'cleanup-unresolved' : 'cleanup-failed', errors, previousErrors: this.previousErrors };
      this.report('unmount', result);
      return result;
    }
    return { ok: true, committed: true, errors: [] };
  }
}

