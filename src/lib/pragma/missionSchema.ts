// mission_v1/v2 — 기존 완전 미션(MPJ 5 + DCT) 읽기 호환.
// mission_v3 — 2026-07-28 MPJ4 + DCT 기준선 읽기 호환.
// mission_v4 — 2026-07-29 현행 완전 미션(MPJ 4 + DCT):
//   scale4 → judge3+fix_choice → reason → multi_judge.
//
// 편성·데모 선별분만 코어에서 승격 생성한다. legacy MPJ 5유형:
//   scale4 → judge3 → fix_choice → reason_conf → multi_judge (순서 고정, R1).
// v3 MPJ 4유형:
//   scale4 → judge3 → fix_choice → reason_conf (순서 고정, R1).
// 현행 v4 MPJ 4유형:
//   scale4(첫인상) → fix_choice(판정+교정) → reason(주원인)
//   → multi_judge(5후보) (순서 고정, R1).
// mission_v5 — 미니 담화형 DCT. legacy 행은 v4와 같은 MPJ4를 읽기 호환하고,
//   현행 생성 계약은 scale4 → judge3 → fix_choice → reason → multi_judge의
//   네이티브 MPJ5를 사용한다. DCT는 2~4문장 담화 + focal_segments를 유지한다.
// `target_feature`·`axis_feature`는 역사 데이터 호환용 이름이다. 신규 authoring
// 계약에서는 주차·미션 목표를 speech_act로 두고, MPJ의 직접 판정축을 item_focus로
// 해석한다. band code는 item focus 카탈로그 정본을 따른다.

import { z } from "zod";
import {
  MISSION_DIAGNOSTIC_DIMENSIONS,
  MISSION_DIAGNOSTIC_EVIDENCE_REFS,
} from "@/lib/pragma/diagnosticDimensions";
import {
  PdrSchema,
  ChannelSchema,
  SourceModalitySchema,
  FocalSegmentSchema,
} from "@/lib/pragma/coreSchema";
import { DEFAULT_DIRECTION, type LanguageDirection } from "@/lib/pragma/enums";
import { HskLexicalAuditSchema } from "@/lib/pragma/hskReference";
import { ItemLineageSchema } from "@/lib/pragma/itemLineage";

// ── 공통 필드 ─────────────────────────────────────────────────────────
const MpjCommon = {
  id: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  /** 판정 축 = unit.target_feature와 동일(R1이 강제) */
  axis_feature: z.string().min(1),
  situation_ko: z.string().min(1),
  relation_ko: z.string().min(1),
  /** @deprecated channel 폐기(2026-07-25) — legacy 읽기 호환용 */
  channel: ChannelSchema.optional(),
  pdr: PdrSchema,
  source_ko: z.string().min(1),
  /** 거절·응답류 필수(R8) */
  preceding_turn_zh: z.string().optional(),
  /** 기준 판정 해설 — 상황 결부형 어조(§7-2) */
  explanation_ko: z.string().min(1),
  /** 이 상황의 적절안 예시 1개 (완료 화면 재료, R21) */
  recommended_example_zh: z.string().min(1),
};

// ① scale4 — 전반 적절성 4점 척도. accepted는 연속 구간(R7), 1~2개
const Scale4Item = z.object({
  ...MpjCommon,
  type: z.literal("scale4"),
  target_zh: z.string().min(1),
  highlights_zh: z.array(z.string()),
  accepted_scale_codes: z.array(z.string()).min(1).max(2),
});

// ② judge3 — 초점 대역 3분류. 세트당 1개는 within_band 정답(R2)
const Judge3Item = z.object({
  ...MpjCommon,
  type: z.literal("judge3"),
  target_zh: z.string().min(1),
  highlights_zh: z.array(z.string()),
  accepted_band_codes: z.array(z.string()).min(1),
});

// ③ fix_choice — 판정+교정. corrections 4개, valid 정확히 2(R3)
const FixChoiceItem = z.object({
  ...MpjCommon,
  type: z.literal("fix_choice"),
  target_zh: z.string().min(1),
  highlights_zh: z.array(z.string()),
  accepted_band_codes: z.array(z.string()).min(1), // 부적절 계열(R18)
  corrections: z
    .array(
      z.object({
        zh: z.string().min(1),
        is_valid: z.boolean(),
        note_ko: z.string().min(1),
      }),
    )
    .length(4),
});

// ④ reason_conf — 판정+이유+확신도. 이유 4개, accepted 1~2(R4). 확신도는 여기만(0-c·30)
const ReasonConfItem = z.object({
  ...MpjCommon,
  type: z.literal("reason_conf"),
  target_zh: z.string().min(1),
  highlights_zh: z.array(z.string()),
  accepted_band_codes: z.array(z.string()).min(1), // 부적절 계열(R18)
  reasons: z
    .array(z.object({ id: z.string().min(1), text_ko: z.string().min(1) }))
    .length(4),
  accepted_reason_ids: z.array(z.string()).min(1).max(2),
});

// ⑤ multi_judge — 한 상황 다중 발화. 후보 5개, 각 accepted 배열(경계=길이>1, A6)
const MultiJudgeItem = z.object({
  ...MpjCommon,
  type: z.literal("multi_judge"),
  candidates: z
    .array(
      z.object({
        zh: z.string().min(1),
        accepted_band_codes: z.array(z.string()).min(1),
        note_ko: z.string().min(1),
      }),
    )
    .length(5),
  // target_zh 없음
});

export const MpjItemSchema = z.discriminatedUnion("type", [
  Scale4Item,
  Judge3Item,
  FixChoiceItem,
  ReasonConfItem,
  MultiJudgeItem,
]);
export type MpjItem = z.infer<typeof MpjItemSchema>;

// ── unit ──────────────────────────────────────────────────────────────
const UnitSchema = z.object({
  target_feature: z.string().min(1),
  target_feature_version: z.string().min(1),
  learner_label: z.string().min(1), // 카탈로그 복사값(R14)
  closing_ko: z.string().min(1), // 카탈로그 복사값(R14)
});

// ── production_task (DCT) — 번역·통역 ─────────────────────────────────
const ProductionTaskSchema = z.object({
  mode: z.enum(["translation", "interpreting"]),
  source_modality: SourceModalitySchema,
  situation_ko: z.string().min(1),
  relation_ko: z.string().min(1),
  /** @deprecated channel 폐기(2026-07-25) — legacy 읽기 호환용 */
  channel: ChannelSchema.optional(),
  pdr: PdrSchema,
  source_text_ko: z.string().min(1), // 코어 계승(R23)
  preceding_turn_zh: z.string().nullable(),
  /** 코어에서 계승한 명제적 Supportive Move 허용 사실. */
  usable_facts: z.array(z.string().min(1)).max(8).optional(),
  replay_limit: z.number().int().positive().optional(), // interpreting만
  reference_alternatives: z
    .array(z.object({ zh: z.string().min(1), note_ko: z.string().min(1) }))
    .min(1)
    .max(2), // 1~2개, 서로 다른 전략 (계약 v1.4 완화 0-d·32)
});
export type ProductionTask = z.infer<typeof ProductionTaskSchema>;

// ── provenance (v1.5 0-h·56 — 서버 주입, 미션 provenance는 mission_content 내장) ──
// 스키마는 관대(선택)하게 두고, 존재·필수값 검사는 R20이 담당한다.
// 이유: 모델 응답이 아니라 승격 edge function이 채우므로 zod hard-fail이 부적절.
export const MissionProvenanceSchema = z.object({
  provider: z.string().min(1).optional(),
  model: z.string().min(1),
  prompt_version: z.string().min(1),
  prompt_instance_hash: z.string().min(1).optional(),
  /** 같은 후보 계약으로 생성된 코어·미션·피드백을 묶는 표식. legacy는 부재 가능. */
  content_release_id: z.string().min(1).optional(),
  prompt_snapshot_hash: z.string().optional(),
  mission_content_hash: z.string().min(1),
  generated_at: z.string().min(1),
  generation_attempt: z.number().int().positive(),
});
export type MissionProvenance = z.infer<typeof MissionProvenanceSchema>;

// ── 검증②(계약 0-n·94 / 0-q·99) — 생성과 분리된 모델의 품질 비평 결과 ──
// provenance와 같은 취급: 모델 응답이 아니라 승격 파이프라인이 붙이므로 스키마는
// 관대(선택)하게 둔다. 학습자에게 노출되지 않는 관리자 품질관리 필드이며,
// 이 판정은 교수자 눈검사·승인을 대체하지 않는다(AI = QA 보조).
export const QualityFindingSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["warning", "fail"]),
  where: z.string().default(""),
  /** critic이 지목한 현재 경로 값에서 서버가 대조한 짧은 실제 인용. */
  evidence_excerpt: z.string().max(240).optional(),
  note_ko: z.string().default(""),
});
export const QualityCheckSchema = z.object({
  verdict: z.enum(["pass", "warning", "fail"]),
  summary_ko: z.string().default(""),
  findings: z.array(QualityFindingSchema).default([]),
  model: z.string().default(""),
  prompt_version: z.string().default(""),
  checked_at: z.string().default(""),
  /** critic이 실제로 검사한 현재 mission_content 버전. DB 열 추가 없이 JSON에 함께 보존한다. */
  mission_content_hash: z.string().optional(),
});
export type QualityFinding = z.infer<typeof QualityFindingSchema>;
export type QualityCheck = z.infer<typeof QualityCheckSchema>;

// ── mission_v1 ────────────────────────────────────────────────────────
export const MissionV1Schema = z.object({
  schema_version: z.literal("mission_v1"),
  unit: UnitSchema,
  mpj_items: z.array(MpjItemSchema).length(5),
  production_task: ProductionTaskSchema,
  provenance: MissionProvenanceSchema.optional(), // 존재·필수값 = R20(missionRules)
  quality_check: QualityCheckSchema.optional(),   // 검증②(0-q·99) — 승격 후 주입
  hsk_lexical_audit: HskLexicalAuditSchema.optional(),
  item_lineage: ItemLineageSchema.optional(),
  // summary 없음 — 코드가 recommended_example_zh 5개를 모아 렌더(B13)
});
export type MissionV1 = z.infer<typeof MissionV1Schema>;

// strict:false 환경 — 판별 union narrowing이 안 되므로 평평한 결과로 돌려준다.
/** 클라이언트 미션 검사 진입점(R1 스키마). 결정론 규칙 R2~R33(R22 retired)은 missionRules.ts. */
export function parseMission(input: unknown): {
  ok: boolean;
  data?: MissionV1;
  error?: z.ZodError;
} {
  const r = MissionV1Schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error };
}

/** legacy mission_v1/v2 유형 순서(R1). */
export const MPJ_TYPE_ORDER_V2 = [
  "scale4",
  "judge3",
  "fix_choice",
  "reason_conf",
  "multi_judge",
] as const;

/** 현행 mission_v3 유형 순서(R1). */
export const MPJ_TYPE_ORDER_V3 = [
  "scale4",
  "judge3",
  "fix_choice",
  "reason_conf",
] as const;

/** 현행 mission_v4 유형 순서(R1). */
export const MPJ_TYPE_ORDER_V4 = [
  "scale4",
  "fix_choice",
  "reason",
  "multi_judge",
] as const;

/** 현행 mission_v5 네이티브 MPJ5 유형 순서(R1). */
export const MPJ_TYPE_ORDER_V5 = [
  "scale4",
  "judge3",
  "fix_choice",
  "reason",
  "multi_judge",
] as const;

// ══════════════════════════════════════════════════════════════════════
// mission_v2 — 양방향 중립 스키마 (계약 0-l·83)
// ══════════════════════════════════════════════════════════════════════
// 언어가 뒤집히는 필드만 중립 이름: source_ko→source · target_zh→target ·
// highlights_zh→highlights · preceding_turn_zh→preceding_turn ·
// recommended_example_zh→recommended_example · corrections/candidates/
// reference_alternatives[].zh→text. 메타언어 필드(situation_ko·relation_ko·
// explanation_ko·note_ko·reasons[].text_ko·closing_ko·learner_label)는 불변.
// direction 최상위 신설. 부재 데이터(v1) = ko_zh로 정규화(0-l·82·84).

const MpjCommonV2 = {
  id: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  /** 신규 정본명. axis_feature는 직렬화 호환용으로 함께 둔다. */
  item_focus: z.string().min(1).optional(),
  axis_feature: z.string().min(1),
  situation_ko: z.string().min(1),
  relation_ko: z.string().min(1),
  /** @deprecated channel 폐기(2026-07-25) — legacy 읽기 호환용 */
  channel: ChannelSchema.optional(),
  pdr: PdrSchema,
  /** 판단 대상 원문 — direction의 source 언어 */
  source: z.string().min(1),
  /** 대화 상대(target 언어)의 선행 발화(R8) */
  preceding_turn: z.string().optional(),
  explanation_ko: z.string().min(1),
  /** 이 상황의 적절안 예시 1개 — direction의 target 언어(R21) */
  recommended_example: z.string().min(1),
};

const Scale4ItemV2 = z.object({
  ...MpjCommonV2,
  type: z.literal("scale4"),
  target: z.string().min(1),
  highlights: z.array(z.string()),
  accepted_scale_codes: z.array(z.string()).min(1).max(2),
});
const Judge3ItemV2 = z.object({
  ...MpjCommonV2,
  type: z.literal("judge3"),
  target: z.string().min(1),
  highlights: z.array(z.string()),
  accepted_band_codes: z.array(z.string()).min(1),
});
const FixChoiceItemV2 = z.object({
  ...MpjCommonV2,
  type: z.literal("fix_choice"),
  target: z.string().min(1),
  highlights: z.array(z.string()),
  accepted_band_codes: z.array(z.string()).min(1),
  corrections: z
    .array(z.object({ text: z.string().min(1), is_valid: z.boolean(), note_ko: z.string().min(1) }))
    .length(4),
});
const ReasonConfItemV2 = z.object({
  ...MpjCommonV2,
  type: z.literal("reason_conf"),
  target: z.string().min(1),
  highlights: z.array(z.string()),
  accepted_band_codes: z.array(z.string()).min(1),
  reasons: z
    .array(z.object({ id: z.string().min(1), text_ko: z.string().min(1) }))
    .length(4),
  accepted_reason_ids: z.array(z.string()).min(1).max(2),
});
const MultiJudgeItemV2 = z.object({
  ...MpjCommonV2,
  type: z.literal("multi_judge"),
  candidates: z
    .array(z.object({ text: z.string().min(1), accepted_band_codes: z.array(z.string()).min(1), note_ko: z.string().min(1) }))
    .length(5),
});

export const MpjItemV2Schema = z.discriminatedUnion("type", [
  Scale4ItemV2,
  Judge3ItemV2,
  FixChoiceItemV2,
  ReasonConfItemV2,
  MultiJudgeItemV2,
]);
export type MpjItemV2 = z.infer<typeof MpjItemV2Schema>;

export const VocabularyHintSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
});
export type VocabularyHint = z.infer<typeof VocabularyHintSchema>;

const ProductionTaskV2Schema = z.object({
  mode: z.enum(["translation", "interpreting"]),
  source_modality: SourceModalitySchema,
  situation_ko: z.string().min(1),
  relation_ko: z.string().min(1),
  /** @deprecated channel 폐기(2026-07-25) — legacy 읽기 호환용 */
  channel: ChannelSchema.optional(),
  pdr: PdrSchema,
  source_text: z.string().min(1),
  preceding_turn: z.string().nullable(),
  /** 번역 산출용 비화용적 내용 어휘 힌트 2개. legacy 읽기 호환을 위해 optional. */
  vocabulary_hints: z.array(VocabularyHintSchema).length(2).optional(),
  /** 코어에서 계승한 명제적 Supportive Move 허용 사실. */
  usable_facts: z.array(z.string().min(1)).max(8).optional(),
  replay_limit: z.number().int().positive().optional(),
  reference_alternatives: z
    .array(z.object({ text: z.string().min(1), note_ko: z.string().min(1) }))
    .min(1)
    .max(2),
});
export type ProductionTaskV2 = z.infer<typeof ProductionTaskV2Schema>;

export const MissionV2Schema = z.object({
  schema_version: z.literal("mission_v2"),
  direction: z.enum(["ko_zh", "zh_ko"]),
  unit: UnitSchema,
  mpj_items: z.array(MpjItemV2Schema).length(5),
  production_task: ProductionTaskV2Schema,
  provenance: MissionProvenanceSchema.optional(),
  quality_check: QualityCheckSchema.optional(),
  hsk_lexical_audit: HskLexicalAuditSchema.optional(),
  item_lineage: ItemLineageSchema.optional(),
});
export type MissionV2 = z.infer<typeof MissionV2Schema>;

// ══════════════════════════════════════════════════════════════════════
// mission_v3 — MPJ4 + DCT (2026-07-28)
// ══════════════════════════════════════════════════════════════════════
// 필드 이름은 v2의 양방향 중립 계약을 그대로 유지한다. 변경점은 MPJ 구성뿐이다:
// multi_judge를 제외하고 정확히 4개를 생성한다. 기존 v1/v2 자료는 아래 정규화
// 경로로 계속 읽되, 신규 생성물과 provenance를 섞지 않는다.
export const MpjItemV3Schema = z.discriminatedUnion("type", [
  Scale4ItemV2,
  Judge3ItemV2,
  FixChoiceItemV2,
  ReasonConfItemV2,
]);
export type MpjItemV3 = z.infer<typeof MpjItemV3Schema>;

export const MissionV3Schema = z.object({
  schema_version: z.literal("mission_v3"),
  direction: z.enum(["ko_zh", "zh_ko"]),
  unit: UnitSchema,
  mpj_items: z.array(MpjItemV3Schema).length(4),
  production_task: ProductionTaskV2Schema,
  provenance: MissionProvenanceSchema.optional(),
  quality_check: QualityCheckSchema.optional(),
  hsk_lexical_audit: HskLexicalAuditSchema.optional(),
  item_lineage: ItemLineageSchema.optional(),
});
export type MissionV3 = z.infer<typeof MissionV3Schema>;

// ══════════════════════════════════════════════════════════════════════
// mission_v4 — MPJ4 + DCT (2026-07-29)
// ══════════════════════════════════════════════════════════════════════
// Scale4는 4점 원응답을 보존하되 적절/부적절의 방향이 맞으면 정답으로 인정한다.
// reference_scale_code는 정도성 차이를 참고 판정·수업 토론에 남긴다.
// reason은 confidence를 묻지 않는다. problem_band_code는 생성·QA의 참고키이자
// 학습자가 이유 선택 전에 잠그는 최초 대역 판단의 비교키이며, 이후 "가장 큰 이유" 하나만 고른다.
const MpjCommonV4 = {
  ...MpjCommonV2,
  id: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  /** UI 표현용 매체. 연구·난이도 축이 아니며 상황 서술과 일치해야 한다. */
  channel: ChannelSchema,
  /** P·D·R의 상대와 관계를 실제 대화 맥락으로 보여 주기 위해 모든 v4 문항에 필수. */
  preceding_turn: z.string().min(1),
};

const ScaleCodeV4 = z.enum([
  "very_appropriate",
  "somewhat_appropriate",
  "somewhat_inappropriate",
  "very_inappropriate",
]);

const Scale4ItemV4 = z.object({
  ...MpjCommonV4,
  type: z.literal("scale4"),
  target: z.string().min(1),
  highlights: z.array(z.string()),
  /** 같은 극성의 정확히 두 응답. 즉시 피드백은 이분법적 방향만 채점한다. */
  accepted_scale_codes: z.array(ScaleCodeV4).length(2),
  /** 매우/다소의 정도성 비교를 위한 단일 참고 판정. */
  reference_scale_code: ScaleCodeV4,
});

const FixChoiceItemV4 = z.object({
  ...MpjCommonV4,
  type: z.literal("fix_choice"),
  target: z.string().min(1),
  highlights: z.array(z.string()),
  /** 학습자가 먼저 한 번만 판단하는 초점 대역. */
  accepted_band_codes: z.array(z.string()).length(1),
  corrections: z
    .array(z.object({ text: z.string().min(1), is_valid: z.boolean(), note_ko: z.string().min(1) }))
    .length(4),
});

const ReasonItemV4 = z.object({
  ...MpjCommonV4,
  type: z.literal("reason"),
  target: z.string().min(1),
  highlights: z.array(z.string()),
  /** 이유 공개 전 최초 대역 판단의 참고키. 반드시 적정 대역 밖이어야 한다(R4). */
  problem_band_code: z.string().min(1),
  reasons: z
    .array(
      z.object({
        id: z.string().min(1),
        text_ko: z.string().min(1),
        kind: z.enum(["primary", "pragmatic_misconception", "meaning_grammar_context"]),
      }),
    )
    .length(3),
  accepted_reason_id: z.string().min(1),
});

const MultiJudgeItemV4 = z.object({
  ...MpjCommonV4,
  type: z.literal("multi_judge"),
  candidates: z
    .array(
      z.object({
        text: z.string().min(1),
        accepted_band_codes: z.array(z.string()).length(1),
        note_ko: z.string().min(1),
      }),
    )
    .length(5),
});

export const MpjItemV4Schema = z.discriminatedUnion("type", [
  Scale4ItemV4,
  FixChoiceItemV4,
  ReasonItemV4,
  MultiJudgeItemV4,
]);
export type MpjItemV4 = z.infer<typeof MpjItemV4Schema>;

export const MissionV4Schema = z.object({
  schema_version: z.literal("mission_v4"),
  direction: z.enum(["ko_zh", "zh_ko"]),
  unit: UnitSchema,
  mpj_items: z.array(MpjItemV4Schema).length(4),
  production_task: ProductionTaskV2Schema,
  provenance: MissionProvenanceSchema.optional(),
  quality_check: QualityCheckSchema.optional(),
  hsk_lexical_audit: HskLexicalAuditSchema.optional(),
  item_lineage: ItemLineageSchema.optional(),
});
export type MissionV4 = z.infer<typeof MissionV4Schema>;

// ══════════════════════════════════════════════════════════════════════
// mission_v5 — 미니 담화형 DCT + 네이티브 MPJ5
// ══════════════════════════════════════════════════════════════════════
// 2026-08-24부터 신규 생성은 독립 judge3(맥락 대비 판단)를 포함한 MPJ5다.
// 기존 mission_v5 MPJ4 행은 삭제·백필하지 않고 legacy 스키마로 계속 읽는다.
// 두 형태 모두 production_task.source_text 2~4문장과 focal_segments를 사용한다.
const ProductionTaskV3Schema = ProductionTaskV2Schema.extend({
  /** 코어 계승(R23·R29). head 1 + support 0~2, 각 text는 source_text의 부분문자열. */
  focal_segments: z.array(FocalSegmentSchema).min(1).max(3),
});
export type ProductionTaskV3 = z.infer<typeof ProductionTaskV3Schema>;

const MpjCommonV5 = {
  ...MpjCommonV2,
  id: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  channel: ChannelSchema,
  preceding_turn: z.string().min(1).nullable(),
};

const Judge3ItemV5 = z.object({
  ...MpjCommonV5,
  id: z.literal(2),
  type: z.literal("judge3"),
  target: z.string().min(1),
  highlights: z.array(z.string()),
  accepted_band_codes: z.array(z.string()).length(1),
});

const Scale4ItemV5 = Scale4ItemV4.extend({ id: z.literal(1), preceding_turn: z.string().min(1).nullable() });
const FixChoiceItemV5 = FixChoiceItemV4.extend({
  id: z.literal(3),
  preceding_turn: z.string().min(1).nullable(),
  /** 현행은 3지선다·권장안 1개. 길이 4는 역사 native MPJ5 읽기 호환용. */
  corrections: z
    .array(z.object({ text: z.string().min(1), is_valid: z.boolean(), note_ko: z.string().min(1) }))
    .min(3)
    .max(4),
});
const ReasonItemV5 = ReasonItemV4.extend({ id: z.literal(4), preceding_turn: z.string().min(1).nullable() });
const MultiJudgeItemV5 = MultiJudgeItemV4.extend({
  id: z.literal(5),
  preceding_turn: z.string().min(1).nullable(),
  candidates: z
    .array(
      z.object({
        text: z.string().min(1),
        accepted_band_codes: z.array(z.string()).length(1),
        note_ko: z.string().min(1),
        /** historical BEST/MIDDLE/WORST 생성물 읽기 호환용. 신규 v2는 대역만 사용한다. */
        comparison_role: z.enum(["best", "middle", "worst"]).optional(),
      }),
    )
    .min(4)
    .max(5),
});

export const MpjItemV5Schema = z.discriminatedUnion("type", [
  Scale4ItemV5,
  Judge3ItemV5,
  FixChoiceItemV5,
  ReasonItemV5,
  MultiJudgeItemV5,
]);
export type MpjItemV5 = z.infer<typeof MpjItemV5Schema>;

/**
 * 미션 수준 진단차원과 그 판단 근거 위치. 과거 native MPJ5에는 이 필드가 없으므로
 * 배열 자체는 optional이며, 현행 prompt version의 필수성·중복·합집합은 R33이 검사한다.
 */
export const MissionDiagnosticDimensionCoverageSchema = z.object({
  code: z.enum(MISSION_DIAGNOSTIC_DIMENSIONS),
  evidence_refs: z.array(z.enum(MISSION_DIAGNOSTIC_EVIDENCE_REFS)).min(1).max(6),
  evidence_ko: z.string().trim().min(1),
});
export type MissionDiagnosticDimensionCoverage = z.infer<
  typeof MissionDiagnosticDimensionCoverageSchema
>;

export const MissionContrastPlanSchema = z.object({
  version: z.literal("contrast_plan_v1"),
  speech_act: z.string().min(1),
  mission_goal: z.literal("integrated_speech_act"),
  item_slots: z.array(z.object({
    item_id: z.number().int().min(1).max(5),
    item_type: z.enum(["scale4", "judge3", "fix_choice", "reason", "multi_judge"]),
    item_focus: z.string().min(1),
    intended_band_profile: z.string().min(1),
  })).length(5),
});
export type MissionContrastPlan = z.infer<typeof MissionContrastPlanSchema>;

export const MissionAuthoringSchema = z.object({
  schema_version: z.literal("mission_authoring_v1"),
  stage: z.enum(["ai_draft", "ai_repaired", "professor_revised", "professor_finalized"]),
  lineage_status: z.enum(["pending", "complete"]),
  repair_attempts: z.number().int().min(0).max(1),
  professor_issue_overrides: z.array(z.object({
    issue_index: z.number().int().min(0),
    code: z.string().min(1),
    where: z.string().default(""),
    rationale_ko: z.string().trim().min(1),
  })).optional(),
});
export type MissionAuthoring = z.infer<typeof MissionAuthoringSchema>;

const MissionV5Common = {
  schema_version: z.literal("mission_v5"),
  direction: z.enum(["ko_zh", "zh_ko"]),
  learning_goal: z.object({
    kind: z.literal("speech_act"),
    speech_act: z.string().min(1),
  }).optional(),
  contrast_plan: MissionContrastPlanSchema.optional(),
  authoring: MissionAuthoringSchema.optional(),
  unit: UnitSchema,
  production_task: ProductionTaskV3Schema,
  provenance: MissionProvenanceSchema.optional(),
  quality_check: QualityCheckSchema.optional(),
  hsk_lexical_audit: HskLexicalAuditSchema.optional(),
  item_lineage: ItemLineageSchema.optional(),
};

/** 2026-07-30~2026-08-23 생성분 읽기 호환. 신규 생성에는 사용하지 않는다. */
export const MissionV5LegacySchema = z.object({
  ...MissionV5Common,
  mpj_items: z.array(MpjItemV4Schema).length(4),
});

/** 2026-08-24 이후 네이티브 MPJ5. 현행 v2와 historical v1을 함께 읽는다. */
export const MissionV5NativeSchema = z.object({
  ...MissionV5Common,
  diagnostic_dimensions: z
    .array(MissionDiagnosticDimensionCoverageSchema)
    .max(MISSION_DIAGNOSTIC_DIMENSIONS.length)
    .optional(),
  mpj_items: z.tuple([
    Scale4ItemV5,
    Judge3ItemV5,
    FixChoiceItemV5,
    ReasonItemV5,
    MultiJudgeItemV5,
  ]),
});

export const MissionV5Schema = z.union([MissionV5NativeSchema, MissionV5LegacySchema]);
export type MissionV5Legacy = z.infer<typeof MissionV5LegacySchema>;
type MissionV5NativeInferred = z.infer<typeof MissionV5NativeSchema>;
export type MissionV5Native = Omit<MissionV5NativeInferred, "mpj_items"> & {
  mpj_items: [
    z.infer<typeof Scale4ItemV5>,
    z.infer<typeof Judge3ItemV5>,
    z.infer<typeof FixChoiceItemV5>,
    z.infer<typeof ReasonItemV5>,
    z.infer<typeof MultiJudgeItemV5>,
  ];
};
// zod 3 + strict:false에서는 깊은 object union의 배열 원소가 unknown으로
// 넓어질 수 있다. 런타임 검사는 위 union이 맡고, 소비자 타입은 두 검증된
// 출력형의 명시적 합집합으로 유지한다.
export type MissionV5 = MissionV5Native | MissionV5Legacy;

export type MissionRuntime = MissionV2 | MissionV3 | MissionV4 | MissionV5;
export type MpjItemRuntime = MissionRuntime["mpj_items"][number];

// ── v1 → v2 항목 매핑(정규화용) ───────────────────────────────────────
function v1ItemToV2(it: MpjItem): MpjItemV2 {
  const common = {
    id: it.id,
    axis_feature: it.axis_feature,
    situation_ko: it.situation_ko,
    relation_ko: it.relation_ko,
    ...(it.channel ? { channel: it.channel } : {}), // legacy only
    pdr: it.pdr,
    source: it.source_ko,
    ...(it.preceding_turn_zh ? { preceding_turn: it.preceding_turn_zh } : {}),
    explanation_ko: it.explanation_ko,
    recommended_example: it.recommended_example_zh,
  };
  switch (it.type) {
    case "scale4":
      return { ...common, type: "scale4", target: it.target_zh, highlights: it.highlights_zh, accepted_scale_codes: it.accepted_scale_codes };
    case "judge3":
      return { ...common, type: "judge3", target: it.target_zh, highlights: it.highlights_zh, accepted_band_codes: it.accepted_band_codes };
    case "fix_choice":
      return {
        ...common,
        type: "fix_choice",
        target: it.target_zh,
        highlights: it.highlights_zh,
        accepted_band_codes: it.accepted_band_codes,
        corrections: it.corrections.map((c) => ({ text: c.zh, is_valid: c.is_valid, note_ko: c.note_ko })),
      };
    case "reason_conf":
      return {
        ...common,
        type: "reason_conf",
        target: it.target_zh,
        highlights: it.highlights_zh,
        accepted_band_codes: it.accepted_band_codes,
        reasons: it.reasons,
        accepted_reason_ids: it.accepted_reason_ids,
      };
    case "multi_judge":
      return {
        ...common,
        type: "multi_judge",
        candidates: it.candidates.map((c) => ({ text: c.zh, accepted_band_codes: c.accepted_band_codes, note_ko: c.note_ko })),
      };
  }
}

/**
 * 미션 정규화 — v1(방향 없음)·v2(MPJ5)·v3(MPJ4)·v4(MPJ4) JSON을 읽는다.
 * v1은 direction='ko_zh', 필드명 매핑 후 legacy v2 형태가 된다.
 * 규칙검사·러너·미리보기는 MissionRuntime만 본다.
 */
export function normalizeMission(input: unknown): {
  ok: boolean;
  data?: MissionRuntime;
  error?: z.ZodError;
} {
  const sv = (input as { schema_version?: string } | null)?.schema_version;
  if (sv === "mission_v5") {
    const r = MissionV5Schema.safeParse(input);
    if (r.success) return { ok: true, data: r.data };
    return { ok: false, error: r.error };
  }
  if (sv === "mission_v4") {
    const r = MissionV4Schema.safeParse(input);
    if (r.success) return { ok: true, data: r.data };
    return { ok: false, error: r.error };
  }
  if (sv === "mission_v3") {
    const r = MissionV3Schema.safeParse(input);
    if (r.success) return { ok: true, data: r.data };
    return { ok: false, error: r.error };
  }
  if (sv === "mission_v2") {
    const r = MissionV2Schema.safeParse(input);
    if (r.success) return { ok: true, data: r.data };
    return { ok: false, error: r.error };
  }
  const v1 = MissionV1Schema.safeParse(input);
  if (!v1.success) return { ok: false, error: v1.error };
  const m = v1.data;
  const pt = m.production_task;
  return {
    ok: true,
    data: {
      schema_version: "mission_v2",
      direction: DEFAULT_DIRECTION,
      unit: m.unit,
      mpj_items: m.mpj_items.map(v1ItemToV2),
      production_task: {
        mode: pt.mode,
        source_modality: pt.source_modality,
        situation_ko: pt.situation_ko,
        relation_ko: pt.relation_ko,
        ...(pt.channel ? { channel: pt.channel } : {}), // legacy only
        pdr: pt.pdr,
        source_text: pt.source_text_ko,
        preceding_turn: pt.preceding_turn_zh,
        ...(pt.usable_facts?.length ? { usable_facts: pt.usable_facts } : {}),
        ...(pt.replay_limit ? { replay_limit: pt.replay_limit } : {}),
        reference_alternatives: pt.reference_alternatives.map((a) => ({ text: a.zh, note_ko: a.note_ko })),
      },
      ...(m.provenance ? { provenance: m.provenance } : {}),
      ...(m.quality_check ? { quality_check: m.quality_check } : {}),
      ...(m.hsk_lexical_audit ? { hsk_lexical_audit: m.hsk_lexical_audit } : {}),
      ...(m.item_lineage ? { item_lineage: m.item_lineage } : {}),
    },
  };
}

/** direction만 안전하게 뽑는다(정규화 실패해도 편성 필터가 동작하게). */
export function missionDirection(input: unknown): LanguageDirection {
  const d = (input as { direction?: string } | null)?.direction;
  return d === "zh_ko" ? "zh_ko" : DEFAULT_DIRECTION;
}
