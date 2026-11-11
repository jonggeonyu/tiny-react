export function serializeWithFormState(container) {
  const copy = container.cloneNode(true);
  const original = container.querySelectorAll('input, textarea, option');
  const copies = copy.querySelectorAll('input, textarea, option');
  original.forEach((node, index) => {
    const target = copies[index];
    if (node.localName === 'textarea') {
      target.textContent = node.value;
    } else if (node.localName === 'option') {
      target.toggleAttribute('selected', node.selected);
    } else if (node.type === 'checkbox' || node.type === 'radio') {
      target.toggleAttribute('checked', node.checked);
    } else {
      target.setAttribute('value', node.value);
    }
  });
  let marker = 'TEXTAREA_INITIAL_NEWLINE';
  while (copy.innerHTML.includes(marker)) {
    marker += '_';
  }
  for (const textarea of copy.querySelectorAll('textarea')) {
    if (textarea.firstChild?.data?.startsWith('\n')) {
      textarea.firstChild.data = marker + textarea.firstChild.data.slice(1);
    }
  }
  return copy.innerHTML.replaceAll(marker, '\n&#10;');
}

const resultSideNames = { old: '이전 결과 HTML', new: '새 결과 HTML' };

// 각 열은 하나의 HTML을 나타내므로, 보이는 이름과 보조 기술용 이름을 함께 붙이고 줄 번호도 그 열의 HTML 기준으로 표시한다.
function createDiffSide(side, name) {
  const column = document.createElement('div');
  column.dataset.diffSide = side;
  column.setAttribute('role', 'group');
  column.setAttribute('aria-label', name);
  const heading = document.createElement('p');
  heading.className = 'diff-side-name';
  heading.textContent = name;
  column.append(heading);
  return column;
}

export function renderHtmlDiff(region, before, after, state = 'saved', sideNames = resultSideNames) {
  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  const lengths = Array.from({ length: oldLines.length + 1 }, () => Array(newLines.length + 1).fill(0));
  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      lengths[i][j] = oldLines[i] === newLines[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const rows = [];
  let i = 0;
  let j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      rows.push({ kind: 'context', old: ++i, new: ++j, text: oldLines[i - 1] });
    } else if (i < oldLines.length && (j === newLines.length || lengths[i + 1][j] >= lengths[i][j + 1])) {
      rows.push({ kind: 'removed', old: ++i, text: oldLines[i - 1] });
    } else {
      rows.push({ kind: 'added', new: ++j, text: newLines[j - 1] });
    }
  }
  const blocks = [];
  for (let index = 0; index < rows.length;) {
    if (rows[index].kind === 'context') {
      index += 1;
      continue;
    }
    const start = index;
    while (index < rows.length && rows[index].kind !== 'context') {
      index += 1;
    }
    blocks.push(rows.slice(start, index));
  }
  const title = document.createElement('p');
  title.textContent = `${state === 'unapplied' ? '적용되지 않은 편집 · ' : ''}변경 구간 ${blocks.length}개 ` + blocks.map((block) => {
    const removed = block.filter((row) => row.kind === 'removed').length;
    const added = block.filter((row) => row.kind === 'added').length;
    if (removed === 1 && added === 1) {
      return '1줄 수정';
    }
    if (!removed) {
      return `${added}줄 추가`;
    }
    if (!added) {
      return `${removed}줄 삭제`;
    }
    return `이전 ${removed}줄 → 이후 ${added}줄`;
  }).join(', ');
  region.replaceChildren(title);
  region.dataset.diffState = state;
  for (const block of blocks) {
    const removed = block.filter((row) => row.kind === 'removed');
    const added = block.filter((row) => row.kind === 'added');
    if (removed.length === 1 && added.length === 1) {
      const a = removed[0].text;
      const b = added[0].text;
      let prefix = 0;
      let suffix = 0;
      while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
        prefix += 1;
      }
      while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) {
        suffix += 1;
      }
      removed[0].highlight = [prefix, a.length - suffix];
      added[0].highlight = [prefix, b.length - suffix];
    }
  }
  const columns = document.createElement('div');
  columns.className = 'diff-columns';
  const oldColumn = createDiffSide('old', sideNames.old);
  const newColumn = createDiffSide('new', sideNames.new);
  columns.append(oldColumn, newColumn);
  region.append(columns);
  rows.forEach((row, index) => {
    const line = document.createElement('div');
    line.dataset.diffLine = '';
    line.dataset.diff = row.kind;
    if (row.old) {
      line.dataset.oldLine = row.old;
    }
    if (row.new) {
      line.dataset.newLine = row.new;
    }
    if (row.highlight) {
      const [start, end] = row.highlight;
      const mark = document.createElement('mark');
      mark.dataset.diffHighlight = '';
      mark.textContent = row.text.slice(start, end);
      line.append(document.createTextNode(row.text.slice(0, start)), mark, document.createTextNode(row.text.slice(end)));
    } else {
      line.textContent = row.text;
    }
    if (row.kind === 'context' && !rows.slice(Math.max(0, index - 3), index + 4).some((item) => item.kind !== 'context')) {
      line.hidden = true;
      line.dataset.folded = '';
    }
    if (row.kind === 'context') {
      oldColumn.append(line);
      newColumn.append(line.cloneNode(true));
    } else if (row.kind === 'removed') {
      oldColumn.append(line);
    } else {
      newColumn.append(line);
    }
  });
  if (region.querySelector('[data-folded]')) {
    region.append(createFoldToggle(region));
  }
}

// 접기·펼치기는 표시만 바꾼다. 원문·이력·비교 결과와 변경 구간 수는 건드리지 않는다.
function createFoldToggle(region) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = 'diff-expand';
  showFoldState(button, false);
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    region.querySelectorAll('[data-folded]').forEach((line) => {
      line.hidden = !expanded;
    });
    showFoldState(button, expanded);
  });
  return button;
}

function showFoldState(button, expanded) {
  button.setAttribute('aria-expanded', String(expanded));
  button.textContent = expanded ? '생략한 줄 접기' : '생략한 줄 펼치기';
}
