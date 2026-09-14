import { checkCore, checkMission, type CheckContext } from "./missionRules";
import { normalizeLearnerMission } from "./missionV6";
import { DEFAULT_FEATURE_BY_ACT, FEATURE_CODES_BY_ACT, getTargetFeature } from "./targetFeatures";
import { assembleLearnerCourse } from "@/lib/curriculum/learnerCourseProjection";
import { buildWeeklyCourseMaterial } from "@/lib/curriculum/weeklyMaterials";
import { weeklyInstructorContent } from "@/lib/curriculum/weeklyInstructorContent";
import { applyTeachingDraft } from "@/lib/curriculum/teachingGeneration";
import { teachingKind } from "../../../supabase/functions/_shared/teachingMaterial";
export { prepareTeachingMaterial } from "@/lib/curriculum/teachingGeneration";
import { weekRole } from "@/lib/curriculum/template";
import { weeklyOpeningContext } from "@/lib/curriculum/weeklyOpeningContext";
import { coreDirection } from "./coreSchema";
import { buildMissionLineageScope } from "./missionLineage";
import { LEVEL } from "./enums";
import { WEEKLY_LEARNING_CONTRACT } from "@/lib/curriculum/courseModePolicy";
import { CONTENT_REVIEW_VERSION, instructionalMission, type ReviewFinding, type ReviewResult } from "../../../supabase/functions/_shared/contentReview";
import { NATURAL_INTERPRETING_SCENE_RULE, SCENE_PLAUSIBILITY_RULE } from "../../../supabase/functions/_shared/learnerScene";

// This entry is bundled for Edge from the same rule/catalog/material functions
// as the app. No browser client, auth state, or model invocation.
export function buildContentReviewDomain(kind: string, source: Record<string, any>) {
  const findings: ReviewFinding[] = [];
  const add = (issue: string) => findings.push({ id: `rule-${findings.length + 1}`, severity: "fail", where: "", quote: null,
    issue_ko: issue, reason_ko: issue, suggestion_ko: "해당 콘텐츠 또는 편성을 수정한 후 다시 검사하세요.",
    problem_type_ko: "구조·형식", needs_professor: false, uncertainty_ko: "" });
  let content: Record<string, unknown>;
  let act: string | null;
  let dependencies: string[] = [];
  const isV6 = kind === "mission" && source.scenario?.mission_content?.schema_version === "mission_v6";
  if (kind === "mission") {
    const row = source.scenario;
    act = row.speech_act;
    const raw = row.mission_content;
    const parsed = normalizeLearnerMission(raw);
    if (!parsed.ok || !parsed.data) add("미션 스키마를 읽을 수 없습니다.");
    else {
      const context: CheckContext = { speech_act: row.speech_act, level: row.learner_level,
        domain: row.domain, theme_code: row.theme_code, topic_code: row.topic_code,
        industry: row.industry_sector, mode: row.mode, source_modality: row.source_modality,
        planned_target_feature: DEFAULT_FEATURE_BY_ACT[row.speech_act], direction: row.core_content?.direction ?? "ko_zh" };
      // Run the existing rules on the saved raw content, including provenance.
      // fail = 구조·계약 위반(수정 후 재검사). warning = 자동 규칙이 확정할 수 없는 신호이므로
      // 교수자 확인 대상으로 넘긴다 — 이전에는 전부 needs_professor=false로 소실됐다(2026-09-09).
      const checked = checkMission(raw, context, row.core_content);
      // Core warnings are not persisted with save_generated_core. Recompute them from
      // the current saved core; do not impose new-generation context_spec on legacy data.
      const coreWarnings = row.core_content
        ? checkCore(row.core_content, context).violations.filter((violation) => violation.level === "warning")
        : [];
      const violations = [
        ...checked.violations.map((violation, index) => ({ violation, id: `rule-${index + 1}`, where: "" })),
        ...coreWarnings.map((violation, index) => ({ violation, id: `rule-core-${index + 1}`, where: "/content/context/core_content" })),
      ];
      violations.forEach(({ violation, id, where }) => {
        const subrule = violation.evidence?.subrule;
        const isSignal = violation.level === "warning";
        findings.push({ id, severity: violation.level,
          where, quote: null, issue_ko: `${violation.id}${subrule ? `/${subrule}` : ""}: ${violation.message}`, reason_ko: violation.message,
          suggestion_ko: isSignal ? "자동 규칙의 신호입니다. 실제 위반인지 교수자가 판단하고 필요하면 수정하세요." : "기존 생성계약의 해당 규칙을 확인하세요.",
          problem_type_ko: isSignal ? "교수자 확인 신호" : "구조·형식", needs_professor: isSignal,
          uncertainty_ko: isSignal ? "정규식·집계 기반 신호이며 의미 판단이 아닙니다." : "" });
      });
      if (parsed.data.mpj_items.length !== 5) add("현재 채택 기준은 네이티브 MJT5+DCT1입니다. 과거 4문항 미션은 기록으로 보존합니다.");
    }
    const { mission_content: _mission, ...context } = row;
    content = { context: { ...context, core_content: instructionalMission(row.core_content ?? {}) }, mission: instructionalMission(raw ?? {}) };
  } else {
    const cores = source.scenarios.map((row: any) => ({ ...row,
      content_release_id: row.core_content?.generation?.content_release_id ?? row.content_release_id,
      direction: coreDirection(row.core_content),
      situation_ko: row.core_content?.situation_ko ?? "",
      source_text_ko: row.core_content?.source_text_ko ?? row.core_content?.source_text ?? "",
      opening_context: weeklyOpeningContext(row.core_content ?? {}),
    }));
    const course = assembleLearnerCourse({ outline: source.outline, weeks: [source.week], assignments: source.assignments, cores });
    const week = course.weeks[0];
    act = week.speech_act;
    const expected = act || weekRole(week.week_no) === "contextualization" ? 2 : 0;
    if (expected && week.scenarios.length !== expected) add(`완전한 공개 미션 ${expected}개를 편성한 뒤 주차 자료를 검수하세요.`);
    const draft = source.teaching_draft;
    const kind = teachingKind(week.week_no, week.type);
    let publicMaterial = buildWeeklyCourseMaterial(course.outline, week);
    let validDraft = false;
    if (draft) {
      try {
        if (!kind || (draft.source_config.workflow === "source" ? draft.source_config.outputKind : kind) !== draft.kind || draft.week_no !== week.week_no || draft.outline_id !== course.outline.id
          || source.teaching_current !== true) throw new Error("초안의 주차·근거가 현재 편성과 다릅니다.");
        publicMaterial = applyTeachingDraft(publicMaterial, draft);
        validDraft = true;
      } catch { add("생성 자료의 구성·주차·근거가 변경되었습니다. 현재 자료를 다시 준비하고 검토하세요."); }
    }
    if (!expected && week.scenarios.length === 0 && !validDraft) add("이 주차는 현재 계획 미리보기입니다. 완성된 학습자료로 승인하지 않습니다.");
    if (week.scenarios.length !== source.assignments.length) add("편성 중 미공개·누락 또는 수행모드가 다른 미션이 있습니다.");
    dependencies = week.scenarios.map((scenario) => scenario.scenario_id);
    if (validDraft) dependencies = [...new Set([...dependencies, ...(source.teaching_references ?? []).map((row: any) => row.scenario_id)])];
    content = {
      weekly_learning_contract: WEEKLY_LEARNING_CONTRACT,
      public_material: publicMaterial,
      instructor_only: { ...weeklyInstructorContent(week, course.outline.language_direction),
        ...(validDraft ? { generated_notes: draft.content.instructor_notes, source_materials: draft.sources,
          generation: { model: draft.provenance.model, prompt_version: draft.provenance.prompt_version,
            response_id: draft.provenance.response_id, input_hash: draft.provenance.input_hash, edited: Boolean(draft.provenance.edited) } } : {}) },
      reused_mission_explanations: dependencies.map((id) => ({ scenario_id: id,
        policy: "MJT·DCT 해설은 해당 미션 검수 원본을 재사용. 주차 승인 시 연결 미션의 현재 버전 승인도 확인." })),
    };
  }
  const featureCodes = act ? FEATURE_CODES_BY_ACT[act as keyof typeof FEATURE_CODES_BY_ACT] ?? [] : [];
  const snapshot = { content, criteria: { version: CONTENT_REVIEW_VERSION,
    // Rule corrections get a new content hash without replacing prior runs.
    rules_version: isV6 ? "mission_rules_v6_normal_approval_v1" : "mission_rules_v13_professor_signal_flow",
    ...(kind === "mission" ? { finalization: "mission_finalization_v1" } : {}),
    scene_policy: NATURAL_INTERPRETING_SCENE_RULE + SCENE_PLAUSIBILITY_RULE,
    mission_design: isV6
      ? "mission_v6 요청: scale4 → scale4+inline reason → fix_choice → free_correction → multi_judge → DCT. MJT 5개·MJT3 수정안 3개·MJT5 후보 4개는 이번 구현 계약이다. 원문의 의미·화행 목적·확정성·사실을 보존한다. MJT2는 판단 후 피드백 전에 문항 쟁점에 맞는 이유 하나를 선택하며, 정답 이유·설명 능력 점수·고정 오류 taxonomy가 아니다. MJT4의 선택적 contrast는 의미와 목적을 유지하고 맥락 조건 하나가 달라진 표현을 피드백으로만 보여준다. 공유 Anchor·relation-pair·적절 후보 유일성·band 분포를 요구하지 않는다. MJT5는 각 후보의 band를 독립 판단한다. A/B 실험·학습효과 검증 아님."
      : "MJT5+DCT1. 상황 topology는 X→A→A→A→Y→C이며 Anchor A를 MJT2·3·4가 공유함. A/B 실험·전이 효과 검증 아님.",
    features: featureCodes.map((code) => getTargetFeature(code)).filter(Boolean),
    scope: "수업에 채택할 현재 정적 콘텐츠 원본. 개별 학습자 실시간 피드백의 전수 감사는 포함하지 않음.",
  } };
  const rules: ReviewResult = { verdict: findings.some((f) => f.severity === "fail") ? "fail" : findings.length ? "warning" : "pass",
    summary_ko: kind === "mission" ? "현재 저장 미션에 기존 구조·형식 규칙 적용" : "현재 주차 편성·자료 구성 검사", findings };
  return { snapshot, rules, dependencies };
}

/** Data-only request shared with Edge. No browser client or model call here. */
export function missionFinalizationInput(row: Record<string, any>) {
  const featureCode = DEFAULT_FEATURE_BY_ACT[row.speech_act];
  if (!featureCode || !getTargetFeature(featureCode)) throw new Error("문항 판정 초점을 확인할 수 없습니다.");
  const direction = coreDirection(row.core_content) === "zh_ko" || row.language_direction === "zh_ko" ? "zh_ko" : "ko_zh";
  // Attribution runs only inside the current realization pack scope; other speech acts are marked
  // not_covered explicitly instead of attributing against an empty catalog (no placeholder pack id).
  const lineageScope = buildMissionLineageScope({ direction, speechAct: row.speech_act, targetFeature: featureCode });
  return {
    mission_content: row.mission_content,
    feature: lineageScope.coverage_status === "covered"
      ? { lineage_scope: lineageScope }
      : { lineage_coverage: "not_covered" as const },
    direction,
    learner_level: row.learner_level,
    level_ko: LEVEL[row.learner_level as keyof typeof LEVEL],
  };
}
