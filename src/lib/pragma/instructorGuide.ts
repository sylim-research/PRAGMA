import { currentFeatureLabel } from "@/lib/pragma/targetFeatures";
import type { Pdr } from "@/lib/pragma/coreSchema";
import type { MissionRuntime, MpjItemRuntime } from "@/lib/pragma/missionSchema";

const ITEM_TITLE: Record<string, string> = {
  scale4: "첫인상 판단",
  judge3: "맥락 대비 판단",
  fix_choice: "판단하고 고쳐보기",
  reason_conf: "판단 근거 찾기",
  reason: "판단 근거 찾기",
  multi_judge: "여러 초안 비교",
};

const PDR_AXIS = {
  p: { short: "P", label: "힘의 관계" },
  d: { short: "D", label: "사회적 거리" },
  r: { short: "R", label: "부담" },
} as const;

const PDR_VALUE_KO = {
  speaker_lower: "화자가 낮음",
  equal: "동등",
  speaker_higher: "화자가 높음",
  close: "친밀",
  acquaintance: "지인",
  distant: "초면·먼 관계",
  low: "낮음",
  mid: "중간",
  high: "높음",
} as const;

const SPEECH_ACT_R_MEANING_KO: Record<string, string> = {
  요청: "상대에게 요구되는 노력·시간·자원과 요청 수행의 부담",
  사과: "잘못이 초래한 침해·피해의 심각도",
  제안: "상대 의향과의 충돌, 제안 수용의 난이도와 사안의 중대성",
};

type PdrAxis = keyof typeof PDR_AXIS;

export type InstructorGuideCandidate = {
  text: string;
  noteKo: string;
  judgmentKo?: string;
};

export type InstructorGuideItem = {
  id: number;
  titleKo: string;
  situationKo: string;
  source: string;
  designIntentKo: string;
  candidates: InstructorGuideCandidate[];
};

export type InstructorGuideContrast = {
  verified: boolean;
  preservedKo: string[];
  changedKo?: string;
  firstSituationKo: string;
  secondSituationKo: string;
};

export type InstructorMissionGuide = {
  speechActKo: string;
  itemFocusKo: string;
  situationKo: string;
  relationKo: string;
  pdrKo: string[];
  burdenMeaningKo?: string;
  mpjItems: InstructorGuideItem[];
  misconceptionKo?: string;
  coreReasonKo?: string;
  contrast: InstructorGuideContrast;
  microscope: {
    expression: string;
    source: string;
    functionAndEffectKo: string;
    adjustmentExample: string;
    /** 화행별로 표면형과 상호작용 기능을 혼동하기 쉬운 경우에만 보이는 교수자 확인 질문. */
    boundaryPromptLabelKo?: string;
    boundaryPromptKo?: string;
  };
  dct: {
    situationKo: string;
    sourceText: string;
    alternatives: Array<{ text: string; noteKo: string }>;
  };
  recontextualization: {
    situationKo: string;
    relationKo: string;
    promptKo: string;
  };
};

function pdrValueKo(value: string): string {
  return PDR_VALUE_KO[value as keyof typeof PDR_VALUE_KO] ?? value;
}

export function formatPdr(pdr: Pdr): string[] {
  return (["p", "d", "r"] as PdrAxis[]).map(
    (axis) => `${PDR_AXIS[axis].short} · ${PDR_AXIS[axis].label}: ${pdrValueKo(pdr[axis])}`,
  );
}

function comparePdr(first: Pdr, second: Pdr): InstructorGuideContrast {
  const axes = ["p", "d", "r"] as PdrAxis[];
  const changed = axes.filter((axis) => first[axis] !== second[axis]);
  const preserved = axes
    .filter((axis) => first[axis] === second[axis])
    .map((axis) => `${PDR_AXIS[axis].short}(${pdrValueKo(first[axis])})`);
  const changedAxis = changed[0];
  return {
    verified: changed.length === 1,
    preservedKo: preserved,
    ...(changed.length === 1
      ? {
          changedKo: `${PDR_AXIS[changedAxis].short}(${PDR_AXIS[changedAxis].label}): ${pdrValueKo(first[changedAxis])} → ${pdrValueKo(second[changedAxis])}`,
        }
      : {}),
    firstSituationKo: "",
    secondSituationKo: "",
  };
}

function candidatesOf(item: MpjItemRuntime): InstructorGuideCandidate[] {
  if (item.type === "fix_choice") {
    return item.corrections.map((candidate) => ({
      text: candidate.text,
      noteKo: candidate.note_ko,
      judgmentKo: candidate.is_valid ? "이 맥락에서 적정" : "조정 필요",
    }));
  }
  if (item.type === "multi_judge") {
    return item.candidates.map((candidate) => ({
      text: candidate.text,
      noteKo: candidate.note_ko,
    }));
  }
  return [{
    text: item.target,
    noteKo: item.explanation_ko,
  }];
}

function guideItemOf(
  item: MpjItemRuntime,
  id = item.id,
  titleKo = ITEM_TITLE[item.type] ?? item.type,
): InstructorGuideItem {
  return {
    id,
    titleKo,
    situationKo: item.situation_ko,
    source: item.source,
    designIntentKo: item.explanation_ko,
    candidates: candidatesOf(item),
  };
}

function guideItemsOf(items: MpjItemRuntime[]): InstructorGuideItem[] {
  const [scale, combined, reason, comparison] = items;
  const isLegacyFourStep = items.length === 4
    && scale?.type === "scale4"
    && combined?.type === "fix_choice"
    && (reason?.type === "reason" || reason?.type === "reason_conf")
    && comparison?.type === "multi_judge";
  if (!isLegacyFourStep) return items.map((item) => guideItemOf(item));

  // 학습자 정본 실행기와 동일하게 legacy의 결합 판단·교정 문항을 MPJ2/MPJ3으로 분리한다.
  return [
    guideItemOf(scale, 1),
    {
      id: 2,
      titleKo: ITEM_TITLE.judge3,
      situationKo: combined.situation_ko,
      source: combined.source,
      designIntentKo: combined.explanation_ko,
      candidates: [{ text: combined.target, noteKo: combined.explanation_ko }],
    },
    guideItemOf(combined, 3),
    guideItemOf(reason, 4),
    guideItemOf(comparison, 5),
  ];
}

function reasonSignals(items: MpjItemRuntime[]): { misconceptionKo?: string; coreReasonKo?: string } {
  const reason = items.find((item) => item.type === "reason" || item.type === "reason_conf");
  if (!reason) return {};
  if (reason.type === "reason") {
    return {
      misconceptionKo: reason.reasons.find((candidate) => candidate.kind === "pragmatic_misconception")?.text_ko,
      coreReasonKo: reason.reasons.find((candidate) => candidate.id === reason.accepted_reason_id)?.text_ko,
    };
  }
  return {
    misconceptionKo: reason.reasons.find((candidate) => !reason.accepted_reason_ids.includes(candidate.id))?.text_ko,
    coreReasonKo: reason.reasons.find((candidate) => reason.accepted_reason_ids.includes(candidate.id))?.text_ko,
  };
}

function microscopeOf(items: MpjItemRuntime[]) {
  const item = items.find((candidate) => candidate.type === "reason")
    ?? items.find((candidate) => candidate.type !== "multi_judge" && candidate.highlights.length > 0)
    ?? items[0];
  const expression = item.type === "multi_judge"
    ? item.candidates[0]?.text ?? "—"
    : item.highlights[0] ?? item.target;
  const adjustmentExample = item.recommended_example;
  return {
    expression,
    source: item.source,
    functionAndEffectKo: item.explanation_ko,
    adjustmentExample,
  };
}

/**
 * 승인된 미션 JSON을 별도 저장 구조 없이 교수자 수업자료로 투영한다.
 * 데이터에 없는 반대 맥락이나 학습자 사례는 사실처럼 생성하지 않는다.
 */
export function buildInstructorMissionGuide(
  mission: MissionRuntime,
  speechActKo = "화행",
): InstructorMissionGuide {
  const items = [...mission.mpj_items] as MpjItemRuntime[];
  const first = items[0];
  const second = items[1] ?? first;
  const contrast = comparePdr(first.pdr, second.pdr);
  contrast.firstSituationKo = first.situation_ko;
  contrast.secondSituationKo = second.situation_ko;

  const productionPdr = mission.production_task.pdr;
  const recontextItem = items.find((item) => comparePdr(item.pdr, productionPdr).verified) ?? first;
  const signals = reasonSignals(items);

  return {
    speechActKo,
    itemFocusKo: currentFeatureLabel(mission.unit.learner_label),
    situationKo: mission.production_task.situation_ko,
    relationKo: mission.production_task.relation_ko,
    pdrKo: formatPdr(productionPdr),
    burdenMeaningKo: SPEECH_ACT_R_MEANING_KO[speechActKo],
    mpjItems: guideItemsOf(items),
    ...signals,
    contrast,
    microscope: {
      ...microscopeOf(items),
      ...(speechActKo === "거절"
        ? {
            boundaryPromptLabelKo: "거절 순차 맥락 확인",
            boundaryPromptKo:
              "이 표현이 실제 최종 불수락인지, 상대의 호의·비용을 인정하며 재권유 뒤 수락 가능성을 남기는 의례적 1차 사양인지 장면 전체에서 구분하세요. 표면적으로 직접적인 사양만 보고 강한 최종 거절로 단정하지 않습니다.",
          }
        : speechActKo === "요청"
          ? {
              boundaryPromptLabelKo: "요청 표현 자원 확인",
              boundaryPromptKo:
                "직접성만 세지 말고, 이 문항에 실제로 나타난 문장 내부 완화, 외부 보조행위, 요청 본체의 앞뒤 배치 중 어느 층이 관계 효과를 만드는지 구분하세요. 특정 장치의 유무나 개수를 적절성의 자동 기준으로 쓰지 않습니다.",
            }
          : {}),
    },
    dct: {
      situationKo: mission.production_task.situation_ko,
      sourceText: mission.production_task.source_text,
      alternatives: mission.production_task.reference_alternatives.map((alternative) => ({
        text: alternative.text,
        noteKo: alternative.note_ko,
      })),
    },
    recontextualization: {
      situationKo: recontextItem.situation_ko,
      relationKo: recontextItem.relation_ko,
      promptKo: `화행 「${speechActKo}」도 이 관계와 부담에서는 어떤 표현 자원을 더하거나 덜어야 하는지 비교하세요.`,
    },
  };
}
