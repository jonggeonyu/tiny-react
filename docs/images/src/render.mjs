// diagrams.html의 .fig마다 docs/images/<id>.png를 만든다.
// 실행: node docs/images/src/render.mjs (설치된 Chrome 사용)
import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error));
await page.goto(pathToFileURL(path.join(here, 'diagrams.html')).href);
// 그리기 스크립트가 오류로 멈추면 __ready가 오지 않으므로, 시간 초과 전에 오류를 먼저 보여 준다
await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 }).catch((timeout) => {
  throw errors[0] ?? timeout;
});
if (errors.length) throw errors[0];

for (const fig of await page.locator('.fig').all()) {
  const id = await fig.getAttribute('id');
  await fig.screenshot({ path: path.join(here, '..', `${id}.png`) });
  console.log(`${id}.png`);
}
await browser.close();
