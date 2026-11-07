# tiny-react

Vanilla JavaScript로 미니 리액트를 구현한다.
Phase 1은 Virtual DOM, Diff, Patch이고, Phase 2는 Component, State, Hooks이다.
전체 요구사항은 `docs/requirements.md`에 있다. 기능을 구현하기 전에 관련 절을 읽는다.
설계는 `docs/architecture.md`에 있다. 구현 전에 관련 절을 읽는다.

## 명령어
- 테스트: `npm test`
- 브라우저 기능 테스트: `npm run test:e2e`
- 개발 서버: `npm run dev`
- API 문서 생성: `npm run docs` (`src/`에 `.js` 파일이 있어야 동작한다)

## 과제 제약
- React, Vue 같은 외부 프레임워크를 쓰지 않는다.
- 컴포넌트는 함수형으로만 구현한다.
- `FunctionComponent` 클래스는 `hooks` 배열과 `mount()`, `update()`를 가진다.
- Hook과 State는 루트 컴포넌트에서만 사용한다.
- 자식 컴포넌트는 Props만 받는 순수 함수로 구현한다.
- Phase 2의 리렌더링은 Phase 1의 Diff와 Patch를 그대로 사용한다.

## 설계 결정
- Virtual DOM 노드의 형태는 `{ type, props, children }`이다.
- 텍스트 노드는 문자열로 표현한다.
- `children`은 항상 배열이고, 속성이 없으면 `props`는 `{}`이다.
- State History는 Virtual DOM 리스트와 현재 위치를 가리키는 포인터로 구현한다.
- 렌더링 순서는 컴포넌트 실행, 새 Virtual DOM 생성, Diff, Patch, effect 실행이다.

## 작업 방식
- 구현 전에 계획을 확인받고, 작은 단위로 구현한다.
- 단위마다 테스트를 추가하고 `npm test` 통과를 확인한 뒤 완료로 보고한다.
- 화면 동작을 바꾸면 브라우저에서도 확인한다.
- 단위가 끝나면 핵심 로직을 짧게 설명한다.
- 요구사항에 없는 기능은 구현하지 않고 제안만 한다.
- 단위가 끝나면 검증과 `npm test` 통과를 확인한 뒤 확인받지 않고 작업 브랜치에 커밋하고 push한다.
- PR, 이슈, 저장소 생성은 매번 먼저 확인받는다.
- 커밋 메시지에 이슈를 닫는 키워드를 쓰지 않는다.

## 문서화
- 내보내는 함수와 클래스에는 JSDoc을 작성한다.
- `docs/api.md`는 자동 생성 파일이므로 직접 고치지 않는다.
- 구조나 설계가 바뀌면 `docs/architecture.md`에 변경 내용과 이유를 적는다.

## 작업 분담
- 설계는 메인 세션에서 사용자와 확정하고 `docs/architecture.md`에 기록한다.
- HTML, CSS, 테스트 틀은 `ui-builder`에게 맡긴다.
- Virtual DOM, Diff, Patch, Hook은 `core-builder`에게 맡긴다.
- 구현 단위가 끝나면 `verifier`에게 검증을 맡긴다.
- `verifier`에게는 구현 과정을 설명하지 않고, 검증할 범위만 알려 준다.

## 토큰과 속도
- Phase가 바뀌면 새 세션에서 시작한다. 이어 갈 내용은 문서와 커밋에 남긴다.
- 에이전트의 기본은 Sonnet, 중간 강도이다. Diff, Patch, Hook처럼 어려운 단위만 호출할 때 `model: opus`, `effort: high`를 지정한다.
- 고의 결함 검사는 `verifier`만 한다. 무작위 검사는 1,000건을 넘기지 않는다.
- 에이전트 보고는 문제와 결론만 20줄 이내로 받는다. 긴 근거는 꼭 필요할 때만 저장소 밖 단위별 파일에 이어 쓴다.
- Critical과 Important는 그 단위 안에서 고친다. Minor는 모아서 Phase 끝에 한 번에 고친다.
- `DESIGN.md` 같은 큰 문서는 전체를 읽지 않는다. 필요한 절이나 값만 찾아 담당에게 넘긴다.
