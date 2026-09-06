// Run against Vite with VITE_SUPABASE_URL=https://pragma-week13.test and a dummy key.
// This browser smoke uses only in-memory HTTP fixtures; it never writes to a real DB.
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:8099";
const output = "tmp/week13-smoke";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const writes = [];
let fixture = { outline: {}, weeks: [], scenarios: [], assignments: [] };
await page.addInitScript(() => sessionStorage.setItem("dev-stub-session", JSON.stringify({
  user_id: "10000000-0000-4000-8000-000000000001", email: "week13@example.test",
  approval_status: "approved", profile_completed: true,
})));
await page.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin === base) return route.continue();
  if (url.hostname !== "pragma-week13.test") return route.abort();
  const table = url.pathname.split("/").pop();
  const method = request.method();
  const body = request.postDataJSON();
  if (method === "OPTIONS") return route.fulfill({ status: 200, headers: {
    "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*",
  } });
  const single = request.headers().accept?.includes("vnd.pgrst.object");
  let data = [];
  if (table === "curriculum_outlines") {
    if (method === "PATCH") { fixture.outline = { ...fixture.outline, ...body }; writes.push("outline"); }
    data = single ? fixture.outline : [fixture.outline];
  } else if (table === "curriculum_weeks") {
    if (method === "POST") {
      fixture.weeks = body.map((row) => ({ ...fixture.weeks.find((week) => week.week_no === row.week_no), ...row }));
      writes.push("weeks");
    }
    data = fixture.weeks;
  } else if (table === "scenarios") {
    data = fixture.scenarios;
  } else if (table === "curriculum_week_scenarios") {
    if (method === "POST") {
      for (const row of body) {
        const index = fixture.assignments.findIndex((item) => item.week_no === row.week_no && item.scenario_id === row.scenario_id);
        if (index >= 0) fixture.assignments[index] = { ...fixture.assignments[index], ...row };
        else fixture.assignments.push({ ...row, id: `assignment-${fixture.assignments.length}` });
      }
      writes.push("assignments");
    }
    if (method === "DELETE") throw new Error("This smoke must not delete an existing assignment");
    data = fixture.assignments;
  }
  return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(data) });
});
try {
  await page.goto(base);
  fixture = await page.evaluate(async () => {
    const { createStandard15WeekTemplate } = await import("/src/lib/curriculum/template.ts");
    const { createEmptyOutlineDraft, outlineDraftToInsert, weekDraftToInsert } = await import("/src/lib/curriculum/mappers.ts");
    const { COURSE_PRESETS } = await import("/src/lib/pragma/scenarioTopics.ts");
    const { CURRENT_CONTENT_RELEASE_ID } = await import("/supabase/functions/_shared/contentRelease.ts");
    const preset = COURSE_PRESETS[0];
    const outline = { ...outlineDraftToInsert(createEmptyOutlineDraft()), id: preset.outline_id,
      title: "브라우저 검증용 교과목", status: "published", level: "intermediate",
      language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0,
      midterm_week: 8, final_week: 15, scenarios_per_week: 2,
      composition_theme_codes: [], target_speech_acts: ["request", "thanks", "compliment", "agreement", "refusal", "apology", "proposal", "opposition", "complaint"],
      created_at: "2026-09-06T00:00:00Z", updated_at: "2026-09-06T00:00:00Z" };
    const weeks = createStandard15WeekTemplate().map((week) => ({
      ...weekDraftToInsert(week, outline.id), id: `week-${week.week_no}`,
    }));
    weeks[12].title = "고부담 맥락 집중 실전";
    const scenarios = Array.from({ length: 5 }, (_, index) => ({
      scenario_id: `20000000-0000-4000-8000-00000000000${index}`,
      speech_act: index === 4 ? "apology" : "request", learner_level: "intermediate",
      domain: "school", mode: "translation", theme_code: "campus_study", topic_code: "test",
      mission_status: "reviewed", release_gate_mode: "legacy_reviewed", target_feature: "request_mitigation_optionality",
      mission_schema_version: "mission_v5", mission_mpj_items: [{}, {}, {}, {}, {}],
      scenario_p: "equal", scenario_d: "close", scenario_r: index % 2 ? "high" : "low",
      core_content: { situation_ko: `검증용 장면 ${index + 1}. 서로 다른 상황에서 자료를 요청합니다.`,
        source_text_ko: `검증용 원문 ${index + 1}`, direction: "ko_zh",
        generation: { content_release_id: CURRENT_CONTENT_RELEASE_ID } },
    }));
    const assignments = scenarios.slice(0, 2).map((core, index) => ({
      id: `assignment-${index}`, outline_id: outline.id, week_no: 2, scenario_id: core.scenario_id,
      position: index, slot_role: "primary",
    }));
    return { outline, weeks, scenarios, assignments };
  });
  const courseId = fixture.outline.id;
  await page.goto(`${base}/admin/composer?outline=${courseId}`);
  const week13 = page.getByRole("group", { name: "13주차 편성", exact: true });
  await expect(week13.getByRole("button", { name: "화행 선택", exact: true })).toBeVisible();
  await expect(week13.getByRole("button", { name: "+ 미션", exact: true })).toHaveCount(0);
  await week13.getByRole("button", { name: "화행 선택", exact: true }).click();
  const select = page.getByText("집중 보완할 화행", { exact: true }).locator("..").getByRole("combobox");
  await select.click();
  await page.getByRole("option", { name: "요청", exact: true }).click();
  await page.getByRole("button", { name: "저장", exact: true }).last().click();
  await expect(week13.getByRole("button", { name: "요청 · 화행 변경", exact: true })).toBeVisible();
  expect(fixture.weeks[12].speech_act).toBe("request");
  await week13.getByRole("button", { name: "+ 미션", exact: true }).click();
  for (let index = 0; index < 2; index++) {
    await expect(week13.getByText("검증용 장면 5.", { exact: false })).toHaveCount(0);
    await week13.getByRole("button", { name: "추가", exact: true }).first().click();
  }
  await week13.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(week13.getByRole("button", { name: "+ 미션", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "편성 저장", exact: true }).click();
  await expect.poll(() => fixture.assignments.filter((item) => item.week_no === 13).length).toBe(2);
  await page.reload();
  await expect(week13.getByText("미션 2개", { exact: true })).toBeVisible();
  await week13.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/composer.png` });
  await page.getByRole("button", { name: "강의계획서", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: "화행·활동", exact: true })).toBeVisible();
  await page.screenshot({ path: `${output}/syllabus.png`, fullPage: true });
  await page.goto(`${base}/learner/course/${courseId}`);
  await expect(page.getByText("경험한 화행 0/9 · 미션 0/4", { exact: true })).toBeVisible();
  await expect(page.getByText("고부담 맥락 집중 실전", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${output}/learner-plan.png`, fullPage: true });
  await page.goto(`${base}/learner/course/${courseId}/week/13`);
  await expect(page.getByRole("heading", { name: "선택 화행 집중 보완", exact: true })).toBeVisible();
  await expect(page.getByText("선택 화행 · 요청", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "중심 질문", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /미션 [12] 시작하기/ })).toHaveCount(2);
  await page.screenshot({ path: `${output}/learner-week13.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/learner-week13-mobile.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  const result = { status: "PASS", data: "in-memory HTTP fixtures; no production writes", writes,
    selectedAct: fixture.weeks[12].speech_act, assignedWeek13: 2,
    checks: ["choose/save/reload", "same-act candidates", "two-mission limit", "syllabus", "nine-act count", "learner links", "mobile overflow", "no page errors"] };
  await writeFile(`${output}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  console.log("PAGE", (await page.locator("body").innerText()).slice(-5000));
  throw error;
} finally {
  await browser.close();
}
