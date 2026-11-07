import { h } from '../core/h.js';
import { useState, useEffect, useMemo } from '../core/hooks.js';
import { TARGETS, PRESENTATION_SECONDS } from './gameData.js';
import {
  createGame, startGame, playTurn, answerDinner, completeTarget, skipTarget, timeoutTurn, judgeTyping, getTitle,
} from './gameLogic.js';
import { StartScreen, PlayScreen, PresentationScreen, EndingScreen } from './components.js';

const TIME_LIMIT = 20;
const STORAGE_KEY = 'tiny-react-best-score';

/**
 * 최고 기록을 읽는다. 저장소를 쓸 수 없으면 0이다.
 * @private
 * @returns {number}
 */
function readBestScore() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * 최고 기록을 저장한다. 저장소를 쓸 수 없으면 무시한다.
 * @private
 * @param {number} score
 */
function writeBestScore(score) {
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    // 기록만 남지 않는다.
  }
}

/**
 * 정글 생존기의 루트 컴포넌트. Hook을 쓰는 유일한 컴포넌트이고, 자식은 Props만 받는다.
 * 난수는 핸들러와 시간 초과 처리에서만 `Math.random`으로 만든다.
 * @returns {Object} Virtual DOM
 */
export function Game() {
  const [name, setName] = useState('');
  const [game, setGame] = useState(createGame());
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [typed, setTyped] = useState('');
  const [bestScore, setBestScore] = useState(0);

  const random = () => Math.random();
  const timed = game.phase === 'play' || game.phase === 'presentation';

  // 최고 기록 읽기
  useEffect(() => {
    setBestScore(readBestScore());
  }, []);

  // 최고 기록 저장
  useEffect(() => {
    if (game.score === null || game.score <= bestScore) return;
    setBestScore(game.score);
    writeBestScore(game.score);
  }, [game.score]);

  // 1초 타이머. 발표 중에는 함수 이름이 바뀌어도 deps가 같아 다시 시작하지 않는다.
  useEffect(() => {
    if (!timed) return undefined;
    setTimeLeft(game.phase === 'presentation' ? PRESENTATION_SECONDS : TIME_LIMIT);
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [game.phase, game.turn, game.event]);

  // 시간 초과. 최신 game에 함수형으로 적용하고 예약한 턴이 다르면 무시한다.
  useEffect(() => {
    if (timeLeft !== 0 || !timed) return;
    const turn = game.turn;
    setGame((current) => timeoutTurn(current, turn, random));
  }, [timeLeft]);

  // 발표가 시작되거나 문제가 바뀌면 입력창에 포커스. 타이머 deps와 별개라 타이머는 다시 시작하지 않는다.
  useEffect(() => {
    if (game.phase !== 'presentation') return;
    const input = document.querySelector('.typing-input');
    if (input) input.focus();
  }, [game.phase, game.targetIndex]);

  // 기록이 늘면 최신 줄이 보이도록 기록 영역을 맨 아래로 스크롤한다.
  useEffect(() => {
    const log = document.querySelector('.event-log');
    if (log) log.scrollTop = log.scrollHeight;
  }, [game.log.length]);

  const title = useMemo(() => getTitle(game.stats), [game.stats]);
  const { name: target, clue } = TARGETS[Math.min(game.targetIndex, TARGETS.length - 1)];
  const letters = useMemo(() => judgeTyping(target, typed), [target, typed]);

  // 턴이 지나가는 핸들러는 남은 시간도 함께 되돌려서 시간 초과와 겹쳐도 한 번만 처리되게 한다.
  const choose = (id) => {
    setGame((current) => playTurn(current, id, random));
    setTimeLeft(TIME_LIMIT);
  };
  const answer = (attends) => {
    setGame((current) => answerDinner(current, attends));
    setTimeLeft(TIME_LIMIT);
  };
  const type = (value, input) => {
    if (value === target) {
      setGame((current) => completeTarget(current));
      setTyped('');
      // typed가 이미 ''이면 diff가 없어 입력창이 남으므로 직접 비운다.
      input.value = '';
    } else {
      setTyped(value);
    }
  };
  const skip = () => {
    setGame((current) => skipTarget(current));
    setTyped('');
    // typed가 이미 ''이면 diff가 없어 입력창이 남으므로 직접 비운다.
    const input = document.querySelector('.typing-input');
    if (input) input.value = '';
  };
  const start = () => {
    if (name.trim() === '') return;
    setGame((current) => startGame(current));
    setTimeLeft(TIME_LIMIT);
  };
  const restart = () => {
    setGame(createGame());
    setTyped('');
    setTimeLeft(TIME_LIMIT);
  };

  let screen;
  if (game.phase === 'start') {
    screen = h(StartScreen, { name, bestScore, onName: setName, onStart: start });
  } else if (game.phase === 'play') {
    screen = h(PlayScreen, { game, title, timeLeft, onChoose: choose, onDinner: answer });
  } else if (game.phase === 'presentation') {
    screen = h(PresentationScreen, {
      letters, clue, typed, timeLeft, index: game.targetIndex, total: TARGETS.length,
      showHint: /[^\x00-\x7f]/.test(typed), onType: type, onSkip: skip,
    });
  } else {
    screen = h(EndingScreen, { game, name: name.trim(), bestScore, onRestart: restart });
  }
  return h('div', null, screen);
}
