import { test, expect } from '@playwright/test';
import { fixRandom } from './helpers.js';

test('Phase 2 페이지에 게임 영역과 관찰 패널이 있다', async ({ page }) => {
  await page.goto('/phase2.html');
  await expect(page.locator('#game')).toBeAttached();
  await expect(page.locator('details#inspector')).toBeAttached();
  await expect(page.locator('#inspector-body')).toBeAttached();
  await expect(page.locator('details#inspector')).not.toHaveAttribute('open', /.*/);
});

test('두 페이지의 링크로 서로 이동하고 현재 링크만 표시한다', async ({ page }) => {
  await page.goto('/phase2.html');
  const nav = page.getByRole('navigation', { name: '페이지 이동' });
  await expect(nav.getByRole('link', { name: 'Phase 2' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Phase 1' })).not.toHaveAttribute('aria-current', /.*/);

  await nav.getByRole('link', { name: 'Phase 1' }).click();
  await expect(page).toHaveURL(/\/(index\.html)?$/);
  await expect(page.locator('#actual')).toBeAttached();
  await expect(nav.getByRole('link', { name: 'Phase 1' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Phase 2' })).not.toHaveAttribute('aria-current', /.*/);

  await nav.getByRole('link', { name: 'Phase 2' }).click();
  await expect(page).toHaveURL(/phase2\.html$/);
  await expect(page.locator('#game')).toBeAttached();
});

test('fixRandom이 Math.random을 고정한다', async ({ page }) => {
  await fixRandom(page, 0.25);
  await page.goto('/phase2.html');
  expect(await page.evaluate(() => Math.random())).toBe(0.25);
});

/** 이름을 넣고 시작한다. */
async function start(page, name = '정글러') {
  await page.getByLabel('이름').fill(name);
  await page.getByRole('button', { name: '시작' }).click();
}

/** 선택지를 차례로 누른다. */
async function choose(page, ...labels) {
  for (const label of labels) await page.getByRole('button', { name: label, exact: true }).click();
}

/** 난수를 고정하고 열어서 시작한다. */
async function open(page) {
  await fixRandom(page, 0.99);
  await page.goto('/phase2.html');
  await start(page);
}

/** 코딩 3번, 집 4번, 담배 7번으로 14번 선택해 발표까지 간다. */
async function reachPresentation(page) {
  await choose(page, '코딩', '코딩', '코딩', '집 가기', '집 가기', '집 가기', '집 가기');
  await choose(page, ...Array(7).fill('담배 타임'));
}

test('난수를 고정해 한 판을 끝까지 하면 발표 대성공이고 최고 기록이 남는다', async ({ page }) => {
  await open(page);
  await reachPresentation(page);
  for (const name of ['useState', 'useEffect', 'useMemo', 'diff', 'patch']) {
    await expect(page.locator('.target-name')).toHaveText(name);
    await page.locator('.typing-input').pressSequentially(name);
  }
  await expect(page.getByRole('heading', { name: '발표 대성공' })).toBeVisible();
  await expect(page.locator('.score')).toContainText('105');

  await page.reload();
  await expect(page.locator('.best-score')).toContainText('105');
});

test('발표에서 한글을 치면 안내가 나오고 시간이 지나면 발표 폭망이다', async ({ page }) => {
  await page.clock.install();
  await open(page);
  await reachPresentation(page);
  await expect(page.locator('.typing-input')).toBeFocused();
  await page.locator('.typing-input').fill('ㅕㄴㄷ');
  await expect(page.locator('.typing-hint')).toContainText('한/영');
  await page.clock.runFor(20000);
  await expect(page.getByRole('heading', { name: '발표 폭망' })).toBeVisible();
});

test('코딩만 하면 번아웃이다', async ({ page }) => {
  await open(page);
  await choose(page, ...Array(7).fill('코딩'));
  await expect(page.getByRole('heading', { name: '번아웃' })).toBeVisible();
});

test('몰래 나가기를 반복하면 코치 면담이다', async ({ page }) => {
  await open(page);
  await choose(page, ...Array(5).fill('코치님 몰래 나가기'));
  await expect(page.getByRole('heading', { name: '코치 면담' })).toBeVisible();
});

test('집에 다섯 번 가면 그냥 집에 감이고 다시 하기는 이름을 남긴다', async ({ page }) => {
  await open(page);
  await choose(page, ...Array(5).fill('집 가기'));
  await expect(page.getByRole('heading', { name: '그냥 집에 감' })).toBeVisible();
  await page.getByRole('button', { name: '다시 하기' }).click();
  await expect(page.getByLabel('이름')).toHaveValue('정글러');
});

test('시간이 지나면 멍때리기로 턴이 지나가고 계속 두면 번아웃이다', async ({ page }) => {
  await page.clock.install();
  await open(page);
  await page.clock.runFor(20000);
  await expect(page.locator('.event-log')).toContainText('모니터만 보다가');
  await expect(page.locator('h2')).toHaveText('1일차 오후');
  for (let i = 0; i < 11; i += 1) await page.clock.runFor(20000);
  await expect(page.getByRole('heading', { name: '번아웃' })).toBeVisible();
});
