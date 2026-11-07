import { describe, expect, it } from 'vitest';
import { describeChanges } from '../../src/phase1/describeChanges.js';

const el = (type) => ({ type, props: {}, children: [] });
const removes = (count) => Array.from({ length: count }, (_, i) => ({ kind: 'REMOVE', path: [i] }));

describe('describeChanges', () => {
  it('ADD는 태그나 텍스트를 말한다', () => {
    expect(describeChanges([{ kind: 'ADD', path: [0], node: el('li') }])).toBe('<li> 추가');
    expect(describeChanges([{ kind: 'ADD', path: [0], node: '글' }])).toBe('텍스트 추가');
  });

  it('REMOVE는 노드 삭제이다', () => {
    expect(describeChanges(removes(1))).toBe('노드 삭제');
  });

  it('TEXT는 새 값을 보여 주고 20자를 넘으면 자른다', () => {
    expect(describeChanges([{ kind: 'TEXT', path: [0], value: '배' }])).toBe('텍스트 "배"로 변경');
    expect(describeChanges([{ kind: 'TEXT', path: [0], value: 'a'.repeat(21) }])).toBe(
      `텍스트 "${'a'.repeat(20)}…"로 변경`,
    );
    expect(describeChanges([{ kind: 'TEXT', path: [0], value: 'a'.repeat(20) }])).not.toContain('…');
  });

  it('REPLACE는 태그나 텍스트를 말한다', () => {
    expect(describeChanges([{ kind: 'REPLACE', path: [0], node: el('h1') }])).toBe('<h1>로 교체');
    expect(describeChanges([{ kind: 'REPLACE', path: [0], node: '글' }])).toBe('텍스트로 교체');
  });

  it('PROPS는 변경과 삭제를 쉼표로 잇는다', () => {
    expect(describeChanges([{ kind: 'PROPS', path: [], set: { class: 'a' }, remove: [] }])).toBe('class 변경');
    expect(describeChanges([{ kind: 'PROPS', path: [], set: {}, remove: ['id'] }])).toBe('id 삭제');
    expect(describeChanges([{ kind: 'PROPS', path: [], set: { class: 'a' }, remove: ['id'] }])).toBe(
      'class 변경, id 삭제',
    );
  });

  it('항목은 쉼표로 잇고 4개까지는 모두 보여 준다', () => {
    expect(describeChanges(removes(4))).toBe('노드 삭제, 노드 삭제, 노드 삭제, 노드 삭제');
  });

  it('4개가 넘으면 앞의 3개 뒤에 외 N개를 붙인다', () => {
    expect(describeChanges(removes(6))).toBe('노드 삭제, 노드 삭제, 노드 삭제, 외 3개');
  });
});
