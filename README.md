# tiny-react

Vanilla JavaScript로 구현하는 미니 리액트이다. 외부 프레임워크 없이 Virtual DOM, Diff, Patch를 직접 만든다.

| 단계 | 내용 | 상태 |
|---|---|---|
| Phase 1 | Virtual DOM, Diff, Patch, State History, 검증 페이지 | 완료 |
| Phase 2 | Component, State, Hooks | 예정 |

## 실행

Node.js 22에서 확인했다. 기능 테스트는 설치된 Chrome을 쓴다.

```bash
npm install
```

```bash
npm run dev
```

개발 서버가 뜨면 `http://localhost:5173`을 연다.

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
| `PROPS` | 속성이 바뀌거나 생기거나 사라질 때 | `removeAttribute`, `setAttribute` |

자식은 같은 번호끼리 비교한다. 추가는 앞에서부터, 삭제는 뒤에서부터 기록하므로 적용하는 동안 앞쪽 번호가 밀리지 않는다.

## 구조

```text
index.html             Phase 1 검증 페이지
src/
├── core/              Phase 2에서 재사용하는 코드
│   ├── domToVdom.js   DOM → Virtual DOM
│   ├── createDom.js   Virtual DOM → DOM
│   ├── html.js        Virtual DOM ↔ HTML 문자열
│   ├── diff.js        두 Virtual DOM 비교
│   └── patch.js       변경 목록을 실제 DOM에 적용
└── phase1/            Phase 1 페이지 전용 코드
    ├── StateHistory.js
    ├── formatHtml.js  textarea에 넣을 HTML 정렬
    ├── main.js
    └── style.css
tests/
├── core/, phase1/     단위 테스트 (Vitest, jsdom)
└── e2e/               기능 테스트 (Playwright, Chrome)
```

`src/core/`는 State History와 페이지를 알지 못한다. Phase 2의 리렌더링이 같은 코드를 그대로 쓰기 위해서이다.

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
나머지 한계는 [설계 문서의 `범위 밖`](docs/architecture.md#범위-밖)에 있다.
