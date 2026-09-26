// 학습 수행 기록 「보기」 펼침 — 한 번의 수행을 학습 흐름 순서로 읽히게 묶는다.
//
// 순서 = 상황과 출발텍스트 → MJT 판단 → DCT형 통번역 과제(최초 산출·AI 피드백·학습자 결정·최종 산출)
// → 이견 → 기록 정보. 저장된 값을 옮겨 보여 줄 뿐 새 점수·판정을 만들지 않는다.
// 미션 본문은 버전마다 모양이 달라 필요한 필드만 느슨하게 읽는다(없으면 코드·번호로 남긴다).

import { GRAMMAR_LABEL, SCOPE_LABEL, SEMANTIC_LABEL } from "@/lib/pragma/feedbackSchema";
import { withinBandCodeFor } from "@/lib/pragma/missionV6";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";

/** 학습자가 고른 값 하나. label이 있으면 값 위에 작게, MJT 후보 비교에서는 후보 문장이다. */
export interface RecordChoice {
  label: string | null;
  value: string;
}

export interface MjtCard {
  id: number | null;
  activity: string;
  target: string | null;
  choices: RecordChoice[];
  /** 여러 표현 비교처럼 「표현 → 판단」 줄로 보여 줄 문항 */
  rows: RecordChoice[];
}

export interface LearningRecordDetail {
  context: {
    relation: string | null;
    situation: string | null;
    mode: string | null;
    sourceLabel: string;
    source: string | null;
  };
  mjt: MjtCard[];
  task: {
    first: string | null;
    feedback: string[];
    decision: "최초 산출 유지" | "수정" | null;
    final: string | null;
    hintOpened: boolean | null;
  };
  dissent: { conditions: string[]; reason: string | null } | null;
  meta: string[];
}

/** 펼침에 필요한 learner_mission_logs 열. */
export interface RecordDetailRow {
  feature_id: string | null;
  task_type: string | null;
  source_lang: string | null;
  target_lang: string | null;
  source_text: string | null;
  first_response: string | null;
  revised_response: string | null;
  target_feature_observed: unknown;
  context_judgment: unknown;
  content_ver: string | null;
  content_hash?: string | null;
  started_at: string | null;
  completed_at: string | null;
}

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : null);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const SCALE_LABELS: Record<string, string> = {
  very_appropriate: "매우 적절",
  somewhat_appropriate: "다소 적절",
  somewhat_inappropriate: "다소 부적절",
  very_inappropriate: "매우 부적절",
};

const ITEM_TITLES: Record<string, string> = {
  scale4: "적절성 판단",
  judge3: "맥락 대비 판단",
  fix_choice: "판단하고 고쳐 보기",
  free_correction: "직접 고쳐 쓰기",
  reason: "이유 찾기",
  multi_judge: "여러 표현 비교",
};

// 학습자 화면(CanonicalMissionRun)의 이견 조건과 같은 코드·문구.
const DISSENT_LABELS: Record<string, string> = {
  relationship: "관계·친밀도에 대한 다른 판단",
  burden: "행위의 부담 크기에 대한 다른 판단",
  preceding: "앞선 대화 흐름을 더 고려함",
  experience: "실제 사용 경험과 차이가 있음",
};

const LANG_LABEL: Record<string, string> = { ko: "한국어", zh: "중국어" };

function bandLabeler(featureId: string | null) {
  const feature = getTargetFeature(featureId ?? "");
  const labels = new Map(
    (feature?.band_schema ?? []).map((band) => [band.code, band.label_ko.replace(/\s*\([^)]*\)\s*$/, "")]),
  );
  // 요청 화행은 가운데 대역을 「appropriate」로 저장한다(동결 예외) — 화면 이름은 같은 가운데 대역이다.
  const within = featureId ? withinBandCodeFor(featureId) : null;
  return (code: unknown) => {
    if (typeof code !== "string") return "—";
    return labels.get(code)
      ?? (code === within && feature ? labels.get(feature.within_band_code) : undefined)
      ?? code;
  };
}

function mjtCards(row: RecordDetailRow, mission: Obj | null): MjtCard[] {
  const envelope = obj(row.context_judgment);
  const responses = arr(envelope?.responses).map(obj).filter((item): item is Obj => item !== null);
  const items = arr(mission?.mpj_items).map(obj);
  const band = bandLabeler(row.feature_id);

  return responses.map((trace) => {
    const id = typeof trace.item_id === "number" ? trace.item_id : null;
    const type = str(trace.item_type) ?? "";
    const item = items.find((candidate) => candidate?.id === id) ?? null;
    const choices: RecordChoice[] = [];
    if (typeof trace.scale_code === "string") {
      choices.push({ label: "판단", value: SCALE_LABELS[trace.scale_code] ?? trace.scale_code });
    }
    if (typeof trace.initial_judgment === "string") {
      choices.push({ label: "판단", value: trace.initial_judgment === "appropriate" ? "적절하다" : "적절하지 않다" });
    }
    if (typeof trace.band_code === "string") choices.push({ label: "조절 정도", value: band(trace.band_code) });
    if (typeof trace.reason_id === "string") {
      const options = arr(obj(item?.reason_choice)?.options ?? item?.reasons).map(obj);
      const option = options.find((candidate) => candidate?.id === trace.reason_id);
      choices.push({ label: "고른 이유", value: str(option?.text) ?? str(option?.text_ko) ?? trace.reason_id });
    }
    if (typeof trace.revised_scale_code === "string") {
      choices.push({ label: "이유를 본 뒤 바꾼 판단", value: SCALE_LABELS[trace.revised_scale_code] ?? trace.revised_scale_code });
    }
    for (const index of arr(trace.correction_indexes)) {
      if (typeof index !== "number") continue;
      choices.push({ label: "고른 수정안", value: str(obj(arr(item?.corrections)[index])?.text) ?? `${index + 1}번` });
    }
    if (typeof trace.revised_text === "string") choices.push({ label: "고쳐 쓴 표현", value: trace.revised_text });

    const candidates = arr(item?.candidates).map(obj);
    const candidateText = (index: number) => str(candidates[index]?.text) ?? `표현 ${index + 1}`;
    const rows: RecordChoice[] = arr(trace.candidate_band_codes).map((code, index) => ({
      label: candidateText(index),
      value: band(code),
    }));
    if (typeof trace.best_candidate_index === "number") rows.push({ label: candidateText(trace.best_candidate_index), value: "BEST" });
    if (typeof trace.worst_candidate_index === "number") rows.push({ label: candidateText(trace.worst_candidate_index), value: "WORST" });

    return {
      id,
      activity: str(item?.short_label) ?? ITEM_TITLES[type] ?? type,
      target: str(item?.target),
      choices,
      rows,
    };
  });
}

function feedbackLines(raw: unknown): string[] {
  const feedback = obj(raw);
  const verdicts = obj(feedback?.verdicts);
  if (!verdicts) return [];
  return [
    typeof verdicts.semantic_fidelity === "string" ? SEMANTIC_LABEL[verdicts.semantic_fidelity] ?? verdicts.semantic_fidelity : null,
    typeof verdicts.grammatical_accuracy === "string" ? GRAMMAR_LABEL[verdicts.grammatical_accuracy] ?? verdicts.grammatical_accuracy : null,
    typeof feedback?.revision_scope === "string"
      ? `다시 볼 곳: ${SCOPE_LABEL[feedback.revision_scope as keyof typeof SCOPE_LABEL] ?? feedback.revision_scope}`
      : null,
  ].filter((line): line is string => line !== null);
}

export function buildLearningRecordDetail(
  row: RecordDetailRow,
  mission: unknown,
  placement: string,
  formatTime: (iso: string | null) => string,
): LearningRecordDetail {
  const content = obj(mission);
  const task = obj(content?.production_task);
  const envelope = obj(row.context_judgment);
  // legacy 행은 이견 봉투가 context_judgment 자체다.
  const dissent = envelope?.kind === "learner_dissent" ? envelope : obj(envelope?.learner_dissent);
  const interpreting = row.task_type === "interpreting";
  const direction = row.source_lang && row.target_lang
    ? `${LANG_LABEL[row.source_lang] ?? row.source_lang} → ${LANG_LABEL[row.target_lang] ?? row.target_lang}`
    : null;

  const first = str(row.first_response);
  const final = str(row.revised_response);
  const decision = dissent?.final_decision === "retained_first_response"
    ? "최초 산출 유지"
    : dissent?.final_decision === "revised_response"
      ? "수정"
      : first && final
        ? (first.trim() === final.trim() ? "최초 산출 유지" : "수정")
        : null;
  const support = obj(envelope?.production_support);

  return {
    context: {
      relation: str(task?.relation_ko),
      situation: str(task?.situation_ko),
      mode: [interpreting ? "통역" : row.task_type ? "번역" : null, direction].filter(Boolean).join(" · ") || null,
      sourceLabel: interpreting ? "출발텍스트(통역 음성 전사)" : "출발텍스트",
      source: str(row.source_text),
    },
    mjt: mjtCards(row, content),
    task: {
      first,
      feedback: feedbackLines(row.target_feature_observed),
      decision,
      final,
      hintOpened: support?.available ? Boolean(support.opened) : null,
    },
    dissent: dissent
      ? {
          conditions: arr(dissent.conditions)
            .map((code) => (typeof code === "string" ? DISSENT_LABELS[code] ?? code : ""))
            .filter(Boolean),
          reason: str(dissent.reason_ko),
        }
      : null,
    meta: [
      placement,
      [row.content_ver ? `콘텐츠 ${row.content_ver}` : null, row.content_hash ? `#${row.content_hash.slice(0, 8)}` : null].filter(Boolean).join(" "),
      [row.started_at ? formatTime(row.started_at) : null, row.completed_at ? formatTime(row.completed_at) : null].filter(Boolean).join(" → "),
    ].filter(Boolean),
  };
}
