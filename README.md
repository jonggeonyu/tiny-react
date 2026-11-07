# tiny-react

Vanilla JavaScript로 구현하는 미니 리액트이다. 외부 프레임워크 없이 Virtual DOM, Diff, Patch와 Component, State, Hooks를 직접 만든다.

| 단계 | 내용 | 상태 |
|---|---|---|
| Phase 1 | Virtual DOM, Diff, Patch, State History, 검증 페이지 | 완료 |
| Phase 2 | Component, State, Hooks, 게임 `정글 생존기`, 관찰 패널 | 완료 |

## 실행

Node.js 22에서 확인했다. 기능 테스트는 설치된 Chrome을 쓴다.

```bash
npm install
```

```bash
npm run dev
```

개발 서버가 뜨면 `http://localhost:5173`을 연다. Phase 1 검증 페이지가 나오고, 맨 위의 링크로 Phase 2 페이지(`/phase2.html`)로 이동한다.

## 정글 생존기

Phase 2의 테스트 페이지이다. 크래프톤 정글에서 5일을 버티고 프로젝트 발표까지 가는 선택 게임이다.

1. 이름을 입력하고 시작한다.
2. 하루 세 번, 20초 안에 코딩, 담배 타임, 코치님 몰래 나가기, 집 가기 중에서 고른다. 시간이 지나면 멍때리기로 턴이 지나간다.
3. 체력, 실력, 멘탈, 코치 의심도가 바뀌고, 코치 순찰과 회식 같은 사건이 터진다.
4. 5일째 밤에는 20초 안에 함수 이름을 입력하는 발표가 열린다.
5. 다섯 엔딩 중 하나로 끝나고, 최고 기록은 브라우저에 남는다.

오른쪽의 관찰 패널을 열면 렌더 횟수, `hooks` 칸의 현재 값, 렌더마다 바뀐 내용을 볼 수 있다. 1초마다 화면에서는 타이머 숫자 하나만 바뀌는 것을 눈으로 확인할 수 있다. 렌더마다 새로 만들어지는 핸들러도 함께 교체되지만, 화면과 상관없으므로 패널에서는 뺀다.

## 검증 페이지 사용법

1. 페이지를 열면 실제 영역의 샘플 HTML이 Virtual DOM으로 바뀌고, 그 내용이 테스트 영역에 나타난다.
2. 테스트 영역의 `textarea`에서 HTML을 고친다.
3. Patch를 누르면 바뀐 부분만 실제 영역에 반영되고, 새 상태가 History에 저장된다.
4. 뒤로가기와 앞으로가기를 누르면 실제 영역과 테스트 영역이 함께 이동한다.

고치지 않고 Patch를 누르면 변경 목록이 비어 History에 저장되지 않는다.
그릴 수 없는 입력은 실제 영역에 닿기 전에 멈추고, 버튼 아래에 오류를 보여 준다.

## 동작 방식

```text
textarea ─ htmlToVdom ─▶ 새 Virtual DOM ─┐
                                         ├─ diff ─▶ 변경 목록 ─ patch ─▶ 실제 영역
History의 현재 Virtual DOM ──────────────┘
```

Virtual DOM 노드는 `{ type, props, children }`이고, 텍스트는 문자열이다.
`diff`는 두 Virtual DOM을 비교해 변경 목록만 돌려주고, 실제 DOM은 `patch`만 건드린다.
그래서 변경 목록에 없는 노드는 같은 DOM 객체로 남는다.

변경 목록의 항목은 다섯 가지이다.

| 종류 | 언제 생기는가 | 실제 DOM 작업 |
|---|---|---|
| `ADD` | 새 자식이 더 많을 때 | `appendChild` |
| `REMOVE` | 이전 자식이 더 많을 때 | `remove` |
| `TEXT` | 텍스트 내용이 다를 때 | `nodeValue` 변경 |
| `REPLACE` | 노드 종류나 `type`이 다를 때 | `replaceWith` |
| `PROPS` | 속성이 바뀌거나 생기거나 사라질 때 | `removeProp`, `setProp` |

자식은 같은 번호끼리 비교한다. 추가는 앞에서부터, 삭제는 뒤에서부터 기록하므로 적용하는 동안 앞쪽 번호가 밀리지 않는다.

### 상태는 어떻게 유지되는가

함수는 매번 새로 실행되므로 지역 변수는 남지 않는다. 그래서 상태는 함수 밖, `FunctionComponent` 인스턴스의 `hooks` 배열에 둔다.
Hook은 이름을 받지 않으므로 호출 순서로 자기 칸을 찾는다. 렌더를 시작할 때 `hookIndex`를 0으로 되돌리고, Hook이 호출될 때마다 1씩 올린다.
호출 순서가 바뀌면 칸이 어긋나므로, Hook은 루트 컴포넌트에서만 쓴다. 자식 컴포넌트는 Props만 받는 순수 함수이고, 상태를 바꿀 때는 Props로 받은 함수를 호출한다.

```text
setState ─ 칸의 값 변경 ─ update 예약(queueMicrotask, 한 번만)
                                │
update ─ 컴포넌트 실행 ─ 새 Virtual DOM ─ diff ─ patch ─ effect 실행
```

여러 `setState`는 값을 바로 바꾸고 `update()`는 한 번만 예약하므로, 렌더도 한 번만 일어난다.
`useEffect`는 렌더 중에 deps만 비교하고 `patch` 뒤에 실행한다. `useMemo`는 값이 이번 Virtual DOM에 쓰이므로 렌더 중에 계산한다.

## 구조

```text
index.html                 Phase 1 검증 페이지
phase2.html                Phase 2 게임 페이지
src/
├── nav.css                두 페이지의 이동 링크
├── core/                  페이지를 모르는 코드
│   ├── domToVdom.js       DOM → Virtual DOM
│   ├── createDom.js       Virtual DOM → DOM, 속성 넣고 지우기
│   ├── html.js            Virtual DOM ↔ HTML 문자열
│   ├── diff.js            두 Virtual DOM 비교
│   ├── patch.js           변경 목록을 실제 DOM에 적용
│   ├── describeChanges.js 변경 목록을 한 줄 설명으로 변환
│   ├── h.js               Virtual DOM 생성, 자식과 속성 정규화
│   ├── hooks.js           useState, useEffect, useMemo
│   └── FunctionComponent.js  hooks 배열, mount(), update()
├── phase1/                Phase 1 페이지 전용 코드
│   ├── StateHistory.js
│   ├── formatHtml.js      textarea에 넣을 HTML 정렬
│   ├── main.js
│   └── style.css
└── phase2/                Phase 2 페이지 전용 코드
    ├── gameData.js        선택지, 함수 이름 같은 상수
    ├── gameLogic.js       게임 규칙을 담은 순수 함수
    ├── components.js      Props만 받는 자식 컴포넌트
    ├── Game.js            루트 컴포넌트. Hook은 여기에서만 쓴다
    ├── inspector.js       관찰 패널
    ├── main.js
    └── style.css
tests/
├── core/, phase1/, phase2/  단위 테스트 (Vitest, jsdom)
└── e2e/                   기능 테스트 (Playwright, Chrome)
```

`src/core/`는 State History와 페이지를 알지 못한다. Phase 2의 리렌더링은 Phase 1의 `diff`와 `patch`를 그대로 쓴다.

## 테스트

단위 테스트는 jsdom에서 실행한다.

```bash
npm test
```

기능 테스트는 Chrome에서 실제 화면 동작을 확인한다. jsdom과 브라우저의 파싱 결과가 다른 경우가 있어서 따로 둔다.

```bash
npm run test:e2e
```

## 문서

- [요구사항](docs/requirements.md)
- [설계](docs/architecture.md): 설계 결정의 이유와 `범위 밖` 항목
- [디자인](DESIGN.md): 검증 페이지가 따르는 시각 언어
- [API](docs/api.md): JSDoc에서 자동 생성한다. 다시 만들려면 `npm run docs`를 실행한다.

## 알려진 한계

`key`로 목록을 비교하지 않으므로, 목록 앞쪽에 항목을 넣으면 뒤따르는 항목이 모두 변경으로 잡힌다.
입력 HTML은 사용자가 직접 쓰는 샘플로 보고 보안 필터링을 하지 않는다. `<script>`도 그대로 실행되므로 믿을 수 없는 HTML을 넣으면 안 된다.
Hook과 State는 과제 제약대로 루트 컴포넌트에서만 쓸 수 있다. `onChange`는 브라우저의 `change` 이벤트이므로 입력마다 받으려면 `onInput`을 쓴다.
나머지 한계는 [설계 문서의 `범위 밖`](docs/architecture.md#범위-밖)과 `Phase 2 범위 밖`에 있다.
