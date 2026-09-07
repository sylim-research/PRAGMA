import { describe, expect, it } from "vitest";

import {
  DASHBOARD_REVIEW_CRITERIA_VERSION,
  dominantDashboardReviewStage,
  isDashboardReviewTarget,
  nextDashboardReviewStage,
  summarizeDashboardAssignments,
  summarizeDashboardContent,
  summarizeDashboardReviewStages,
  countRulesFailures,
  summarizeAssignmentApproval,
  summarizeCourses,
  type DashboardReviewRunRow,
  type DashboardScenarioRow,
} from "@/lib/admin/adminDashboardMetrics";

const mission = (
  id: string,
  patch: Partial<DashboardScenarioRow> = {},
): DashboardScenarioRow => ({
  scenario_id: id,
  content_format: "scenario_core_v1",
  review_status: "needs_review",
  mission_status: "generated",
  mission_schema_version: "mission_v5",
  authoring_stage: null,
  updated_at: "2026-09-01T09:00:00.000Z",
  ...patch,
});

const run = (
  targetId: string,
  patch: Partial<DashboardReviewRunRow> = {},
): DashboardReviewRunRow => ({
  target_id: targetId,
  kind: "mission",
  criteria_version: DASHBOARD_REVIEW_CRITERIA_VERSION,
  rules_verdict: "pass",
  openai_response_id: null,
  claude_response_id: null,
  adjudication_response_id: null,
  created_at: "2026-09-01T10:00:00.000Z",
  // 기본은 이전 정책 — 네 단계를 모두 거친다. 경량 검수는 아래 별도 케이스.
  approval_policy: "multimodel_v2",
  independent_review_requested: false,
  generation_quality_hash: null,
  claude_first_finding: null,
  approved_at: null,
  ...patch,
});

describe("admin dashboard metrics", () => {
  it("separates cores, generated missions, review targets, and five-stage finalization", () => {
    const rows = [
      mission("core-only", { mission_status: null, mission_schema_version: null }),
      mission("pending"),
      mission("revision", { review_status: "revise_required" }),
      mission("finalized", {
        mission_status: "reviewed",
        authoring_stage: "professor_finalized",
      }),
      mission("legacy-reviewed", {
        mission_status: "reviewed",
        authoring_stage: "legacy",
      }),
      mission("legacy-format", { content_format: "legacy_v1" }),
    ];

    expect(summarizeDashboardContent(rows)).toEqual({
      coreCount: 5,
      generatedMissionCount: 4,
      reviewTargetCount: 1,
      professorFinalizedCount: 1,
      // 「수정 필요」 1 + 최종 승인 없는 옛 reviewed 1 — 생성 4 = 대상 1 + 승인 1 + 나머지 2
      pendingRevisionCount: 2,
    });
    expect(isDashboardReviewTarget(rows[1])).toBe(true);
    expect(isDashboardReviewTarget(rows[2])).toBe(false);
  });

  it("places each review target in exactly one next-action stage", () => {
    const rows = ["rules", "rule-fail", "openai", "claude", "adjudication", "professor"]
      .map((id) => mission(id));
    const runs = [
      run("rule-fail", { rules_verdict: "fail" }),
      run("openai"),
      run("claude", { openai_response_id: "openai-response" }),
      run("adjudication", { openai_response_id: "openai-response", claude_response_id: "claude-response" }),
      run("professor", {
        openai_response_id: "openai-response",
        claude_response_id: "claude-response",
        adjudication_response_id: "adjudication-response",
      }),
    ];

    const counts = summarizeDashboardReviewStages(rows, runs);
    expect(counts).toEqual({ rules: 2, openai: 1, claude: 1, adjudication: 1, professor: 1 });
    expect(Object.values(counts).reduce((sum, value) => sum + value, 0)).toBe(rows.length);
    expect(dominantDashboardReviewStage(counts)).toBe("rules");
    expect(dominantDashboardReviewStage({ rules: 0, openai: 0, claude: 0, adjudication: 0, professor: 0 })).toBeNull();
  });

  it("경량 검수(focused_v1)는 AI 검토 1회 뒤 곧바로 교수자로 가고, 추가 검토는 선택했을 때만 거친다", () => {
    const row = mission("m");
    const focused = (patch: Partial<DashboardReviewRunRow>) =>
      nextDashboardReviewStage(row, [run("m", { approval_policy: "focused_v1", ...patch })]);

    // 생성 품질 결과를 재사용할 수 있으면 AI 검토를 다시 부르지 않고 교수자로 간다.
    expect(focused({ generation_quality_hash: "hash-1" })).toBe("professor");
    // 재사용할 것이 없으면 AI 검토 1회.
    expect(focused({})).toBe("openai");
    expect(focused({ openai_response_id: "o" })).toBe("professor");
    // 추가 검토를 선택한 경우에만 Claude → (의견이 있을 때만) 재검토 → 교수자.
    expect(focused({ openai_response_id: "o", independent_review_requested: true })).toBe("claude");
    expect(focused({ openai_response_id: "o", independent_review_requested: true, claude_response_id: "c", claude_first_finding: "f1" }))
      .toBe("adjudication");
    expect(focused({ openai_response_id: "o", independent_review_requested: true, claude_response_id: "c", claude_first_finding: null }))
      .toBe("professor");
    expect(focused({ openai_response_id: "o", independent_review_requested: true, claude_response_id: "c", claude_first_finding: "f1", adjudication_response_id: "a" }))
      .toBe("professor");
    // 규칙 검사 fail은 정책과 무관하게 규칙 검사로 남는다.
    expect(focused({ rules_verdict: "fail", generation_quality_hash: "hash-1" })).toBe("rules");
  });

  it("규칙 검사 칸 안에서 검사 실패 수를 따로 센다", () => {
    const rows = ["never", "failed", "passed"].map((id) => mission(id));
    const runs = [run("failed", { rules_verdict: "fail" }), run("passed", { openai_response_id: "o" })];
    expect(summarizeDashboardReviewStages(rows, runs).rules).toBe(2);
    expect(countRulesFailures(rows, runs)).toBe(1);
  });

  it("편성된 미션을 승인 완료와 승인 전으로 나눈다 — 표에 없는 미션은 승인 전이다", () => {
    const scenarios = [
      mission("approved", { mission_status: "reviewed", authoring_stage: "professor_finalized" }),
      mission("pending"),
    ];
    const assignments = [
      { outline_id: "a", week_no: 1, scenario_id: "approved" },
      { outline_id: "b", week_no: 2, scenario_id: "approved" },
      { outline_id: "a", week_no: 3, scenario_id: "pending" },
      { outline_id: "a", week_no: 4, scenario_id: "unknown" },
    ];
    expect(summarizeAssignmentApproval(assignments, scenarios))
      .toEqual({ approvedMissionCount: 1, unapprovedMissionCount: 2 });
  });

  it("교과목은 공개(published)와 비공개로 나눈다", () => {
    expect(summarizeCourses([{ status: "published" }, { status: "draft" }, { status: null }, { status: "published" }]))
      .toEqual({ total: 4, published: 2, unpublished: 2 });
    expect(summarizeCourses([])).toEqual({ total: 0, published: 0, unpublished: 0 });
  });

  it("returns edited content to R inspection instead of reusing a stale run", () => {
    const row = mission("edited", {
      updated_at: "2026-09-01T11:00:00.000Z",
    });
    const stale = run("edited", {
      created_at: "2026-09-01T10:00:00.000Z",
      openai_response_id: "openai-response",
      claude_response_id: "claude-response",
      adjudication_response_id: "adjudication-response",
    });
    expect(nextDashboardReviewStage(row, [stale])).toBe("rules");
  });

  it("counts assignment rows, distinct missions, and distinct course weeks separately", () => {
    expect(summarizeDashboardAssignments([
      { outline_id: "a", week_no: 1, scenario_id: "m1" },
      { outline_id: "a", week_no: 1, scenario_id: "m2" },
      { outline_id: "a", week_no: 2, scenario_id: "m1" },
      { outline_id: "b", week_no: 1, scenario_id: "m3" },
    ])).toEqual({ assignmentCount: 4, missionCount: 3, weekCount: 3, courseCount: 2 });
  });

  it("교과목은 배정이 있는 것만 센다 — 같은 미션을 공유해도 교과목은 따로 센다", () => {
    expect(summarizeDashboardAssignments([
      { outline_id: "a", week_no: 1, scenario_id: "m1" },
      { outline_id: "b", week_no: 1, scenario_id: "m1" },
      { outline_id: "c", week_no: 3, scenario_id: "m1" },
    ])).toEqual({ assignmentCount: 3, missionCount: 1, weekCount: 3, courseCount: 3 });
    expect(summarizeDashboardAssignments([]))
      .toEqual({ assignmentCount: 0, missionCount: 0, weekCount: 0, courseCount: 0 });
  });
});
