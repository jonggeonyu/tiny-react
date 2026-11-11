export function getNodeKey(node) {
  if (node?.type !== 'element' || !Object.hasOwn(node.attributes || {}, 'data-key')) {
    return null;
  }
  const key = node.attributes['data-key'];
  if (typeof key !== 'string' || key.trim() === '') {
    throw new Error('data-key는 비어 있지 않은 문자열이어야 합니다.');
  }
  return key;
}

export function validateSiblingKeys(root) {
  function visit(node) {
    if (!node) {
      return;
    }
    const keys = new Set();
    for (const child of node.children || []) {
      const key = getNodeKey(child);
      if (key !== null) {
        if (keys.has(key)) {
          throw new Error(`같은 부모의 data-key가 중복되었습니다: ${key}`);
        }
        keys.add(key);
      }
      visit(child);
    }
  }
  visit(root);
}

// 서식용 공백만 있는 텍스트는 절대 위치로 대응하면 key 항목의 삽입·삭제 때 모든 공백이 어긋나
// key 항목까지 고정 경계에 묶인다. 그래서 바로 앞 key 항목을 기준으로 한 순번으로 대응한다.
const formattingWhitespace = /^[ \t\n\f\r]*$/;

// 공백 순서 비교는 양쪽 공백 수의 곱만큼 계산하므로, 매우 긴 목록에서는 순번 대응만 사용한다.
const maxWhitespaceSequenceCells = 1_000_000;

export function isFormattingWhitespace(node) {
  return node?.type === 'text' && typeof node.text === 'string' && formattingWhitespace.test(node.text);
}

// 기준 key는 바로 앞 key(previous)나 바로 뒤 key(following)로 정한다. 뒤 key 기준은 항목을 옮길 때
// 앞 들여쓰기가 항목과 함께 이동하는 순환 이동을 순서 그대로 대응시키기 위해 쓴다.
function describeWhitespaceSlots(children, direction = 'previous') {
  let anchor = null;
  let offset = 0;
  const ordered = direction === 'previous' ? children : [...children].reverse();
  const slots = ordered.map((child) => {
    const key = getNodeKey(child);
    if (key !== null) {
      anchor = key;
      offset = 0;
      return null;
    }
    if (!isFormattingWhitespace(child)) {
      return null;
    }
    const slot = { id: JSON.stringify([anchor, offset]), anchor };
    offset += 1;
    return slot;
  });
  return direction === 'previous' ? slots : slots.reverse();
}

function matchByPosition(oldChildren, nextChildren) {
  return nextChildren.map((_, index) => (oldChildren[index] ? index : null));
}

function listWhitespaceIndexes(slots) {
  return slots.flatMap((slot, index) => (slot === null ? [] : [index]));
}

function matchWhitespaceBySlot(oldSlots, nextSlots, matches, used = new Set()) {
  const oldBySlot = new Map();
  oldSlots.forEach((slot, index) => {
    if (slot !== null && !used.has(index)) {
      oldBySlot.set(slot.id, index);
    }
  });
  nextSlots.forEach((slot, index) => {
    if (slot !== null && matches[index] === null) {
      matches[index] = oldBySlot.get(slot.id) ?? null;
    }
  });
  return matches;
}

// key 이동·삽입·삭제로 공백의 기준 key만 달라진 경우 공백 내용의 순서를 그대로 이어받아
// 불필요한 텍스트 변경을 피한다. 같은 내용끼리 순서를 지키며 가장 많이 대응시키고, 동률이면 같은 순번을 고른다.
function matchWhitespaceBySequence(oldChildren, nextChildren, oldSlots, nextSlots, baseMatches) {
  const oldIndexes = listWhitespaceIndexes(oldSlots);
  const nextIndexes = listWhitespaceIndexes(nextSlots);
  const columns = oldIndexes.length + 1;
  if (!oldIndexes.length || !nextIndexes.length || (nextIndexes.length + 1) * columns > maxWhitespaceSequenceCells) {
    return null;
  }
  const matchWeight = nextIndexes.length + 1;
  const scores = new Int32Array((nextIndexes.length + 1) * columns);
  function pairScore(row, column) {
    const nextIndex = nextIndexes[row];
    const oldIndex = oldIndexes[column];
    if (nextChildren[nextIndex].text !== oldChildren[oldIndex].text) {
      return -1;
    }
    const sameSlot = nextSlots[nextIndex].id === oldSlots[oldIndex].id ? 1 : 0;
    return scores[(row + 1) * columns + column + 1] + matchWeight + sameSlot;
  }
  for (let row = nextIndexes.length - 1; row >= 0; row -= 1) {
    for (let column = oldIndexes.length - 1; column >= 0; column -= 1) {
      const skipScore = Math.max(scores[(row + 1) * columns + column], scores[row * columns + column + 1]);
      scores[row * columns + column] = Math.max(skipScore, pairScore(row, column));
    }
  }
  const matches = [...baseMatches];
  const used = new Set();
  let row = 0;
  let column = 0;
  while (row < nextIndexes.length && column < oldIndexes.length) {
    const score = scores[row * columns + column];
    if (score === pairScore(row, column)) {
      matches[nextIndexes[row]] = oldIndexes[column];
      used.add(oldIndexes[column]);
      row += 1;
      column += 1;
    } else if (score === scores[(row + 1) * columns + column]) {
      row += 1;
    } else {
      column += 1;
    }
  }
  return matchWhitespaceBySlot(oldSlots, nextSlots, matches, used);
}

function describeMatchPlan(nextChildren, matches) {
  const entries = nextChildren.map((node, index) => ({
    oldIndex: matches[index],
    keyed: getNodeKey(node) !== null,
    movable: isFormattingWhitespace(node),
  }));
  return { matches, entries, stable: findStableChildren(entries) };
}

function findChangedKeys(oldChildren, nextChildren, plan) {
  const changed = new Set();
  const nextKeys = new Set();
  nextChildren.forEach((child, index) => {
    const key = getNodeKey(child);
    if (key === null) {
      return;
    }
    nextKeys.add(key);
    if (plan.matches[index] === null || !plan.stable.has(index)) {
      changed.add(key);
    }
  });
  oldChildren.forEach((child) => {
    const key = getNodeKey(child);
    if (key !== null && !nextKeys.has(key)) {
      changed.add(key);
    }
  });
  return changed;
}

// 앞뒤 기준 key가 모두 그대로인데 공백만 다른 자리로 옮겨 가면 그 변화가 변경 목록에 드러나지 않으므로 허용하지 않는다.
function explainsWhitespaceMoves(oldChildren, nextChildren, slots, plan) {
  const changedKeys = findChangedKeys(oldChildren, nextChildren, plan);
  return slots.next.previous.every((slot, index) => {
    const oldIndex = plan.matches[index];
    if (slot === null || oldIndex === null) {
      return true;
    }
    const pairs = [
      [slot, slots.old.previous[oldIndex]],
      [slots.next.following[index], slots.old.following[oldIndex]],
    ];
    return pairs.some(([nextSlot, oldSlot]) => nextSlot.id === oldSlot.id)
      || pairs.some(([nextSlot, oldSlot]) => changedKeys.has(nextSlot.anchor) || changedKeys.has(oldSlot.anchor));
  });
}

// 두 대응 방식은 공백 처리만 다르므로 공백 추가·삭제·텍스트 변경과 key 이동, 실제 노드 이동 수만 비교한다.
function measureMatchPlan(oldChildren, nextChildren, oldSlots, plan) {
  const used = new Set(plan.matches.filter((index) => index !== null));
  let reported = oldSlots.filter((slot, index) => slot !== null && !used.has(index)).length;
  let moved = 0;
  plan.entries.forEach((entry, index) => {
    if (entry.oldIndex === null) {
      reported += entry.movable ? 1 : 0;
      return;
    }
    if (!plan.stable.has(index)) {
      moved += 1;
      reported += entry.keyed ? 1 : 0;
    }
    if (entry.movable && oldChildren[entry.oldIndex].text !== nextChildren[index].text) {
      reported += 1;
    }
  });
  return { reported, moved };
}

function isCheaperPlan(candidate, current) {
  return candidate.reported < current.reported || (candidate.reported === current.reported && candidate.moved < current.moved);
}

export function matchChildren(oldChildren, nextChildren) {
  const hasKeys = [...oldChildren, ...nextChildren].some((child) => getNodeKey(child) !== null);
  if (!hasKeys) {
    return matchByPosition(oldChildren, nextChildren);
  }
  const oldKeys = new Map();
  oldChildren.forEach((child, index) => {
    const key = getNodeKey(child);
    if (key !== null) {
      oldKeys.set(key, index);
    }
  });
  const oldSlots = describeWhitespaceSlots(oldChildren);
  const nextSlots = describeWhitespaceSlots(nextChildren);
  const slots = {
    old: { previous: oldSlots, following: describeWhitespaceSlots(oldChildren, 'following') },
    next: { previous: nextSlots, following: describeWhitespaceSlots(nextChildren, 'following') },
  };
  const baseMatches = nextChildren.map((child, index) => {
    const key = getNodeKey(child);
    if (key !== null) {
      return oldKeys.get(key) ?? null;
    }
    if (nextSlots[index] !== null) {
      return null;
    }
    const previous = oldChildren[index];
    return previous && getNodeKey(previous) === null && !isFormattingWhitespace(previous) ? index : null;
  });
  const slotMatches = matchWhitespaceBySlot(oldSlots, nextSlots, [...baseMatches]);
  const followingMatches = matchWhitespaceBySlot(slots.old.following, slots.next.following, [...baseMatches]);
  const alternatives = [
    matchWhitespaceBySequence(oldChildren, nextChildren, oldSlots, nextSlots, baseMatches),
    matchWhitespaceBySlot(oldSlots, nextSlots, followingMatches, new Set(followingMatches.filter((index) => index !== null))),
  ];
  // 바로 앞 key 기준 대응을 기본으로 두고, 다른 대응은 변경 수(같으면 노드 이동 수)가 더 적을 때만 채택한다.
  let best = { matches: slotMatches, cost: measureMatchPlan(oldChildren, nextChildren, oldSlots, describeMatchPlan(nextChildren, slotMatches)) };
  for (const matches of alternatives) {
    if (!matches) {
      continue;
    }
    const plan = describeMatchPlan(nextChildren, matches);
    if (!explainsWhitespaceMoves(oldChildren, nextChildren, slots, plan)) {
      continue;
    }
    const cost = measureMatchPlan(oldChildren, nextChildren, oldSlots, plan);
    if (isCheaperPlan(cost, best.cost)) {
      best = { matches, cost };
    }
  }
  return best.matches;
}

// 이동 가능한 항목 중 이전 순서를 유지하는 부분 수열을 고르되,
// key 항목을 하나라도 더 유지하는 쪽을 공백 텍스트 여러 개보다 우선한다.
function markIncreasingSegment(entries, start, end, lower, upper, stable) {
  const candidates = [];
  for (let index = start; index < end; index += 1) {
    const oldIndex = entries[index].oldIndex;
    if (oldIndex !== null && oldIndex > lower && oldIndex < upper) {
      candidates.push(index);
    }
  }
  if (!candidates.length) {
    return;
  }
  const keyedWeight = entries.length + 1;
  const size = candidates.reduce((largest, index) => Math.max(largest, entries[index].oldIndex), 0) + 1;
  const bestScores = new Array(size + 1).fill(0);
  const bestEntries = new Array(size + 1).fill(null);
  const scores = new Map();
  const previous = new Map();
  for (const index of candidates) {
    const oldIndex = entries[index].oldIndex;
    let bestScore = 0;
    let bestEntry = null;
    for (let position = oldIndex; position > 0; position -= position & -position) {
      if (bestScores[position] > bestScore) {
        bestScore = bestScores[position];
        bestEntry = bestEntries[position];
      }
    }
    const score = bestScore + (entries[index].keyed ? keyedWeight : 1);
    scores.set(index, score);
    if (bestEntry !== null) {
      previous.set(index, bestEntry);
    }
    for (let position = oldIndex + 1; position <= size; position += position & -position) {
      if (score > bestScores[position]) {
        bestScores[position] = score;
        bestEntries[position] = index;
      }
    }
  }
  let index = candidates.reduce((best, candidate) => (scores.get(candidate) > scores.get(best) ? candidate : best));
  while (index !== undefined) {
    stable.add(index);
    index = previous.get(index);
  }
}

export function findStableChildren(entries) {
  const stable = new Set();
  let start = 0;
  let lower = -1;
  for (let index = 0; index <= entries.length; index += 1) {
    const entry = entries[index];
    const movable = entry && (entry.keyed || entry.movable);
    const boundary = !entry || (entry.oldIndex !== null && !movable);
    if (!boundary) {
      continue;
    }
    const upper = entry ? entry.oldIndex : Infinity;
    markIncreasingSegment(entries, start, index, lower, upper, stable);
    if (entry) {
      stable.add(index);
      lower = entry.oldIndex;
      start = index + 1;
    }
  }
  return stable;
}
