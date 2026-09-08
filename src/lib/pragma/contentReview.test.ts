import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { buildContentReviewDomain } from "./contentReviewDomain";
import { buildReviewPrompt, instructionalMission, materializeReviewEvidence, nextReviewStage, professorDecisionsComplete, professorReviewFindings, reusableGenerationQuality, reviewHash, validateAdjudication, validateReviewResult,
  type ContentReviewRun, type ReviewResult } from "../../../supabase/functions/_shared/contentReview";
import { callContentReviewer } from "../../../supabase/functions/_shared/contentReviewProvider";
import { REFUSAL_TEACHING_CASE } from "@/lib/curriculum/refusalTeachingCase";
import { CURRENT_CONTENT_RELEASE_ID, CURRENT_MISSION_QUALITY_PROMPT_VERSION } from "../../../supabase/functions/_shared/contentRelease";

const snapshot = { content: { source: "请您参加活动。" }, criteria: { version: "test" } };
const finding = { severity: "warning", where: "/content/source", quote: "请您参加活动。", issue_ko: "지적", reason_ko: "이유", suggestion_ko: "제안",
  problem_type_ko: "화용적 적절성", needs_professor: true, uncertainty_ko: "수업 맥락에 따라 달라질 수 있음" };
const audit = validateReviewResult({ verdict: "warning", summary_ko: "확인", findings: [finding] }, snapshot, "claude");
const run = () => ({ id: "test", snapshot, rules: { verdict: "pass", findings: [], summary_ko: "규칙" },
  openai_review: { result: { verdict: "pass", summary_ko: "OPENAI_PRIVATE_VERDICT", findings: [] } },
  claude_review: { result: audit }, adjudication: null, approved_at: null, professor_decisions: [],
} as unknown as ContentReviewRun);
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  // The Edge runtime supplies timeout; jsdom 20 does not. Transport is mocked.
  vi.stubGlobal("AbortSignal", { timeout: () => new AbortController().signal });
});
afterEach(() => vi.unstubAllGlobals());

describe("current content five-stage review", () => {
  it("reuses matching generation evidence and makes additional models opt-in", () => {
    const hash = "a".repeat(64);
    const quality = { verdict: "pass", findings: [], summary_ko: "완료", model: "gpt-4.1", prompt_version: CURRENT_MISSION_QUALITY_PROMPT_VERSION,
      checked_at: "2026-09-06T00:00:00Z", mission_content_hash: hash };
    const evidence = reusableGenerationQuality({ provenance: {mission_content_hash: hash}, quality_check: quality });
    expect(evidence).not.toBeNull();
    expect(reusableGenerationQuality({ provenance: {mission_content_hash: "b".repeat(64)}, quality_check: quality })).toBeNull();
    expect(reusableGenerationQuality({ provenance: {mission_content_hash: hash}, quality_check: { ...quality, prompt_version: "quality_v18_zhko_bidirectional_fidelity" } })).toBeNull();
    const focused = {...run(), approval_policy: "focused_v1" as const, generation_quality: evidence,
      openai_review: null, claude_review: null};
    expect(nextReviewStage(focused)).toBe("professor");
    expect(nextReviewStage({...focused, independent_review_requested: true})).toBe("claude");
    expect(nextReviewStage({...focused, independent_review_requested: true, claude_review: run().claude_review})).toBe("adjudication");
    expect(nextReviewStage({...focused, generation_quality: null})).toBe("openai");
  });
  it("keeps critical and uncertain findings from both models for human decisions", () => {
    const original = run();
    const focused = {...original, approval_policy: "focused_v1" as const,
      openai_review: {...original.openai_review!, result: {verdict:"fail" as const, summary_ko:"문제",
        findings:[{...audit.findings[0],id:"openai-1",severity:"fail" as const,needs_professor:false},
          {...audit.findings[0],id:"openai-2",needs_professor:false}]}}};
    expect(professorReviewFindings(focused).map(f=>f.id)).toEqual(["openai-1","claude-1"]);
    expect(focused.openai_review.result.findings).toHaveLength(2);
  });
  it("keeps Claude independent and excludes OpenAI's first judgment from adjudication", () => {
    const independent = buildReviewPrompt("claude", snapshot, run());
    expect(independent.user).not.toContain("OPENAI_PRIVATE_VERDICT");
    expect(independent.user).not.toContain("claude-1");
    const reconsider = buildReviewPrompt("adjudication", snapshot, run());
    expect(reconsider.user).not.toContain("OPENAI_PRIVATE_VERDICT");
    expect(JSON.parse(reconsider.user)).toEqual({ snapshot, claude_review: audit });
  });

  it("requires exactly one reasoned disposition per Claude finding, including rejection", () => {
    const decision = { finding_id: "claude-1", decision: "reject", rationale_ko: "원문에 참여 행위가 명시됨", proposed_change_ko: "", needs_professor: true,
      evidence_path: "/content/source", evidence_quote: "参加活动" };
    expect(validateAdjudication({ summary_ko: "확인", decisions: [decision] }, audit, snapshot).decisions[0].decision).toBe("reject");
    for (const decisions of [[], [decision, decision], [{ ...decision, finding_id: "invented" }], [{ ...decision, rationale_ko: "" }]]) {
      expect(() => validateAdjudication({ summary_ko: "확인", decisions }, audit, snapshot)).toThrow();
    }
    expect(audit.findings[0].issue_ko).toBe("지적");
    const { evidence_quote: _quote, ...wireDecision } = decision;
    const restored = materializeReviewEvidence({ summary_ko: "확인", decisions: [wireDecision] }, snapshot, true);
    expect(validateAdjudication(restored, audit, snapshot).decisions[0].evidence_quote).toBe(snapshot.content.source);
  });

  it("rejects invented evidence and inconsistent pass verdicts", () => {
    expect(() => validateReviewResult({ verdict: "warning", summary_ko: "확인", findings: [{ ...finding, quote: "없는 원문" }] }, snapshot, "claude")).toThrow();
    expect(() => validateReviewResult({ verdict: "warning", summary_ko: "확인", findings: [{ ...finding, where: "/content/missing" }] }, snapshot, "claude")).toThrow();
    expect(() => validateReviewResult({ verdict: "pass", summary_ko: "확인", findings: [finding] }, snapshot, "claude")).toThrow();
    for (const incomplete of [{ ...finding, problem_type_ko: "" }, { ...finding, needs_professor: undefined }, { ...finding, uncertainty_ko: "" }]) {
      expect(() => validateReviewResult({ verdict: "warning", summary_ko: "확인", findings: [incomplete] }, snapshot, "claude")).toThrow();
    }
    expect(audit.findings[0]).toMatchObject({ problem_type_ko: "화용적 적절성", needs_professor: true, uncertainty_ko: finding.uncertainty_ko });
  });

  it("allows recorded revision or defer but requires every finding cleared for approval", () => {
    const decision = { finding_id: "claude-1", decision: "no_change" as const, rationale_ko: "원문과 수업 맥락을 확인하여 사용 가능" };
    expect(professorDecisionsComplete(audit.findings, [decision], true)).toBe(true);
    for (const value of ["revision_required", "defer"] as const) {
      expect(professorDecisionsComplete(audit.findings, [{ ...decision, decision: value }])).toBe(true);
      expect(professorDecisionsComplete(audit.findings, [{ ...decision, decision: value }], true)).toBe(false);
    }
    for (const decisions of [[], [{ ...decision, finding_id: "unknown" }], [{ ...decision, rationale_ko: "짧음" }]]) {
      expect(professorDecisionsComplete(audit.findings, decisions)).toBe(false);
    }
    expect(professorDecisionsComplete([...audit.findings, { ...audit.findings[0], id: "claude-2" }], [decision, decision])).toBe(false);
    expect(professorDecisionsComplete([], [], true)).toBe(true);
  });

  it("hashes instructional changes but not finalization metadata or object key order", async () => {
    const first = { mpj_items: [{ text: "초안" }], production_task: { source: "원문" }, authoring: { stage: "draft" } };
    const final = { ...first, authoring: { stage: "professor_finalized" }, item_lineage: { data: "attribution" } };
    expect(await reviewHash(instructionalMission(first))).toBe(await reviewHash(instructionalMission(final)));
    expect(await reviewHash({ b: 2, a: 1 })).toBe(await reviewHash({ a: 1, b: 2 }));
    expect(await reviewHash(instructionalMission(first))).not.toBe(await reviewHash(instructionalMission({ ...first, mpj_items: [{ text: "수정" }] })));
  });

  it("does not infer professor approval from model completion", () => {
    expect(nextReviewStage(null)).toBe("rules");
    expect(nextReviewStage({ ...run(), openai_review: null, claude_review: null })).toBe("openai");
    expect(nextReviewStage({ ...run(), claude_review: null })).toBe("claude");
    expect(nextReviewStage(run())).toBe("adjudication");
    expect(nextReviewStage({ ...run(), adjudication: { result: {} } as any })).toBe("professor");
  });

  it("covers raw MPJ5, DCT and core while stripping prior critic findings", () => {
    const domain = buildContentReviewDomain("mission", { scenario: { speech_act: "request", learner_level: "intermediate", mode: "translation",
      core_content: { situation_ko: "상황", quality_check: { summary: "CORE_PRIOR_JUDGMENT" } },
      mission_content: { ...SAMPLE_MISSION_V5_NATIVE, quality_check: { summary: "MISSION_PRIOR_JUDGMENT" } },
    } });
    expect(JSON.stringify(domain.snapshot)).not.toContain("PRIOR_JUDGMENT");
    const content = domain.snapshot.content as any;
    expect(content.mission.mpj_items).toHaveLength(5);
    expect(content.mission.production_task).toEqual(SAMPLE_MISSION_V5_NATIVE.production_task);
    expect(content.context.core_content.situation_ko).toBe("상황");
    for (const stage of ["openai", "claude", "adjudication"] as const) {
      const prompt = buildReviewPrompt(stage, domain.snapshot, run());
      const properties = prompt.schema.properties as any;
      const paths = stage === "adjudication" ? properties.decisions.items.properties.evidence_path.enum : properties.findings.items.properties.where.enum;
      expect(paths).toEqual(expect.arrayContaining(["/content/context/core_content", "/content/mission/mpj_items/0", "/content/mission/mpj_items/4", "/content/mission/production_task", "/criteria"]));
      expect(paths).not.toContain("/content/context/mission/mpj_items/1");
      for (const where of paths) expect(() => validateReviewResult({ verdict: "warning", summary_ko: "누락 확인", findings: [{ ...finding, where, quote: null }] }, domain.snapshot, "claude")).not.toThrow();
      expect(() => validateReviewResult({ verdict: "warning", summary_ko: "잘못된 경로", findings: [{ ...finding, where: "/content/context/mission/mpj_items/1", quote: null }] }, domain.snapshot, "claude")).toThrow("콘텐츠에 없는 근거 경로");
    }
  });

  it("versions the corrected rules in the snapshot without replacing earlier review hashes", async () => {
    const domain = buildContentReviewDomain("mission", { scenario: { speech_act: "request", learner_level: "intermediate", mode: "translation",
      core_content: {}, mission_content: SAMPLE_MISSION_V5_NATIVE,
    } });
    const { rules_version, ...previousCriteria } = domain.snapshot.criteria;
    expect(rules_version).toBe("mission_rules_v11_persisted_contract");
    expect(await reviewHash(domain.snapshot)).not.toBe(await reviewHash({
      ...domain.snapshot, criteria: previousCriteria,
    }));
  });

  it("blocks incomplete weeks and reviews shared original plus unique private notes", () => {
    const source = { outline: { id: "course", title: "수업", level: "intermediate", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0 },
      week: { week_no: 2, title: "요청", type: "regular", speech_act: "request", can_do: ["학습목표"] },
      assignments: [{ scenario_id: "m1", week_no: 2, position: 0 }],
      scenarios: [{ scenario_id: "m1", speech_act: "request", learner_level: "intermediate", mission_status: "reviewed", content_release_id: CURRENT_CONTENT_RELEASE_ID,
        mode: "translation", core_content: { situation_ko: "상황입니다.", source_text: "원문" } }],
    };
    const domain = buildContentReviewDomain("weekly_material", source);
    expect(domain.rules.verdict).toBe("fail");
    const content = domain.snapshot.content as any;
    expect(content.public_material.sections.find((section: any) => section.id === "goals").items).toContain("학습목표");
    expect(content.instructor_only.features.length).toBeGreaterThan(0);
    expect(content.public_material).not.toHaveProperty("instructor_only");
    expect(domain.dependencies).toEqual(["m1"]);
    const paths = (buildReviewPrompt("claude", domain.snapshot).schema.properties.findings as any).items.properties.where.enum;
    expect(paths).toEqual(expect.arrayContaining(["/content/public_material", "/content/instructor_only"]));
    expect(paths).not.toContain("/content/mission/mpj_items/0");
  });

  it("hashes the selected refusal teaching case in private review content without exposing it publicly", async () => {
    const example = REFUSAL_TEACHING_CASE;
    const domain = buildContentReviewDomain("weekly_material", {
      outline: { id: "course", title: "수업", level: "intermediate", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0 },
      week: { week_no: 6, title: "거절", type: "regular", speech_act: "refusal", can_do: [] },
      assignments: [{ scenario_id: example.scenarioId, week_no: 6, position: 0 }],
      scenarios: [{ scenario_id: example.scenarioId, learner_level: "intermediate", speech_act: "refusal", mission_status: "reviewed", content_release_id: CURRENT_CONTENT_RELEASE_ID, mode: "translation",
        core_content: { situation_ko: example.situationKo, source_text_ko: example.sourceText } }],
    });
    const content = domain.snapshot.content as any;
    expect(content.instructor_only.missionCases).toEqual([example]);
    expect(JSON.stringify(content.public_material)).not.toContain(example.title);
    expect(content.public_material.sections.find((section: any) => section.id === `mission-${example.scenarioId}`).paragraphs).toEqual([example.situationKo]);
    const { missionCases: _cases, ...previousNotes } = content.instructor_only;
    expect(await reviewHash(domain.snapshot)).not.toBe(await reviewHash({ ...domain.snapshot,
      content: { ...content, instructor_only: previousNotes },
    }));
    expect(domain.rules.verdict).toBe("fail"); // 1/2 편성 상태를 완료로 바꾸지 않는다.
    expect(domain.dependencies).toEqual([example.scenarioId]);
  });

  it("중한 통번역 주차의 두 모드를 검토하고 이전 계약 해시와 구분한다", async () => {
    const source = { outline: { id: "course", title: "수업", level: "intermediate",
      language_direction: "zh_ko", course_mode: "mixed", target_interpreting_week_count: 3 },
      week: { week_no: 2, title: "요청", type: "regular", speech_act: "request", can_do: ["학습목표"] },
      assignments: [{ scenario_id: "t", week_no: 2, position: 0 }, { scenario_id: "i", week_no: 2, position: 1 }],
      scenarios: ["translation", "stt_interpreting"].map((mode, index) => ({
        scenario_id: index ? "i" : "t", speech_act: "request", learner_level: "intermediate",
        mission_status: "reviewed", content_release_id: CURRENT_CONTENT_RELEASE_ID, mode, domain: "school",
        core_content: { direction: "zh_ko", situation_ko: index ? "구두 요청 상황" : "서면 요청 상황",
          source_text: index ? "请您再说一遍。" : "请您确认一下。",
          channel: index ? "facetoface" : "email", pdr: { p: "equal", d: "close", r: "low" } },
      })),
    };
    const domain = buildContentReviewDomain("weekly_material", source);
    expect(domain.rules.verdict).toBe("pass");
    expect(domain.dependencies).toEqual(["t", "i"]);
    const content = domain.snapshot.content as any;
    expect(content.public_material.missions.map((mission: any) => mission.label))
      .toEqual(["미션 1 · 번역", "미션 2 · 통역"]);
    const { weekly_learning_contract, ...oldContent } = content;
    expect(weekly_learning_contract).toBe("speech-act-translation-interpreting-v1");
    expect(await reviewHash(domain.snapshot)).not.toBe(await reviewHash({ ...domain.snapshot, content: oldContent }));
    const invalid = buildContentReviewDomain("weekly_material", { ...source,
      scenarios: source.scenarios.map((scenario) => ({ ...scenario, mode: "translation" })) });
    expect(invalid.rules.verdict).toBe("fail");
    expect(invalid.dependencies).toEqual([]);
  });

  it("excludes the retired opening from weekly review while preserving material and assignment checks", async () => {
    const source = { outline: { id: "course", title: "수업", level: "intermediate", domain: "school", language_direction: "ko_zh", course_mode: "translation", target_interpreting_week_count: 0 },
      week: { week_no: 13, title: "고부담 맥락 집중 실전", type: "regular", speech_act: "request", can_do: [] },
      assignments: [{ scenario_id: "m1", week_no: 13, position: 0 }],
      scenarios: [{ scenario_id: "m1", learner_level: "intermediate", speech_act: "request", mission_status: "reviewed", content_release_id: CURRENT_CONTENT_RELEASE_ID,
        mode: "translation", domain: "school",
        core_content: { situation_ko: "PRIVATE_SCENE", source_text_ko: "PRIVATE_SOURCE", channel: "email", pdr: { p: "speaker_lower", d: "distant", r: "low" } } }],
    };
    const domain = buildContentReviewDomain("weekly_material", source);
    const content = domain.snapshot.content as any;
    expect(content.public_material).not.toHaveProperty("opening");
    expect(JSON.stringify(content.public_material)).toContain("PRIVATE_SCENE");
    expect(JSON.stringify(content.public_material)).toContain("선택한 화행");
    const hash = await reviewHash(domain.snapshot);
    const legacyMaterial = { ...content.public_material, opening: { version: "weekly-opening-v1" } };
    expect(hash).not.toBe(await reviewHash({ ...domain.snapshot, content: { ...content, public_material: legacyMaterial } }));
    expect(domain.rules.verdict).toBe("fail"); // 도입 제거 뒤에도 미션 한 개 편성을 승인하지 않는다.
  });

  it("saves successful provider metadata and never silently retries truncation or refusal", async () => {
    const output: ReviewResult = { verdict: "pass", summary_ko: "지적 없음", findings: [] };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "reply-1", model: "gpt-test", usage: { total_tokens: 123 },
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }] })));
    const result = await callContentReviewer({ stage: "openai", run: run(), apiKey: "test", model: "gpt-test", fetcher });
    expect(result.response_id).toBe("reply-1");
    expect(result.input_hash).toMatch(/^[0-9a-f]{64}$/);
    for (const stop_reason of ["max_tokens", "refusal"]) {
      fetcher.mockResolvedValue(new Response(JSON.stringify({ id: "c", model: "claude-test", stop_reason, content: [] })));
      await expect(callContentReviewer({ stage: "claude", run: run(), apiKey: "test", model: "claude-test", fetcher })).rejects.toThrow();
    }
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("records the bounded Opus request and accepts text alongside thinking blocks", async () => {
    const { quote: _quote, ...wireFinding } = finding;
    const output = { verdict: "warning", summary_ko: "확인", findings: [wireFinding] };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "claude-reply", model: "claude-opus-5",
      stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 200 },
      content: [{ type: "thinking", thinking: "private" }, { type: "text", text: JSON.stringify(output) }],
    })));
    const result = await callContentReviewer({ stage: "claude", run: run(), apiKey: "test", model: "claude-opus-5", fetcher });
    const request = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(request.output_config.effort).toBe("medium");
    expect(request.output_config.format.schema.properties.findings.items.properties).not.toHaveProperty("quote");
    expect(request.output_config.format.schema.properties.findings.items.properties.where.enum).toContain("/content/source");
    expect(request.messages[0].content).not.toContain("OPENAI_PRIVATE_VERDICT");
    expect(result).toMatchObject({ result: { ...output, findings: [{ ...finding, id: "claude-1" }] }, raw_result: output,
      prompt_version: "content_review_v2:claude", output_format_version: "evidence_refs_v2", model: "claude-opus-5", usage: { input_tokens: 100, output_tokens: 200 },
      request_parameters: { max_tokens: 7000, timeout_ms: 130_000, effort: "medium" } });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("copies exact evidence without rewriting model findings or accepting nonexistent paths", () => {
    const source = { content: { "a/b~c": "첫 줄\n第二行", count: 2 } };
    const raw = { verdict: "warning", summary_ko: "확인", findings: [{ ...finding, where: "/content/a~1b~0c" }] };
    const before = JSON.stringify(raw);
    const restored = validateReviewResult(materializeReviewEvidence(raw, source, false), source, "claude");
    expect(restored.findings[0]).toMatchObject({ where: "/content/a~1b~0c", quote: "첫 줄\n第二行", issue_ko: finding.issue_ko, reason_ko: finding.reason_ko });
    expect(JSON.stringify(raw)).toBe(before);
    expect(() => materializeReviewEvidence({ ...raw, findings: [{ ...finding, where: "/missing" }] }, source, false)).toThrow("콘텐츠에 없는 근거 경로");
  });

  it.each(["connection", "body"])("reports a %s timeout without retrying the provider", async (phase) => {
    const controller = new AbortController();
    vi.stubGlobal("AbortSignal", { timeout: () => controller.signal });
    const expire = () => { controller.abort(); throw new DOMException("Signal timed out", "TimeoutError"); };
    const fetcher = vi.fn().mockImplementation(async () => {
      if (phase === "connection") return expire();
      return { ok: true, json: async () => expire() };
    });
    await expect(callContentReviewer({ stage: "claude", run: run(), apiKey: "test", model: "claude-opus-5", fetcher }))
      .rejects.toThrow("Claude 응답 대기 130초를 초과했습니다. 이전 단계 결과는 보존되며 자동 재호출은 없습니다.");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
