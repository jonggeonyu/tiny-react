import { describe, expect, it } from 'vitest';
import {
  createGame, startGame, playTurn, timeoutTurn, answerDinner,
  completeTarget, finishPresentation, judgeTyping, getTitle,
} from '../../src/phase2/gameLogic.js';

const NEVER = () => 0.99; // 순찰, 회식 모두 없음
const ALWAYS = () => 0; // 순찰, 회식 모두 있음
const play = (over = {}) => {
  const g = startGame(createGame());
  return { ...g, ...over, stats: { ...g.stats, ...(over.stats || {}) } };
};

describe('createGame, startGame', () => {
  it('처음 상태를 만든다', () => {
    expect(createGame()).toEqual({
      phase: 'start', turn: 0, stats: { stamina: 70, skill: 20, mental: 60, suspicion: 0 },
      log: [], event: null, hasDinner: false, goHomeCount: 0, targetIndex: 0, ending: null, score: null,
    });
  });
  it('startGame은 phase만 play로 바꾼다', () => {
    const g = createGame();
    expect(startGame(g)).toEqual({ ...g, phase: 'play' });
    expect(g.phase).toBe('start');
  });
});

describe('playTurn 스탯', () => {
  const cases = {
    coding: [60, 35, 55, 0],
    smoke: [67, 20, 70, 0],
    sneak: [70, 20, 80, 20],
    home: [95, 20, 65, 10],
    idle: [70, 20, 55, 0],
  };
  for (const [id, [s, k, m, x]] of Object.entries(cases)) {
    it(`${id} 효과`, () => {
      const r = playTurn(play(), id, NEVER);
      expect(r.stats).toEqual({ stamina: s, skill: k, mental: m, suspicion: x });
      expect(r.turn).toBe(1);
      expect(r.log).toHaveLength(1);
    });
  }
  it('0과 100에서 멈춘다', () => {
    const r = playTurn(play({ stats: { stamina: 100, skill: 100, mental: 50, suspicion: 0 } }), 'coding', NEVER);
    expect(r.stats.skill).toBe(100);
    const h = playTurn(play({ stats: { stamina: 90, mental: 99 } }), 'home', NEVER);
    expect(h.stats.stamina).toBe(100);
    expect(h.stats.mental).toBe(100);
    const z = playTurn(play({ stats: { suspicion: 0, skill: 3 } }), 'coding', NEVER);
    expect(z.stats.suspicion).toBe(0);
  });
  it('입력을 바꾸지 않는다', () => {
    const g = play();
    const snap = JSON.parse(JSON.stringify(g));
    playTurn(g, 'coding', ALWAYS);
    expect(g).toEqual(snap);
  });
  it('play가 아니면 그대로 돌려준다', () => {
    const g = createGame();
    expect(playTurn(g, 'coding', NEVER)).toBe(g);
  });
});

describe('순찰', () => {
  it('의심도 39는 순찰이 없다', () => {
    let called = 0;
    const r = playTurn(play({ stats: { suspicion: 44 } }), 'coding', () => { called++; return 0; }); // 44-5=39
    expect(called).toBe(0);
    expect(r.stats.skill).toBe(35);
  });
  it('의심도 40은 확률로 판정한다', () => {
    const caught = playTurn(play({ stats: { suspicion: 45 } }), 'coding', () => 0.39);
    expect(caught.stats).toMatchObject({ skill: 30, mental: 40, suspicion: 20 });
    const safe = playTurn(play({ stats: { suspicion: 45 } }), 'coding', () => 0.4);
    expect(safe.stats).toMatchObject({ skill: 35, mental: 55, suspicion: 40 });
  });
  it('의심도 99는 순찰을 판정한다', () => {
    const r = playTurn(play({ stats: { suspicion: 79 } }), 'sneak', () => 0.99);
    expect(r.stats.suspicion).toBe(99);
    const c = playTurn(play({ stats: { suspicion: 79 } }), 'sneak', () => 0.98);
    expect(c.stats.suspicion).toBe(79);
  });
});

describe('회식', () => {
  const night = (over = {}) => play({ turn: 2, ...over });
  it('밤 턴 뒤 확률로 열린다', () => {
    const r = playTurn(night(), 'coding', () => 0.29);
    expect(r.event).toBe('dinner');
    expect(r.hasDinner).toBe(true);
    expect(r.turn).toBe(3);
    expect(playTurn(night(), 'coding', () => 0.3).event).toBeNull();
  });
  it('낮에는 열리지 않는다', () => {
    expect(playTurn(play({ turn: 1 }), 'coding', ALWAYS).event).toBeNull();
    expect(playTurn(play({ turn: 0 }), 'coding', ALWAYS).event).toBeNull();
  });
  it('한 판에 한 번만 열린다', () => {
    expect(playTurn(night({ hasDinner: true }), 'coding', ALWAYS).event).toBeNull();
  });
  it('참석과 불참 효과', () => {
    const d = playTurn(night(), 'coding', ALWAYS);
    const yes = answerDinner(d, true);
    expect(yes.event).toBeNull();
    expect(yes.stats.mental).toBe(d.stats.mental + 20);
    expect(yes.stats.stamina).toBe(d.stats.stamina - 15);
    const no = answerDinner(d, false);
    expect(no.stats.skill).toBe(d.stats.skill + 5);
    expect(no.stats.mental).toBe(d.stats.mental - 5);
    expect(d.event).toBe('dinner');
  });
  it('회식이 없으면 answerDinner는 그대로이다', () => {
    const g = play();
    expect(answerDinner(g, true)).toBe(g);
  });
  it('회식 뒤에 엔딩을 다시 확인한다', () => {
    const d = { ...night({ stats: { stamina: 15 } }), event: 'dinner', hasDinner: true, turn: 3 };
    const r = answerDinner(d, true);
    expect(r.ending).toBe('burnout');
    expect(r.phase).toBe('ending');
  });
});

describe('엔딩', () => {
  it('체력이 0이면 번아웃', () => {
    const c = playTurn(play({ stats: { stamina: 10, suspicion: 100 } }), 'coding', NEVER);
    expect(c.stats).toMatchObject({ stamina: 0, suspicion: 95 });
    expect(c.ending).toBe('burnout');
  });
  it('의심도 100이면 순찰 없이 코치 면담이고 random을 쓰지 않는다', () => {
    let called = 0;
    const r = playTurn(play({ stats: { suspicion: 80 } }), 'sneak', () => { called++; return 0; });
    expect(called).toBe(0);
    expect(r.ending).toBe('interview');
    expect(r.phase).toBe('ending');
    expect(r.stats.suspicion).toBe(100);
  });
  it('체력 0과 의심도 100이 동시이면 번아웃이다', () => {
    const r = playTurn(play({ stats: { mental: 0, suspicion: 100 } }), 'idle', NEVER);
    expect(r.ending).toBe('burnout');
  });
  it('멘탈 0도 번아웃', () => {
    expect(playTurn(play({ stats: { mental: 5 } }), 'coding', NEVER).ending).toBe('burnout');
  });
  it('집 가기 5번째에 끝난다', () => {
    expect(playTurn(play({ goHomeCount: 3 }), 'home', NEVER).ending).toBeNull();
    const g = playTurn(play({ goHomeCount: 4 }), 'home', NEVER);
    expect(g.goHomeCount).toBe(5);
    expect(g.ending).toBe('home');
  });
  it('14번째 선택 뒤 presentation이 된다', () => {
    let g = play({ turn: 12 });
    g = playTurn(g, 'smoke', NEVER);
    expect(g.phase).toBe('play');
    g = playTurn(g, 'smoke', NEVER);
    expect(g.turn).toBe(14);
    expect(g.phase).toBe('presentation');
  });
});

describe('발표', () => {
  const pres = (skill, targetIndex) => ({ ...play({ turn: 14, stats: { skill } }), phase: 'presentation', targetIndex });
  it('completeTarget은 하나씩 올린다', () => {
    expect(completeTarget(pres(10, 0)).targetIndex).toBe(1);
    expect(completeTarget(pres(10, 0)).phase).toBe('presentation');
  });
  it('모두 완성하면 점수를 낸다', () => {
    const r = completeTarget(pres(30, 4));
    expect(r.phase).toBe('ending');
    expect(r.score).toBe(70);
    expect(r.ending).toBe('success');
  });
  it('69와 70의 경계', () => {
    const a = finishPresentation(pres(29, 5));
    expect(a.score).toBe(69);
    expect(a.ending).toBe('fail');
    const b = finishPresentation(pres(30, 5));
    expect(b.score).toBe(70);
    expect(b.ending).toBe('success');
  });
  it('점수는 실력 + 완성 수 x 8', () => {
    expect(finishPresentation(pres(20, 2)).score).toBe(36);
  });
  it('presentation이 아니면 finishPresentation은 입력을 그대로 돌려준다', () => {
    const g = play({ turn: 3 });
    const ended = finishPresentation(pres(20, 2));
    expect(finishPresentation(g)).toBe(g);
    expect(finishPresentation(ended)).toBe(ended);
  });
  it('입력을 바꾸지 않는다', () => {
    const g = pres(20, 2);
    finishPresentation(g);
    expect(g.phase).toBe('presentation');
    expect(g.score).toBeNull();
  });
});

describe('timeoutTurn', () => {
  it('지난 턴 번호는 바뀌지 않는다', () => {
    const g = play({ turn: 3 });
    expect(timeoutTurn(g, 2, NEVER)).toBe(g);
  });
  it('현재 턴이면 멍때리기', () => {
    const r = timeoutTurn(play(), 0, NEVER);
    expect(r.turn).toBe(1);
    expect(r.stats.mental).toBe(55);
  });
  it('회식 중이면 불참', () => {
    const d = playTurn(play({ turn: 2 }), 'coding', ALWAYS);
    const r = timeoutTurn(d, d.turn, NEVER);
    expect(r.event).toBeNull();
    expect(r.stats.skill).toBe(d.stats.skill + 5);
  });
  it('발표 중이면 끝낸다', () => {
    const g = { ...play({ turn: 14 }), phase: 'presentation', targetIndex: 1 };
    const r = timeoutTurn(g, 14, NEVER);
    expect(r.phase).toBe('ending');
    expect(r.score).toBe(28);
  });
  it('start와 ending에서는 그대로이다', () => {
    const g = createGame();
    expect(timeoutTurn(g, 0, NEVER)).toBe(g);
  });
});

describe('judgeTyping', () => {
  const s = (r) => r.map((x) => x.status[0]).join('');
  it('맞음, 틀림, 대기', () => {
    expect(s(judgeTyping('diff', 'di'))).toBe('ccpp');
    expect(s(judgeTyping('diff', 'dx'))).toBe('cwpp');
  });
  it('대소문자를 구분한다', () => {
    expect(judgeTyping('patch', 'P')[0]).toEqual({ char: 'p', status: 'wrong' });
  });
  it('틀린 글자 뒤도 위치별로 판정한다', () => {
    expect(s(judgeTyping('diff', 'dxff'))).toBe('cwcc');
  });
  it('더 긴 입력에서도 오류가 없다', () => {
    const r = judgeTyping('diff', 'diffxyz');
    expect(r).toHaveLength(4);
    expect(s(r)).toBe('cccc');
  });
});

describe('getTitle', () => {
  const st = (o) => ({ stamina: 70, skill: 20, mental: 60, suspicion: 0, ...o });
  it('기본', () => expect(getTitle(st({}))).toBe('평범한 정글러'));
  it('각 칭호와 경계', () => {
    expect(getTitle(st({ skill: 70 }))).toBe('코드 장인');
    expect(getTitle(st({ skill: 69 }))).toBe('평범한 정글러');
    expect(getTitle(st({ mental: 20 }))).toBe('멘탈 파산');
    expect(getTitle(st({ mental: 21 }))).toBe('평범한 정글러');
    expect(getTitle(st({ suspicion: 60 }))).toBe('수배자');
    expect(getTitle(st({ stamina: 20 }))).toBe('좀비');
  });
  it('우선순위', () => {
    expect(getTitle(st({ skill: 90, mental: 10, suspicion: 90, stamina: 10 }))).toBe('코드 장인');
    expect(getTitle(st({ mental: 10, suspicion: 90, stamina: 10 }))).toBe('멘탈 파산');
    expect(getTitle(st({ suspicion: 90, stamina: 10 }))).toBe('수배자');
  });
});
