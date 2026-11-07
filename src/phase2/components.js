import { h } from '../core/h.js';
import { CHOICES, ENDINGS, PERIODS } from './gameData.js';

const STAT_LABELS = [
  ['stamina', '체력'],
  ['skill', '실력'],
  ['mental', '멘탈'],
  ['suspicion', '코치 의심도'],
];

/**
 * 시작 화면. 이름이 공백뿐이면 시작 버튼을 막는다.
 * @param {{name: string, bestScore: number, onName: function(string): void, onStart: function(): void}} props
 * @returns {Object} Virtual DOM
 */
export function StartScreen({ name, bestScore, onName, onStart }) {
  return h('div', { class: 'start-screen' },
    h('h2', null, '정글 생존기'),
    h('p', null, '5일을 버티고 프로젝트 발표까지 가자.'),
    h('input', {
      class: 'name-input', type: 'text', placeholder: '이름', 'aria-label': '이름', value: name,
      onInput: (event) => onName(event.target.value),
    }),
    h('p', { class: 'best-score' }, bestScore > 0 ? `최고 기록: ${bestScore}점` : '최고 기록: 없음'),
    h('button', { class: 'primary', disabled: name.trim() === '', onClick: onStart }, '시작'),
  );
}

/**
 * 스탯과 칭호 표시줄.
 * @param {{stats: Object, title: string}} props
 * @returns {Object} Virtual DOM
 */
export function StatBar({ stats, title }) {
  return h('div', { class: 'stat-bar' },
    ...STAT_LABELS.map(([key, label]) =>
      h('div', { class: 'stat' }, h('span', null, label), h('strong', null, stats[key]))),
    h('div', { class: 'stat stat-title' }, h('span', null, '칭호'), h('strong', null, title)),
  );
}

/**
 * 선택지 버튼 하나.
 * @param {{label: string, onClick: function(): void}} props
 * @returns {Object} Virtual DOM
 */
export function ChoiceButton({ label, onClick }) {
  return h('button', { class: 'choice', onClick }, label);
}

/**
 * 사건 기록 목록. 최신 기록이 아래에 온다.
 * @param {{log: Array<string>}} props
 * @returns {Object} Virtual DOM
 */
export function EventLog({ log }) {
  return h('ol', { class: 'event-log' }, ...log.map((text) => h('li', null, text)));
}

/**
 * 선택 화면. 회식 중이면 참석과 불참을 보여 준다.
 * @param {{game: Object, title: string, timeLeft: number, onChoose: function(string): void, onDinner: function(boolean): void}} props
 * @returns {Object} Virtual DOM
 */
export function PlayScreen({ game, title, timeLeft, onChoose, onDinner }) {
  const dinner = game.event === 'dinner';
  // 회식은 선택 직후에 생기고 turn은 이미 올라가 있으므로 방금 지난 턴을 보여 준다.
  const shownTurn = dinner ? game.turn - 1 : game.turn;
  const day = Math.floor(shownTurn / 3) + 1;
  return h('div', { class: 'play-screen' },
    h('h2', null, `${day}일차 ${PERIODS[shownTurn % 3]}`),
    h('div', { class: 'timer' }, `남은 시간 ${timeLeft}초`),
    h(StatBar, { stats: game.stats, title }),
    dinner
      ? h('div', { class: 'choices' },
        h(ChoiceButton, { label: '회식 참석', onClick: () => onDinner(true) }),
        h(ChoiceButton, { label: '회식 불참', onClick: () => onDinner(false) }))
      : h('div', { class: 'choices' },
        ...['coding', 'smoke', 'sneak', 'home'].map((id) =>
          h(ChoiceButton, { label: CHOICES[id].label, onClick: () => onChoose(id) }))),
    h(EventLog, { log: game.log }),
  );
}

/**
 * 발표 타자 화면. 입력창은 글자 영역의 형제이고, 안내는 입력창 뒤에 두어서 입력창 위치가 바뀌지 않는다.
 * @param {{letters: Array<{char: string, status: string}>, typed: string, timeLeft: number, done: number, total: number, showHint: boolean, onType: function(string, Element): void}} props
 * @returns {Object} Virtual DOM
 */
export function PresentationScreen({ letters, typed, timeLeft, done, total, showHint, onType }) {
  return h('div', { class: 'presentation-screen' },
    h('h2', null, `발표 ${done} / ${total}`),
    h('div', { class: 'timer' }, `남은 시간 ${timeLeft}초`),
    h('p', { class: 'target-name' },
      ...letters.map(({ char, status }) => h('span', { class: `char-${status}` }, char))),
    h('input', {
      class: 'typing-input', type: 'text', value: typed, 'aria-label': '함수 이름 입력',
      autocomplete: 'off', spellcheck: 'false', onInput: (event) => onType(event.target.value, event.target),
    }),
    showHint ? h('p', { class: 'typing-hint' }, '한/영 키를 눌러 영어로 입력하세요.') : null,
  );
}

/**
 * 엔딩 화면.
 * @param {{game: Object, name: string, bestScore: number, onRestart: function(): void}} props
 * @returns {Object} Virtual DOM
 */
export function EndingScreen({ game, name, bestScore, onRestart }) {
  return h('div', { class: 'ending-screen' },
    h('h2', null, ENDINGS[game.ending].title),
    h('p', null, `${name}님, ${ENDINGS[game.ending].text}`),
    game.score === null ? null : h('p', { class: 'score' }, `발표 점수: ${game.score}점`),
    h('p', { class: 'best-score' }, bestScore > 0 ? `최고 기록: ${bestScore}점` : '최고 기록: 없음'),
    h(EventLog, { log: game.log }),
    h('button', { class: 'primary', onClick: onRestart }, '다시 하기'),
  );
}
