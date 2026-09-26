// 학습 수행 기록 「보기」 펼침 — 한 번의 수행을 학습 흐름 순서로 읽히게 묶는다.
//
// 순서 = 상황과 출발텍스트 → MJT 판단 → DCT형 통번역 과제(최초 산출·AI 피드백·학습자 결정·최종 산출)
// → 이견 → 기록 정보. 저장된 값을 옮겨 보여 줄 뿐 새 점수·판정을 만들지 않는다.
// 미션 본문은 버전마다 모양이 달라 필요한 필드만 느슨하게 읽는다(없으면 코드·번호로 남긴다).

import { GRAMMAR_LABEL, SCOPE_LABEL, SEMANTIC_LABEL } from "@/lib/pragma/feedbackSchema";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";

export interface RecordDetailLine {
  label: string;
  value: string;
}

export interface RecordDetailSection {
  key: "context" | "mjt" | "task" | "dissent" | "meta";
  title: string;
  lines: RecordDetailLine[];
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

function mjtLines(row: RecordDetailRow, mission: Obj | null): RecordDetailLine[] {
  const envelope = obj(row.context_judgment);
  const responses = arr(envelope?.responses).map(obj).filter((item): item is Obj => item !== null);
  const items = arr(mission?.mpj_items).map(obj);
  const bands = new Map(
    (getTargetFeature(row.feature_id ?? "")?.band_schema ?? []).map((band) => [
      band.code,
      band.label_ko.replace(/\s*\([^)]*\)\s*$/, ""),
    ]),
  );
  const band = (code: unknown) => (typeof code === "string" ? bands.get(code) ?? code : "—");

  return responses.map((trace) => {
    const id = typeof trace.item_id === "number" ? trace.item_id : null;
    const type = str(trace.item_type) ?? "";
    const item = items.find((candidate) => candidate?.id === id) ?? null;
    const parts: string[] = [];
    const target = str(item?.target);
    if (target) parts.push(`제시 표현: ${target}`);
    if (typeof trace.scale_code === "string") {
      const revised = typeof trace.revised_scale_code === "string" ? ` → 이유 확인 후 ${SCALE_LABELS[trace.revised_scale_code] ?? trace.revised_scale_code}` : "";
      parts.push(`판단: ${SCALE_LABELS[trace.scale_code] ?? trace.scale_code}${revised}`);
    }
    if (typeof trace.initial_judgment === "string") {
      parts.push(`최초 판단: ${trace.initial_judgment === "appropriate" ? "적절하다" : "적절하지 않다"}`);
    }
    if (typeof trace.band_code === "string") parts.push(`조절 정도: ${band(trace.band_code)}`);
    if (typeof trace.reason_id === "string") {
      const options = arr(obj(item?.reason_choice)?.options ?? item?.reasons).map(obj);
      const option = options.find((candidate) => candidate?.id === trace.reason_id);
      parts.push(`고른 이유: ${str(option?.text) ?? str(option?.text_ko) ?? trace.reason_id}`);
    }
    for (const index of arr(trace.correction_indexes)) {
      if (typeof index !== "number") continue;
      const text = str(obj(arr(item?.corrections)[index])?.text);
      parts.push(`고른 수정안: ${text ?? `${index + 1}번`}`);
    }
    if (typeof trace.revised_text === "string") parts.push(`고쳐 쓴 표현: ${trace.revised_text}`);
    const candidates = arr(item?.candidates).map(obj);
    arr(trace.candidate_band_codes).forEach((code, index) => {
      parts.push(`${str(candidates[index]?.text) ?? `표현 ${index + 1}`} → ${band(code)}`);
    });
    if (typeof trace.best_candidate_index === "number") parts.push(`BEST: ${str(candidates[trace.best_candidate_index]?.text) ?? `${trace.best_candidate_index + 1}번`}`);
    if (typeof trace.worst_candidate_index === "number") parts.push(`WORST: ${str(candidates[trace.worst_candidate_index]?.text) ?? `${trace.worst_candidate_index + 1}번`}`);

    const activity = str(item?.short_label) ?? ITEM_TITLES[type] ?? type;
    return { label: `MJT${id ?? "?"} · ${activity}`, value: parts.join("\n") || "—" };
  });
}

function feedbackSummary(raw: unknown): string | null {
  const feedback = obj(raw);
  const verdicts = obj(feedback?.verdicts);
  if (!verdicts) return null;
  const parts = [
    typeof verdicts.semantic_fidelity === "string" ? `의미 전달: ${SEMANTIC_LABEL[verdicts.semantic_fidelity] ?? verdicts.semantic_fidelity}` : null,
    typeof verdicts.grammatical_accuracy === "string" ? `언어 형식: ${GRAMMAR_LABEL[verdicts.grammatical_accuracy] ?? verdicts.grammatical_accuracy}` : null,
    typeof feedback?.revision_scope === "string" ? `다시 볼 곳: ${SCOPE_LABEL[feedback.revision_scope as keyof typeof SCOPE_LABEL] ?? feedback.revision_scope}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join("\n") : null;
}

export function buildLearningRecordDetail(
  row: RecordDetailRow,
  mission: unknown,
  placement: string,
  formatTime: (iso: string | null) => string,
): RecordDetailSection[] {
  const content = obj(mission);
  const task = obj(content?.production_task);
  const envelope = obj(row.context_judgment);
  // legacy 행은 이견 봉투가 context_judgment 자체다.
  const dissent = envelope?.kind === "learner_dissent" ? envelope : obj(envelope?.learner_dissent);
  const interpreting = row.task_type === "interpreting";
  const direction = row.source_lang && row.target_lang
    ? `${LANG_LABEL[row.source_lang] ?? row.source_lang} → ${LANG_LABEL[row.target_lang] ?? row.target_lang}`
    : null;

  const context: RecordDetailLine[] = [
    { label: "관계", value: str(task?.relation_ko) ?? "" },
    { label: "상황", value: str(task?.situation_ko) ?? "" },
    { label: "수행 방식", value: [interpreting ? "통역" : row.task_type ? "번역" : null, direction].filter(Boolean).join(" · ") },
    { label: interpreting ? "출발텍스트(통역 음성 전사)" : "출발텍스트", value: row.source_text ?? "" },
  ];

  const first = row.first_response ?? "";
  const final = row.revised_response ?? "";
  const decision = dissent?.final_decision === "retained_first_response"
    ? "최초 산출 유지"
    : dissent?.final_decision === "revised_response"
      ? "수정"
      : first && final
        ? (first.trim() === final.trim() ? "최초 산출 유지" : "수정")
        : "";
  const support = obj(envelope?.production_support);
  const taskLines: RecordDetailLine[] = [
    { label: "최초 산출", value: first },
    { label: "AI 피드백", value: feedbackSummary(row.target_feature_observed) ?? "" },
    { label: "학습자의 결정", value: decision },
    { label: "최종 산출", value: final },
    { label: "어휘 힌트", value: support?.available ? (support.opened ? "열어 봄" : "열지 않음") : "" },
  ];

  const dissentLines: RecordDetailLine[] = dissent
    ? [{
        label: "AI 피드백에 대한 이견",
        value: [
          arr(dissent.conditions).map((code) => (typeof code === "string" ? DISSENT_LABELS[code] ?? code : "")).filter(Boolean).join(", "),
          str(dissent.reason_ko),
        ].filter(Boolean).join("\n"),
      }]
    : [];

  const meta: RecordDetailLine[] = [
    { label: "교과목·주차", value: placement },
    { label: "콘텐츠 버전", value: [row.content_ver, row.content_hash ? `#${row.content_hash.slice(0, 8)}` : null].filter(Boolean).join(" · ") },
    { label: "수행 시각", value: [row.started_at ? `시작 ${formatTime(row.started_at)}` : null, row.completed_at ? `완료 ${formatTime(row.completed_at)}` : null].filter(Boolean).join(" · ") },
  ];

  const keep = (lines: RecordDetailLine[]) => lines.filter((line) => line.value.trim() !== "");
  const sections: RecordDetailSection[] = [
    { key: "context", title: "상황과 출발텍스트", lines: keep(context) },
    { key: "mjt", title: "MJT 판단", lines: keep(mjtLines(row, content)) },
    { key: "task", title: "DCT형 통번역 과제", lines: keep(taskLines) },
    { key: "dissent", title: "이견", lines: keep(dissentLines) },
    { key: "meta", title: "기록 정보", lines: keep(meta) },
  ];
  return sections.filter((section) => section.lines.length > 0);
}
