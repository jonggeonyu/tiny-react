export function createErrorNotices(container) {
  const persistent = new Map();

  function showPersistent(key, message) {
    if (persistent.has(key)) {
      return;
    }
    const notice = document.createElement('p');
    notice.dataset.persistent = key;
    notice.textContent = message;
    persistent.set(key, notice);
    container.append(notice);
  }

  function removePersistent(key) {
    persistent.get(key)?.remove();
    persistent.delete(key);
  }

  function showTemporary(message) {
    const notice = document.createElement('div');
    const text = document.createElement('span');
    const close = document.createElement('button');
    text.textContent = message;
    close.type = 'button';
    close.textContent = '닫기';
    close.addEventListener('click', () => notice.remove());
    notice.append(text, close);
    container.append(notice);
  }

  function messageOf(error) {
    try {
      return String(error?.message ?? error);
    } catch {
      return '오류 내용을 표시할 수 없습니다.';
    }
  }

  function report(info) {
    if (info.recovery === 'failed') {
      showPersistent('recovery', '화면 복구에 실패했습니다. 새로고침이 필요합니다.');
    }
    if (info.reason === 'effect-blocked') {
      showPersistent('effect', '화면은 갱신됐지만 일부 작업을 실행하지 못했습니다. 새로고침이 필요합니다.');
    }
    if (info.reason === 'cleanup-unresolved' || info.reason === 'cleanup-failed') {
      removePersistent('recovery');
      showPersistent('cleanup', '화면은 제거됐지만 일부 작업을 정리하지 못했습니다. 새로고침이 필요합니다.');
    }
    for (const { error } of info.errors || []) {
      showTemporary(`문제가 발생했습니다: ${messageOf(error)}`);
    }
  }

  function afterUnmount(result) {
    if (result.committed) {
      removePersistent('recovery');
      if (!result.ok && (result.reason === 'cleanup-unresolved' || result.reason === 'cleanup-failed')) {
        showPersistent('cleanup', '화면은 제거됐지만 일부 작업을 정리하지 못했습니다. 새로고침이 필요합니다.');
      }
    }
  }

  return { report, afterUnmount };
}
