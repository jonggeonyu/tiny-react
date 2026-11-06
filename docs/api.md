## Functions

<dl>
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
