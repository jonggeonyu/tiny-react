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
<dt><a href="#domToVdom">domToVdom(node)</a> ⇒ <code><a href="#VNode">VNode</a></code> | <code>null</code></dt>
<dd><p>DOM 노드 하나를 Virtual DOM으로 변환한다.
주석과, 공백만 있으면서 줄바꿈을 포함한 텍스트는 제외 대상이므로 <code>null</code>을 돌려준다.
요소와 텍스트가 아닌 다른 노드(<code>DocumentFragment</code>, doctype, 처리 명령 등)도 <code>null</code>을 돌려준다.</p>
</dd>
<dt><a href="#containerToVdom">containerToVdom(container)</a> ⇒ <code><a href="#VElement">VElement</a></code></dt>
<dd><p>영역의 자식들을 변환해 루트 Virtual DOM을 만든다.
영역 자체의 태그와 속성은 루트 노드에 넣지 않는다.</p>
</dd>
</dl>

## Typedefs

<dl>
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
