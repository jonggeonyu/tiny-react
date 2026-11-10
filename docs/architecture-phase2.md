# Phase 2 설계

이 문서는 Phase 2의 설계이다. Virtual DOM 형태, Diff, Patch는 `docs/architecture-phase1.md`에 있다. 과제 요구사항은 `docs/requirements.md`에 있다.

## Phase 1에서 넘긴 항목
Phase 1 최종 리뷰에서 나온 내용이고, Phase 2 설계에서 아래처럼 정했다.

| 항목 | 문제 | 결정한 곳 |
|---|---|---|
| 속성을 지우는 경로 | `onClick`처럼 속성이 아닌 값은 `removeAttribute`로 지워지지 않는다. | `속성과 이벤트`의 `removeProp` |
| 자식 정규화 | core는 자식으로 문자열과 요소만 받는다. | `h: Virtual DOM 생성` |
| 루트 감싸기 | 감싸지 않으면 `path: []`의 `REPLACE`가 나와 마운트 영역 자체가 교체된다. | `FunctionComponent` |
| `input`의 `value`와 `checked` | 입력 뒤 값을 비우려면 프로퍼티로 다뤄야 한다. | `속성과 이벤트`의 `setProp` |

## 구조
렌더링 순서는 컴포넌트 실행, 새 Virtual DOM 생성, Diff, Patch, effect 실행이다.

```text
h(type, props, ...children)   Virtual DOM 생성. 자식 컴포넌트를 실행하고 값을 정규화함
FunctionComponent             hooks 배열, mount(), update()
useState, useEffect, useMemo  현재 렌더 중인 FunctionComponent의 hooks 칸을 씀
setProp, removeProp           속성, 프로퍼티, 이벤트를 넣고 지움
diff, patch, renderRoot       Phase 1 코드를 그대로 씀
```

`diff`는 동작을 바꾸지 않는다. 함수 값이 들어오는 만큼 타입 주석만 고친다.
core의 기존 코드에서 동작이 바뀌는 곳은 `setProp`과, `patch`가 `removeAttribute` 대신 `removeProp`을 부르는 부분뿐이다.

```text
phase2.html                  Phase 2 테스트 페이지
src/
├── core/
│   ├── h.js                 h, normalizeChildren
│   ├── hooks.js             useState, useEffect, useMemo
│   ├── FunctionComponent.js
│   └── describeChanges.js   src/phase1/에서 옮김
└── phase2/                  Phase 2 페이지 전용 코드
    ├── gameData.js          선택지, 함수 이름 같은 상수
    ├── gameLogic.js         게임 규칙을 담은 순수 함수
    ├── components.js        Props만 받는 자식 컴포넌트
    ├── Game.js              루트 컴포넌트. Hook은 여기에서만 쓴다
    ├── inspector.js         관찰 패널
    ├── main.js              마운트
    └── style.css
```

새 파일은 Phase 2 페이지를 몰라야 하므로 `src/core/`에 둔다.
`describeChanges`는 페이지를 모르는 함수이고 Phase 1과 Phase 2가 함께 쓰므로 `src/core/`로 옮긴다.

## h: Virtual DOM 생성
JSX 대신 `h(type, props, ...children)`을 쓴다.

이유: JSX는 빌드 설정이 필요하고, 과제는 Vanilla JavaScript로 구현한다.

- `props`가 `null`이나 `undefined`이면 `{}`로 본다.
- `type`이 문자열이면 `{ type, props, children }`을 돌려준다. 속성과 자식을 아래 규칙으로 정규화한다.
- `type`이 함수이면 그 자리에서 `type({ ...props, children })`을 호출하고 결과를 돌려준다. 자식 컴포넌트의 `props`는 정규화하지 않고, `children`만 정규화해서 넘긴다.

이유: 자식 컴포넌트는 상태가 없는 순수 함수이므로 바로 실행해도 된다. Virtual DOM에는 태그만 남아서 `{ type, props, children }` 형태를 지키고, `diff`는 컴포넌트를 몰라도 된다.
자식 컴포넌트가 배열이나 `null`을 돌려줘도 부모의 자식 정규화가 처리한다.

`normalizeChildren(children)`의 규칙은 다음과 같다.

| 값 | 처리 |
|---|---|
| 문자열, 요소 | 그대로 둔다. 빈 문자열도 텍스트이므로 남긴다. |
| 숫자 | 문자열로 바꾼다. `0`도 화면에 나온다. |
| `null`, `undefined`, `true`, `false` | 버린다. |
| 배열 | 재귀로 펼친다. |
| 그 밖의 객체와 함수 | `TypeError`를 던진다. 그대로 두면 `createDom`이 알아보기 어려운 오류를 낸다. |

나란히 있는 문자열은 합치지 않는다. `createDom`이 자식마다 노드 하나를 만들므로 `path`는 어긋나지 않고, 바뀐 텍스트만 갱신된다.

속성의 규칙은 다음과 같다.

| 값 | 처리 |
|---|---|
| `null`, `undefined`, `false` | 버린다. `diff`가 사라진 속성으로 잡아 `removeProp`을 부른다. |
| `true` | `''`로 바꾼다. 파서가 `<input checked>`를 `checked: ''`로 만드는 것과 같다. |
| 숫자 | 문자열로 바꾼다. |
| 문자열, 함수 | 그대로 둔다. |

이유: `setAttribute('disabled', false)`는 `disabled="false"`를 만들어 실제로 비활성화된다.

## FunctionComponent
`new FunctionComponent(component, container, { onCommit })`로 만든다. 세 번째 인자는 생략할 수 있다.

- `hooks`: Hook 칸의 배열이다. 인스턴스마다 따로 있다.
- `hookIndex`: 지금 몇 번째 Hook인지 가리킨다. 렌더를 시작할 때 0으로 되돌린다.
- `vdom`: 지금 화면의 루트 Virtual DOM이다. `patch`가 끝난 뒤에 갱신한다.

렌더는 다음 일을 한다.

1. `hookIndex`를 0으로 되돌리고 실행할 effect 목록을 비운다.
2. 현재 컴포넌트를 이 인스턴스로 정하고, 컴포넌트 함수를 `{}`와 함께 호출한다.
3. 호출이 끝나면 성공과 실패에 상관없이 현재 컴포넌트를 비운다.
4. 결과를 `{ type: 'root', props: {}, children: normalizeChildren([result]) }`로 감싼다.

이유: 맨 위 노드가 항상 같아야 `path: []`의 `REPLACE`가 나오지 않는다. 컴포넌트가 배열이나 `null`을 돌려줘도 처리할 수 있다.

`mount()`는 렌더, `renderRoot`, `vdom` 저장, effect 실행 순서이다.
`update()`는 렌더, `diff`, `patch`, `vdom` 저장, effect 실행 순서이다.

- 이미 마운트한 인스턴스의 `mount()`와, 마운트 전의 `update()`는 오류를 던진다.
- 렌더 중에 `mount()`나 `update()`를 호출하면 오류를 던진다. 안쪽 렌더가 렌더 중 표시와 `hookIndex`를 망가뜨려서, 렌더 중 `setState` 검사가 우회되기 때문이다.
- 변경 목록이 비어 있어도 effect는 실행한다. 화면이 같아도 deps는 바뀔 수 있다.
- `patch`가 실패하면 Phase 1처럼 이전 `vdom`을 `renderRoot`로 다시 그리고 오류를 던진다. `vdom`은 갱신하지 않고 effect는 실행하지 않는다.
- 렌더가 실패하면 화면과 `vdom`은 그대로 두고 오류를 던진다.

`scheduleUpdate()`는 `update()`를 마이크로태스크로 한 번만 예약한다. 내부 도구로 `hooks.js`의 `withCurrentComponent`는 렌더 동안 현재 컴포넌트를 정하고, `withoutHooks`는 자식 컴포넌트를 실행하는 동안 현재 컴포넌트를 비운다.

`unmount()`는 요구사항에 없으므로 만들지 않는다.

`onCommit(changes)`는 `mount()`와 `update()`가 성공한 뒤 맨 끝에서 호출한다. `mount()`의 `changes`는 빈 배열이다.
요구사항에는 없고, 관찰 패널이 변경 목록을 받으려고 추가했다. 생략하면 동작이 같다.

## Hook 공통
`hooks.js`의 모듈 변수에 지금 렌더 중인 `FunctionComponent`를 둔다. 렌더 밖에서는 비어 있다.
칸은 `{ kind, ... }` 형태이고 `kind`는 `'state'`, `'effect'`, `'memo'` 중 하나이다.
첫 렌더에서만 칸을 만들고, 이후에는 `hookIndex`로 칸을 찾는다.

Hook 규칙을 어기면 값이 조용히 어긋나서 찾기 어려우므로, 아래 경우에 오류를 던진다.

- 현재 컴포넌트가 없을 때 Hook을 호출했다. 렌더 밖이거나 자식 컴포넌트 안이다. `h`는 자식 컴포넌트를 실행하는 동안 현재 컴포넌트를 비운다.
- 칸의 `kind`와 호출한 Hook이 다르다.
- 첫 렌더가 아닌데 칸이 없거나, 렌더가 끝났을 때 `hookIndex`가 `hooks.length`와 다르다.

## useState와 Batching
`useState(initial)`은 `[값, setState]`를 돌려준다. `setState`는 칸을 만들 때 한 번만 만들어 재사용한다.
지연 초기값은 요구사항에 없으므로 지원하지 않는다.

`setState(next)`는 다음 순서로 동작한다.

1. 렌더 중이면 오류를 던진다. 렌더 중의 상태 변경은 끝없는 렌더가 되기 쉽다.
2. `next`가 함수이면 `next(hook.state)`로 새 값을 구한다.
3. 새 값이 `Object.is`로 같고 직전 `update()`가 성공했으면 끝낸다.
4. 칸의 값을 바꾸고 `update()`를 예약한다.

`update()`가 실패하면 칸의 값은 새 값인데 화면은 이전 값이다. 3번에서 직전 실패를 보지 않으면, 원인이 사라진 뒤 같은 값으로 다시 시도해도 렌더가 일어나지 않아 화면이 어긋난 채 남는다. 그래서 인스턴스의 `isStale`을 실패할 때 `true`로, 성공할 때 `false`로 둔다.

예약은 `isScheduled`와 `queueMicrotask`로 한다. 이미 예약되어 있으면 아무것도 하지 않는다.
마이크로태스크에서는 `isScheduled`를 먼저 `false`로 되돌린 뒤 `update()`를 호출한다. `update()`가 실패해도 다음 `setState`가 다시 예약할 수 있다.

이유: 한 핸들러의 여러 `setState`를 렌더 한 번으로 묶고, 절반만 바뀐 상태로 렌더하지 않는다. effect 안의 `setState`가 렌더 도중에 렌더를 일으키는 재진입도 없어진다.
대가로 `setState` 직후에는 화면이 바뀌지 않으므로, 단위 테스트는 `await`로 기다려야 한다.

effect가 `setState`를 계속 부르면 마이크로태스크가 끝나지 않아 탭이 멈춘다.
그래서 effect를 실행하는 동안 예약한 횟수를 세고, 연속 50번을 넘으면 오류를 던진다. effect 밖에서 예약하면 횟수를 0으로 되돌린다.
오류를 던질 때는 횟수를 0으로 되돌리고 `isStale`을 `true`로 둔다. 칸의 값은 이미 바뀌었는데 렌더가 예약되지 않았기 때문이다.

## useEffect
`useEffect(effect, deps)`는 렌더 중에 deps만 비교하고, 달라졌으면 실행 목록에 넣는다.
effect 안에서 DOM을 읽을 수 있어야 하므로 실행은 `patch` 뒤에 한다.

- deps가 없으면 렌더마다 실행한다.
- deps 비교는 항목별 `Object.is`이다. 길이가 다르면 달라진 것으로 본다.
- 칸의 deps는 effect를 실행할 때 저장한다. 렌더나 `patch`가 실패해 effect가 실행되지 않으면 다음 렌더에서 다시 실행 목록에 들어간다.
- 실행할 때는 실행 목록을 먼저 비운 뒤, 이전 cleanup을 모두 실행하고, effect를 차례로 실행한다.
- effect가 함수를 돌려주면 cleanup으로 저장하고, 함수가 아니면 cleanup을 비운다.
- 실행 목록의 effect는 cleanup을 실행하기 전에 칸의 deps를 비운다. deps는 effect를 호출하기 직전에 저장하고, cleanup은 호출하기 전에 칸에서 비운다. 그래서 오류를 던진 effect는 deps가 바뀔 때까지 다시 실행되지 않고, 뒤에서 실행되지 못한 effect는 deps가 이전 값으로 돌아가도 다음 렌더에서 실행되며, cleanup은 두 번 돌지 않는다.

`unmount()`가 없으므로 마지막 cleanup은 실행되지 않는다.
실제 React와 달리 effect는 화면을 그리기 전에 동기로 실행한다.

## useMemo
`useMemo(compute, deps)`는 `useEffect`와 같은 deps 비교 함수를 쓴다.
달라졌으면 `compute()`를 실행해 값과 deps를 칸에 저장하고, 같으면 저장한 값을 돌려준다. deps가 없으면 렌더마다 계산한다.
값이 이번 Virtual DOM을 만드는 데 쓰이므로 렌더 중에 실행한다.

## 속성과 이벤트
`setProp(element, name, value)`는 다음 순서로 동작한다.

1. 값이 함수이고 이름이 `on`으로 시작하면 같은 이름의 속성을 지우고 `element[소문자 이름] = value`를 한 뒤 끝낸다.
2. `setAttribute`로 속성을 넣는다.
3. `input`과 `textarea`의 `value`는 프로퍼티와 값이 다를 때 프로퍼티도 맞춘다. `file` 타입은 제외한다.
4. `input`의 `checked`는 프로퍼티를 `true`로 맞춘다.

`removeProp(element, name)`은 `on`으로 시작하는 이름은 요소에 그 프로퍼티가 있을 때 `null`로, `input`의 `checked`는 `false`로, `input`과 `textarea`의 `value`는 `''`로 되돌린 뒤 `removeAttribute`를 부른다. `file` 타입의 `value`는 건드리지 않는다.
`removeAttribute`를 마지막에 부르는 이유: `checkbox`, `radio`, `hidden`, 버튼 종류의 `input`은 `value` 대입이 속성에 쓰이므로, 먼저 지우면 지운 속성이 `value=""`로 되살아난다.
`patch`의 `PROPS`는 `removeAttribute` 대신 이 함수를 부른다. `remove`를 먼저 적용하는 순서는 그대로이다.

이벤트에 `addEventListener`를 쓰지 않는 이유: 핸들러는 렌더마다 새 함수이므로 `setProp`이 계속 호출되고, 이전 함수를 기억해서 떼지 않으면 핸들러가 쌓인다. 프로퍼티 대입은 새 함수가 이전 함수를 교체하므로 이전 값이 필요 없다.

`value`와 `checked`에 속성과 프로퍼티를 함께 넣는 이유: 사용자가 입력한 뒤에는 속성을 바꿔도 화면이 바뀌지 않으므로 프로퍼티가 필요하다. 하지만 프로퍼티만 넣으면 `innerHTML`에 값이 나오지 않아 `vdomToHtml`이 깨진다.
`checked`를 값 그대로 대입하지 않는 이유: 파서가 만드는 `checked: ''`를 대입하면 `false`가 된다.
값이 같으면 대입하지 않는 이유: 입력 중인 커서와 한글 조합을 건드리지 않게 하려는 것이다.
`file` 타입을 제외하는 이유: 빈 문자열이 아닌 값을 대입하면 `InvalidStateError`가 난다.

`onChange`는 브라우저의 `change` 이벤트이므로 React와 달리 입력이 끝났을 때 발생한다. 입력마다 받으려면 `onInput`을 쓴다.

Phase 1 영향: `<textarea value="x">내용</textarea>`처럼 `value` 속성이 있는 `textarea`는 이제 `x`가 화면에 나온다. HTML의 `textarea`에는 `value` 속성이 없으므로 드문 입력이고 보정하지 않는다.

## Phase 2 범위 밖
- `key`는 Phase 1과 같이 지원하지 않는다. 항목을 지우면 뒤쪽 항목이 번호로 비교된다.
- `style`은 문자열만 지원한다. 객체를 넣으면 `[object Object]`가 된다.
- HTML 속성 이름을 그대로 쓴다. `className`이 아니라 `class`이다.
- `select`의 `value`는 지원하지 않는다. `createDom`이 속성을 자식보다 먼저 넣으므로 옵션이 없을 때 값이 들어가 적용되지 않는다.
- 상태가 입력을 거부할 때 화면의 값을 되돌리지 않는다. 입력 뒤에도 Virtual DOM이 그대로이면 `diff`가 변경을 찾지 못한다.
- 위치로 비교하므로 조건부 요소가 앞에서 사라지면 뒤쪽 요소가 교체되어 입력 포커스를 잃을 수 있다. 페이지는 입력창의 위치가 바뀌지 않게 만든다.
- 반대로 같은 위치의 같은 태그는 노드를 재사용하므로, 포커스 같은 DOM 상태가 다른 항목으로 넘어갈 수 있다. 다른 항목이 같은 자리에 오는 곳은 감싸는 태그를 다르게 해서 `REPLACE`로 새 노드를 만든다. 선택지(`div.choices`)와 회식 버튼(`section.choices`)이 이 경우이다.
  이유: 밤에 키보드로 `코딩`을 고르면, 회식 공지가 뜬 뒤에도 포커스가 같은 노드인 `회식 참석` 버튼에 남아 Enter 한 번에 회식에 참석했다. 더블클릭도 같은 이유로 회식 참석이 됐다.
- `value` 프로퍼티를 넣은 `textarea`는 이후 자식 텍스트가 바뀌어도 화면 값이 따라가지 않는다. `textarea`의 값은 `value`로 다룬다.
- Chrome에서 `value`가 `type`보다 앞에 있고 값에 줄바꿈이 있으면 `hidden`, `checkbox` 같은 타입은 줄바꿈을 잃는다. 대소문자만 다른 `VALUE`, `CHECKED`는 Phase 1처럼 지원하지 않는다.
- Hook 규칙의 오류는 일반적인 실수만 막는다. `h` 없이 `Child()`를 직접 호출하거나, `try/catch`로 Hook 오류를 삼키면 막지 못한다.
- 렌더 중 `setState` 검사와 effect 횟수 제한은 인스턴스별이다. 두 인스턴스가 서로 `setState`를 부르거나, 비동기 effect가 끝없이 `setState`를 부르면 막지 못한다. effect 안에서 `update()`를 직접 호출하거나 한도 오류를 삼켜도 제한이 풀린다.
- 실패한 `mount()`를 다시 부르면 이미 만든 칸을 재사용한다. 마운트 전의 `setState`는 마이크로태스크에서 오류가 난다.
- `onCommit`이 오류를 던지면 `mount()`와 `update()`도 오류를 던진다. 화면은 이미 반영된 뒤이다.
- `h`는 `props`가 객체인지, deps가 배열인지 검사하지 않는다. `NaN`과 `Infinity`는 문자열이 된다.

## 페이지 이동
Phase 1 검증 페이지(`index.html`)와 Phase 2 테스트 페이지(`phase2.html`)는 따로 둔다.
두 페이지의 맨 위에 같은 이동 링크 `Phase 1`, `Phase 2`를 두고, 지금 페이지의 링크에는 `aria-current="page"`를 넣어 강조한다.

```html
<nav class="page-nav" aria-label="페이지 이동">
  <a href="index.html">Phase 1</a>
  <a href="phase2.html">Phase 2</a>
</nav>
```

이동은 페이지를 새로 여는 일이므로 버튼이 아니라 링크로 만든다.
링크는 페이지마다 HTML에 직접 쓰고, 스타일만 `src/nav.css`로 함께 쓴다. 두 페이지 모두 이 링크는 `FunctionComponent`가 그리는 영역 밖에 있다.
페이지를 옮기면 게임 진행과 Phase 1의 History는 사라진다. 최고 기록만 `localStorage`에 남는다.

## 테스트 페이지: 정글 생존기
크래프톤 정글 생활을 소재로 한 선택 게임이다. 플레이어는 5일을 버티고 프로젝트 발표까지 간다.

이유: 다른 팀과 겹치지 않고, 정글 사람들이 공감해서 재미있어야 한다는 것이 사용자의 목표이다. 평범하게 읽으며 한 판에 2~3분이 걸려서 발표 때 끝까지 보여 줄 수 있다.
Phase 1처럼 `DESIGN.md`의 시각 언어를 따른다. 페이지 주소는 `/phase2.html`이다.

**화면 단계**는 `start`, `play`, `presentation`, `ending` 순서이다.

- `start`: 이름을 입력하고 시작한다. 공백을 뺀 이름이 비어 있으면 시작 버튼을 막는다. 최고 기록을 보여 준다.
- `play`: 날짜, 시간대, 스탯, 칭호, 남은 시간, 선택지, 사건 기록을 보여 준다.
- `presentation`: 설명을 보고 함수 이름을 입력하는 발표 이벤트이다.
- `ending`: 엔딩과 점수를 보여 주고 `다시 하기`로 `start`로 돌아간다. 이름과 최고 기록은 남긴다.

**턴:** 5일 동안 하루 세 번(오전, 오후, 밤) 선택하고, 5일째 밤은 선택 대신 발표이다. 그래서 선택은 14번이다.
선택마다 제한 시간은 20초이다. 시간이 지나면 `멍때리기`로 처리하고 턴이 지나간다.

**스탯**은 체력, 실력, 멘탈, 코치 의심도이고 값은 0~100으로 제한한다. 시작값은 70, 20, 60, 0이다.
아래 수치는 시작값이고, 플레이해 보며 `gameData.js`에서 조정한다.

| 선택 | 체력 | 실력 | 멘탈 | 의심도 |
|---|---|---|---|---|
| 코딩 | -10 | +15 | -5 | -5 |
| 담배 타임 | -3 | 0 | +10 | 0 |
| 코치님 몰래 나가기 | 0 | 0 | +20 | +20 |
| 집 가기 | +25 | 0 | +5 | +10 |
| 멍때리기(시간 초과) | 0 | 0 | -5 | 0 |

**판정 순서:** 선택을 적용하고, 의심도가 100이면 `코치 면담`으로 끝낸다. 아니면 순찰, 엔딩 확인, 회식 순서로 판정한다. 회식에 답한 뒤에도 엔딩을 확인한다.

이유: 의심도 100이면 순찰이 반드시 걸려서 80이 되므로, 순찰 뒤에 확인하면 `코치 면담`에 도달할 수 없다.

**사건**은 다음과 같다.

1. 코치 순찰: 의심도가 40 이상이면 의심도 %의 확률로 걸린다. 실력 -5, 멘탈 -15, 의심도 -20이다.
2. 회식: 밤 턴이 끝나면 30% 확률로 열린다. 한 판에 한 번만 열린다. 선택지는 참석과 불참이고 제한 시간은 같다. 시간이 지나면 불참이다.
   - 참석: 멘탈 +20, 체력 -15. 회식은 밤이 끝날 때 열리므로 숙취는 답하는 즉시 적용해도 다음 날이다.
   - 불참: 실력 +5, 멘탈 -5

**엔딩**은 앞의 조건이 먼저이다.

| 엔딩 | 조건 |
|---|---|
| 번아웃 | 체력이나 멘탈이 0 |
| 코치 면담 | 의심도가 100 |
| 그냥 집에 감 | 집 가기를 5번 선택 |
| 발표 대성공 | 발표 점수가 90 이상 |
| 발표 폭망 | 발표 점수가 90 미만 |

기준이 90인 이유: 실력만으로는 대부분 넘지 못해서 발표 문제가 엔딩에 영향을 준다. 기준이 70이면 실력이 높은 판은 문제를 하나도 못 풀어도 대성공이었다.

**발표 이벤트:** 코치의 질문에 답하는 방식이다. 개념 설명을 보고, 그 설명에 맞는 함수 이름을 떠올려서 입력한다. 제한 시간은 다섯 문제 전체에 40초이다.

| 설명 | 정답 |
|---|---|
| 값을 기억하고, 값이 바뀌면 화면을 다시 그리게 하는 Hook | `useState` |
| 화면이 그려진 뒤에 타이머 같은 바깥일을 처리하는 Hook | `useEffect` |
| 계산 결과를 저장해 두고, deps가 같으면 재사용하는 Hook | `useMemo` |
| 이전과 새 Virtual DOM을 비교해 변경 목록을 만드는 함수 | `diff` |
| 변경 목록을 실제 DOM에 반영하는 함수 | `patch` |

정답을 화면에 보여 주지 않는다. 글자 수만큼 칸을 보여 주고, 맞게 친 위치에는 그 글자를, 틀린 위치에는 `×`를 보여 준다. 대소문자를 구분한다.
이름을 완성하면 입력을 비우고 다음 문제로 넘어간다. `넘기기` 버튼을 누르면 맞힌 수를 올리지 않고 다음 문제로 넘어가며, 입력창에 포커스를 돌린다.
모두 끝나거나 시간이 끝나면 발표 점수를 낸다. 발표 점수는 실력 + 맞힌 문제 수 × 8이다.
입력에 ASCII가 아닌 글자가 있으면 한/영 키를 누르라는 안내를 보여 준다.

40초와 `넘기기`를 둔 이유: 따라 치기와 달리 떠올리는 시간이 필요하고, 모르는 문제에서 시간이 다 끝나면 뒤의 문제를 풀 수 없다.

이유: 함수 이름은 영어라서 한글 조합 문제가 없고, 이 프로젝트의 개념 복습도 된다. 다만 사용자의 입력기가 한글이면 영어를 칠 수 없어서 안내가 필요하다.

**칭호**는 앞의 조건이 먼저이다. 실력 70 이상은 `코드 장인`, 멘탈 20 이하는 `멘탈 파산`, 의심도 60 이상은 `수배자`, 체력 20 이하는 `좀비`, 그 밖에는 `평범한 정글러`이다.

**최고 기록**은 발표 점수의 최댓값이고 `localStorage`의 `tiny-react-best-score`에 저장한다. 저장소를 쓸 수 없으면 오류 없이 기록만 남지 않는다.

**Hook의 쓰임:** 게임 규칙은 `gameLogic.js`의 순수 함수로 두고, `Game`은 결과를 상태에 넣는다.

| Hook | 쓰임 |
|---|---|
| `useState` | `name`, `game`(턴 진행 전체), `timeLeft`, `typed`, `bestScore` |
| `useEffect` | 1초 타이머와 cleanup, 시간 초과 처리, 입력창 포커스, 최고 기록 읽기와 저장, 사건 기록 스크롤 |
| `useMemo` | 칭호, 발표 글자별 판정 |

확률 판정은 렌더가 아니라 클릭 핸들러와 시간 초과 처리에서 한다. 렌더 중에 난수를 쓰면 같은 상태에서 화면이 달라진다.
`gameLogic.js`의 함수는 `random`을 인자로 받아서 테스트에서 결과를 고정할 수 있게 한다.

시간 초과와 클릭이 겹쳐도 턴이 두 번 지나가면 안 된다. 시간 초과 처리는 예약할 때의 턴 번호를 넘기고, 이미 다른 턴이면 아무것도 하지 않는다.
다만 시간 초과 effect는 같은 렌더의 턴 번호를 읽으므로 이것만으로는 같은 배치의 클릭을 막지 못한다. 그래서 선택, 회식 답변, 시작, 다시 하기 핸들러는 `setTimeLeft(20)`도 함께 호출해서, 같은 배치에서 남은 시간이 0으로 남지 않게 한다.

**관찰 패널:** 게임 옆의 접을 수 있는 패널이다. 렌더 횟수, `hooks` 칸의 현재 값, 최근 변경 목록 8줄을 보여 준다.

- 접기는 HTML의 `<details>`로 한다. `FunctionComponent`는 그 안쪽 영역만 그리므로 `open`이 Virtual DOM과 어긋나도 문제가 없다.
- 패널도 Hook 없는 `FunctionComponent`로 그린다. 게임의 `onCommit`이 패널의 `update()`를 호출한다. 패널이 게임을 다시 렌더하지 않으므로 서로 영향이 없다.
- 변경 설명은 `describeChanges`를 쓴다. 핸들러는 렌더마다 새 함수라서 기록을 채우므로, 함수 값의 변경은 패널에서 뺀다. 남는 변경이 없으면 `화면 변경 없음`으로 표시한다.

시간 되감기는 넣지 않는다. 시간이 남으면 제안한다.
