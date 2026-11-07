import { test, expect } from '@playwright/test';

/**
 * Math.random을 고정값으로 바꾼다. 페이지를 열기 전에 호출한다.
 *
 * @param {import('@playwright/test').Page} page 대상 페이지
 * @param {number} value 고정할 값 (0 이상 1 미만)
 * @returns {Promise<void>}
 */
export async function fixRandom(page, value) {
  await page.addInitScript((v) => {
    Math.random = () => v;
  }, value);
}

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
