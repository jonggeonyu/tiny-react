## Classes

<dl>
<dt><a href="#StateHistory">StateHistory</a></dt>
<dd><p>Virtual DOM의 기록을 리스트와 현재 위치를 가리키는 포인터로 관리한다.
Virtual DOM은 만든 뒤 수정하지 않는 값이므로 복사하지 않고 받은 객체를 그대로 저장하고 돌려준다.
같은 내용인지는 판단하지 않는다. 변경이 없을 때 저장하지 않는 일은 호출하는 쪽이 맡는다.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#setProp">setProp(element, name, value)</a> ⇒ <code>void</code></dt>
<dd><p>속성 하나를 실제 DOM에 넣는다.
<code>createDom</code>과 <code>patch</code>가 이 함수를 함께 써서 속성을 넣는 경로를 하나로 유지한다.</p>
</dd>
<dt><a href="#createDom">createDom(vnode)</a> ⇒ <code>Text</code> | <code>Element</code></dt>
<dd><p>Virtual DOM을 실제 DOM으로 변환한다.
문자열은 텍스트 노드가 되고, 요소는 <code>props</code>와 <code>children</code>까지 재귀로 만든다.</p>
</dd>
<dt><a href="#renderRoot">renderRoot(container, root)</a> ⇒ <code>void</code></dt>
<dd><p>루트 Virtual DOM으로 영역의 내용을 다시 그린다.
새 노드를 <code>DocumentFragment</code>에 모두 만든 뒤 한 번에 교체한다.
영역 자체의 태그와 속성은 바꾸지 않는다.</p>
</dd>
<dt><a href="#diff">diff(oldVdom, newVdom)</a> ⇒ <code><a href="#Change">Array.&lt;Change&gt;</a></code></dt>
<dd><p>두 Virtual DOM을 비교해 변경 목록을 돌려준다. 실제 DOM과 입력은 건드리지 않는다.
자식은 번호로만 비교하므로 추가와 삭제는 항상 자식 목록의 끝에서 일어나고, 목록을 순서대로 적용하면 앞쪽 번호가 밀리지 않는다.
<code>ADD</code>와 <code>REPLACE</code>의 <code>node</code>는 새 Virtual DOM의 노드를 복사하지 않고 그대로 담는다.
두 인자 중 적어도 하나는 있어야 한다. <code>diff(undefined, undefined)</code>는 지원하지 않는 입력이다.</p>
</dd>
<dt><a href="#domToVdom">domToVdom(node)</a> ⇒ <code><a href="#VNode">VNode</a></code> | <code>null</code></dt>
<dd><p>DOM 노드 하나를 Virtual DOM으로 변환한다.
주석과, 공백만 있으면서 줄바꿈을 포함한 텍스트는 제외 대상이므로 <code>null</code>을 돌려준다.
요소와 텍스트가 아닌 다른 노드(<code>DocumentFragment</code>, doctype, 처리 명령 등)도 <code>null</code>을 돌려준다.</p>
</dd>
<dt><a href="#containerToVdom">containerToVdom(container)</a> ⇒ <code><a href="#VElement">VElement</a></code></dt>
<dd><p>영역의 자식들을 변환해 루트 Virtual DOM을 만든다.
영역 자체의 태그와 속성은 루트 노드에 넣지 않는다.</p>
</dd>
<dt><a href="#vdomToHtml">vdomToHtml(root)</a> ⇒ <code>string</code></dt>
<dd><p>루트 Virtual DOM을 HTML 문자열로 바꾼다.
문서에 붙이지 않은 임시 요소에 그린 뒤 <code>innerHTML</code>을 읽으므로, 이스케이프는 브라우저가 처리한다.
다만 <code>script</code>, <code>style</code>처럼 내용을 그대로 쓰는 요소의 텍스트는 이스케이프되지 않는다.
<code>htmlToVdom</code>과의 왕복은 파서가 만든 Virtual DOM을 기준으로 하며, 손으로 만든 Virtual DOM은 보장하지 않는다.</p>
</dd>
<dt><a href="#htmlToVdom">htmlToVdom(html)</a> ⇒ <code><a href="#VElement">VElement</a></code></dt>
<dd><p>HTML 문자열을 루트 Virtual DOM으로 바꾼다.
<code>&lt;template&gt;</code>에서 파싱하므로 내용이 화면에 그려지거나 실행되지 않고, <code>&lt;tr&gt;</code>로 시작하는 입력도 버려지지 않는다.
다만 최상위 표 요소는 앞뒤 내용에 따라 파서가 버릴 수 있다.
<code>&lt;p&gt;</code> 같은 일반 요소나 <code>&lt;td&gt;</code> 뒤의 <code>&lt;tr&gt;</code>은 태그가 버려지고 내용만 남으며, <code>&lt;col&gt;</code> 뒤의 내용은 통째로 버려진다.
닫지 않은 태그 같은 일반적인 잘못된 입력은 파서가 고쳐서 읽는다.</p>
</dd>
<dt><a href="#patch">patch(container, changes)</a> ⇒ <code>void</code></dt>
<dd><p>변경 목록을 받은 순서대로 실제 DOM에 적용한다.
목록에 없는 노드는 건드리지 않으므로 같은 DOM 객체로 남는다.
<code>changes</code>는 <code>container</code>의 내용을 나타내는 루트 Virtual DOM과 새 루트를 <code>diff</code>로 비교한 결과여야 한다.
<code>path</code>가 맞으려면 <code>container</code>의 <code>childNodes</code>와 이전 Virtual DOM의 <code>children</code>이 번호까지 일치해야 한다.</p>
</dd>
<dt><a href="#formatHtml">formatHtml(root)</a> ⇒ <code>string</code></dt>
<dd><p>루트 Virtual DOM을 줄바꿈과 2칸 들여쓰기를 맞춘 HTML 문자열로 바꾼다.
자식이 모두 요소일 때만 줄을 나눠서, 결과를 <code>htmlToVdom</code>으로 다시 읽으면 같은 Virtual DOM이 된다.
텍스트가 섞인 요소는 안쪽까지 <code>vdomToHtml</code> 결과 그대로 한 줄에 두고, 자식이 없는 요소와 <code>pre</code>, <code>listing</code>도 한 줄이다.
루트도 같은 규칙이므로 루트에 텍스트가 섞이면 결과는 <code>vdomToHtml(root)</code>와 같다.
이스케이프와 직렬화는 <code>vdomToHtml</code>을 그대로 쓰며, 왕복의 범위도 <code>vdomToHtml</code>과 같다.</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#Change">Change</a> : <code>object</code></dt>
<dd><p>변경 목록의 항목 하나이다.
<code>kind</code>에 따라 <code>node</code>, <code>value</code>, <code>set</code>과 <code>remove</code> 중 필요한 것만 가진다.</p>
</dd>
<dt><a href="#VElement">VElement</a> : <code>object</code></dt>
<dd><p>Virtual DOM의 요소 노드이다.</p>
</dd>
<dt><a href="#VNode">VNode</a> : <code>string</code> | <code><a href="#VElement">VElement</a></code></dt>
<dd><p>Virtual DOM의 노드이다. 텍스트는 문자열, 요소는 <code>VElement</code>로 표현한다.</p>
</dd>
</dl>

<a name="StateHistory"></a>

## StateHistory
Virtual DOM의 기록을 리스트와 현재 위치를 가리키는 포인터로 관리한다.
Virtual DOM은 만든 뒤 수정하지 않는 값이므로 복사하지 않고 받은 객체를 그대로 저장하고 돌려준다.
같은 내용인지는 판단하지 않는다. 변경이 없을 때 저장하지 않는 일은 호출하는 쪽이 맡는다.

**Kind**: global class  

* [StateHistory](#StateHistory)
    * [.push(vdom)](#StateHistory+push) ⇒ <code>void</code>
    * [.current()](#StateHistory+current) ⇒ [<code>VNode</code>](#VNode) \| <code>undefined</code>
    * [.back()](#StateHistory+back) ⇒ [<code>VNode</code>](#VNode) \| <code>null</code>
    * [.forward()](#StateHistory+forward) ⇒ [<code>VNode</code>](#VNode) \| <code>null</code>

<a name="StateHistory+push"></a>

### stateHistory.push(vdom) ⇒ <code>void</code>
Virtual DOM을 저장하고 현재 위치로 삼는다.
뒤로 간 상태에서 저장하면 포인터 뒤의 기록은 지워져서 다시 앞으로 갈 수 없다.

**Kind**: instance method of [<code>StateHistory</code>](#StateHistory)  

| Param | Type | Description |
| --- | --- | --- |
| vdom | [<code>VNode</code>](#VNode) | 저장할 Virtual DOM |

<a name="StateHistory+current"></a>

### stateHistory.current() ⇒ [<code>VNode</code>](#VNode) \| <code>undefined</code>
현재 위치의 Virtual DOM을 돌려준다. 포인터는 옮기지 않는다.

**Kind**: instance method of [<code>StateHistory</code>](#StateHistory)  
**Returns**: [<code>VNode</code>](#VNode) \| <code>undefined</code> - 현재 Virtual DOM. 저장한 항목이 없으면 `undefined`이다.  
<a name="StateHistory+back"></a>

### stateHistory.back() ⇒ [<code>VNode</code>](#VNode) \| <code>null</code>
포인터를 이전 항목으로 옮기고 그 값을 돌려준다.

**Kind**: instance method of [<code>StateHistory</code>](#StateHistory)  
**Returns**: [<code>VNode</code>](#VNode) \| <code>null</code> - 이전 Virtual DOM. 이전 항목이 없으면 `null`이고 포인터는 그대로이다.  
<a name="StateHistory+forward"></a>

### stateHistory.forward() ⇒ [<code>VNode</code>](#VNode) \| <code>null</code>
포인터를 다음 항목으로 옮기고 그 값을 돌려준다.

**Kind**: instance method of [<code>StateHistory</code>](#StateHistory)  
**Returns**: [<code>VNode</code>](#VNode) \| <code>null</code> - 다음 Virtual DOM. 다음 항목이 없으면 `null`이고 포인터는 그대로이다.  
<a name="setProp"></a>

## setProp(element, name, value) ⇒ <code>void</code>
속성 하나를 실제 DOM에 넣는다.
`createDom`과 `patch`가 이 함수를 함께 써서 속성을 넣는 경로를 하나로 유지한다.

**Kind**: global function  
**Throws**:

- <code>DOMException</code> 넣을 수 없는 속성 이름이면 `InvalidCharacterError`를 던진다.


| Param | Type | Description |
| --- | --- | --- |
| element | <code>Element</code> | 속성을 넣을 요소 |
| name | <code>string</code> | 속성 이름 |
| value | <code>string</code> | 속성 값 |

<a name="createDom"></a>

## createDom(vnode) ⇒ <code>Text</code> \| <code>Element</code>
Virtual DOM을 실제 DOM으로 변환한다.
문자열은 텍스트 노드가 되고, 요소는 `props`와 `children`까지 재귀로 만든다.

**Kind**: global function  
**Returns**: <code>Text</code> \| <code>Element</code> - 새로 만든 DOM 노드  
**Throws**:

- <code>Error</code> 노드를 만들지 못하면 오류를 던진다. 만들 수 없는 태그 이름이나 속성 이름은 `InvalidCharacterError`이고, 중첩이 너무 깊으면 `RangeError`이다.


| Param | Type | Description |
| --- | --- | --- |
| vnode | [<code>VNode</code>](#VNode) | 변환할 노드 |

<a name="renderRoot"></a>

## renderRoot(container, root) ⇒ <code>void</code>
루트 Virtual DOM으로 영역의 내용을 다시 그린다.
새 노드를 `DocumentFragment`에 모두 만든 뒤 한 번에 교체한다.
영역 자체의 태그와 속성은 바꾸지 않는다.

**Kind**: global function  
**Throws**:

- <code>Error</code> 노드를 만들지 못하면 오류를 던진다. 어떤 오류가 나도 교체 전에 멈추므로 기존 내용이 그대로 남는다.


| Param | Type | Description |
| --- | --- | --- |
| container | <code>Element</code> | 다시 그릴 영역 |
| root | [<code>VElement</code>](#VElement) | `type`이 `'root'`인 루트 노드 |

<a name="diff"></a>

## diff(oldVdom, newVdom) ⇒ [<code>Array.&lt;Change&gt;</code>](#Change)
두 Virtual DOM을 비교해 변경 목록을 돌려준다. 실제 DOM과 입력은 건드리지 않는다.
자식은 번호로만 비교하므로 추가와 삭제는 항상 자식 목록의 끝에서 일어나고, 목록을 순서대로 적용하면 앞쪽 번호가 밀리지 않는다.
`ADD`와 `REPLACE`의 `node`는 새 Virtual DOM의 노드를 복사하지 않고 그대로 담는다.
두 인자 중 적어도 하나는 있어야 한다. `diff(undefined, undefined)`는 지원하지 않는 입력이다.

**Kind**: global function  
**Returns**: [<code>Array.&lt;Change&gt;</code>](#Change) - 변경 목록. 바뀐 내용이 없으면 빈 배열이다.  
**Throws**:

- <code>RangeError</code> 재귀로 비교하므로 아주 깊게 중첩되면 오류가 날 수 있다.


| Param | Type | Description |
| --- | --- | --- |
| oldVdom | [<code>VNode</code>](#VNode) \| <code>undefined</code> | 이전 Virtual DOM. `undefined`이면 없는 노드이고, 이때 `newVdom`은 있어야 한다. |
| newVdom | [<code>VNode</code>](#VNode) \| <code>undefined</code> | 새 Virtual DOM. `undefined`이면 없는 노드이고, 이때 `oldVdom`은 있어야 한다. |

<a name="domToVdom"></a>

## domToVdom(node) ⇒ [<code>VNode</code>](#VNode) \| <code>null</code>
DOM 노드 하나를 Virtual DOM으로 변환한다.
주석과, 공백만 있으면서 줄바꿈을 포함한 텍스트는 제외 대상이므로 `null`을 돌려준다.
요소와 텍스트가 아닌 다른 노드(`DocumentFragment`, doctype, 처리 명령 등)도 `null`을 돌려준다.

**Kind**: global function  
**Returns**: [<code>VNode</code>](#VNode) \| <code>null</code> - 변환한 노드. 제외 대상이면 `null`이다.  

| Param | Type | Description |
| --- | --- | --- |
| node | <code>Node</code> | 변환할 DOM 노드 |

<a name="containerToVdom"></a>

## containerToVdom(container) ⇒ [<code>VElement</code>](#VElement)
영역의 자식들을 변환해 루트 Virtual DOM을 만든다.
영역 자체의 태그와 속성은 루트 노드에 넣지 않는다.

**Kind**: global function  
**Returns**: [<code>VElement</code>](#VElement) - `type`이 `'root'`인 루트 노드  

| Param | Type | Description |
| --- | --- | --- |
| container | <code>Element</code> \| <code>DocumentFragment</code> | 변환할 영역 |

<a name="vdomToHtml"></a>

## vdomToHtml(root) ⇒ <code>string</code>
루트 Virtual DOM을 HTML 문자열로 바꾼다.
문서에 붙이지 않은 임시 요소에 그린 뒤 `innerHTML`을 읽으므로, 이스케이프는 브라우저가 처리한다.
다만 `script`, `style`처럼 내용을 그대로 쓰는 요소의 텍스트는 이스케이프되지 않는다.
`htmlToVdom`과의 왕복은 파서가 만든 Virtual DOM을 기준으로 하며, 손으로 만든 Virtual DOM은 보장하지 않는다.

**Kind**: global function  
**Returns**: <code>string</code> - 루트의 자식들을 직렬화한 HTML 문자열. 루트 자체의 태그는 들어가지 않는다.  
**Throws**:

- <code>Error</code> 노드를 만들지 못하면 `renderRoot`의 오류를 그대로 던진다.


| Param | Type | Description |
| --- | --- | --- |
| root | [<code>VElement</code>](#VElement) | `type`이 `'root'`인 루트 노드 |

<a name="htmlToVdom"></a>

## htmlToVdom(html) ⇒ [<code>VElement</code>](#VElement)
HTML 문자열을 루트 Virtual DOM으로 바꾼다.
`<template>`에서 파싱하므로 내용이 화면에 그려지거나 실행되지 않고, `<tr>`로 시작하는 입력도 버려지지 않는다.
다만 최상위 표 요소는 앞뒤 내용에 따라 파서가 버릴 수 있다.
`<p>` 같은 일반 요소나 `<td>` 뒤의 `<tr>`은 태그가 버려지고 내용만 남으며, `<col>` 뒤의 내용은 통째로 버려진다.
닫지 않은 태그 같은 일반적인 잘못된 입력은 파서가 고쳐서 읽는다.

**Kind**: global function  
**Returns**: [<code>VElement</code>](#VElement) - `type`이 `'root'`인 루트 노드  
**Throws**:

- <code>RangeError</code> 중첩이 너무 깊으면 오류를 던진다. jsdom에서는 2만 단계에서 확인했다.


| Param | Type | Description |
| --- | --- | --- |
| html | <code>string</code> | 변환할 HTML 문자열 |

<a name="patch"></a>

## patch(container, changes) ⇒ <code>void</code>
변경 목록을 받은 순서대로 실제 DOM에 적용한다.
목록에 없는 노드는 건드리지 않으므로 같은 DOM 객체로 남는다.
`changes`는 `container`의 내용을 나타내는 루트 Virtual DOM과 새 루트를 `diff`로 비교한 결과여야 한다.
`path`가 맞으려면 `container`의 `childNodes`와 이전 Virtual DOM의 `children`이 번호까지 일치해야 한다.

**Kind**: global function  
**Throws**:

- <code>Error</code> 노드나 속성을 만들지 못하면 `createDom`과 `setProp`의 오류를 그대로 던진다. 이미 적용한 변경은 되돌리지 않으므로, 호출하는 쪽에서 `renderRoot`로 이전 Virtual DOM을 다시 그려야 한다.


| Param | Type | Description |
| --- | --- | --- |
| container | <code>Element</code> | 변경을 적용할 영역 |
| changes | [<code>Array.&lt;Change&gt;</code>](#Change) | `diff`가 돌려준 변경 목록 |

<a name="formatHtml"></a>

## formatHtml(root) ⇒ <code>string</code>
루트 Virtual DOM을 줄바꿈과 2칸 들여쓰기를 맞춘 HTML 문자열로 바꾼다.
자식이 모두 요소일 때만 줄을 나눠서, 결과를 `htmlToVdom`으로 다시 읽으면 같은 Virtual DOM이 된다.
텍스트가 섞인 요소는 안쪽까지 `vdomToHtml` 결과 그대로 한 줄에 두고, 자식이 없는 요소와 `pre`, `listing`도 한 줄이다.
루트도 같은 규칙이므로 루트에 텍스트가 섞이면 결과는 `vdomToHtml(root)`와 같다.
이스케이프와 직렬화는 `vdomToHtml`을 그대로 쓰며, 왕복의 범위도 `vdomToHtml`과 같다.

**Kind**: global function  
**Returns**: <code>string</code> - 정렬한 HTML 문자열. 루트 자체의 태그는 들어가지 않는다.  
**Throws**:

- <code>Error</code> 노드를 만들지 못하면 `vdomToHtml`의 오류를 그대로 던진다.


| Param | Type | Description |
| --- | --- | --- |
| root | [<code>VElement</code>](#VElement) | `type`이 `'root'`인 루트 노드 |

<a name="Change"></a>

## Change : <code>object</code>
변경 목록의 항목 하나이다.
`kind`에 따라 `node`, `value`, `set`과 `remove` 중 필요한 것만 가진다.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| kind | <code>&#x27;ADD&#x27;</code> \| <code>&#x27;REMOVE&#x27;</code> \| <code>&#x27;TEXT&#x27;</code> \| <code>&#x27;REPLACE&#x27;</code> \| <code>&#x27;PROPS&#x27;</code> | 변경 종류 |
| path | <code>Array.&lt;number&gt;</code> | 루트에서 `childNodes` 번호를 따라가는 경로 |
| [node] | [<code>VNode</code>](#VNode) | `ADD`와 `REPLACE`에서 새로 넣을 노드 |
| [value] | <code>string</code> | `TEXT`의 새 내용 |
| [set] | <code>Object.&lt;string, string&gt;</code> | `PROPS`에서 새로 생기거나 값이 바뀐 속성 |
| [remove] | <code>Array.&lt;string&gt;</code> | `PROPS`에서 사라진 속성의 이름 |

<a name="VElement"></a>

## VElement : <code>object</code>
Virtual DOM의 요소 노드이다.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | 소문자 태그 이름 |
| props | <code>Object.&lt;string, string&gt;</code> | 속성 이름과 값. 속성이 없으면 `{}`이다. |
| children | [<code>Array.&lt;VNode&gt;</code>](#VNode) | 자식 노드 목록. 항상 배열이다. |

<a name="VNode"></a>

## VNode : <code>string</code> \| [<code>VElement</code>](#VElement)
Virtual DOM의 노드이다. 텍스트는 문자열, 요소는 `VElement`로 표현한다.

**Kind**: global typedef  
