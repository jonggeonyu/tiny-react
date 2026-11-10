import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionComponent } from '../../src/core/FunctionComponent.js';
import { Game } from '../../src/phase2/Game.js';

let container;

/** 한 번의 마이크로태스크 렌더를 기다린다. */
const flush = () => vi.advanceTimersByTimeAsync(0);
const tick = (ms) => vi.advanceTimersByTimeAsync(ms);

/** 새 영역에 게임을 마운트한다. */
function mountGame() {
  container = document.createElement('div');
  document.body.appendChild(container);
  new FunctionComponent(Game, container).mount();
}

/** 입력창에 값을 넣고 input 이벤트를 낸다. */
async function typeInto(selector, value) {
  const input = container.querySelector(selector);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
}

/** 텍스트가 같은 버튼을 누른다. */
async function press(label) {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === label);
  button.click();
  await flush();
}

/** 이름을 넣고 시작한다. */
async function startAs(name = '정글러') {
  await typeInto('.name-input', name);
  await press('시작');
}

/** 선택을 차례로 누른다. */
async function choose(...labels) {
  for (const label of labels) await press(label);
}

const logCount = () => container.querySelectorAll('.event-log li').length;
const timerText = () => container.querySelector('.timer').textContent;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.99);
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('시작 화면', () => {
  it('이름이 공백뿐이면 시작할 수 없다', async () => {
    mountGame();
    expect(container.querySelector('button').disabled).toBe(true);
    await typeInto('.name-input', '   ');
    expect(container.querySelector('button').disabled).toBe(true);
    await typeInto('.name-input', ' 하우 ');
    expect(container.querySelector('button').disabled).toBe(false);
    await press('시작');
    expect(container.querySelector('.play-screen')).not.toBeNull();
  });
});

describe('선택과 타이머', () => {
  it('선택하면 스탯과 기록이 바뀌고 남은 시간이 20으로 돌아가며 타이머가 쌓이지 않는다', async () => {
    mountGame();
    await startAs();
    expect(vi.getTimerCount()).toBe(1);
    await tick(5000);
    expect(timerText()).toContain('15');
    await choose('코딩');
    expect(timerText()).toContain('20');
    expect(container.querySelector('.stat strong').textContent).toBe('60');
    expect(logCount()).toBe(1);
    await choose('담배 타임', '코딩', '코딩');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('20초가 지나면 멍때리기로 턴이 지나간다', async () => {
    mountGame();
    await startAs();
    await tick(20000);
    expect(container.querySelector('h2').textContent).toBe('1일차 오후');
    expect(container.querySelector('.event-log').textContent).toContain('모니터만 보다가');
    expect(timerText()).toContain('20');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('0초 직전 클릭과 시간 초과가 겹쳐도 턴이 두 번 지나가지 않는다', async () => {
    mountGame();
    await startAs();
    // 렌더 없이 타이머만 20번 돌려 timeLeft를 0으로 만든 뒤, 렌더 전에 클릭한다.
    vi.advanceTimersByTime(20000);
    container.querySelector('.choice').click();
    await flush();
    expect(logCount()).toBe(1);
    expect(container.querySelector('h2').textContent).toBe('1일차 오후');
    expect(timerText()).toContain('20');
  });

  it('밤에 코딩을 고르고 회식이 열리면 회식 버튼은 이전 버튼과 다른 노드이다', async () => {
    Math.random.mockReturnValue(0);
    mountGame();
    await startAs();
    await choose('코딩', '코딩');
    const old = [...container.querySelectorAll('button')].find((b) => b.textContent === '코딩');
    await press('코딩');
    const yes = [...container.querySelectorAll('button')].find((b) => b.textContent === '회식 참석');
    expect(yes).toBeTruthy();
    expect(container.contains(old)).toBe(false);
    for (const b of container.querySelectorAll('.choices button')) expect(b).not.toBe(old);
  });

  it('회식에 답하면 다시 나온 선택지 버튼은 회식 버튼과 다른 노드이고 회식 버튼은 떨어져 나간다', async () => {
    Math.random.mockReturnValue(0);
    mountGame();
    await startAs();
    await choose('코딩', '코딩', '코딩');
    const yes = [...container.querySelectorAll('button')].find((b) => b.textContent === '회식 참석');
    const no = [...container.querySelectorAll('button')].find((b) => b.textContent === '회식 불참');
    await press('회식 참석');
    expect(container.contains(yes)).toBe(false);
    expect(container.contains(no)).toBe(false);
    const buttons = [...container.querySelectorAll('.choices button')];
    expect(buttons.length).toBe(4);
    for (const b of buttons) expect([yes, no]).not.toContain(b);
  });

  it('회식 중 시간이 지나면 불참으로 처리되고 타이머는 하나만 남는다', async () => {
    Math.random.mockReturnValue(0);
    mountGame();
    await startAs();
    await choose('코딩', '코딩', '코딩');
    expect(container.textContent).toContain('회식 참석');
    expect(container.querySelector('h2').textContent).toBe('1일차 밤');
    expect(vi.getTimerCount()).toBe(1);
    await tick(20000);
    expect(container.textContent).not.toContain('회식 참석');
    expect(container.querySelector('.event-log').textContent).toContain('회식 대신 코드를');
    expect(container.querySelector('h2').textContent).toBe('2일차 오전');
    expect(vi.getTimerCount()).toBe(1);
  });
});

/** 코딩 3번, 집 4번, 담배 7번으로 14번 선택하고 발표까지 간다. */
async function reachPresentation() {
  await startAs();
  await choose('코딩', '코딩', '코딩', '집 가기', '집 가기', '집 가기', '집 가기');
  for (let i = 0; i < 7; i += 1) await press('담배 타임');
}

const clueText = () => container.querySelector('.clue').textContent;
const lettersText = () => container.querySelector('.target-name').textContent;

describe('발표', () => {
  it('발표가 시작되면 남은 시간이 40초이고 설명이 보이며 정답 글자는 보이지 않는다', async () => {
    mountGame();
    await reachPresentation();
    expect(timerText()).toContain('40');
    expect(clueText()).toContain('값을 기억하고');
    expect(container.querySelectorAll('.target-name span')).toHaveLength(8);
    expect(lettersText()).toBe('________');
    expect(container.textContent).not.toContain('useState');
  });

  it('입력창이 교체되지 않고 포커스가 유지되며 맞은 글자는 그 글자, 틀린 글자는 ×이다', async () => {
    mountGame();
    await reachPresentation();
    const input = container.querySelector('.typing-input');
    expect(document.activeElement).toBe(input);
    await typeInto('.typing-input', 'use');
    expect(container.querySelector('.typing-input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(container.querySelectorAll('.char-correct')).toHaveLength(3);
    expect(lettersText()).toBe('use_____');
    await typeInto('.typing-input', 'usx');
    expect(container.querySelectorAll('.char-wrong')).toHaveLength(1);
    expect(lettersText()).toBe('us×_____');
    expect(container.textContent).not.toContain('useState');
    await typeInto('.typing-input', 'useState');
    expect(container.querySelector('.typing-input')).toBe(input);
    expect(input.value).toBe('');
    expect(clueText()).toContain('바깥일');
    expect(lettersText()).toBe('_________');
    expect(document.activeElement).toBe(input);
    // 문제가 바뀌어도 타이머를 다시 시작하지 않는다. (jsdom의 focus가 타이머를 하나 더 만들어서 개수 대신 시간으로 확인한다.)
    await tick(3000);
    expect(timerText()).toContain('37');
  });

  it('함수 이름 전체를 한 번에 붙여넣어도 입력창이 비워진다', async () => {
    mountGame();
    await reachPresentation();
    await typeInto('.typing-input', 'useState');
    expect(container.querySelector('.typing-input').value).toBe('');
    expect(clueText()).toContain('바깥일');
  });

  it('넘기기는 입력을 비우고 다음 설명을 보여 주며 남은 시간과 포커스를 유지한다', async () => {
    mountGame();
    await reachPresentation();
    const input = container.querySelector('.typing-input');
    await tick(5000);
    await typeInto('.typing-input', 'usx');
    await press('넘기기');
    expect(container.querySelector('.typing-input')).toBe(input);
    expect(input.value).toBe('');
    expect(clueText()).toContain('바깥일');
    expect(lettersText()).toBe('_________');
    expect(document.activeElement).toBe(input);
    expect(timerText()).toContain('35');
    await tick(2000);
    expect(timerText()).toContain('33');
  });

  it('입력이 비어 있을 때 넘겨도 입력창이 비어 있고 다음 설명이 나온다', async () => {
    mountGame();
    await reachPresentation();
    await press('넘기기');
    await press('넘기기');
    expect(clueText()).toContain('deps가 같으면');
    expect(container.querySelector('.typing-input').value).toBe('');
  });

  it('다섯 문제를 모두 넘기면 맞힌 수 없이 점수를 낸다', async () => {
    mountGame();
    await reachPresentation();
    for (let i = 0; i < 5; i += 1) await press('넘기기');
    expect(container.querySelector('.ending-screen')).not.toBeNull();
    expect(container.querySelector('h2').textContent).toBe('발표 폭망');
    expect(container.querySelector('.score').textContent).toContain('65');
  });

  it('발표의 40초는 다섯 문제 전체의 시간이라 입력과 맞힘으로 되돌아가지 않는다', async () => {
    mountGame();
    await reachPresentation();
    await tick(39000);
    expect(timerText()).toContain('1초');
    await typeInto('.typing-input', 'u');
    expect(timerText()).toContain('1초');
    await typeInto('.typing-input', 'useState');
    expect(clueText()).toContain('바깥일');
    expect(timerText()).toContain('1초');
  });

  it('한글이 들어오면 한/영 안내가 나오고 입력창은 그대로이다', async () => {
    mountGame();
    await reachPresentation();
    const input = container.querySelector('.typing-input');
    await typeInto('.typing-input', 'ㅕㄴㄷ');
    expect(container.querySelector('.typing-hint').textContent).toContain('한/영');
    expect(container.querySelector('.typing-input')).toBe(input);
    await typeInto('.typing-input', 'u');
    expect(container.querySelector('.typing-hint')).toBeNull();
  });
});

describe('엔딩과 최고 기록', () => {
  it('localStorage가 오류를 던져도 엔딩까지 간다', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('막힘'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('막힘'); });
    mountGame();
    await reachPresentation();
    await tick(40000);
    expect(container.querySelector('.ending-screen')).not.toBeNull();
    expect(container.querySelector('.score').textContent).toContain('65');
  });

  it('최고 기록이 다시 열어도 남고 다시 하기는 이름과 기록만 남기며 엔딩에서 타이머가 멈춘다', async () => {
    mountGame();
    await reachPresentation();
    for (const name of ['useState', 'useEffect', 'useMemo', 'diff', 'patch']) {
      await typeInto('.typing-input', name);
    }
    expect(container.querySelector('h2').textContent).toBe('발표 대성공');
    expect(container.querySelector('.score').textContent).toContain('105');
    expect(localStorage.getItem('tiny-react-best-score')).toBe('105');
    expect(vi.getTimerCount()).toBe(0);

    await press('다시 하기');
    expect(container.querySelector('.name-input').value).toBe('정글러');
    expect(container.querySelector('.best-score').textContent).toContain('105');
    await press('시작');
    expect(container.querySelector('h2').textContent).toBe('1일차 오전');
    expect(container.querySelector('.event-log').children).toHaveLength(0);
    expect(container.querySelector('.stat strong').textContent).toBe('70');

    document.body.innerHTML = '';
    vi.clearAllTimers();
    mountGame();
    await flush();
    expect(container.querySelector('.best-score').textContent).toContain('105');
  });
});
