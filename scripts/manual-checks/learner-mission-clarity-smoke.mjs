import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const directory = 'C:/PRAGMA_THESIS_LOCAL/05_증거/앱통합검증/2026-09-10_미션안내';
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const results = [];
const steps = process.argv.length > 2 ? process.argv.slice(2) : ['scene-1', 'A5', 'A-FEEDBACK', 'summary'];
for (const width of [1280, 390]) {
  await page.setViewportSize({ width, height: 900 });
  for (const step of steps) {
    await page.goto(`http://127.0.0.1:8099/learner/practice?preview=v5&step=${step}&preset=mixed`);
    await page.getByRole('region', { name: '미션 학습 흐름' }).waitFor();
    if (step === 'A-FEEDBACK') await page.getByRole('heading', { name: /먼저 확인할 한 가지/ }).waitFor();
    if (step === 'summary') await page.getByRole('heading', { name: '내가 확정한 최종안' }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error(`Horizontal overflow: ${width} ${step}`);
    await page.screenshot({ path: `${directory}/${width}-${step}.png`, fullPage: true });
    results.push({ width, step, overflow });
    if (step === 'A-FEEDBACK') {
      await page.getByRole('button', { name: '한 번 다듬어보기' }).click();
      await page.getByRole('heading', { name: '피드백을 반영해 다시 써보세요.' }).waitFor();
      await page.screenshot({ path: `${directory}/${width}-revision.png`, fullPage: true });
      results.push({ width, step: 'revision', overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
    }
  }
}
await browser.close();
writeFileSync(`${directory}/smoke${process.argv.length > 2 ? '-followup' : ''}.json`, JSON.stringify({ at: new Date().toISOString(), mode: 'unsaved DEV fixture', errors, results }, null, 2));
if (errors.length) throw new Error(JSON.stringify(errors));
console.log(JSON.stringify({ screens: results.length, pageErrors: errors.length, directory }));
