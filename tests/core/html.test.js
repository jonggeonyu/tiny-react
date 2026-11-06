import { describe, expect, it } from 'vitest';
import { htmlToVdom, vdomToHtml } from '../../src/core/html.js';

/** 요소 노드를 만든다. */
function el(type, props = {}, children = []) {
  return { type, props, children };
}

/** 주어진 자식들을 가진 루트 노드를 만든다. */
function rootOf(...children) {
  return el('root', {}, children);
}

/** 함수를 실행하는 동안 문서에 생긴 변경 기록을 돌려준다. */
function documentRecordsDuring(run) {
  const observer = new MutationObserver(() => {});
  observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true });

  run();

  const records = observer.takeRecords();
  observer.disconnect();
  return records;
}

describe('vdomToHtml', () => {
  describe('직렬화', () => {
    it('빈 루트는 빈 문자열이다', () => {
      expect(vdomToHtml(rootOf())).toBe('');
    });

    it('텍스트는 그대로 나온다', () => {
      expect(vdomToHtml(rootOf('안녕'))).toBe('안녕');
    });

    it('요소를 속성과 자식까지 문자열로 만든다', () => {
      const root = rootOf(el('a', { href: '/x', class: 'b c' }, ['링크', el('b', {}, ['굵게'])]));

      expect(vdomToHtml(root)).toBe('<a href="/x" class="b c">링크<b>굵게</b></a>');
    });

    it('최상위 노드가 여러 개이면 순서대로 잇는다', () => {
      expect(vdomToHtml(rootOf(el('b', {}, ['1']), ' ', el('i', {}, ['2']), '끝'))).toBe('<b>1</b> <i>2</i>끝');
    });

    it('루트 자체는 태그로 나오지 않는다', () => {
      expect(vdomToHtml(rootOf(el('p')))).toBe('<p></p>');
    });

    it('임시 요소의 태그는 결과에 나오지 않는다', () => {
      expect(vdomToHtml(rootOf('a'))).not.toContain('<');
    });

    it('닫는 태그가 없는 요소와 빈 속성을 직렬화한다', () => {
      expect(vdomToHtml(rootOf(el('input', { disabled: '' }), el('br')))).toBe('<input disabled=""><br>');
    });

    it('최상위 tr을 파서처럼 버리지 않는다', () => {
      expect(vdomToHtml(rootOf(el('tr', {}, [el('td', {}, ['x'])])))).toBe('<tr><td>x</td></tr>');
    });
  });

  describe('이스케이프', () => {
    it('텍스트의 <, >, &를 이스케이프한다', () => {
      expect(vdomToHtml(rootOf(el('p', {}, ['a < b & c > d'])))).toBe('<p>a &lt; b &amp; c &gt; d</p>');
    });

    it('태그처럼 보이는 텍스트를 태그로 만들지 않는다', () => {
      expect(vdomToHtml(rootOf('<b>x</b>'))).toBe('&lt;b&gt;x&lt;/b&gt;');
    });

    it('엔티티처럼 보이는 텍스트를 한 번 더 이스케이프한다', () => {
      expect(vdomToHtml(rootOf('&lt;'))).toBe('&amp;lt;');
    });

    it('텍스트의 따옴표는 이스케이프하지 않는다', () => {
      expect(vdomToHtml(rootOf('"a"'))).toBe('"a"');
    });

    it('속성의 큰따옴표와 &를 이스케이프한다', () => {
      expect(vdomToHtml(rootOf(el('p', { title: 'a"b&c' })))).toBe('<p title="a&quot;b&amp;c"></p>');
    });

    it('줄바꿈 없는 공백(U+00A0)을 &nbsp;로 쓴다', () => {
      expect(vdomToHtml(rootOf('a\u00A0b'))).toBe('a&nbsp;b');
    });
  });

  describe('입력과 문서', () => {
    it('입력을 고치지 않는다', () => {
      const root = rootOf(el('p', { id: 'a' }, ['b']), 'c');
      const snapshot = structuredClone(root);

      vdomToHtml(root);

      expect(root).toEqual(snapshot);
    });

    it('임시 요소를 문서에 붙이지 않는다', () => {
      const records = documentRecordsDuring(() => vdomToHtml(rootOf(el('p', {}, ['a']))));

      expect(records).toHaveLength(0);
    });
  });

  describe('만들 수 없는 노드', () => {
    it('만들 수 없는 태그 이름은 오류를 낸다', () => {
      expect(() => vdomToHtml(rootOf(el('1a')))).toThrow(expect.objectContaining({ name: 'InvalidCharacterError' }));
    });

    it('파서가 받아들인 속성이어도 넣을 수 없으면 오류를 낸다', () => {
      const root = htmlToVdom('<div =a="1"></div>');

      expect(Object.keys(root.children[0].props)).toEqual(['=a']);
      expect(() => vdomToHtml(root)).toThrow(expect.objectContaining({ name: 'InvalidCharacterError' }));
    });
  });
});

describe('htmlToVdom', () => {
  describe('빈 입력', () => {
    it('빈 문자열은 빈 루트이다', () => {
      expect(htmlToVdom('')).toEqual(rootOf());
    });

    it('줄바꿈이 포함된 공백만 있으면 빈 루트이다', () => {
      expect(htmlToVdom('\n  \n')).toEqual(rootOf());
    });

    it('주석만 있으면 빈 루트이다', () => {
      expect(htmlToVdom('<!-- 주석 -->')).toEqual(rootOf());
    });

    it('같은 줄의 공백은 유지한다', () => {
      expect(htmlToVdom('  ')).toEqual(rootOf('  '));
    });
  });

  describe('파싱', () => {
    it('type이 root이고 props가 {}인 루트 노드를 돌려준다', () => {
      const root = htmlToVdom('a');

      expect(root.type).toBe('root');
      expect(root.props).toEqual({});
      expect(root.children).toEqual(['a']);
    });

    it('요소를 속성과 자식까지 변환한다', () => {
      expect(htmlToVdom('<ul id="l"><li>하나</li><li><b>둘</b>셋</li></ul>')).toEqual(
        rootOf(
          el('ul', { id: 'l' }, [el('li', {}, ['하나']), el('li', {}, [el('b', {}, ['둘']), '셋'])]),
        ),
      );
    });

    it('최상위 노드가 여러 개이면 순서대로 담는다', () => {
      expect(htmlToVdom('<b>1</b> <i>2</i>끝')).toEqual(
        rootOf(el('b', {}, ['1']), ' ', el('i', {}, ['2']), '끝'),
      );
    });

    it('태그와 속성 이름을 소문자로 읽는다', () => {
      expect(htmlToVdom('<DIV ID="a"></DIV>')).toEqual(rootOf(el('div', { id: 'a' })));
    });

    it('들여쓰기와 주석을 domToVdom의 규칙대로 지운다', () => {
      const html = `
        <!-- 샘플 -->
        <section id="s">
          <h1>제목</h1>
          <p>a<!--x-->b <b>c</b> <i>d</i></p>
        </section>
      `;

      expect(htmlToVdom(html)).toEqual(
        rootOf(
          el('section', { id: 's' }, [
            el('h1', {}, ['제목']),
            el('p', {}, ['ab ', el('b', {}, ['c']), ' ', el('i', {}, ['d'])]),
          ]),
        ),
      );
    });

    it('호출할 때마다 새 Virtual DOM을 만든다', () => {
      const html = '<p>a</p>';

      expect(htmlToVdom(html)).not.toBe(htmlToVdom(html));
      expect(htmlToVdom(html)).toEqual(htmlToVdom(html));
    });

    it.each(['__proto__', 'constructor'])('내장 이름 %s도 속성으로 읽는다', (name) => {
      const { props } = htmlToVdom(`<div ${name}="x"></div>`).children[0];

      expect(Object.keys(props)).toEqual([name]);
      expect(Object.getOwnPropertyDescriptor(props, name).value).toBe('x');
    });
  });

  describe('이스케이프', () => {
    it('텍스트의 엔티티를 문자로 푼다', () => {
      expect(htmlToVdom('<p>a &lt; b &amp; c &gt; d</p>')).toEqual(rootOf(el('p', {}, ['a < b & c > d'])));
    });

    it('이스케이프된 태그는 요소가 아니라 텍스트이다', () => {
      expect(htmlToVdom('&lt;b&gt;x&lt;/b&gt;')).toEqual(rootOf('<b>x</b>'));
    });

    it('이중 이스케이프는 한 번만 푼다', () => {
      expect(htmlToVdom('&amp;lt;')).toEqual(rootOf('&lt;'));
    });

    it('&nbsp;는 공백으로 지우지 않고 U+00A0으로 읽는다', () => {
      expect(htmlToVdom('<b>a</b>&nbsp;<i>b</i>')).toEqual(
        rootOf(el('b', {}, ['a']), '\u00A0', el('i', {}, ['b'])),
      );
    });

    it.each([
      ['<p title="a&quot;b"></p>', 'a"b'],
      [`<p title='a"b'></p>`, 'a"b'],
      [`<p title="a'b"></p>`, "a'b"],
      ['<p title="a&amp;b"></p>', 'a&b'],
    ])('속성의 따옴표와 엔티티를 푼다: %s', (html, title) => {
      expect(htmlToVdom(html)).toEqual(rootOf(el('p', { title })));
    });

    it('태그가 될 수 없는 <는 텍스트로 남는다', () => {
      expect(htmlToVdom('a < b <1a>')).toEqual(rootOf('a < b <1a>'));
    });
  });

  describe('최상위 표 요소', () => {
    const cell = el('td', {}, ['x']);

    it.each([
      ['tr', '<tr><td>x</td></tr>', [el('tr', {}, [cell])]],
      ['td', '<td>x</td>', [cell]],
      ['th', '<th>x</th>', [el('th', {}, ['x'])]],
      ['tbody', '<tbody><tr><td>x</td></tr></tbody>', [el('tbody', {}, [el('tr', {}, [cell])])]],
      ['thead', '<thead></thead>', [el('thead')]],
      ['caption', '<caption>x</caption>', [el('caption', {}, ['x'])]],
      ['col', '<col>', [el('col')]],
    ])('최상위 %s를 버리지 않는다', (_label, html, children) => {
      expect(htmlToVdom(html)).toEqual(rootOf(...children));
    });

    it('최상위 tr이 여러 개여도 모두 읽는다', () => {
      expect(htmlToVdom('<tr><td>1</td></tr><tr><td>2</td></tr>')).toEqual(
        rootOf(el('tr', {}, [el('td', {}, ['1'])]), el('tr', {}, [el('td', {}, ['2'])])),
      );
    });

    it('들여쓴 최상위 tr도 읽는다', () => {
      expect(htmlToVdom('\n  <tr>\n    <td>x</td>\n  </tr>\n')).toEqual(rootOf(el('tr', {}, [cell])));
    });

    it('텍스트 뒤의 최상위 tr은 읽는다', () => {
      expect(htmlToVdom('a<tr><td>x</td></tr>')).toEqual(rootOf('a', el('tr', {}, [cell])));
    });

    it('일반 요소 뒤의 최상위 tr은 파서가 태그를 버리고 내용만 남긴다', () => {
      expect(htmlToVdom('<p>y</p><tr><td>x</td></tr>')).toEqual(rootOf(el('p', {}, ['y']), 'x'));
    });
  });

  describe('닫지 않은 태그', () => {
    it.each([
      ['요소 하나', '<p>a', [el('p', {}, ['a'])]],
      ['중첩', '<div><b>x', [el('div', {}, [el('b', {}, ['x'])])]],
      ['자동으로 닫히는 li', '<ul><li>1<li>2', [el('ul', {}, [el('li', {}, ['1']), el('li', {}, ['2'])])]],
      ['자동으로 닫히는 p', '<p>1<p>2', [el('p', {}, ['1']), el('p', {}, ['2'])]],
      ['닫히지 않은 tr', '<tr><td>x', [el('tr', {}, [el('td', {}, ['x'])])]],
    ])('%s를 파서가 닫는다', (_label, html, children) => {
      expect(htmlToVdom(html)).toEqual(rootOf(...children));
    });

    it('입력 중인 태그는 파서가 버린다', () => {
      expect(htmlToVdom('a<div')).toEqual(rootOf('a'));
      expect(htmlToVdom('a<p title="b')).toEqual(rootOf('a'));
    });

    it('짝이 없는 닫는 태그는 파서가 버린다', () => {
      expect(htmlToVdom('a</div>b')).toEqual(rootOf('ab'));
    });
  });

  describe('실행과 문서', () => {
    it('문서를 건드리지 않는다', () => {
      const records = documentRecordsDuring(() => htmlToVdom('<p>a</p>'));

      expect(records).toHaveLength(0);
    });

    it('script를 실행하지 않고 내용을 텍스트로 읽는다', () => {
      const code = 'window.__htmlToVdomRan = true';

      expect(htmlToVdom(`<script>${code}</script>`)).toEqual(rootOf(el('script', {}, [code])));
      expect(window.__htmlToVdomRan).toBeUndefined();
    });
  });
});

describe('왕복', () => {
  describe('Virtual DOM → HTML → Virtual DOM', () => {
    it.each([
      ['빈 루트', rootOf()],
      ['텍스트 하나', rootOf('안녕')],
      ['요소 하나', rootOf(el('p'))],
      ['최상위 노드 여러 개', rootOf(el('h1', {}, ['제목']), ' ', el('p', {}, ['본문']), '끝')],
      ['속성', rootOf(el('a', { href: '/x?a=1&b=2', class: 'b c', hidden: '', title: '"\'<>' }, ['링크']))],
      [
        '깊은 중첩',
        rootOf(
          el('ul', { id: 'l' }, [
            el('li', {}, ['하나']),
            el('li', {}, [el('b', {}, ['둘']), '셋', el('i', { class: 'x' }, [el('u', {}, ['넷'])])]),
          ]),
        ),
      ],
      ['닫는 태그가 없는 요소', rootOf(el('p', {}, ['a', el('br'), 'b']), el('img', { src: '/a.png', alt: '' }))],
      ['HTML처럼 보이는 텍스트', rootOf(el('p', {}, ['<b>a</b> &lt; "b"']))],
      ['같은 줄의 공백', rootOf(el('b', {}, ['a']), ' ', el('i', {}, ['b']))],
      ['앞뒤 공백이 있는 텍스트', rootOf(el('p', {}, ['\n  a b\n']))],
      ['보이지 않는 문자', rootOf(el('p', {}, ['a\u00A0b']), '\u00A0', el('p', {}, ['\u200B']))],
      ['최상위 tr', rootOf(el('tr', {}, [el('td', {}, ['x'])]))],
      ['최상위 tr 여러 개', rootOf(el('tr', {}, [el('td', {}, ['1'])]), el('tr', {}, [el('td', {}, ['2'])]))],
      ['최상위 td', rootOf(el('td', {}, ['x']))],
      ['표', rootOf(el('table', {}, [el('tbody', {}, [el('tr', {}, [el('td', {}, ['x'])])])]))],
      ['파서가 받는 속성 이름', rootOf(el('div', { '@click': 'x', '1a': 'y', 'a"b': 'z' }))],
      ['constructor 속성', rootOf(el('div', { constructor: 'x' }))],
    ])('%s', (_label, root) => {
      expect(htmlToVdom(vdomToHtml(root))).toEqual(root);
    });

    it('__proto__ 속성', () => {
      const root = rootOf(el('div', Object.fromEntries([['__proto__', 'x']])));

      const { props } = htmlToVdom(vdomToHtml(root)).children[0];

      expect(Object.keys(props)).toEqual(['__proto__']);
      expect(Object.getOwnPropertyDescriptor(props, '__proto__').value).toBe('x');
    });
  });

  describe('HTML → Virtual DOM → HTML', () => {
    it.each([
      [''],
      ['안녕'],
      ['<p>a &lt; b</p>'],
      ['<p title="a&quot;b">c</p>'],
      ['<b>a</b> <i>b</i>'],
      ['<tr><td>x</td></tr>'],
      ['<ul id="l"><li>하나</li><li><b>둘</b>셋</li></ul>'],
    ])('정리된 입력 "%s"는 같은 문자열로 돌아온다', (html) => {
      expect(vdomToHtml(htmlToVdom(html))).toBe(html);
    });

    it.each([
      ['닫지 않은 태그', '<p>a', '<p>a</p>'],
      ['들여쓰기와 주석', '\n<div>\n  <!--x-->\n  <p>a</p>\n</div>\n', '<div><p>a</p></div>'],
      ['대문자 태그', '<DIV ID=a></DIV>', '<div id="a"></div>'],
      ['작은따옴표 속성', `<p title='a"b'></p>`, '<p title="a&quot;b"></p>'],
    ])('%s는 정리된 문자열이 된다', (_label, html, expected) => {
      expect(vdomToHtml(htmlToVdom(html))).toBe(expected);
    });

    it.each([
      ['<p>a'],
      ['<ul><li>1<li>2'],
      ['\n<div>\n  <p>a</p> <b>c</b>\n</div>\n'],
      ['<table><tr><td>x'],
      ['<tr><td>x'],
      ['<p>a&nbsp;b &amp;amp; &lt;i&gt;</p>'],
    ])('고치지 않고 다시 변환해도 Virtual DOM이 같다: %s', (html) => {
      const root = htmlToVdom(html);

      expect(htmlToVdom(vdomToHtml(root))).toEqual(root);
    });
  });
});
