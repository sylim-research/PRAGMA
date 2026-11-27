import type { MyMissionLogEntry } from "@/lib/mission/missionLog";
import { MODE_LABEL, SPEECH_ACT_UI } from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";

export interface CountedReportItem {
  key: string;
  label: string;
  count: number;
}

export interface BandDistributionItem {
  code: string;
  label: string;
  count: number;
  position: "low" | "within" | "high";
}

export interface RecentExpressionSignal {
  expression: string;
  learnerCopy: string;
  count: number;
  total: number;
  olderCount: number;
}

export interface PrimaryCohortReport {
  key: string;
  featureKey: string;
  featureLabel: string;
  speechActKey: string | null;
  speechActLabel: string;
  taskType: string | null;
  taskTypeLabel: string;
  targetLang: string | null;
  attemptCount: number;
  bandObservationCount: number;
  bands: BandDistributionItem[];
  dominantNonWithin: BandDistributionItem | null;
  recentExpression: RecentExpressionSignal | null;
}

export interface CorrectionNote {
  entry: MyMissionLogEntry;
  speechActLabel: string;
  reasonLabel: string;
}

export interface LearnerReportSummary {
  attemptCount: number;
  revisedCount: number;
  speechActs: CountedReportItem[];
  taskTypes: CountedReportItem[];
  primaryCohort: PrimaryCohortReport | null;
  headline: string;
  correctionNotes: CorrectionNote[];
  nextStep: string;
}

// 목표 특징의 학습자용 이름. 리포트와 강좌 카드가 같은 말을 쓰도록 여기서만 정한다.
export const FRIENDLY_FEATURE_LABEL: Record<string, string> = {
  request_mitigation_optionality: "부탁을 부드럽게 말하기",
  refusal_softening: "거절을 부드럽고 분명하게 말하기",
  gratitude_calibration: "도움의 크기에 맞게 감사하기",
  apology_accountability_repair: "책임과 해결 방법을 담아 사과하기",
  proposal_optionality_clarity: "상대가 고를 수 있게 제안하기",
  invitation_choice_commitment: "부담 없이 답할 수 있게 초대하기",
  opposition_stance_mitigation: "입장을 분명하고 부드럽게 반대하기",
  compliment_grounding_sensitivity: "근거를 들어 구체적으로 칭찬하기",
  compliment_response_uptake: "칭찬을 자연스럽게 받아들이기",
  complaint_problem_accountability: "문제와 영향을 구체적으로 말하기",
};

const FRIENDLY_BAND_LABEL: Record<string, Record<string, string>> = {
  request_mitigation_optionality: {
    too_direct: "조금 단정적으로 들림",
    within_band: "알맞은 범위",
    too_indirect: "지나치게 조심스러움",
  },
};

// 누적 AI 피드백은 처방이나 진단으로 확대하지 않고, 다음 수행에서 스스로
// 점검할 수 있는 중립적인 회고 질문 한 문장으로만 환류한다.
const NEXT_STEP_BY_FEATURE: Record<string, string> = {
  request_mitigation_optionality:
    "이번 관계와 부담에서 요청의 분명함과 상대의 선택 여지는 어떻게 균형을 이루었나요?",
  refusal_softening:
    "거절 의사는 분명하면서도 관계를 불필요하게 해치지 않는 표현이었나요?",
  gratitude_calibration:
    "받은 도움의 크기와 관계에 비추어 감사 표현의 강도는 알맞았나요?",
  apology_accountability_repair:
    "이번 사과는 책임과 상대가 받은 영향, 이후의 보상을 어떻게 드러냈나요?",
  proposal_optionality_clarity:
    "제안의 핵심과 상대가 선택할 수 있는 여지가 함께 드러났나요?",
  invitation_choice_commitment:
    "초대 의도는 분명하되 상대가 부담 없이 답할 수 있었나요?",
  opposition_stance_mitigation:
    "반대 입장과 관계를 고려한 완화가 각각 충분히 드러났나요?",
  compliment_grounding_sensitivity:
    "칭찬의 강도와 구체적인 근거는 이번 관계와 장면에 알맞았나요?",
  compliment_response_uptake:
    "상대의 칭찬을 자연스럽게 받아들이면서도 나의 태도를 유지했나요?",
  complaint_problem_accountability:
    "문제와 실제 영향, 상대에게 바라는 조치가 구분되어 드러났나요?",
};

const EXPRESSION_COPY: Record<string, string> = {
  "如果方便的话": "“가능하다면…”",
  "要是可以的话": "“가능하다면…”",
  能不能: "“~할 수 있을까요?”",
  "可以…吗": "“~해도 될까요?”",
  "…行吗": "“~해도 괜찮을까요?”",
  "您看方便吗": "“괜찮으실까요?”",
};

// 라벨은 받침 유무가 섞여 있다("완화와 선택권"=받침 / "문제 명료화와 책임 범위"=모음).
// 조사를 하드코딩하면 "들림'로"처럼 깨지므로 항상 이 함수로 고른다.
const JOSA_FORMS = {
  을: ["을", "를"],
  를: ["을", "를"],
  은: ["은", "는"],
  는: ["은", "는"],
  이: ["이", "가"],
  가: ["이", "가"],
  과: ["과", "와"],
  와: ["과", "와"],
  로: ["으로", "로"],
  으로: ["으로", "로"],
} as const;

export function josa(word: string, form: keyof typeof JOSA_FORMS): string {
  const [withFinal, withoutFinal] = JOSA_FORMS[form];
  // 따옴표·괄호 같은 후행 기호를 걷어내고 마지막 글자를 본다.
  const cleaned = word.replace(/[^\p{L}\p{N}]+$/u, "");
  const code = cleaned.charCodeAt(cleaned.length - 1);
  // 한글 음절이 아니면(중국어·영문·기호) 받침을 판정할 수 없어 기본형을 쓴다.
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return withoutFinal;
  const finalConsonant = (code - 0xac00) % 28;
  if (finalConsonant === 0) return withoutFinal;
  // ㄹ 받침은 '으로'가 아니라 '로'를 쓴다.
  if (finalConsonant === 8 && (form === "로" || form === "으로")) return "로";
  return withFinal;
}

const plainBandLabel = (label: string) => label.replace(/\s*\([^)]*\)\s*$/, "");

export const friendlyFeatureLabel = (featureKey: string, fallback: string) =>
  FRIENDLY_FEATURE_LABEL[featureKey] ?? fallback;

function speechActLabel(entry: MyMissionLogEntry): string {
  return (
    (entry.speechAct &&
      SPEECH_ACT_UI[entry.speechAct as keyof typeof SPEECH_ACT_UI]) ||
    "소통"
  );
}

function correctionReason(entry: MyMissionLogEntry): string {
  if (entry.revisionScope === "meaning") return "뜻을 정확히 옮기기";
  if (entry.revisionScope === "grammar") return "문장을 자연스럽게 다듬기";
  if (entry.featureId) {
    const feature = getTargetFeature(entry.featureId);
    if (feature) {
      return friendlyFeatureLabel(entry.featureId, feature.learner_label);
    }
  }
  return entry.revisionSource === "learner_free"
    ? "스스로 표현 다듬기"
    : "피드백을 반영해 다듬기";
}

function buildCorrectionNotes(entries: MyMissionLogEntry[]): CorrectionNote[] {
  return entries
    .filter(
      (entry) =>
        entry.revised &&
        Boolean(entry.firstResponse) &&
        Boolean(entry.revisedResponse),
    )
    .map((entry) => ({
      entry,
      speechActLabel: speechActLabel(entry),
      reasonLabel: correctionReason(entry),
    }));
}

function countItems(
  entries: MyMissionLogEntry[],
  pick: (entry: MyMissionLogEntry) => { key: string; label: string } | null,
): CountedReportItem[] {
  const counts = new Map<string, CountedReportItem & { firstIndex: number }>();
  entries.forEach((entry, index) => {
    const item = pick(entry);
    if (!item) return;
    const previous = counts.get(item.key);
    counts.set(item.key, {
      ...item,
      count: (previous?.count ?? 0) + 1,
      firstIndex: previous?.firstIndex ?? index,
    });
  });
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
    .map(({ key, label, count }) => ({ key, label, count }));
}

function catalogueExpressions(entry: MyMissionLogEntry): string[] {
  if (!entry.featureId) return [];
  const feature = getTargetFeature(entry.featureId);
  if (!feature) return [];
  const resources =
    entry.targetLang === "ko"
      ? feature.relevant_resources_zh_ko ?? []
      : feature.relevant_resources;

  return resources.flatMap((resource) => {
    const examples = resource.match(/\(([^)]+)\)/)?.[1];
    if (!examples) return [];
    return examples
      .split("·")
      .map((item) => item.trim())
      .filter((item) => {
        const letters = item.replace(/[^\p{L}\p{N}]/gu, "");
        return letters.length >= 2 && !item.startsWith("-") && !item.includes("/");
      });
  });
}

function expressionPattern(expression: string): RegExp {
  const pieces = expression
    .split("…")
    .map((piece) => piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(pieces.join("[\\s\\S]{0,24}"), "u");
}

function countExpression(entries: MyMissionLogEntry[], expression: string): number {
  const pattern = expressionPattern(expression);
  return entries.filter((entry) => pattern.test(entry.firstResponse ?? "")).length;
}

function findRecentExpression(
  entries: MyMissionLogEntry[],
): RecentExpressionSignal | null {
  const total = Math.min(4, entries.length);
  if (total < 3) return null;
  const recent = entries.slice(0, total);
  const older = entries.slice(total);
  const expressions = [...new Set(entries.flatMap(catalogueExpressions))];
  const candidates = expressions
    .map((expression) => ({
      expression,
      count: countExpression(recent, expression),
      olderCount: countExpression(older, expression),
    }))
    .filter((item) => item.count >= 2)
    .sort(
      (a, b) =>
        a.olderCount - b.olderCount ||
        b.count - a.count ||
        b.expression.length - a.expression.length,
    );
  const top = candidates[0];
  if (!top) return null;
  return {
    ...top,
    total,
    learnerCopy: EXPRESSION_COPY[top.expression] ?? `“${top.expression}”`,
  };
}

function cohortKey(entry: MyMissionLogEntry): string | null {
  if (!entry.featureId) return null;
  return [
    entry.featureId,
    entry.taskType ?? "unknown-task",
    entry.targetLang ?? "unknown-lang",
    entry.featureVersion ?? "unknown-feature-version",
    entry.feedbackRubricVersion ?? "unknown-rubric-version",
  ].join("\u0000");
}

function buildPrimaryCohort(entries: MyMissionLogEntry[]): {
  report: PrimaryCohortReport;
  entries: MyMissionLogEntry[];
} | null {
  const cohorts = new Map<
    string,
    { entries: MyMissionLogEntry[]; firstIndex: number }
  >();
  entries.forEach((entry, index) => {
    const key = cohortKey(entry);
    if (!key) return;
    const previous = cohorts.get(key);
    cohorts.set(key, {
      entries: [...(previous?.entries ?? []), entry],
      firstIndex: previous?.firstIndex ?? index,
    });
  });
  const primary = [...cohorts.entries()].sort(
    (a, b) =>
      b[1].entries.length - a[1].entries.length ||
      a[1].firstIndex - b[1].firstIndex,
  )[0];
  if (!primary) return null;

  const [key, cohort] = primary;
  const sample = cohort.entries[0];
  const feature = sample.featureId ? getTargetFeature(sample.featureId) : null;
  if (!sample.featureId || !feature) return null;

  const bandCounts = new Map<string, number>();
  cohort.entries.forEach((entry) => {
    if (!entry.pragmaticBandCode) return;
    if (!feature.band_schema.some((band) => band.code === entry.pragmaticBandCode)) return;
    bandCounts.set(
      entry.pragmaticBandCode,
      (bandCounts.get(entry.pragmaticBandCode) ?? 0) + 1,
    );
  });
  const withinIndex = feature.band_schema.findIndex(
    (band) => band.code === feature.within_band_code,
  );
  const bands = feature.band_schema.map((band, index): BandDistributionItem => ({
    code: band.code,
    label:
      FRIENDLY_BAND_LABEL[sample.featureId ?? ""]?.[band.code] ??
      plainBandLabel(band.label_ko),
    count: bandCounts.get(band.code) ?? 0,
    position:
      band.code === feature.within_band_code
        ? "within"
        : index < withinIndex
          ? "low"
          : "high",
  }));
  const bandObservationCount = bands.reduce((sum, band) => sum + band.count, 0);
  const dominantNonWithin = bands
    .filter((band) => band.position !== "within" && band.count > 0)
    .sort((a, b) => b.count - a.count)[0] ?? null;

  return {
    report: {
      key,
      featureKey: sample.featureId,
      featureLabel: friendlyFeatureLabel(sample.featureId, feature.learner_label),
      speechActKey: sample.speechAct,
      speechActLabel: speechActLabel(sample),
      taskType: sample.taskType,
      taskTypeLabel:
        sample.taskType === "interpreting"
          ? MODE_LABEL.stt_interpreting
          : MODE_LABEL.translation,
      targetLang: sample.targetLang,
      attemptCount: cohort.entries.length,
      bandObservationCount,
      bands,
      dominantNonWithin,
      recentExpression: findRecentExpression(cohort.entries),
    },
    entries: cohort.entries,
  };
}

function headlineOf(
  attemptCount: number,
  primary: PrimaryCohortReport | null,
): string {
  const pattern = primary?.dominantNonWithin;
  const enoughPattern =
    primary && primary.bandObservationCount >= 3 && pattern && pattern.count >= 2;
  if (!primary || !enoughPattern || !pattern) {
    return `${attemptCount}회의 기록이 쌓였어요. 아직 같은 조건에서 반복된 표현 방식은 더 관찰하고 있어요.`;
  }
  const recent = primary.recentExpression;
  if (primary.featureKey === "request_mitigation_optionality") {
    return recent
      ? `요청할 때 부탁이 조금 단정적으로 들리는 경우가 반복됐지만, 최근에는 ${recent.learnerCopy} 표현을 써보기도 했어요.`
      : "요청할 때 부탁이 조금 단정적으로 들리는 경우가 반복됐어요. 다음에는 가능한지 묻는 표현도 한 번 시도해보세요.";
  }
  const bandJosa = josa(pattern.label, "로");
  return recent
    ? `${primary.speechActLabel}에서 ‘${pattern.label}’${bandJosa} 안내된 표현이 반복됐고, 최근에는 ${recent.learnerCopy} 표현을 써보기도 했어요.`
    : `${primary.speechActLabel}에서 ‘${pattern.label}’${bandJosa} 안내된 표현이 ${pattern.count}/${primary.bandObservationCount}회 관찰됐어요.`;
}

function nextStepOf(primary: PrimaryCohortReport | null): string {
  if (!primary) {
    return "이 표현을 상대가 어떻게 받아들일지 설명할 수 있나요?";
  }
  return (
    NEXT_STEP_BY_FEATURE[primary.featureKey] ??
    `이번 표현에서 ‘${primary.featureLabel}’${josa(primary.featureLabel, "이")} 어떻게 드러났나요?`
  );
}

export interface FocusCarryOver {
  featureKey: string;
  featureLabel: string;
  speechActLabel: string;
  advice: string;
}

/**
 * 다음 수행에서 다시 생각해 볼 질문 — 가장 최근 수행의 초점을 그대로 잇는다.
 *
 * ⚠️ 저장된 개별 피드백을 해석한 문장이 아니라 **요소별 고정 회고 질문**이다. 화면에서는
 * 반드시 어느 수행·어느 초점에서 왔는지 함께 보여, 개인화된 피드백 해석으로 읽히지
 * 않게 한다. (누적 리포트의 nextStep은 최근 수행이 아니라 가장 큰 비교 집단을 쓰므로
 * 이월 표시에는 쓰지 않는다.)
 */
export function latestFocusCarryOver(
  entries: MyMissionLogEntry[],
): FocusCarryOver | null {
  // entries는 최신순이다(listMyMissionLogs: created_at desc).
  const latest = entries.find((entry) => entry.featureId);
  if (!latest?.featureId) return null;
  const advice = NEXT_STEP_BY_FEATURE[latest.featureId];
  if (!advice) return null;
  const feature = getTargetFeature(latest.featureId);
  return {
    featureKey: latest.featureId,
    featureLabel: friendlyFeatureLabel(latest.featureId, feature?.learner_label ?? ""),
    speechActLabel: speechActLabel(latest),
    advice,
  };
}

export function buildLearnerReport(
  entries: MyMissionLogEntry[],
): LearnerReportSummary {
  const primary = buildPrimaryCohort(entries);

  return {
    attemptCount: entries.length,
    revisedCount: entries.filter((entry) => entry.revised).length,
    speechActs: countItems(entries, (entry) => {
      if (!entry.speechAct) return null;
      return {
        key: entry.speechAct,
        label:
          SPEECH_ACT_UI[entry.speechAct as keyof typeof SPEECH_ACT_UI] ??
          entry.speechAct,
      };
    }),
    taskTypes: countItems(entries, (entry) => {
      if (!entry.taskType) return null;
      return {
        key: entry.taskType,
        label:
          entry.taskType === "interpreting"
            ? MODE_LABEL.stt_interpreting
            : MODE_LABEL.translation,
      };
    }),
    primaryCohort: primary?.report ?? null,
    headline: headlineOf(entries.length, primary?.report ?? null),
    correctionNotes: buildCorrectionNotes(entries),
    nextStep: nextStepOf(primary?.report ?? null),
  };
}
