import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../../src/core/FunctionComponent.js';
import { createInspector, describeHook, visibleChanges } from '../../src/phase2/inspector.js';
import { useState } from '../../src/core/hooks.js';

let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.innerHTML = '';
});

const textChange = (value) => ({ kind: 'TEXT', path: [0], value });

describe('describeHook', () => {
  it('state, effect, memo 칸을 한 줄로 쓴다', () => {
    expect(describeHook({ kind: 'state', state: '송' }, 0)).toBe('0 useState: "송"');
    expect(describeHook({ kind: 'effect', deps: [1] }, 3)).toBe('3 useEffect: deps [1]');
    expect(describeHook({ kind: 'memo', value: '코드 장인', deps: [1] }, 5)).toBe('5 useMemo: "코드 장인"');
  });

  it('긴 값은 80자까지만 보이고 함수는 표시하지 않는다', () => {
    const line = describeHook({ kind: 'state', state: 'a'.repeat(200) }, 1);
    expect(line.length).toBeLessThan(100);
    expect(line.endsWith('…')).toBe(true);
    expect(describeHook({ kind: 'memo', value: () => 1 }, 2)).not.toContain('=>');
    expect(describeHook({ kind: 'effect', deps: undefined }, 4)).toBe('4 useEffect: deps 없음');
  });
});

describe('visibleChanges', () => {
  it('함수 값의 변경과 on 속성 삭제를 빼고 남는 내용이 없는 PROPS는 뺀다', () => {
    const fn = () => {};
    const changes = [
      { kind: 'PROPS', path: [0], set: { onClick: fn }, remove: ['onInput'] },
      textChange('x'),
    ];
    expect(visibleChanges(changes)).toEqual([textChange('x')]);
  });

  it('함수와 속성 변경이 섞이면 속성 변경만 남기고 입력을 바꾸지 않는다', () => {
    const fn = () => {};
    const changes = [{ kind: 'PROPS', path: [0], set: { onClick: fn, disabled: true }, remove: ['onInput', 'title'] }];
    const copy = { ...changes[0], set: { ...changes[0].set }, remove: [...changes[0].remove] };
    expect(visibleChanges(changes)).toEqual([{ kind: 'PROPS', path: [0], set: { disabled: true }, remove: ['title'] }]);
    expect(changes[0]).toEqual(copy);
  });
});

describe('createInspector', () => {
  const hooks = [{ kind: 'state', state: '송' }, { kind: 'effect', deps: [1] }];

  it('렌더 횟수가 늘고 칸 내용이 나온다', () => {
    const inspector = createInspector(container);
    inspector.record([], hooks);
    inspector.record([textChange('1')], hooks);
    expect(container.textContent).toContain('렌더 2회');
    expect(container.querySelector('.inspector-hooks').textContent).toContain('0 useState: "송"');
    expect(container.querySelector('.inspector-hooks').textContent).toContain('1 useEffect: deps [1]');
  });

  it('남는 변경이 없으면 화면 변경 없음이고 최신이 위이다', () => {
    const inspector = createInspector(container);
    inspector.record([{ kind: 'PROPS', path: [0], set: { onClick() {} } }], hooks);
    expect(container.querySelector('.inspector-log li').textContent).toContain('화면 변경 없음');
    inspector.record([textChange('9')], hooks);
    expect(container.querySelector('.inspector-log li').textContent).toContain('"9"');
  });

  it('기록은 최근 8줄만 남는다', () => {
    const inspector = createInspector(container);
    for (let i = 0; i < 12; i += 1) inspector.record([textChange(String(i))], hooks);
    const lines = [...container.querySelectorAll('.inspector-log li')];
    expect(lines).toHaveLength(8);
    expect(lines[0].textContent).toContain('"11"');
    expect(lines[7].textContent).toContain('"4"');
  });

  it('패널 갱신이 게임을 다시 렌더하지 않는다', () => {
    let renders = 0;
    const gameArea = document.createElement('div');
    const Game = () => {
      renders += 1;
      useState(0);
      return 'game';
    };
    const inspector = createInspector(container);
    const game = new FunctionComponent(Game, gameArea, { onCommit: (c) => inspector.record(c, game.hooks) });
    game.mount();
    const before = renders;
    inspector.record([], game.hooks);
    inspector.record([], game.hooks);
    expect(renders).toBe(before);
  });
});
