import { describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../../src/core/FunctionComponent.js';
import { h } from '../../src/core/h.js';
import { useEffect, useMemo, useState, withCurrentComponent, withoutHooks } from '../../src/core/hooks.js';

/** 컴포넌트를 새 영역에 마운트하고 인스턴스와 영역을 돌려준다. */
function mountApp(component) {
  const container = document.createElement('div');
  const app = new FunctionComponent(component, container);
  app.mount();
  return { app, container };
}

describe('useState', () => {
  it('초기값과 setState를 돌려주고 칸을 만든다', () => {
    let pair;
    function App() {
      pair = useState('처음');
      return null;
    }

    const { app } = mountApp(App);

    expect(pair[0]).toBe('처음');
    expect(pair[1]).toBeTypeOf('function');
    expect(app.hooks).toHaveLength(1);
    expect(app.hooks[0].kind).toBe('state');
    expect(app.hooks[0].state).toBe('처음');
  });

  it('여러 useState는 호출 순서로 자기 칸을 찾는다', async () => {
    let setA;
    let setB;
    function App() {
      const [a, nextA] = useState('a');
      const [b, nextB] = useState('b');
      setA = nextA;
      setB = nextB;
      return h('p', null, a, b);
    }

    const { container } = mountApp(App);

    setB('B');
    await Promise.resolve();
    expect(container.textContent).toBe('aB');

    setA('A');
    await Promise.resolve();
    expect(container.textContent).toBe('AB');
  });

  it('함수 초기값은 호출하지 않고 값으로 저장한다', () => {
    const initial = vi.fn();
    let value;
    function App() {
      [value] = useState(initial);
      return null;
    }

    mountApp(App);

    expect(value).toBe(initial);
    expect(initial).not.toHaveBeenCalled();
  });

  it('한 핸들러의 setState 3번에 컴포넌트는 한 번 실행된다', async () => {
    const component = vi.fn(() => {
      const [a, setA] = useState(0);
      const [b, setB] = useState(0);
      const [c, setC] = useState(0);
      const onClick = () => {
        setA(1);
        setB(2);
        setC(3);
      };
      return h('button', { onClick }, a, b, c);
    });

    const { container } = mountApp(component);
    expect(component).toHaveBeenCalledTimes(1);

    container.firstChild.click();
    expect(component).toHaveBeenCalledTimes(1);
    await Promise.resolve();

    expect(component).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('123');
  });

  it('함수형 업데이트 두 번은 2가 된다', async () => {
    function App() {
      const [count, setCount] = useState(0);
      const onClick = () => {
        setCount((value) => value + 1);
        setCount((value) => value + 1);
      };
      return h('button', { onClick }, count);
    }

    const { container } = mountApp(App);
    container.firstChild.click();
    await Promise.resolve();

    expect(container.textContent).toBe('2');
  });

  it('setCount(count + 1) 두 번은 1이 된다', async () => {
    function App() {
      const [count, setCount] = useState(0);
      const onClick = () => {
        setCount(count + 1);
        setCount(count + 1);
      };
      return h('button', { onClick }, count);
    }

    const { container } = mountApp(App);
    container.firstChild.click();
    await Promise.resolve();

    expect(container.textContent).toBe('1');
  });

  it('같은 값이면 렌더하지 않는다', async () => {
    let setValue;
    const component = vi.fn(() => {
      const [value, set] = useState(NaN);
      setValue = set;
      return h('p', null, String(value));
    });

    const { app } = mountApp(component);

    setValue(NaN);
    setValue((value) => value);
    expect(app.isScheduled).toBe(false);
    await Promise.resolve();

    expect(component).toHaveBeenCalledTimes(1);
  });

  it('Object.is로 비교하므로 0과 -0은 다른 값이다', async () => {
    let setValue;
    const component = vi.fn(() => {
      const [value, set] = useState(0);
      setValue = set;
      return h('p', null, String(value));
    });

    mountApp(component);

    setValue(-0);
    await Promise.resolve();

    expect(component).toHaveBeenCalledTimes(2);
  });

  it('setState는 렌더마다 같은 함수이다', async () => {
    const setters = [];
    function App() {
      const [count, setCount] = useState(0);
      setters.push(setCount);
      return h('p', null, count);
    }

    mountApp(App);
    setters[0](1);
    await Promise.resolve();

    expect(setters).toHaveLength(2);
    expect(setters[1]).toBe(setters[0]);
  });

  it('렌더 중 setState는 오류이다', async () => {
    let setCount;
    let shouldSet = false;
    function App() {
      const [count, set] = useState(0);
      setCount = set;
      if (shouldSet) set(count + 1);
      return h('p', null, count);
    }

    const { app, container } = mountApp(App);

    shouldSet = true;
    expect(() => app.update()).toThrow('렌더 중');
    expect(app.hooks[0].state).toBe(0);
    expect(app.isScheduled).toBe(false);

    shouldSet = false;
    setCount(1);
    await Promise.resolve();

    expect(container.textContent).toBe('1');
  });

  it('자식 컴포넌트 렌더 중 setState도 오류이다', () => {
    function Child({ setCount }) {
      setCount(1);
      return null;
    }
    function App() {
      const [, setCount] = useState(0);
      return h('div', null, h(Child, { setCount }));
    }

    const app = new FunctionComponent(App, document.createElement('div'));

    expect(() => app.mount()).toThrow('렌더 중');
  });

  it('렌더 밖 Hook은 오류이다', () => {
    expect(() => useState(0)).toThrow('렌더 중에만');
  });

  it('렌더가 끝난 뒤의 Hook과 렌더가 실패한 뒤의 Hook도 오류이다', () => {
    mountApp(() => null);
    expect(() => useState(0)).toThrow('렌더 중에만');

    const app = new FunctionComponent(() => {
      throw new Error('렌더 실패');
    }, document.createElement('div'));
    expect(() => app.mount()).toThrow('렌더 실패');
    expect(() => useState(0)).toThrow('렌더 중에만');
  });

  it('자식 컴포넌트의 Hook은 오류이다', () => {
    function Child() {
      useState(0);
      return null;
    }
    function App() {
      return h('div', null, h(Child));
    }

    const app = new FunctionComponent(App, document.createElement('div'));

    expect(() => app.mount()).toThrow('렌더 중에만');
    expect(app.hooks).toEqual([]);
  });

  it('자식 컴포넌트를 실행한 뒤에도 루트의 Hook이 동작한다', () => {
    const Child = () => h('b', null, '자식');
    function App() {
      const child = h(Child);
      const [value] = useState('루트');
      return h('div', null, child, value);
    }

    const { container } = mountApp(App);

    expect(container.innerHTML).toBe('<div><b>자식</b>루트</div>');
  });

  it('자식 컴포넌트가 실패해도 루트의 Hook이 동작한다', () => {
    const Child = () => {
      throw new Error('자식 실패');
    };
    function App() {
      try {
        h(Child);
      } catch {
        // 루트가 오류를 처리한 뒤 계속 렌더한다.
      }
      const [value] = useState('루트');
      return value;
    }

    const { container } = mountApp(App);

    expect(container.textContent).toBe('루트');
  });

  it('Hook 개수가 늘면 오류이다', () => {
    let extra = false;
    function App() {
      useState(0);
      if (extra) useState(1);
      return null;
    }

    const { app } = mountApp(App);

    extra = true;
    expect(() => app.update()).toThrow('개수');
    expect(app.hooks).toHaveLength(1);
  });

  it('Hook 개수가 줄면 오류이다', () => {
    let skip = false;
    function App() {
      useState(0);
      if (!skip) useState(1);
      return null;
    }

    const { app, container } = mountApp(App);
    const vdomBefore = app.vdom;

    skip = true;
    expect(() => app.update()).toThrow('개수');
    expect(app.vdom).toBe(vdomBefore);
    expect(container.innerHTML).toBe('');
  });

  it('Hook 종류가 바뀌면 오류이다', () => {
    let changed = false;
    function App() {
      if (changed) useMemo(() => 0, []);
      else useState(0);
      return null;
    }

    const { app } = mountApp(App);

    changed = true;
    expect(() => app.update()).toThrow('종류');
  });
});

describe('useEffect', () => {
  /** 예약한 마이크로태스크를 실행하지 않고 모아 둔다. */
  function holdTasks() {
    const tasks = [];
    const spy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => tasks.push(task));
    /** 모아 둔 작업을 비울 때까지 실행한다. 구현이 틀려도 테스트가 멈추지 않도록 횟수를 제한한다. */
    const drain = () => {
      for (let count = 0; tasks.length > 0 && count < 200; count += 1) tasks.shift()();
    };
    return { tasks, drain, restore: () => spy.mockRestore() };
  }

  it('effect 안에서 방금 그린 DOM을 읽을 수 있다. 렌더 중에는 실행되지 않는다.', () => {
    const seen = [];
    let app;
    let label = '처음';
    function App() {
      useEffect(() => {
        seen.push([app.container.textContent, app.isRendering, app.vdom.children[0].children[0]]);
      });
      expect(seen).toHaveLength(label === '처음' ? 0 : 1);
      return h('p', null, label);
    }

    app = new FunctionComponent(App, document.createElement('div'));
    app.mount();
    expect(seen).toEqual([['처음', false, '처음']]);

    label = '다음';
    app.update();
    expect(seen).toEqual([['처음', false, '처음'], ['다음', false, '다음']]);
  });

  it('deps 없음, `[]`, `[a]`의 실행 시점이 설계와 같다. 길이가 다르면 실행한다.', () => {
    const always = vi.fn();
    const once = vi.fn();
    const onA = vi.fn();
    const onLength = vi.fn();
    let a = 1;
    let deps = [1];
    function App() {
      useEffect(always);
      useEffect(once, []);
      useEffect(onA, [a]);
      useEffect(onLength, deps);
      return null;
    }
    const counts = () => [always, once, onA, onLength].map((effect) => effect.mock.calls.length);

    const { app } = mountApp(App);
    expect(counts()).toEqual([1, 1, 1, 1]);

    app.update();
    expect(counts()).toEqual([2, 1, 1, 1]);

    a = 2;
    app.update();
    expect(counts()).toEqual([3, 1, 2, 1]);

    deps = [1, 2];
    app.update();
    expect(counts()).toEqual([4, 1, 2, 2]);

    deps = [1];
    app.update();
    expect(counts()).toEqual([5, 1, 2, 3]);
  });

  it('`Object.is`로 비교한다. `NaN`은 같고, `0`과 `-0`은 다르다.', () => {
    const effect = vi.fn();
    let value = NaN;
    function App() {
      useEffect(effect, [value]);
      return null;
    }

    const { app } = mountApp(App);

    app.update();
    expect(effect).toHaveBeenCalledTimes(1);

    value = 0;
    app.update();
    expect(effect).toHaveBeenCalledTimes(2);

    value = -0;
    app.update();
    expect(effect).toHaveBeenCalledTimes(3);

    app.update();
    expect(effect).toHaveBeenCalledTimes(3);
  });

  it('다시 실행할 때 cleanup이 먼저 돈다. 여러 effect는 cleanup을 모두 실행한 뒤 effect를 실행한다.', () => {
    const log = [];
    let a = 1;
    function App() {
      const value = a;
      useEffect(() => {
        log.push(`effect 1: ${value}`);
        return () => log.push(`cleanup 1: ${value}`);
      }, [value]);
      useEffect(() => {
        log.push(`effect 2: ${value}`);
        return () => log.push(`cleanup 2: ${value}`);
      }, [value]);
      return null;
    }

    const { app } = mountApp(App);
    expect(log).toEqual(['effect 1: 1', 'effect 2: 1']);

    log.length = 0;
    app.update();
    expect(log).toEqual([]);

    a = 2;
    app.update();
    expect(log).toEqual(['cleanup 1: 1', 'cleanup 2: 1', 'effect 1: 2', 'effect 2: 2']);
  });

  it('함수가 아닌 반환값은 cleanup으로 쓰지 않는다.', () => {
    const cleanup = vi.fn();
    const results = [cleanup, 3, undefined];
    const effect = vi.fn(() => results.shift());
    function App() {
      useEffect(effect);
      return null;
    }

    const { app } = mountApp(App);
    expect(app.hooks[0].cleanup).toBe(cleanup);

    app.update();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(app.hooks[0].cleanup).toBeUndefined();

    app.update();
    app.update();
    expect(effect).toHaveBeenCalledTimes(4);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('변경 목록이 비어 있어도 deps가 바뀌면 실행한다.', () => {
    const effect = vi.fn();
    let a = 1;
    function App() {
      useEffect(effect, [a]);
      return h('p', null, '그대로');
    }

    const { app, container } = mountApp(App);
    const paragraph = container.firstChild;

    a = 2;
    app.update();

    expect(effect).toHaveBeenCalledTimes(2);
    expect(container.firstChild).toBe(paragraph);
  });

  it('렌더나 `patch`가 실패하면 effect는 실행되지 않고, 다음 렌더에서 다시 실행된다.', () => {
    const effect = vi.fn();
    let a = 1;
    let failure = null;
    function App() {
      useEffect(effect, [a]);
      if (failure === 'render') throw new Error('렌더 실패');
      // 공백이 든 속성 이름은 setAttribute가 거부한다.
      return h('p', failure === 'patch' ? { 'bad name': 'x' } : null, '글');
    }

    const { app } = mountApp(App);

    a = 2;
    failure = 'render';
    expect(() => app.update()).toThrow('렌더 실패');
    expect(effect).toHaveBeenCalledTimes(1);
    expect(app.hooks[0].deps).toEqual([1]);
    expect(app.pendingEffects).toEqual([{ hook: app.hooks[0], effect, deps: [2] }]);

    failure = 'patch';
    expect(() => app.update()).toThrow();
    expect(effect).toHaveBeenCalledTimes(1);
    expect(app.hooks[0].deps).toEqual([1]);

    failure = null;
    app.update();
    expect(effect).toHaveBeenCalledTimes(2);
    expect(app.hooks[0].deps).toEqual([2]);
    expect(app.pendingEffects).toEqual([]);

    app.update();
    expect(effect).toHaveBeenCalledTimes(2);
  });

  it('첫 렌더가 실패하면 effect는 실행되지 않고, 다시 mount()할 때 실행된다.', () => {
    const effect = vi.fn();
    let shouldFail = true;
    function App() {
      useEffect(effect, []);
      if (shouldFail) throw new Error('렌더 실패');
      return null;
    }

    const app = new FunctionComponent(App, document.createElement('div'));

    expect(() => app.mount()).toThrow('렌더 실패');
    expect(effect).not.toHaveBeenCalled();

    shouldFail = false;
    app.mount();
    expect(effect).toHaveBeenCalledTimes(1);
  });

  it('effect 안의 `setState`는 렌더가 겹치지 않는다. 끝없이 예약하면 50번을 넘을 때 오류를 던지고 탭이 멈추지 않는다.', async () => {
    const once = vi.fn(() => {
      const [count, setCount] = useState(0);
      useEffect(() => {
        const calls = once.mock.calls.length;
        setCount(1);
        expect(once).toHaveBeenCalledTimes(calls);
      }, []);
      return h('p', null, count);
    });

    const { container } = mountApp(once);
    expect(once).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('0');
    await Promise.resolve();
    expect(once).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe('1');

    const held = holdTasks();
    const endless = vi.fn(() => {
      const [count, setCount] = useState(0);
      useEffect(() => setCount(count + 1));
      return h('p', null, count);
    });

    const { app, container: endlessContainer } = mountApp(endless);

    expect(held.drain).toThrow('50');
    held.restore();

    expect(held.tasks).toEqual([]);
    expect(app.isScheduled).toBe(false);
    expect(endless).toHaveBeenCalledTimes(51);
    expect(endlessContainer.textContent).toBe('50');
  });

  it('한 effect 실행에서 setState를 여러 번 불러도 예약은 한 번으로 센다', () => {
    const held = holdTasks();
    function App() {
      const [a, setA] = useState(0);
      const [b, setB] = useState(0);
      useEffect(() => {
        if (a >= 30) return;
        setA(a + 1);
        setB(b + 1);
      });
      return h('p', null, a, '-', b);
    }

    const { container } = mountApp(App);

    held.drain();
    held.restore();

    expect(container.textContent).toBe('30-30');
  });

  it('effect 밖에서 예약하면 횟수를 0으로 되돌린다', () => {
    const held = holdTasks();
    let setTarget;
    function App() {
      const [target, nextTarget] = useState(0);
      const [count, setCount] = useState(0);
      setTarget = nextTarget;
      useEffect(() => {
        if (count < target) setCount(count + 1);
      });
      return h('p', null, count);
    }

    const { container } = mountApp(App);

    setTarget(40);
    held.drain();
    expect(container.textContent).toBe('40');

    setTarget(80);
    held.drain();
    held.restore();

    expect(container.textContent).toBe('80');
  });

  it('횟수를 넘긴 뒤 칸의 값이 화면과 다르면 같은 값의 setState로 다시 렌더한다', () => {
    const held = holdTasks();
    let setCount;
    let endless = true;
    function App() {
      const [count, set] = useState(0);
      setCount = set;
      useEffect(() => {
        if (endless) set(count + 1);
      });
      return h('p', null, count);
    }

    const { app, container } = mountApp(App);

    expect(held.drain).toThrow('50');
    expect(container.textContent).toBe('50');
    expect(app.hooks[0].state).toBe(51);
    expect(app.isStale).toBe(true);

    endless = false;
    setCount(51);
    held.drain();
    held.restore();

    expect(container.textContent).toBe('51');
    expect(app.isStale).toBe(false);
  });

  it('cleanup 안의 setState도 횟수에 들어간다', () => {
    const held = holdTasks();
    function App() {
      const [count, setCount] = useState(0);
      useEffect(() => () => setCount((value) => value + 1));
      return h('p', null, count);
    }

    const { app } = mountApp(App);

    app.update();
    expect(held.drain).toThrow('50');
    held.restore();
  });

  it('update()의 effect가 실패해도 렌더 실패가 아니다', () => {
    let shouldFail = false;
    let label = '처음';
    function App() {
      useEffect(() => {
        if (shouldFail) throw new Error('effect 실패');
      });
      return h('p', null, label);
    }

    const { app, container } = mountApp(App);
    const vdomBefore = app.vdom;

    label = '다음';
    shouldFail = true;
    expect(() => app.update()).toThrow('effect 실패');

    expect(container.textContent).toBe('다음');
    expect(app.vdom).not.toBe(vdomBefore);
    expect(app.isStale).toBe(false);
  });

  it('mount()의 effect가 실패해도 마운트는 끝난 상태이다', () => {
    function App() {
      useEffect(() => {
        throw new Error('effect 실패');
      });
      return h('p', null, '글');
    }

    const container = document.createElement('div');
    const app = new FunctionComponent(App, container);

    expect(() => app.mount()).toThrow('effect 실패');
    expect(container.textContent).toBe('글');
    expect(app.vdom).not.toBeNull();
    expect(() => app.mount()).toThrow('이미 마운트');
  });

  it('cleanup이 실패하면 실행하지 못한 effect는 다음 렌더에서 실행하고 cleanup은 두 번 돌지 않는다', () => {
    const failing = vi.fn(() => {
      throw new Error('cleanup 실패');
    });
    const later = vi.fn();
    const laterCleanup = vi.fn();
    const effect = vi.fn(() => failing);
    let a = 1;
    function App() {
      useEffect(effect, [a]);
      useEffect(() => {
        later();
        return laterCleanup;
      }, [a]);
      return null;
    }

    const { app } = mountApp(App);

    a = 2;
    expect(() => app.update()).toThrow('cleanup 실패');
    expect(effect).toHaveBeenCalledTimes(1);
    expect(laterCleanup).not.toHaveBeenCalled();
    expect(app.pendingEffects).toEqual([]);

    effect.mockImplementation(() => undefined);
    app.update();

    expect(failing).toHaveBeenCalledTimes(1);
    expect(laterCleanup).toHaveBeenCalledTimes(1);
    expect(effect).toHaveBeenCalledTimes(2);
    expect(later).toHaveBeenCalledTimes(2);
  });

  it('effect가 실패하면 뒤의 effect는 다음 렌더에서 실행한다', () => {
    const later = vi.fn();
    let a = 1;
    let shouldFail = false;
    function App() {
      useEffect(() => {
        if (shouldFail) throw new Error('effect 실패');
      }, [a]);
      useEffect(later, [a]);
      return null;
    }

    const { app } = mountApp(App);

    a = 2;
    shouldFail = true;
    expect(() => app.update()).toThrow('effect 실패');
    expect(later).toHaveBeenCalledTimes(1);

    shouldFail = false;
    app.update();
    expect(later).toHaveBeenCalledTimes(2);
  });

  it('effect가 실패한 뒤 deps가 이전 값으로 돌아가도 정리된 effect는 다음 렌더에서 다시 실행된다', () => {
    const log = [];
    let x = 1;
    let shouldFail = false;
    function App() {
      const value = x;
      useEffect(() => {
        if (shouldFail) throw new Error('effect 실패');
      }, [value]);
      useEffect(() => {
        log.push(`sub ${value}`);
        return () => log.push(`unsub ${value}`);
      }, [value]);
      return null;
    }

    const { app } = mountApp(App);

    x = 2;
    shouldFail = true;
    expect(() => app.update()).toThrow('effect 실패');
    expect(log).toEqual(['sub 1', 'unsub 1']);

    x = 1;
    shouldFail = false;
    app.update();
    app.update();

    expect(log).toEqual(['sub 1', 'unsub 1', 'sub 1']);
  });

  it('cleanup이 실패한 뒤 deps가 이전 값으로 돌아가도 정리된 effect는 다음 렌더에서 다시 실행된다', () => {
    const log = [];
    let x = 1;
    let shouldFail = false;
    function App() {
      const value = x;
      useEffect(() => {
        log.push(`sub ${value}`);
        return () => {
          log.push(`unsub ${value}`);
          if (shouldFail) throw new Error('cleanup 실패');
        };
      }, [value]);
      return null;
    }

    const { app } = mountApp(App);

    x = 2;
    shouldFail = true;
    expect(() => app.update()).toThrow('cleanup 실패');
    expect(log).toEqual(['sub 1', 'unsub 1']);

    x = 1;
    shouldFail = false;
    app.update();
    app.update();

    expect(log).toEqual(['sub 1', 'unsub 1', 'sub 1']);
  });

  it('cleanup이 실패해 정리되지 않은 뒤의 effect는 deps가 이전 값으로 돌아가면 그대로 살아 있다', () => {
    const log = [];
    let x = 1;
    let shouldFail = false;
    function App() {
      const value = x;
      useEffect(() => () => {
        if (shouldFail) throw new Error('cleanup 실패');
      }, [value]);
      useEffect(() => {
        log.push(`sub ${value}`);
        return () => log.push(`unsub ${value}`);
      }, [value]);
      return null;
    }

    const { app } = mountApp(App);

    x = 2;
    shouldFail = true;
    expect(() => app.update()).toThrow('cleanup 실패');

    x = 1;
    shouldFail = false;
    app.update();
    expect(log).toEqual(['sub 1']);

    x = 2;
    app.update();
    expect(log).toEqual(['sub 1', 'unsub 1', 'sub 2']);
  });

  it('오류를 던진 effect는 deps가 같으면 다시 실행되지 않는다', () => {
    let a = 1;
    const effect = vi.fn(() => {
      if (a === 2) throw new Error('effect 실패');
    });
    function App() {
      useEffect(effect, [a]);
      return null;
    }

    const { app } = mountApp(App);

    a = 2;
    expect(() => app.update()).toThrow('effect 실패');
    expect(effect).toHaveBeenCalledTimes(2);

    app.update();
    expect(effect).toHaveBeenCalledTimes(2);
  });

  it('effect가 실패해도 isRunningEffects가 복구된다', () => {
    const seen = [];
    let app;
    let shouldFail = false;
    function App() {
      useEffect(() => {
        seen.push(app.isRunningEffects);
        if (shouldFail) throw new Error('effect 실패');
      });
      return null;
    }

    app = new FunctionComponent(App, document.createElement('div'));
    app.mount();
    expect(seen).toEqual([true]);
    expect(app.isRunningEffects).toBe(false);

    shouldFail = true;
    expect(() => app.update()).toThrow('effect 실패');
    expect(seen).toEqual([true, true]);
    expect(app.isRunningEffects).toBe(false);
  });

  it('한도 오류 때 횟수가 0으로 돌아간다', () => {
    const held = holdTasks();
    function App() {
      const [count, setCount] = useState(0);
      useEffect(() => setCount(count + 1));
      return h('p', null, count);
    }

    const { app } = mountApp(App);
    expect(app.effectUpdateCount).toBe(1);

    expect(held.drain).toThrow('50');
    held.restore();

    expect(app.effectUpdateCount).toBe(0);
  });

  it('deps가 배열에서 없음으로 바뀌면 실행된다', () => {
    const effect = vi.fn();
    let deps = [1];
    function App() {
      useEffect(effect, deps);
      return null;
    }

    const { app } = mountApp(App);

    app.update();
    expect(effect).toHaveBeenCalledTimes(1);

    deps = undefined;
    app.update();
    expect(effect).toHaveBeenCalledTimes(2);
  });

  it('칸을 만들고 렌더 밖에서는 오류이다', () => {
    function App() {
      useEffect(() => {}, []);
      return null;
    }

    const { app } = mountApp(App);

    expect(app.hooks[0].kind).toBe('effect');
    expect(() => useEffect(() => {})).toThrow('렌더 중에만');
  });
});

describe('useMemo', () => {
  it('`useMemo`는 deps가 같으면 계산하지 않고 저장한 값을 돌려주며, deps가 없으면 매번 계산한다.', () => {
    const cached = vi.fn(() => ({}));
    const always = vi.fn(() => ({}));
    const seen = [];
    let a = NaN;
    function App() {
      seen.push([useMemo(cached, [a]), useMemo(always)]);
      return null;
    }

    const { app } = mountApp(App);
    expect(cached).toHaveBeenCalledTimes(1);
    expect(always).toHaveBeenCalledTimes(1);
    expect(app.hooks[0].kind).toBe('memo');

    app.update();
    expect(cached).toHaveBeenCalledTimes(1);
    expect(always).toHaveBeenCalledTimes(2);
    expect(seen[1][0]).toBe(seen[0][0]);
    expect(seen[1][1]).not.toBe(seen[0][1]);

    a = 0;
    app.update();
    expect(cached).toHaveBeenCalledTimes(2);
    expect(seen[2][0]).not.toBe(seen[1][0]);

    a = -0;
    app.update();
    expect(cached).toHaveBeenCalledTimes(3);
  });

  it('값을 이번 렌더의 Virtual DOM에 쓸 수 있다', () => {
    let a = 2;
    function App() {
      const doubled = useMemo(() => a * 2, [a]);
      return h('p', null, doubled);
    }

    const { app, container } = mountApp(App);
    expect(container.textContent).toBe('4');

    a = 3;
    app.update();
    expect(container.textContent).toBe('6');
  });

  it('undefined로 계산한 값도 deps가 같으면 다시 계산하지 않는다', () => {
    const compute = vi.fn(() => undefined);
    function App() {
      useMemo(compute, []);
      return null;
    }

    const { app } = mountApp(App);

    app.update();
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('계산이 실패하면 칸은 그대로이고 다음 렌더에서 다시 계산한다', () => {
    let a = 1;
    let shouldFail = false;
    let value;
    function App() {
      value = useMemo(() => {
        if (shouldFail) throw new Error('계산 실패');
        return a;
      }, [a]);
      return null;
    }

    const { app } = mountApp(App);

    a = 2;
    shouldFail = true;
    expect(() => app.update()).toThrow('계산 실패');
    expect(app.hooks[0].value).toBe(1);
    expect(app.hooks[0].deps).toEqual([1]);

    shouldFail = false;
    app.update();
    expect(value).toBe(2);
  });

  it('렌더 밖에서는 오류이다', () => {
    expect(() => useMemo(() => 1, [])).toThrow('렌더 중에만');
  });
});

describe('withCurrentComponent', () => {
  it('run의 결과를 돌려주고 끝나면 이전 컴포넌트로 되돌린다', () => {
    const inner = vi.fn(() => {
      useState('안');
      return null;
    });
    let value;
    function Outer() {
      new FunctionComponent(inner, document.createElement('div')).mount();
      [value] = useState('밖');
      return null;
    }

    const { app } = mountApp(Outer);

    expect(value).toBe('밖');
    expect(app.hooks).toHaveLength(1);
    expect(withCurrentComponent(null, () => 3)).toBe(3);
  });
});

describe('withoutHooks', () => {
  it('run의 결과를 돌려주고 실행하는 동안 Hook을 막는다', () => {
    expect(withoutHooks(() => 3)).toBe(3);

    function App() {
      withoutHooks(() => expect(() => useState(0)).toThrow('렌더 중에만'));
      return null;
    }

    const { app } = mountApp(App);

    expect(app.hooks).toEqual([]);
  });
});
