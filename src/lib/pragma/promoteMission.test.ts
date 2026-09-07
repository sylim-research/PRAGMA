import { describe, expect, it } from "vitest";

import {
  applyMissionRepairOperations,
  canPersistRepairQuality,
  candidateRetryAlreadyAttempted,
  candidateRegenerationFindings,
  qualityAfterCandidateRegeneration,
  repairFindingsForRuleViolations,
} from "./promoteMission";

describe("repairFindingsForRuleViolations", () => {
  it("routes only the violating R27 situation slot", () => {
    expect(repairFindingsForRuleViolations([
      {
        id: "R27",
        level: "fail",
        message: "문항 5: [slot:MJT5] Contrast Y situation_ko가 X 또는 A와 완전히 중복됨",
      },
      {
        id: "R27",
        level: "fail",
        message: "production_task: [slot:DCT] New Event C situation_ko가 X/A/Y 상황을 완전히 복제함",
      },
    ])).toEqual([
      expect.objectContaining({ code: "rule_R27_situation", where: "mpj_items[4].situation_ko" }),
      expect.objectContaining({ code: "rule_R27_situation", where: "production_task.situation_ko" }),
    ]);
  });

  it("does not route invariant failures such as R5 to item repair", () => {
    expect(repairFindingsForRuleViolations([{
      id: "R5",
      level: "fail",
      message: "문항 5: 현행 MultiJudge는 앵커 PDR에서 한 축만 바꾼 대비 상황이어야 함",
    }])).toEqual([]);
  });

  it("routes item-local band and diagnostic failures to their allowed blocks", () => {
    expect(repairFindingsForRuleViolations([
      {
        id: "R18",
        level: "fail",
        message: "문항 4: reason problem_band_code가 적정 대역임",
      },
      {
        id: "R33",
        level: "fail",
        message: "현행 mission_v5는 서로 다른 진단차원을 2~6개 포함해야 함",
      },
    ])).toEqual([
      expect.objectContaining({ code: "rule_R18_item", where: "mpj_items[3]" }),
      expect.objectContaining({ code: "rule_R33_diagnostics", where: "diagnostic_dimensions" }),
    ]);
  });
});

describe("candidate-level mission repair", () => {
  it("replaces only the selected situation string", () => {
    const original = {
      mpj_items: [
        { id: 1, type: "scale4", situation_ko: "X", target: "immutable" },
        { id: 2, type: "judge3", situation_ko: "A" },
      ],
      production_task: { situation_ko: "C", source_text: "immutable source" },
    };

    const patched = applyMissionRepairOperations(original, [
      { operation: "replace_situation", path: "mpj_items[0].situation_ko", situation_ko: "new X" },
      { operation: "replace_situation", path: "production_task.situation_ko", situation_ko: "new C" },
    ]);

    expect(patched.mpj_items).toEqual([
      { id: 1, type: "scale4", situation_ko: "new X", target: "immutable" },
      { id: 2, type: "judge3", situation_ko: "A" },
    ]);
    expect(patched.production_task).toEqual({ situation_ko: "new C", source_text: "immutable source" });
  });

  it("allows the initial boundary call plus only one stored-draft regeneration", () => {
    expect(candidateRetryAlreadyAttempted(1)).toBe(false);
    expect(candidateRetryAlreadyAttempted(2)).toBe(true);
    expect(candidateRetryAlreadyAttempted(3)).toBe(true);
  });

  it("changes only the targeted MJT3/MJT5 candidate and freezes answer metadata", () => {
    const original = {
      mpj_items: [
        { id: 1, type: "scale4" },
        { id: 2, type: "judge3" },
        {
          id: 3,
          type: "fix_choice",
          corrections: [
            { text: "fix-a", note_ko: "a", is_valid: true },
            { text: "fix-b", note_ko: "b", is_valid: false },
            { text: "fix-c", note_ko: "c", is_valid: false },
          ],
        },
        { id: 4, type: "reason" },
        {
          id: 5,
          type: "multi_judge",
          candidates: [
            { text: "multi-a", note_ko: "a", accepted_band_codes: ["within_band"] },
            { text: "multi-b", note_ko: "b", accepted_band_codes: ["too_low"] },
            { text: "multi-c", note_ko: "c", accepted_band_codes: ["within_band"] },
            { text: "multi-d", note_ko: "d", accepted_band_codes: ["too_high"] },
          ],
        },
      ],
      production_task: { reference_alternatives: [] },
    };

    const patched = applyMissionRepairOperations(original, [
      {
        operation: "replace_fix_choice_candidate",
        item_index: 2,
        candidate_index: 1,
        candidate: { text: "fix-b-new", note_ko: "b-new", is_valid: true },
      },
      {
        operation: "replace_multi_judge_candidate",
        item_index: 4,
        candidate_index: 3,
        candidate: { text: "multi-d-new", note_ko: "d-new", accepted_band_codes: ["within_band"] },
      },
    ]);

    const items = patched.mpj_items as Array<Record<string, unknown>>;
    const corrections = items[2].corrections as Array<Record<string, unknown>>;
    const candidates = items[4].candidates as Array<Record<string, unknown>>;
    expect(corrections[1]).toEqual({ text: "fix-b-new", note_ko: "b-new", is_valid: false });
    expect(corrections[0]).toEqual(original.mpj_items[2].corrections[0]);
    expect(corrections[2]).toEqual(original.mpj_items[2].corrections[2]);
    expect(candidates[3]).toEqual({
      text: "multi-d-new",
      note_ko: "d-new",
      accepted_band_codes: ["too_high"],
    });
    expect(candidates.slice(0, 3)).toEqual(original.mpj_items[4].candidates.slice(0, 3));
    expect(items[0]).toEqual(original.mpj_items[0]);
  });

  it("does not permit a critic-failing repair revision to be persisted", () => {
    expect(canPersistRepairQuality({
      verdict: "fail",
      summary_ko: "still failing",
      findings: [],
      model: "critic",
      prompt_version: "quality-test",
      checked_at: "2026-08-29T00:00:00.000Z",
    })).toBe(false);
  });

  it("routes only exact MJT3/MJT5 band or plausibility failures to regeneration", () => {
    const quality = {
      verdict: "fail" as const,
      summary_ko: "fail",
      findings: [
        { code: "band_mismatch", severity: "fail" as const, where: "mpj_items[2].corrections[1]", note_ko: "band" },
        { code: "implausible_distractor", severity: "fail" as const, where: "mpj_items[4].candidates[3].text", note_ko: "implausible" },
        { code: "band_mismatch", severity: "fail" as const, where: "mpj_items[1].target", note_ko: "not candidate" },
        { code: "unnatural_language", severity: "fail" as const, where: "mpj_items[2].corrections[2]", note_ko: "repair" },
      ],
      model: "critic",
      prompt_version: "quality-test",
      checked_at: "2026-08-29T00:00:00.000Z",
    };
    expect(candidateRegenerationFindings(quality).map((finding) => finding.where)).toEqual([
      "mpj_items[2].corrections[1]",
      "mpj_items[4].candidates[3].text",
    ]);
  });

  it("removes only regenerated candidate failures and preserves uncertainty as warning", () => {
    const quality = qualityAfterCandidateRegeneration({
      verdict: "fail",
      summary_ko: "before",
      findings: [
        { code: "band_mismatch", severity: "fail", where: "mpj_items[2].corrections[1]", note_ko: "old" },
        { code: "feedback_quality_mismatch", severity: "warning", where: "mpj_items[0].explanation_ko", note_ko: "keep" },
      ],
      model: "critic",
      prompt_version: "quality-test",
      checked_at: "2026-08-29T00:00:00.000Z",
    }, ["mpj_items[2].corrections[1]"], [{
      path: "mpj_items[2].corrections[1]",
      severity: "warning",
      actual_band_code: "uncertain",
      note_ko: "경계 불확실",
    }], {
      model: "candidate-critic",
      promptVersion: "candidate-v1",
      checkedAt: "2026-08-29T00:01:00.000Z",
      missionContentHash: "hash",
    });
    expect(quality.verdict).toBe("warning");
    expect(quality.findings).toEqual([
      expect.objectContaining({ code: "feedback_quality_mismatch", note_ko: "keep" }),
      expect.objectContaining({ code: "band_mismatch", severity: "warning", note_ko: expect.stringContaining("candidate_boundary_uncertain") }),
    ]);
  });

  it("keeps a newly detected stale explanation after the candidate itself passes", () => {
    const freshFinding = {
      code: "internal_inconsistency", severity: "fail" as const,
      where: "mpj_items[4].explanation_ko",
      note_ko: "교체된 후보에 없는 麻烦您을 있다고 설명합니다.",
    };
    const rechecked = {
      verdict: "fail" as const, summary_ko: "해설 모순", findings: [freshFinding],
      model: "full-critic", prompt_version: "quality-v20", checked_at: "2026-09-07",
    };
    const quality = qualityAfterCandidateRegeneration({
      ...rechecked, verdict: "pass", findings: [],
    }, ["mpj_items[4].candidates[3]"], [{
      path: "mpj_items[4].candidates[3]", severity: "pass",
    }], {
      model: "candidate-critic", promptVersion: "candidate-v1",
      checkedAt: "2026-09-07", missionContentHash: "revised-hash",
    }, rechecked);
    expect(quality.verdict).toBe("fail");
    expect(quality.findings).toContainEqual(freshFinding);
    expect(quality.prompt_version).toBe("quality-v20");
    expect(quality.mission_content_hash).toBe("revised-hash");
  });

  it("keeps an unrelated critical finding after the targeted candidate is resolved", () => {
    const quality = qualityAfterCandidateRegeneration({
      verdict: "fail",
      summary_ko: "before",
      findings: [
        { code: "band_mismatch", severity: "fail", where: "mpj_items[2].corrections[1]", note_ko: "candidate" },
        { code: "band_mismatch", severity: "fail", where: "mpj_items[1].target", note_ko: "non-target" },
      ],
      model: "critic",
      prompt_version: "quality-test",
      checked_at: "2026-08-29T00:00:00.000Z",
    }, ["mpj_items[2].corrections[1]"], [{
      path: "mpj_items[2].corrections[1]",
      severity: "pass",
    }], {
      model: "candidate-critic",
      promptVersion: "candidate-v1",
      checkedAt: "2026-08-29T00:01:00.000Z",
      missionContentHash: "hash",
    });
    expect(quality.verdict).toBe("fail");
    expect(quality.findings).toEqual([
      expect.objectContaining({ where: "mpj_items[1].target", severity: "fail" }),
    ]);
  });
});
