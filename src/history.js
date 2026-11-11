export function createHistory(initialEntry) {
  let entries = [initialEntry];
  let index = 0;
  return {
    get entries() {
      return entries;
    },
    get current() {
      return entries[index];
    },
    get currentIndex() {
      return index;
    },
    get length() {
      return entries.length;
    },
    move(offset) {
      return entries[index + offset] ?? null;
    },
    commitMove(targetIndex) {
      if (targetIndex < 0 || targetIndex >= entries.length) {
        throw new RangeError('이력 위치가 범위를 벗어났습니다.');
      }
      index = targetIndex;
    },
    append(entry) {
      entries = [...entries.slice(0, index + 1), entry].slice(-10);
      index = entries.length - 1;
    },
    restore(savedEntries, savedIndex) {
      entries = savedEntries;
      index = savedIndex;
    },
  };
}

export function saveTemporaryState(storage, state) {
  let sequence = Date.now();
  for (const key of ['mini-react-full', 'mini-react-draft']) {
    let raw;
    try {
      raw = storage.getItem(key);
    } catch {
      // 이전 저장본의 순서를 알 수 없으면 덮어쓰지 않는다.
      return 'failed';
    }
    try {
      const previous = JSON.parse(raw || 'null');
      if (Number.isSafeInteger(previous?.sequence)) {
        sequence = Math.max(sequence, previous.sequence + 1);
      }
    } catch {
      // 손상된 저장본은 순서를 판단할 수 없다.
    }
  }
  try {
    storage.setItem('mini-react-full', JSON.stringify({ ...state, sequence }));
    return 'full';
  } catch {
    try {
      storage.setItem('mini-react-draft', JSON.stringify({ draft: state.draft, sequence }));
      return 'draft';
    } catch {
      return 'failed';
    }
  }
}

export function readTemporaryState(storage) {
  const candidates = [];
  const corruptedKeys = [];
  let found = false;
  for (const [key, kind] of [['mini-react-full', 'full'], ['mini-react-draft', 'draft']]) {
    const raw = storage.getItem(key);
    if (raw === null) {
      continue;
    }
    found = true;
    try {
      const state = JSON.parse(raw);
      if (state && typeof state.draft === 'string') {
        candidates.push({ kind, state });
      } else {
        corruptedKeys.push(key);
      }
    } catch {
      corruptedKeys.push(key);
    }
  }
  candidates.sort((a, b) => (b.state.sequence || 0) - (a.state.sequence || 0));
  return candidates[0] ? { ...candidates[0], corruptedKeys } : (found ? { kind: 'corrupted', corruptedKeys } : null);
}

export function clearTemporaryState(storage) {
  let cleared = true;
  for (const key of ['mini-react-full', 'mini-react-draft']) {
    try {
      storage.removeItem(key);
    } catch {
      cleared = false;
    }
  }
  return cleared;
}
