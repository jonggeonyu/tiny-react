# tiny-react

바닐라 JavaScript로 만든 미니 UI 라이브러리입니다. 함수형 컴포넌트와 Hook으로 화면을 구성하고, 상태가 바뀌면 Virtual DOM을 비교해 필요한 부분을 실제 DOM에 반영합니다.

브라우저의 ES Modules로 소스 파일을 직접 가져와 사용합니다. JSX와 별도 빌드 도구는 사용하지 않습니다. 현재 저장소는 npm 배포 패키지가 아닙니다.

## 빠르게 시작하기

프로젝트 루트에 아래 파일을 `example.html`로 저장하세요. import 경로는 이 위치를 기준으로 합니다.

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8">
    <title>tiny-react 카운터</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
      import {
        FunctionComponent,
        registerArea,
        registerEvent,
        useState,
      } from './src/phase2/index.js';

      // 아래 두 함수는 예제에서 정의하는 VDOM 생성 도우미입니다.
      function text(value) {
        return {
          type: 'text', tag: null, attributes: {},
          text: String(value), children: [], formState: null,
        };
      }

      function element(tag, children = [], attributes = {}) {
        return {
          type: 'element', tag, attributes,
          text: null, children, formState: null,
        };
      }

      function App({ title }) {
        const [count, setCount] = useState(0);
        const button = element('button', [text('+1')], { type: 'button' });
        registerEvent(button, 'click', () => setCount((previous) => previous + 1));

        return element('section', [
          element('h1', [text(title)]),
          element('p', [text(`현재 값: ${count}`)]),
          button,
        ]);
      }

      const container = document.querySelector('#app');
      registerArea('counter', container);
      const app = new FunctionComponent(App, {
        onError: (result) => console.error(result),
      });
      app.mount(container, { title: '카운터' });
    </script>
  </body>
</html>
```

프로젝트 루트에서 정적 서버를 실행한 뒤 [카운터 예제](http://127.0.0.1:4173/example.html)를 엽니다. Node.js가 필요합니다.

```sh
node tests/support/static-server.mjs 4173
```

버튼을 누르면 상태가 증가하고 숫자 텍스트가 갱신됩니다. 다른 프로젝트에 가져갈 때는 내부 모듈의 상대 경로가 유지되도록 `src/` 디렉터리를 함께 복사하세요.

## 컴포넌트 API

다음 API는 모두 `src/phase2/index.js`에서 가져옵니다.

| API | 설명 |
| --- | --- |
| `registerArea(id, container)` | 문자열 식별자로 컴포넌트가 관리할 DOM 영역을 등록합니다. |
| `new FunctionComponent(App, { onError })` | 함수형 컴포넌트를 실행하고 상태와 렌더링을 관리할 인스턴스를 만듭니다. `onError`는 선택 사항입니다. |
| `app.mount(container, props = {})` | 등록된 영역에 처음 렌더링합니다. |
| `app.update(props)` | props를 새 객체로 전체 교체하고 다시 렌더링합니다. 인자를 생략하면 기존 props를 유지합니다. |
| `app.unmount()` | 화면과 이벤트를 제거하고 Effect 정리를 실행합니다. 제거한 인스턴스는 재사용하지 않습니다. |
| `renderChild(Child, props = {})` | 렌더링 중 자식 컴포넌트를 실행하고 VDOM을 반환받습니다. |
| `registerEvent(node, type, handler)` | 렌더링 중 요소 VDOM에 `click`, `input`, `change` 이벤트를 등록합니다. |

첫 mount 대상은 문서에 연결된 빈 요소여야 합니다. 내부에 공백이나 줄바꿈 텍스트도 없어야 하며, 여러 루트의 관리 영역은 서로 겹칠 수 없습니다.

```js
// 빠르게 시작하기 예제의 app 인스턴스를 사용합니다.
app.update({ title: '새 제목' });
app.update();
app.unmount();
```

컴포넌트는 요소·텍스트 VDOM 객체 또는 `null`을 동기적으로 반환합니다. `null`은 화면을 비우면서 인스턴스와 상태를 유지합니다. VDOM 객체는 위 예제의 `type`, `tag`, `attributes`, `text`, `children`, `formState` 구조를 사용하며, 속성 값은 문자열로 전달합니다.

자식 컴포넌트는 props와 콜백으로 부모의 상태를 사용합니다. 아래는 빠르게 시작하기 예제의 `text`, `element` 도우미를 사용하는 예입니다.

```js
import { renderChild, registerEvent, useState } from './src/phase2/index.js';

function CounterButton({ count, onIncrement }) {
  const button = element('button', [text(`현재 값: ${count}`)]);
  registerEvent(button, 'click', onIncrement);
  return button;
}

function App() {
  const [count, setCount] = useState(0);
  return renderChild(CounterButton, {
    count,
    onIncrement: () => setCount((previous) => previous + 1),
  });
}
```

## Hook API

Hook은 **루트 컴포넌트의 최상위에서 매번 같은 순서로** 호출합니다. 조건문·반복문·이벤트 처리 함수 안이나 자식 컴포넌트에서는 호출하지 않습니다. 이는 이번 과제의 제약입니다.

### `useState(initialValue)`

상태와 상태 변경 함수를 반환합니다. 초기값으로 함수를 전달하면 최초 렌더링 때 실행합니다. 변경 함수에는 새 값 또는 이전 상태로 새 값을 계산하는 함수를 전달합니다.

```js
const [count, setCount] = useState(0);
// 아래 호출은 이벤트 처리 함수 등에서 실행합니다.
setCount(1);
setCount((previous) => previous + 1);
```

변경은 동기적으로 반영하며 배칭하지 않습니다. 이전 값과 `Object.is`로 같으면 다시 렌더링하지 않습니다. 객체와 배열은 직접 수정하지 말고 새 값으로 전달하세요.

### `useEffect(effect, dependencies?)`

DOM과 이벤트 반영이 확정된 뒤 실행할 작업을 등록합니다. 정리 함수를 반환하면 다음 실행 전과 unmount 때 호출합니다.

```js
useEffect(() => {
  const timer = setInterval(() => console.log('실행 중'), 1000);
  return () => clearInterval(timer);
}, []);
```

### `useMemo(calculate, dependencies?)`

의존성이 같으면 이전 계산 결과를 재사용합니다. 계산 함수에는 부수 효과를 넣지 않습니다.

```js
const doubled = useMemo(() => count * 2, [count]);
```

두 Hook의 의존성 규칙은 같습니다.

| 의존성 | 실행 시점 |
| --- | --- |
| 생략 | 렌더링마다 실행 |
| `[]` | 최초 실행. Effect 정리는 unmount 때 실행 |
| `[value, ...]` | 최초 실행 및 의존성의 길이나 값이 바뀔 때 실행. 값은 `Object.is`로 비교 |

활성 영역을 다른 DOM 대상으로 옮기는 경우에는 `[]` Effect도 정리 후 다시 실행합니다. 대상 교체는 `registerArea`에 같은 식별자와 새 요소를 전달하며, 입력 상태를 안전하게 옮길 수 없는 경우 거부될 수 있습니다.

## DOM 변환 · Diff · Patch

컴포넌트 없이 DOM 비교와 갱신 기능만 가져와 사용할 수도 있습니다.

| 함수 | 모듈 | 설명 |
| --- | --- | --- |
| `createVirtualRoot(container)` | `src/vdom.js` | 컨테이너의 자식 DOM을 읽어 가상 루트 트리로 변환합니다. |
| `renderVirtualRoot(tree, document)` | `src/render.js` | 가상 루트 트리를 `DocumentFragment`로 만듭니다. |
| `diff(oldTree, nextTree)` | `src/diff.js` | 두 트리를 비교해 변경 목록을 반환합니다. |
| `preparePatch(container, changes, oldTree)` | `src/patch.js` | 현재 DOM 경로를 확인하고 반영할 작업을 준비합니다. |
| `applyPatch(container, actions, nextTree)` | `src/patch.js` | 준비한 작업과 최종 폼 상태를 실제 DOM에 반영합니다. |

아래 코드는 빈 `<div id="result"></div>`가 있는 페이지의 모듈 스크립트에서 실행할 수 있습니다.

```js
import { createVirtualRoot } from './src/vdom.js';
import { renderVirtualRoot } from './src/render.js';
import { diff } from './src/diff.js';
import { preparePatch, applyPatch } from './src/patch.js';

const source = document.createElement('div');
source.innerHTML = '<p>안녕하세요</p>';
const oldTree = createVirtualRoot(source);
const container = document.querySelector('#result');
container.replaceChildren(renderVirtualRoot(oldTree, document));

source.innerHTML = '<p>반갑습니다</p>';
const nextTree = createVirtualRoot(source);
const changes = diff(oldTree, nextTree);
const actions = preparePatch(container, changes, oldTree);
applyPatch(container, actions, nextTree);
```

`container`의 현재 DOM은 `oldTree`와 일치해야 합니다. 직접 사용하는 Patch 함수에는 컴포넌트의 자동 복구 처리가 포함되어 있지 않습니다. 연속 갱신할 때는 성공한 `nextTree`를 다음 비교의 이전 트리로 사용하세요.

`createVirtualRoot`는 제한된 HTML 태그·속성·스타일만 지원합니다. 허용 목록은 [src/vdom.js](src/vdom.js)를 확인하세요. HTML 문자열 이벤트 속성과 주석은 지원하지 않습니다.

목록의 요소에는 `attributes: { 'data-key': 'apple' }`처럼 key를 지정할 수 있습니다. 같은 부모 안에서 고유하고 공백만으로 이루어지지 않은 문자열이어야 합니다. 같은 key와 태그의 항목은 순서가 바뀌어도 기존 DOM을 재사용하며, 태그가 바뀌면 교체합니다. 부모가 다른 항목의 이동은 삭제와 추가로 처리합니다.

## 오류 처리와 지원 범위

`mount`, `update`, `unmount`, 상태 변경 함수는 작업 결과를 반환합니다.

- `ok`: 작업의 성공 여부입니다.
- `committed`: 화면·상태 변경이 확정되었는지 나타냅니다. Effect 오류처럼 `ok: false`여도 `true`일 수 있습니다.
- `errors`: 이번 작업의 오류 목록입니다. 각 항목에 `phase`와 원래 `error`가 들어갑니다.
- `recovery`: 복구 정보가 있을 때 `not-needed`, `restored`, `failed`로 전달합니다.

실패는 `onError`에도 전달되며, 사용자 안내 UI는 사용하는 쪽에서 연결합니다. mount 전 update 같은 잘못된 호출은 예외를 던집니다. 복구 실패나 Effect 차단 오류는 새로고침이 필요할 수 있으며, 사용자 코드의 부수 효과까지 되돌리지는 않습니다.

JSX, 클래스형 컴포넌트, 비동기 컴포넌트, 자식의 상태·Hook, 상태 변경 배칭과 중첩 루트는 지원하지 않습니다. 관리 영역 내부의 DOM과 이벤트 리스너는 라이브러리가 관리하도록 두세요.

## 데모와 테스트

위 정적 서버를 실행하면 다음 데모를 열 수 있습니다.

- [Phase 1: DOM 비교와 Patch](http://127.0.0.1:4173/index.html)
- [Phase 2: 컴포넌트와 Hook](http://127.0.0.1:4173/phase2/index.html)

테스트 의존성을 설치하고 실행합니다. 브라우저 테스트의 기본 실행 환경은 설치된 Google Chrome입니다.

```sh
npm install
node --test tests/unit/*.test.js
npm run test:acceptance
npx playwright test -c tests/phase2/playwright.config.js
```

기존 README의 설계 기록은 [README.backup.md](README.backup.md)에 보관했습니다.
