import { describe, expect, it } from 'vitest';
import { StateHistory } from '../../src/phase1/StateHistory.js';

/** 주어진 자식들을 가진 루트 노드를 만든다. */
function rootOf(...children) {
  return { type: 'root', props: {}, children };
}

/** 주어진 Virtual DOM을 순서대로 저장한 History를 만든다. */
function historyOf(...vdoms) {
  const history = new StateHistory();

  vdoms.forEach((vdom) => history.push(vdom));

  return history;
}

describe('StateHistory', () => {
  describe('push와 current', () => {
    it('저장한 값이 현재 값이 된다', () => {
      const first = rootOf('첫 상태');

      expect(historyOf(first).current()).toBe(first);
    });

    it('여러 번 저장하면 마지막 값이 현재 값이다', () => {
      const last = rootOf('c');

      expect(historyOf(rootOf('a'), rootOf('b'), last).current()).toBe(last);
    });

    it('복사하지 않고 같은 객체를 저장한다', () => {
      const first = rootOf('a');
      const second = rootOf('b');
      const history = historyOf(first, second);

      expect(history.current()).toBe(second);
      expect(history.back()).toBe(first);
      expect(history.current()).toBe(first);
      expect(history.forward()).toBe(second);
    });

    it('current를 여러 번 불러도 위치가 바뀌지 않는다', () => {
      const first = rootOf('a');
      const second = rootOf('b');
      const history = historyOf(first, second);

      history.current();
      history.current();

      expect(history.current()).toBe(second);
      expect(history.back()).toBe(first);
    });

    it('같은 객체를 두 번 저장해도 두 항목이 된다', () => {
      const first = rootOf('a');
      const history = historyOf(first, first);

      expect(history.back()).toBe(first);
      expect(history.back()).toBeNull();
    });

    it('내용이 같은 서로 다른 객체도 두 항목이 된다', () => {
      const first = rootOf('a');
      const second = rootOf('a');
      const history = historyOf(first, second);

      expect(history.current()).toBe(second);
      expect(history.back()).toBe(first);
      expect(history.back()).toBeNull();
    });

    it('여러 개를 저장해도 첫 항목까지 돌아갔다가 끝까지 올 수 있다', () => {
      const vdoms = Array.from({ length: 10 }, (_, index) => rootOf(String(index)));
      const history = historyOf(...vdoms);

      for (let index = vdoms.length - 2; index >= 0; index -= 1) {
        expect(history.back()).toBe(vdoms[index]);
      }
      expect(history.back()).toBeNull();

      for (let index = 1; index < vdoms.length; index += 1) {
        expect(history.forward()).toBe(vdoms[index]);
      }
      expect(history.forward()).toBeNull();
    });
  });

  describe('back', () => {
    it('이전 값을 돌려주고 포인터를 옮긴다', () => {
      const first = rootOf('a');
      const second = rootOf('b');
      const third = rootOf('c');
      const history = historyOf(first, second, third);

      expect(history.back()).toBe(second);
      expect(history.current()).toBe(second);
      expect(history.back()).toBe(first);
      expect(history.current()).toBe(first);
    });

    it('뒤로 가서 첫 상태로 돌아올 수 있다', () => {
      const first = rootOf('첫 상태');
      const history = historyOf(first, rootOf('수정'));

      history.back();

      expect(history.current()).toBe(first);
    });

    it('첫 항목에서는 null을 돌려주고 포인터를 유지한다', () => {
      const first = rootOf('a');
      const second = rootOf('b');
      const history = historyOf(first, second);

      history.back();

      expect(history.back()).toBeNull();
      expect(history.current()).toBe(first);
      expect(history.forward()).toBe(second);
    });

    it('항목이 하나이면 null을 돌려주고 포인터를 유지한다', () => {
      const first = rootOf('a');
      const history = historyOf(first);

      expect(history.back()).toBeNull();
      expect(history.current()).toBe(first);
    });
  });

  describe('forward', () => {
    it('다음 값을 돌려주고 포인터를 옮긴다', () => {
      const first = rootOf('a');
      const second = rootOf('b');
      const third = rootOf('c');
      const history = historyOf(first, second, third);

      history.back();
      history.back();

      expect(history.forward()).toBe(second);
      expect(history.current()).toBe(second);
      expect(history.forward()).toBe(third);
      expect(history.current()).toBe(third);
    });

    it('마지막 항목에서는 null을 돌려주고 포인터를 유지한다', () => {
      const first = rootOf('a');
      const second = rootOf('b');
      const history = historyOf(first, second);

      expect(history.forward()).toBeNull();
      expect(history.current()).toBe(second);
      expect(history.back()).toBe(first);
    });

    it('항목이 하나이면 null을 돌려주고 포인터를 유지한다', () => {
      const first = rootOf('a');
      const history = historyOf(first);

      expect(history.forward()).toBeNull();
      expect(history.current()).toBe(first);
    });
  });

  describe('뒤로 간 뒤 저장', () => {
    it('포인터 뒤의 기록을 지우고 마지막에 추가한다', () => {
      const first = rootOf('a');
      const second = rootOf('b');
      const third = rootOf('c');
      const replaced = rootOf('새 기록');
      const history = historyOf(first, second, third);

      history.back();
      history.back();
      history.push(replaced);

      expect(history.current()).toBe(replaced);
      expect(history.forward()).toBeNull();
      expect(history.back()).toBe(first);
      expect(history.back()).toBeNull();
    });

    it('포인터 앞의 기록은 유지한다', () => {
      const first = rootOf('a');
      const second = rootOf('b');
      const third = rootOf('c');
      const replaced = rootOf('새 기록');
      const history = historyOf(first, second, third);

      history.back();
      history.push(replaced);

      expect(history.back()).toBe(second);
      expect(history.back()).toBe(first);
      expect(history.forward()).toBe(second);
      expect(history.forward()).toBe(replaced);
      expect(history.forward()).toBeNull();
    });

    it('마지막 항목에서 저장하면 지울 기록 없이 이어서 쌓인다', () => {
      const first = rootOf('a');
      const second = rootOf('b');
      const third = rootOf('c');
      const history = historyOf(first, second);

      history.push(third);

      expect(history.back()).toBe(second);
      expect(history.back()).toBe(first);
    });
  });

  describe('빈 History', () => {
    it('current는 undefined를 돌려준다', () => {
      expect(new StateHistory().current()).toBeUndefined();
    });

    it('back과 forward는 null을 돌려준다', () => {
      const history = new StateHistory();

      expect(history.back()).toBeNull();
      expect(history.forward()).toBeNull();
    });

    it('이동에 실패해도 첫 저장이 정상으로 동작한다', () => {
      const first = rootOf('a');
      const history = new StateHistory();

      history.back();
      history.forward();
      history.push(first);

      expect(history.current()).toBe(first);
      expect(history.back()).toBeNull();
      expect(history.forward()).toBeNull();
    });
  });

  it('인스턴스끼리 기록을 공유하지 않는다', () => {
    const first = rootOf('a');
    const second = rootOf('b');
    const history = historyOf(first);
    const other = historyOf(second);

    expect(history.current()).toBe(first);
    expect(other.current()).toBe(second);
    expect(other.back()).toBeNull();
  });
});
