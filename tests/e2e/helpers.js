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
