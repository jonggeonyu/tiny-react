# 설계

이 문서는 Phase 1의 설계이다. 과제 요구사항은 `docs/requirements.md`에 있다.

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
│   └── patch.js
└── phase1/                Phase 1 페이지 전용 코드
    ├── StateHistory.js
    ├── main.js            페이지 로드와 버튼 핸들러
    └── style.css
tests/                     src/의 파일별 단위 테스트
```

## 개발 환경
외부 프레임워크 없이 Vanilla JavaScript로 구현하고, 아래 도구는 개발할 때만 사용한다.

- Vite는 ES 모듈을 쓰는 페이지를 띄우는 개발 서버이다.
- Vitest는 단위 테스트를 실행하고, jsdom은 테스트에서 브라우저 DOM을 대신한다.
- jsdoc-to-markdown은 JSDoc 주석으로 `docs/api.md`를 만든다.

`npm test`는 `tests/**/*.test.js`를 jsdom 환경에서 실행한다.
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
`<template>` 안의 내용은 화면에 그려지지 않고 실행되지도 않으므로, 입력 중인 HTML을 안전하게 파싱할 수 있다.

## diff: 두 Virtual DOM 비교
`diff(oldVdom, newVdom)`는 변경 목록을 돌려주고, 실제 DOM은 건드리지 않는다.
노드마다 다음 순서로 판단한다.

1. 이전 노드가 없으면 노드 추가이다.
2. 새 노드가 없으면 노드 삭제이다.
3. 둘 다 텍스트이면 내용을 비교하고, 다르면 텍스트 변경이다.
4. 텍스트와 요소처럼 노드 종류가 다르거나 `type`이 다르면 노드 교체이고, 자식은 비교하지 않는다.
5. `type`이 같으면 속성을 비교하고, 값이 바뀌거나 새로 생기거나 사라진 속성을 속성 변경으로 기록한다.
6. 속성 변경 여부와 상관없이 자식을 재귀로 비교한다.

자식을 비교할 때는 이전과 새 `children` 중 더 긴 길이만큼 반복하며 같은 번호끼리 `diff`를 호출한다.
그러면 한쪽에 자식이 없을 때 자연스럽게 노드 추가나 노드 삭제가 된다.

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
- `PROPS`는 `remove`를 `removeAttribute`로 먼저 적용하고, `set`을 `setProp`으로 적용한다. HTML 속성 이름은 대소문자를 구분하지 않으므로, 순서가 반대이면 `{ a: '1' }`이 `{ A: '1' }`로 바뀔 때 넣은 속성이 곧바로 지워진다.

`path`가 맞으려면 실제 DOM의 `childNodes`와 Virtual DOM의 `children`이 번호까지 일치해야 한다.

## StateHistory
- Virtual DOM을 저장하는 리스트와 현재 위치를 가리키는 포인터로 구현한다.
- 페이지 로드 때 만든 첫 Virtual DOM도 저장해서 첫 상태로 돌아올 수 있게 한다.
- 새로 저장할 때는 포인터 뒤의 기록을 지운 다음 추가하고, 포인터를 마지막 항목으로 옮긴다.
- 이동할 이전이나 다음 항목이 없으면 실패로 처리하고 화면을 바꾸지 않는다.
- `push(vdom)`는 저장하고, `current()`는 현재 값을 돌려준다.
- `back()`과 `forward()`는 포인터를 옮기고 그 위치의 값을 돌려주며, 이동할 수 없으면 `null`을 돌려준다.

## 페이지 동작

### 페이지 로드
1. 실제 영역을 `containerToVdom`으로 변환한다.
2. 이 Virtual DOM을 `renderRoot`로 실제 영역에 다시 그린다. 샘플 HTML의 들여쓰기 공백과 주석이 사라져서 `path`가 맞게 된다.
3. 이 Virtual DOM으로 테스트 영역을 렌더링한다.
4. 이 Virtual DOM을 State History에 저장한다.

테스트 영역을 렌더링하는 일은 `textarea`에 `vdomToHtml` 결과를 넣고, 미리보기를 `renderRoot`로 그리는 일이다.

### Patch 버튼
1. `textarea`의 내용을 `htmlToVdom`으로 변환한다.
2. 이 Virtual DOM을 `renderRoot`로 미리보기에 그린다.
3. State History의 현재 Virtual DOM과 `diff`로 비교한다.
4. 변경 목록이 비어 있으면 History에 저장하지 않고 끝낸다.
5. 변경 목록을 `patch`로 실제 영역에 적용한다.
6. 새 Virtual DOM을 State History에 저장한다.

`patch`가 도중에 실패하면 현재 Virtual DOM을 `renderRoot`로 실제 영역에 다시 그려서, 실제 영역과 State History가 어긋나지 않게 한다.

### 뒤로가기와 앞으로가기
1. `current()`로 현재 Virtual DOM을 보관한다.
2. `back()`이나 `forward()`로 목표 Virtual DOM을 얻는다. `null`이면 끝낸다.
3. 보관한 Virtual DOM과 목표 Virtual DOM을 `diff`로 비교하고, 결과를 `patch`로 실제 영역에 적용한다.
4. 목표 Virtual DOM으로 테스트 영역을 다시 렌더링한다.

## 범위 밖
- 입력 HTML은 사용자가 직접 쓰는 샘플이므로 보안 필터링을 하지 않는다.
- `key`를 쓰는 목록 비교는 요구사항에 없으므로 구현하지 않는다.
- SVG처럼 네임스페이스가 필요한 요소는 지원하지 않는다.
- `input`의 `value`처럼 속성이 아닌 프로퍼티는 비교하지 않는다.
- `textarea`에 다시 넣는 HTML은 줄바꿈과 들여쓰기를 정렬하지 않는다.
- HTML 문자열로 왕복할 때 파서가 내용을 바꾸는 입력은 고치지 않아도 변경으로 잡힐 수 있다. 파싱을 브라우저에 맡기는 설계의 한계이므로 보정하지 않는다.
  - `<pre>`, `<textarea>`, `<listing>`의 첫 줄바꿈은 지워진다.
  - `&#13;`은 ``이지만 다시 읽으면 `
`이 된다.
  - `<plaintext>`는 왕복할 때마다 닫는 태그가 내용에 붙는다.
  - `<form>`이나 `<a>`처럼 파서가 고쳐 주는 잘못된 중첩은 다시 읽을 때 또 달라질 수 있다.
  - `<noscript>`는 브라우저에서 문서 파서와 `<template>` 파서의 해석이 다르다. 샘플 HTML에 쓰지 않는다.
- `<template>` 요소는 내용이 `childNodes`가 아닌 `content`에 있으므로, 안의 내용은 Virtual DOM에 들어가지 않는다.
- 공백 규칙은 태그와 상관없이 적용한다. `<pre>`와 `<textarea>`처럼 공백이 의미를 갖는 요소에서도 줄바꿈이 포함된 공백만 있는 텍스트는 지워진다.
- 주석 사이의 줄바꿈도 지운 뒤 텍스트를 합치므로, `a<!--x-->
<!--y-->b`는 `ab`가 된다.
- `form` 안 컨트롤의 `name`이나 `id`가 DOM 프로퍼티 이름과 같으면 `form`의 프로퍼티가 가려진다(DOM clobbering). `<form><input name="nodeType"></form>`은 `form`이 통째로 사라지고, `name="tagName"`은 `TypeError`가 난다. `<img name="createElement">`처럼 `document`의 메서드가 가려지는 경우도 같아서, 페이지를 새로 고칠 때까지 요소를 만들 수 없다. 막으려면 모든 DOM 접근을 프로토타입을 거치게 바꿔야 하고, `form`의 경우는 jsdom으로 테스트할 수도 없다. 드문 입력을 위해 코드가 복잡해지므로 범위 밖으로 둔다.

## 확정한 결정

### 테스트 영역
테스트 영역은 HTML 코드를 고치는 `textarea`와 미리보기로 만든다.
미리보기는 입력할 때마다 갱신하지 않고, Patch 버튼을 누를 때 갱신한다.

이 결정에 따라 페이지 동작에 두 가지 변환이 필요하다.

- 테스트 영역을 렌더링할 때는 `vdomToHtml`로 Virtual DOM을 HTML 문자열로 바꿔 `textarea`에 넣고, 미리보기도 같은 내용으로 그린다.
- 테스트 영역을 Virtual DOM으로 변환할 때는 `htmlToVdom`으로 `textarea`의 HTML 문자열을 변환한다.

### setProp
속성을 넣는 코드를 `createDom.js`의 `setProp(element, name, value)` 한 곳에 둔다.
`createDom`과 `patch`가 이 함수를 함께 쓴다.

이유: 속성을 넣는 경로가 둘로 갈라지면 처음 그린 화면과 Patch한 화면이 다르게 동작할 수 있다.
Phase 2의 `onClick`도 이 함수만 확장하면 된다.

### domToVdom의 반환값
제외 대상 노드는 `null`을 돌려주고, 호출하는 쪽에서 걸러 낸다.

이유: 노드 하나를 변환하는 일과 자식 목록을 정리하는 일을 나눠서, 텍스트 합치기를 자식 목록을 만드는 쪽 한 곳에서 처리한다.

### 요소 사이 공백
공백만 있는 텍스트 중 줄바꿈이 포함된 것만 지우고, 같은 줄의 공백은 유지한다.

이유: `<b>a</b> <i>b</i>`의 공백을 지우면 화면에 `a b`가 `ab`로 나온다.
샘플 HTML의 들여쓰기는 줄바꿈을 포함하므로 그대로 지워진다.
대신 요소를 줄을 바꿔 쓰면 브라우저와 달리 공백 없이 붙어서 나온다.
