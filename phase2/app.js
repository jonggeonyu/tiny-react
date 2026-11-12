import { createErrorNotices } from './notices.js';
import { FunctionComponent, registerArea, registerEvent, renderChild, useEffect, useMemo, useState } from '../src/phase2/index.js';

function text(value) {
  return Object.freeze({ type: 'text', tag: null, attributes: Object.freeze({}), text: String(value), children: Object.freeze([]), formState: null });
}

function element(tag, children = [], attributes = {}, formState = null) {
  return Object.freeze({ type: 'element', tag, attributes: Object.freeze(attributes), text: null, children: Object.freeze(children), formState });
}

function CounterView({ count, doubled, name, changeName, increment }) {
  const input = element('input', [], { type: 'text', placeholder: '이름을 입력하세요' }, { value: name });
  const button = element('button', [text('숫자 올리기')], { type: 'button' });
  registerEvent(input, 'input', (event) => changeName(event.target.value));
  registerEvent(button, 'click', increment);
  return element('div', [
    element('p', [text(`${name || '친구'}님의 숫자: ${count}`)]),
    element('p', [text(`두 배: ${doubled}`)]),
    input,
    button,
  ]);
}

function createCounter(id) {
  const root = document.querySelector(`#root-${id}`);
  const notice = document.querySelector(`#notice-${id}`);
  const effectStatus = document.querySelector(`#effect-${id}`);
  function App() {
    const [count, setCount] = useState(0);
    const [name, setName] = useState('');
    const doubled = useMemo(() => count * 2, [count]);
    useEffect(() => {
      effectStatus.textContent = `화면 반영 후 작업: 숫자 ${count}`;
      return () => { effectStatus.textContent = ''; };
    }, [count]);
    return renderChild(CounterView, { count, doubled, name, changeName: setName, increment: () => setCount((value) => value + 1) });
  }
  registerArea(`counter-${id}`, root);
  const notices = createErrorNotices(notice);
  const app = new FunctionComponent(App, { onError: notices.report });
  app.mount(root);
  const removeButton = document.querySelector(`#unmount-${id}`);
  removeButton.addEventListener('click', () => {
    const result = app.unmount();
    notices.afterUnmount(result);
    if (result.committed) {
      removeButton.disabled = true;
    }
  });
}

createCounter('a');
createCounter('b');
