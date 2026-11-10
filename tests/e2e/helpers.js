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

/**
 * 가짜 시계를 설치하고 멈춘다. 페이지를 열기 전에 호출한다.
 * `clock.install()`만 하면 시계가 실제 시간대로 흘러서, 테스트가 느릴 때 타이머가 미리 줄어든다.
 * 멈춘 뒤에는 `clock.runFor()`로 넘긴 시간만 흐른다.
 *
 * @param {import('@playwright/test').Page} page 대상 페이지
 * @returns {Promise<void>}
 */
export async function freezeClock(page) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01'));
}
