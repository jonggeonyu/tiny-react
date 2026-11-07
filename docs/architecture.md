# 설계

이 문서는 Phase 1과 Phase 2의 설계이다. Phase 2는 맨 아래의 `Phase 2 설계`에 있다. 과제 요구사항은 `docs/requirements.md`에 있다.

JavaScript로 구현한다.

## 전체 구조
```text
domToVdom(node)              DOM 노드 → Virtual DOM
containerToVdom(container)   영역의 자식들 → 루트 Virtual DOM
createDom(vnode)             Virtual DOM → 실제 DOM
setProp(element, name, value)  속성 하나를 실제 DOM에 넣음
renderRoot(container, root)  루트 Virtual DOM으로 영역을 다시 그림
vdomToHtml(root)             루트 Virtual DOM → HTML 문자열
htmlToVdom(html)             HTML 문자열 → 루트 Virtual DOM
diff(oldVdom, newVdom)       변경 목록을 반환
patch(container, changes)    변경 목록을 실제 DOM에 적용
StateHistory                 저장, 뒤로, 앞으로, 현재 값 조회
formatHtml(root)             루트 Virtual DOM → 줄바꿈과 들여쓰기를 맞춘 HTML 문자열
버튼 핸들러                   위 함수들을 순서대로 호출
```

`src/core/`의 함수는 Phase 2에서 그대로 재사용한다.
그래서 이 함수들은 State History와 페이지의 영역을 알지 못하게 만든다.

## 파일 구조
코드는 ES 모듈로 작성한다.

```text
index.html                 Phase 1 검증 페이지
src/
├── core/                  Phase 2에서 재사용하는 코드
│   ├── domToVdom.js       domToVdom, containerToVdom
│   ├── createDom.js       createDom, renderRoot, setProp
│   ├── html.js            vdomToHtml, htmlToVdom
│   ├── diff.js
│   ├── patch.js
│   └── describeChanges.js 변경 목록을 한 줄 설명으로 변환
└── phase1/                Phase 1 페이지 전용 코드
    ├── StateHistory.js
    ├── formatHtml.js      textarea에 넣을 HTML 정렬
    ├── main.js            페이지 로드와 버튼 핸들러
    └── style.css
tests/                     src/의 파일별 단위 테스트
└── e2e/                   브라우저 기능 테스트
```

## 개발 환경
외부 프레임워크 없이 Vanilla JavaScript로 구현하고, 아래 도구는 개발할 때만 사용한다.

- Vite는 ES 모듈을 쓰는 페이지를 띄우는 개발 서버이다.
- Vitest는 단위 테스트를 실행하고, jsdom은 테스트에서 브라우저 DOM을 대신한다.
- jsdoc-to-markdown은 JSDoc 주석으로 `docs/api.md`를 만든다.
- Playwright는 실제 브라우저에서 화면 동작을 확인하는 기능 테스트를 실행한다. 설치된 Chrome을 쓰므로 브라우저를 따로 내려받지 않는다.

`npm test`는 `tests/**/*.test.js`를 jsdom 환경에서 실행한다.
`npm run test:e2e`는 `tests/e2e/*.spec.js`를 Chrome에서 실행한다. jsdom과 브라우저의 파싱 결과가 다른 경우가 있어서, 화면 동작은 브라우저에서 따로 확인한다.
JSDoc은 `_`로 시작하는 파일을 기본으로 제외하므로, `src/`의 파일 이름은 `_`로 시작하지 않는다.

## Virtual DOM 형태
- 요소는 `{ type, props, children }`으로 표현한다.
- 텍스트는 문자열로 표현한다.
- `children`은 항상 배열이고, 속성이 없으면 `props`는 `{}`이다.
- 영역의 내용은 루트 노드 `{ type: 'root', props: {}, children }`로 감싸서, 최상위 요소가 여러 개여도 처리할 수 있게 한다.
- 루트의 `type`과 `props`는 항상 같으므로, 실제 영역과 테스트 영역의 태그나 `id`가 달라도 Diff 결과에 나오지 않는다.
- Virtual DOM은 만든 뒤 수정하지 않는다. 그래서 State History에 복사 없이 저장할 수 있다.

## domToVdom: DOM을 Virtual DOM으로 변환
1. 텍스트 노드는 내용을 문자열로 돌려준다.
2. 요소는 `tagName`을 소문자로 바꿔 `type`에 넣는다.
3. `attributes`를 읽어 `props`를 만든다.
4. `childNodes`를 순회하면서 같은 변환을 재귀로 반복해 `children`을 만든다.
5. 주석 노드와, 공백만 있으면서 줄바꿈을 포함한 텍스트는 제외한다. 같은 줄의 공백만 있는 텍스트는 유지한다.
6. 제외한 뒤 텍스트가 나란히 남으면 하나의 문자열로 합친다.

여기서 공백은 HTML의 공백 문자(스페이스, 탭, 줄바꿈, 폼 피드)이다. `&nbsp;`는 화면에 보이는 내용이므로 공백으로 치지 않는다.

`domToVdom(node)`는 제외 대상 노드에 `null`을 돌려주고, 호출하는 쪽에서 걸러 낸다.

`containerToVdom(container)`는 `container`의 `childNodes`에 같은 변환을 적용해 루트 노드를 만든다.

## createDom: Virtual DOM을 실제 DOM으로 변환
테스트 영역을 렌더링할 때와, 노드 추가나 교체에서 새 요소를 만들 때 사용한다.

1. 문자열이면 `document.createTextNode`로 텍스트 노드를 만든다.
2. 객체이면 `document.createElement`로 요소를 만들고 `props`를 `setProp`으로 넣는다.
3. `children`을 재귀로 만들어 요소에 붙인다.

`renderRoot(container, root)`는 `root.children`을 `createDom`으로 모두 만든 뒤 `container`의 내용을 한 번에 바꾼다.
중간에 오류가 나면 기존 화면이 그대로 남는다.

## vdomToHtml과 htmlToVdom: HTML 문자열 변환
테스트 영역의 `textarea`는 문자열을 다루므로 두 변환이 필요하다.

- `vdomToHtml(root)`는 임시 요소에 `renderRoot`로 그린 뒤 `innerHTML`을 돌려준다.
- `htmlToVdom(html)`는 `<template>`의 `innerHTML`에 문자열을 넣고, `template.content`를 `containerToVdom`으로 변환한다.

이스케이프와 HTML 파싱은 브라우저에 맡기므로 직접 구현하지 않는다.
`<template>` 안의 내용은 화면에 그려지지 않고 파싱하는 동안 실행되지도 않으므로, 입력 중인 HTML을 안전하게 파싱할 수 있다.

## diff: 두 Virtual DOM 비교
`diff(oldVdom, newVdom)`는 변경 목록을 돌려주고, 실제 DOM은 건드리지 않는다.
노드마다 다음 순서로 판단한다.

1. 이전 노드가 없으면 노드 추가이다.
2. 새 노드가 없으면 노드 삭제이다.
3. 둘 다 텍스트이면 내용을 비교하고, 다르면 텍스트 변경이다.
4. 텍스트와 요소처럼 노드 종류가 다르거나 `type`이 다르면 노드 교체이고, 자식은 비교하지 않는다.
5. `type`이 같으면 속성을 비교하고, 값이 바뀌거나 새로 생기거나 사라진 속성을 속성 변경으로 기록한다.
6. 속성 변경 여부와 상관없이 자식을 재귀로 비교한다.

자식을 비교할 때는 새 `children`을 앞에서부터 돌며 같은 번호끼리 `diff`를 호출한다.
이전 자식이 없는 번호는 자연스럽게 노드 추가가 되고, 그다음 남은 이전 자식을 뒤에서부터 노드 삭제로 기록한다.

변경 목록의 각 항목은 변경 종류와 위치를 담는다.
`kind`는 변경 종류이고, `path`는 루트에서 `childNodes` 번호를 따라가는 경로이다.

```js
{ kind: 'ADD', path: [0, 2], node }       // 노드 추가
{ kind: 'REMOVE', path: [0, 2] }          // 노드 삭제
{ kind: 'TEXT', path: [0, 1], value: '배' } // 텍스트 변경
{ kind: 'REPLACE', path: [1], node }      // 노드 교체
{ kind: 'PROPS', path: [1], set: { class: 'b' }, remove: ['id'] } // 속성 변경
```

`PROPS`는 노드 하나의 속성 변경을 항목 하나로 묶는다.
`set`은 새로 생기거나 값이 바뀐 속성이고, `remove`는 사라진 속성의 이름이다.

변경 목록의 순서는 다음과 같이 정한다.

1. 같은 번호가 있는 자식은 앞에서부터 비교한다.
2. 새 자식이 더 많으면 남은 자식을 앞에서부터 `ADD`로 기록한다.
3. 이전 자식이 더 많으면 남은 자식을 뒤에서부터 `REMOVE`로 기록한다.

위치로만 비교하므로 추가와 삭제는 항상 자식 목록의 끝에서 일어난다.
따라서 이 순서대로 적용하면 앞쪽 번호가 밀리지 않는다.

## patch: 변경 목록을 실제 DOM에 적용
`patch(container, changes)`는 변경 목록을 받은 순서대로 실제 DOM에 적용하는 일만 한다.
`container`에서 `path`를 따라 `childNodes`로 내려가 노드를 찾고, `kind`에 맞는 DOM 작업을 실행한다.

- `ADD`는 `path`의 마지막 번호를 뺀 경로로 부모를 찾고, `createDom(node)`를 `appendChild`로 붙인다.
- `REMOVE`는 찾은 노드를 `remove`로 지운다.
- `TEXT`는 찾은 노드의 `nodeValue`를 바꾼다.
- `REPLACE`는 찾은 노드를 `createDom(node)`로 `replaceWith`한다.
- `PROPS`는 `remove`를 `removeProp`으로 먼저 적용하고, `set`을 `setProp`으로 적용한다. HTML 속성 이름은 대소문자를 구분하지 않으므로, 순서가 반대이면 `{ a: '1' }`이 `{ A: '1' }`로 바뀔 때 넣은 속성이 곧바로 지워진다.

`path`가 맞으려면 실제 DOM의 `childNodes`와 Virtual DOM의 `children`이 번호까지 일치해야 한다.

## StateHistory
- Virtual DOM을 저장하는 리스트와 현재 위치를 가리키는 포인터로 구현한다.
- 페이지 로드 때 만든 첫 Virtual DOM도 저장해서 첫 상태로 돌아올 수 있게 한다.
- 새로 저장할 때는 포인터 뒤의 기록을 지운 다음 추가하고, 포인터를 마지막 항목으로 옮긴다.
- 이동할 이전이나 다음 항목이 없으면 실패로 처리하고 화면을 바꾸지 않는다.
- `push(vdom)`는 저장하고, `current()`는 현재 값을 돌려준다.
- `back()`과 `forward()`는 포인터를 옮기고 그 위치의 값을 돌려주며, 이동할 수 없으면 `null`을 돌려준다.
- `position()`은 현재 위치를 1부터 센 값으로, `size()`는 저장된 개수로 돌려준다. 화면의 `현재 / 최대` 표시에 쓴다.

## 페이지 동작

### 페이지 로드
1. 실제 영역을 `containerToVdom`으로 변환한다.
2. 이 Virtual DOM을 `renderRoot`로 실제 영역에 다시 그린다. 샘플 HTML의 들여쓰기 공백과 주석이 사라져서 `path`가 맞게 된다.
3. 이 Virtual DOM으로 테스트 영역을 렌더링한다.
4. 이 Virtual DOM을 State History에 저장한다.

테스트 영역을 렌더링하는 일은 `textarea`에 `formatHtml` 결과를 넣고, 미리보기를 `renderRoot`로 그리는 일이다.

### Patch 버튼
1. `textarea`의 내용을 `htmlToVdom`으로 변환한다.
2. 이 Virtual DOM을 `renderRoot`로 미리보기에 그린다.
3. State History의 현재 Virtual DOM과 `diff`로 비교한다.
4. 변경 목록이 비어 있으면 History에 저장하지 않고 끝낸다.
5. 변경 목록을 `patch`로 실제 영역에 적용한다.
6. 새 Virtual DOM을 State History에 저장한다.

`diff`나 `patch`가 실패하면 현재 Virtual DOM을 `renderRoot`로 실제 영역과 미리보기에 다시 그려서, 두 영역과 State History가 어긋나지 않게 한다. `textarea`는 사용자가 고칠 수 있게 그대로 둔다.

1~6번에서 오류가 나면 버튼 아래에 오류 내용을 한 줄로 보여 주고 History에 저장하지 않는다. `<div =a="1">`처럼 파서는 받아들이지만 `setAttribute`가 거부하는 입력이 있기 때문이다. 이 입력은 2번의 `renderRoot`에서 실패하므로 실제 영역에 닿지 않는다. 오류 표시는 다음에 성공한 동작에서 지운다.

### 뒤로가기와 앞으로가기
1. `current()`로 현재 Virtual DOM을 보관한다.
2. `back()`이나 `forward()`로 목표 Virtual DOM을 얻는다. `null`이면 끝낸다.
3. 보관한 Virtual DOM과 목표 Virtual DOM을 `diff`로 비교하고, 결과를 `patch`로 실제 영역에 적용한다.
4. 목표 Virtual DOM으로 테스트 영역을 다시 렌더링한다.

`patch`가 도중에 실패하면 목표 Virtual DOM을 `renderRoot`로 실제 영역에 다시 그린다. 포인터는 2번에서 이미 옮겨졌으므로, 실제 영역을 포인터에 맞춘다.

## 범위 밖
- 입력 HTML은 사용자가 직접 쓰는 샘플이므로 보안 필터링을 하지 않는다. `<script>`는 파싱할 때는 실행되지 않지만, 실제 영역과 미리보기에 그릴 때 영역마다 실행된다.
- `key`를 쓰는 목록 비교는 요구사항에 없으므로 구현하지 않는다.
- `{ a: '1', A: '1' }`처럼 대소문자만 다른 속성 이름이 함께 있는 `props`는 지원하지 않는다. HTML 속성 이름은 대소문자를 구분하지 않고, 파서는 이런 `props`를 만들지 않는다.
- SVG처럼 네임스페이스가 필요한 요소는 지원하지 않는다.
- `diff`는 Virtual DOM끼리만 비교하므로, 사용자가 `input`에 입력한 값처럼 실제 DOM에만 있는 값은 비교하지 않는다.
- 실제 영역은 `patch`와 `renderRoot`로만 바뀐다고 전제한다. `<details>`를 클릭해 생긴 `open`이나 `contenteditable`로 고친 내용처럼 사용자가 실제 영역을 직접 바꾸면 Virtual DOM과 어긋난다. `diff`는 Virtual DOM끼리만 비교하므로 이 어긋남을 찾지 못한다. `MutationObserver`로 감지할 수는 있지만 요구사항에 없어 구현하지 않는다.
- 실제 영역과 미리보기가 같은 문서에 있으므로, 같은 `name`의 라디오 버튼은 한 그룹이 되어 `checked` 상태가 한쪽에만 남는다.
- 사용자가 입력 중인 `textarea`의 HTML은 정렬하지 않는다. Patch는 `textarea`를 다시 쓰지 않고, 정렬은 페이지 로드와 뒤로가기, 앞으로가기에서만 일어난다.
- HTML 문자열로 왕복할 때 파서가 내용을 바꾸는 입력은 고치지 않아도 변경으로 잡힐 수 있다. 파싱을 브라우저에 맡기는 설계의 한계이므로 보정하지 않는다.
  - `<pre>`, `<textarea>`, `<listing>`의 첫 줄바꿈은 지워진다.
  - `&#13;`은 `\r`이지만 다시 읽으면 `\n`이 된다.
  - `<plaintext>`는 왕복할 때마다 닫는 태그가 내용에 붙는다.
  - `<form>`, `<a>`, 표 안의 `<li>`처럼 파서가 고쳐 주는 잘못된 중첩은 다시 읽을 때 또 달라질 수 있다.
  - `<noscript>`는 브라우저에서 문서 파서와 `<template>` 파서의 해석이 다르다. 샘플 HTML에 쓰지 않는다.
- `<template>` 요소는 내용이 `childNodes`가 아닌 `content`에 있으므로, 안의 내용은 Virtual DOM에 들어가지 않는다.
- 공백 규칙은 태그와 상관없이 적용한다. `<pre>`와 `<textarea>`처럼 공백이 의미를 갖는 요소에서도 줄바꿈이 포함된 공백만 있는 텍스트는 지워진다.
- 주석 사이의 줄바꿈도 지운 뒤 텍스트를 합치므로, `a<!--x-->\n<!--y-->b`는 `ab`가 된다.
- `form` 안 컨트롤의 `name`이나 `id`가 DOM 프로퍼티 이름과 같으면 `form`의 프로퍼티가 가려진다(DOM clobbering). `<form><input name="nodeType"></form>`은 `form`이 통째로 사라지고, `name="tagName"`은 `TypeError`가 난다. `<img name="createElement">`처럼 `document`의 메서드가 가려지는 경우도 같아서, 페이지를 새로 고칠 때까지 요소를 만들 수 없다. 막으려면 모든 DOM 접근을 프로토타입을 거치게 바꿔야 하고, `form`의 경우는 jsdom으로 테스트할 수도 없다. 드문 입력을 위해 코드가 복잡해지므로 범위 밖으로 둔다.

## 확정한 결정

### 테스트 영역
테스트 영역은 HTML 코드를 고치는 `textarea`와 미리보기로 만든다.
미리보기는 입력할 때마다 갱신하지 않고, Patch 버튼을 누를 때 갱신한다.

이 결정에 따라 페이지 동작에 두 가지 변환이 필요하다.

- 테스트 영역을 렌더링할 때는 `formatHtml`로 Virtual DOM을 HTML 문자열로 바꿔 `textarea`에 넣고, 미리보기도 같은 내용으로 그린다.
- 테스트 영역을 Virtual DOM으로 변환할 때는 `htmlToVdom`으로 `textarea`의 HTML 문자열을 변환한다.

### textarea의 HTML 정렬
`formatHtml(root)`는 요소마다 줄을 나누고 2칸씩 들여 쓴다.
자식이 모두 요소일 때만 줄을 나누고, 텍스트가 섞이면 그 요소 전체를 `vdomToHtml` 결과 그대로 한 줄에 둔다.
`<pre>`와 `<listing>`도 한 줄에 둔다.

이유: 정렬한 HTML을 다시 읽어도 Virtual DOM이 같아야 한다. 그래야 고치지 않은 Patch가 변경으로 잡히지 않는다.
요소 사이에 넣은 줄바꿈과 들여쓰기는 `domToVdom`이 지우지만, 텍스트 옆에 넣으면 텍스트의 일부가 된다.
`<pre>`는 파서가 첫 줄바꿈을 지워서 들여쓰기만 남으므로 내용이 된다.
`formatHtml`은 `textarea`에만 쓰는 페이지 전용 코드이므로 `src/core/`가 아니라 `src/phase1/`에 둔다.
텍스트가 섞인 요소 안은 정렬하지 않으므로, 최상위에 텍스트나 같은 줄 공백이 있으면 전체가 한 줄로 나온다.

### History 표시
테스트 영역의 오른쪽 위에 뒤로가기, `현재 / 최대`, 앞으로가기, Patch 순서로 놓는다.
`현재 / 최대`는 State History의 위치와 저장된 개수이다.

실제 영역 아래에는 Patch마다 무엇이 바뀌었는지 한 줄씩 보여 주는 기록을 둔다.
`describeChanges(changes)`가 변경 목록을 한 줄 설명으로 바꾼다.
기록은 State History와 번호를 맞춰 페이지에서 관리하고, 첫 항목은 초기 상태이다.
뒤로 간 뒤 새로 Patch하면 History처럼 앞쪽 기록을 지우고, 현재 위치의 기록을 강조한다.

실제 영역과 비교하기 쉽도록 미리보기를 위에, HTML 편집기를 아래에 둔다.

### 화면 디자인
검증 페이지의 색, 글자, 코너, 간격은 `DESIGN.md`의 시각 언어를 따른다.
강조는 오렌지 하나로 모으고, 구획은 그림자 대신 반투명 헤어라인으로 나눈다.
HTML 편집기는 코딩 도구처럼 어두운 표면으로 두고, 줄을 자동으로 접지 않아 정렬이 유지되게 한다.

### setProp
속성을 넣는 코드를 `createDom.js`의 `setProp(element, name, value)` 한 곳에 둔다.
`createDom`과 `patch`가 이 함수를 함께 쓴다.

이유: 속성을 넣는 경로가 둘로 갈라지면 처음 그린 화면과 Patch한 화면이 다르게 동작할 수 있다.
Phase 2에서 이벤트와 프로퍼티를 넣는 쪽은 이 함수에서 확장한다.
지우는 쪽은 `removeProp`을 추가해서 처리한다. `Phase 2 설계`의 `속성과 이벤트`에 있다.

### domToVdom의 반환값
제외 대상 노드는 `null`을 돌려주고, 호출하는 쪽에서 걸러 낸다.

이유: 노드 하나를 변환하는 일과 자식 목록을 정리하는 일을 나눠서, 텍스트 합치기를 자식 목록을 만드는 쪽 한 곳에서 처리한다.

### 요소 사이 공백
공백만 있는 텍스트 중 줄바꿈이 포함된 것만 지우고, 같은 줄의 공백은 유지한다.

이유: `<b>a</b> <i>b</i>`의 공백을 지우면 화면에 `a b`가 `ab`로 나온다.
샘플 HTML의 들여쓰기는 줄바꿈을 포함하므로 그대로 지워진다.
대신 요소를 줄을 바꿔 쓰면 브라우저와 달리 공백 없이 붙어서 나온다.

## Phase 1에서 넘긴 항목
Phase 1 최종 리뷰에서 나온 내용이고, Phase 2 설계에서 아래처럼 정했다.

| 항목 | 문제 | 결정한 곳 |
|---|---|---|
| 속성을 지우는 경로 | `onClick`처럼 속성이 아닌 값은 `removeAttribute`로 지워지지 않는다. | `속성과 이벤트`의 `removeProp` |
| 자식 정규화 | core는 자식으로 문자열과 요소만 받는다. | `h: Virtual DOM 생성` |
| 루트 감싸기 | 감싸지 않으면 `path: []`의 `REPLACE`가 나와 마운트 영역 자체가 교체된다. | `FunctionComponent` |
| `input`의 `value`와 `checked` | 입력 뒤 값을 비우려면 프로퍼티로 다뤄야 한다. | `속성과 이벤트`의 `setProp` |

## Phase 2 설계

### 구조
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

### h: Virtual DOM 생성
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

### FunctionComponent
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

`unmount()`는 요구사항에 없으므로 만들지 않는다.

`onCommit(changes)`는 `mount()`와 `update()`가 성공한 뒤 맨 끝에서 호출한다. `mount()`의 `changes`는 빈 배열이다.
요구사항에는 없고, 관찰 패널이 변경 목록을 받으려고 추가했다. 생략하면 동작이 같다.

### Hook 공통
`hooks.js`의 모듈 변수에 지금 렌더 중인 `FunctionComponent`를 둔다. 렌더 밖에서는 비어 있다.
칸은 `{ kind, ... }` 형태이고 `kind`는 `'state'`, `'effect'`, `'memo'` 중 하나이다.
첫 렌더에서만 칸을 만들고, 이후에는 `hookIndex`로 칸을 찾는다.

Hook 규칙을 어기면 값이 조용히 어긋나서 찾기 어려우므로, 아래 경우에 오류를 던진다.

- 현재 컴포넌트가 없을 때 Hook을 호출했다. 렌더 밖이거나 자식 컴포넌트 안이다. `h`는 자식 컴포넌트를 실행하는 동안 현재 컴포넌트를 비운다.
- 칸의 `kind`와 호출한 Hook이 다르다.
- 첫 렌더가 아닌데 칸이 없거나, 렌더가 끝났을 때 `hookIndex`가 `hooks.length`와 다르다.

### useState와 Batching
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

### useEffect
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

### useMemo
`useMemo(compute, deps)`는 `useEffect`와 같은 deps 비교 함수를 쓴다.
달라졌으면 `compute()`를 실행해 값과 deps를 칸에 저장하고, 같으면 저장한 값을 돌려준다. deps가 없으면 렌더마다 계산한다.
값이 이번 Virtual DOM을 만드는 데 쓰이므로 렌더 중에 실행한다.

### 속성과 이벤트
`setProp(element, name, value)`는 다음 순서로 동작한다.

1. 값이 함수이고 이름이 `on`으로 시작하면 `element[소문자 이름] = value`를 하고 끝낸다.
2. `setAttribute`로 속성을 넣는다.
3. `input`과 `textarea`의 `value`는 프로퍼티와 값이 다를 때 프로퍼티도 맞춘다. `file` 타입은 제외한다.
4. `input`의 `checked`는 프로퍼티를 `true`로 맞춘다.

`removeProp(element, name)`은 `on`으로 시작하는 이름은 프로퍼티를 `null`로, `checked`는 `false`로, `input`과 `textarea`의 `value`는 `''`로 되돌린 뒤 `removeAttribute`를 부른다. `file` 타입의 `value`는 건드리지 않는다.
`removeAttribute`를 마지막에 부르는 이유: `checkbox`, `radio`, `hidden`, 버튼 종류의 `input`은 `value` 대입이 속성에 쓰이므로, 먼저 지우면 지운 속성이 `value=""`로 되살아난다.
`patch`의 `PROPS`는 `removeAttribute` 대신 이 함수를 부른다. `remove`를 먼저 적용하는 순서는 그대로이다.

이벤트에 `addEventListener`를 쓰지 않는 이유: 핸들러는 렌더마다 새 함수이므로 `setProp`이 계속 호출되고, 이전 함수를 기억해서 떼지 않으면 핸들러가 쌓인다. 프로퍼티 대입은 새 함수가 이전 함수를 교체하므로 이전 값이 필요 없다.

`value`와 `checked`에 속성과 프로퍼티를 함께 넣는 이유: 사용자가 입력한 뒤에는 속성을 바꿔도 화면이 바뀌지 않으므로 프로퍼티가 필요하다. 하지만 프로퍼티만 넣으면 `innerHTML`에 값이 나오지 않아 `vdomToHtml`이 깨진다.
`checked`를 값 그대로 대입하지 않는 이유: 파서가 만드는 `checked: ''`를 대입하면 `false`가 된다.
값이 같으면 대입하지 않는 이유: 입력 중인 커서와 한글 조합을 건드리지 않게 하려는 것이다.
`file` 타입을 제외하는 이유: 빈 문자열이 아닌 값을 대입하면 `InvalidStateError`가 난다.

`onChange`는 브라우저의 `change` 이벤트이므로 React와 달리 입력이 끝났을 때 발생한다. 입력마다 받으려면 `onInput`을 쓴다.

Phase 1 영향: `<textarea value="x">내용</textarea>`처럼 `value` 속성이 있는 `textarea`는 이제 `x`가 화면에 나온다. HTML의 `textarea`에는 `value` 속성이 없으므로 드문 입력이고 보정하지 않는다.

### Phase 2 범위 밖
- `key`는 Phase 1과 같이 지원하지 않는다. 항목을 지우면 뒤쪽 항목이 번호로 비교된다.
- `style`은 문자열만 지원한다. 객체를 넣으면 `[object Object]`가 된다.
- HTML 속성 이름을 그대로 쓴다. `className`이 아니라 `class`이다.
- `select`의 `value`는 지원하지 않는다. `createDom`이 속성을 자식보다 먼저 넣으므로 옵션이 없을 때 값이 들어가 적용되지 않는다.
- 상태가 입력을 거부할 때 화면의 값을 되돌리지 않는다. 입력 뒤에도 Virtual DOM이 그대로이면 `diff`가 변경을 찾지 못한다.
- 위치로 비교하므로 조건부 요소가 앞에서 사라지면 뒤쪽 요소가 교체되어 입력 포커스를 잃을 수 있다. 페이지는 입력창의 위치가 바뀌지 않게 만든다.

### 페이지 이동
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

### 테스트 페이지: 정글 생존기
크래프톤 정글 생활을 소재로 한 선택 게임이다. 플레이어는 5일을 버티고 프로젝트 발표까지 간다.

이유: 다른 팀과 겹치지 않고, 정글 사람들이 공감해서 재미있어야 한다는 것이 사용자의 목표이다. 평범하게 읽으며 한 판에 2~3분이 걸려서 발표 때 끝까지 보여 줄 수 있다.
Phase 1처럼 `DESIGN.md`의 시각 언어를 따른다. 페이지 주소는 `/phase2.html`이다.

**화면 단계**는 `start`, `play`, `presentation`, `ending` 순서이다.

- `start`: 이름을 입력하고 시작한다. 공백을 뺀 이름이 비어 있으면 시작 버튼을 막는다. 최고 기록을 보여 준다.
- `play`: 날짜, 시간대, 스탯, 칭호, 남은 시간, 선택지, 사건 기록을 보여 준다.
- `presentation`: 발표 타자 이벤트이다.
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
   - 참석: 멘탈 +20, 다음 날 숙취로 체력 -15
   - 불참: 실력 +5, 멘탈 -5

**엔딩**은 앞의 조건이 먼저이다.

| 엔딩 | 조건 |
|---|---|
| 번아웃 | 체력이나 멘탈이 0 |
| 코치 면담 | 의심도가 100 |
| 그냥 집에 감 | 집 가기를 5번 선택 |
| 발표 대성공 | 발표 점수가 70 이상 |
| 발표 폭망 | 발표 점수가 70 미만 |

**발표 타자 이벤트:** 문장을 완성하는 것이 아니라, 제한 시간 20초 안에 정해진 함수 이름을 하나씩 입력한다.
함수 이름은 `useState`, `useEffect`, `useMemo`, `diff`, `patch`이고 이 순서로 하나씩 보여 준다. 대소문자를 구분한다.
앞에서부터 맞게 친 글자는 강조하고, 틀린 글자는 틀렸다고 표시한다. 함수 이름을 완성하면 입력을 비우고 다음 이름으로 넘어간다.
모두 완성하거나 시간이 끝나면 발표 점수를 낸다. 발표 점수는 실력 + 완성한 함수 이름 수 × 8이다.
입력에 ASCII가 아닌 글자가 있으면 한/영 키를 누르라는 안내를 보여 준다.

이유: 함수 이름은 영어라서 한글 조합 문제가 없고, 이 프로젝트의 개념 복습도 된다. 다만 사용자의 입력기가 한글이면 영어를 칠 수 없어서 안내가 필요하다.

**칭호**는 앞의 조건이 먼저이다. 실력 70 이상은 `코드 장인`, 멘탈 20 이하는 `멘탈 파산`, 의심도 60 이상은 `수배자`, 체력 20 이하는 `좀비`, 그 밖에는 `평범한 정글러`이다.

**최고 기록**은 발표 점수의 최댓값이고 `localStorage`의 `tiny-react-best-score`에 저장한다. 저장소를 쓸 수 없으면 오류 없이 기록만 남지 않는다.

**Hook의 쓰임:** 게임 규칙은 `gameLogic.js`의 순수 함수로 두고, `Game`은 결과를 상태에 넣는다.

| Hook | 쓰임 |
|---|---|
| `useState` | `name`, `game`(턴 진행 전체), `timeLeft`, `typed`, `bestScore` |
| `useEffect` | 1초 타이머와 cleanup, 시간 초과 처리, 입력창 포커스, 최고 기록 읽기와 저장 |
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
