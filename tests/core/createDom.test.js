import { describe, expect, it } from 'vitest';
import { createDom, renderRoot, setProp } from '../../src/core/createDom.js';
import { containerToVdom } from '../../src/core/domToVdom.js';

/** 요소 노드를 만든다. */
function el(type, props = {}, children = []) {
  return { type, props, children };
}

/** 주어진 자식들을 가진 루트 노드를 만든다. */
function rootOf(...children) {
  return el('root', {}, children);
}

/** HTML 문자열을 담은 임시 영역을 만든다. */
function containerOf(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

/** 루트를 빈 영역에 그린 뒤 다시 Virtual DOM으로 읽는다. */
function roundTrip(root) {
  const container = document.createElement('div');
  renderRoot(container, root);
  return containerToVdom(container);
}

describe('setProp', () => {
  it('이름과 값을 속성으로 넣는다', () => {
    const element = document.createElement('div');

    setProp(element, 'class', 'a b');

    expect(element.getAttribute('class')).toBe('a b');
  });

  it('이미 있는 속성의 값을 바꾼다', () => {
    const element = document.createElement('div');
    element.setAttribute('id', 'old');

    setProp(element, 'id', 'new');

    expect(element.getAttribute('id')).toBe('new');
    expect(element.attributes).toHaveLength(1);
  });

  it('빈 문자열 값도 속성으로 넣는다', () => {
    const element = document.createElement('input');

    setProp(element, 'disabled', '');

    expect(element.hasAttribute('disabled')).toBe(true);
    expect(element.getAttribute('disabled')).toBe('');
  });

  it('프로퍼티가 아닌 속성으로 넣는다', () => {
    const element = document.createElement('div');

    setProp(element, 'title', 't');
    setProp(element, 'data-x', '1');

    expect(element.getAttribute('title')).toBe('t');
    expect(element.getAttribute('data-x')).toBe('1');
    expect(Object.hasOwn(element, 'data-x')).toBe(false);
  });

  it.each(['__proto__', 'constructor'])('내장 이름 %s도 속성으로 넣는다', (name) => {
    const element = document.createElement('div');

    setProp(element, name, 'x');

    expect(element.getAttribute(name)).toBe('x');
  });
});

describe('createDom', () => {
  describe('텍스트', () => {
    it('문자열은 같은 내용의 텍스트 노드가 된다', () => {
      const node = createDom('안녕');

      expect(node.nodeType).toBe(Node.TEXT_NODE);
      expect(node.nodeValue).toBe('안녕');
    });

    it('빈 문자열도 텍스트 노드가 된다', () => {
      const node = createDom('');

      expect(node.nodeType).toBe(Node.TEXT_NODE);
      expect(node.nodeValue).toBe('');
    });

    it('문자열 안의 태그와 엔티티를 해석하지 않는다', () => {
      const node = createDom('<b>a</b> &lt;');

      expect(node.nodeType).toBe(Node.TEXT_NODE);
      expect(node.nodeValue).toBe('<b>a</b> &lt;');
    });

    it('공백과 줄바꿈과 보이지 않는 문자를 그대로 둔다', () => {
      expect(createDom('\n  a\u00A0b\u200B\n').nodeValue).toBe('\n  a\u00A0b\u200B\n');
    });
  });

  describe('요소', () => {
    it('type으로 요소를 만든다', () => {
      const node = createDom(el('section'));

      expect(node.nodeType).toBe(Node.ELEMENT_NODE);
      expect(node.tagName).toBe('SECTION');
      expect(node.attributes).toHaveLength(0);
      expect(node.childNodes).toHaveLength(0);
    });

    it('props를 모두 속성으로 넣는다', () => {
      const node = createDom(el('a', { href: '/x', class: 'b c', hidden: '' }));

      expect(node.getAttribute('href')).toBe('/x');
      expect(node.getAttribute('class')).toBe('b c');
      expect(node.getAttribute('hidden')).toBe('');
      expect(node.attributes).toHaveLength(3);
    });

    it('자식을 재귀로 만들어 순서대로 붙인다', () => {
      const node = createDom(el('ul', {}, [el('li', {}, ['하나']), '사이', el('li', {}, [el('b', {}, ['둘'])])]));

      expect(node.outerHTML).toBe('<ul><li>하나</li>사이<li><b>둘</b></li></ul>');
    });

    it('나란히 있는 문자열은 각각의 텍스트 노드가 된다', () => {
      const node = createDom(el('p', {}, ['a', 'b']));

      expect(Array.from(node.childNodes, ({ nodeValue }) => nodeValue)).toEqual(['a', 'b']);
    });

    it('children의 빈 문자열도 자식으로 유지한다', () => {
      const { childNodes } = createDom(el('p', {}, ['a', '', el('b')]));

      expect(childNodes).toHaveLength(3);
      expect(childNodes[1].nodeType).toBe(Node.TEXT_NODE);
      expect(childNodes[1].nodeValue).toBe('');
    });

    it('__proto__와 constructor 속성을 넣는다', () => {
      const props = Object.fromEntries([
        ['__proto__', 'p'],
        ['constructor', 'c'],
      ]);

      const node = createDom(el('div', props));

      expect(node.getAttribute('__proto__')).toBe('p');
      expect(node.getAttribute('constructor')).toBe('c');
      expect(node.attributes).toHaveLength(2);
    });

    it('입력을 고치지 않는다', () => {
      const vnode = el('div', { id: 'a' }, ['b', el('i', {}, ['c'])]);
      const snapshot = structuredClone(vnode);

      createDom(vnode);

      expect(vnode).toEqual(snapshot);
    });

    it('같은 입력으로 호출할 때마다 새 노드를 만든다', () => {
      const vnode = el('div', {}, ['a']);

      expect(createDom(vnode)).not.toBe(createDom(vnode));
    });
  });

  describe('잘못된 이름', () => {
    it('만들 수 없는 태그 이름은 오류를 낸다', () => {
      expect(() => createDom(el('1a'))).toThrow(expect.objectContaining({ name: 'InvalidCharacterError' }));
    });

    it('만들 수 없는 태그가 깊은 자식에 있어도 오류를 낸다', () => {
      const vnode = el('div', {}, [el('p', {}, [el('1a')])]);

      expect(() => createDom(vnode)).toThrow(expect.objectContaining({ name: 'InvalidCharacterError' }));
    });

    it.each(['=a', 'a b', 'a/b', 'a>b', ''])('넣을 수 없는 속성 이름 "%s"는 오류를 낸다', (name) => {
      const vnode = el('div', { [name]: 'x' });

      expect(() => createDom(vnode)).toThrow(expect.objectContaining({ name: 'InvalidCharacterError' }));
    });

    it.each(['@click', '1a', '"foo', 'a"b', 'a<b'])('파서가 받는 속성 이름 "%s"를 넣는다', (name) => {
      const node = createDom(el('div', { [name]: 'x' }));

      expect(node.getAttribute(name)).toBe('x');
    });
  });
});

describe('renderRoot', () => {
  describe('기존 내용 교체', () => {
    it('기존 내용을 지우고 새 내용으로 바꾼다', () => {
      const container = containerOf('<p>old</p>old<!--c-->');

      renderRoot(container, rootOf(el('b', {}, ['new'])));

      expect(container.innerHTML).toBe('<b>new</b>');
    });

    it('최상위 노드가 여러 개이면 순서대로 그린다', () => {
      const container = containerOf('old');

      renderRoot(container, rootOf(el('b', {}, ['1']), '2', el('i', {}, ['3'])));

      expect(container.innerHTML).toBe('<b>1</b>2<i>3</i>');
    });

    it('루트 자체는 요소로 그리지 않는다', () => {
      const container = document.createElement('div');

      renderRoot(container, rootOf('a'));

      expect(container.querySelector('root')).toBeNull();
      expect(container.innerHTML).toBe('a');
    });

    it('영역 자체의 태그와 속성은 그대로 둔다', () => {
      const container = document.createElement('section');
      container.id = 'area';
      container.className = 'c';

      renderRoot(container, rootOf('a'));

      expect(container.tagName).toBe('SECTION');
      expect(container.id).toBe('area');
      expect(container.className).toBe('c');
    });

    it('빈 루트는 영역을 비운다', () => {
      const container = containerOf('<p>old</p>text');

      renderRoot(container, rootOf());

      expect(container.childNodes).toHaveLength(0);
    });

    it('빈 영역에 빈 루트를 그려도 오류가 없다', () => {
      const container = document.createElement('div');

      renderRoot(container, rootOf());

      expect(container.childNodes).toHaveLength(0);
    });

    it('같은 루트를 두 번 그려도 내용이 쌓이지 않는다', () => {
      const container = document.createElement('div');
      const root = rootOf(el('p', {}, ['a']));

      renderRoot(container, root);
      renderRoot(container, root);

      expect(container.innerHTML).toBe('<p>a</p>');
    });

    it('입력을 고치지 않는다', () => {
      const root = rootOf(el('p', { id: 'a' }, ['b']), 'c');
      const snapshot = structuredClone(root);

      renderRoot(document.createElement('div'), root);

      expect(root).toEqual(snapshot);
    });
  });

  describe('한 번에 교체', () => {
    /** 그리는 동안 영역의 자식 목록에 생긴 변경 기록을 돌려준다. */
    function recordsOf(container, root) {
      const observer = new MutationObserver(() => {});
      observer.observe(container, { childList: true });

      renderRoot(container, root);

      const records = observer.takeRecords();
      observer.disconnect();
      return records;
    }

    it('기존 내용과 새 내용을 변경 기록 1건으로 바꾼다', () => {
      const container = containerOf('<p>old</p>old');
      const before = Array.from(container.childNodes);

      const records = recordsOf(container, rootOf(el('b', {}, ['1']), '2', el('i', {}, ['3'])));

      expect(records).toHaveLength(1);
      expect(Array.from(records[0].removedNodes)).toEqual(before);
      expect(Array.from(records[0].addedNodes)).toEqual(Array.from(container.childNodes));
      expect(records[0].addedNodes).toHaveLength(3);
    });

    it('빈 영역에 여러 노드를 그려도 변경 기록은 1건이다', () => {
      const records = recordsOf(document.createElement('div'), rootOf('a', el('b'), 'c'));

      expect(records).toHaveLength(1);
    });

    it('인자 펼침의 한계를 넘는 수의 최상위 노드도 그린다', () => {
      const container = containerOf('old');
      const children = Array.from({ length: 130000 }, (_, index) => (index % 2 === 0 ? 'a' : el('b')));

      renderRoot(container, { type: 'root', props: {}, children });

      expect(container.childNodes).toHaveLength(130000);
    });
  });

  describe('최상위 입력', () => {
    it('최상위 문자열은 HTML로 해석하지 않고 텍스트로 남는다', () => {
      const container = document.createElement('div');

      renderRoot(container, rootOf('<b>x</b>'));

      expect(container.childNodes).toHaveLength(1);
      expect(container.firstChild.nodeType).toBe(Node.TEXT_NODE);
      expect(container.firstChild.nodeValue).toBe('<b>x</b>');
    });

    it('나란한 최상위 문자열은 각각의 텍스트 노드가 된다', () => {
      const container = document.createElement('div');

      renderRoot(container, rootOf('a', 'b'));

      expect(Array.from(container.childNodes, ({ nodeValue }) => nodeValue)).toEqual(['a', 'b']);
    });

    it('최상위 tr을 파서처럼 버리지 않는다', () => {
      const container = document.createElement('div');

      renderRoot(container, rootOf(el('tr', {}, [el('td', {}, ['x'])])));

      expect(container.childNodes).toHaveLength(1);
      expect(container.firstChild.tagName).toBe('TR');
      expect(container.firstChild.firstChild.tagName).toBe('TD');
    });

    it('p 안의 div를 파서처럼 밖으로 꺼내지 않는다', () => {
      const container = document.createElement('div');

      renderRoot(container, rootOf(el('p', {}, [el('div', {}, ['x'])])));

      expect(container.childNodes).toHaveLength(1);
      expect(container.firstChild.tagName).toBe('P');
      expect(container.firstChild.firstChild.tagName).toBe('DIV');
    });

    it('최상위의 빈 문자열도 자식으로 유지한다', () => {
      const container = document.createElement('div');

      renderRoot(container, rootOf('a', '', el('b')));

      expect(container.childNodes).toHaveLength(3);
      expect(container.childNodes[1].nodeType).toBe(Node.TEXT_NODE);
      expect(container.childNodes[1].nodeValue).toBe('');
    });
  });

  describe('오류 시 기존 내용 유지', () => {
    /** 그리기가 실패한 뒤에도 기존 노드 객체가 순서까지 그대로인지 확인한다. */
    function expectKept(root) {
      const container = containerOf('<p id="old">old</p>text');
      const before = Array.from(container.childNodes);
      const html = container.innerHTML;

      expect(() => renderRoot(container, root)).toThrow(expect.objectContaining({ name: 'InvalidCharacterError' }));

      expect(container.childNodes).toHaveLength(before.length);
      container.childNodes.forEach((node, index) => expect(node).toBe(before[index]));
      expect(container.innerHTML).toBe(html);
    }

    it('첫 번째 노드에서 실패해도 기존 내용이 남는다', () => {
      expectKept(rootOf(el('1a')));
    });

    it('앞의 노드를 만든 뒤 실패해도 기존 내용이 남고 앞의 노드는 붙지 않는다', () => {
      expectKept(rootOf(el('p', {}, ['new']), 'text', el('1a')));
    });

    it('깊은 자식에서 실패해도 기존 내용이 남는다', () => {
      expectKept(rootOf(el('div', {}, [el('p', {}, [el('1a')])])));
    });

    it('잘못된 속성 이름에서 실패해도 기존 내용이 남는다', () => {
      expectKept(rootOf(el('p', {}, ['new']), el('div', { '=a': '1' })));
    });

    it('파서가 받아들인 속성이어도 넣을 수 없으면 기존 내용이 남는다', () => {
      const root = containerToVdom(containerOf('<div =a="1"></div>'));

      expect(Object.keys(root.children[0].props)).toEqual(['=a']);
      expectKept(root);
    });
  });

  describe('Virtual DOM → DOM → Virtual DOM 왕복', () => {
    it.each([
      ['빈 루트', rootOf()],
      ['텍스트 하나', rootOf('안녕')],
      ['요소 하나', rootOf(el('p'))],
      ['최상위 노드 여러 개', rootOf(el('h1', {}, ['제목']), ' ', el('p', {}, ['본문']), '끝')],
      ['속성', rootOf(el('a', { href: '/x?a=1&b=2', class: 'b c', hidden: '', title: '"<>' }, ['링크']))],
      [
        '깊은 중첩',
        rootOf(
          el('ul', { id: 'l' }, [
            el('li', {}, ['하나']),
            el('li', {}, [el('b', {}, ['둘']), '셋', el('i', { class: 'x' }, [el('u', {}, ['넷'])])]),
          ]),
        ),
      ],
      ['HTML처럼 보이는 텍스트', rootOf(el('p', {}, ['<b>a</b> &lt; "b"']))],
      ['같은 줄의 공백', rootOf(el('b', {}, ['a']), ' ', el('i', {}, ['b']))],
      ['앞뒤 공백이 있는 텍스트', rootOf(el('p', {}, ['\n  a b\n']))],
      ['보이지 않는 문자', rootOf(el('p', {}, ['a\u00A0b']), '\u00A0', el('p', {}, ['\u200B']))],
      ['파서가 받는 속성 이름', rootOf(el('div', { '@click': 'x', '1a': 'y', 'a"b': 'z' }))],
      ['constructor 속성', rootOf(el('div', { constructor: 'x' }))],
    ])('%s', (_label, root) => {
      expect(roundTrip(root)).toEqual(root);
    });

    it.each([
      ['<a"b>x</a"b>', 'a"b'],
      ['<div<>x</div<>', 'div<'],
      ['<a=b>x</a=b>', 'a=b'],
    ])('파서가 받는 태그 이름 %s', (html, type) => {
      const root = containerToVdom(containerOf(html));

      expect(root.children).toEqual([el(type, {}, ['x'])]);
      expect(roundTrip(root)).toEqual(root);
    });

    it('__proto__ 속성', () => {
      const root = rootOf(el('div', Object.fromEntries([['__proto__', 'x']])));

      const { props } = roundTrip(root).children[0];

      expect(Object.keys(props)).toEqual(['__proto__']);
      expect(Object.getOwnPropertyDescriptor(props, '__proto__').value).toBe('x');
    });

    it('DOM에서 읽은 내용을 다시 그려도 같은 Virtual DOM이 된다', () => {
      const source = containerOf(`
        <!-- 샘플 -->
        <section id="s">
          <h1 class="t">제목</h1>
          <p>a<!--x-->b <b>c</b> <i>d</i></p>
        </section>
      `);
      const root = containerToVdom(source);

      expect(roundTrip(root)).toEqual(root);
    });
  });
});
