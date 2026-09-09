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
  await expect(page.getByRole("region", { name: "AI 콘텐츠 제작 흐름" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /기본 72건|495건 본배치|30건 검증/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "전체 0건 생성 시작" })).toBeDisabled();
  await page.screenshot({ path: output + "/empty.png" });
  for (const [level, total, percent] of [["입문", 18, 50], ["중급", 36, 25], ["고급", 18, 50]]) {
    await page.getByLabel(level + " · 총 생성 건수", { exact: true }).fill(String(total));
    await page.getByLabel(level + " · 통역 비율", { exact: true }).fill(String(percent));
    await expect(page.getByRole("group", { name: level + " 생성 설정" })).toContainText(level + total + "건");
  }
  await expect(page.getByText("여행·이동", { exact: true })).toHaveCount(0);
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
  await page.getByRole("button", { name: "중→한", exact: true }).click();
  await expect(page.getByLabel("선택 항목 번호", { exact: true })).toHaveValue("");
  await page.getByLabel("중급 · 총 생성 건수", { exact: true }).fill("45");
  await expect(page.getByRole("button", { name: "전체 81건 생성 시작" })).toBeEnabled();
  await page.screenshot({ path: output + "/zh-ko.png", fullPage: true });
  await page.getByLabel("중급 · 총 생성 건수", { exact: true }).fill("36");
  await page.getByLabel("입문 · 통역 비율", { exact: true }).fill("0");
  await expect(page.getByRole("group", { name: "입문 생성 설정" })).toContainText("번역 18 · 통역 0");
  await page.getByLabel("고급 · 통역 비율", { exact: true }).fill("100");
  await expect(page.getByRole("group", { name: "고급 생성 설정" })).toContainText("번역 0 · 통역 18");
  await page.getByRole("button", { name: "한→중", exact: true }).click();
  for (const width of [1440, 1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("th").evaluateAll(headers => headers.every(header =>
      getComputedStyle(header).whiteSpace === "nowrap"
      && header.scrollWidth <= header.clientWidth
    ))).toBe(true);
    if (width === 1280) {
      const newBatchButton = page.locator("#batch-execution").getByRole("button", { name: "새 배치 ID", exact: true });
      await newBatchButton.scrollIntoViewIfNeeded();
      await expect(newBatchButton).toBeInViewport();
    }
  }
  await page.getByRole("heading", { name: "3. 생성 실행" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "3. 생성 실행" })).toBeInViewport();
  await page.screenshot({ path: output + "/mobile-execution.png" });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: output + "/mobile-top.png" });
  expect(errors).toEqual([]);
  const result = { status: "PASS", scope: "Local UI; production service requests blocked; no AI generation", checks: ["legacy presets and flow banner removed", "both directions use editable quotas", "selection across pages", "direction change resets selection", "no overflow at 1440/1280/1024/390", "sticky sidebar and access to last menu", "execution footer copy and links removed", "desktop execution panel bottom actions accessible", "mobile execution panel visible"], screenshots: output };
  await writeFile(output + "/result.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
