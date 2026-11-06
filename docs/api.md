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
