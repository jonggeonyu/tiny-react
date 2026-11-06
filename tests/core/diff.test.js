import { describe, expect, it } from 'vitest';
import { renderRoot } from '../../src/core/createDom.js';
import { diff } from '../../src/core/diff.js';
import { containerToVdom } from '../../src/core/domToVdom.js';
import { htmlToVdom, vdomToHtml } from '../../src/core/html.js';

/** 요소 노드를 만든다. */
function el(type, props = {}, children = []) {
  return { type, props, children };
}

/** 주어진 자식들을 가진 루트 노드를 만든다. */
function rootOf(...children) {
  return el('root', {}, children);
}

/** 속성 하나를 가진 `props`를 만든다. 객체 리터럴의 `__proto__`는 속성이 되지 않으므로 `Object.fromEntries`를 쓴다. */
function propOf(name, value) {
  return Object.fromEntries([[name, value]]);
}

describe('diff', () => {
  describe('5가지 케이스', () => {
    it('자식이 늘면 노드 추가이다', () => {
      const node = el('b', {}, ['새 노드']);

      expect(diff(rootOf('a'), rootOf('a', node))).toStrictEqual([{ kind: 'ADD', path: [1], node }]);
    });

    it('자식이 줄면 노드 삭제이다', () => {
      expect(diff(rootOf('a', el('b')), rootOf('a'))).toStrictEqual([{ kind: 'REMOVE', path: [1] }]);
    });

    it('텍스트 내용이 다르면 텍스트 변경이다', () => {
      expect(diff(rootOf('사과'), rootOf('배'))).toStrictEqual([{ kind: 'TEXT', path: [0], value: '배' }]);
    });

    it('type이 다르면 노드 교체이다', () => {
      const node = el('i', {}, ['a']);

      expect(diff(rootOf(el('b', {}, ['a'])), rootOf(node))).toStrictEqual([{ kind: 'REPLACE', path: [0], node }]);
    });

    it('속성이 다르면 속성 변경이다', () => {
      const oldRoot = rootOf(el('p', { id: 'a', class: 'a', title: 't' }));
      const newRoot = rootOf(el('p', { class: 'b', title: 't' }));

      expect(diff(oldRoot, newRoot)).toStrictEqual([{ kind: 'PROPS', path: [0], set: { class: 'b' }, remove: ['id'] }]);
    });

    it('깊은 자식의 변경은 번호를 이은 path를 가진다', () => {
      const oldRoot = rootOf('a', el('ul', {}, [el('li', {}, ['하나']), el('li', {}, ['둘'])]));
      const newRoot = rootOf('a', el('ul', {}, [el('li', {}, ['하나']), el('li', {}, ['셋'])]));

      expect(diff(oldRoot, newRoot)).toStrictEqual([{ kind: 'TEXT', path: [1, 1, 0], value: '셋' }]);
    });

    it('최상위에서 호출하면 path는 빈 배열이다', () => {
      const node = el('p');

      expect(diff(undefined, node)).toStrictEqual([{ kind: 'ADD', path: [], node }]);
      expect(diff(node, undefined)).toStrictEqual([{ kind: 'REMOVE', path: [] }]);
      expect(diff('a', 'b')).toStrictEqual([{ kind: 'TEXT', path: [], value: 'b' }]);
      expect(diff('a', node)).toStrictEqual([{ kind: 'REPLACE', path: [], node }]);
      expect(diff(el('p', { id: 'a' }), el('p', { id: 'b' }))).toStrictEqual([
        { kind: 'PROPS', path: [], set: { id: 'b' }, remove: [] },
      ]);
    });

    it('공개 함수는 path를 인자로 받지 않는다', () => {
      expect(diff).toHaveLength(2);
    });
  });

  describe('판단 순서', () => {
    it('이전 노드가 없으면 새 노드의 종류와 상관없이 노드 추가이다', () => {
      expect(diff(undefined, 'a')).toStrictEqual([{ kind: 'ADD', path: [], node: 'a' }]);
      expect(diff(undefined, '')).toStrictEqual([{ kind: 'ADD', path: [], node: '' }]);
    });

    it('새 노드가 없으면 이전 노드의 종류와 상관없이 노드 삭제이다', () => {
      expect(diff('a', undefined)).toStrictEqual([{ kind: 'REMOVE', path: [] }]);
      expect(diff('', undefined)).toStrictEqual([{ kind: 'REMOVE', path: [] }]);
    });

    it('빈 문자열은 없는 노드가 아니라 텍스트이다', () => {
      expect(diff('', 'a')).toStrictEqual([{ kind: 'TEXT', path: [], value: 'a' }]);
      expect(diff('a', '')).toStrictEqual([{ kind: 'TEXT', path: [], value: '' }]);
      expect(diff('', '')).toStrictEqual([]);
    });

    it('자식의 빈 문자열도 텍스트로 비교한다', () => {
      expect(diff(rootOf(''), rootOf())).toStrictEqual([{ kind: 'REMOVE', path: [0] }]);
      expect(diff(rootOf(), rootOf(''))).toStrictEqual([{ kind: 'ADD', path: [0], node: '' }]);
      expect(diff(rootOf('', 'a'), rootOf('b', 'a'))).toStrictEqual([{ kind: 'TEXT', path: [0], value: 'b' }]);
      expect(diff(rootOf('a'), rootOf(''))).toStrictEqual([{ kind: 'TEXT', path: [0], value: '' }]);
    });

    it('빈 문자열과 요소는 노드 교체이다', () => {
      const node = el('p');

      expect(diff('', node)).toStrictEqual([{ kind: 'REPLACE', path: [], node }]);
      expect(diff(node, '')).toStrictEqual([{ kind: 'REPLACE', path: [], node: '' }]);
    });

    it('텍스트와 요소는 내용과 type이 같은 글자여도 노드 교체이다', () => {
      const node = el('p');

      expect(diff('p', node)).toStrictEqual([{ kind: 'REPLACE', path: [], node }]);
      expect(diff(node, 'p')).toStrictEqual([{ kind: 'REPLACE', path: [], node: 'p' }]);
    });

    it('노드 교체이면 속성이 달라도 속성 변경을 기록하지 않는다', () => {
      const node = el('i', { class: 'b' });

      expect(diff(el('b', { id: 'a' }), node)).toStrictEqual([{ kind: 'REPLACE', path: [], node }]);
    });
  });

  describe('변경 없음', () => {
    const root = rootOf(
      el('section', { id: 's', class: 'a b' }, [el('h1', {}, ['제목']), ' ', el('p', { hidden: '' }, ['본문'])]),
      '끝',
    );

    it('같은 객체를 비교하면 빈 목록이다', () => {
      expect(diff(root, root)).toStrictEqual([]);
    });

    it('내용이 같은 다른 객체를 비교하면 빈 목록이다', () => {
      expect(diff(root, structuredClone(root))).toStrictEqual([]);
    });

    it('빈 루트끼리 비교하면 빈 목록이다', () => {
      expect(diff(rootOf(), rootOf())).toStrictEqual([]);
    });

    it('속성의 순서만 다르면 빈 목록이다', () => {
      expect(diff(el('p', { id: 'a', class: 'b' }), el('p', { class: 'b', id: 'a' }))).toStrictEqual([]);
    });

    it('빈 값 속성이 그대로이면 빈 목록이다', () => {
      expect(diff(el('input', { disabled: '' }), el('input', { disabled: '' }))).toStrictEqual([]);
    });
  });

  describe('노드 교체 시 자식 미비교', () => {
    it('type이 다르면 자식이 달라도 항목은 하나이다', () => {
      const node = el('ol', {}, [el('li', {}, ['1']), el('li', {}, ['2']), el('li', {}, ['3'])]);
      const oldRoot = rootOf(el('ul', { id: 'a' }, [el('li', {}, ['x'])]));

      expect(diff(oldRoot, rootOf(node))).toStrictEqual([{ kind: 'REPLACE', path: [0], node }]);
    });

    it('텍스트가 요소로 바뀌면 새 요소의 자식은 node 안에만 있다', () => {
      const node = el('p', {}, ['a', el('b')]);

      expect(diff(rootOf('a'), rootOf(node))).toStrictEqual([{ kind: 'REPLACE', path: [0], node }]);
    });

    it('요소가 텍스트로 바뀌면 이전 자식의 삭제를 기록하지 않는다', () => {
      const oldRoot = rootOf(el('p', {}, ['a', el('b')]));

      expect(diff(oldRoot, rootOf('a'))).toStrictEqual([{ kind: 'REPLACE', path: [0], node: 'a' }]);
    });

    it('노드 추가와 노드 삭제도 자식을 따로 기록하지 않는다', () => {
      const node = el('p', {}, ['a', el('b')]);

      expect(diff(rootOf(), rootOf(node))).toStrictEqual([{ kind: 'ADD', path: [0], node }]);
      expect(diff(rootOf(node), rootOf())).toStrictEqual([{ kind: 'REMOVE', path: [0] }]);
    });
  });

  describe('속성 변경', () => {
    it('새로 생긴 속성은 set에만 들어간다', () => {
      expect(diff(el('p'), el('p', { id: 'a' }))).toStrictEqual([
        { kind: 'PROPS', path: [], set: { id: 'a' }, remove: [] },
      ]);
    });

    it('값이 바뀐 속성은 set에만 들어간다', () => {
      expect(diff(el('p', { id: 'a' }), el('p', { id: 'b' }))).toStrictEqual([
        { kind: 'PROPS', path: [], set: { id: 'b' }, remove: [] },
      ]);
    });

    it('사라진 속성은 remove에만 들어가고 set은 빈 객체이다', () => {
      expect(diff(el('p', { id: 'a' }), el('p'))).toStrictEqual([{ kind: 'PROPS', path: [], set: {}, remove: ['id'] }]);
    });

    it('빈 값으로 바뀌거나 빈 값에서 바뀌어도 속성 변경이다', () => {
      expect(diff(el('p', { title: 'a' }), el('p', { title: '' }))).toStrictEqual([
        { kind: 'PROPS', path: [], set: { title: '' }, remove: [] },
      ]);
      expect(diff(el('p', { title: '' }), el('p', { title: 'a' }))).toStrictEqual([
        { kind: 'PROPS', path: [], set: { title: 'a' }, remove: [] },
      ]);
    });

    it('빈 값 속성이 사라지면 remove에 들어간다', () => {
      expect(diff(el('input', { disabled: '' }), el('input'))).toStrictEqual([
        { kind: 'PROPS', path: [], set: {}, remove: ['disabled'] },
      ]);
    });

    it('여러 속성이 바뀌어도 노드 하나의 항목은 하나이다', () => {
      const oldNode = el('p', { a: '1', b: '2', c: '3', d: '4' });
      const newNode = el('p', { c: '3', d: 'x', e: '5', f: '6' });

      expect(diff(oldNode, newNode)).toStrictEqual([
        { kind: 'PROPS', path: [], set: { d: 'x', e: '5', f: '6' }, remove: ['a', 'b'] },
      ]);
    });

    it('이름의 대소문자가 다르면 다른 속성이다', () => {
      expect(diff(el('p', { a: '1' }), el('p', { A: '1' }))).toStrictEqual([
        { kind: 'PROPS', path: [], set: { A: '1' }, remove: ['a'] },
      ]);
    });
  });

  describe('내장 이름 속성', () => {
    const names = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'];

    /** 변경 목록이 `PROPS` 항목 하나이고, `set`이 주어진 이름과 값만 자기 속성으로 가지는지 확인한다. */
    function expectSetOnly(changes, name, value) {
      expect(changes).toHaveLength(1);

      const [{ kind, path, set, remove }] = changes;

      expect(kind).toBe('PROPS');
      expect(path).toStrictEqual([]);
      expect(Object.keys(set)).toStrictEqual([name]);
      expect(Object.getOwnPropertyDescriptor(set, name).value).toBe(value);
      expect(Object.getPrototypeOf(set)).toBe(Object.prototype);
      expect(remove).toStrictEqual([]);
    }

    it.each(names)('%s 속성이 새로 생기면 set에 자기 속성으로 들어간다', (name) => {
      expectSetOnly(diff(el('p'), el('p', propOf(name, 'x'))), name, 'x');
    });

    it.each(names)('%s 속성의 값이 바뀌면 set에 자기 속성으로 들어간다', (name) => {
      expectSetOnly(diff(el('p', propOf(name, 'x')), el('p', propOf(name, 'y'))), name, 'y');
    });

    it.each(names)('%s 속성이 사라지면 remove에 들어간다', (name) => {
      expect(diff(el('p', propOf(name, 'x')), el('p'))).toStrictEqual([
        { kind: 'PROPS', path: [], set: {}, remove: [name] },
      ]);
    });

    it.each(names)('%s 속성이 그대로이면 변경이 아니다', (name) => {
      expect(diff(el('p', propOf(name, 'x')), el('p', propOf(name, 'x')))).toStrictEqual([]);
    });

    it.each(names)('%s 속성과 다른 속성이 함께 바뀌어도 서로 영향이 없다', (name) => {
      const oldProps = Object.fromEntries([[name, 'x'], ['id', 'a']]);
      const newProps = Object.fromEntries([['class', 'b']]);

      expect(diff(el('p', oldProps), el('p', newProps))).toStrictEqual([
        { kind: 'PROPS', path: [], set: { class: 'b' }, remove: [name, 'id'] },
      ]);
    });

    it('HTML에서 읽은 __proto__와 constructor의 추가와 삭제를 찾는다', () => {
      const plain = htmlToVdom('<div></div>');
      const named = htmlToVdom('<div __proto__="p" constructor="c"></div>');

      const [added] = diff(plain, named);

      expect(Object.keys(added.set)).toStrictEqual(['__proto__', 'constructor']);
      expect(Object.getOwnPropertyDescriptor(added.set, '__proto__').value).toBe('p');
      expect(added.set.constructor).toBe('c');
      expect(diff(named, plain)).toStrictEqual([
        { kind: 'PROPS', path: [0], set: {}, remove: ['__proto__', 'constructor'] },
      ]);
    });

    it('Object.prototype을 오염시키지 않는다', () => {
      diff(el('p'), el('p', propOf('__proto__', 'x')));

      expect(Object.getPrototypeOf({})).toBe(Object.prototype);
      expect(Object.keys(Object.prototype)).toStrictEqual([]);
    });
  });

  describe('속성과 자식의 동시 변경', () => {
    it('속성이 바뀌어도 자식을 비교하고, 속성 변경을 먼저 기록한다', () => {
      const oldRoot = rootOf(el('p', { id: 'a' }, ['b']));
      const newRoot = rootOf(el('p', { id: 'c' }, ['d']));

      expect(diff(oldRoot, newRoot)).toStrictEqual([
        { kind: 'PROPS', path: [0], set: { id: 'c' }, remove: [] },
        { kind: 'TEXT', path: [0, 0], value: 'd' },
      ]);
    });

    it('속성이 그대로여도 자식을 비교한다', () => {
      const oldRoot = rootOf(el('p', { id: 'a' }, ['b']));
      const newRoot = rootOf(el('p', { id: 'a' }, ['c']));

      expect(diff(oldRoot, newRoot)).toStrictEqual([{ kind: 'TEXT', path: [0, 0], value: 'c' }]);
    });

    it('자식이 그대로이면 속성 변경만 기록한다', () => {
      const oldRoot = rootOf(el('p', { id: 'a' }, ['b', el('i')]));
      const newRoot = rootOf(el('p', { id: 'c' }, ['b', el('i')]));

      expect(diff(oldRoot, newRoot)).toStrictEqual([{ kind: 'PROPS', path: [0], set: { id: 'c' }, remove: [] }]);
    });

    it('부모와 자식의 속성이 함께 바뀌면 각자의 항목으로 기록한다', () => {
      const oldRoot = rootOf(el('ul', { class: 'a' }, [el('li', { id: 'x' })]));
      const newRoot = rootOf(el('ul', { class: 'b' }, [el('li')]));

      expect(diff(oldRoot, newRoot)).toStrictEqual([
        { kind: 'PROPS', path: [0], set: { class: 'b' }, remove: [] },
        { kind: 'PROPS', path: [0, 0], set: {}, remove: ['id'] },
      ]);
    });
  });

  describe('변경 목록 순서', () => {
    it('같은 번호가 있는 자식은 앞에서부터 기록한다', () => {
      expect(diff(rootOf('a', 'b', 'c'), rootOf('x', 'y', 'z'))).toStrictEqual([
        { kind: 'TEXT', path: [0], value: 'x' },
        { kind: 'TEXT', path: [1], value: 'y' },
        { kind: 'TEXT', path: [2], value: 'z' },
      ]);
    });

    it('남은 새 자식은 앞에서부터 ADD로 기록한다', () => {
      expect(diff(rootOf('a'), rootOf('a', 'b', 'c', 'd'))).toStrictEqual([
        { kind: 'ADD', path: [1], node: 'b' },
        { kind: 'ADD', path: [2], node: 'c' },
        { kind: 'ADD', path: [3], node: 'd' },
      ]);
    });

    it('남은 이전 자식은 뒤에서부터 REMOVE로 기록한다', () => {
      expect(diff(rootOf('a', 'b', 'c', 'd'), rootOf('a'))).toStrictEqual([
        { kind: 'REMOVE', path: [3] },
        { kind: 'REMOVE', path: [2] },
        { kind: 'REMOVE', path: [1] },
      ]);
    });

    it('자식이 모두 사라져도 뒤에서부터 기록한다', () => {
      expect(diff(rootOf('a', 'b'), rootOf())).toStrictEqual([
        { kind: 'REMOVE', path: [1] },
        { kind: 'REMOVE', path: [0] },
      ]);
    });

    it('같은 번호의 변경을 ADD보다 먼저 기록한다', () => {
      expect(diff(rootOf('a'), rootOf('x', 'b'))).toStrictEqual([
        { kind: 'TEXT', path: [0], value: 'x' },
        { kind: 'ADD', path: [1], node: 'b' },
      ]);
    });

    it('같은 번호의 변경을 REMOVE보다 먼저 기록한다', () => {
      expect(diff(rootOf('a', 'b', 'c'), rootOf('x'))).toStrictEqual([
        { kind: 'TEXT', path: [0], value: 'x' },
        { kind: 'REMOVE', path: [2] },
        { kind: 'REMOVE', path: [1] },
      ]);
    });

    it('앞의 자식 안쪽 변경을 뒤의 자식보다 먼저 기록한다', () => {
      const oldRoot = rootOf(el('p', {}, ['a', 'b']), 'c');
      const newRoot = rootOf(el('p', {}, ['x']), 'y');

      expect(diff(oldRoot, newRoot)).toStrictEqual([
        { kind: 'TEXT', path: [0, 0], value: 'x' },
        { kind: 'REMOVE', path: [0, 1] },
        { kind: 'TEXT', path: [1], value: 'y' },
      ]);
    });

    it('교체, 자식 수 변화, 속성 변경이 한 번에 일어나도 path가 맞다', () => {
      const replaced = el('b', {}, ['교체']);
      const oldRoot = rootOf(
        el('ul', { class: 'a' }, [el('li', {}, ['하나']), el('li', {}, ['둘']), el('li', {}, ['셋'])]),
        '사이',
        el('p', {}, ['본문', el('b', {}, ['굵게'])]),
        el('i', {}, ['삭제 1']),
        '삭제 2',
      );
      const newRoot = rootOf(
        el('ul', { class: 'b' }, [el('li', { id: 'x' }, ['1']), el('li', {}, ['둘'])]),
        replaced,
        el('p', {}, ['본문', el('b', {}, ['굵게']), '추가']),
      );

      expect(diff(oldRoot, newRoot)).toStrictEqual([
        { kind: 'PROPS', path: [0], set: { class: 'b' }, remove: [] },
        { kind: 'PROPS', path: [0, 0], set: { id: 'x' }, remove: [] },
        { kind: 'TEXT', path: [0, 0, 0], value: '1' },
        { kind: 'REMOVE', path: [0, 2] },
        { kind: 'REPLACE', path: [1], node: replaced },
        { kind: 'ADD', path: [2, 2], node: '추가' },
        { kind: 'REMOVE', path: [4] },
        { kind: 'REMOVE', path: [3] },
      ]);
    });

    it('중간 자식이 사라지면 번호대로 비교하므로 끝에서만 삭제된다', () => {
      const oldRoot = rootOf(el('li', {}, ['1']), el('li', {}, ['2']), el('li', {}, ['3']));
      const newRoot = rootOf(el('li', {}, ['1']), el('li', {}, ['3']));

      expect(diff(oldRoot, newRoot)).toStrictEqual([
        { kind: 'TEXT', path: [1, 0], value: '3' },
        { kind: 'REMOVE', path: [2] },
      ]);
    });
  });

  describe('입력과 결과', () => {
    /** 변경이 모두 나오는 입력 쌍을 만든다. */
    function changedPair() {
      return [
        rootOf(el('p', { id: 'a', title: 't' }, ['b', el('i')]), 'c', el('u'), el('s')),
        rootOf(el('p', { id: 'x', class: 'y' }, ['z', el('i'), 'w']), el('b'), el('u')),
      ];
    }

    it('입력을 고치지 않는다', () => {
      const [oldRoot, newRoot] = changedPair();
      const oldSnapshot = structuredClone(oldRoot);
      const newSnapshot = structuredClone(newRoot);

      diff(oldRoot, newRoot);

      expect(oldRoot).toStrictEqual(oldSnapshot);
      expect(newRoot).toStrictEqual(newSnapshot);
    });

    it('얼린 입력도 오류 없이 비교한다', () => {
      /** 노드를 자식과 속성까지 얼린다. */
      function deepFreeze(node) {
        if (typeof node === 'string') return node;

        Object.freeze(node.props);
        node.children.forEach(deepFreeze);
        Object.freeze(node.children);
        return Object.freeze(node);
      }

      const [oldRoot, newRoot] = changedPair();
      const expected = diff(...changedPair());

      expect(diff(deepFreeze(oldRoot), deepFreeze(newRoot))).toStrictEqual(expected);
    });

    it('ADD의 node는 새 Virtual DOM의 노드와 같은 객체이다', () => {
      const newNode = el('p', {}, ['a']);

      const [{ node }] = diff(rootOf(), rootOf(newNode));

      expect(node).toBe(newNode);
    });

    it('REPLACE의 node는 새 Virtual DOM의 노드와 같은 객체이다', () => {
      const newNode = el('p', {}, ['a']);

      const [{ node }] = diff(rootOf(el('b')), rootOf(newNode));

      expect(node).toBe(newNode);
    });

    it('set은 새 노드의 props와 다른 객체이다', () => {
      const newNode = el('p', { id: 'a' });

      const [{ set }] = diff(el('p'), newNode);

      expect(set).not.toBe(newNode.props);
    });

    it('항목의 path는 서로 다른 배열이다', () => {
      const paths = diff(...changedPair()).map(({ path }) => path);

      expect(new Set(paths).size).toBe(paths.length);
    });

    it('호출할 때마다 새 목록을 돌려준다', () => {
      const [oldRoot, newRoot] = changedPair();

      expect(diff(oldRoot, newRoot)).not.toBe(diff(oldRoot, newRoot));
      expect(diff(oldRoot, newRoot)).toStrictEqual(diff(oldRoot, newRoot));
    });
  });

  describe('큰 입력', () => {
    const children = Array.from({ length: 130000 }, (_, index) => (index % 2 === 0 ? 'a' : el('b')));
    const bigRoot = { type: 'root', props: {}, children };

    it('인자 펼침의 한계를 넘는 수의 자식을 추가한다', () => {
      const changes = diff(rootOf(), bigRoot);

      expect(changes).toHaveLength(130000);
      expect(changes[129999]).toStrictEqual({ kind: 'ADD', path: [129999], node: children[129999] });
    });

    it('인자 펼침의 한계를 넘는 수의 자식을 삭제한다', () => {
      const changes = diff(bigRoot, rootOf());

      expect(changes).toHaveLength(130000);
      expect(changes[0]).toStrictEqual({ kind: 'REMOVE', path: [129999] });
      expect(changes[129999]).toStrictEqual({ kind: 'REMOVE', path: [0] });
    });

    it('깊은 쪽의 변경 목록도 한 목록에 모은다', () => {
      const wrap = (root) => rootOf(el('div', {}, [root]));

      expect(diff(wrap(rootOf()), wrap(bigRoot))).toHaveLength(130000);
    });
  });

  describe('HTML 왕복 후 변경 없음', () => {
    it.each([
      [''],
      ['안녕'],
      ['<p>a'],
      ['<ul><li>1<li>2'],
      ['\n<div>\n  <!--x-->\n  <p>a</p> <b>c</b>\n</div>\n'],
      ['<b>a</b> <i>b</i>'],
      ['<tr><td>x'],
      ['<table><tr><td>x'],
      ['<p title="a&quot;b" class="c d" hidden>e</p>'],
      ['<p>a&nbsp;b &amp;amp; &lt;i&gt;</p>'],
      ['<p>a\u00A0b\u200B</p>\u00A0<p>\u200B</p>'],
      ['<input disabled><br><img src="/a.png" alt="">'],
      ['<div __proto__="p" constructor="c"></div>'],
      ['<div @click="x" 1a="y"></div>'],
    ])('고치지 않은 내용은 빈 목록이다: %j', (html) => {
      const root = htmlToVdom(html);

      expect(diff(root, htmlToVdom(vdomToHtml(root)))).toStrictEqual([]);
    });

    it('실제 영역에서 읽어 다시 그린 내용을 그대로 돌려보내면 빈 목록이다', () => {
      const area = document.createElement('div');
      area.innerHTML = `
        <!-- 샘플 -->
        <section id="s">
          <h1 class="t">제목</h1>
          <p>a<!--x-->b <b>c</b> <i>d</i></p>
        </section>
      `;

      const root = containerToVdom(area);
      renderRoot(area, root);

      expect(diff(root, containerToVdom(area))).toStrictEqual([]);
      expect(diff(root, htmlToVdom(vdomToHtml(root)))).toStrictEqual([]);
    });

    it('왕복 뒤에 고친 내용은 그 변경만 나온다', () => {
      const root = htmlToVdom('<ul id="l"><li>하나</li><li>둘</li></ul>');
      const edited = vdomToHtml(root).replace('둘', '셋');

      expect(diff(root, htmlToVdom(edited))).toStrictEqual([{ kind: 'TEXT', path: [0, 1, 0], value: '셋' }]);
    });

    it('내용을 모두 지우면 최상위 노드의 삭제가 나온다', () => {
      const root = htmlToVdom('<p>a</p>b');

      expect(diff(root, htmlToVdom(''))).toStrictEqual([
        { kind: 'REMOVE', path: [1] },
        { kind: 'REMOVE', path: [0] },
      ]);
    });
  });
});
