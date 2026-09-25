// mission_v6 생성 결과(모델이 쓴 내용 필드) → 저장 가능한 v6 초안.
//
// 모델에게 맡기지 않는 것은 여기서 넣는다: 문항 고정 문구·짧은 이름, 척도 코드 쌍, 5번 제목,
// unit(카탈로그 복사), DCT 원문·핵심 구간·PDR·방식·재생 횟수(코어 계승), provenance·authoring.
// 스키마·규칙 검사는 호출자가 MissionV6Schema·checkMission으로 한다. 이 파일의 저작 검사는
// 새 생성 정책에만 걸리는 기계적 확인(이유 3개·정답 이유 참조·코어 계승 동등)이다.

import {
  MISSION_V6_GENERATION_PROMPT_VERSION,
  type V6CoreForPrompt,
  type V6Direction,
  type V6FeatureForPrompt,
  type V6Mode,
  type V6SpeechAct,
} from "../../../supabase/functions/_shared/missionV6Generation.ts";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease.ts";
import { getTargetFeature } from "./targetFeatures";
import { withinBandCodeFor } from "./missionV6";

const SHORT_LABELS = ["첫인상 판단", "맥락 판단", "선택교정", "직접 고쳐 보기", "네 표현 비교"] as const;
const PROMPTS = {
  fix_choice: "원문의 핵심 의미와 화행 목적을 지키면서 이 상황에 맞게 고친 표현을 골라보세요.",
  free_correction: "원문의 핵심 의미와 화행 목적을 지키면서 필요한 부분을 직접 고쳐 보세요.",
  multi_judge: "각 표현을 읽고, 이 상황에서 어떻게 들리는지 판단해 보세요.",
  reason: "가장 큰 이유는 무엇인가요?",
} as const;
const MJT5_TITLE = "각 표현은 어디쯤에 놓일까요?";
const SCALES = {
  appropriate: { accepted: ["very_appropriate", "somewhat_appropriate"], reference: "very_appropriate" },
  inappropriate: { accepted: ["somewhat_inappropriate", "very_inappropriate"], reference: "somewhat_inappropriate" },
} as const;
/** 통역 DCT의 재생 횟수 — 기존 v5 통역 정책과 같다(generate-scenario mission 액션). */
const INTERPRETING_REPLAY_LIMIT = 2;

export function featureForV6Prompt(featureCode: string, direction: V6Direction): V6FeatureForPrompt {
  const feature = getTargetFeature(featureCode);
  if (!feature) throw new Error(`카탈로그에 없는 초점: ${featureCode}`);
  const zh = <T,>(base: T, variant: T | undefined) => (direction === "zh_ko" && variant ? variant : base);
  return {
    code: feature.code,
    learner_label: feature.learner_label,
    operational_definition: zh(feature.operational_definition, feature.operational_definition_zh_ko),
    band_schema: feature.band_schema.map(band => ({ code: band.code, label_ko: band.label_ko })),
    within_band_code: withinBandCodeFor(feature.code),
    relevant_resources: zh(feature.relevant_resources, feature.relevant_resources_zh_ko),
    excluded_confounds: zh(feature.excluded_confounds, feature.excluded_confounds_zh_ko),
    counter_rule_note: zh(feature.counter_rule_note, feature.counter_rule_note_zh_ko),
    fidelity_note: feature.fidelity_note,
  };
}

export interface V6AssembleInput {
  raw: unknown;
  core: V6CoreForPrompt & { source_modality?: string };
  act: V6SpeechAct;
  direction: V6Direction;
  mode: V6Mode;
  featureCode: string;
  model: string;
  generationAttempt: number;
  repaired: boolean;
  /** 브라우저(crypto.subtle, 비동기)·Node 공용이 되도록 해시 함수는 호출자가 준다. */
  sha256Hex: (text: string) => string | Promise<string>;
}

export interface V6AuthoringIssue {
  level: "fail" | "warning";
  path: string;
  message: string;
}

type AnyRecord = Record<string, any>;
const str = (value: unknown) => (typeof value === "string" ? value : "");
const scene = (item: AnyRecord) => ({
  situation_ko: str(item.situation_ko),
  relation_ko: str(item.relation_ko),
  channel: item.channel,
  pdr: item.pdr,
  learner_context_ko: str(item.learner_context_ko),
  preceding_turn: null,
});

export async function assembleMissionV6Draft(input: V6AssembleInput): Promise<{ draft: AnyRecord; issues: V6AuthoringIssue[] }> {
  const { raw, core, act, direction, mode, featureCode } = input;
  const issues: V6AuthoringIssue[] = [];
  const out = (raw ?? {}) as AnyRecord;
  const items = Array.isArray(out.items) ? (out.items as AnyRecord[]) : [];
  const byId = (id: number) => items.find(item => Number(item?.id) === id) ?? {};
  const feature = getTargetFeature(featureCode);
  if (!feature) throw new Error(`카탈로그에 없는 초점: ${featureCode}`);
  const scalePrompt = mode === "interpreting" ? "이 통역안은 이 상황에 얼마나 잘 맞나요?" : "이 번역안은 이 상황에 얼마나 잘 맞나요?";

  const scaleFor = (item: AnyRecord, fallback: keyof typeof SCALES, index: number) => {
    const judgment = item.judgment === "appropriate" || item.judgment === "inappropriate" ? item.judgment : null;
    if (!judgment) issues.push({ level: "warning", path: `items[${index}].judgment`, message: `judgment 누락 — 템플릿 기본값 ${fallback} 사용` });
    const scale = SCALES[judgment ?? fallback];
    return { accepted_scale_codes: [...scale.accepted], reference_scale_code: scale.reference };
  };
  const examples = (value: unknown) => {
    const list = Array.isArray(value) ? value.map(str).filter(text => text.trim()) : [];
    return list.length ? { revision_examples: list.slice(0, 2) } : {};
  };

  const i1 = byId(1), i2 = byId(2), i3 = byId(3), i4 = byId(4), i5 = byId(5);
  const reasons = Array.isArray(i2.reason_options) ? (i2.reason_options as AnyRecord[]).map(o => ({ id: str(o.id), text: str(o.text) })) : [];
  const contrast = i4.contrast && str(i4.contrast.target).trim()
    ? { contrast: { context_ko: str(i4.contrast.context_ko), target: str(i4.contrast.target), explanation_ko: str(i4.contrast.explanation_ko) } }
    : {};

  const mpj_items = [
    { id: 1, type: "scale4", ...scene(i1), short_label: SHORT_LABELS[0], title: str(i1.title), prompt: scalePrompt,
      source: str(i1.source), target: str(i1.target), ...scaleFor(i1, "appropriate", 0),
      explanation_ko: str(i1.explanation_ko), ...examples(i1.revision_examples) },
    { id: 2, type: "scale4", ...scene(i2), short_label: SHORT_LABELS[1], title: str(i2.title), prompt: scalePrompt,
      source: str(i2.source), target: str(i2.target), ...scaleFor(i2, "inappropriate", 1),
      explanation_ko: str(i2.explanation_ko), ...examples(i2.revision_examples),
      reason_choice: { prompt: PROMPTS.reason, options: reasons, accepted_id: str(i2.accepted_reason_id) } },
    { id: 3, type: "fix_choice", ...scene(i3), short_label: SHORT_LABELS[2], title: str(i3.title), prompt: PROMPTS.fix_choice,
      source: str(i3.source), target: str(i3.target),
      corrections: (Array.isArray(i3.corrections) ? i3.corrections : []).map((c: AnyRecord) => ({ text: str(c.text), is_valid: c.is_valid === true, note_ko: str(c.note_ko) })),
      explanation_ko: str(i3.explanation_ko) },
    { id: 4, type: "free_correction", ...scene(i4), short_label: SHORT_LABELS[3], title: str(i4.title), prompt: PROMPTS.free_correction,
      source: str(i4.source), target: str(i4.target),
      reference_alternatives: (Array.isArray(i4.reference_alternatives) ? i4.reference_alternatives : []).map(str).filter((t: string) => t.trim()).slice(0, 2),
      explanation_ko: str(i4.explanation_ko), ...contrast },
    { id: 5, type: "multi_judge", ...scene(i5), short_label: SHORT_LABELS[4], title: MJT5_TITLE, prompt: PROMPTS.multi_judge,
      source: str(i5.source),
      candidates: (Array.isArray(i5.candidates) ? i5.candidates : []).map((c: AnyRecord) => ({
        text: str(c.text), accepted_band_codes: Array.isArray(c.accepted_band_codes) ? c.accepted_band_codes.map(str) : [], note_ko: str(c.note_ko),
      })) },
  ];

  const dct = (out.dct ?? {}) as AnyRecord;
  const hints = Array.isArray(dct.vocabulary_hints)
    ? (dct.vocabulary_hints as AnyRecord[]).map(h => ({ source: str(h.source), target: str(h.target) })).filter(h => h.source && h.target)
    : [];
  const production_task = {
    mode,
    source_modality: mode === "interpreting" ? "spoken" : "written",
    situation_ko: str(dct.situation_ko),
    relation_ko: str(dct.relation_ko),
    ...(core.channel ? { channel: core.channel } : {}),
    pdr: core.pdr,
    source_text: core.source_text,
    preceding_turn: null,
    focal_segments: core.focal_segments,
    ...(core.usable_facts?.length ? { usable_facts: core.usable_facts } : {}),
    ...(mode === "interpreting" ? { replay_limit: INTERPRETING_REPLAY_LIMIT } : {}),
    ...(mode === "translation" && hints.length === 2 ? { vocabulary_hints: hints } : {}),
    reference_alternatives: (Array.isArray(dct.reference_alternatives) ? dct.reference_alternatives : [])
      .map((a: AnyRecord) => ({ text: str(a.text), note_ko: str(a.note_ko) })).slice(0, 2),
    learner_context_ko: str(dct.learner_context_ko),
  };

  const draft: AnyRecord = {
    schema_version: "mission_v6",
    direction,
    learning_goal: { kind: "speech_act", speech_act: act },
    unit: {
      target_feature: feature.code,
      target_feature_version: feature.version,
      learner_label: feature.learner_label,
      closing_ko: feature.closing_principle_ko,
    },
    mpj_items,
    lesson_points: (Array.isArray(out.lesson_points) ? out.lesson_points : [])
      .map((p: AnyRecord) => ({ item_id: Number(p.item_id), label: str(p.label), text: str(p.text) })),
    production_task,
  };
  draft.authoring = {
    schema_version: "mission_authoring_v1",
    stage: input.repaired ? "ai_repaired" : "ai_draft",
    lineage_status: "pending",
    repair_attempts: input.repaired ? 1 : 0,
  };
  // 기존 v6 등록 스크립트와 같은 산식(내용만, JSON.stringify). 운영 저장 전에 최종화 경로의 산식과 맞출 것.
  const hashPayload = { ...draft };
  delete hashPayload.authoring;
  draft.provenance = {
    provider: "openai",
    model: input.model,
    prompt_version: MISSION_V6_GENERATION_PROMPT_VERSION,
    content_release_id: CURRENT_CONTENT_RELEASE_ID,
    mission_content_hash: await input.sha256Hex(JSON.stringify(hashPayload)),
    generated_at: new Date().toISOString(),
    generation_attempt: input.generationAttempt,
  };

  issues.push(...checkV6Authoring(draft, core));
  return { draft, issues };
}

/** 새 생성 정책에만 거는 기계적 확인. 의미 판단(오답이 실제로 작동하는가 등)은 하지 않는다. */
export function checkV6Authoring(draft: AnyRecord, core: V6CoreForPrompt): V6AuthoringIssue[] {
  const issues: V6AuthoringIssue[] = [];
  const items = draft.mpj_items as AnyRecord[];
  const reason = items[1]?.reason_choice;
  if (!reason || reason.options.length !== 3) issues.push({ level: "fail", path: "mpj_items[1].reason_choice.options", message: "이유 선택지는 정확히 3개" });
  if (reason && !reason.options.some((o: AnyRecord) => o.id === reason.accepted_id)) {
    issues.push({ level: "fail", path: "mpj_items[1].reason_choice.accepted_id", message: "정답 이유 id가 선택지에 없음" });
  }
  const valid = (items[2]?.corrections ?? []).filter((c: AnyRecord) => c.is_valid).length;
  // 새 생성 정책에서만 fail(수리 대상). v6 계약은 적절 1개 이상만 요구하므로 과거 저장본에는 걸지 않는다.
  if (valid !== 1) issues.push({ level: "fail", path: "mpj_items[2].corrections", message: `적절 교정안 ${valid}개 — 새 생성은 적절 정확히 1개(나머지 2개는 결함이 남은 선택지)` });
  const sources = items.map(item => str(item.source).trim());
  if (new Set(sources).size !== sources.length) issues.push({ level: "fail", path: "mpj_items[].source", message: "문항 원문이 중복됨" });
  if (sources.some(source => source === core.source_text.trim())) issues.push({ level: "fail", path: "mpj_items[].source", message: "문항 원문이 DCT 시나리오 원문과 같음" });
  const fixTarget = str(items[2]?.target).trim();
  if ((items[2]?.corrections ?? []).some((c: AnyRecord) => str(c.text).trim() === fixTarget)) {
    issues.push({ level: "fail", path: "mpj_items[2].corrections", message: "선택지에 교정 대상 문장(target)이 그대로 들어 있음" });
  }
  if ((draft.production_task as AnyRecord)?.mode === "interpreting") {
    items.forEach((item, index) => {
      if (item.channel !== "facetoface" && item.channel !== "phone") issues.push({ level: "fail", path: `mpj_items[${index}].channel`, message: "통역 미션 문항은 대면·전화 장면" });
    });
  }
  items.forEach((item, index) => {
    if (/[?？]\s*$/.test(str(item.title)) && index < 4) issues.push({ level: "warning", path: `mpj_items[${index}].title`, message: "질문형 제목 — 판단 방향 암시 여부 확인" });
  });
  const task = draft.production_task as AnyRecord;
  const head = core.focal_segments.find(segment => segment.role === "head")?.text ?? "";
  if (head && str(task.situation_ko).includes(head)) issues.push({ level: "fail", path: "production_task.situation_ko", message: "DCT 상황문에 원문 문장을 옮겨 적음" });
  if (task.source_text !== core.source_text || JSON.stringify(task.focal_segments) !== JSON.stringify(core.focal_segments)) {
    issues.push({ level: "fail", path: "production_task", message: "DCT 원문·핵심 구간이 시나리오와 다름" });
  }
  if ((task.reference_alternatives ?? []).length !== 2) issues.push({ level: "warning", path: "production_task.reference_alternatives", message: "참고안 2개 목표" });
  if (items[0]?.title === items[1]?.title) issues.push({ level: "warning", path: "mpj_items[].title", message: "제목 중복" });
  const labelled = [...items.map(item => `${str(item.situation_ko)} ${str(item.relation_ko)}`), `${str(task.situation_ko)} ${str(task.relation_ko)}`];
  labelled.forEach((text, index) => {
    if (/통역사\s*C|통역사인\s*당신|통역을\s*맡았|(^|[^A-Za-z])[AB](?=[는가와을를에의도]|에게)/u.test(text)) {
      issues.push({ level: "fail", path: index < 5 ? `mpj_items[${index}]` : "production_task", message: "인물을 A·B·통역사 C 기호로 부름 — 역할명으로" });
    }
  });
  return issues;
}

/** 승인된 v6 미션 → 생성 출력 형식(프롬프트 본보기용). 서버가 넣는 필드와, 판단 방향을 암시하는 옛 제목은 뺀다. */
export function toV6GenerationExemplar(mission: AnyRecord): AnyRecord {
  const items = mission.mpj_items as AnyRecord[];
  const scene = (x: AnyRecord) => ({ situation_ko: x.situation_ko, relation_ko: x.relation_ko, learner_context_ko: x.learner_context_ko, channel: x.channel, pdr: x.pdr });
  const judged = (x: AnyRecord) => (String(x.reference_scale_code).endsWith("_appropriate") && !String(x.reference_scale_code).includes("inappropriate") ? "appropriate" : "inappropriate");
  const [a, b, c, d, e] = items;
  return {
    items: [
      { id: 1, ...scene(a), source: a.source, target: a.target, judgment: judged(a), explanation_ko: a.explanation_ko },
      { id: 2, ...scene(b), source: b.source, target: b.target, judgment: judged(b), explanation_ko: b.explanation_ko,
        revision_examples: b.revision_examples, reason_options: b.reason_choice?.options, accepted_reason_id: b.reason_choice?.accepted_id },
      { id: 3, ...scene(c), source: c.source, target: c.target, corrections: c.corrections, explanation_ko: c.explanation_ko },
      { id: 4, ...scene(d), source: d.source, target: d.target, reference_alternatives: d.reference_alternatives, explanation_ko: d.explanation_ko, ...(d.contrast ? { contrast: d.contrast } : {}) },
      { id: 5, ...scene(e), source: e.source, candidates: e.candidates },
    ],
    lesson_points: mission.lesson_points,
    dct: { situation_ko: mission.production_task.situation_ko, relation_ko: mission.production_task.relation_ko, learner_context_ko: mission.production_task.learner_context_ko,
      reference_alternatives: mission.production_task.reference_alternatives },
  };
}
