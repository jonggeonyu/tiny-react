const INDENT = '  ';

function replaceSelection(editor, start, end, replacement, selectionStart, selectionEnd, direction) {
  editor.setSelectionRange(start, end);
  // 브라우저의 편집 이력에 한 번의 동작으로 기록해 기본 실행 취소를 유지한다.
  if (!document.execCommand('insertText', false, replacement)) {
    editor.setRangeText(replacement, start, end, 'end');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
  editor.setSelectionRange(selectionStart, selectionEnd, direction);
}

function indentLines(editor, outdent) {
  const { value, selectionStart, selectionEnd, selectionDirection } = editor;
  if (!outdent && selectionStart === selectionEnd) {
    replaceSelection(editor, selectionStart, selectionEnd, INDENT, selectionStart + INDENT.length, selectionStart + INDENT.length, selectionDirection);
    return;
  }

  const start = selectionStart === 0 ? 0 : value.lastIndexOf('\n', selectionStart - 1) + 1;
  const lastSelected = selectionEnd > selectionStart && value[selectionEnd - 1] === '\n' ? selectionEnd - 1 : selectionEnd;
  const nextNewline = value.indexOf('\n', lastSelected);
  const end = nextNewline === -1 ? value.length : nextNewline;
  const lines = value.slice(start, end).split('\n');
  let offset = 0;
  let newStart = selectionStart;
  let newEnd = selectionEnd;
  const changed = lines.map((line) => {
    const lineStart = start + offset;
    offset += line.length + 1;
    const removed = outdent ? (line.startsWith('\t') ? 1 : (line.match(/^ {1,2}/)?.[0].length || 0)) : 0;
    const delta = outdent ? -removed : INDENT.length;
    if (lineStart <= selectionStart) {
      newStart += outdent ? -Math.min(removed, selectionStart - lineStart) : delta;
    }
    if (lineStart < selectionEnd || selectionStart === selectionEnd) {
      newEnd += outdent ? -Math.min(removed, selectionEnd - lineStart) : delta;
    }
    return outdent ? line.slice(removed) : INDENT + line;
  }).join('\n');
  if (changed !== value.slice(start, end)) {
    replaceSelection(editor, start, end, changed, newStart, newEnd, selectionDirection);
  }
}

export function setupEditorKeys(editor) {
  let allowFocusMove = false;
  editor.addEventListener('blur', () => {
    allowFocusMove = false;
  });
  editor.addEventListener('keydown', (event) => {
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    if (event.key === 'Escape') {
      allowFocusMove = true;
      return;
    }
    if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta') {
      return;
    }
    if (event.key === 'Tab' && allowFocusMove) {
      allowFocusMove = false;
      return;
    }
    allowFocusMove = false;
    if (editor.readOnly || editor.disabled || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      indentLines(editor, event.shiftKey);
    } else if (event.key === 'Enter' && !event.shiftKey) {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const lineStart = start === 0 ? 0 : editor.value.lastIndexOf('\n', start - 1) + 1;
      const indentation = editor.value.slice(lineStart, start).match(/^[ \t]*/)[0];
      if (indentation) {
        event.preventDefault();
        const replacement = `\n${indentation}`;
        replaceSelection(editor, start, end, replacement, start + replacement.length, start + replacement.length, 'none');
      }
    }
  });
}
