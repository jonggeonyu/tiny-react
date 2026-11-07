/** 시작 스탯. */
export const INITIAL_STATS = { stamina: 70, skill: 20, mental: 60, suspicion: 0 };

/** 선택지 표. 효과는 체력, 실력, 멘탈, 의심도 순서의 변화량이다. */
export const CHOICES = {
  coding: { label: '코딩', effect: { stamina: -10, skill: 15, mental: -5, suspicion: -5 }, text: '빌드가 한 번에 돌았다. 오늘의 기적이다.' },
  smoke: { label: '담배 타임', effect: { stamina: -3, skill: 0, mental: 10, suspicion: 0 }, text: '옥상에서 동기와 인생 상담을 했다.' },
  sneak: { label: '코치님 몰래 나가기', effect: { stamina: 0, skill: 0, mental: 20, suspicion: 20 }, text: '뒷문으로 슬쩍 나왔다. 심장이 뛴다.' },
  home: { label: '집 가기', effect: { stamina: 25, skill: 0, mental: 5, suspicion: 10 }, text: '이불 속이 천국이다.' },
  idle: { label: '멍때리기', effect: { stamina: 0, skill: 0, mental: -5, suspicion: 0 }, text: '모니터만 보다가 시간이 사라졌다.' },
};

/** 코치 순찰이 시작되는 의심도. */
export const PATROL_THRESHOLD = 40;
/** 순찰에 걸렸을 때의 변화량. */
export const PATROL_EFFECT = { skill: -5, mental: -15, suspicion: -20 };
export const PATROL_TEXT = '코치님이 뒤에 서 있었다. 화면에는 유튜브가 떠 있다.';

/** 회식이 열릴 확률. */
export const DINNER_CHANCE = 0.3;
export const DINNER_ATTEND = { effect: { stamina: -15, mental: 20 }, text: '회식에 갔다. 즐거웠지만 내일 숙취가 기다린다.' };
export const DINNER_SKIP = { effect: { skill: 5, mental: -5 }, text: '회식 대신 코드를 열었다. 조금 외롭다.' };
export const DINNER_OPEN_TEXT = '밤에 회식 공지가 떴다. 갈까?';

/** 선택 횟수와 규칙 상수. */
export const TOTAL_CHOICES = 14;
export const GO_HOME_LIMIT = 5;
export const PASS_SCORE = 70;
export const SCORE_PER_TARGET = 8;

/** 발표 타자 이벤트의 함수 이름. */
export const TARGETS = ['useState', 'useEffect', 'useMemo', 'diff', 'patch'];

/** 엔딩 이름과 문구. */
export const ENDINGS = {
  burnout: { title: '번아웃', text: '더는 못 한다. 노트북을 덮고 한강으로 갔다.' },
  interview: { title: '코치 면담', text: '코치님: 잠깐 이야기 좀 할까요?' },
  home: { title: '그냥 집에 감', text: '다섯 번째 퇴근. 자유를 얻었고 발표는 잃었다.' },
  success: { title: '발표 대성공', text: '데모가 한 번에 돌았다. 박수가 터진다.' },
  fail: { title: '발표 폭망', text: '화면이 하얗다. 새로고침은 소용없었다.' },
};

/** 칭호 목록. 앞의 조건이 먼저이다. */
export const TITLES = [
  { name: '코드 장인', test: (s) => s.skill >= 70 },
  { name: '멘탈 파산', test: (s) => s.mental <= 20 },
  { name: '수배자', test: (s) => s.suspicion >= 60 },
  { name: '좀비', test: (s) => s.stamina <= 20 },
];
export const DEFAULT_TITLE = '평범한 정글러';

/** 시간대 이름. `turn % 3`으로 고른다. */
export const PERIODS = ['오전', '오후', '밤'];
