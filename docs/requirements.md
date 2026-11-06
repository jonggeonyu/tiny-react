# 요구사항
두 단계에 걸쳐 동작하는 미니 리액트를 Vanilla HTML, CSS, JavaScript(또는 TypeScript)로 구현한다.
React, Vue 같은 외부 프레임워크는 사용할 수 없다.
최종 결과물은 사용자의 입력과 클릭에 따라 부분 업데이트되는 웹 페이지이다.

## 1. Phase 1: Virtual DOM, Diff, Patch
- 브라우저의 DOM을 읽어 Virtual DOM으로 변환하는 함수를 작성한다.
- 두 Virtual DOM을 비교해 변경된 부분을 찾는 Diff 알고리즘을 작성한다.
- 검증 페이지에는 실제 영역, 테스트 영역과 Patch, 뒤로가기, 앞으로가기 버튼이 있어야 한다.
- 페이지를 로드하면 실제 영역의 샘플 HTML을 Virtual DOM으로 변환하고, 이 Virtual DOM으로 테스트 영역을 렌더링한다.
- 사용자는 테스트 영역의 샘플 HTML 코드를 자유롭게 수정할 수 있다.
- Patch 버튼을 누르면 테스트 영역을 다시 Virtual DOM으로 만들고, 이전 Virtual DOM과 비교해 변경된 부분만 실제 영역에 반영한다.
- 새 Virtual DOM은 State History에 저장한다.
- 뒤로가기와 앞으로가기는 State History의 Virtual DOM으로 이동하며, 실제 영역과 테스트 영역을 함께 바꾼다.

## 2. Phase 2: Component, State, Hooks
- 컴포넌트는 반드시 함수형으로 구현한다.
- 함수형 컴포넌트를 감싸는 `FunctionComponent` 클래스를 만들고, `hooks` 배열과 `mount()`, `update()`를 구현한다.
- Hook은 최상위 컴포넌트, 즉 루트 컴포넌트에서만 사용하고, State도 루트 컴포넌트에서만 관리한다.
- 자식 컴포넌트는 State 없이 Props만 받는 순수 함수로 구현한다. 이 구조를 Lifting State Up 패턴이라고 한다.
- State가 바뀌면 화면이 자동으로 다시 그려져야 한다.
- `useState`, `useEffect`, `useMemo`를 최소 구현 대상으로 한다.

## 3. Phase 1과 Phase 2의 연계
State가 바뀌어 다시 렌더링할 때 Phase 1의 Virtual DOM, Diff, Patch를 그대로 사용한다.
새 Virtual DOM을 만들고, 이전 Virtual DOM과 비교한 뒤, 바뀐 부분만 실제 DOM에 반영한다.

## 4. 테스트 페이지와 품질
테스트 페이지의 주제는 자유이지만, 사용자의 입력이나 클릭에 따라 화면이 바뀌어야 한다.
Virtual DOM 변환, Diff, Patch, `useState`, `useEffect`, `useMemo` 등 각 모듈은 단위 테스트로 검증한다.
화면 동작은 기능 테스트로 확인한다.
엣지 케이스를 최대한 고려하고, 이력서와 포트폴리오에 넣을 수 있는 수준으로 완성한다.
AI로 코드를 생성해도 되지만, 핵심 로직은 이해하고 설명할 수 있어야 한다.
Batching은 선택 과제이다.
다른 팀과 차별화할 수 있는 추가 구현 요소도 고민한다.

## 5. 학습 중점
- Phase 1에서는 DOM을 다루는 방법, DOM 변화를 감지하는 브라우저 API, 실제 DOM이 느린 이유를 공부한다.
- 실제 DOM이 느린 이유는 Reflow와 Repaint 관점에서 설명한다.
- Virtual DOM의 구조와 필요성, Diff의 동작 방식과 5가지 핵심 케이스, 실제 DOM에 반영하는 방법을 공부한다.
- Phase 2에서는 Component를 나누는 기준, State를 두는 위치, `setState`가 상태 변경 외에 해야 할 일, 여러 상태 변경을 한 번에 처리하는 방법을 공부한다.
- 구현한 미니 리액트와 실제 React의 차이도 공부한다.
- Hooks의 핵심 질문은 "함수는 매번 새로 실행되는데, 상태는 어떻게 유지할까?"이다.

## 6. 미니 리액트와 실제 React의 차이
아직 구현 전이므로, 과제 요구사항을 기준으로 예상되는 차이를 정리한 것이다.

- 과제는 Hook과 State를 루트 컴포넌트에만 두지만, 실제 React는 모든 함수형 컴포넌트가 자기 State를 가질 수 있다.
- 과제는 `FunctionComponent`의 `hooks` 배열에 상태를 저장하지만, 실제 React는 컴포넌트별 Fiber 노드에 Hook 상태를 저장한다.
- 실제 React는 Render 단계와 Commit 단계를 나누고, Fiber 구조로 렌더링 작업을 관리한다.
- 실제 React는 상태 변경을 자동으로 Batching하지만, 과제에서 Batching은 선택 사항이다.
- 실제 React는 key로 목록의 항목을 구분하지만, key는 과제 문서의 요구사항에 없다.
- 실제 React의 요소는 `children`을 `props` 안에 두고, HTML의 `class`를 `className`으로 쓴다.

