import { MissionV6Schema, type MissionV6 } from "@/lib/pragma/missionV6";
import type { Pdr } from "@/lib/pragma/coreSchema";
import type { DctQuest } from "./canonicalMissionPreview";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { LEARNER_UX_PILOT } from "./learnerUxPilot";

// Format regression sample only: retain the frozen content, never copy an old
// scenario ID, approval, content hash or model provenance into a new mission.
const contexts = [
  "친한 팀플 조원이 하기로 한 일을 메신저로 다시 부탁합니다.",
  "수업에서만 뵌 교수님께 이메일로 처음 부탁하며, 아직 수락을 받지 않았습니다.",
  "", "같은 수업의 팀플 조원들과 나누는 메신저 대화입니다.",
  "활동 중 몇 번 이야기한 한 학년 위 여자 선배와의 메신저 대화입니다.",
];
const pdrs: Pdr[] = [
  { p: "equal", d: "close", r: "low" }, { p: "speaker_lower", d: "distant", r: "high" },
  { p: "speaker_lower", d: "acquaintance", r: "mid" }, { p: "equal", d: "acquaintance", r: "mid" },
  { p: "speaker_lower", d: "acquaintance", r: "low" },
];
const mpjItems = LEARNER_UX_PILOT.quests.slice(0, 5).map((quest, i) => {
  const common = { id: i + 1, short_label: quest.shortLabel, title: quest.title,
    situation_ko: quest.context.situation, relation_ko: quest.context.relation,
    channel: quest.context.channel === "이메일" ? "email" : "messenger", pdr: pdrs[i],
    learner_context_ko: contexts[i], source: quest.source };
  switch (quest.kind) {
    case "scale": return { ...common, type: "scale4", prompt: quest.prompt, target: quest.target,
      accepted_scale_codes: quest.acceptedAnswers, reference_scale_code: quest.referenceAnswer,
      explanation_ko: quest.feedback, ...(quest.revisionExamples ? { revision_examples: quest.revisionExamples } : {}) };
    case "fix_choice": return { ...common, type: "fix_choice", prompt: quest.prompt, target: quest.target,
      corrections: quest.corrections.map(c => ({ text: c.text, is_valid: c.valid, note_ko: c.note })), explanation_ko: quest.feedback };
    case "free_correction": return { ...common, type: "free_correction", prompt: quest.prompt, target: quest.target,
      reference_alternatives: quest.references, explanation_ko: quest.feedback };
    case "spectrum": return { ...common, type: "multi_judge", prompt: quest.prompt,
      candidates: quest.candidates.map(c => ({ text: c.text, accepted_band_codes: c.acceptedAnswers, note_ko: c.note })) };
    default: throw new Error("Frozen fixture shape changed");
  }
});
const dct = LEARNER_UX_PILOT.quests.find(q => q.kind === "dct") as DctQuest;
const feature = getTargetFeature("request_mitigation_optionality")!;
export const SAMPLE_MISSION_V6 = MissionV6Schema.parse({
  schema_version: "mission_v6", direction: "ko_zh", learning_goal: { kind: "speech_act", speech_act: "request" },
  unit: { target_feature: feature.code, target_feature_version: feature.version, learner_label: feature.learner_label,
    closing_ko: LEARNER_UX_PILOT.summaryPrinciple },
  mpj_items: mpjItems,
  lesson_points: LEARNER_UX_PILOT.lessonPoints.map((point, i) => ({ item_id: i + 1, label: point.label, text: point.text })),
  production_task: {
    mode: "translation", source_modality: "written", situation_ko: dct.context.situation, relation_ko: dct.context.relation,
    channel: "email", pdr: { p: "speaker_lower", d: "distant", r: "mid" }, preceding_turn: null,
    learner_context_ko: "처음 연락하는 학생회관 담당 직원에게 보내는 이메일입니다.", source_text: dct.source,
    vocabulary_hints: dct.vocabularyHints,
    focal_segments: [{ role: "head", text: dct.requestParts.headAct.sourceText },
      ...dct.requestParts.supportiveMoves.map(move => ({ role: "support", text: move.sourceText }))],
    reference_alternatives: dct.feedback.alternatives.map(alternative => ({ text: alternative.text, note_ko: alternative.note })),
  },
}) as MissionV6;

// Separate local candidate: the frozen sample and public scenario IDs stay intact.
const reasonContrastCandidate = structuredClone(SAMPLE_MISSION_V6);
reasonContrastCandidate.mpj_items[1].reason_choice = {
  prompt: "가장 큰 이유는 무엇인가요?",
  options: [
    { id: "request-and-deadline", text: "추천서 요청 내용과 필요한 시점이 분명하게 전달되기 때문입니다." },
    { id: "assumed-acceptance", text: "작성 가능 여부를 묻기보다, 이미 맡긴 일처럼 전달을 요구하기 때문입니다." },
    { id: "earlier-deadline", text: "원문보다 마감을 앞당겨 교수님이 준비할 시간을 줄였기 때문입니다." },
  ],
};
reasonContrastCandidate.mpj_items[3].contrast = {
  context_ko: "같은 일정 변경을 절친한 친구인 조원들에게 부탁한다면",
  target: "明天我下课晚，咱们把彩排从七点挪到七点半，行不？",
  explanation_ko: "친한 사이에서는 이렇게 편하게 물을 수 있습니다. 시간과 이유는 유지하고, 일정 변경에 대한 동의는 여전히 구합니다.",
};
export const SAMPLE_MISSION_V6_REASON_CONTRAST = MissionV6Schema.parse(reasonContrastCandidate) as MissionV6;
export const REASON_CONTRAST_PILOT_STORAGE_KEY = "pragma:learner-ux:reason-contrast-v6:20260914";
