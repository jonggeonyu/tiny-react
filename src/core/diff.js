/**
 * 변경 목록의 항목 하나이다.
 * `kind`에 따라 `node`, `value`, `set`과 `remove` 중 필요한 것만 가진다.
 *
 * @typedef {object} Change
 * @property {'ADD' | 'REMOVE' | 'TEXT' | 'REPLACE' | 'PROPS'} kind 변경 종류
 * @property {Array<number>} path 루트에서 `childNodes` 번호를 따라가는 경로
 * @property {VNode} [node] `ADD`와 `REPLACE`에서 새로 넣을 노드
 * @property {string} [value] `TEXT`의 새 내용
 * @property {Object<string, string>} [set] `PROPS`에서 새로 생기거나 값이 바뀐 속성
 * @property {Array<string>} [remove] `PROPS`에서 사라진 속성의 이름
 */

/**
 * 같은 `type`인 두 요소의 속성을 비교해 바뀐 속성이 있으면 변경 목록에 넣는다.
 *
 * @private
 * @param {Object<string, string>} oldProps 이전 속성
 * @param {Object<string, string>} newProps 새 속성
 * @param {Array<number>} path 요소의 경로
 * @param {Array<Change>} changes 변경을 모으는 목록
 * @returns {void}
 */
function diffProps(oldProps, newProps, path, changes) {
  // set[name] = value로 넣으면 __proto__ 속성이 저장되지 않는다.
  const set = Object.fromEntries(
    Object.entries(newProps).filter(
      ([name, value]) => !Object.hasOwn(oldProps, name) || oldProps[name] !== value,
    ),
  );
  // in 연산자는 constructor 같은 내장 이름을 있다고 판단해서 삭제를 놓친다.
  const remove = Object.keys(oldProps).filter((name) => !Object.hasOwn(newProps, name));

  if (Object.keys(set).length > 0 || remove.length > 0) {
    changes.push({ kind: 'PROPS', path, set, remove });
  }
}

/**
 * 두 `children`을 같은 번호끼리 비교한다.
 * 새 자식을 앞에서부터 돌면 이전 자식이 없는 번호는 `ADD`가 되고, 남은 이전 자식은 뒤에서부터 `REMOVE`가 된다.
 *
 * @private
 * @param {Array<VNode>} oldChildren 이전 자식 목록
 * @param {Array<VNode>} newChildren 새 자식 목록
 * @param {Array<number>} path 부모의 경로
 * @param {Array<Change>} changes 변경을 모으는 목록
 * @returns {void}
 */
function diffChildren(oldChildren, newChildren, path, changes) {
  for (let index = 0; index < newChildren.length; index += 1) {
    diffNode(oldChildren[index], newChildren[index], [...path, index], changes);
  }

  for (let index = oldChildren.length - 1; index >= newChildren.length; index -= 1) {
    diffNode(oldChildren[index], undefined, [...path, index], changes);
  }
}

/**
 * 노드 하나를 비교해 변경을 목록에 넣고, 같은 `type`의 요소이면 자식까지 재귀로 비교한다.
 *
 * @private
 * @param {VNode | undefined} oldNode 이전 노드
 * @param {VNode | undefined} newNode 새 노드
 * @param {Array<number>} path 노드의 경로
 * @param {Array<Change>} changes 변경을 모으는 목록
 * @returns {void}
 */
function diffNode(oldNode, newNode, path, changes) {
  // 빈 문자열도 텍스트이므로 !oldNode로 판단하지 않는다.
  if (oldNode === undefined) {
    changes.push({ kind: 'ADD', path, node: newNode });
    return;
  }

  if (newNode === undefined) {
    changes.push({ kind: 'REMOVE', path });
    return;
  }

  const isOldText = typeof oldNode === 'string';
  const isNewText = typeof newNode === 'string';

  if (isOldText && isNewText) {
    if (oldNode !== newNode) {
      changes.push({ kind: 'TEXT', path, value: newNode });
    }
    return;
  }

  if (isOldText || isNewText || oldNode.type !== newNode.type) {
    changes.push({ kind: 'REPLACE', path, node: newNode });
    return;
  }

  diffProps(oldNode.props, newNode.props, path, changes);
  diffChildren(oldNode.children, newNode.children, path, changes);
}

/**
 * 두 Virtual DOM을 비교해 변경 목록을 돌려준다. 실제 DOM과 입력은 건드리지 않는다.
 * 자식은 번호로만 비교하므로 추가와 삭제는 항상 자식 목록의 끝에서 일어나고, 목록을 순서대로 적용하면 앞쪽 번호가 밀리지 않는다.
 * `ADD`와 `REPLACE`의 `node`는 새 Virtual DOM의 노드를 복사하지 않고 그대로 담는다.
 * 두 인자 중 적어도 하나는 있어야 한다. `diff(undefined, undefined)`는 지원하지 않는 입력이다.
 *
 * @param {VNode | undefined} oldVdom 이전 Virtual DOM. `undefined`이면 없는 노드이고, 이때 `newVdom`은 있어야 한다.
 * @param {VNode | undefined} newVdom 새 Virtual DOM. `undefined`이면 없는 노드이고, 이때 `oldVdom`은 있어야 한다.
 * @returns {Array<Change>} 변경 목록. 바뀐 내용이 없으면 빈 배열이다.
 * @throws {RangeError} 재귀로 비교하므로 아주 깊게 중첩되면 오류가 날 수 있다.
 */
export function diff(oldVdom, newVdom) {
  const changes = [];

  diffNode(oldVdom, newVdom, [], changes);

  return changes;
}
