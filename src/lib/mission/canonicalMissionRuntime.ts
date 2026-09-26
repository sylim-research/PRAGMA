import { naturalLearnerScene } from "../../../supabase/functions/_shared/learnerScene";
import { LEVEL, SPEECH_ACT_UI, type ChannelUI } from "@/lib/pragma/enums";
import type { Pdr } from "@/lib/pragma/coreSchema";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { withinBandCodeFor } from "@/lib/pragma/missionV6";
import type { CanonicalRunnableMission as RunnableMission } from "@/lib/mission/missionDb";
import type {
  BestWorstQuest,
  ChoiceOption,
  DctQuest,
  FixChoiceQuest,
  MissionContext,
  MissionQuest,
  CanonicalMissionViewModel,
  ReasonQuest,
} from "@/lib/mission/canonicalMissionPreview";

/** DB 저장 스키마를 현재 승인된 MPJ5 + DCT1 화면 계약으로 투영한다. */

const APPROPRIATENESS_OPTIONS: ChoiceOption[] = [
  { id: "very_appropriate", label: "매우 적절" },
  { id: "somewhat_appropriate", label: "다소 적절" },
  { id: "somewhat_inappropriate", label: "다소 부적절" },
  { id: "very_inappropriate", label: "매우 부적절" },
];

const POWER_LABEL: Record<Pdr["p"], string> = {
  speaker_lower: "상대 높음",
  equal: "동등",
  speaker_higher: "내가 높음",
};

const DISTANCE_LABEL: Record<Pdr["d"], string> = {
  close: "친밀",
  acquaintance: "아는 사이",
  distant: "초면",
};

const BURDEN_LABEL: Record<Pdr["r"], string> = {
  low: "부담 낮음",
  mid: "부담 보통",
  high: "부담 높음",
};

const CHANNEL_LABEL: Record<ChannelUI, MissionContext["channel"]> = {
  email: "이메일",
  messenger: "위챗",
  facetoface: "대면",
  phone: "전화",
};

const LESSON_LABELS = [
  "첫인상 판단",
  "맥락 대비 판단",
  "판단하고 고쳐보기",
  "이유 찾기",
  "여러 초안 비교",
] as const;

const DIRECTION_RUNTIME = {
  ko_zh: {
    label: "한국어 → 중국어",
    sourceLanguage: { code: "ko", label: "한국어", badge: "KO" },
    targetLanguage: { code: "zh", label: "중국어", badge: "ZH" },
  },
  zh_ko: {
    label: "중국어 → 한국어",
    sourceLanguage: { code: "zh", label: "중국어", badge: "ZH" },
    targetLanguage: { code: "ko", label: "한국어", badge: "KO" },
  },
} as const;

type RuntimeMpjCommon = {
  type: string;
  situation_ko: string;
  relation_ko: string;
  channel?: ChannelUI;
  pdr: Pdr;
  source: string;
  preceding_turn?: string | null;
  explanation_ko: string;
  recommended_example: string;
};

type RuntimeScale = RuntimeMpjCommon & {
  type: "scale4";
  target: string;
  highlights: string[];
  accepted_scale_codes: string[];
  reference_scale_code?: string;
};

type RuntimeJudge = RuntimeMpjCommon & {
  type: "judge3";
  target: string;
  highlights: string[];
  accepted_band_codes: string[];
};

type RuntimeFixChoice = RuntimeMpjCommon & {
  type: "fix_choice";
  target: string;
  highlights: string[];
  accepted_band_codes: string[];
  corrections: Array<{ text: string; is_valid: boolean; note_ko: string }>;
};

type RuntimeReasonConf = RuntimeMpjCommon & {
  type: "reason_conf";
  target: string;
  highlights: string[];
  accepted_band_codes: string[];
  reasons: Array<{ id: string; text_ko: string }>;
  accepted_reason_ids: string[];
};

type RuntimeReason = RuntimeMpjCommon & {
  type: "reason";
  target: string;
  highlights: string[];
  problem_band_code: string;
  reasons: Array<{
    id: string;
    text_ko: string;
    kind: "primary" | "pragmatic_misconception" | "meaning_grammar_context";
  }>;
  accepted_reason_id: string;
};

type RuntimeMultiJudge = RuntimeMpjCommon & {
  type: "multi_judge";
  candidates: Array<{
    text: string;
    accepted_band_codes: string[];
    note_ko: string;
    comparison_role?: "best" | "middle" | "worst";
  }>;
};

const RESPONSE_ACTS = new Set(["refusal", "opposition"]);

export class UnsupportedCanonicalMissionRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedCanonicalMissionRuntimeError";
  }
}

function contextFrom(input: {
  situation_ko: string;
  relation_ko: string;
  channel?: ChannelUI;
  sourceModality?: "written" | "spoken";
  pdr: Pdr;
  preceding_turn?: string | null;
}): MissionContext {
  const fallbackChannel: MissionContext["channel"] = input.sourceModality === "spoken" ? "대면" : "위챗";
  return {
    situation: compactLearnerScenario(input.situation_ko),
    relation: naturalLearnerScene(input.relation_ko),
    channel: input.channel ? CHANNEL_LABEL[input.channel] : fallbackChannel,
    pdr: {
      p: POWER_LABEL[input.pdr.p],
      d: DISTANCE_LABEL[input.pdr.d],
      r: BURDEN_LABEL[input.pdr.r],
    },
    precedingTurn: input.preceding_turn ?? undefined,
  };
}

const SCENE_META_SENTENCE = /(글로 작성해 보내는|즉시 반응|기록으로 남|매체의 특성|연구 목적|평가 기준)/;

function clipped(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const prefix = normalized.slice(0, max + 1);
  const boundary = Math.max(prefix.lastIndexOf(" "), prefix.lastIndexOf(","));
  return `${prefix.slice(0, boundary >= Math.floor(max * 0.65) ? boundary : max).trim()}…`;
}

/** 역사 장면도 학습자에게는 핵심 두 문장만 보여 주는 표시 전용 projection. */
export function compactLearnerScenario(value: string): string {
  const normalized = naturalLearnerScene(value);
  const sentences = normalized.match(/[^.!?。！？]+[.!?。！？]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  if (sentences.length === 0) return clipped(normalized, 140);
  const meaningful = sentences.filter((sentence, index) => index === 0 || !SCENE_META_SENTENCE.test(sentence));
  return clipped((meaningful.length > 0 ? meaningful : sentences).slice(0, 2).join(" "), 140);
}

function singleCorrectionOptions(item: RuntimeFixChoice): FixChoiceQuest["corrections"] {
  const recommendedIndex = item.corrections.findIndex(
    (candidate) => candidate.is_valid && candidate.text === item.recommended_example,
  );
  const validIndex = recommendedIndex >= 0
    ? recommendedIndex
    : item.corrections.findIndex((candidate) => candidate.is_valid);
  const invalidIndexes = item.corrections
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => !candidate.is_valid)
    .slice(0, 2)
    .map(({ index }) => index);
  if (validIndex < 0 || invalidIndexes.length !== 2) {
    throw new UnsupportedCanonicalMissionRuntimeError("판단하고 고쳐보기에는 권장안 1개와 경계안 2개가 필요합니다.");
  }
  return [validIndex, ...invalidIndexes]
    .sort((a, b) => a - b)
    .map((index) => ({
      id: `A3-${index}`,
      text: item.corrections[index].text,
      valid: index === validIndex,
      note: item.corrections[index].note_ko,
    }));
}

function expressionSnippet(value: string, max = 18): string {
  return clipped(value.replace(/[。！？.!?]+$/u, ""), max);
}

function tutorMemo(value: string, max = 26): string {
  const firstSentence = (value.split(/[.!?。！？]/u)[0] ?? value)
    .replace(/^(이 상황에서는|이 문항에서는|현재 표현은|이 표현은)\s*/u, "")
    .replace(/상대방/g, "상대")
    .replace(/문제와\s*/g, "문제·")
    .replace(/문제 및\s*/g, "문제·")
    .replace(/문제·조치를 직접 언급하는 것이 상대에게 명확한 정보를 제공하여 문제 해결에 도움을 줄 수 있다/u, "문제·필요 조치를 밝혀 해결 요청이 선명")
    .replace(/즉시 해결을 요구하는 것이 부담을 줄 수 있어 과도하다/u, "즉시 해결을 요구해 상대 부담이 큼")
    .replace(/부드럽게 표현하여/g, "부드럽게 밝혀")
    .replace(/명확히 하였다$/u, "분명히 함")
    .replace(/즉각적인 조치를 강요하는 표현이 과도하다$/u, "즉각 조치를 강요해 과함")
    .replace(/조치를 강요하는 표현이 과도하다$/u, "조치를 강요해 과함")
    .replace(/명확히 하여 적절하다$/u, "분명히 해 적절")
    .replace(/과도하다$/u, "과함")
    .replace(/적절하다$/u, "적절")
    .replace(/하였다$/u, "함")
    .trim();
  return clipped(firstSentence, max).replace(/[。！？.!?]+$/u, "");
}

function lessonAnchor(target: string, highlights?: string[]): string {
  return expressionSnippet(highlights?.find((value) => value.trim().length > 0) ?? target);
}

function concreteLessonPoints(quests: MissionQuest[]): CanonicalMissionViewModel["lessonPoints"] {
  return quests.slice(0, 5).map((quest) => {
    if (quest.kind === "scale") {
      const expression = lessonAnchor(quest.target, quest.targetHighlights);
      return { questId: quest.id, label: quest.shortLabel, text: `「${expression}」 → ${tutorMemo(quest.feedback)}`, highlights: [expression] };
    }
    if (quest.kind === "fix_choice") {
      const recommended = quest.corrections.find((candidate) => candidate.valid);
      if (!recommended) throw new UnsupportedCanonicalMissionRuntimeError("recap에 표시할 권장 수정안이 없습니다.");
      const expression = expressionSnippet(recommended.text);
      return { questId: quest.id, label: quest.shortLabel, text: `「${expression}」 → ${tutorMemo(recommended.note)}`, highlights: [expression] };
    }
    if (quest.kind === "reason") {
      const accepted = quest.reasons.find((reason) => reason.id === quest.acceptedReasonId);
      if (!accepted) throw new UnsupportedCanonicalMissionRuntimeError("recap에 표시할 주원인이 없습니다.");
      const expression = lessonAnchor(quest.target, quest.targetHighlights);
      return { questId: quest.id, label: quest.shortLabel, text: `「${expression}」 → ${tutorMemo(accepted.text)}`, highlights: [expression] };
    }
    if (quest.kind === "best_worst") {
      const best = quest.candidates.find((candidate) => candidate.id === quest.bestId);
      if (!best) throw new UnsupportedCanonicalMissionRuntimeError("recap에 표시할 BEST가 없습니다.");
      const bestExpression = expressionSnippet(best.text);
      return {
        questId: quest.id,
        label: quest.shortLabel,
        text: `적정안 「${bestExpression}」 → ${tutorMemo(best.note, 22)}`,
        highlights: [bestExpression],
      };
    }
    throw new UnsupportedCanonicalMissionRuntimeError("MJT recap은 판단 문항 다섯 개만 지원합니다.");
  });
}

function assertBand(code: string, options: ChoiceOption[]): string {
  if (!options.some((option) => option.id === code)) {
    throw new UnsupportedCanonicalMissionRuntimeError(`미션의 판정 대역이 화용 초점 카탈로그와 맞지 않습니다(${code}).`);
  }
  return code;
}

function bandChoiceOption(
  band: { code: string; label_ko: string },
  withinBandCode: string,
  index: number,
): ChoiceOption {
  const matched = band.label_ko.match(/^(.+?)(?:\s*\(([^)]+)\))?$/);
  const shortLabel = matched?.[1]?.trim() || band.label_ko;
  const boundaryDescription = matched?.[2]?.trim();
  const isWithinBand = band.code === withinBandCode;
  return {
    id: band.code,
    label: isWithinBand ? "현재 상황에 맞음" : shortLabel,
    description: isWithinBand
      ? "관계·거리·부담에 맞는 조절"
      : boundaryDescription ?? (index === 0 ? "상황 기준보다 조절이 부족함" : "상황 기준보다 조절이 과함"),
  };
}

/**
 * v6 MJT5 대역 선택지. 축 이름은 화행마다 다르므로 카탈로그에서 가져오되,
 * 화면 문구는 요청 3건에서 고정된 형태(짧은 이름만, 보조 문구 없음)를 유지한다.
 */
function v6BandOptions(
  bands: { code: string; label_ko: string }[],
  catalogWithinBand: string,
  contentWithinBand: string,
): ChoiceOption[] {
  return bands.map((band) => {
    const isWithinBand = band.code === catalogWithinBand;
    return {
      id: isWithinBand ? contentWithinBand : band.code,
      label: isWithinBand ? "상황에 맞음" : band.label_ko.match(/^(.+?)(?:\s*\([^)]+\))?$/)?.[1]?.trim() || band.label_ko,
    };
  });
}

function runtimeFeedbackMode(pdr: Pdr): DctQuest["feedback"]["mode"] {
  return pdr.p === "speaker_lower" || pdr.d === "distant" || pdr.r === "high"
    ? "needs_mitigation"
    : "avoid_over_mitigation";
}

/** DB 미션을 현재 정본의 다섯 판단 활동 + DCT 흐름에 투영한다. */
export function adaptRunnableMissionToCanonical(runnable: RunnableMission): CanonicalMissionViewModel {
  const { mission } = runnable;
  const isNativeMpj5 = mission.schema_version === "mission_v5" && mission.mpj_items.length === 5;
  const directionRuntime = DIRECTION_RUNTIME[mission.direction];
  const activityMode = mission.production_task.mode;
  if (!runnable.speech_act) {
    throw new UnsupportedCanonicalMissionRuntimeError("화행 정보가 없는 미션은 정본 실행기에 연결할 수 없습니다.");
  }
  const feature = getTargetFeature(mission.unit.target_feature);
  if (!feature || feature.speech_act !== runnable.speech_act) {
    throw new UnsupportedCanonicalMissionRuntimeError("미션 화행과 화용 초점 카탈로그가 맞지 않습니다.");
  }
  const bandOptions: ChoiceOption[] = feature.band_schema.map((band, index) => (
    bandChoiceOption(band, feature.within_band_code, index)
  ));

  const common = (index: number, item: RuntimeMpjCommon) => ({
    id: `A${index + 1}`,
    module: "A" as const,
    shortLabel: LESSON_LABELS[index],
    title: LESSON_LABELS[index],
    context: contextFrom({
      situation_ko: item.situation_ko,
      relation_ko: item.relation_ko,
      channel: item.channel,
      pdr: item.pdr,
      preceding_turn: !isNativeMpj5 && RESPONSE_ACTS.has(runnable.speech_act) ? item.preceding_turn : null,
    }),
    source: item.source,
  });

  const toBestWorst = (
    multiJudge: RuntimeMultiJudge,
  ): BestWorstQuest => {
    const usesBandPairContract = "contrast_plan" in mission
      && mission.contrast_plan?.version === "contrast_plan_v1";
    const explicitBestIndex = usesBandPairContract
      ? -1
      : multiJudge.candidates.findIndex((candidate) => candidate.comparison_role === "best");
    const explicitWorstIndex = usesBandPairContract
      ? -1
      : multiJudge.candidates.findIndex((candidate) => candidate.comparison_role === "worst");
    const recommendedBestIndex = multiJudge.candidates.findIndex(
      (candidate) => candidate.text === multiJudge.recommended_example,
    );
    const inferredBestIndex = multiJudge.candidates.findIndex(
      (candidate) => candidate.accepted_band_codes.includes(feature.within_band_code),
    );
    const inferredWorstIndex = multiJudge.candidates.findIndex(
      (candidate) => !candidate.accepted_band_codes.includes(feature.within_band_code),
    );
    const bestIndex = explicitBestIndex >= 0
      ? explicitBestIndex
      : recommendedBestIndex >= 0
        ? recommendedBestIndex
        : inferredBestIndex;
    const worstIndex = explicitWorstIndex >= 0 ? explicitWorstIndex : inferredWorstIndex;
    if (bestIndex < 0 || worstIndex < 0 || bestIndex === worstIndex) {
      throw new UnsupportedCanonicalMissionRuntimeError("여러 초안 비교에 적정/조정 필요 참고 대역이 없습니다.");
    }
    const displayedIndexes = usesBandPairContract
      ? multiJudge.candidates.map((_, index) => index)
      : multiJudge.candidates
        .map((_, index) => index)
        .filter((index) => index === bestIndex || index === worstIndex)
        .concat(
          multiJudge.candidates
            .map((_, index) => index)
            .filter((index) => index !== bestIndex && index !== worstIndex)
            .slice(0, 2),
        )
        .sort((a, b) => a - b);
    if (displayedIndexes.length !== 4) {
      throw new UnsupportedCanonicalMissionRuntimeError("여러 초안 비교에는 표시할 후보가 정확히 4개 필요합니다.");
    }
    const bestId = `A5-${bestIndex}`;
    const worstId = `A5-${worstIndex}`;
    return {
      ...common(4, multiJudge),
      kind: "best_worst",
      comparisonMode: usesBandPairContract ? "band_pair" : "ranked",
      prompt: usesBandPairContract
        ? "이 상황에 알맞은 표현 1개와 조정이 필요한 표현 1개를 고르세요."
        : "가장 적절한 번역과 가장 부적절한 번역을 하나씩 고르세요.",
      candidates: displayedIndexes.map((index) => {
        const candidate = multiJudge.candidates[index];
        const id = `A5-${index}`;
        return {
          id,
          text: candidate.text,
          role: usesBandPairContract
            ? candidate.accepted_band_codes.includes(feature.within_band_code) ? "best" : "worst"
            : id === bestId ? "best" : id === worstId ? "worst" : "middle",
          note: candidate.note_ko,
        };
      }) satisfies BestWorstQuest["candidates"],
      bestId,
      worstId,
      feedback: multiJudge.explanation_ko,
    };
  };

  let quests: MissionQuest[];
  let contrastBefore: string;
  let contrastAfter: string;
  let lessonPoints: CanonicalMissionViewModel["lessonPoints"];

  if (mission.schema_version === "mission_v6") {
    quests = mission.mpj_items.map((item): MissionQuest => {
      const base = { id: `A${item.id}`, module: "A" as const, shortLabel: item.short_label,
        title: item.title, prompt: item.prompt, source: item.source,
        context: contextFrom({ situation_ko: item.situation_ko, relation_ko: item.relation_ko, channel: item.channel, pdr: item.pdr }) };
      switch (item.type) {
        case "scale4": return { ...base, kind: "scale", target: item.target, options: APPROPRIATENESS_OPTIONS,
          referenceAnswer: item.reference_scale_code, acceptedAnswers: item.accepted_scale_codes,
          feedback: item.explanation_ko, revisionExamples: item.revision_examples,
          ...(item.id === 2 && item.reason_choice ? { reasonChoice: {
            prompt: item.reason_choice.prompt,
            options: item.reason_choice.options.map(reason => ({ id: reason.id, label: reason.text })),
            ...(item.reason_choice.accepted_id ? { acceptedId: item.reason_choice.accepted_id } : {}),
          } } : {}) };
        case "fix_choice": return { ...base, kind: "fix_choice", target: item.target,
          // Compatibility properties are not displayed or persisted for v6.
          judgmentOptions: [], referenceJudgment: "", nextLabel: "다음: 직접 고쳐 보기",
          corrections: item.corrections.map((candidate, i) => ({ id: `A3-${i}`, text: candidate.text, valid: candidate.is_valid, note: candidate.note_ko })),
          feedback: item.explanation_ko };
        case "free_correction": return { ...base, kind: "free_correction", target: item.target,
          references: item.reference_alternatives, feedback: item.explanation_ko,
          ...(item.contrast ? { contrast: { context: item.contrast.context_ko,
            target: item.contrast.target, explanation: item.contrast.explanation_ko } } : {}) };
        case "multi_judge": return { ...base, kind: "spectrum",
          options: v6BandOptions(feature.band_schema, feature.within_band_code, withinBandCodeFor(mission.unit.target_feature)),
          candidates: item.candidates.map((candidate, i) => ({ id: `A5-${i}`, text: candidate.text,
            acceptedAnswers: candidate.accepted_band_codes, note: candidate.note_ko })) };
      }
    });
    // Presentation order is separate from the stored item IDs and response tuple.
    const presentationOrder = ["A1", "A2", "A5", "A3", "A4"];
    quests.sort((a, b) => presentationOrder.indexOf(a.id) - presentationOrder.indexOf(b.id));
    const nextLabels: Record<string, string> = {
      A1: "다음: 판단하고 이유 고르기", A2: "다음: 여러 표현 비교하기",
      A5: "다음: 고친 표현 고르기", A3: "다음: 직접 고치고 비교하기", A4: "다음: 핵심 정리",
    };
    quests = quests.map(quest => ({ ...quest, nextLabel: nextLabels[quest.id] }));
    contrastBefore = mission.mpj_items[0].situation_ko;
    contrastAfter = mission.mpj_items[1].situation_ko;
    lessonPoints = mission.lesson_points.map(point => ({ questId: `A${point.item_id}`, label: point.label, text: point.text }))
      .sort((a, b) => presentationOrder.indexOf(a.questId) - presentationOrder.indexOf(b.questId));
  } else if (mission.schema_version === "mission_v2") {
    const [rawScale, rawContrast, rawFixChoice, rawReason, rawMultiJudge] = mission.mpj_items;
    if (
      rawScale.type !== "scale4" ||
      rawContrast.type !== "judge3" ||
      rawFixChoice.type !== "fix_choice" ||
      rawReason.type !== "reason_conf" ||
      rawMultiJudge.type !== "multi_judge"
    ) {
      throw new UnsupportedCanonicalMissionRuntimeError("MJT5 문항 순서가 최신 연결 계약과 맞지 않습니다.");
    }
    const scale = rawScale as unknown as RuntimeScale;
    const contrast = rawContrast as unknown as RuntimeJudge;
    const fixChoice = rawFixChoice as unknown as RuntimeFixChoice;
    const reason = rawReason as unknown as RuntimeReasonConf;
    const multiJudge = rawMultiJudge as unknown as RuntimeMultiJudge;
    const reasonKinds: ReasonQuest["reasons"][number]["kind"][] = [
      "primary",
      "pragmatic_misconception",
      "meaning_grammar_context",
      "meaning_grammar_context",
    ];
    quests = [
      {
        ...common(0, scale),
        kind: "scale",
        prompt: "이 번역안은 이 상황에 얼마나 적절한가요?",
        target: scale.target,
        options: APPROPRIATENESS_OPTIONS,
        referenceAnswer: scale.accepted_scale_codes[0],
        acceptedAnswers: scale.accepted_scale_codes,
        targetHighlights: scale.highlights,
        feedback: scale.explanation_ko,
      },
      {
        ...common(1, contrast),
        kind: "scale",
        prompt: "이 번역안은 이 상황에 맞나요?",
        target: contrast.target,
        options: bandOptions,
        referenceAnswer: assertBand(contrast.accepted_band_codes[0], bandOptions),
        acceptedAnswers: contrast.accepted_band_codes.map((code) => assertBand(code, bandOptions)),
        targetHighlights: contrast.highlights,
        feedback: contrast.explanation_ko,
      },
      {
        ...common(2, fixChoice),
        kind: "fix_choice",
        prompt: "이 상황에서 이 표현은 어떻게 들리나요?",
        target: fixChoice.target,
        judgmentOptions: bandOptions,
        referenceJudgment: assertBand(fixChoice.accepted_band_codes[0], bandOptions),
        corrections: singleCorrectionOptions(fixChoice),
        targetHighlights: fixChoice.highlights,
        feedback: fixChoice.explanation_ko,
      },
      {
        ...common(3, reason),
        kind: "reason",
        prompt: "이 표현이 상황에 맞지 않는 가장 큰 이유는 무엇일까요?",
        target: reason.target,
        referenceJudgment: "inappropriate",
        reasons: reason.reasons.map((item, index) => ({
          id: item.id,
          text: item.text_ko,
          kind: reason.accepted_reason_ids.includes(item.id)
            ? "primary"
            : reasonKinds[index] ?? "meaning_grammar_context",
        })),
        acceptedReasonId: reason.accepted_reason_ids[0],
        acceptedReasonIds: reason.accepted_reason_ids,
        targetHighlights: reason.highlights,
        feedback: reason.explanation_ko,
      },
      toBestWorst(multiJudge),
    ];
    contrastBefore = scale.situation_ko;
    contrastAfter = contrast.situation_ko;
    lessonPoints = mission.mpj_items.map((item, index) => ({
      questId: `A${index + 1}`,
      label: LESSON_LABELS[index],
      text: item.explanation_ko,
      highlights: "highlights" in item && Array.isArray(item.highlights)
        ? item.highlights as string[]
        : undefined,
    }));
  } else if (mission.schema_version === "mission_v5" && mission.mpj_items.length === 5) {
    const [rawScale, rawContrast, rawFixChoice, rawReason, rawMultiJudge] = mission.mpj_items;
    if (
      rawScale.type !== "scale4" ||
      rawContrast.type !== "judge3" ||
      rawFixChoice.type !== "fix_choice" ||
      rawReason.type !== "reason" ||
      rawMultiJudge.type !== "multi_judge"
    ) {
      throw new UnsupportedCanonicalMissionRuntimeError("네이티브 MJT5 문항 순서가 정본 연결 계약과 맞지 않습니다.");
    }
    const scale = rawScale as unknown as RuntimeScale;
    const contrast = rawContrast as unknown as RuntimeJudge;
    const fixChoice = rawFixChoice as unknown as RuntimeFixChoice;
    const reason = rawReason as unknown as RuntimeReason;
    const multiJudge = rawMultiJudge as unknown as RuntimeMultiJudge;
    quests = [
      {
        ...common(0, scale),
        kind: "scale",
        prompt: "이 번역안은 이 상황에 얼마나 적절한가요?",
        target: scale.target,
        options: APPROPRIATENESS_OPTIONS,
        referenceAnswer: scale.reference_scale_code,
        acceptedAnswers: scale.accepted_scale_codes,
        targetHighlights: scale.highlights,
        feedback: scale.explanation_ko,
      },
      {
        ...common(1, contrast),
        kind: "scale",
        prompt: "이 표현은 이 상황에 맞나요?",
        target: contrast.target,
        options: bandOptions,
        referenceAnswer: assertBand(contrast.accepted_band_codes[0], bandOptions),
        acceptedAnswers: contrast.accepted_band_codes.map((code) => assertBand(code, bandOptions)),
        targetHighlights: contrast.highlights,
        feedback: contrast.explanation_ko,
      },
      {
        ...common(2, fixChoice),
        kind: "fix_choice",
        prompt: "이 상황에서 이 표현은 어떻게 들리나요?",
        target: fixChoice.target,
        judgmentOptions: bandOptions,
        referenceJudgment: assertBand(fixChoice.accepted_band_codes[0], bandOptions),
        corrections: singleCorrectionOptions(fixChoice),
        targetHighlights: fixChoice.highlights,
        feedback: fixChoice.explanation_ko,
      },
      {
        ...common(3, reason),
        kind: "reason",
        prompt: "이 표현은 이 상황에 적절한가요?",
        target: reason.target,
        referenceJudgment: "inappropriate",
        reasons: reason.reasons.map((item) => ({
          id: item.id,
          text: item.text_ko,
          kind: item.kind,
        })),
        acceptedReasonId: reason.accepted_reason_id,
        targetHighlights: reason.highlights,
        feedback: reason.explanation_ko,
      },
      toBestWorst(multiJudge),
    ];
    contrastBefore = scale.situation_ko;
    contrastAfter = contrast.situation_ko;
    lessonPoints = mission.mpj_items.map((item, index) => ({
      questId: `A${index + 1}`,
      label: LESSON_LABELS[index],
      text: item.explanation_ko,
      highlights: "highlights" in item && Array.isArray(item.highlights)
        ? item.highlights
        : undefined,
    }));
  } else if (mission.schema_version === "mission_v4" || mission.schema_version === "mission_v5") {
    const [rawScale, rawFixChoice, rawReason, rawMultiJudge] = mission.mpj_items;
    if (
      rawScale.type !== "scale4" ||
      rawFixChoice.type !== "fix_choice" ||
      rawReason.type !== "reason" ||
      rawMultiJudge.type !== "multi_judge"
    ) {
      throw new UnsupportedCanonicalMissionRuntimeError("과도기 MJT 문항 순서가 연결 계약과 맞지 않습니다.");
    }
    const scale = rawScale as unknown as RuntimeScale;
    const fixChoice = rawFixChoice as unknown as RuntimeFixChoice;
    const reason = rawReason as unknown as RuntimeReason;
    const multiJudge = rawMultiJudge as unknown as RuntimeMultiJudge;
    const referenceJudgment = assertBand(fixChoice.accepted_band_codes[0], bandOptions);
    quests = [
      {
        ...common(0, scale),
        kind: "scale",
        prompt: "이 번역안은 이 상황에 얼마나 적절한가요?",
        target: scale.target,
        options: APPROPRIATENESS_OPTIONS,
        referenceAnswer: scale.reference_scale_code,
        acceptedAnswers: scale.accepted_scale_codes,
        targetHighlights: scale.highlights,
        feedback: scale.explanation_ko,
      },
      {
        ...common(1, fixChoice),
        kind: "scale",
        prompt: "이 표현은 이 상황에 맞나요?",
        target: fixChoice.target,
        options: bandOptions,
        referenceAnswer: referenceJudgment,
        acceptedAnswers: fixChoice.accepted_band_codes.map((code) => assertBand(code, bandOptions)),
        targetHighlights: fixChoice.highlights,
        feedback: fixChoice.explanation_ko,
      },
      {
        ...common(2, fixChoice),
        kind: "fix_choice",
        prompt: "방금 판단한 표현을 상황에 맞게 고쳐 보세요.",
        target: fixChoice.target,
        judgmentOptions: bandOptions,
        referenceJudgment,
        judgmentQuestId: "A2",
        corrections: singleCorrectionOptions(fixChoice),
        targetHighlights: fixChoice.highlights,
        feedback: fixChoice.explanation_ko,
      },
      {
        ...common(3, reason),
        kind: "reason",
        prompt: "이 표현은 이 상황에 적절한가요?",
        target: reason.target,
        referenceJudgment: "inappropriate",
        reasons: reason.reasons.map((item) => ({
          id: item.id,
          text: item.text_ko,
          kind: item.kind,
        })),
        acceptedReasonId: reason.accepted_reason_id,
        targetHighlights: reason.highlights,
        feedback: reason.explanation_ko,
      },
      toBestWorst(multiJudge),
    ];
    contrastBefore = scale.situation_ko;
    contrastAfter = fixChoice.situation_ko;
    lessonPoints = [
      { questId: "A1", label: LESSON_LABELS[0], text: scale.explanation_ko, highlights: scale.highlights },
      { questId: "A2", label: LESSON_LABELS[1], text: fixChoice.explanation_ko, highlights: fixChoice.highlights },
      {
        questId: "A3",
        label: LESSON_LABELS[2],
        text: fixChoice.corrections.filter((item) => item.is_valid).map((item) => item.note_ko).join(" / "),
        highlights: fixChoice.corrections.filter((item) => item.is_valid).map((item) => item.text),
      },
      { questId: "A4", label: LESSON_LABELS[3], text: reason.explanation_ko, highlights: reason.highlights },
      { questId: "A5", label: LESSON_LABELS[4], text: multiJudge.explanation_ko },
    ];
  } else {
    throw new UnsupportedCanonicalMissionRuntimeError(
      `정본 실데이터 연결이 아직 지원하지 않는 스키마입니다(${mission.schema_version}).`,
    );
  }

  if (mission.schema_version !== "mission_v6") lessonPoints = concreteLessonPoints(quests);

  const task = mission.production_task;
  const dctContext = contextFrom({
    situation_ko: task.situation_ko,
    relation_ko: task.relation_ko,
    channel: task.channel,
    sourceModality: task.source_modality,
    pdr: task.pdr,
    preceding_turn: task.preceding_turn,
  });
  const referenceAnswer = task.reference_alternatives[0].text;
  const requestParts: DctQuest["requestParts"] = {
    headAct: { label: "이번 번역에서 전달할 핵심 발화", sourceText: task.source_text },
    supportiveMoves: [],
  };
  const feedback: DctQuest["feedback"] = {
    mode: runtimeFeedbackMode(task.pdr),
    issue: task.reference_alternatives[0].note_ko,
    action: mission.unit.closing_ko,
    success: "원문의 핵심 의미와 상황에 맞는 표현을 함께 확인했습니다.",
    alternatives: task.reference_alternatives.map((alternative) => ({
      text: alternative.text,
      note: alternative.note_ko,
    })),
  };

  quests.push(
    {
      id: "A-DCT",
      module: "A",
      shortLabel: "번역하기",
      title: "상황 번역하기",
      kind: "dct",
      context: dctContext,
      source: task.source_text,
      prompt: activityMode === "interpreting"
        ? `원발화를 듣고 ${directionRuntime.targetLanguage.label}로 통역해 보세요.`
        : `이 말을 ${directionRuntime.targetLanguage.label}로 옮겨 보세요.`,
      replayLimit: activityMode === "interpreting" ? task.replay_limit ?? 2 : undefined,
      vocabularyHints: activityMode === "translation" ? (task.vocabulary_hints ?? []).filter(
        (hint): hint is { source: string; target: string } =>
          typeof hint.source === "string" && typeof hint.target === "string",
      ) : [],
      referenceAnswer,
      requestParts,
      feedback,
    },
    {
      id: "A-FEEDBACK",
      module: "A",
      shortLabel: "피드백·다듬기",
      title: "번역 피드백과 다듬기",
      kind: "dct_feedback",
      dctId: "A-DCT",
      context: dctContext,
      source: task.source_text,
      referenceAnswer,
      requestParts,
      feedback,
    },
  );

  return {
    ...(mission.schema_version === "mission_v6" ? {
      missionFormat: "mission_v6" as const,
      learnerContextCopy: Object.fromEntries([
        ...mission.mpj_items.map(item => [`A${item.id}`, item.learner_context_ko]),
        ["A-DCT", mission.production_task.learner_context_ko], ["A-FEEDBACK", mission.production_task.learner_context_ko],
      ]),
    } : {}),
    scenarioId: runnable.scenario_id,
    metaLabel: "실제 미션",
    weekNo: 0,
    speechAct: SPEECH_ACT_UI[runnable.speech_act],
    level: runnable.learner_level ? LEVEL[runnable.learner_level] : "수준 정보 없음",
    supportLevel: runnable.learner_level === "beginner_intermediate"
      ? "beginner"
      : runnable.learner_level === "advanced"
        ? "advanced"
        : "intermediate",
    activityMode,
    direction: directionRuntime.label,
    sourceLanguage: directionRuntime.sourceLanguage,
    targetLanguage: directionRuntime.targetLanguage,
    contrast: {
      before: contrastBefore,
      after: contrastAfter,
      changedDimensions: [],
      note: mission.schema_version === "mission_v6" ? "서로 다른 장면에서 표현의 적절성을 살펴봅니다." : "첫인상 판단과 맥락 대비 판단에서 상황에 따라 달라지는 적절성을 비교합니다.",
    },
    summaryPrinciple: mission.unit.closing_ko,
    lessonPoints,
    quests,
  };
}
