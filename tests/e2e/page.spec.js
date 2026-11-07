import { test, expect } from '@playwright/test';

test('페이지에 필요한 요소가 있다', async ({ page }) => {
  await page.goto('/');
  for (const id of ['actual', 'source', 'preview', 'patch', 'back', 'forward', 'error']) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  await expect(page.locator('#error')).toHaveAttribute('role', 'alert');
});

const INITIAL_HTML =
  '<h3 class="title">장보기 목록</h3>' +
  '<p>오늘 살 것을 <strong>적어</strong> 두었다.</p>' +
  '<ul id="list"><li>사과</li><li class="done">우유</li><li>빵</li></ul>' +
  '<a href="https://example.com" title="예시 링크">링크</a>';
const SECOND_HTML = INITIAL_HTML.replace('<li>빵</li>', '<li>케이크</li>');
const THIRD_HTML = SECOND_HTML.replace('장보기 목록', '살 것');
const INVALID_HTML = '<div =a="1"></div>';

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
 *
 * @param {string} html 세 영역의 내용
 * @returns {{actual: string, source: string, preview: string, error: string}} 기대하는 화면
 */
function syncedScreen(html) {
  return { actual: html, source: html, preview: html, error: '' };
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

  test('로드하면 실제 영역이 정리되고 테스트 영역이 같은 내용이 된다', async ({ page }) => {
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML));
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

    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML));
  });

  test('뒤로가기와 앞으로가기는 세 영역을 함께 바꾸고 양 끝에서는 화면을 바꾸지 않는다', async ({ page }) => {
    const back = page.locator('#back');
    const forward = page.locator('#forward');
    await patchWith(page, SECOND_HTML);
    await patchWith(page, THIRD_HTML);

    await back.click();
    expect(await readScreen(page)).toEqual(syncedScreen(SECOND_HTML));
    await back.click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML));
    await back.click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML));

    await forward.click();
    expect(await readScreen(page)).toEqual(syncedScreen(SECOND_HTML));
    await forward.click();
    expect(await readScreen(page)).toEqual(syncedScreen(THIRD_HTML));
    await forward.click();
    expect(await readScreen(page)).toEqual(syncedScreen(THIRD_HTML));
  });

  test('양 끝에서 누른 이동 버튼은 고치던 입력을 지우지 않는다', async ({ page }) => {
    await page.locator('#source').fill('<p>저장하지 않은 입력</p>');

    await page.locator('#back').click();
    await page.locator('#forward').click();

    expect(await readScreen(page)).toEqual({
      ...syncedScreen(INITIAL_HTML),
      source: '<p>저장하지 않은 입력</p>',
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
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML));
  });

  test('입력을 비우고 Patch하면 실제 영역이 비고 뒤로가기로 복원된다', async ({ page }) => {
    await patchWith(page, '');
    expect(await readScreen(page)).toEqual(syncedScreen(''));

    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML));
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
    expect(await readScreen(page)).toEqual(syncedScreen(SECOND_HTML));
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

    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML));
  });

  test('patch가 실패하면 실제 영역이 직전 상태로 남고 오류를 보여 준다', async ({ page }) => {
    const before = '<form class="a"><input name="setAttribute"></form>';
    const failing = '<form class="b"><input name="setAttribute"></form>';
    await patchWith(page, before);
    expect(await readScreen(page)).toEqual(syncedScreen(before));

    await patchWith(page, failing);

    const screen = await readScreen(page);
    expect(screen.error).not.toBe('');
    expect(screen).toEqual({ ...syncedScreen(before), source: failing, error: screen.error });

    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML));
  });

  test('patch가 일부만 적용하고 실패해도 실제 영역을 직전 상태로 되돌린다', async ({ page }) => {
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
    const target = '<p>이전</p><form class="a"><input></form>';
    const clobbered = '<p>이후</p><form class="b"><input name="setAttribute"></form>';
    await patchWith(page, target);
    await patchWith(page, clobbered);
    expect(await readScreen(page)).toEqual(syncedScreen(clobbered));

    await page.locator('#back').click();
    expect(await readScreen(page)).toEqual(syncedScreen(target));

    await page.locator('#forward').click();
    expect(await readScreen(page)).toEqual(syncedScreen(clobbered));
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
    expect(await readScreen(page)).toEqual(syncedScreen(INITIAL_HTML));
  });
});

const snapshot = (page) =>
  page.evaluate(() => ({
    actual: document.querySelector('#actual').innerHTML,
    preview: document.querySelector('#preview').innerHTML,
  }));

test('긴 문자열이 문서 폭을 넘기지 않는다', async ({ page }) => {
  await page.goto('/');
  await patchWith(page, `<p>${'x'.repeat(600)}</p>`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('파서가 고쳐 주는 입력도 textarea를 다시 쓰지 않는다', async ({ page }) => {
  await page.goto('/');
  await patchWith(page, '<p>a');
  await expect(page.locator('#source')).toHaveValue('<p>a');
  await expect(page.locator('#actual')).toHaveText('a');
});

test('constructor와 __proto__ 속성을 추가하고 지워도 실제 영역이 미리보기와 같다', async ({ page }) => {
  await page.goto('/');
  await patchWith(page, '<div constructor="1" __proto__="2">x</div>');
  await expect(page.locator('#error')).toHaveText('');
  let s = await snapshot(page);
  expect(s.actual).toBe(s.preview);
  await patchWith(page, '<div>x</div>');
  await expect(page.locator('#error')).toHaveText('');
  s = await snapshot(page);
  expect(s.actual).toBe(s.preview);
  expect(s.actual).toBe('<div>x</div>');
});

test('뒤로 간 뒤 고치지 않고 Patch해도 앞으로가기가 동작한다', async ({ page }) => {
  await page.goto('/');
  await patchWith(page, '<p>one</p>');
  await page.locator('#back').click();
  await expect(page.locator('#actual')).toContainText('장보기 목록');
  await page.locator('#patch').click();
  await page.locator('#forward').click();
  await expect(page.locator('#actual')).toHaveText('one');
});

test('줄바꿈과 주석만 다른 입력은 History를 늘리지 않는다', async ({ page }) => {
  await page.goto('/');
  await patchWith(page, '<p>one</p>');
  await patchWith(page, '<!-- c -->\n<p>one</p>\n');
  await page.locator('#back').click();
  await expect(page.locator('#actual')).toContainText('장보기 목록');
});
