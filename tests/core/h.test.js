import { describe, expect, it } from 'vitest';
import { h, normalizeChildren } from '../../src/core/h.js';

describe('h', () => {
  it('속성과 자식이 없으면 빈 props와 children을 가진다', () => {
    expect(h('div')).toEqual({ type: 'div', props: {}, children: [] });
    expect(h('div', null)).toEqual({ type: 'div', props: {}, children: [] });
  });

  it('자식을 정규화한다', () => {
    const liA = h('li', null, 'a');
    const ul = h('ul', null, 3, false, [liA, null, ['사과', 0]], undefined, 'b');
    expect(ul.children).toEqual(['3', liA, '사과', '0', 'b']);
  });

  it('빈 문자열은 남기고 나란한 문자열은 합치지 않는다', () => {
    expect(h('p', null, '', 'a', 'b').children).toEqual(['', 'a', 'b']);
  });

  it('일반 객체나 함수 자식은 TypeError를 던진다', () => {
    expect(() => h('div', null, { a: 1 })).toThrow(TypeError);
    expect(() => normalizeChildren([() => {}])).toThrow(TypeError);
  });

  it('속성을 정규화한다', () => {
    const fn = () => {};
    const node = h('input', {
      a: null, b: undefined, c: false, d: true, e: 5, f: 'x', onClick: fn,
    });
    expect(node.props).toEqual({ d: '', e: '5', f: 'x', onClick: fn });
    expect(node.props.onClick).toBe(fn);
  });

  it('함수 타입은 props와 정규화된 children으로 호출한 결과를 돌려준다', () => {
    const calls = [];
    const Child = (props) => {
      calls.push(props);
      return h('b', null, '결과');
    };
    const result = h(Child, { a: 1 }, '글');
    expect(calls).toEqual([{ a: 1, children: ['글'] }]);
    expect(calls[0].a).toBe(1);
    expect(result).toEqual({ type: 'b', props: {}, children: ['결과'] });
  });

  it('자식 컴포넌트가 배열이나 null을 돌려줘도 부모 children이 정리된다', () => {
    const Many = () => ['x', 'y'];
    const Nothing = () => null;
    const parent = h('div', null, h(Many), h(Nothing), 'z');
    expect(parent.children).toEqual(['x', 'y', 'z']);
  });
});
