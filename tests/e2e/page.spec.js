import { test, expect } from '@playwright/test';

const INITIAL_HTML =
  '<h3 class="title">장보기 목록</h3>' +
  '<p>오늘 살 것을 <strong>적어</strong> 두었다.</p>' +
  '<ul id="list"><li>사과</li><li class="done">우유</li><li>빵</li></ul>' +
  '<a href="https://example.com" title="예시 링크">링크</a>';
const SECOND_HTML = INITIAL_HTML.replace('<li>빵</li>', '<li>케이크</li>');
const THIRD_HTML = SECOND_HTML.replace('장보기 목록', '살 것');
const INVALID_HTML = '<div =a="1"></div>';
const INITIAL_SOURCE = [
  '<h3 class="title">장보기 목록</h3>',
  '<p>오늘 살 것을 <strong>적어</strong> 두었다.</p>',
  '<ul id="list">',
  '  <li>사과</li>',
  '  <li class="done">우유</li>',
  '  <li>빵</li>',
  '</ul>',
  '<a href="https://example.com" title="예시 링크">링크</a>',
].join('\n');
const SECOND_SOURCE = INITIAL_SOURCE.replace('<li>빵</li>', '<li>케이크</li>');
const THIRD_SOURCE = SECOND_SOURCE.replace('장보기 목록', '살 것');
const UNSAVED_HTML = '<p>저장하지 않은 입력</p>';

/**
 * 화면에서 확인할 내용을 한 번에 읽는다.
 *
 * @param {import('@playwright/test').Page} page 읽을 페이지
 * @returns {Promise<{actual: string, source: string, preview: string, error: string}>} 각 영역의 내용
 */
function readScreen(page) {
  return page.evaluate(() => ({
    actual: document.querySelector('#actual').innerHTML,
    source: document.querySelector('#source').value,
    preview: document.querySelector('#preview').innerHTML,
    error: document.querySelector('#error').textContent,
  }));
}

/**
 * `textarea`의 내용을 바꾸고 Patch 버튼을 누른다.
 *
 * @param {import('@playwright/test').Page} page 조작할 페이지
 * @param {string} html `textarea`에 넣을 HTML
 * @returns {Promise<void>}
 */
async function patchWith(page, html) {
  await page.locator('#source').fill(html);
  await page.locator('#patch').click();
}

/**
 * 세 영역이 모두 같은 내용이고 오류가 없는 화면을 만든다.
 * `textarea`는 Patch 뒤에는 입력한 그대로이고, 로드와 이동 뒤에는 정렬되어 있어서 내용을 따로 받는다.
 *
 * @param {string} html 실제 영역과 미리보기의 내용
 * @param {string} [source] `textarea`의 내용. 생략하면 `html`과 같다.
 * @returns {{actual: string, source: string, preview: string, error: string}} 기대하는 화면
 */
function syncedScreen(html, source = html) {
  return { actual: html, source, preview: html, error: '' };
}

/**
 * History의 첫 항목에 있는지 확인한다.
 * 뒤로 갈 곳이 없으면 고치던 입력이 남고, 뒤로 갈 곳이 있으면 입력이 덮어써지는 차이를 이용한다.
 *
 * @param {import('@playwright/test').Page} page 조작할 페이지
 * @returns {Promise<void>}
 */
async function expectNothingToGoBack(page) {
  await page.locator('#source').fill(UNSAVED_HTML);
  await page.locator('#back').click();
  await expect(page.locator('#source')).toHaveValue(UNSAVED_HTML);
}

test.describe('페이지 동작', () => {
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/');
  });

  test.afterEach(() => {
    expect(pageErrors).toEqual([]);
  });

  test('페이지에 필요한 요소가 있다', async ({ page }) => {
    for (const id of ['actual', 'source', 'preview', 'patch', 'back', 'forward', 'error']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.locator('#error')).toHaveAttribute('role', 'alert');
  });

  test('다크 모드 환경에서도 html 배경은 불투명한 흰색이다', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    const background = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    expect(background).toBe('rgb(255, 255, 255)');
  });

  for (const width of [1280, 375]) {
    test(`긴 <pre>를 Patch해도 ${width}px에서 문서 폭이 뷰포트를 넘지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await patchWith(page, `<pre>${'x'.repeat(600)}</pre>`);
      await expect(page.locator('#actual pre')).toHaveCount(1);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(width);
    });
  }

  test('375px에서 패널이 세로로 쌓인다', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const [first, second] = await page.locator('.panel').evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().toJSON()),
    );
    expect(second.top).toBeGreaterThanOrEqual(first.bottom);
    expect(Math.abs(second.left - first.left)).toBeLessThan(1);
  });

  test('#source는 줄을 접지 않고 가로로 스크롤되며 패널 안에 머문다', async ({ page }) => {
    await expect(page.locator('#source')).toHaveAttribute('wrap', 'off');
    await page.locator('#source').fill(`<p>${'x'.repeat(600)}</p>`);
    const sizes = await page.locator('#source').evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      inPanel: el.getBoundingClientRect().right <= el.closest('.panel').getBoundingClientRect().right,
    }));
    expect(sizes.scrollWidth).toBeGreaterThan(sizes.clientWidth);
    expect(sizes.inPanel).toBe(true);
  });

  test('로드하면 실제 영역이 정리되고 테스트 영역이 같은 내용이 된다', async ({ page }) => {
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));
  });

  test('수정 후 Patch하면 바뀐 부분만 실제 영역에 반영된다', async ({ page }) => {
    await page.evaluate(() => {
      const actual = document.querySelector('#actual');
      window.kept = [
        actual.querySelector('h3'),
        actual.querySelector('p'),
        actual.querySelector('ul'),
        actual.querySelector('li'),
        actual.querySelector('li:last-child'),
      ];
    });

    await patchWith(page, SECOND_HTML);

    expect(await readScreen(page)).toEqual(syncedScreen(SECOND_HTML));
    const sameNodes = await page.evaluate(() => {
      const actual = document.querySelector('#actual');
      const nodes = [
        actual.querySelector('h3'),
        actual.querySelector('p'),
        actual.querySelector('ul'),
        actual.querySelector('li'),
        actual.querySelector('li:last-child'),
      ];
      return nodes.map((node, index) => node === window.kept[index]);
    });
    expect(sameNodes).toEqual([true, true, true, true, true]);
  });

  test('고치지 않고 Patch하면 History가 늘지 않는다', async ({ page }) => {
    await patchWith(page, SECOND_HTML);
    await page.locator('#patch').click();
    expect(await readScreen(page)).toEqual(syncedScreen(SECOND_HTML));

    await page.locator('#back').click();

    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));
  });

  test('뒤로가기와 앞으로가기는 세 영역을 함께 바꾸고 양 끝에서는 화면을 바꾸지 않는다', async ({ page }) => {
    const back = page.locator('#back');
    const forward = page.locator('#forward');
    await patchWith(page, SECOND_HTML);
    await patchWith(page, THIRD_HTML);

    await back.click();
    expect(await readScreen(page)).toEqual(syncedScreen(SECOND_HTML, SECOND_SOURCE));
    await back.click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));
    await back.click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));

    await forward.click();
    expect(await readScreen(page)).toEqual(syncedScreen(SECOND_HTML, SECOND_SOURCE));
    await forward.click();
    expect(await readScreen(page)).toEqual(syncedScreen(THIRD_HTML, THIRD_SOURCE));
    await forward.click();
    expect(await readScreen(page)).toEqual(syncedScreen(THIRD_HTML, THIRD_SOURCE));
  });

  test('양 끝에서 누른 이동 버튼은 고치던 입력을 지우지 않는다', async ({ page }) => {
    await page.locator('#source').fill(UNSAVED_HTML);

    await page.locator('#back').click();
    await page.locator('#forward').click();

    expect(await readScreen(page)).toEqual({
      ...syncedScreen(INITIAL_HTML),
      source: UNSAVED_HTML,
    });
  });

  test('뒤로가기와 앞으로가기는 바뀌지 않은 노드를 같은 DOM 객체로 둔다', async ({ page }) => {
    await patchWith(page, SECOND_HTML);
    await page.evaluate(() => {
      window.keptList = document.querySelector('#actual ul');
    });

    await page.locator('#back').click();
    await page.locator('#forward').click();

    const isSameNode = await page.evaluate(
      () => document.querySelector('#actual ul') === window.keptList,
    );
    expect(isSameNode).toBe(true);
  });

  test('뒤로 간 뒤 새로 Patch하면 앞 기록이 지워진다', async ({ page }) => {
    await patchWith(page, SECOND_HTML);
    await page.locator('#back').click();
    await patchWith(page, THIRD_HTML);

    await page.locator('#forward').click();
    expect(await readScreen(page)).toEqual(syncedScreen(THIRD_HTML));

    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));
  });

  test('입력을 비우고 Patch하면 실제 영역이 비고 뒤로가기로 복원된다', async ({ page }) => {
    await patchWith(page, '');
    expect(await readScreen(page)).toEqual(syncedScreen(''));

    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));
  });

  test('잘못된 입력은 오류를 보여 주고 화면과 History를 바꾸지 않는다', async ({ page }) => {
    await patchWith(page, SECOND_HTML);
    await page.evaluate(() => {
      window.keptList = document.querySelector('#actual ul');
    });

    await patchWith(page, INVALID_HTML);

    const screen = await readScreen(page);
    expect(screen.error).not.toBe('');
    expect(screen.error).not.toContain('\n');
    expect(screen).toEqual({ ...syncedScreen(SECOND_HTML), source: INVALID_HTML, error: screen.error });
    // 다시 그려서 내용만 같아진 것이 아니라, 실제 영역에 닿지 않았음을 확인한다.
    const isUntouched = await page.evaluate(
      () => document.querySelector('#actual ul') === window.keptList,
    );
    expect(isUntouched).toBe(true);

    await patchWith(page, THIRD_HTML);
    expect(await readScreen(page)).toEqual(syncedScreen(THIRD_HTML));

    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(syncedScreen(SECOND_HTML, SECOND_SOURCE));
  });

  test('변경이 없어서 끝난 Patch도 오류 표시를 비운다', async ({ page }) => {
    await patchWith(page, INVALID_HTML);
    expect((await readScreen(page)).error).not.toBe('');

    await patchWith(page, INITIAL_HTML);

    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML));
  });

  test('이동에 성공하면 오류 표시를 비우고 이동하지 못하면 남겨 둔다', async ({ page }) => {
    await patchWith(page, INVALID_HTML);
    await page.locator('#back').click();
    await page.locator('#forward').click();
    expect((await readScreen(page)).error).not.toBe('');

    await patchWith(page, SECOND_HTML);
    await patchWith(page, INVALID_HTML);
    await page.locator('#back').click();

    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));
  });

  test('patch가 실패하면 실제 영역이 직전 상태로 남고 오류를 보여 준다', async ({ page }) => {
    // clobbering은 범위 밖 동작이고, 여기서는 복구 경로를 실행하려고 일부러 쓴다.
    const before = '<form class="a"><input name="setAttribute"></form>';
    const failing = '<form class="b"><input name="setAttribute"></form>';
    await patchWith(page, before);
    expect(await readScreen(page)).toEqual(syncedScreen(before));

    await patchWith(page, failing);

    const screen = await readScreen(page);
    expect(screen.error).not.toBe('');
    expect(screen).toEqual({ ...syncedScreen(before), source: failing, error: screen.error });

    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));
  });

  test('patch가 일부만 적용하고 실패해도 실제 영역을 직전 상태로 되돌린다', async ({ page }) => {
    // clobbering은 범위 밖 동작이고, 여기서는 복구 경로를 실행하려고 일부러 쓴다.
    const before = '<p>이전</p><form class="a"><input name="setAttribute"></form>';
    const failing = '<p>이후</p><form class="b"><input name="setAttribute"></form>';
    await patchWith(page, before);

    await patchWith(page, failing);

    const screen = await readScreen(page);
    expect(screen.error).not.toBe('');
    expect(screen).toEqual({ ...syncedScreen(before), source: failing, error: screen.error });

    await patchWith(page, '<p>복구</p>');
    expect(await readScreen(page)).toEqual(syncedScreen('<p>복구</p>'));
  });

  test('뒤로가기에서 patch가 실패해도 세 영역이 목표 상태가 된다', async ({ page }) => {
    // clobbering은 범위 밖 동작이고, 여기서는 복구 경로를 실행하려고 일부러 쓴다.
    const target = '<p>이전</p><form class="a"><input></form>';
    const clobbered = '<p>이후</p><form class="b"><input name="setAttribute"></form>';
    await patchWith(page, target);
    await patchWith(page, clobbered);
    expect(await readScreen(page)).toEqual(syncedScreen(clobbered));

    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(
      syncedScreen(target, '<p>이전</p>\n<form class="a">\n  <input>\n</form>'),
    );

    await page.locator('#forward').click();
    expect(await readScreen(page)).toEqual(
      syncedScreen(clobbered, '<p>이후</p>\n<form class="b">\n  <input name="setAttribute">\n</form>'),
    );
  });

  test('여러 변경을 한 번에 넣은 Patch의 결과가 미리보기와 같다', async ({ page }) => {
    const changed =
      '<h2 class="title">장보기 목록</h2>' +
      '<p>내일 살 것을 <em>적어</em> 두었다.</p>' +
      '<ul id="items" class="todo"><li><b>사과</b></li><li>우유</li></ul>' +
      '<a href="https://example.org">링크</a>' +
      '<p>추가 문단</p>';

    await patchWith(page, changed);
    expect(await readScreen(page)).toEqual(syncedScreen(changed));

    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));
  });

  test('긴 문자열이 문서 폭을 넘기지 않는다', async ({ page }) => {
    await patchWith(page, `<p>${'x'.repeat(600)}</p>`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('파서가 고쳐 주는 입력도 textarea를 다시 쓰지 않는다', async ({ page }) => {
    await patchWith(page, '<p>a');
    await expect(page.locator('#source')).toHaveValue('<p>a');
    await expect(page.locator('#actual')).toHaveText('a');
  });

  test('constructor와 __proto__ 속성을 추가하고 지워도 실제 영역이 미리보기와 같다', async ({ page }) => {
    await patchWith(page, '<div constructor="1" __proto__="2">x</div>');
    await expect(page.locator('#error')).toHaveText('');
    let screen = await readScreen(page);
    expect(screen.actual).toBe(screen.preview);

    await patchWith(page, '<div>x</div>');
    await expect(page.locator('#error')).toHaveText('');
    screen = await readScreen(page);
    expect(screen.actual).toBe(screen.preview);
    expect(screen.actual).toBe('<div>x</div>');
  });

  test('뒤로 간 뒤 고치지 않고 Patch해도 앞으로가기가 동작한다', async ({ page }) => {
    await patchWith(page, '<p>one</p>');
    await page.locator('#back').click();
    await expect(page.locator('#actual')).toContainText('장보기 목록');
    await page.locator('#patch').click();
    await page.locator('#forward').click();
    await expect(page.locator('#actual')).toHaveText('one');
  });

  test('줄바꿈과 주석만 다른 입력은 History를 늘리지 않는다', async ({ page }) => {
    await patchWith(page, '<p>one</p>');
    await patchWith(page, '<!-- c -->\n<p>one</p>\n');
    await page.locator('#back').click();
    await expect(page.locator('#actual')).toContainText('장보기 목록');
  });

  test('select 안의 div는 Chrome에서 유지되고 고치지 않고 다시 Patch해도 History가 늘지 않는다', async ({ page }) => {
    // jsdom은 div를 버리고 Chrome은 유지하는 입력이어서 브라우저에서 확인한다.
    const html = '<select><div>x</div><option>a</option></select>';

    await patchWith(page, html);
    expect(await readScreen(page)).toEqual(syncedScreen(html));
    await expect(page.locator('#actual select > div')).toHaveText('x');

    await page.locator('#patch').click();
    expect(await readScreen(page)).toEqual(syncedScreen(html));

    // 이동하면 textarea에 정렬한 HTML이 들어가므로, 그 내용으로도 변경이 없어야 한다.
    await page.locator('#back').click();
    await page.locator('#forward').click();
    await page.locator('#patch').click();
    expect(await readScreen(page)).toEqual(
      syncedScreen(html, '<select>\n  <div>x</div>\n  <option>a</option>\n</select>'),
    );

    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));
  });

  test('로드하면 History 위치가 1 / 1이고 기록에 초기 상태만 있다', async ({ page }) => {
    await expect(page.locator('#history-status')).toHaveText('1 / 1');
    await expect(page.locator('#patch-log li')).toHaveText(['초기 상태']);
    await expect(page.locator('#patch-log li')).toHaveAttribute('aria-current', 'true');
  });

  test('Patch하면 위치가 2 / 2가 되고 설명 한 줄이 현재 항목으로 붙는다', async ({ page }) => {
    await patchWith(page, SECOND_HTML);

    await expect(page.locator('#history-status')).toHaveText('2 / 2');
    await expect(page.locator('#patch-log li')).toHaveText(['초기 상태', '텍스트 "케이크"로 변경']);
    await expect(page.locator('#patch-log li').nth(1)).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('#patch-log li').nth(1)).toHaveAttribute('title', '텍스트 "케이크"로 변경');

    await page.locator('#back').click();
    await expect(page.locator('#history-status')).toHaveText('1 / 2');
    await expect(page.locator('#patch-log li').nth(0)).toHaveAttribute('aria-current', 'true');
  });

  test('뒤로 간 뒤 새로 Patch하면 앞쪽 기록이 지워진다', async ({ page }) => {
    await patchWith(page, SECOND_HTML);
    await patchWith(page, THIRD_HTML);
    await page.locator('#back').click();
    await page.locator('#back').click();
    await patchWith(page, '<p>새 글</p>');

    await expect(page.locator('#history-status')).toHaveText('2 / 2');
    await expect(page.locator('#patch-log li')).toHaveCount(2);
    await expect(page.locator('#patch-log li').first()).toHaveText('초기 상태');
    await expect(page.locator('#patch-log')).not.toContainText('케이크');
  });

  test('로드하면 textarea가 여러 줄로 정렬되어 있다',async ({ page }) => {
    const { source } = await readScreen(page);

    expect(source.split('\n')).toEqual([
      '<h3 class="title">장보기 목록</h3>',
      '<p>오늘 살 것을 <strong>적어</strong> 두었다.</p>',
      '<ul id="list">',
      '  <li>사과</li>',
      '  <li class="done">우유</li>',
      '  <li>빵</li>',
      '</ul>',
      '<a href="https://example.com" title="예시 링크">링크</a>',
    ]);
  });

  test('로드 직후 고치지 않고 Patch해도 History가 늘지 않는다', async ({ page }) => {
    await page.evaluate(() => {
      window.keptList = document.querySelector('#actual ul');
    });

    await page.locator('#patch').click();

    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));
    await expectNothingToGoBack(page);
    const isUntouched = await page.evaluate(
      () => document.querySelector('#actual ul') === window.keptList,
    );
    expect(isUntouched).toBe(true);
  });

  test('Patch는 입력한 HTML을 정렬하지 않는다', async ({ page }) => {
    await patchWith(page, SECOND_HTML);

    await expect(page.locator('#source')).toHaveValue(SECOND_HTML);
  });

  test('뒤로가기 뒤에도 textarea가 정렬되어 있고 고치지 않은 Patch가 History를 늘리지 않는다', async ({ page }) => {
    await patchWith(page, SECOND_HTML);
    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));

    await page.locator('#patch').click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML, INITIAL_SOURCE));

    // History가 늘었다면 앞 기록이 지워져서 앞으로 가지 못한다.
    await page.locator('#forward').click();
    expect(await readScreen(page)).toEqual(syncedScreen(SECOND_HTML, SECOND_SOURCE));

    await page.locator('#back').click();
    await expectNothingToGoBack(page);
  });

  test('앞으로가기 뒤에도 textarea가 정렬되어 있고 고치지 않은 Patch가 History를 늘리지 않는다', async ({ page }) => {
    await patchWith(page, SECOND_HTML);
    await patchWith(page, THIRD_HTML);
    await page.locator('#back').click();
    await page.locator('#back').click();
    await page.locator('#forward').click();
    expect(await readScreen(page)).toEqual(syncedScreen(SECOND_HTML, SECOND_SOURCE));

    await page.locator('#patch').click();

    await page.locator('#forward').click();
    expect(await readScreen(page)).toEqual(syncedScreen(THIRD_HTML, THIRD_SOURCE));
  });

  // jsdom과 브라우저의 파싱 결과가 다를 수 있어서, 표의 공백 처리는 Chrome에서 따로 확인한다.
  const TABLE_INPUTS = [
    {
      name: '표',
      html:
        '<table><caption>제목</caption><colgroup><col><col span="2"></colgroup>' +
        '<thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td><td><b>2</b></td></tr></tbody></table>',
      source: [
        '<table>',
        '  <caption>제목</caption>',
        '  <colgroup>',
        '    <col>',
        '    <col span="2">',
        '  </colgroup>',
        '  <thead>',
        '    <tr>',
        '      <th>a</th>',
        '    </tr>',
        '  </thead>',
        '  <tbody>',
        '    <tr>',
        '      <td>1</td>',
        '      <td>',
        '        <b>2</b>',
        '      </td>',
        '    </tr>',
        '  </tbody>',
        '</table>',
      ].join('\n'),
    },
    {
      name: '최상위 tr',
      html: '<tr><td>a</td></tr><tr><td>b</td></tr>',
      source: '<tr>\n  <td>a</td>\n</tr>\n<tr>\n  <td>b</td>\n</tr>',
    },
    {
      name: '최상위 td',
      html: '<td>a</td><td>b</td>',
      source: '<td>a</td>\n<td>b</td>',
    },
    {
      name: '최상위 col',
      html: '<col><col span="2">',
      source: '<col>\n<col span="2">',
    },
  ];

  for (const { name, html, source } of TABLE_INPUTS) {
    test(`${name}도 이동 뒤 고치지 않은 Patch가 History를 늘리지 않는다`, async ({ page }) => {
      const next = '<p>다음</p>';
      await patchWith(page, html);
      expect(await readScreen(page)).toEqual(syncedScreen(html));
      await patchWith(page, next);

      await page.locator('#back').click();
      expect(await readScreen(page)).toEqual(syncedScreen(html, source));

      await page.locator('#patch').click();
      expect(await readScreen(page)).toEqual(syncedScreen(html, source));

      // History가 늘었다면 앞 기록이 지워져서 앞으로 가지 못한다.
      await page.locator('#forward').click();
      expect(await readScreen(page)).toEqual(syncedScreen(next));
    });
  }
});
