import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV_GROUPS,
  ADMIN_PRIORITY_LINKS,
  adminMobileNavValue,
} from "@/lib/admin/adminNavigation";

const REQUIRED_ENTRY_PATHS = [
  "/admin/review",
  "/admin/composer",
  "/admin/learners",
  "/admin/decision-traces",
  "/admin/export",
] as const;

describe("admin navigation reachability", () => {
  it("keeps every restored operations/research entry in the shared navigation source", () => {
    expect(ADMIN_PRIORITY_LINKS.map((item) => item.to)).toEqual(REQUIRED_ENTRY_PATHS);
    for (const item of ADMIN_PRIORITY_LINKS) {
      expect(item).toBe(ADMIN_NAV_GROUPS.flatMap(group => group.items).find(candidate => candidate.to === item.to));
    }
    const allPaths = ADMIN_NAV_GROUPS.flatMap((group) => group.items).map((item) => item.to);
    expect(new Set(allPaths).size).toBe(allPaths.length);
    expect(allPaths).not.toContain("/admin/question-designer");
    expect(allPaths).not.toContain("/admin/research-qa/calibration");
    // 생성 기준(생성기가 소비하는 제약)과 학습 미션 재료(시나리오)는 다른 그룹이다.
    const criteria = ADMIN_NAV_GROUPS.find((group) => group.header === "1. 콘텐츠 제작 기준");
    expect(criteria?.items.map((item) => item.to)).toEqual([
      "/admin/prompt-harness",
      "/admin/corpus",
    ]);
    const material = ADMIN_NAV_GROUPS.find((group) => group.header === "2. 시나리오 생성");
    expect(material?.items.map((item) => item.to)).toEqual([
      "/admin/authentic",
      "/admin/generator",
      "/admin/batch",
    ]);
    const production = ADMIN_NAV_GROUPS.find((group) => group.header === "3. 학습 미션 제작·승인");
    expect(production?.items.map((item) => item.to)).toEqual([
      "/admin/assembly", "/admin/ai-review", "/admin/review",
    ]);
    // 학습 미션 라이브러리는 메뉴에서 뺐다(2026-09-26).
    expect(ADMIN_NAV_GROUPS.flatMap((group) => group.items).some((item) => item.to === "/admin/library")).toBe(false);
    const operations = ADMIN_NAV_GROUPS.find((group) => group.header === "4. 수업 운영");
    expect(operations?.items.map((item) => item.to)).toEqual([
      "/admin/composer", "/admin/decision-traces",
    ]);
    const research = ADMIN_NAV_GROUPS.find((group) => group.header === "5. 관리 도구");
    expect(research?.items.map((item) => item.to)).toEqual([
      "/admin/learners",
      "/admin/data-backup",
      "/admin/export",
    ]);
  });

  it("keeps approving out of the AI review screen", () => {
    // AI 검토와 교수자 최종 승인은 같은 미션 목록을 보되 권한이 다르다. 화면을 나눈 뒤에도
    // AI 쪽에 승인 경로가 생기지 않아야 한다. 2026-09-20: 미션 하나를 들고 다음 단계 화면으로
    // 건너가는 인계 링크는 없앴다 — 승인은 여러 건을 모아 한 번에 하고, 화면 사이 이동은 사이드바로만 한다.
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('path="/admin/ai-review"');
    expect(app).toContain("reviewMode aiReview");

    const panel = readFileSync(
      resolve(process.cwd(), "src/components/admin/ContentReviewPanel.tsx"),
      "utf8",
    );
    // handoffHref가 주어지면 승인 절과 승인 버튼이 렌더되지 않는다.
    expect(panel).toContain('next === "professor" && !handoffHref');
    expect(panel).toContain('!(handoffHref && (next === "professor" || next === "rules" || next === "openai"))');
    expect(panel).not.toContain("교수자 최종 승인에서 이 미션 열기");
    expect(panel).not.toContain("교수자 최종 승인으로 →");
    // 인계 링크를 없앤 대신 사이드바에 승인 메뉴가 있어야 길이 끊기지 않는다.
    const nav = readFileSync(resolve(process.cwd(), "src/lib/admin/adminNavigation.ts"), "utf8");
    expect(nav).toContain('to: "/admin/review"');

    const assembly = readFileSync(
      resolve(process.cwd(), "src/pages/admin/AdminAssembly.tsx"),
      "utf8",
    );
    expect(assembly).toContain("handoffHref={`/admin/review?scenarioId=${r.scenario_id}`}");
    // 제작 현황 화면은 읽기만 하고 같은 미션을 품질 점검 화면으로 넘긴다.
    expect(assembly).toContain('"/admin/ai-review"}?scenarioId=${r.scenario_id}');
  });

  it("keeps a route or compatibility route for every restored entry", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    for (const path of REQUIRED_ENTRY_PATHS) {
      expect(app, `missing route ${path}`).toContain(`path="${path}"`);
    }
    expect(app).toContain('path="/admin/review"');
    expect(app).toContain('path="/admin/teaching-generator" element={<RequireAdmin><AdminTeachingStudio />');
    expect(app).toContain('const AdminExport = lazy(() => import("./pages/admin/AdminExport.tsx"))');
    expect(app).toContain('const AdminDataBackup = lazy(() => import("./pages/admin/AdminDataBackup.tsx"))');
    expect(app).toContain('path="/admin/export" element={<RequireAdmin><AdminExport />');
    expect(app).toContain('path="/admin/data-backup" element={<RequireAdmin><AdminDataBackup />');
    expect(app).toContain('path="/admin/research-qa/calibration"');
    expect(app).toContain('path="/prototype/research-qa-calibration"');
    expect(app).toContain('to="/admin/research-qa/final-review"');
    expect(app).not.toContain('path="/admin/analytics"');
    expect(app).not.toContain('path="/admin/archive"');
    expect(app).not.toContain('path="/admin/question-designer"');
    expect(app).not.toContain("AdminQualityOverview");
    expect(app).toContain('path="/admin/research-qa"');
    expect(app).toContain('to="/admin/research-qa/final-review"');

    const missionLogs = readFileSync(
      resolve(process.cwd(), "src/pages/admin/AdminDecisionTraces.tsx"),
      "utf8",
    );
    expect(missionLogs).toContain('.from("learner_mission_logs")');
    expect(missionLogs).not.toContain('.from("decision_traces")');

    const exportPage = readFileSync(
      resolve(process.cwd(), "src/pages/admin/AdminExport.tsx"),
      "utf8",
    );
    expect(exportPage).toContain("가명화");
    expect(exportPage).toContain("동의 버전이 유효한");
    expect(exportPage).not.toContain("약 40명");
  });

  it("keeps the mobile selector on the canonical target for compatibility paths", () => {
    expect(adminMobileNavValue("/admin/review")).toBe("/admin/review");
    expect(adminMobileNavValue("/admin/research-qa/releases")).toBe("/admin/review");
    expect(adminMobileNavValue("/admin/research-qa/calibration")).toBe("");
    const production = ADMIN_NAV_GROUPS.find(
      (group) => group.header === "3. 학습 미션 제작·승인",
    );
    expect(production?.items.map((item) => item.to)).toEqual([
      "/admin/assembly",
      "/admin/ai-review",
      "/admin/review",
    ]);
    expect(adminMobileNavValue("/admin/ai-review")).toBe("/admin/ai-review");
    expect(ADMIN_NAV_GROUPS.some((group) => group.header.includes("품질관리"))).toBe(false);
    expect(adminMobileNavValue("/admin/generator")).toBe("/admin/generator");
    // 원자료 분석은 보관함을 갖춘 별도 화면이다(2026-09-09 오후).
    expect(adminMobileNavValue("/admin/authentic")).toBe("/admin/authentic");
    expect(adminMobileNavValue("/admin/teaching-generator")).toBe("/admin/decision-traces");
    expect(adminMobileNavValue("/admin/package")).toBe("/admin/decision-traces");
    expect(adminMobileNavValue("/admin/class-responses")).toBe("/admin/decision-traces");
    expect(adminMobileNavValue("/admin/batch")).toBe("/admin/batch");
    expect(adminMobileNavValue("/admin/data-backup")).toBe("/admin/data-backup");
    expect(adminMobileNavValue("/admin/decision-traces")).toBe("/admin/decision-traces");
    expect(adminMobileNavValue("/admin/export")).toBe("/admin/export");
  });
});
