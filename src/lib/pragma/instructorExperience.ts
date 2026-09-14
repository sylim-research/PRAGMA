import { normalizeLearnerMission } from "./missionV6";
import { adaptRunnableMissionToCanonical } from "@/lib/mission/canonicalMissionRuntime";
import type { LearnerLevel, SpeechActUI } from "./enums";
import type { InstructorExperience, ReviewFinding, ReviewInspection } from "../../../supabase/functions/_shared/contentReview";

export const EXPERIENCE_SECTIONS = [
  { id: "scene", label: "장면 도입" },
  { id: "mjt-0", label: "1. 첫인상 판단" },
  { id: "mjt-1", label: "2. 맥락 대비 판단" },
  { id: "mjt-2", label: "3. 판단하고 고쳐보기" },
  { id: "mjt-3", label: "4. 이유 찾기" },
  { id: "mjt-4", label: "5. 여러 초안 비교" },
  { id: "recap", label: "문항별 핵심" },
  { id: "dct", label: "직접 산출 · DCT" },
] as const;

export function experienceComplete(experience?: InstructorExperience | null) {
  return experience?.version === "instructor_experience_v1" && experience.decisions.length === EXPERIENCE_SECTIONS.length
    && EXPERIENCE_SECTIONS.every(({ id }) => experience.decisions.filter((entry) => entry.section === id && entry.status === "checked").length === 1);
}

export function viewModelFromReview(inspection: ReviewInspection) {
  const content = inspection.snapshot.content as { mission?: unknown; context?: { scenario_id?: string; speech_act?: SpeechActUI; learner_level?: LearnerLevel } } | undefined;
  const parsed = normalizeLearnerMission(content?.mission);
  if (!parsed.ok || !parsed.data || parsed.data.mpj_items.length !== 5) throw new Error("이 버전은 현재 MJT5 학습 화면으로 표시할 수 없습니다. 원본과 규칙 오류를 확인하세요.");
  return adaptRunnableMissionToCanonical({
    scenario_id: content?.context?.scenario_id ?? inspection.run?.target_id ?? "review",
    speech_act: content?.context?.speech_act ?? null, learner_level: content?.context?.learner_level ?? null,
    mission_status: "generated", release_gate_mode: null, direction: parsed.data.direction, mission: parsed.data,
  });
}

export function findingAppliesToSection(finding: ReviewFinding, section: string) {
  const item = finding.where.match(/^\/content\/mission\/mpj_items\/(\d+)(?:\/|$)/);
  if (item) return section === `mjt-${item[1]}` || section === "recap";
  if (finding.where.startsWith("/content/mission/production_task")) return section === "dct";
  return true; // Global or imprecise findings remain visible in every section.
}
