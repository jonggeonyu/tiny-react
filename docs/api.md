## Classes

<dl>
<dt><a href="#FunctionComponent">FunctionComponent</a></dt>
<dd><p>함수형 루트 컴포넌트를 감싸 Hook 칸과 화면을 관리한다.
렌더 순서는 컴포넌트 실행, 새 Virtual DOM 생성, <code>diff</code>, <code>patch</code>, effect 실행이다.</p>
</dd>
<dt><a href="#StateHistory">StateHistory</a></dt>
<dd><p>Virtual DOM의 기록을 리스트와 현재 위치를 가리키는 포인터로 관리한다.
Virtual DOM은 만든 뒤 수정하지 않는 값이므로 복사하지 않고 받은 객체를 그대로 저장하고 돌려준다.
같은 내용인지는 판단하지 않는다. 변경이 없을 때 저장하지 않는 일은 호출하는 쪽이 맡는다.</p>
</dd>
</dl>

## Constants

<dl>
<dt><a href="#logEntries">logEntries</a></dt>
<dd><p>History와 번호를 맞춘 Patch 설명 목록이다. 첫 항목은 초기 상태이다.</p>
</dd>
<dt><a href="#INITIAL_STATS">INITIAL_STATS</a></dt>
<dd><p>시작 스탯.</p>
</dd>
<dt><a href="#CHOICES">CHOICES</a></dt>
<dd><p>선택지 표. 효과는 체력, 실력, 멘탈, 의심도 순서의 변화량이다.</p>
</dd>
<dt><a href="#PATROL_THRESHOLD">PATROL_THRESHOLD</a></dt>
<dd><p>코치 순찰이 시작되는 의심도.</p>
</dd>
<dt><a href="#PATROL_EFFECT">PATROL_EFFECT</a></dt>
<dd><p>순찰에 걸렸을 때의 변화량.</p>
</dd>
<dt><a href="#DINNER_CHANCE">DINNER_CHANCE</a></dt>
<dd><p>회식이 열릴 확률.</p>
</dd>
<dt><a href="#TOTAL_CHOICES">TOTAL_CHOICES</a></dt>
<dd><p>선택 횟수와 규칙 상수.</p>
</dd>
<dt><a href="#TARGETS">TARGETS</a></dt>
<dd><p>발표 타자 이벤트의 함수 이름.</p>
</dd>
<dt><a href="#ENDINGS">ENDINGS</a></dt>
<dd><p>엔딩 이름과 문구.</p>
</dd>
<dt><a href="#TITLES">TITLES</a></dt>
<dd><p>칭호 목록. 앞의 조건이 먼저이다.</p>
</dd>
<dt><a href="#PERIODS">PERIODS</a></dt>
<dd><p>시간대 이름. <code>turn % 3</code>으로 고른다.</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#setProp">setProp(element, name, value)</a> ⇒ <code>void</code></dt>
<dd><p>속성 하나를 실제 DOM에 넣는다.
<code>createDom</code>과 <code>patch</code>가 이 함수를 함께 써서 속성을 넣는 경로를 하나로 유지한다.
<code>on</code>으로 시작하는 이름의 함수는 이벤트 핸들러 프로퍼티에 대입하므로 이전 핸들러를 교체하고 속성에 나타나지 않는다.
<code>input</code>과 <code>textarea</code>의 <code>value</code>, <code>input</code>의 <code>checked</code>는 속성과 프로퍼티를 함께 맞춘다.</p>
</dd>
<dt><a href="#removeProp">removeProp(element, name)</a> ⇒ <code>void</code></dt>
<dd><p>속성 하나를 실제 DOM에서 지운다.
이벤트 핸들러와 <code>checked</code>, <code>value</code> 프로퍼티는 속성을 지워도 남으므로 함께 되돌린다.</p>
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
<dt><a href="#describeChanges">describeChanges(changes)</a> ⇒ <code>string</code></dt>
<dd><p>변경 목록을 한 줄 문자열로 바꾼다. 4개가 넘으면 앞의 3개 뒤에 <code>외 N개</code>를 붙인다.</p>
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
<dt><a href="#normalizeChildren">normalizeChildren(children)</a> ⇒ <code><a href="#VNode">Array.&lt;VNode&gt;</a></code></dt>
<dd><p>자식 목록을 Virtual DOM 자식 배열로 정리한다.
문자열과 요소는 그대로 두고, 숫자는 문자열로 바꾸며, <code>null</code>, <code>undefined</code>, <code>true</code>, <code>false</code>는 버린다.
배열은 재귀로 펼치고, 나란한 문자열은 합치지 않는다.</p>
</dd>
<dt><a href="#normalizeProps">normalizeProps()</a></dt>
<dd><p>속성 값을 정규화한다. 버릴 값은 객체에 넣지 않는다.</p>
</dd>
<dt><a href="#h">h(type, props, ...children)</a> ⇒ <code><a href="#VNode">VNode</a></code> | <code>*</code></dt>
<dd><p>Virtual DOM 노드를 만든다. JSX 대신 쓴다.
<code>type</code>이 함수이면 <code>type({ ...props, children })</code>을 바로 호출해 결과를 돌려준다.
이때 <code>props</code>는 정규화하지 않고 <code>children</code>만 정규화한다.
자식 컴포넌트를 실행하는 동안에는 Hook을 쓸 수 없다.</p>
</dd>
<dt><a href="#withCurrentComponent">withCurrentComponent(component, run)</a> ⇒ <code>*</code></dt>
<dd><p><code>run</code>을 실행하는 동안 현재 컴포넌트를 정한다.
끝나면 성공과 실패에 상관없이 이전 값으로 되돌린다. 렌더 밖에서 부르면 이전 값은 <code>null</code>이다.</p>
</dd>
<dt><a href="#withoutHooks">withoutHooks(run)</a> ⇒ <code>*</code></dt>
<dd><p><code>run</code>을 실행하는 동안 현재 컴포넌트를 비워 Hook을 쓰지 못하게 한다.
<code>h</code>가 자식 컴포넌트를 실행할 때 쓴다. 끝나면 루트 컴포넌트가 다시 현재 컴포넌트가 된다.</p>
</dd>
<dt><a href="#useState">useState(initial)</a> ⇒ <code>Array</code></dt>
<dd><p>렌더 사이에 유지되는 상태를 만든다. 루트 컴포넌트의 렌더 중에만 호출할 수 있다.
<code>setState(next)</code>는 <code>next</code>가 함수이면 <code>next(이전 값)</code>으로 새 값을 구한다.
값이 <code>Object.is</code>로 같고 직전 <code>update()</code>가 성공했으면 아무것도 하지 않고, 아니면 칸의 값을 바로 바꾼 뒤 <code>update()</code>를 예약한다.
화면은 <code>setState</code> 직후가 아니라 마이크로태스크에서 바뀐다.
함수 초기값을 호출하는 지연 초기값은 지원하지 않는다.</p>
</dd>
<dt><a href="#useEffect">useEffect(effect, [deps])</a> ⇒ <code>void</code></dt>
<dd><p>화면을 반영한 뒤에 실행할 일을 등록한다. 루트 컴포넌트의 렌더 중에만 호출할 수 있다.
렌더 중에는 deps만 비교하고, 달라졌으면 실행 목록에 넣는다.
deps가 없으면 렌더마다, <code>[]</code>이면 첫 렌더에만, 값이 있으면 값이 바뀐 렌더에 실행한다.
<code>effect</code>가 함수를 돌려주면 cleanup으로 저장해 다음 실행 전에 호출한다.
<code>unmount()</code>가 없으므로 마지막 cleanup은 실행되지 않는다.</p>
</dd>
<dt><a href="#useMemo">useMemo(compute, [deps])</a> ⇒ <code>*</code></dt>
<dd><p>계산한 값을 렌더 사이에 저장한다. 루트 컴포넌트의 렌더 중에만 호출할 수 있다.
deps가 같으면 <code>compute</code>를 실행하지 않고 저장한 값을 돌려준다. deps가 없으면 렌더마다 계산한다.
값이 이번 Virtual DOM에 쓰이므로 렌더 중에 계산한다.</p>
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
<dt><a href="#StartScreen">StartScreen(props)</a> ⇒ <code>Object</code></dt>
<dd><p>시작 화면. 이름이 공백뿐이면 시작 버튼을 막는다.</p>
</dd>
<dt><a href="#StatBar">StatBar(props)</a> ⇒ <code>Object</code></dt>
<dd><p>스탯과 칭호 표시줄.</p>
</dd>
<dt><a href="#ChoiceButton">ChoiceButton(props)</a> ⇒ <code>Object</code></dt>
<dd><p>선택지 버튼 하나.</p>
</dd>
<dt><a href="#EventLog">EventLog(props)</a> ⇒ <code>Object</code></dt>
<dd><p>사건 기록 목록. 최신 기록이 아래에 온다.</p>
</dd>
<dt><a href="#PlayScreen">PlayScreen(props)</a> ⇒ <code>Object</code></dt>
<dd><p>선택 화면. 회식 중이면 참석과 불참을 보여 준다.</p>
</dd>
<dt><a href="#PresentationScreen">PresentationScreen(props)</a> ⇒ <code>Object</code></dt>
<dd><p>발표 타자 화면. 입력창은 글자 영역의 형제이고, 안내는 입력창 뒤에 두어서 입력창 위치가 바뀌지 않는다.</p>
</dd>
<dt><a href="#EndingScreen">EndingScreen(props)</a> ⇒ <code>Object</code></dt>
<dd><p>엔딩 화면.</p>
</dd>
<dt><a href="#readBestScore">readBestScore()</a></dt>
<dd><p>최고 기록을 읽는다. 저장소를 쓸 수 없으면 0이다.</p>
</dd>
<dt><a href="#writeBestScore">writeBestScore()</a></dt>
<dd><p>최고 기록을 저장한다. 저장소를 쓸 수 없으면 무시한다.</p>
</dd>
<dt><a href="#Game">Game()</a> ⇒ <code>Object</code></dt>
<dd><p>정글 생존기의 루트 컴포넌트. Hook을 쓰는 유일한 컴포넌트이고, 자식은 Props만 받는다.
난수는 핸들러와 시간 초과 처리에서만 <code>Math.random</code>으로 만든다.</p>
</dd>
<dt><a href="#applyEffect">applyEffect(stats, effect)</a> ⇒ <code>Object</code></dt>
<dd><p>스탯에 변화량을 더하고 0~100으로 제한한 새 객체를 돌려준다.</p>
</dd>
<dt><a href="#checkEnding">checkEnding(game)</a> ⇒ <code>Object</code></dt>
<dd><p>사건 판정 뒤의 엔딩을 확인한다. 앞의 조건이 먼저이다.</p>
</dd>
<dt><a href="#advance">advance(game)</a> ⇒ <code>Object</code></dt>
<dd><p>엔딩이 아니면 다음 단계(발표)로 넘긴다.</p>
</dd>
<dt><a href="#createGame">createGame()</a> ⇒ <code>Object</code></dt>
<dd><p>처음 상태의 게임을 만든다. <code>다시 하기</code>에도 쓴다.</p>
</dd>
<dt><a href="#startGame">startGame(game)</a> ⇒ <code>Object</code></dt>
<dd><p>게임을 시작한다.</p>
</dd>
<dt><a href="#playTurn">playTurn(game, choiceId, random)</a> ⇒ <code>Object</code></dt>
<dd><p>선택 하나를 적용하고 순찰, 회식, 엔딩 순서로 판정한다.
<code>random</code>은 0 이상 1 미만의 수를 돌려주는 함수이다.</p>
</dd>
<dt><a href="#answerDinner">answerDinner(game, attends)</a> ⇒ <code>Object</code></dt>
<dd><p>회식에 답한다. 효과를 적용하고 엔딩과 발표 진입을 다시 확인한다.</p>
</dd>
<dt><a href="#finishPresentation">finishPresentation(game)</a> ⇒ <code>Object</code></dt>
<dd><p>발표 점수(실력 + 완성 수 x 8)를 내고 엔딩으로 보낸다.</p>
</dd>
<dt><a href="#completeTarget">completeTarget(game)</a> ⇒ <code>Object</code></dt>
<dd><p>함수 이름 하나를 완성한 것으로 센다. 모두 완성하면 발표를 끝낸다.</p>
</dd>
<dt><a href="#timeoutTurn">timeoutTurn(game, turn, random)</a> ⇒ <code>Object</code></dt>
<dd><p>시간 초과를 처리한다. 예약할 때의 턴 번호가 지금과 다르면 아무것도 하지 않는다.
회식 중이면 불참, 발표 중이면 발표 종료, 선택 중이면 멍때리기이다.</p>
</dd>
<dt><a href="#judgeTyping">judgeTyping(target, typed)</a> ⇒ <code>Array.&lt;{char: string, status: (&#x27;correct&#x27;|&#x27;wrong&#x27;|&#x27;pending&#x27;)}&gt;</code></dt>
<dd><p>입력을 함수 이름과 위치별로 비교한다. 대소문자를 구분하고, 입력이 더 길어도 target 길이까지만 낸다.</p>
</dd>
<dt><a href="#getTitle">getTitle(stats)</a> ⇒ <code>string</code></dt>
<dd><p>스탯으로 칭호를 고른다. 앞의 조건이 먼저이다.</p>
</dd>
<dt><a href="#describeHook">describeHook(hook, index)</a> ⇒ <code>string</code></dt>
<dd><p><code>hooks</code> 칸 하나를 한 줄로 설명한다. 예: <code>0 useState: &quot;송&quot;</code>, <code>3 useEffect: deps [1]</code>.</p>
</dd>
<dt><a href="#visibleChanges">visibleChanges(changes)</a> ⇒ <code><a href="#Change">Array.&lt;Change&gt;</a></code></dt>
<dd><p>패널에 보여 줄 변경만 남긴다. <code>PROPS</code>의 <code>set</code>에서 함수 값과 <code>remove</code>에서 <code>on</code>으로 시작하는 이름을 빼고,
남는 내용이 없는 <code>PROPS</code>는 뺀다. 입력은 바꾸지 않는다.</p>
</dd>
<dt><a href="#createInspector">createInspector(container)</a> ⇒ <code>Object</code></dt>
<dd><p>게임 옆의 관찰 패널을 만들어 바로 마운트한다. 패널은 Hook 없는 <code>FunctionComponent</code>이고 게임을 다시 렌더하지 않는다.
렌더 횟수, <code>hooks</code> 칸, 최근 변경 8줄(최신이 위)을 보여 준다.</p>
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

<a name="FunctionComponent"></a>

## FunctionComponent
함수형 루트 컴포넌트를 감싸 Hook 칸과 화면을 관리한다.
렌더 순서는 컴포넌트 실행, 새 Virtual DOM 생성, `diff`, `patch`, effect 실행이다.

**Kind**: global class  

* [FunctionComponent](#FunctionComponent)
    * [new FunctionComponent(component, container, [options])](#new_FunctionComponent_new)
    * [.mount()](#FunctionComponent+mount) ⇒ <code>void</code>
    * [.update()](#FunctionComponent+update) ⇒ <code>void</code>
    * [.scheduleUpdate()](#FunctionComponent+scheduleUpdate) ⇒ <code>void</code>

<a name="new_FunctionComponent_new"></a>

### new FunctionComponent(component, container, [options])

| Param | Type | Description |
| --- | --- | --- |
| component | <code>function</code> | 루트 컴포넌트 함수. `{}`를 받아 화면 내용을 돌려준다. |
| container | <code>Element</code> | 화면을 그릴 영역. 영역의 내용만 바뀌고 영역 자체는 그대로이다. |
| [options] | <code>object</code> | 선택 값 |
| [options.onCommit] | <code>function</code> | `mount()`와 `update()`가 effect까지 성공한 뒤 변경 목록을 받아 호출하는 함수. `mount()`는 빈 배열을 넘긴다. 렌더나 effect가 실패하면 호출하지 않는다. |

<a name="FunctionComponent+mount"></a>

### functionComponent.mount() ⇒ <code>void</code>
처음 렌더해서 영역의 내용을 그린 뒤 effect를 실행한다.
렌더나 그리기가 실패하면 마운트되지 않은 상태로 남고 영역의 내용은 그대로이다.
effect가 실패하면 오류를 던지지만 마운트는 끝난 상태이다.
성공하면 effect 뒤에 `onCommit([])`을 호출한다. effect가 실패하면 호출하지 않는다.

**Kind**: instance method of [<code>FunctionComponent</code>](#FunctionComponent)  
**Throws**:

- <code>Error</code> 렌더 중에 호출했거나, 이미 마운트했거나, 렌더, 그리기, effect가 실패하면 던진다.

<a name="FunctionComponent+update"></a>

### functionComponent.update() ⇒ <code>void</code>
다시 렌더해서 바뀐 부분만 화면에 반영한 뒤 effect를 실행한다.
변경 목록이 비어 있어도 effect는 실행한다.
렌더가 실패하면 화면과 `vdom`은 그대로이다.
`patch`가 실패하면 이전 `vdom`으로 영역을 다시 그리고, `vdom`은 갱신하지 않는다.
렌더나 `patch`가 실패하면 effect를 실행하지 않고 `isStale`이 `true`가 되고, 성공하면 `false`가 된다.
effect의 실패는 렌더 실패가 아니므로 오류만 던지고 `isStale`은 바꾸지 않는다.
성공하면 effect 뒤에 `onCommit(changes)`를 호출한다. effect가 실패하면 호출하지 않는다.

**Kind**: instance method of [<code>FunctionComponent</code>](#FunctionComponent)  
**Throws**:

- <code>Error</code> 렌더 중에 호출했거나, 마운트 전이거나, 렌더, `patch`, effect가 실패하면 던진다.

<a name="FunctionComponent+scheduleUpdate"></a>

### functionComponent.scheduleUpdate() ⇒ <code>void</code>
`update()`를 마이크로태스크로 예약한다. 이미 예약되어 있으면 아무것도 하지 않는다.
한 핸들러의 여러 `setState`가 렌더 한 번으로 묶인다.
`update()`의 오류는 마이크로태스크에서 던져지므로 호출한 쪽으로 돌아오지 않는다.
effect를 실행하는 동안 예약한 횟수를 세고, effect 밖에서 예약하면 횟수를 0으로 되돌린다.

**Kind**: instance method of [<code>FunctionComponent</code>](#FunctionComponent)  
**Throws**:

- <code>Error</code> effect에서 연속으로 예약한 횟수가 50번을 넘으면 던진다. 마이크로태스크가 끝나지 않아 탭이 멈추는 것을 막는다.

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
    * [.position()](#StateHistory+position) ⇒ <code>number</code>
    * [.size()](#StateHistory+size) ⇒ <code>number</code>

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
<a name="StateHistory+position"></a>

### stateHistory.position() ⇒ <code>number</code>
현재 위치를 1부터 센 번호로 돌려준다.

**Kind**: instance method of [<code>StateHistory</code>](#StateHistory)  
**Returns**: <code>number</code> - 현재 번호. 저장한 항목이 없으면 `0`이다.  
<a name="StateHistory+size"></a>

### stateHistory.size() ⇒ <code>number</code>
저장된 항목의 개수를 돌려준다.

**Kind**: instance method of [<code>StateHistory</code>](#StateHistory)  
**Returns**: <code>number</code> - 항목 개수  
<a name="logEntries"></a>

## logEntries
History와 번호를 맞춘 Patch 설명 목록이다. 첫 항목은 초기 상태이다.

**Kind**: global constant  
<a name="INITIAL_STATS"></a>

## INITIAL\_STATS
시작 스탯.

**Kind**: global constant  
<a name="CHOICES"></a>

## CHOICES
선택지 표. 효과는 체력, 실력, 멘탈, 의심도 순서의 변화량이다.

**Kind**: global constant  
<a name="PATROL_THRESHOLD"></a>

## PATROL\_THRESHOLD
코치 순찰이 시작되는 의심도.

**Kind**: global constant  
<a name="PATROL_EFFECT"></a>

## PATROL\_EFFECT
순찰에 걸렸을 때의 변화량.

**Kind**: global constant  
<a name="DINNER_CHANCE"></a>

## DINNER\_CHANCE
회식이 열릴 확률.

**Kind**: global constant  
<a name="TOTAL_CHOICES"></a>

## TOTAL\_CHOICES
선택 횟수와 규칙 상수.

**Kind**: global constant  
<a name="TARGETS"></a>

## TARGETS
발표 타자 이벤트의 함수 이름.

**Kind**: global constant  
<a name="ENDINGS"></a>

## ENDINGS
엔딩 이름과 문구.

**Kind**: global constant  
<a name="TITLES"></a>

## TITLES
칭호 목록. 앞의 조건이 먼저이다.

**Kind**: global constant  
<a name="PERIODS"></a>

## PERIODS
시간대 이름. `turn % 3`으로 고른다.

**Kind**: global constant  
<a name="setProp"></a>

## setProp(element, name, value) ⇒ <code>void</code>
속성 하나를 실제 DOM에 넣는다.
`createDom`과 `patch`가 이 함수를 함께 써서 속성을 넣는 경로를 하나로 유지한다.
`on`으로 시작하는 이름의 함수는 이벤트 핸들러 프로퍼티에 대입하므로 이전 핸들러를 교체하고 속성에 나타나지 않는다.
`input`과 `textarea`의 `value`, `input`의 `checked`는 속성과 프로퍼티를 함께 맞춘다.

**Kind**: global function  
**Throws**:

- <code>DOMException</code> 넣을 수 없는 속성 이름이면 `InvalidCharacterError`를 던진다.


| Param | Type | Description |
| --- | --- | --- |
| element | <code>Element</code> | 속성을 넣을 요소 |
| name | <code>string</code> | 속성 이름 |
| value | <code>string</code> \| <code>function</code> | 속성 값이거나 이벤트 핸들러 |

<a name="removeProp"></a>

## removeProp(element, name) ⇒ <code>void</code>
속성 하나를 실제 DOM에서 지운다.
이벤트 핸들러와 `checked`, `value` 프로퍼티는 속성을 지워도 남으므로 함께 되돌린다.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| element | <code>Element</code> | 속성을 지울 요소 |
| name | <code>string</code> | 속성 이름 |

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

<a name="describeChanges"></a>

## describeChanges(changes) ⇒ <code>string</code>
변경 목록을 한 줄 문자열로 바꾼다. 4개가 넘으면 앞의 3개 뒤에 `외 N개`를 붙인다.

**Kind**: global function  
**Returns**: <code>string</code> - 쉼표로 이은 설명  

| Param | Type | Description |
| --- | --- | --- |
| changes | [<code>Array.&lt;Change&gt;</code>](#Change) | `diff`가 돌려준 변경 목록 |

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

<a name="normalizeChildren"></a>

## normalizeChildren(children) ⇒ [<code>Array.&lt;VNode&gt;</code>](#VNode)
자식 목록을 Virtual DOM 자식 배열로 정리한다.
문자열과 요소는 그대로 두고, 숫자는 문자열로 바꾸며, `null`, `undefined`, `true`, `false`는 버린다.
배열은 재귀로 펼치고, 나란한 문자열은 합치지 않는다.

**Kind**: global function  
**Returns**: [<code>Array.&lt;VNode&gt;</code>](#VNode) - 문자열과 요소만 담긴 배열  
**Throws**:

- <code>TypeError</code> 자식에 일반 객체나 함수가 있으면 던진다.


| Param | Type | Description |
| --- | --- | --- |
| children | <code>Array.&lt;\*&gt;</code> | 정리할 자식 목록 |

<a name="normalizeProps"></a>

## normalizeProps()
속성 값을 정규화한다. 버릴 값은 객체에 넣지 않는다.

**Kind**: global function  
<a name="h"></a>

## h(type, props, ...children) ⇒ [<code>VNode</code>](#VNode) \| <code>\*</code>
Virtual DOM 노드를 만든다. JSX 대신 쓴다.
`type`이 함수이면 `type({ ...props, children })`을 바로 호출해 결과를 돌려준다.
이때 `props`는 정규화하지 않고 `children`만 정규화한다.
자식 컴포넌트를 실행하는 동안에는 Hook을 쓸 수 없다.

**Kind**: global function  
**Returns**: [<code>VNode</code>](#VNode) \| <code>\*</code> - 문자열 `type`이면 `{ type, props, children }`, 함수 `type`이면 그 함수의 반환값  
**Throws**:

- <code>TypeError</code> 자식에 일반 객체나 함수가 있으면 던진다.


| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> \| <code>function</code> | 태그 이름 또는 자식 컴포넌트 함수 |
| props | <code>Object</code> | 속성. `null`이나 `undefined`이면 `{}`로 본다. |
| ...children | <code>\*</code> | 자식들 |

<a name="withCurrentComponent"></a>

## withCurrentComponent(component, run) ⇒ <code>\*</code>
`run`을 실행하는 동안 현재 컴포넌트를 정한다.
끝나면 성공과 실패에 상관없이 이전 값으로 되돌린다. 렌더 밖에서 부르면 이전 값은 `null`이다.

**Kind**: global function  
**Returns**: <code>\*</code> - `run`의 반환값  

| Param | Type | Description |
| --- | --- | --- |
| component | [<code>FunctionComponent</code>](#FunctionComponent) | 현재 컴포넌트로 정할 인스턴스 |
| run | <code>function</code> | 실행할 함수 |

<a name="withoutHooks"></a>

## withoutHooks(run) ⇒ <code>\*</code>
`run`을 실행하는 동안 현재 컴포넌트를 비워 Hook을 쓰지 못하게 한다.
`h`가 자식 컴포넌트를 실행할 때 쓴다. 끝나면 루트 컴포넌트가 다시 현재 컴포넌트가 된다.

**Kind**: global function  
**Returns**: <code>\*</code> - `run`의 반환값  

| Param | Type | Description |
| --- | --- | --- |
| run | <code>function</code> | 실행할 함수 |

<a name="useState"></a>

## useState(initial) ⇒ <code>Array</code>
렌더 사이에 유지되는 상태를 만든다. 루트 컴포넌트의 렌더 중에만 호출할 수 있다.
`setState(next)`는 `next`가 함수이면 `next(이전 값)`으로 새 값을 구한다.
값이 `Object.is`로 같고 직전 `update()`가 성공했으면 아무것도 하지 않고, 아니면 칸의 값을 바로 바꾼 뒤 `update()`를 예약한다.
화면은 `setState` 직후가 아니라 마이크로태스크에서 바뀐다.
함수 초기값을 호출하는 지연 초기값은 지원하지 않는다.

**Kind**: global function  
**Returns**: <code>Array</code> - `[값, setState]`. `setState`는 렌더마다 같은 함수이다.  
**Throws**:

- <code>Error</code> 렌더 밖이나 자식 컴포넌트에서 호출했거나, Hook 개수나 종류가 첫 렌더와 다르면 던진다. `setState`는 렌더 중에 호출하거나, effect에서 연속으로 예약한 횟수가 50번을 넘으면 던진다.


| Param | Type | Description |
| --- | --- | --- |
| initial | <code>\*</code> | 첫 렌더에서 쓸 초기값 |

<a name="useEffect"></a>

## useEffect(effect, [deps]) ⇒ <code>void</code>
화면을 반영한 뒤에 실행할 일을 등록한다. 루트 컴포넌트의 렌더 중에만 호출할 수 있다.
렌더 중에는 deps만 비교하고, 달라졌으면 실행 목록에 넣는다.
deps가 없으면 렌더마다, `[]`이면 첫 렌더에만, 값이 있으면 값이 바뀐 렌더에 실행한다.
`effect`가 함수를 돌려주면 cleanup으로 저장해 다음 실행 전에 호출한다.
`unmount()`가 없으므로 마지막 cleanup은 실행되지 않는다.

**Kind**: global function  
**Throws**:

- <code>Error</code> 렌더 밖이나 자식 컴포넌트에서 호출했거나, Hook 개수나 종류가 첫 렌더와 다르면 던진다.


| Param | Type | Description |
| --- | --- | --- |
| effect | <code>function</code> | 화면 반영 뒤에 실행할 함수 |
| [deps] | <code>Array</code> | 비교할 값의 배열 |

<a name="useMemo"></a>

## useMemo(compute, [deps]) ⇒ <code>\*</code>
계산한 값을 렌더 사이에 저장한다. 루트 컴포넌트의 렌더 중에만 호출할 수 있다.
deps가 같으면 `compute`를 실행하지 않고 저장한 값을 돌려준다. deps가 없으면 렌더마다 계산한다.
값이 이번 Virtual DOM에 쓰이므로 렌더 중에 계산한다.

**Kind**: global function  
**Returns**: <code>\*</code> - 계산했거나 저장해 둔 값  
**Throws**:

- <code>Error</code> 렌더 밖이나 자식 컴포넌트에서 호출했거나, Hook 개수나 종류가 첫 렌더와 다르면 던진다.


| Param | Type | Description |
| --- | --- | --- |
| compute | <code>function</code> | 값을 계산하는 함수 |
| [deps] | <code>Array</code> | 비교할 값의 배열 |

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

<a name="StartScreen"></a>

## StartScreen(props) ⇒ <code>Object</code>
시작 화면. 이름이 공백뿐이면 시작 버튼을 막는다.

**Kind**: global function  
**Returns**: <code>Object</code> - Virtual DOM  

| Param | Type |
| --- | --- |
| props | <code>Object</code> | 

<a name="StatBar"></a>

## StatBar(props) ⇒ <code>Object</code>
스탯과 칭호 표시줄.

**Kind**: global function  
**Returns**: <code>Object</code> - Virtual DOM  

| Param | Type |
| --- | --- |
| props | <code>Object</code> | 

<a name="ChoiceButton"></a>

## ChoiceButton(props) ⇒ <code>Object</code>
선택지 버튼 하나.

**Kind**: global function  
**Returns**: <code>Object</code> - Virtual DOM  

| Param | Type |
| --- | --- |
| props | <code>Object</code> | 

<a name="EventLog"></a>

## EventLog(props) ⇒ <code>Object</code>
사건 기록 목록. 최신 기록이 아래에 온다.

**Kind**: global function  
**Returns**: <code>Object</code> - Virtual DOM  

| Param | Type |
| --- | --- |
| props | <code>Object</code> | 

<a name="PlayScreen"></a>

## PlayScreen(props) ⇒ <code>Object</code>
선택 화면. 회식 중이면 참석과 불참을 보여 준다.

**Kind**: global function  
**Returns**: <code>Object</code> - Virtual DOM  

| Param | Type |
| --- | --- |
| props | <code>Object</code> | 

<a name="PresentationScreen"></a>

## PresentationScreen(props) ⇒ <code>Object</code>
발표 타자 화면. 입력창은 글자 영역의 형제이고, 안내는 입력창 뒤에 두어서 입력창 위치가 바뀌지 않는다.

**Kind**: global function  
**Returns**: <code>Object</code> - Virtual DOM  

| Param | Type |
| --- | --- |
| props | <code>Object</code> | 

<a name="EndingScreen"></a>

## EndingScreen(props) ⇒ <code>Object</code>
엔딩 화면.

**Kind**: global function  
**Returns**: <code>Object</code> - Virtual DOM  

| Param | Type |
| --- | --- |
| props | <code>Object</code> | 

<a name="readBestScore"></a>

## readBestScore()
최고 기록을 읽는다. 저장소를 쓸 수 없으면 0이다.

**Kind**: global function  
<a name="writeBestScore"></a>

## writeBestScore()
최고 기록을 저장한다. 저장소를 쓸 수 없으면 무시한다.

**Kind**: global function  
<a name="Game"></a>

## Game() ⇒ <code>Object</code>
정글 생존기의 루트 컴포넌트. Hook을 쓰는 유일한 컴포넌트이고, 자식은 Props만 받는다.
난수는 핸들러와 시간 초과 처리에서만 `Math.random`으로 만든다.

**Kind**: global function  
**Returns**: <code>Object</code> - Virtual DOM  
<a name="applyEffect"></a>

## applyEffect(stats, effect) ⇒ <code>Object</code>
스탯에 변화량을 더하고 0~100으로 제한한 새 객체를 돌려준다.

**Kind**: global function  

| Param | Type |
| --- | --- |
| stats | <code>Object</code> | 
| effect | <code>Object</code> | 

<a name="checkEnding"></a>

## checkEnding(game) ⇒ <code>Object</code>
사건 판정 뒤의 엔딩을 확인한다. 앞의 조건이 먼저이다.

**Kind**: global function  
**Returns**: <code>Object</code> - 엔딩이면 phase가 'ending'인 새 게임, 아니면 입력 그대로  

| Param | Type |
| --- | --- |
| game | <code>Object</code> | 

<a name="advance"></a>

## advance(game) ⇒ <code>Object</code>
엔딩이 아니면 다음 단계(발표)로 넘긴다.

**Kind**: global function  

| Param | Type |
| --- | --- |
| game | <code>Object</code> | 

<a name="createGame"></a>

## createGame() ⇒ <code>Object</code>
처음 상태의 게임을 만든다. `다시 하기`에도 쓴다.

**Kind**: global function  
**Returns**: <code>Object</code> - phase가 'start'인 게임  
<a name="startGame"></a>

## startGame(game) ⇒ <code>Object</code>
게임을 시작한다.

**Kind**: global function  
**Returns**: <code>Object</code> - phase가 'play'인 새 게임  

| Param | Type |
| --- | --- |
| game | <code>Object</code> | 

<a name="playTurn"></a>

## playTurn(game, choiceId, random) ⇒ <code>Object</code>
선택 하나를 적용하고 순찰, 회식, 엔딩 순서로 판정한다.`random`은 0 이상 1 미만의 수를 돌려주는 함수이다.

**Kind**: global function  
**Returns**: <code>Object</code> - 새 게임. play가 아니거나 회식 중이면 입력 그대로이다.  

| Param | Type | Description |
| --- | --- | --- |
| game | <code>Object</code> |  |
| choiceId | <code>string</code> | coding, smoke, sneak, home, idle 중 하나 |
| random | <code>function</code> |  |

<a name="answerDinner"></a>

## answerDinner(game, attends) ⇒ <code>Object</code>
회식에 답한다. 효과를 적용하고 엔딩과 발표 진입을 다시 확인한다.

**Kind**: global function  
**Returns**: <code>Object</code> - 새 게임. 회식 중이 아니면 입력 그대로이다.  

| Param | Type | Description |
| --- | --- | --- |
| game | <code>Object</code> |  |
| attends | <code>boolean</code> | 참석하면 true |

<a name="finishPresentation"></a>

## finishPresentation(game) ⇒ <code>Object</code>
발표 점수(실력 + 완성 수 x 8)를 내고 엔딩으로 보낸다.

**Kind**: global function  
**Returns**: <code>Object</code> - phase가 'ending'인 새 게임  

| Param | Type |
| --- | --- |
| game | <code>Object</code> | 

<a name="completeTarget"></a>

## completeTarget(game) ⇒ <code>Object</code>
함수 이름 하나를 완성한 것으로 센다. 모두 완성하면 발표를 끝낸다.

**Kind**: global function  

| Param | Type |
| --- | --- |
| game | <code>Object</code> | 

<a name="timeoutTurn"></a>

## timeoutTurn(game, turn, random) ⇒ <code>Object</code>
시간 초과를 처리한다. 예약할 때의 턴 번호가 지금과 다르면 아무것도 하지 않는다.회식 중이면 불참, 발표 중이면 발표 종료, 선택 중이면 멍때리기이다.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| game | <code>Object</code> |  |
| turn | <code>number</code> | 예약할 때의 턴 번호 |
| random | <code>function</code> |  |

<a name="judgeTyping"></a>

## judgeTyping(target, typed) ⇒ <code>Array.&lt;{char: string, status: (&#x27;correct&#x27;\|&#x27;wrong&#x27;\|&#x27;pending&#x27;)}&gt;</code>
입력을 함수 이름과 위치별로 비교한다. 대소문자를 구분하고, 입력이 더 길어도 target 길이까지만 낸다.

**Kind**: global function  

| Param | Type |
| --- | --- |
| target | <code>string</code> | 
| typed | <code>string</code> | 

<a name="getTitle"></a>

## getTitle(stats) ⇒ <code>string</code>
스탯으로 칭호를 고른다. 앞의 조건이 먼저이다.

**Kind**: global function  

| Param | Type |
| --- | --- |
| stats | <code>Object</code> | 

<a name="describeHook"></a>

## describeHook(hook, index) ⇒ <code>string</code>
`hooks` 칸 하나를 한 줄로 설명한다. 예: `0 useState: "송"`, `3 useEffect: deps [1]`.

**Kind**: global function  
**Returns**: <code>string</code> - 설명  

| Param | Type | Description |
| --- | --- | --- |
| hook | <code>Object</code> | 칸 |
| index | <code>number</code> | `hooks` 배열에서의 위치 |

<a name="visibleChanges"></a>

## visibleChanges(changes) ⇒ [<code>Array.&lt;Change&gt;</code>](#Change)
패널에 보여 줄 변경만 남긴다. `PROPS`의 `set`에서 함수 값과 `remove`에서 `on`으로 시작하는 이름을 빼고,
남는 내용이 없는 `PROPS`는 뺀다. 입력은 바꾸지 않는다.

**Kind**: global function  
**Returns**: [<code>Array.&lt;Change&gt;</code>](#Change) - 보여 줄 변경 목록  

| Param | Type | Description |
| --- | --- | --- |
| changes | [<code>Array.&lt;Change&gt;</code>](#Change) | `diff`가 돌려준 변경 목록 |

<a name="createInspector"></a>

## createInspector(container) ⇒ <code>Object</code>
게임 옆의 관찰 패널을 만들어 바로 마운트한다. 패널은 Hook 없는 `FunctionComponent`이고 게임을 다시 렌더하지 않는다.
렌더 횟수, `hooks` 칸, 최근 변경 8줄(최신이 위)을 보여 준다.

**Kind**: global function  
**Returns**: <code>Object</code> - `record(changes, hooks)`로 게임의 한 번의 렌더를 기록한다.  

| Param | Type | Description |
| --- | --- | --- |
| container | <code>Element</code> | 패널을 그릴 영역 |

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
| [set] | <code>Object.&lt;string, (string\|function())&gt;</code> | `PROPS`에서 새로 생기거나 값이 바뀐 속성. 함수는 이벤트 핸들러이다. |
| [remove] | <code>Array.&lt;string&gt;</code> | `PROPS`에서 사라진 속성의 이름 |

<a name="VElement"></a>

## VElement : <code>object</code>
Virtual DOM의 요소 노드이다.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | 소문자 태그 이름 |
| props | <code>Object.&lt;string, (string\|function())&gt;</code> | 속성 이름과 값. 함수는 이벤트 핸들러이다. 속성이 없으면 `{}`이다. |
| children | [<code>Array.&lt;VNode&gt;</code>](#VNode) | 자식 노드 목록. 항상 배열이다. |

<a name="VNode"></a>

## VNode : <code>string</code> \| [<code>VElement</code>](#VElement)
Virtual DOM의 노드이다. 텍스트는 문자열, 요소는 `VElement`로 표현한다.

**Kind**: global typedef  
