import { describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../../src/core/FunctionComponent.js';
import { h } from '../../src/core/h.js';
import { useState, withCurrentComponent, withoutHooks } from '../../src/core/hooks.js';

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
    function App() {
      useState(0);
      return null;
    }

    const { app } = mountApp(App);

    // 다른 종류의 Hook은 다음 단위에서 생기므로 칸의 종류를 직접 바꾼다.
    app.hooks[0].kind = 'memo';
    expect(() => app.update()).toThrow('종류');
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
