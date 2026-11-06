import { describe, expect, it } from 'vitest';
import { containerToVdom, domToVdom } from '../../src/core/domToVdom.js';

/** HTML 문자열을 담은 임시 영역을 만든다. */
function containerOf(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

/** 주어진 내용의 텍스트 노드 하나만 자식으로 가진 영역을 만든다. */
function containerWithText(text) {
  const container = document.createElement('div');
  container.append(document.createTextNode(text));
  return container;
}

describe('domToVdom', () => {
  describe('텍스트', () => {
    it('텍스트 노드는 내용을 문자열로 돌려준다', () => {
      expect(domToVdom(document.createTextNode('안녕'))).toBe('안녕');
    });

    it('내용이 있는 텍스트의 앞뒤 공백과 줄바꿈은 그대로 둔다', () => {
      expect(domToVdom(document.createTextNode('\n  a b\n'))).toBe('\n  a b\n');
    });

    it('빈 텍스트 노드는 빈 문자열이다', () => {
      expect(domToVdom(document.createTextNode(''))).toBe('');
    });
  });

  describe('요소', () => {
    it('type은 소문자이다', () => {
      expect(domToVdom(document.createElement('DIV')).type).toBe('div');
      expect(domToVdom(containerOf('<SECTION></SECTION>').firstChild).type).toBe('section');
    });

    it('속성이 없으면 props는 {}이고 children은 빈 배열이다', () => {
      expect(domToVdom(document.createElement('p'))).toEqual({
        type: 'p',
        props: {},
        children: [],
      });
    });

    it('attributes를 읽어 props를 만든다', () => {
      const node = containerOf('<a href="/x" class="b c" hidden></a>').firstChild;

      expect(domToVdom(node).props).toEqual({ href: '/x', class: 'b c', hidden: '' });
    });

    it('중첩된 요소를 재귀로 변환한다', () => {
      const node = containerOf('<ul id="l"><li>하나</li><li><b>둘</b>셋</li></ul>').firstChild;

      expect(domToVdom(node)).toEqual({
        type: 'ul',
        props: { id: 'l' },
        children: [
          { type: 'li', props: {}, children: ['하나'] },
          {
            type: 'li',
            props: {},
            children: [{ type: 'b', props: {}, children: ['둘'] }, '셋'],
          },
        ],
      });
    });
  });

  describe('내장 이름과 같은 속성', () => {
    it('__proto__ 속성을 자기 속성으로 저장한다', () => {
      const element = document.createElement('div');
      element.setAttribute('__proto__', 'x');

      const { props } = domToVdom(element);

      expect(Object.hasOwn(props, '__proto__')).toBe(true);
      expect(Object.keys(props)).toEqual(['__proto__']);
      expect(Object.getOwnPropertyDescriptor(props, '__proto__').value).toBe('x');
      expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    });

    it('constructor 속성을 자기 속성으로 저장한다', () => {
      const element = document.createElement('div');
      element.setAttribute('constructor', 'x');

      const { props } = domToVdom(element);

      expect(Object.hasOwn(props, 'constructor')).toBe(true);
      expect(props.constructor).toBe('x');
    });

    it('속성이 없으면 내장 이름은 자기 속성이 아니다', () => {
      const { props } = domToVdom(document.createElement('div'));

      expect(Object.hasOwn(props, '__proto__')).toBe(false);
      expect(Object.hasOwn(props, 'constructor')).toBe(false);
    });
  });

  describe('주석 제외', () => {
    it('주석 노드는 null을 돌려준다', () => {
      expect(domToVdom(document.createComment('x'))).toBeNull();
    });

    it('자식의 주석을 제외한다', () => {
      const node = containerOf('<p><!--x--><b>a</b><!--y--></p>').firstChild;

      expect(domToVdom(node).children).toEqual([{ type: 'b', props: {}, children: ['a'] }]);
    });
  });

  describe('요소와 텍스트가 아닌 노드', () => {
    it('처리 명령 노드는 null을 돌려준다', () => {
      expect(domToVdom(document.createProcessingInstruction('x', 'y'))).toBeNull();
    });

    it('DocumentFragment는 자식이 있어도 null을 돌려준다', () => {
      const fragment = document.createDocumentFragment();
      fragment.append(document.createElement('p'));

      expect(domToVdom(fragment)).toBeNull();
    });
  });

  describe('공백 제외', () => {
    it.each([
      ['줄바꿈', '\n'],
      ['여러 줄바꿈', '\n\n'],
      ['줄바꿈 뒤 들여쓰기', '\n    '],
      ['줄바꿈 앞 공백', '  \n'],
      ['탭과 줄바꿈', '\t\n\t'],
      ['폼 피드와 줄바꿈', '\f\n'],
      ['CRLF', '\r\n'],
      ['CR', '\r'],
    ])('공백만 있으면서 줄바꿈을 포함하면 null이다: %s', (_, text) => {
      expect(domToVdom(document.createTextNode(text))).toBeNull();
    });

    it.each([
      ['스페이스 하나', ' '],
      ['스페이스 여러 개', '   '],
      ['탭', '\t'],
      ['폼 피드', '\f'],
      ['섞인 공백', ' \t\f '],
    ])('같은 줄의 공백만 있으면 유지한다: %s', (_, text) => {
      expect(domToVdom(document.createTextNode(text))).toBe(text);
    });

    it.each([
      ['nbsp', '\u00a0'],
      ['nbsp와 줄바꿈', '\n\u00a0\n'],
      ['전각 공백과 줄바꿈', '\u3000\n'],
      ['em 공백과 줄바꿈', '\u2003\n'],
      ['수직 탭과 줄바꿈', '\v\n'],
      ['BOM과 줄바꿈', '\ufeff\n'],
      ['줄 구분자', '\u2028'],
      ['문단 구분자', '\u2029'],
    ])('HTML 공백 문자가 아닌 문자는 내용으로 유지한다: %s', (_, text) => {
      expect(domToVdom(document.createTextNode(text))).toBe(text);
    });

    it('내용 사이에 빈 줄이 있는 텍스트를 그대로 유지한다', () => {
      expect(domToVdom(document.createTextNode('a\n\n\nb'))).toBe('a\n\n\nb');
    });

    it('&nbsp;만 있는 요소의 내용을 유지한다', () => {
      const node = containerOf('<p>\n&nbsp;\n</p>').firstChild;

      expect(domToVdom(node).children).toEqual(['\n\u00a0\n']);
    });

    it('요소 사이의 같은 줄 공백을 유지한다', () => {
      const node = containerOf('<p><b>a</b> <i>b</i></p>').firstChild;

      expect(domToVdom(node).children).toEqual([
        { type: 'b', props: {}, children: ['a'] },
        ' ',
        { type: 'i', props: {}, children: ['b'] },
      ]);
    });

    it('요소 사이의 들여쓰기를 제외한다', () => {
      const node = containerOf('<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>').firstChild;

      expect(domToVdom(node).children).toEqual([
        { type: 'li', props: {}, children: ['a'] },
        { type: 'li', props: {}, children: ['b'] },
      ]);
    });
  });

  describe('텍스트 합치기', () => {
    it('주석을 제외한 뒤 나란히 남은 텍스트를 합친다', () => {
      const node = containerOf('<p>a<!--x-->b</p>').firstChild;

      expect(domToVdom(node).children).toEqual(['ab']);
    });

    it('주석과 공백을 제외한 뒤 남은 텍스트를 합친다', () => {
      const node = containerOf('<p>a<!--x-->\n<!--y-->b</p>').firstChild;

      expect(domToVdom(node).children).toEqual(['ab']);
    });

    it('같은 줄 공백은 합칠 때 그대로 들어간다', () => {
      const node = containerOf('<p>a<!--x--> <!--y-->b</p>').firstChild;

      expect(domToVdom(node).children).toEqual(['a b']);
    });

    it('나란히 있는 텍스트 노드를 합친다', () => {
      const element = document.createElement('p');
      element.append(document.createTextNode('a'), document.createTextNode('b'));

      expect(domToVdom(element).children).toEqual(['ab']);
    });

    it('빈 문자열도 텍스트로 합친다', () => {
      const element = document.createElement('p');
      element.append(document.createTextNode(''), document.createTextNode('b'));

      expect(domToVdom(element).children).toEqual(['b']);
    });

    it('텍스트 뒤의 빈 문자열도 합친다', () => {
      const element = document.createElement('p');
      element.append(document.createTextNode('a'), document.createTextNode(''));

      expect(domToVdom(element).children).toEqual(['a']);
    });

    it('혼자 있는 빈 텍스트 노드는 제외하지 않는다', () => {
      const element = document.createElement('p');
      element.append(document.createTextNode(''));

      expect(domToVdom(element).children).toEqual(['']);
    });

    it('요소를 사이에 둔 텍스트는 합치지 않는다', () => {
      const node = containerOf('<p>a<b>x</b>c</p>').firstChild;

      expect(domToVdom(node).children).toEqual([
        'a',
        { type: 'b', props: {}, children: ['x'] },
        'c',
      ]);
    });
  });

  it('입력 DOM을 바꾸지 않는다', () => {
    const html = '<p>a<!--x-->\n<b>c</b></p>';
    const container = containerOf(html);

    domToVdom(container.firstChild);

    expect(container.innerHTML).toBe(html);
  });
});

describe('containerToVdom', () => {
  it('영역의 자식을 루트 노드로 감싼다', () => {
    expect(containerToVdom(containerOf('<p>a</p>'))).toEqual({
      type: 'root',
      props: {},
      children: [{ type: 'p', props: {}, children: ['a'] }],
    });
  });

  it('최상위 요소 여러 개를 처리한다', () => {
    expect(containerToVdom(containerOf('<h1>a</h1><p>b</p>글자')).children).toEqual([
      { type: 'h1', props: {}, children: ['a'] },
      { type: 'p', props: {}, children: ['b'] },
      '글자',
    ]);
  });

  it('빈 영역은 자식이 없는 루트 노드이다', () => {
    expect(containerToVdom(containerOf(''))).toEqual({
      type: 'root',
      props: {},
      children: [],
    });
  });

  it('주석과 줄바꿈 공백만 있는 영역은 자식이 없다', () => {
    expect(containerToVdom(containerOf('\n  <!--x-->\n')).children).toEqual([]);
  });

  it('같은 줄 공백만 있는 영역은 공백을 유지한다', () => {
    expect(containerToVdom(containerWithText(' ')).children).toEqual([' ']);
  });

  it('최상위에서도 공백 제외와 텍스트 합치기를 적용한다', () => {
    const container = containerOf('\n  <p>a</p>\n  b<!--x-->c\n');

    expect(containerToVdom(container).children).toEqual([
      { type: 'p', props: {}, children: ['a'] },
      '\n  bc\n',
    ]);
  });

  it('영역의 태그와 속성은 루트 노드에 들어가지 않는다', () => {
    const container = document.createElement('section');
    container.id = 'actual';

    expect(containerToVdom(container)).toEqual({ type: 'root', props: {}, children: [] });
  });

  it('DocumentFragment를 받는다', () => {
    const fragment = document.createDocumentFragment();
    fragment.append(document.createElement('p'), document.createTextNode('a'));

    expect(containerToVdom(fragment)).toEqual({
      type: 'root',
      props: {},
      children: [{ type: 'p', props: {}, children: [] }, 'a'],
    });
  });

  it('template.content를 받는다', () => {
    const template = document.createElement('template');
    template.innerHTML = '<tr class="a"><td>1</td></tr>\n<!--x--><b>c</b> <i>d</i>';

    expect(containerToVdom(template.content)).toEqual({
      type: 'root',
      props: {},
      children: [
        {
          type: 'tr',
          props: { class: 'a' },
          children: [{ type: 'td', props: {}, children: ['1'] }],
        },
        { type: 'b', props: {}, children: ['c'] },
        ' ',
        { type: 'i', props: {}, children: ['d'] },
      ],
    });
  });
});
