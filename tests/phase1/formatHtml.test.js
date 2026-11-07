import { describe, expect, it, vi } from 'vitest';
import { diff } from '../../src/core/diff.js';
import { htmlToVdom, vdomToHtml } from '../../src/core/html.js';
import { formatHtml } from '../../src/phase1/formatHtml.js';

/** 요소 노드를 만든다. */
function el(type, props = {}, children = []) {
  return { type, props, children };
}

/** 주어진 자식들을 가진 루트 노드를 만든다. */
function rootOf(...children) {
  return el('root', {}, children);
}

/** 줄 목록을 정렬 결과와 비교할 문자열로 잇는다. */
function lines(...texts) {
  return texts.join('\n');
}

/** 객체를 안쪽까지 모두 얼린다. */
function deepFreeze(value) {
  if (typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * 시드가 같으면 같은 수열을 돌려주는 난수 함수(mulberry32)를 만든다.
 * 실패한 입력을 시드로 다시 만들 수 있어야 하므로 `Math.random`을 쓰지 않는다.
 */
function createRandom(seed) {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'col']);
const TEXT_ONLY_TAGS = new Set(['script', 'style', 'textarea', 'title']);
const ANY_TAGS = [
  'div', 'section', 'p', 'span', 'b', 'i', 'a', 'em', 'strong', 'button', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'select', 'optgroup', 'option', 'pre', 'listing', 'br', 'hr', 'img', 'input',
  'script', 'style', 'textarea', 'title',
];
// 임의의 태그만 고르면 파서가 표와 목록을 대부분 버리므로, 부모에 맞는 자식을 더 자주 고른다.
const USUAL_CHILDREN = {
  ul: ['li'],
  ol: ['li'],
  dl: ['dt', 'dd'],
  table: ['caption', 'colgroup', 'thead', 'tbody', 'tfoot', 'tr'],
  colgroup: ['col'],
  thead: ['tr'],
  tbody: ['tr'],
  tfoot: ['tr'],
  tr: ['td', 'th'],
  select: ['option', 'optgroup'],
  optgroup: ['option'],
};
const TEXTS = ['가', 'a b', ' ', '  ', '\t', '\n', '\n  ', '\nx', 'x\n', '&amp;', '&lt;b&gt;', '&nbsp;', '"'];
const ATTRIBUTES = ['', ' class="a"', ' title="a&quot;b"', ' title="</div>"', ' title="a\nb"', ' __proto__="1"'];

/** 시드로 무작위 HTML을 만든다. 잘못된 중첩도 섞여서 나온다. */
function randomHtml(seed) {
  const random = createRandom(seed);
  const pick = (items) => items[Math.floor(random() * items.length)];

  function randomChildren(parent, depth) {
    const count = Math.floor(random() * 4);
    let html = '';

    for (let index = 0; index < count; index += 1) {
      html += random() < 0.2 ? pick(TEXTS) : randomElement(parent, depth);
    }

    return html;
  }

  function randomElement(parent, depth) {
    const usual = USUAL_CHILDREN[parent];
    const tag = usual !== undefined && random() < 0.85 ? pick(usual) : pick(ANY_TAGS);
    const open = `<${tag}${pick(ATTRIBUTES)}>`;

    if (VOID_TAGS.has(tag)) return open;
    if (TEXT_ONLY_TAGS.has(tag)) return `${open}a<b&c${'</'}${tag}>`;

    return `${open}${depth > 0 ? randomChildren(tag, depth - 1) : ''}</${tag}>`;
  }

  return randomChildren('root', 6) + randomChildren('root', 6);
}

describe('formatHtml', () => {
  describe('줄 나누기', () => {
    it('빈 루트는 빈 문자열이다', () => {
      expect(formatHtml(rootOf())).toBe('');
    });

    it('루트의 자식이 모두 요소이면 한 줄에 하나씩 둔다', () => {
      expect(formatHtml(rootOf(el('p', {}, ['a']), el('p', {}, ['b'])))).toBe(lines('<p>a</p>', '<p>b</p>'));
    });

    it('자식이 모두 요소이면 2칸 들여 쓴다', () => {
      const root = rootOf(el('ul', { id: 'list' }, [el('li', {}, ['사과']), el('li', { class: 'done' }, ['우유'])]));

      expect(formatHtml(root)).toBe(lines('<ul id="list">', '  <li>사과</li>', '  <li class="done">우유</li>', '</ul>'));
    });

    it('깊이마다 2칸씩 더 들여 쓴다', () => {
      const root = rootOf(el('div', {}, [el('ul', {}, [el('li', {}, [el('b', {}, ['x'])])])]));

      expect(formatHtml(root)).toBe(
        lines('<div>', '  <ul>', '    <li>', '      <b>x</b>', '    </li>', '  </ul>', '</div>'),
      );
    });

    it('샘플 문서를 정렬한다', () => {
      const root = htmlToVdom(
        '<h3 class="title">장보기 목록</h3>' +
          '<p>오늘 살 것을 <strong>적어</strong> 두었다.</p>' +
          '<ul id="list"><li>사과</li><li class="done">우유</li></ul>',
      );

      expect(formatHtml(root)).toBe(
        lines(
          '<h3 class="title">장보기 목록</h3>',
          '<p>오늘 살 것을 <strong>적어</strong> 두었다.</p>',
          '<ul id="list">',
          '  <li>사과</li>',
          '  <li class="done">우유</li>',
          '</ul>',
        ),
      );
    });

    it('자식이 없는 요소는 한 줄이다', () => {
      expect(formatHtml(rootOf(el('div', { class: 'a' })))).toBe('<div class="a"></div>');
    });

    it('닫는 태그가 없는 요소는 닫는 태그 없이 한 줄이다', () => {
      expect(formatHtml(rootOf(el('div', {}, [el('br'), el('input', { disabled: '' })])))).toBe(
        lines('<div>', '  <br>', '  <input disabled="">', '</div>'),
      );
    });
  });

  describe('텍스트가 섞인 요소', () => {
    it('루트에 텍스트만 있으면 그대로 둔다', () => {
      expect(formatHtml(rootOf('안녕'))).toBe('안녕');
    });

    it('루트에 텍스트가 섞이면 루트 전체가 vdomToHtml 결과이다', () => {
      const root = rootOf(el('div', {}, [el('b', {}, ['a']), el('i', {}, ['b'])]), '끝');

      expect(formatHtml(root)).toBe('<div><b>a</b><i>b</i></div>끝');
    });

    it('루트의 같은 줄 공백도 텍스트이므로 줄을 나누지 않는다', () => {
      expect(formatHtml(htmlToVdom('<b>a</b> <i>b</i>'))).toBe('<b>a</b> <i>b</i>');
    });

    it('텍스트가 섞인 요소는 안쪽의 요소까지 한 줄이다', () => {
      const root = rootOf(el('div', {}, ['x', el('ul', {}, [el('li', {}, ['a']), el('li', {}, ['b'])])]));

      expect(formatHtml(root)).toBe('<div>x<ul><li>a</li><li>b</li></ul></div>');
    });

    it('줄을 나눈 부모 안에서도 텍스트가 섞인 자식은 한 줄로 들여 쓴다', () => {
      const root = rootOf(el('div', {}, [el('p', {}, ['a', el('b', {}, ['b']), el('i', {}, ['c'])]), el('hr')]));

      expect(formatHtml(root)).toBe(lines('<div>', '  <p>a<b>b</b><i>c</i></p>', '  <hr>', '</div>'));
    });

    it('텍스트 안의 줄바꿈은 들여 쓰지 않는다', () => {
      const root = rootOf(el('div', {}, [el('p', {}, ['a\nb'])]));

      expect(formatHtml(root)).toBe(lines('<div>', '  <p>a', 'b</p>', '</div>'));
    });
  });

  describe('pre와 listing', () => {
    it.each(['pre', 'listing'])('%s는 자식이 모두 요소여도 한 줄이다', (type) => {
      const root = rootOf(el(type, {}, [el('b', {}, ['a']), el('i', {}, ['b'])]));

      expect(formatHtml(root)).toBe(`<${type}><b>a</b><i>b</i></${type}>`);
    });

    it.each(['pre', 'listing'])('%s 안의 요소도 자식까지 한 줄이다', (type) => {
      const root = rootOf(el(type, {}, [el('div', {}, [el('b', {}, ['a']), el('i', {}, ['b'])])]));

      expect(formatHtml(root)).toBe(`<${type}><div><b>a</b><i>b</i></div></${type}>`);
    });

    it('부모의 줄은 나누고 pre만 한 줄로 들여 쓴다', () => {
      const root = rootOf(el('div', {}, [el('pre', {}, [el('b', {}, ['a'])]), el('hr')]));

      expect(formatHtml(root)).toBe(lines('<div>', '  <pre><b>a</b></pre>', '  <hr>', '</div>'));
    });
  });

  describe('직렬화 재사용', () => {
    it('텍스트를 이스케이프한다', () => {
      const root = rootOf(el('div', {}, [el('p', {}, ['a < b & c d'])]));

      expect(formatHtml(root)).toBe(lines('<div>', '  <p>a &lt; b &amp; c&nbsp;d</p>', '</div>'));
    });

    it('줄을 나눈 요소의 여는 태그도 속성을 이스케이프한다', () => {
      const root = rootOf(el('div', { title: 'a"b&c' }, [el('hr')]));

      expect(formatHtml(root)).toBe(lines('<div title="a&quot;b&amp;c">', '  <hr>', '</div>'));
    });

    it('속성 값의 <를 이스케이프하지 않는 브라우저에서도 진짜 닫는 태그에서 자른다', () => {
      // jsdom과 최신 브라우저는 속성의 <를 이스케이프해서 </가 나오지 않으므로, 구형 브라우저의 직렬화를 흉내 낸다.
      const { get: readInnerHtml } = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      const spy = vi.spyOn(Element.prototype, 'innerHTML', 'get').mockImplementation(function read() {
        return readInnerHtml.call(this).replaceAll('&lt;', '<').replaceAll('&gt;', '>');
      });
      const root = rootOf(el('div', { title: '</div>' }, [el('hr')]));

      try {
        expect(formatHtml(root)).toBe(lines('<div title="</div>">', '  <hr>', '</div>'));
      } finally {
        spy.mockRestore();
      }
    });

    it('속성 값에 닫는 태그처럼 보이는 문자열이 있어도 왕복한다', () => {
      const root = rootOf(el('div', { title: '</div>' }, [el('hr')]));

      expect(htmlToVdom(formatHtml(root))).toStrictEqual(root);
    });

    it('script와 style의 내용을 이스케이프하지 않는다', () => {
      const root = rootOf(el('div', {}, [el('script', {}, ['a<b&&c']), el('style', {}, ['a>b{}'])]));

      expect(formatHtml(root)).toBe(lines('<div>', '  <script>a<b&&c</script>', '  <style>a>b{}</style>', '</div>'));
    });

    it('받은 Virtual DOM을 수정하지 않는다', () => {
      const root = deepFreeze(rootOf(el('ul', { id: 'a' }, [el('li', {}, ['b'])]), el('hr')));

      expect(formatHtml(root)).toBe(lines('<ul id="a">', '  <li>b</li>', '</ul>', '<hr>'));
    });

    it('중첩이 깊어도 줄 수는 요소 수에 비례한다', () => {
      const depth = 200;
      const root = htmlToVdom(`${'<div>'.repeat(depth)}<hr>${'</div>'.repeat(depth)}`);

      expect(formatHtml(root).split('\n')).toHaveLength(depth * 2 + 1);
      expect(htmlToVdom(formatHtml(root))).toStrictEqual(root);
    });
  });

  describe('왕복', () => {
    const TABLE =
      '<table class="t"><caption>제목</caption><colgroup><col><col span="2"></colgroup>' +
      '<thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td><td><b>2</b></td></tr></tbody>' +
      '<tfoot><tr><td>합</td></tr></tfoot></table>';

    it.each([
      ['표', TABLE],
      ['tbody를 쓰지 않은 표', '<table><tr><td>x</td></tr></table>'],
      ['표 안의 표', '<table><tr><td><table><tr><td>x</td></tr></table></td></tr></table>'],
      ['셀 안의 요소', '<table><tr><td><p>a</p><p>b</p></td></tr></table>'],
      ['표 안의 같은 줄 공백', '<table> <tr> <td>x</td> </tr> </table>'],
      ['최상위 tr', '<tr><td>a</td><td>b</td></tr>'],
      ['최상위 tr 여러 개', '<tr><td>a</td></tr><tr><td>b</td></tr>'],
      ['최상위 td', '<td>a</td><td>b</td>'],
      ['최상위 th 안의 요소', '<th><b>a</b><i>b</i></th><th>c</th>'],
      ['최상위 col', '<col><col span="2">'],
      ['최상위 colgroup', '<colgroup><col><col></colgroup><colgroup><col></colgroup>'],
      ['최상위 caption', '<caption>a</caption><tbody><tr><td>b</td></tr></tbody>'],
      ['최상위 tbody', '<tbody><tr><td>a</td></tr></tbody><tbody><tr><td>b</td></tr></tbody>'],
      ['최상위 tr 뒤의 요소', '<tr><td>a</td></tr><p>b</p>'],
      ['select', '<select name="s"><option>a</option><option selected="">b</option></select>'],
      ['optgroup', '<select><optgroup label="g"><option>a</option><option>b</option></optgroup></select>'],
      ['중첩 목록', '<ul><li><ul><li>a</li><li>b</li></ul></li><li>c<ol><li>d</li></ol></li></ul>'],
      ['정의 목록', '<dl><dt>a</dt><dd>b</dd><dt>c</dt><dd><p>d</p><p>e</p></dd></dl>'],
      ['a 안의 요소', '<a href="/x"><b>a</b><i>b</i></a>'],
      ['a 안의 블록 요소', '<a href="/x"><div><span>a</span></div><div>b</div></a>'],
      ['a 안의 표', '<a href="/x"><table><tr><td><a href="/y">x</a></td></tr></table></a>'],
      ['서식 요소의 깊은 중첩', '<b><b><b><b><i>a</i><i>b</i></b></b></b></b>'],
      ['p 안의 요소', '<p><b>a</b><i>b</i></p>'],
      ['같은 줄 공백', '<b>a</b> <i>b</i>'],
      ['요소 안의 같은 줄 공백', '<div><b>a</b> <i>b</i></div><div> <b>a</b></div><div><b>a</b> </div>'],
      ['공백 하나만 있는 요소', '<div><p> </p><p>\t</p></div>'],
      ['nbsp', '<div><p>&nbsp;</p><p>&nbsp;<b>a</b></p></div>'],
      ['pre 안의 요소', '<pre><b>a</b><i>b</i></pre>'],
      ['pre 안의 블록 요소', '<div><pre><div><b>a</b><i>b</i></div></pre></div>'],
      ['pre 안의 줄바꿈', '<pre>a\n  b\n</pre>'],
      ['listing 안의 요소', '<listing><b>a</b><i>b</i></listing>'],
      ['script', '<script>if (a < b && c > d) { x("</div>"); }</script>'],
      ['style', '<style>a > b { content: "<&"; }</style>'],
      ['요소 안의 script와 style', '<div><script>a<b</script><style>a>b{}</style></div>'],
      ['표 안의 script와 style', '<table><script>a<b</script><style>a>b{}</style><tr><td>x</td></tr></table>'],
      ['textarea와 title', '<div><textarea>a\n <b></textarea><title>a<b</title></div>'],
      ['빈 루트', ''],
      ['텍스트만 있는 루트', 'a &amp; b'],
      ['__proto__ 속성', '<div __proto__="1" constructor="2"><b __proto__="3">x</b><hr></div>'],
      ['template 요소', '<div><template><p>a</p><p>b</p></template><hr></div>'],
      ['속성 값의 줄바꿈', '<div title="a\nb"><hr title="</div>"><hr></div>'],
      ['닫는 태그가 없는 요소', '<div><br><hr><img src="a"><input disabled=""></div>'],
    ])('%s', (_name, html) => {
      const root = htmlToVdom(html);
      const restored = htmlToVdom(formatHtml(root));

      expect(restored).toStrictEqual(root);
      expect(diff(root, restored)).toEqual([]);
    });

    it('__proto__ 속성이 왕복 뒤에도 자기 속성으로 남는다', () => {
      const restored = htmlToVdom(formatHtml(htmlToVdom('<div __proto__="1"><hr></div>')));

      expect(Object.keys(restored.children[0].props)).toEqual(['__proto__']);
    });

    it('표는 줄을 나눠도 왕복한다', () => {
      expect(formatHtml(htmlToVdom(TABLE))).toBe(
        lines(
          '<table class="t">',
          '  <caption>제목</caption>',
          '  <colgroup>',
          '    <col>',
          '    <col span="2">',
          '  </colgroup>',
          '  <thead>',
          '    <tr>',
          '      <th>a</th>',
          '    </tr>',
          '  </thead>',
          '  <tbody>',
          '    <tr>',
          '      <td>1</td>',
          '      <td>',
          '        <b>2</b>',
          '      </td>',
          '    </tr>',
          '  </tbody>',
          '  <tfoot>',
          '    <tr>',
          '      <td>합</td>',
          '    </tr>',
          '  </tfoot>',
          '</table>',
        ),
      );
    });

    it('최상위 표 요소도 줄을 나눈다', () => {
      expect(formatHtml(htmlToVdom('<tr><td>a</td></tr><tr><td>b</td></tr>'))).toBe(
        lines('<tr>', '  <td>a</td>', '</tr>', '<tr>', '  <td>b</td>', '</tr>'),
      );
      expect(formatHtml(htmlToVdom('<col><col>'))).toBe(lines('<col>', '<col>'));
    });

    it('정렬한 결과를 다시 정렬해도 같다', () => {
      const once = formatHtml(htmlToVdom(`<div>${'<p>a</p>'.repeat(3)}</div><ul><li><b>x</b></li></ul>`));

      expect(formatHtml(htmlToVdom(once))).toBe(once);
    });
  });

  describe('무작위 트리', () => {
    const TREE_COUNT = 1000;
    // 트리마다 세 번씩 파싱하므로, 부하가 큰 환경에서는 기본 제한인 5초를 넘길 수 있다.
    const TIMEOUT_MS = 30000;

    it('파서가 바꾸지 않는 트리는 정렬해도 왕복한다', () => {
      let stableCount = 0;
      let splitCount = 0;

      for (let seed = 1; seed <= TREE_COUNT; seed += 1) {
        const html = randomHtml(seed);
        const root = htmlToVdom(html);

        // 정렬 없이도 파서가 내용을 바꾸는 입력은 범위 밖이다.
        if (diff(root, htmlToVdom(vdomToHtml(root))).length > 0) continue;
        stableCount += 1;

        const formatted = formatHtml(root);
        const restored = htmlToVdom(formatted);
        const context = `seed ${seed}: ${JSON.stringify(html)}`;

        expect(restored, context).toStrictEqual(root);
        expect(diff(root, restored), context).toEqual([]);
        if (formatted !== vdomToHtml(root)) splitCount += 1;
      }

      // 조건에 걸러져서 아무것도 확인하지 못한 채 통과하지 않도록 표본 수를 함께 확인한다.
      expect(stableCount).toBeGreaterThan(TREE_COUNT / 2);
      expect(splitCount).toBeGreaterThan(TREE_COUNT / 4);
    }, TIMEOUT_MS);

    it('시드가 같으면 같은 입력을 만든다', () => {
      expect(randomHtml(7)).toBe(randomHtml(7));
      expect(randomHtml(7)).not.toBe(randomHtml(8));
    });
  });
});
