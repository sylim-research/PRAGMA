import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const origin = process.env.PRAGMA_PREVIEW_ORIGIN || "http://127.0.0.1:8099";
const output = ".tmp/batch-generation-workspace";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  // This layout check never invokes production services or model generation.
  await page.route("**/*.supabase.co/**", route => route.abort());
  await page.goto(origin + "/admin/batch");
  await expect(page.getByRole("heading", { name: "1. 생성 조건" })).toBeVisible();
  await expect(page.getByRole("button", { name: "전체 72건 생성 시작" })).toBeEnabled();
  await expect(page.getByText("총 생성 예정").locator("..")).toContainText("72건");
  await expect(page.locator("#batch-execution").getByText("생성물은 내부 검토 대기로 저장됩니다.", { exact: false })).toHaveCount(0);
  await expect(page.locator("#batch-execution").getByRole("link")).toHaveCount(0);
  const navigation = page.locator("aside").filter({ has: page.getByRole("navigation") });
  await page.evaluate(() => scrollTo(0, 500));
  const sidebarTop = (await navigation.boundingBox()).y;
  await page.evaluate(() => scrollTo(0, 1000));
  expect(Math.abs((await navigation.boundingBox()).y - sidebarTop)).toBeLessThan(1);
  await navigation.getByRole("link", { name: "연구 데이터 내보내기", exact: true }).scrollIntoViewIfNeeded();
  await expect(navigation.getByRole("link", { name: "연구 데이터 내보내기", exact: true })).toBeInViewport();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: output + "/desktop.png", fullPage: true });
  await page.getByLabel("생성 항목 1 선택", { exact: true }).check();
  await page.getByRole("button", { name: "다음 항목" }).click();
  await page.getByLabel("생성 항목 11 선택", { exact: true }).check();
  await expect(page.getByLabel("선택 항목 번호", { exact: true })).toHaveValue("1, 11");
  await page.getByRole("button", { name: "495건 본배치", exact: true }).click();
  await expect(page.getByRole("button", { name: "전체 495건 생성 시작" })).toBeEnabled();
  await expect(page.getByLabel("선택 항목 번호", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "중→한 · 30건 검증" }).click();
  await expect(page.getByRole("button", { name: "전체 30건 생성 시작" })).toBeEnabled();
  await page.screenshot({ path: output + "/zh-ko.png", fullPage: true });
  await page.getByRole("button", { name: "기본 72건" }).click();
  for (const width of [1440, 1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1280) {
      const newBatchButton = page.locator("#batch-execution").getByRole("button", { name: "새 배치 ID", exact: true });
      await newBatchButton.scrollIntoViewIfNeeded();
      await expect(newBatchButton).toBeInViewport();
    }
  }
  await page.getByRole("link", { name: "생성 실행으로 ↓" }).click();
  await expect(page.getByRole("heading", { name: "3. 생성 실행" })).toBeInViewport();
  await page.screenshot({ path: output + "/mobile-execution.png" });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: output + "/mobile-top.png" });
  expect(errors).toEqual([]);
  const result = { status: "PASS", scope: "Local UI; production service requests blocked; no AI generation", checks: ["72/495/30 plans", "selection across pages", "preset resets selection", "no overflow at 1440/1280/1024/390", "sticky sidebar and access to last menu", "execution footer copy and links removed", "desktop execution panel bottom actions accessible", "mobile execution shortcut"], screenshots: output };
  await writeFile(output + "/result.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
