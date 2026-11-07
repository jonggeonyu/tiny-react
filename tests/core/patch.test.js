import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDom, removeProp, renderRoot, setProp } from '../../src/core/createDom.js';
import { diff } from '../../src/core/diff.js';
import { containerToVdom } from '../../src/core/domToVdom.js';
import { htmlToVdom } from '../../src/core/html.js';
import { patch } from '../../src/core/patch.js';

// 원래 동작은 그대로 두고, patch가 이 함수들을 거치는지만 기록한다.
vi.mock('../../src/core/createDom.js', { spy: true });

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

/** 루트를 그린 새 영역을 만든다. */
function renderedOf(root) {
  const container = document.createElement('div');
  renderRoot(container, root);
  return container;
}

/** `from`을 그린 영역에 `to`까지의 변경을 적용한 뒤 영역을 돌려준다. */
function patched(from, to) {
  const container = renderedOf(from);
  patch(container, diff(from, to));
  return container;
}

/** 영역 아래의 모든 노드를 앞에서부터 모은다. */
function nodesOf(node) {
  return [...node.childNodes].flatMap((child) => [child, ...nodesOf(child)]);
}

const INVALID_CHARACTER = expect.objectContaining({ name: 'InvalidCharacterError' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('patch', () => {
  describe('빈 변경 목록', () => {
    it('아무 노드도 바꾸지 않는다', () => {
      const container = renderedOf(rootOf('a', el('p', { id: 'x' }, ['b'])));
      const [text, paragraph] = container.childNodes;
      const html = container.innerHTML;

      patch(container, []);

      expect(container.innerHTML).toBe(html);
      expect(container.childNodes[0]).toBe(text);
      expect(container.childNodes[1]).toBe(paragraph);
    });

    it('빈 영역도 그대로 둔다', () => {
      const container = document.createElement('div');

      patch(container, []);

      expect(container.childNodes).toHaveLength(0);
    });
  });

  describe('ADD', () => {
    it('최상위 끝에 노드를 붙인다', () => {
      const container = renderedOf(rootOf('a'));

      patch(container, [{ kind: 'ADD', path: [1], node: el('b', {}, ['새 노드']) }]);

      expect(container.innerHTML).toBe('a<b>새 노드</b>');
    });

    it('빈 영역에 첫 노드를 붙인다', () => {
      const container = renderedOf(rootOf());

      patch(container, [{ kind: 'ADD', path: [0], node: el('p') }]);

      expect(container.innerHTML).toBe('<p></p>');
    });

    it('마지막 번호를 뺀 경로로 부모를 찾아 깊은 위치에 붙인다', () => {
      const container = renderedOf(rootOf('a', el('ul', {}, [el('li', {}, ['하나']), el('li', {}, ['둘'])])));

      patch(container, [{ kind: 'ADD', path: [1, 1, 1], node: el('b') }]);

      expect(container.innerHTML).toBe('a<ul><li>하나</li><li>둘<b></b></li></ul>');
    });

    it('자식이 없던 요소에 첫 자식을 붙인다', () => {
      const container = renderedOf(rootOf(el('p')));

      patch(container, [{ kind: 'ADD', path: [0, 0], node: '글자' }]);

      expect(container.innerHTML).toBe('<p>글자</p>');
    });

    it('createDom으로 만든 노드를 붙이므로 속성과 자식까지 들어간다', () => {
      const node = el('ul', { class: 'a' }, [el('li', { id: 'x' }, ['하나'])]);
      const container = renderedOf(rootOf());
      vi.clearAllMocks();

      patch(container, [{ kind: 'ADD', path: [0], node }]);

      expect(createDom).toHaveBeenCalledWith(node);
      expect(container.innerHTML).toBe('<ul class="a"><li id="x">하나</li></ul>');
    });

    it('빈 문자열도 텍스트 노드로 붙인다', () => {
      const container = renderedOf(rootOf(el('p')));

      patch(container, [{ kind: 'ADD', path: [1], node: '' }]);

      expect(container.childNodes).toHaveLength(2);
      expect(container.childNodes[1].nodeType).toBe(Node.TEXT_NODE);
    });
  });

  describe('REMOVE', () => {
    it('요소를 지운다', () => {
      const container = renderedOf(rootOf('a', el('b')));

      patch(container, [{ kind: 'REMOVE', path: [1] }]);

      expect(container.innerHTML).toBe('a');
    });

    it('텍스트 노드를 지운다', () => {
      const container = renderedOf(rootOf(el('b'), 'a'));

      patch(container, [{ kind: 'REMOVE', path: [1] }]);

      expect(container.innerHTML).toBe('<b></b>');
    });

    it('깊은 위치의 노드를 지운다', () => {
      const container = renderedOf(rootOf(el('p', {}, [el('b', {}, ['a', el('i')])])));

      patch(container, [{ kind: 'REMOVE', path: [0, 0, 1] }]);

      expect(container.innerHTML).toBe('<p><b>a</b></p>');
    });

    it('뒤에서부터 지우면 앞쪽 번호가 밀리지 않는다', () => {
      const container = renderedOf(rootOf(el('a'), el('b'), el('i')));

      patch(container, [
        { kind: 'REMOVE', path: [2] },
        { kind: 'REMOVE', path: [1] },
      ]);

      expect(container.innerHTML).toBe('<a></a>');
    });
  });

  describe('TEXT', () => {
    it('같은 텍스트 노드의 내용만 바꾼다', () => {
      const container = renderedOf(rootOf(el('p', {}, ['사과'])));
      const text = container.firstChild.firstChild;

      patch(container, [{ kind: 'TEXT', path: [0, 0], value: '배' }]);

      expect(container.firstChild.firstChild).toBe(text);
      expect(text.nodeValue).toBe('배');
    });

    it('빈 문자열로 바꿔도 텍스트 노드는 남는다', () => {
      const container = renderedOf(rootOf('사과', el('b')));

      patch(container, [{ kind: 'TEXT', path: [0], value: '' }]);

      expect(container.childNodes).toHaveLength(2);
      expect(container.childNodes[0].nodeValue).toBe('');
    });

    it('태그처럼 보이는 내용도 글자로 넣는다', () => {
      const container = renderedOf(rootOf('a'));

      patch(container, [{ kind: 'TEXT', path: [0], value: '<b>' }]);

      expect(container.childNodes).toHaveLength(1);
      expect(container.innerHTML).toBe('&lt;b&gt;');
    });
  });

  describe('REPLACE', () => {
    it('요소를 다른 요소로 바꾸고 자리를 유지한다', () => {
      const container = renderedOf(rootOf('a', el('b', {}, ['옛']), 'c'));

      patch(container, [{ kind: 'REPLACE', path: [1], node: el('i', { id: 'x' }, ['새']) }]);

      expect(container.innerHTML).toBe('a<i id="x">새</i>c');
    });

    it('텍스트를 요소로 바꾼다', () => {
      const container = renderedOf(rootOf(el('p', {}, ['a'])));

      patch(container, [{ kind: 'REPLACE', path: [0, 0], node: el('b') }]);

      expect(container.innerHTML).toBe('<p><b></b></p>');
    });

    it('요소를 텍스트로 바꾼다', () => {
      const container = renderedOf(rootOf(el('p', {}, [el('b')])));

      patch(container, [{ kind: 'REPLACE', path: [0, 0], node: 'a' }]);

      expect(container.innerHTML).toBe('<p>a</p>');
      expect(container.firstChild.firstChild.nodeType).toBe(Node.TEXT_NODE);
    });

    it('createDom으로 새 노드를 만든다', () => {
      const node = el('i');
      const container = renderedOf(rootOf(el('b')));
      vi.clearAllMocks();

      patch(container, [{ kind: 'REPLACE', path: [0], node }]);

      expect(createDom).toHaveBeenCalledWith(node);
    });
  });

  describe('PROPS', () => {
    it('속성을 추가하고, 값을 바꾸고, 지운다', () => {
      const container = renderedOf(rootOf(el('p', { id: 'a', class: 'old', title: 't' })));
      const paragraph = container.firstChild;

      patch(container, [{ kind: 'PROPS', path: [0], set: { class: 'new', lang: 'ko' }, remove: ['id'] }]);

      expect(containerToVdom(container)).toStrictEqual(rootOf(el('p', { class: 'new', title: 't', lang: 'ko' })));
      expect(container.firstChild).toBe(paragraph);
    });

    it('여러 속성을 한 번에 지운다', () => {
      const container = renderedOf(rootOf(el('p', { id: 'a', class: 'b', title: 'c', lang: 'ko' })));

      patch(container, [{ kind: 'PROPS', path: [0], set: {}, remove: ['id', 'class', 'title'] }]);

      expect(container.innerHTML).toBe('<p lang="ko"></p>');
    });

    it('깊은 위치의 요소에 적용한다', () => {
      const container = renderedOf(rootOf('a', el('ul', {}, [el('li'), el('li')])));

      patch(container, [{ kind: 'PROPS', path: [1, 1], set: { id: 'x' }, remove: [] }]);

      expect(container.innerHTML).toBe('a<ul><li></li><li id="x"></li></ul>');
    });

    it('자식은 건드리지 않는다', () => {
      const container = renderedOf(rootOf(el('p', { id: 'a' }, ['글자', el('b')])));
      const [text, bold] = container.firstChild.childNodes;

      patch(container, [{ kind: 'PROPS', path: [0], set: { id: 'b' }, remove: [] }]);

      expect(container.firstChild.id).toBe('b');
      expect(container.firstChild.childNodes[0]).toBe(text);
      expect(container.firstChild.childNodes[1]).toBe(bold);
    });

    it('빈 문자열 값도 속성으로 넣는다', () => {
      const container = renderedOf(rootOf(el('input')));

      patch(container, [{ kind: 'PROPS', path: [0], set: { disabled: '' }, remove: [] }]);

      expect(container.firstChild.hasAttribute('disabled')).toBe(true);
    });

    it("{ a: '1' }이 { A: '1' }로 바뀌어도 속성이 사라지지 않는다", () => {
      const container = patched(rootOf(el('p', { a: '1' })), rootOf(el('p', { A: '1' })));

      // HTML 속성 이름은 소문자로 저장되므로 A가 아니라 a로 읽힌다.
      expect(container.firstChild.getAttribute('a')).toBe('1');
    });

    it('대소문자만 다른 이름의 값이 바뀌면 새 값이 남는다', () => {
      const container = patched(rootOf(el('p', { a: '1' })), rootOf(el('p', { A: '2' })));

      expect(container.firstChild.getAttribute('a')).toBe('2');
    });

    it('setProp으로 속성을 넣는다', () => {
      const container = renderedOf(rootOf(el('p')));
      vi.clearAllMocks();

      patch(container, [{ kind: 'PROPS', path: [0], set: { class: 'b' }, remove: [] }]);

      expect(setProp).toHaveBeenCalledExactlyOnceWith(container.firstChild, 'class', 'b');
    });

    it('removeProp으로 속성을 지운다', () => {
      const container = renderedOf(rootOf(el('p', { id: 'a' })));
      vi.clearAllMocks();

      patch(container, [{ kind: 'PROPS', path: [0], set: {}, remove: ['id'] }]);

      expect(removeProp).toHaveBeenCalledExactlyOnceWith(container.firstChild, 'id');
      expect(setProp).not.toHaveBeenCalled();
    });

    it('remove를 set보다 먼저 적용한다', () => {
      const container = renderedOf(rootOf(el('p', { a: '1' })));
      vi.clearAllMocks();

      patch(container, [{ kind: 'PROPS', path: [0], set: { A: '1' }, remove: ['a'] }]);

      expect(removeProp.mock.invocationCallOrder[0]).toBeLessThan(setProp.mock.invocationCallOrder[0]);
    });

    it("remove: ['onClick']을 적용하면 클릭해도 실행되지 않는다", () => {
      const handler = vi.fn();
      const container = renderedOf(rootOf(el('button', { onClick: handler })));

      patch(container, [{ kind: 'PROPS', path: [0], set: {}, remove: ['onClick'] }]);
      container.firstChild.click();

      expect(handler).not.toHaveBeenCalled();
    });

    it('핸들러가 새 함수로 바뀌면 같은 요소에서 새 함수만 실행된다', () => {
      const oldHandler = vi.fn();
      const newHandler = vi.fn();
      const from = rootOf(el('button', { onClick: oldHandler }));
      const to = rootOf(el('button', { onClick: newHandler }));
      const container = renderedOf(from);
      const button = container.firstChild;

      patch(container, diff(from, to));
      container.firstChild.click();

      expect(container.firstChild).toBe(button);
      expect(oldHandler).not.toHaveBeenCalled();
      expect(newHandler).toHaveBeenCalledOnce();
    });

    it('input의 value 속성이 사라지면 입력한 값도 비워진다', () => {
      const from = rootOf(el('input', { value: '사과' }));
      const container = renderedOf(from);
      container.firstChild.value = '입력한 값';

      patch(container, diff(from, rootOf(el('input'))));

      expect(container.firstChild.value).toBe('');
      expect(container.innerHTML).toBe('<input>');
    });

    it('checkbox의 value 속성이 사라지면 새 Virtual DOM과 일치한다', () => {
      const from = rootOf(el('input', { type: 'checkbox', value: '사과' }));
      const to = rootOf(el('input', { type: 'checkbox' }));

      const container = patched(from, to);

      expect(containerToVdom(container)).toStrictEqual(to);
      expect(container.firstChild.value).toBe('on');
    });

    it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])('내장 이름 속성 %s를 추가하고 지운다', (name) => {
      const without = rootOf(el('p'));
      const withProp = rootOf(el('p', propOf(name, 'x')));

      const added = patched(without, withProp);
      const removed = patched(withProp, without);

      expect(added.firstChild.getAttribute(name)).toBe('x');
      expect(removed.firstChild.hasAttribute(name)).toBe(false);
    });
  });

  describe('적용 순서', () => {
    it('받은 순서대로 적용한다', () => {
      const container = renderedOf(rootOf('a'));

      patch(container, [
        { kind: 'TEXT', path: [0], value: '먼저' },
        { kind: 'TEXT', path: [0], value: '나중' },
      ]);

      expect(container.innerHTML).toBe('나중');
    });

    it('변경 목록과 노드를 고치지 않는다', () => {
      const changes = [
        { kind: 'ADD', path: [1], node: el('b', { id: 'x' }, ['a']) },
        { kind: 'PROPS', path: [0], set: { class: 'a' }, remove: ['id'] },
      ];
      const before = structuredClone(changes);

      patch(renderedOf(rootOf(el('p', { id: 'y' }))), changes);

      expect(changes).toStrictEqual(before);
    });
  });

  describe('변경된 부분만 반영', () => {
    it('깊은 텍스트 하나를 바꾸면 모든 DOM 객체가 그대로 남는다', () => {
      const from = rootOf(el('p', { id: 'a' }, ['글자']), el('ul', {}, [el('li', {}, ['하나']), el('li', {}, ['둘'])]), 'c');
      const to = rootOf(el('p', { id: 'a' }, ['글자']), el('ul', {}, [el('li', {}, ['하나']), el('li', {}, ['셋'])]), 'c');
      const container = renderedOf(from);
      const before = nodesOf(container);

      patch(container, diff(from, to));

      const after = nodesOf(container);
      expect(after).toHaveLength(before.length);
      after.forEach((node, index) => expect(node).toBe(before[index]));
      expect(containerToVdom(container)).toStrictEqual(to);
    });

    it('속성만 바뀌면 모든 DOM 객체가 그대로 남는다', () => {
      const from = rootOf(el('p', { id: 'a' }, ['글자', el('b', {}, ['c'])]));
      const to = rootOf(el('p', { id: 'z' }, ['글자', el('b', { class: 'k' }, ['c'])]));
      const container = renderedOf(from);
      const before = nodesOf(container);

      patch(container, diff(from, to));

      const after = nodesOf(container);
      expect(after).toHaveLength(before.length);
      after.forEach((node, index) => expect(node).toBe(before[index]));
      expect(containerToVdom(container)).toStrictEqual(to);
    });

    it('교체는 그 노드만 새 객체로 바꾸고 형제와 부모는 남긴다', () => {
      const from = rootOf(el('ul', {}, [el('li', {}, ['하나']), el('li', {}, ['둘']), el('li', {}, ['셋'])]));
      const to = rootOf(el('ul', {}, [el('li', {}, ['하나']), el('p', {}, ['둘']), el('li', {}, ['셋'])]));
      const container = renderedOf(from);
      const list = container.firstChild;
      const [first, second, third] = list.childNodes;

      patch(container, diff(from, to));

      expect(container.firstChild).toBe(list);
      expect(list.childNodes[0]).toBe(first);
      expect(list.childNodes[1]).not.toBe(second);
      expect(list.childNodes[2]).toBe(third);
    });

    it('추가와 삭제는 기존 형제를 다시 만들지 않는다', () => {
      const short = rootOf(el('p', {}, ['a']), el('b'));
      const long = rootOf(el('p', {}, ['a']), el('b'), el('i'), 'c');
      const container = renderedOf(short);
      const [paragraph, bold] = container.childNodes;

      patch(container, diff(short, long));
      expect(container.childNodes).toHaveLength(4);
      expect(container.childNodes[0]).toBe(paragraph);
      expect(container.childNodes[1]).toBe(bold);

      patch(container, diff(long, short));
      expect(container.childNodes).toHaveLength(2);
      expect(container.childNodes[0]).toBe(paragraph);
      expect(container.childNodes[1]).toBe(bold);
    });

    describe('변경 대상을 뺀 나머지 노드 전체가 같은 DOM 객체로 남는다', () => {
      /** 바뀌는 자리의 형제와 부모의 형제가 모두 하위 노드를 가진 루트를 만든다. 대상은 `main`의 두 번째 자식부터 온다. */
      function sceneOf(...mainChildren) {
        return rootOf(
          el('header', {}, [el('h1', {}, ['제목', el('small', {}, ['부제'])])]),
          el('main', {}, [el('div', {}, [el('b', {}, ['앞 형제'])]), ...mainChildren]),
          el('footer', {}, [el('p', {}, [el('i', {}, ['꼬리'])])]),
        );
      }

      const nextSibling = el('div', {}, [el('i', {}, ['뒤 형제'])]);
      const oldNode = el('em', {}, ['옛']);
      const newNode = el('strong', {}, ['새']);

      // goneIndex는 사라지는 노드의 main 안 번호이고, addedCount는 새로 생기는 노드 수이다.
      it.each([
        { kind: 'ADD', from: sceneOf(nextSibling), to: sceneOf(nextSibling, newNode), goneIndex: null, addedCount: 2 },
        { kind: 'REMOVE', from: sceneOf(nextSibling, oldNode), to: sceneOf(nextSibling), goneIndex: 2, addedCount: 0 },
        { kind: 'REPLACE', from: sceneOf(oldNode, nextSibling), to: sceneOf(newNode, nextSibling), goneIndex: 1, addedCount: 2 },
        { kind: 'TEXT', from: sceneOf('옛', nextSibling), to: sceneOf('새', nextSibling), goneIndex: null, addedCount: 0 },
      ])('$kind', ({ kind, from, to, goneIndex, addedCount }) => {
        const changes = diff(from, to);
        const container = renderedOf(from);
        const gone = goneIndex === null ? null : container.childNodes[1].childNodes[goneIndex];
        const goneNodes = gone === null ? [] : [gone, ...nodesOf(gone)];
        const kept = nodesOf(container).filter((node) => !goneNodes.includes(node));

        patch(container, changes);

        const after = nodesOf(container);
        const remaining = after.filter((node) => kept.includes(node));
        expect(changes.map((change) => change.kind)).toStrictEqual([kind]);
        expect(remaining).toHaveLength(kept.length);
        remaining.forEach((node, index) => expect(node).toBe(kept[index]));
        expect(after).toHaveLength(kept.length + addedCount);
        expect(containerToVdom(container)).toStrictEqual(to);
      });
    });

    it('영역 요소 자체는 바뀌지 않는다', () => {
      const container = renderedOf(rootOf('a'));
      container.id = 'real';

      patch(container, diff(rootOf('a'), rootOf(el('b'), 'c')));

      expect(container.innerHTML).toBe('<b></b>c');
      expect(container.id).toBe('real');
      expect(container.tagName).toBe('DIV');
    });
  });

  describe('Patch 결과와 새 Virtual DOM의 일치', () => {
    const vdomPairs = [
      ['텍스트 변경', rootOf('사과'), rootOf('배')],
      ['속성 변경', rootOf(el('p', { id: 'a', class: 'x' })), rootOf(el('p', { class: 'y', lang: 'ko' }))],
      ['노드 교체', rootOf(el('b', {}, ['a'])), rootOf(el('i', { id: 'x' }, ['a']))],
      ['최상위 자식 모두 삭제', rootOf('a', el('p', {}, ['b']), 'c', el('ul', {}, [el('li')])), rootOf()],
      ['요소의 자식 모두 삭제', rootOf(el('ul', {}, [el('li'), 'a', el('li')])), rootOf(el('ul'))],
      [
        '텍스트와 요소 교체, 자식 수 변화, 속성 변경이 한 번에 일어나는 입력',
        rootOf(
          '머리',
          el('ul', { class: 'a', id: 'list' }, [el('li', {}, ['하나']), el('li', { id: 'x' }, ['둘']), el('li', {}, ['셋'])]),
          el('p', {}, ['문단']),
          '꼬리',
        ),
        rootOf(
          el('h1', { class: 'title' }, ['머리']),
          el('ul', { class: 'b', title: 't' }, ['하나', el('li', { id: 'y' }, [el('em', {}, ['둘']), '끝'])]),
          '문단',
          el('b'),
          '꼬리 뒤',
          el('i', {}, ['새 노드']),
        ),
      ],
      [
        '앞쪽 교체와 뒤쪽 추가와 삭제가 여러 깊이에서 일어나는 입력',
        rootOf(
          el('section', { id: 's' }, [
            'a',
            el('div', {}, [el('span', {}, ['b']), 'c', el('span')]),
            el('div', { class: 'k' }, [el('p', {}, ['d', el('b')])]),
          ]),
          el('footer', {}, ['e']),
        ),
        rootOf(
          el('section', { id: 't', class: 'u' }, [
            el('i', {}, ['a']),
            el('div', {}, ['b', el('span', { lang: 'ko' }, ['c'])]),
            el('div', {}, [el('p', { id: 'p' }, ['d!', el('b', {}, ['새']), 'f']), el('p')]),
            'g',
          ]),
        ),
      ],
      ['내장 이름 속성', rootOf(el('p', propOf('constructor', 'a'))), rootOf(el('p', propOf('__proto__', 'b')))],
    ];

    const htmlPairs = [
      [
        '표의 행과 칸',
        '<table><tbody><tr><td>a</td></tr></tbody></table>',
        '<table class="t"><tbody><tr><td>a</td><td>b</td></tr><tr><th>c</th></tr></tbody></table>',
      ],
      ['같은 줄 공백', '<b>a</b> <i>b</i>', '<b>a</b><i>b</i> c'],
      ['이스케이프', '<p title="&quot;a&quot;">a &lt; b</p>', '<p title="b">a &amp; b</p>'],
      ['주석과 들여쓰기', '<ul>\n  <!-- x -->\n  <li>a</li>\n  <li>b</li>\n</ul>', '<ul>\n  <li>a<!-- y -->b</li>\n</ul>\n<p>c</p>'],
      ['nbsp', '<p>&nbsp;</p>', '<p>a&nbsp;b</p>'],
      ['전체 비움', '<div><p>a</p></div>tail', ''],
    ].map(([name, from, to]) => [`HTML ${name}`, htmlToVdom(from), htmlToVdom(to)]);

    const pairs = [...vdomPairs, ...htmlPairs];

    it.each(pairs)('%s: 입력이 왕복되고 변경이 있다', (_, from, to) => {
      expect(containerToVdom(renderedOf(from))).toStrictEqual(from);
      expect(containerToVdom(renderedOf(to))).toStrictEqual(to);
      expect(diff(from, to).length).toBeGreaterThan(0);
    });

    it.each(pairs)('%s: 옛 → 새', (_, from, to) => {
      expect(containerToVdom(patched(from, to))).toStrictEqual(to);
    });

    it.each(pairs)('%s: 새 → 옛', (_, from, to) => {
      expect(containerToVdom(patched(to, from))).toStrictEqual(from);
    });

    it.each(pairs)('%s: 같은 영역에서 뒤로 갔다가 다시 앞으로 온다', (_, from, to) => {
      const container = renderedOf(from);

      patch(container, diff(from, to));
      patch(container, diff(to, from));
      expect(containerToVdom(container)).toStrictEqual(from);

      patch(container, diff(from, to));
      expect(containerToVdom(container)).toStrictEqual(to);
    });

    it('여러 상태를 차례로 지나고 되돌아와도 어긋나지 않는다', () => {
      const states = pairs.flatMap(([, from, to]) => [from, to]);
      const container = renderedOf(states[0]);

      for (const walk of [states, [...states].reverse()]) {
        walk.slice(1).forEach((state, index) => {
          patch(container, diff(walk[index], state));
          expect(containerToVdom(container)).toStrictEqual(state);
        });
      }
    });
  });

  describe('내용을 비웠다가 되돌리는 경우', () => {
    it('영역을 비운 뒤 되돌리면 이전 내용이 복원된다', () => {
      const from = htmlToVdom('<h1 id="t">제목</h1><ul><li>하나</li></ul>끝');
      const empty = htmlToVdom('');
      const container = renderedOf(from);

      patch(container, diff(from, empty));
      expect(container.childNodes).toHaveLength(0);

      patch(container, diff(empty, from));
      expect(containerToVdom(container)).toStrictEqual(from);
    });

    it('textarea 요소의 내용을 비운 뒤 되돌리면 값이 복원된다', () => {
      const from = htmlToVdom('<textarea>abc</textarea>');
      const empty = htmlToVdom('<textarea></textarea>');
      const container = renderedOf(from);

      patch(container, diff(from, empty));
      expect(container.firstChild.value).toBe('');

      patch(container, diff(empty, from));
      expect(container.firstChild.value).toBe('abc');
      expect(containerToVdom(container)).toStrictEqual(from);
    });
  });

  describe('오류', () => {
    it('만들 수 없는 태그의 ADD는 오류를 그대로 던진다', () => {
      const container = renderedOf(rootOf('a'));

      expect(() => patch(container, [{ kind: 'ADD', path: [1], node: el('1a') }])).toThrow(INVALID_CHARACTER);
      expect(container.innerHTML).toBe('a');
    });

    it('만들 수 없는 태그의 REPLACE는 기존 노드를 남긴다', () => {
      const container = renderedOf(rootOf(el('b', {}, ['a'])));

      expect(() => patch(container, [{ kind: 'REPLACE', path: [0], node: el('1a') }])).toThrow(INVALID_CHARACTER);
      expect(container.innerHTML).toBe('<b>a</b>');
    });

    it('넣을 수 없는 속성 이름은 오류를 그대로 던진다', () => {
      const container = renderedOf(rootOf(el('p')));

      expect(() => patch(container, [{ kind: 'PROPS', path: [0], set: { '': 'x' }, remove: [] }])).toThrow(INVALID_CHARACTER);
    });

    it('도중에 실패해도 renderRoot로 이전 Virtual DOM을 복구할 수 있다', () => {
      const from = rootOf(el('p', { id: 'a' }, ['옛']), 'b');
      const to = rootOf(el('p', { class: 'c' }, ['새']), el('1a'));
      const container = renderedOf(from);

      expect(() => patch(container, diff(from, to))).toThrow(INVALID_CHARACTER);
      expect(containerToVdom(container)).not.toStrictEqual(from);

      renderRoot(container, from);
      expect(containerToVdom(container)).toStrictEqual(from);
    });
  });
});
