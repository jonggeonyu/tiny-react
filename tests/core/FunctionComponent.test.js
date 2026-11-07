import { describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../../src/core/FunctionComponent.js';
import { h } from '../../src/core/h.js';
import { useEffect, useState } from '../../src/core/hooks.js';

/** 컴포넌트를 새 영역에 마운트하고 인스턴스와 영역을 돌려준다. */
function mountApp(component) {
  const container = document.createElement('div');
  const app = new FunctionComponent(component, container);
  app.mount();
  return { app, container };
}

describe('FunctionComponent', () => {
  it('처음 필드는 비어 있고 세 번째 인자는 생략할 수 있다', () => {
    const container = document.createElement('div');
    const component = () => null;
    const app = new FunctionComponent(component, container);

    expect(app.component).toBe(component);
    expect(app.container).toBe(container);
    expect(app.hooks).toEqual([]);
    expect(app.hookIndex).toBe(0);
    expect(app.pendingEffects).toEqual([]);
    expect(app.vdom).toBeNull();
    expect(app.isRendering).toBe(false);
    expect(app.isScheduled).toBe(false);
    expect(app.isStale).toBe(false);
  });

  it('컴포넌트 함수를 빈 객체와 함께 호출하고 결과를 root로 감싸 저장한다', () => {
    const component = vi.fn(() => h('p', null, '글'));
    const { app } = mountApp(component);

    expect(component).toHaveBeenCalledWith({});
    expect(app.vdom).toEqual({
      type: 'root',
      props: {},
      children: [{ type: 'p', props: {}, children: ['글'] }],
    });
  });

  it('mount()가 그리고, setState 뒤에 화면이 바뀌고, 바뀌지 않은 DOM 노드는 같은 객체이다', async () => {
    let setCount;
    function App() {
      const [count, set] = useState(0);
      setCount = set;
      return h('div', null, h('h1', null, '제목'), h('p', null, `값 ${count}`));
    }

    const { container } = mountApp(App);
    expect(container.innerHTML).toBe('<div><h1>제목</h1><p>값 0</p></div>');

    const div = container.firstChild;
    const [title, paragraph] = div.childNodes;
    const titleText = title.firstChild;
    const paragraphText = paragraph.firstChild;

    setCount(1);
    expect(container.innerHTML).toBe('<div><h1>제목</h1><p>값 0</p></div>');
    await Promise.resolve();

    expect(container.innerHTML).toBe('<div><h1>제목</h1><p>값 1</p></div>');
    expect(container.firstChild).toBe(div);
    expect(div.childNodes[0]).toBe(title);
    expect(title.firstChild).toBe(titleText);
    expect(div.childNodes[1]).toBe(paragraph);
    expect(paragraph.firstChild).toBe(paragraphText);
  });

  it('두 인스턴스의 상태는 분리된다', async () => {
    const setters = [];
    function App() {
      const [count, setCount] = useState(0);
      if (!setters.includes(setCount)) setters.push(setCount);
      return h('p', null, count);
    }

    const first = mountApp(App);
    const second = mountApp(App);
    expect(setters).toHaveLength(2);

    setters[0](5);
    await Promise.resolve();

    expect(first.container.textContent).toBe('5');
    expect(second.container.textContent).toBe('0');
    expect(first.app.hooks).not.toBe(second.app.hooks);

    setters[1](7);
    await Promise.resolve();

    expect(first.container.textContent).toBe('5');
    expect(second.container.textContent).toBe('7');
  });

  it('맨 위 태그가 바뀌어도 영역은 그대로이고 this.container로 다음 update()가 동작한다', async () => {
    let setCount;
    function App() {
      const [count, set] = useState(0);
      setCount = set;
      return count === 0 ? h('div', null, '영') : h('section', null, `값 ${count}`);
    }

    const parent = document.createElement('main');
    const container = document.createElement('div');
    parent.appendChild(container);
    const app = new FunctionComponent(App, container);
    app.mount();

    setCount(1);
    await Promise.resolve();

    expect(app.container).toBe(container);
    expect(parent.firstChild).toBe(container);
    expect(container.innerHTML).toBe('<section>값 1</section>');

    setCount(2);
    await Promise.resolve();

    expect(container.innerHTML).toBe('<section>값 2</section>');
  });

  it('컴포넌트가 배열이나 null을 돌려줘도 동작한다', async () => {
    let setMode;
    function App() {
      const [mode, set] = useState('array');
      setMode = set;
      if (mode === 'array') return [h('p', null, 'a'), 'b', 3];
      if (mode === 'null') return null;
      return h('p', null, '하나');
    }

    const { container } = mountApp(App);
    expect(container.innerHTML).toBe('<p>a</p>b3');

    setMode('null');
    await Promise.resolve();
    expect(container.innerHTML).toBe('');

    setMode('one');
    await Promise.resolve();
    expect(container.innerHTML).toBe('<p>하나</p>');

    setMode('array');
    await Promise.resolve();
    expect(container.innerHTML).toBe('<p>a</p>b3');
  });

  it('patch가 실패하면 이전 화면으로 다시 그리고 오류를 던진다. 다음 setState가 동작한다', async () => {
    let setCount;
    function App() {
      const [count, set] = useState(0);
      setCount = set;
      // 공백이 든 속성 이름은 setAttribute가 거부한다. p의 글자가 먼저 바뀐 뒤 실패하게 뒤쪽에 둔다.
      const props = count === 1 ? { 'bad name': 'x' } : null;
      return h('div', null, h('p', null, `값 ${count}`), h('span', props, '끝'));
    }

    const { app, container } = mountApp(App);
    const before = container.innerHTML;
    const vdomBefore = app.vdom;

    // 마이크로태스크의 오류는 테스트에서 잡을 수 없으므로 예약된 함수를 직접 실행한다.
    const tasks = [];
    const spy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => tasks.push(task));
    setCount(1);
    spy.mockRestore();

    expect(tasks).toHaveLength(1);
    expect(() => tasks[0]()).toThrow();
    expect(container.innerHTML).toBe(before);
    expect(app.vdom).toBe(vdomBefore);
    expect(app.isScheduled).toBe(false);

    setCount(2);
    await Promise.resolve();

    expect(container.innerHTML).toBe('<div><p>값 2</p><span>끝</span></div>');
  });

  it('렌더가 실패하면 화면과 vdom은 그대로 두고 오류를 던진다', () => {
    let shouldFail = false;
    function App() {
      if (shouldFail) throw new Error('렌더 실패');
      return h('p', null, '글');
    }

    const { app, container } = mountApp(App);
    const paragraph = container.firstChild;
    const vdomBefore = app.vdom;

    shouldFail = true;
    expect(() => app.update()).toThrow('렌더 실패');
    expect(container.firstChild).toBe(paragraph);
    expect(app.vdom).toBe(vdomBefore);
    expect(app.isRendering).toBe(false);

    shouldFail = false;
    expect(() => app.update()).not.toThrow();
  });

  it('컴포넌트가 자식으로 쓸 수 없는 값을 돌려주면 화면과 vdom은 그대로 두고 오류를 던진다', () => {
    let result = h('p', null, '글');
    const { app, container } = mountApp(() => result);
    const before = container.innerHTML;
    const vdomBefore = app.vdom;

    result = { a: 1 };
    expect(() => app.update()).toThrow(TypeError);
    expect(container.innerHTML).toBe(before);
    expect(app.vdom).toBe(vdomBefore);
  });

  it('첫 렌더가 실패하면 마운트되지 않고 다시 mount()할 수 있다', () => {
    let shouldFail = true;
    function App() {
      const [value] = useState('글');
      if (shouldFail) throw new Error('렌더 실패');
      return h('p', null, value);
    }

    const container = document.createElement('div');
    container.innerHTML = '<b>기존</b>';
    const app = new FunctionComponent(App, container);

    expect(() => app.mount()).toThrow('렌더 실패');
    expect(app.vdom).toBeNull();
    expect(container.innerHTML).toBe('<b>기존</b>');

    shouldFail = false;
    app.mount();
    expect(container.innerHTML).toBe('<p>글</p>');
    expect(app.hooks).toHaveLength(1);
  });

  it('renderRoot가 실패하면 vdom이 null로 남는다', () => {
    const container = document.createElement('div');
    const app = new FunctionComponent(() => h('div', { 'bad name': 'x' }), container);

    expect(() => app.mount()).toThrow();
    expect(app.vdom).toBeNull();
  });

  it('렌더 중 함수형 setState의 updater는 실행되지 않는다', () => {
    const updater = vi.fn((n) => n + 1);
    function App() {
      const [, setCount] = useState(0);
      expect(() => setCount(updater)).toThrow('렌더 중');
      return null;
    }

    mountApp(App);

    expect(updater).not.toHaveBeenCalled();
  });

  it('두 번째 mount()는 오류이다', () => {
    const component = vi.fn(() => h('p', null, '글'));
    const { app, container } = mountApp(component);
    const paragraph = container.firstChild;

    expect(() => app.mount()).toThrow('이미 마운트');
    expect(component).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toBe(paragraph);
  });

  it('마운트 전 update()는 오류이다', () => {
    const component = vi.fn(() => null);
    const app = new FunctionComponent(component, document.createElement('div'));

    expect(() => app.update()).toThrow('마운트');
    expect(component).not.toHaveBeenCalled();
  });

  it('렌더를 시작할 때 hookIndex를 0으로 되돌리고 실행할 effect 목록을 비운다', () => {
    const seen = [];
    let app;
    function App() {
      seen.push([app.hookIndex, app.pendingEffects.length]);
      useState(0);
      return null;
    }

    app = new FunctionComponent(App, document.createElement('div'));
    app.mount();
    expect(app.hookIndex).toBe(1);

    app.pendingEffects.push(() => {});
    app.update();

    expect(seen).toEqual([[0, 0], [0, 0]]);
  });

  it('렌더하는 동안에만 isRendering이 true이다', () => {
    const seen = [];
    let app;
    function App() {
      seen.push(app.isRendering);
      return null;
    }

    app = new FunctionComponent(App, document.createElement('div'));
    app.mount();

    expect(seen).toEqual([true]);
    expect(app.isRendering).toBe(false);
  });

  it('scheduleUpdate()는 예약을 하나만 두고, update()가 실패해도 다시 예약할 수 있다', async () => {
    const component = vi.fn(() => null);
    const { app } = mountApp(component);

    app.scheduleUpdate();
    app.scheduleUpdate();
    expect(app.isScheduled).toBe(true);
    await Promise.resolve();

    expect(app.isScheduled).toBe(false);
    expect(component).toHaveBeenCalledTimes(2);

    const tasks = [];
    const spy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => tasks.push(task));
    const update = vi.spyOn(app, 'update').mockImplementationOnce(() => {
      expect(app.isScheduled).toBe(false);
      throw new Error('갱신 실패');
    });
    app.scheduleUpdate();
    expect(() => tasks[0]()).toThrow('갱신 실패');
    app.scheduleUpdate();
    spy.mockRestore();
    update.mockRestore();

    expect(tasks).toHaveLength(2);
  });

  describe('렌더 재진입', () => {
    it('렌더마다 update()를 불러도 재귀하지 않고 렌더 중 오류를 던진다', () => {
      let app;
      let reenter = false;
      const component = vi.fn(() => {
        if (reenter) app.update();
        return h('p', null, '글');
      });

      app = new FunctionComponent(component, document.createElement('div'));
      app.mount();

      reenter = true;
      expect(() => app.update()).toThrow('렌더 중');
      expect(component).toHaveBeenCalledTimes(2);
      expect(app.isRendering).toBe(false);
    });

    it('첫 렌더 중 mount()는 오류이고 화면을 그리지 않는다', () => {
      let app;
      const component = vi.fn(() => {
        app.mount();
        return h('p', null, '글');
      });
      const container = document.createElement('div');
      container.innerHTML = '<b>기존</b>';

      app = new FunctionComponent(component, container);

      expect(() => app.mount()).toThrow('렌더 중');
      expect(component).toHaveBeenCalledTimes(1);
      expect(container.innerHTML).toBe('<b>기존</b>');
      expect(app.vdom).toBeNull();
    });

    it('update() 렌더 중 mount()도 렌더 중 오류이다', () => {
      let app;
      let reenter = false;
      function App() {
        if (reenter) app.mount();
        return null;
      }

      app = new FunctionComponent(App, document.createElement('div'));
      app.mount();

      reenter = true;
      expect(() => app.update()).toThrow('렌더 중');
    });

    it.each(['mount', 'update'])('첫 렌더에서 %s() 오류를 잡고 진행하면 바깥 렌더가 정상으로 끝나고 setState는 계속 막힌다', (method) => {
      const seen = [];
      let app;
      function App() {
        const [first, setFirst] = useState('첫째');
        expect(() => app[method]()).toThrow('렌더 중');
        seen.push(app.isRendering);
        expect(() => setFirst(9)).toThrow('렌더 중');
        const [second] = useState('둘째');
        return h('p', null, first, second);
      }

      const container = document.createElement('div');
      app = new FunctionComponent(App, container);
      app.mount();

      expect(seen).toEqual([true]);
      expect(container.innerHTML).toBe('<p>첫째둘째</p>');
      expect(app.hooks).toHaveLength(2);
      expect(app.hooks[0].state).toBe('첫째');
      expect(app.isRendering).toBe(false);
      expect(app.isScheduled).toBe(false);
    });

    it.each(['mount', 'update'])('update() 렌더에서 %s() 오류를 잡고 진행하면 바깥 렌더가 정상으로 끝나고 setState는 계속 막힌다', async (method) => {
      let app;
      let setCount;
      let reenter = false;
      function App() {
        const [count, set] = useState(0);
        setCount = set;
        if (reenter) {
          expect(() => app[method]()).toThrow('렌더 중');
          expect(() => set(9)).toThrow('렌더 중');
        }
        const [label] = useState('값');
        return h('p', null, label, count);
      }

      const container = document.createElement('div');
      app = new FunctionComponent(App, container);
      app.mount();

      reenter = true;
      setCount(1);
      await Promise.resolve();

      expect(container.innerHTML).toBe('<p>값1</p>');
      expect(app.hooks[0].state).toBe(1);
      expect(app.hookIndex).toBe(2);
      expect(app.isRendering).toBe(false);
      expect(app.isStale).toBe(false);
      expect(app.isScheduled).toBe(false);
    });
  });

  describe('실패 뒤 같은 값 재시도', () => {
    /** 예약된 함수를 실행하지 않고 모아 돌려준다. 마이크로태스크의 오류는 테스트에서 잡을 수 없다. */
    function collectTasks(run) {
      const tasks = [];
      const spy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((task) => tasks.push(task));
      run();
      spy.mockRestore();
      return tasks;
    }

    it('렌더가 실패한 뒤 같은 값으로 다시 클릭하면 화면이 바뀐다', async () => {
      let shouldFail = false;
      const component = vi.fn(() => {
        const [count, setCount] = useState(0);
        if (shouldFail) throw new Error('렌더 실패');
        return h('button', { onClick: () => setCount(count + 1) }, count);
      });

      const { app, container } = mountApp(component);

      shouldFail = true;
      const tasks = collectTasks(() => container.firstChild.click());
      expect(() => tasks[0]()).toThrow('렌더 실패');
      expect(container.textContent).toBe('0');
      expect(app.hooks[0].state).toBe(1);
      expect(app.isStale).toBe(true);

      shouldFail = false;
      container.firstChild.click();
      expect(app.isScheduled).toBe(true);
      await Promise.resolve();

      expect(container.textContent).toBe('1');
      expect(app.isStale).toBe(false);
    });

    it('patch가 실패한 뒤 같은 값으로 다시 클릭하면 화면이 바뀐다', async () => {
      let shouldFail = false;
      function App() {
        const [count, setCount] = useState(0);
        // 공백이 든 속성 이름은 setAttribute가 거부한다.
        const props = shouldFail && count > 0 ? { 'bad name': 'x' } : null;
        return h('div', null, h('button', { onClick: () => setCount(count + 1) }, count), h('span', props, '끝'));
      }

      const { app, container } = mountApp(App);

      shouldFail = true;
      const tasks = collectTasks(() => container.querySelector('button').click());
      expect(() => tasks[0]()).toThrow();
      expect(container.textContent).toBe('0끝');
      expect(app.hooks[0].state).toBe(1);
      expect(app.isStale).toBe(true);

      shouldFail = false;
      container.querySelector('button').click();
      expect(app.isScheduled).toBe(true);
      await Promise.resolve();

      expect(container.textContent).toBe('1끝');
      expect(app.isStale).toBe(false);
    });

    it('update()가 성공하면 같은 값은 다시 렌더하지 않는다', async () => {
      let shouldFail = false;
      let setCount;
      const component = vi.fn(() => {
        const [count, set] = useState(0);
        setCount = set;
        if (shouldFail) throw new Error('렌더 실패');
        return h('p', null, count);
      });

      const { app } = mountApp(component);

      shouldFail = true;
      const tasks = collectTasks(() => setCount(1));
      expect(() => tasks[0]()).toThrow('렌더 실패');

      shouldFail = false;
      app.update();
      expect(app.isStale).toBe(false);
      component.mockClear();

      setCount(1);
      expect(app.isScheduled).toBe(false);
      await Promise.resolve();

      expect(component).not.toHaveBeenCalled();
    });

    it('다시 시도도 실패하면 isStale이 그대로이고 그다음 시도가 동작한다', async () => {
      let shouldFail = false;
      let setCount;
      function App() {
        const [count, set] = useState(0);
        setCount = set;
        if (shouldFail) throw new Error('렌더 실패');
        return h('p', null, count);
      }

      const { app, container } = mountApp(App);

      shouldFail = true;
      const first = collectTasks(() => setCount(1));
      expect(() => first[0]()).toThrow('렌더 실패');

      const second = collectTasks(() => setCount(1));
      expect(second).toHaveLength(1);
      expect(() => second[0]()).toThrow('렌더 실패');
      expect(app.isStale).toBe(true);

      shouldFail = false;
      setCount(1);
      await Promise.resolve();

      expect(container.textContent).toBe('1');
    });

    it('마운트 전 update()의 오류는 isStale을 바꾸지 않는다', () => {
      const app = new FunctionComponent(() => null, document.createElement('div'));

      expect(() => app.update()).toThrow('마운트');
      expect(app.isStale).toBe(false);
    });
  });
});

describe('onCommit', () => {
  it('mount()는 effect 뒤에 빈 배열로 호출한다', () => {
    const order = [];
    const onCommit = vi.fn((changes) => order.push(['commit', changes]));
    function App() {
      useEffect(() => {
        order.push('effect');
      }, []);
      return h('p', null, 'a');
    }

    new FunctionComponent(App, document.createElement('div'), { onCommit }).mount();

    expect(order).toEqual(['effect', ['commit', []]]);
  });

  it('update()는 effect 뒤에 변경 목록으로 호출한다', () => {
    const order = [];
    let n = 0;
    const onCommit = vi.fn((changes) => order.push(['commit', changes]));
    function App() {
      useEffect(() => {
        order.push('effect');
      });
      return h('p', null, n);
    }
    const app = new FunctionComponent(App, document.createElement('div'), { onCommit });
    app.mount();
    order.length = 0;

    n = 1;
    app.update();

    expect(order[0]).toBe('effect');
    expect(order[1][0]).toBe('commit');
    expect(order[1][1]).toHaveLength(1);
    expect(order[1][1][0].kind).toBe('TEXT');
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('렌더나 effect가 실패하면 호출하지 않는다', () => {
    const onCommit = vi.fn();
    let failRender = false;
    let failEffect = true;
    function App() {
      if (failRender) throw new Error('렌더 실패');
      useEffect(() => {
        if (failEffect) throw new Error('effect 실패');
      });
      return h('p', null, String(failRender));
    }
    const bad = new FunctionComponent(App, document.createElement('div'), { onCommit });
    expect(() => bad.mount()).toThrow('effect 실패');
    expect(() => bad.update()).toThrow('effect 실패');
    expect(onCommit).not.toHaveBeenCalled();

    failEffect = false;
    const app = new FunctionComponent(App, document.createElement('div'), { onCommit });
    app.mount();
    onCommit.mockClear();
    failRender = true;
    expect(() => app.update()).toThrow('렌더 실패');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('patch가 실패하면 호출하지 않는다', () => {
    const onCommit = vi.fn();
    let setCount;
    function App() {
      const [count, set] = useState(0);
      setCount = set;
      return h('div', null, h('span', count === 1 ? { 'bad name': 'x' } : null, '끝'));
    }
    const app = new FunctionComponent(App, document.createElement('div'), { onCommit });
    app.mount();
    onCommit.mockClear();

    setCount(1);
    expect(() => app.update()).toThrow();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('생략해도 동작한다', () => {
    const app = new FunctionComponent(() => h('p', null, 'a'), document.createElement('div'));

    expect(() => {
      app.mount();
      app.update();
    }).not.toThrow();
  });
});
