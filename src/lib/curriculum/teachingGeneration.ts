import { assembleLearnerCourse } from "./learnerCourseProjection";
import { buildWeeklyCourseMaterial, type WeeklyCourseMaterial } from "./weeklyMaterials";
import { coreDirection } from "@/lib/pragma/coreSchema";
import { isCurrentMissionReleasedForLearner } from "@/lib/mission/missionRelease";
import { instructionalMission } from "../../../supabase/functions/_shared/contentReview";
import { buildTeachingPrompt, teachingKind, validateTeachingContent, validateTeachingSources, validateTeachingEvidence,
  type TeachingConfig, type TeachingDraft, type TeachingSource } from "../../../supabase/functions/_shared/teachingMaterial";

/** Database-supplied context only; no learner answers are requested or sent to a model. */
export function prepareTeachingMaterial(context: Record<string, any>, config: TeachingConfig) {
  const base = context.base;
  // Saved scenarios keep the release in core_content.generation, as the Composer does.
  const releasedSource = (row: any) => ({ ...row,
    content_release_id: row.core_content?.generation?.content_release_id ?? row.content_release_id,
  });
  const defaultKind = teachingKind(base.week.week_no, base.week.type);
  if (!defaultKind) throw new Error("이 주차는 수업자료·토론 생성 대상이 아닙니다.");
  const sourceWorkflow = config.workflow === "source";
  const inputs = sourceWorkflow ? validateTeachingSources(config) : [];
  const kind = sourceWorkflow ? config.outputKind! : defaultKind;
  if (!Array.isArray(config.missionIds) || (!sourceWorkflow && !config.missionIds.length) || config.missionIds.length > 6
    || new Set(config.missionIds).size !== config.missionIds.length
    || context.references.length !== config.missionIds.length) throw new Error("해당 학습 범위의 승인된 편성 미션을 선택해 주세요.");
  if (context.references.some((row: any) => !isCurrentMissionReleasedForLearner(releasedSource(row)) || !row.mission_content
    || coreDirection(row.core_content) !== base.outline.language_direction || row.learner_level !== base.outline.level)) {
    throw new Error("근거 미션의 승인·수준·언어방향을 확인해 주세요.");
  }
  if (typeof config.extraText !== "string" || typeof config.extraRef !== "string"
    || config.extraText.length > 12000 || config.extraRef.length > 500
    || (config.extraText.trim().length > 0) !== (config.extraRef.trim().length > 0)) {
    throw new Error("추가 원자료는 본문과 출처를 함께 입력해 주세요. 본문 한도는 12,000자입니다.");
  }
  const cores = base.scenarios.map((row: any) => ({ ...releasedSource(row), direction: coreDirection(row.core_content),
    situation_ko: row.core_content?.situation_ko ?? "", source_text_ko: row.core_content?.source_text_ko ?? row.core_content?.source_text ?? "" }));
  const course = assembleLearnerCourse({ outline: base.outline, weeks: [base.week], assignments: base.assignments, cores });
  const week = course.weeks[0];
  if (sourceWorkflow && defaultKind === "lesson" && !week.speech_act) throw new Error("먼저 주차 편성에서 이 주차의 화행을 선택해 주세요.");
  if (!sourceWorkflow && kind === "lesson" && (week.scenarios.length !== 2 || config.missionIds.length !== 2
    || week.scenarios.some((item) => !config.missionIds.includes(item.scenario_id)))) {
    throw new Error("수업자료는 해당 주차의 완전한 미션 2개를 편성한 뒤 생성합니다. 13주는 화행도 선택해 주세요.");
  }
  const material = buildWeeklyCourseMaterial(course.outline, week);
  const sources: TeachingSource[] = [...context.references].sort((a, b) => a.scenario_id.localeCompare(b.scenario_id))
    .map((row, i) => ({ id: `M${i + 1}`, label: `${row.week_no}주차 · ${row.mode === "stt_interpreting" ? "통역" : "번역"} 미션`,
      text: JSON.stringify({ scenario_id: row.scenario_id, speech_act: row.speech_act,
        core: instructionalMission(row.core_content ?? {}), mission: instructionalMission(row.mission_content ?? {}) }) }));
  if (config.extraText.trim()) sources.push({ id: "S1", label: config.extraRef, text: config.extraText });
  if (sourceWorkflow && (config.extraText || config.extraRef)) throw new Error("추가 자료는 소스 목록에 등록해 주세요.");
  sources.push(...inputs.map(s => ({ ...s, label: `${s.label} · ${s.ref}` })));
  const scopeWeeks = base.scope_weeks ?? [];
  const speechActs = defaultKind === "lesson" ? [week.speech_act]
    : [...new Set(scopeWeeks.map((w: any) => w.speech_act).filter(Boolean))];
  if (sourceWorkflow && !speechActs.length) throw new Error("수업 범위의 화행 계획을 먼저 확인해 주세요.");
  const prompt = buildTeachingPrompt(kind, { course: material.courseTitle, level: base.outline.level,
    direction: base.outline.language_direction, week: material.weekNo, title: material.title,
    goals: material.sections.find((section) => section.id === "goals"),
    scope: defaultKind === "discussion" ? `2~${week.week_no - 1}주차 누적 학습` : sourceWorkflow ? "현재 주차 화행" : "현재 주차의 편성 미션 2개",
    ...(sourceWorkflow ? { speech_acts: speechActs, planned_goals: week.can_do, scope_weeks: scopeWeeks,
      focus: config.focus, activityMode: config.activityMode } : {}),
  }, sources, sourceWorkflow);
  return { kind, sources, prompt, material };
}

/** Whitelist public fields: raw sources, model payload and teacher explanations stay private. */
export function applyTeachingDraft(material: WeeklyCourseMaterial, draft: TeachingDraft): WeeklyCourseMaterial {
  const content = validateTeachingContent(draft.content, draft.kind, draft.sources.map((source) => source.id));
  if (draft.source_config.workflow === "source") validateTeachingEvidence(content, draft.sources);
  const sourceLabel = (id: string) => draft.sources.find((source) => source.id === id)?.label ?? id;
  return { ...material, preparationLabel: "주차 수업자료 · 생성 자료 반영",
    preparationNote: "주차 학습목표와 선택한 근거를 바탕으로 구성했습니다.",
    sections: [
      ...material.sections.filter((section) => ["goals", "central-question", "context"].includes(section.id)),
      ...content.sections.map((section) => ({ id: `teaching-${section.key}`, title: section.title,
        paragraphs: [...section.paragraphs], items: [...section.items,
          ...(draft.source_config.workflow === "source" ? [`활용 근거: ${section.source_ids.map(sourceLabel).join(" / ")}`] : [])] })),
      ...material.sections.filter((section) => section.id.startsWith("mission-")),
      { id: "teaching-sources", title: "활용한 자료", paragraphs: [],
        items: [...new Set(content.sections.flatMap((section) => section.source_ids))].map((id) => `${id} · ${sourceLabel(id)}`) },
    ],
  };
}
