import {
  INITIAL_STATS, CHOICES, PATROL_THRESHOLD, PATROL_EFFECT, PATROL_TEXT, DINNER_CHANCE,
  DINNER_ATTEND, DINNER_SKIP, DINNER_OPEN_TEXT, TOTAL_CHOICES, GO_HOME_LIMIT, PASS_SCORE,
  SCORE_PER_TARGET, TARGETS, ENDINGS, TITLES, DEFAULT_TITLE,
} from './gameData.js';

/**
 * 스탯에 변화량을 더하고 0~100으로 제한한 새 객체를 돌려준다.
 * @private
 * @param {Object} stats
 * @param {Object} effect
 * @returns {Object}
 */
function applyEffect(stats, effect) {
  const next = { ...stats };
  for (const key of Object.keys(effect)) {
    next[key] = Math.min(100, Math.max(0, next[key] + effect[key]));
  }
  return next;
}

/**
 * 사건 판정 뒤의 엔딩을 확인한다. 앞의 조건이 먼저이다.
 * @private
 * @param {Object} game
 * @returns {Object} 엔딩이면 phase가 'ending'인 새 게임, 아니면 입력 그대로
 */
function checkEnding(game) {
  const { stats, goHomeCount } = game;
  let ending = null;
  if (stats.stamina <= 0 || stats.mental <= 0) ending = 'burnout';
  else if (stats.suspicion >= 100) ending = 'interview';
  else if (goHomeCount >= GO_HOME_LIMIT) ending = 'home';
  if (!ending) return game;
  return { ...game, phase: 'ending', ending, event: null, log: [...game.log, ENDINGS[ending].text] };
}

/**
 * 엔딩이 아니면 다음 단계(발표)로 넘긴다.
 * @private
 * @param {Object} game
 * @returns {Object}
 */
function advance(game) {
  const ended = checkEnding(game);
  if (ended !== game) return ended;
  if (game.turn >= TOTAL_CHOICES) return { ...game, phase: 'presentation' };
  return game;
}

/**
 * 처음 상태의 게임을 만든다. `다시 하기`에도 쓴다.
 * @returns {Object} phase가 'start'인 게임
 */
export function createGame() {
  return {
    phase: 'start', turn: 0, stats: { ...INITIAL_STATS }, log: [], event: null,
    hasDinner: false, goHomeCount: 0, targetIndex: 0, correctCount: 0, ending: null, score: null,
  };
}

/**
 * 게임을 시작한다.
 * @param {Object} game
 * @returns {Object} phase가 'play'인 새 게임
 */
export function startGame(game) {
  return { ...game, phase: 'play' };
}

/**
 * 선택 하나를 적용하고 순찰, 엔딩, 회식 순서로 판정한다.
 * `random`은 0 이상 1 미만의 수를 돌려주는 함수이다.
 * @param {Object} game
 * @param {string} choiceId coding, smoke, sneak, home, idle 중 하나
 * @param {function(): number} random
 * @returns {Object} 새 게임. play가 아니거나 회식 중이면 입력 그대로이다.
 */
export function playTurn(game, choiceId, random) {
  const choice = CHOICES[choiceId];
  if (game.phase !== 'play' || game.event || !choice) return game;

  let stats = applyEffect(game.stats, choice.effect);
  const log = [...game.log, choice.text];
  const goHomeCount = game.goHomeCount + (choiceId === 'home' ? 1 : 0);
  const night = game.turn % 3 === 2;
  const base = { ...game, stats, log, turn: game.turn + 1, goHomeCount };
  // 의심도 100이면 순찰 없이 끝난다. 체력이나 멘탈이 0이면 번아웃이 먼저이다.
  if (stats.suspicion >= 100) return checkEnding(base);
  if (stats.suspicion >= PATROL_THRESHOLD && random() * 100 < stats.suspicion) {
    stats = applyEffect(stats, PATROL_EFFECT);
    log.push(PATROL_TEXT);
  }
  const next = { ...base, stats };
  const ended = checkEnding(next);
  if (ended !== next) return ended;
  if (night && !game.hasDinner && random() < DINNER_CHANCE) {
    return { ...next, event: 'dinner', hasDinner: true, log: [...log, DINNER_OPEN_TEXT] };
  }
  return advance(next);
}

/**
 * 회식에 답한다. 효과를 적용하고 엔딩과 발표 진입을 다시 확인한다.
 * @param {Object} game
 * @param {boolean} attends 참석하면 true
 * @returns {Object} 새 게임. 회식 중이 아니면 입력 그대로이다.
 */
export function answerDinner(game, attends) {
  if (game.event !== 'dinner') return game;
  const choice = attends ? DINNER_ATTEND : DINNER_SKIP;
  return advance({
    ...game, event: null, stats: applyEffect(game.stats, choice.effect), log: [...game.log, choice.text],
  });
}

/**
 * 발표 점수(실력 + 맞힌 수 x 8)를 내고 엔딩으로 보낸다.
 * @param {Object} game
 * @returns {Object} phase가 'ending'인 새 게임
 */
export function finishPresentation(game) {
  if (game.phase !== 'presentation') return game;
  const score = game.stats.skill + game.correctCount * SCORE_PER_TARGET;
  const ending = score >= PASS_SCORE ? 'success' : 'fail';
  return { ...game, phase: 'ending', ending, score, log: [...game.log, ENDINGS[ending].text] };
}

/**
 * 함수 이름 하나를 맞힌 것으로 센다. 마지막 문제이면 발표를 끝낸다.
 * @param {Object} game
 * @returns {Object} 새 게임. presentation이 아니면 입력 그대로이다.
 */
export function completeTarget(game) {
  if (game.phase !== 'presentation') return game;
  const next = { ...game, targetIndex: game.targetIndex + 1, correctCount: game.correctCount + 1 };
  return next.targetIndex >= TARGETS.length ? finishPresentation(next) : next;
}

/**
 * 문제를 넘긴다. 맞힌 수는 올리지 않고, 마지막 문제이면 발표를 끝낸다.
 * @param {Object} game
 * @returns {Object} 새 게임. presentation이 아니면 입력 그대로이다.
 */
export function skipTarget(game) {
  if (game.phase !== 'presentation') return game;
  const next = { ...game, targetIndex: game.targetIndex + 1 };
  return next.targetIndex >= TARGETS.length ? finishPresentation(next) : next;
}

/**
 * 시간 초과를 처리한다. 예약할 때의 턴 번호가 지금과 다르면 아무것도 하지 않는다.
 * 회식 중이면 불참, 발표 중이면 발표 종료, 선택 중이면 멍때리기이다.
 * @param {Object} game
 * @param {number} turn 예약할 때의 턴 번호
 * @param {function(): number} random
 * @returns {Object}
 */
export function timeoutTurn(game, turn, random) {
  if (turn !== game.turn) return game;
  if (game.event === 'dinner') return answerDinner(game, false);
  if (game.phase === 'presentation') return finishPresentation(game);
  if (game.phase === 'play') return playTurn(game, 'idle', random);
  return game;
}

/**
 * 입력을 함수 이름과 위치별로 비교한다. 대소문자를 구분하고, 입력이 더 길어도 target 길이까지만 낸다.
 * @param {string} target
 * @param {string} typed
 * @returns {Array<{char: string, status: 'correct'|'wrong'|'pending'}>}
 */
export function judgeTyping(target, typed) {
  return Array.from(target, (char, i) => ({
    char,
    status: i >= typed.length ? 'pending' : typed[i] === char ? 'correct' : 'wrong',
  }));
}

/**
 * 스탯으로 칭호를 고른다. 앞의 조건이 먼저이다.
 * @param {Object} stats
 * @returns {string}
 */
export function getTitle(stats) {
  const hit = TITLES.find((t) => t.test(stats));
  return hit ? hit.name : DEFAULT_TITLE;
}
