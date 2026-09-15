import { describe, expect, it } from "vitest";
import { DASHBOARD_REVIEW_CRITERIA_VERSION, summarizeDashboardReviewStages, type DashboardReviewRunRow, type DashboardScenarioRow } from "./adminDashboardMetrics";
import { groupAssignments, missionVersionLabel, placementLabel, professorQueueOf, reviewProgressLabel, traceLabel } from "./professorReviewQueue";

const row = (id: string, overrides: Partial<DashboardScenarioRow> = {}): DashboardScenarioRow => ({
  scenario_id: id, content_format: "scenario_core_v1", review_status: null, mission_status: "generated",
  mission_schema_version: "mission_v6", authoring_stage: null, updated_at: "2026-09-01T00:00:00Z", ...overrides,
});
const run = (id: string, overrides: Partial<DashboardReviewRunRow> = {}): DashboardReviewRunRow => ({
  target_id: id, kind: "mission", criteria_version: DASHBOARD_REVIEW_CRITERIA_VERSION, rules_verdict: "pass",
  openai_response_id: "o", claude_response_id: null, adjudication_response_id: null, created_at: "2026-09-02T00:00:00Z",
  approval_policy: "focused_v1", independent_review_requested: false, generation_quality_hash: null, claude_first_finding: null,
  approved_at: null, ...overrides,
});

describe("professor review queue", () => {
  it("puts only the professor stage into the decision queue, matching the dashboard count", () => {
    const rows = [row("ready"), row("no-run"), row("rules-fail"), row("needs-ai")];
    const runs = [run("ready"), run("rules-fail", { rules_verdict: "fail" }), run("needs-ai", { openai_response_id: null })];
    const decision = rows.filter((r) => professorQueueOf(r, runs) === "decision").map((r) => r.scenario_id);
    expect(decision).toEqual(["ready"]);
    expect(summarizeDashboardReviewStages(rows, runs).professor).toBe(decision.length);
    expect(reviewProgressLabel(rows[0], runs)).toBe("규칙 통과 · OpenAI 검토 완료 · 교수자 결정 대기");
    expect(reviewProgressLabel(rows[1], runs)).toBe("규칙 검사 전");
    expect(reviewProgressLabel(rows[2], runs)).toBe("규칙 검사 오류 · 수정 필요");
    expect(reviewProgressLabel(rows[3], runs)).toBe("규칙 통과 · OpenAI 검토 전");
  });

  it("sends content edited after the last run back to rule checking", () => {
    const edited = row("ready", { updated_at: "2026-09-03T00:00:00Z" });
    expect(professorQueueOf(edited, [run("ready")])).toBe("in_progress");
  });

  it("labels placements from one grouped lookup", () => {
    const grouped = groupAssignments([
      { outline_id: "c1", week_no: 3, scenario_id: "m1" },
      { outline_id: "c2", week_no: 5, scenario_id: "m1" },
      { outline_id: "c1", week_no: 4, scenario_id: "m2" },
    ]);
    const titles = new Map([["c1", "비즈니스 중국어"], ["c2", "통번역 실습"]]);
    expect(placementLabel(grouped.get("m1"), titles)).toBe("비즈니스 중국어 3주차 외 1곳");
    expect(placementLabel(grouped.get("m2"), titles)).toBe("비즈니스 중국어 4주차");
    expect(placementLabel(grouped.get("m3"), titles)).toBe("편성 전");
  });

  it("keeps mission version and trace visually distinct", () => {
    expect(missionVersionLabel("mission_v6")).toBe("Mission v6");
    expect(missionVersionLabel("mission_v5")).toBe("Mission v5");
    expect(missionVersionLabel(null)).toBeNull();
    expect(traceLabel("a84f21c9e0")).toBe("Trace a84f21c");
    expect(traceLabel("local-preview-not-stored")).toBeNull();
  });
});
