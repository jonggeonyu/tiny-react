const MAX_SHOWN = 3;
const MAX_TEXT = 20;

/**
 * 노드가 텍스트 노드인지 확인한다.
 *
 * @private
 * @param {VNode} node 확인할 노드
 * @returns {boolean} 문자열이면 `true`
 */
function isText(node) {
  return typeof node === 'string';
}

/**
 * 긴 문자열을 20자까지만 남기고 `…`을 붙인다.
 *
 * @private
 * @param {string} value 줄일 문자열
 * @returns {string} 줄인 문자열
 */
function shorten(value) {
  const chars = Array.from(value);

  return chars.length > MAX_TEXT ? `${chars.slice(0, MAX_TEXT).join('')}…` : value;
}

/**
 * 변경 하나를 설명하는 문자열을 만든다.
 *
 * @private
 * @param {Change} change 설명할 변경
 * @returns {string} 설명
 */
function describeChange(change) {
  switch (change.kind) {
    case 'ADD':
      return isText(change.node) ? '텍스트 추가' : `<${change.node.type}> 추가`;
    case 'REMOVE':
      return '노드 삭제';
    case 'TEXT':
      return `텍스트 "${shorten(change.value)}"로 변경`;
    case 'REPLACE':
      return isText(change.node) ? '텍스트로 교체' : `<${change.node.type}>로 교체`;
    case 'PROPS':
      return [
        ...Object.keys(change.set ?? {}).map((name) => `${name} 변경`),
        ...(change.remove ?? []).map((name) => `${name} 삭제`),
      ].join(', ');
    default:
      return '';
  }
}

/**
 * 변경 목록을 한 줄 문자열로 바꾼다. 4개가 넘으면 앞의 3개 뒤에 `외 N개`를 붙인다.
 *
 * @param {Array<Change>} changes `diff`가 돌려준 변경 목록
 * @returns {string} 쉼표로 이은 설명
 */
export function describeChanges(changes) {
  const shown = changes.slice(0, changes.length > MAX_SHOWN + 1 ? MAX_SHOWN : changes.length);
  const parts = shown.map(describeChange);

  if (shown.length < changes.length) {
    parts.push(`외 ${changes.length - shown.length}개`);
  }

  return parts.join(', ');
}
