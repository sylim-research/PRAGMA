// scenario_core_v1 — 500개 구축 단위의 zod 스키마. 생성계약 v1.3 §2b.
//
// 코어 = 상황·원문·태그만. target_feature·MPJ 없음(카탈로그 미완 화행도 커버).
// 편성·데모 선별분만 버전된 Full Mission으로 승격한다(missionSchema.ts).
//
// PDR 값 개명(계약 A2 / 0-b·2): JSON은 화자 기준의 명확한 이름을 쓴다.
//   p: speaker_lower | equal | speaker_higher   (구 enum higher/equal/lower)
//   d: close | acquaintance | distant           (구 enum formal → distant)
//   r: low | mid | high
// 행 컬럼(scenario_p/d/r)은 여전히 구 enum 값이므로 아래 매핑으로 변환한다.

import { z } from "zod";
import type {
  PdrPower,
  PdrDistance,
  PdrBurden,
  LanguageDirection,
} from "@/lib/pragma/enums";
import { DEFAULT_DIRECTION } from "@/lib/pragma/enums";
import { HskLexicalAuditSchema } from "@/lib/pragma/hskReference";

// ── PDR: 계약 JSON 이름 ↔ 행 enum 값 매핑 ─────────────────────────────
export const PdrPowerJson = z.enum(["speaker_lower", "equal", "speaker_higher"]);
export const PdrDistanceJson = z.enum(["close", "acquaintance", "distant"]);
export const PdrBurdenJson = z.enum(["low", "mid", "high"]);
export type PdrPowerJsonT = z.infer<typeof PdrPowerJson>;
export type PdrDistanceJsonT = z.infer<typeof PdrDistanceJson>;

/** JSON 이름 → 행 enum 값(scenario_p/d/r 컬럼용). */
export const PDR_POWER_JSON_TO_ENUM: Record<PdrPowerJsonT, PdrPower> = {
  speaker_lower: "higher", // enum higher = "내가 낮음" = 화자가 낮음
  equal: "equal",
  speaker_higher: "lower", // enum lower = "내가 높음"
};
export const PDR_DISTANCE_JSON_TO_ENUM: Record<PdrDistanceJsonT, PdrDistance> = {
  close: "close",
  acquaintance: "acquaintance",
  distant: "formal", // enum formal = 초면(멂)
};
/** 행 enum 값 → JSON 이름(코어 생성 시 셀 → core_content). */
export const PDR_POWER_ENUM_TO_JSON: Record<PdrPower, PdrPowerJsonT> = {
  higher: "speaker_lower",
  equal: "equal",
  lower: "speaker_higher",
};
export const PDR_DISTANCE_ENUM_TO_JSON: Record<PdrDistance, PdrDistanceJsonT> = {
  close: "close",
  acquaintance: "acquaintance",
  formal: "distant",
};
// r(부담)은 이름이 같다(low/mid/high).
export const PDR_BURDEN_IDENTITY: Record<PdrBurden, "low" | "mid" | "high"> = {
  low: "low",
  mid: "mid",
  high: "high",
};

export const PdrSchema = z.object({
  p: PdrPowerJson,
  d: PdrDistanceJson,
  r: PdrBurdenJson,
});
export type Pdr = z.infer<typeof PdrSchema>;

// ⚠️ channel 폐기(2026-07-25 결정): channel은 더 이상 조합축·생성조건·판정축·학습분기가 아니다.
// 말투·화용 적절성은 P/D/R + target_feature + task_mode가 담당한다(매체=격식 자동결정은 오모델링).
// 스키마에는 legacy로만 남겨 기존 저장 데이터를 읽을 수 있게 하고, 신규 생성에서 필수로 요구하지 않는다.
export const ChannelSchema = z.enum(["email", "messenger", "facetoface", "phone"]);
export const SourceModalitySchema = z.enum(["written", "spoken"]);

/** 서버가 코어 생성 직전에 주입하는 콘텐츠 후보·프롬프트 provenance. */
export const CoreGenerationStampSchema = z.object({
  content_release_id: z.string().min(1),
  prompt_version: z.string().min(1),
  prompt_snapshot_hash: z.string().min(1),
  generated_at: z.string().min(1),
});
export type CoreGenerationStamp = z.infer<typeof CoreGenerationStampSchema>;

// ── provenance-lite (계약 0-q·98 / 0-t) ────────────────────────────────
// 「실제 자료에서 생성」(Authentic Import)으로 만든 코어의 출처를 보존한다.
// 지금까지는 패널이 수집한 출처·원자료를 applyAuthentic이 **버리고 있었다**.
//
// 설계: 신규 컬럼·migration 없이 core_content 안에 optional로 넣는다
// (미션 provenance와 동일 취급 — missionSchema.ts:135 주석 참조).
// ⚠️ content_hash에는 포함하지 않는다. 내용이 같은 코어는 출처가 달라도 같은 해시여야
//    중복 탐지가 작동한다(promoteMission.ts:238의 provenance 취급과 같은 이유).
export const CoreSourceTypeSchema = z.enum([
  "authentic_text", // 관리자가 붙여넣은 실제 문구
  "authentic_image", // 이미지 업로드 → vision 판독
  // 레거시(2026-08-05 신규 입력 경로 제거). 이미 저장된 provenance를 읽기 위해 남긴다 —
  // 값을 없애면 이 출처로 저장된 기존 코어가 스키마 검증에서 깨진다.
  "authentic_youtube", // YouTube 중국어·한국어 자막(supadata)
]);
export type CoreSourceType = z.infer<typeof CoreSourceTypeSchema>;

export const CoreProvenanceSchema = z.object({
  source_type: CoreSourceTypeSchema,
  /** 관리자가 입력한 출처 표기(URL·프로그램명·수집 맥락). 미입력 허용 */
  source_ref: z.string().nullable().optional(),
  /** 관리자가 확정한 **원자료 원문** — AI 재구성 이전 상태 */
  source_original: z.string().nullable().optional(),
  /** AI가 원자료를 재구성했는가(사용 원문 ≠ 원자료 원문) */
  ai_adapted: z.boolean(),
  /** 개인정보 익명화 처리 여부. 지금은 수집 UI가 없어 미설정으로 남는다(후속) */
  anonymized: z.boolean().optional(),
});
export type CoreProvenance = z.infer<typeof CoreProvenanceSchema>;

// ── context_spec ──────────────────────────────────────────────────────
// P·D·R과 topic을 자연어 장면으로 풀기 전에 서버가 고정하는 최소 권리·의무 구조.
// 새 조합축이 아니며 학습자 화면에 항목식으로 노출하지 않는다.
export const ContextSpecSchema = z.object({
  standard_situation_code: z.string().min(1),
  role_pair: z.object({
    speaker_ko: z.string().min(1),
    addressee_ko: z.string().min(1),
  }),
  speaker_entitlement: z.string().min(1),
  addressee_obligation: z.string().min(1),
  decision_authority: z.string().min(1),
  /**
   * 통역 셀에서만 서버가 주입하는 역할 계약. 자연어 situation_ko보다 먼저
   * A/B/C와 P·D·R 준거를 구조값으로 고정한다. legacy·번역 코어는 부재 가능하다.
   */
  interpreter_role_contract: z.object({
    source_speaker: z.literal("A"),
    target_addressee: z.literal("B"),
    learner_interpreter: z.literal("C"),
    pdr_relation: z.literal("A_to_B"),
  }).optional(),
});
export type ContextSpec = z.infer<typeof ContextSpecSchema>;

// ── scenario_core_v1 ──────────────────────────────────────────────────
export const ScenarioCoreV1Schema = z.object({
  schema_version: z.literal("scenario_core_v1"),
  situation_ko: z.string().min(1),
  relation_ko: z.string().min(1),
  source_modality: SourceModalitySchema,
  /** spoken이면 실제 말로 전달할 법한 짧은 구두 담화체 */
  source_text_ko: z.string().min(1),
  /** 거절·응답류 필수(R8). 그 외에는 null 허용 */
  preceding_turn_zh: z.string().nullable(),
  pdr: PdrSchema,
  /** @deprecated channel 폐기(2026-07-25) — legacy 읽기 호환용, 신규 생성 미요구 */
  channel: ChannelSchema.optional(),
  /** 편성 화면용 한 줄 (선택) */
  brief_note_ko: z.string().optional(),
  /** 서버가 주입한 역할·권리·의무 제약. legacy 코어는 부재 가능. */
  context_spec: ContextSpecSchema.optional(),
  /**
   * 원문 밖의 명제적 Supportive Move에 사용할 수 있는 서버 승인 사실.
   * 비어 있거나 없으면 이유·대안·수리·보상·새 일정을 발명할 수 없다.
   */
  usable_facts: z.array(z.string().min(1)).max(8).optional(),
  /** 실제 자료 유래분만. 모델 응답이 아니라 저장 직전 주입(0-q·98) */
  provenance: CoreProvenanceSchema.optional(),
  /** AI 생성분의 작업 후보·프롬프트 표식. legacy 코어는 부재 가능. */
  generation: CoreGenerationStampSchema.optional(),
  /** HSK 어휘 참고 상한의 비차단 사후감사. 숙달도 판정이 아니다. */
  hsk_lexical_audit: HskLexicalAuditSchema.optional(),
});
export type ScenarioCoreV1 = z.infer<typeof ScenarioCoreV1Schema>;

// 주의: 이 레포는 tsconfig `strict:false`라 zod의 판별 union narrowing이 동작하지 않는다.
// 그래서 parse 결과는 판별 union이 아니라 평평한 { ok, data?, error? }로 돌려준다.
/** 클라이언트 코어 검사 진입점 — RPC 저장 전 필수(계약 §6). */
export function parseCore(input: unknown): {
  ok: boolean;
  data?: ScenarioCoreV1;
  error?: z.ZodError;
} {
  const r = ScenarioCoreV1Schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error };
}

// ── scenario_core_v2 — 양방향 중립 스키마 (계약 0-l·83) ────────────────────
// 언어가 뒤집히는 필드만 중립 이름: source_text_ko→source_text ·
// preceding_turn_zh→preceding_turn. 메타언어 필드(situation_ko·relation_ko·
// brief_note_ko)는 학습자 UI 언어(항상 한국어)라 개명하지 않는다.
// direction 최상위 필드 신설(부재 데이터 = ko_zh로 정규화, 0-l·82·84).
export const ScenarioCoreV2Schema = z.object({
  schema_version: z.literal("scenario_core_v2"),
  direction: z.enum(["ko_zh", "zh_ko"]),
  situation_ko: z.string().min(1),
  relation_ko: z.string().min(1),
  source_modality: SourceModalitySchema,
  /** 학습자가 옮길 원발화 — direction의 source 언어 */
  source_text: z.string().min(1),
  /** 대화 상대(target 언어 화자)의 선행 발화. 응답류 필수(R8). 그 외 null */
  preceding_turn: z.string().nullable(),
  pdr: PdrSchema,
  /** @deprecated channel 폐기(2026-07-25) — legacy 읽기 호환용, 신규 생성 미요구 */
  channel: ChannelSchema.optional(),
  brief_note_ko: z.string().optional(),
  /** 서버가 주입한 역할·권리·의무 제약. legacy 코어는 부재 가능. */
  context_spec: ContextSpecSchema.optional(),
  /**
   * 원문 밖의 명제적 Supportive Move에 사용할 수 있는 서버 승인 사실.
   * 비어 있거나 없으면 이유·대안·수리·보상·새 일정을 발명할 수 없다.
   */
  usable_facts: z.array(z.string().min(1)).max(8).optional(),
  /** 실제 자료 유래분만. 모델 응답이 아니라 저장 직전 주입(0-q·98) */
  provenance: CoreProvenanceSchema.optional(),
  /** AI 생성분의 작업 후보·프롬프트 표식. legacy 코어는 부재 가능. */
  generation: CoreGenerationStampSchema.optional(),
  /** 중국어 source일 때만 생성되는 비차단 어휘 참고 감사. */
  hsk_lexical_audit: HskLexicalAuditSchema.optional(),
});
export type ScenarioCoreV2 = z.infer<typeof ScenarioCoreV2Schema>;

// ── scenario_core_v3 — 미니 담화형 원문 + focal segments (DEC-20260730-01) ──
// v2와 필드 이름은 모두 같고, 두 가지만 다르다:
//  ① source_text가 한 문장이 아니라 실무 메시지처럼 2~4문장의 미니 담화다.
//  ② focal_segments = 중심 화용 목표를 실현·조절하는 구간(서버 생성물). 학습자는
//     전체를 옮기지만 화용 집중 평가와 화면 강조는 이 구간에만 적용된다.
// legacy(v1·v2) 코어는 focal_segments 없이 정규화되며, 부재 = 단문 원문 취급이다.

/**
 * 화용 집중 구간. `text`는 반드시 source_text의 정확한 부분문자열이어야 한다
 * (R29) — 그래야 저장·화면 강조·피드백이 같은 문자열을 가리킨다.
 * role: head = 중심 화행을 수행하는 절, support = 그 강도·완화·선택권을 직접
 * 조절하는 보조 구간. 목표와 무관한 화행(서두 인사·감사 등)은 포함하지 않는다.
 */
export const FocalSegmentSchema = z.object({
  text: z.string().min(1),
  role: z.enum(["head", "support"]),
});
export type FocalSegment = z.infer<typeof FocalSegmentSchema>;

/** 서버가 실측해 주입하는 원문 분량 정책 스냅샷. 모델 출력 필드는 아니다. */
export const CoreLengthPolicySnapshotSchema = z.object({
  version: z.string().min(1),
  unit: z.literal("effective_chars"),
  min: z.number().int().nonnegative(),
  max: z.number().int().positive(),
  actual: z.number().int().nonnegative(),
});
export type CoreLengthPolicySnapshot = z.infer<typeof CoreLengthPolicySnapshotSchema>;

export const ScenarioCoreV3Schema = ScenarioCoreV2Schema.extend({
  schema_version: z.literal("scenario_core_v3"),
  /** head 정확히 1 + support 0~2 (R29). legacy 코어는 부재. */
  focal_segments: z.array(FocalSegmentSchema).min(1).max(3).optional(),
  /** 생성 당시 길이 정책과 실측값. legacy 코어는 부재. */
  length_policy: CoreLengthPolicySnapshotSchema.optional(),
});
export type ScenarioCoreV3 = z.infer<typeof ScenarioCoreV3Schema>;

/** 정규화 런타임 형태 = v3(상위집합). 소비자는 이 형태만 본다. */
export type ScenarioCoreRuntime = ScenarioCoreV3;

/**
 * 코어 정규화 — v1(방향 없음) 또는 v2 JSON을 읽어 v2 런타임 형태로 통일한다(0-l·84).
 * v1은 자동으로 direction='ko_zh', 필드명 매핑(source_text_ko→source_text 등).
 * 모든 소비자(규칙검사·러너·편성)는 이 정규화 형태만 본다.
 */
export function normalizeCore(input: unknown): {
  ok: boolean;
  data?: ScenarioCoreRuntime;
  error?: z.ZodError;
} {
  const sv = (input as { schema_version?: string } | null)?.schema_version;
  if (sv === "scenario_core_v3") {
    const r = ScenarioCoreV3Schema.safeParse(input);
    if (r.success) return { ok: true, data: r.data };
    return { ok: false, error: r.error };
  }
  if (sv === "scenario_core_v2") {
    const r = ScenarioCoreV2Schema.safeParse(input);
    // v2 → v3 승격(focal_segments 부재 = 단문 원문). 필드명은 동일하다.
    if (r.success) return { ok: true, data: { ...r.data, schema_version: "scenario_core_v3" } };
    return { ok: false, error: r.error };
  }
  // v1 또는 미상 → v1으로 파싱 후 v2 형태로 변환(direction=ko_zh).
  const v1 = ScenarioCoreV1Schema.safeParse(input);
  if (!v1.success) return { ok: false, error: v1.error };
  const c = v1.data;
  return {
    ok: true,
    data: {
      schema_version: "scenario_core_v3",
      direction: DEFAULT_DIRECTION,
      situation_ko: c.situation_ko,
      relation_ko: c.relation_ko,
      source_modality: c.source_modality,
      source_text: c.source_text_ko,
      preceding_turn: c.preceding_turn_zh,
      pdr: c.pdr,
      ...(c.channel ? { channel: c.channel } : {}), // legacy only
      ...(c.brief_note_ko ? { brief_note_ko: c.brief_note_ko } : {}),
      ...(c.context_spec ? { context_spec: c.context_spec } : {}),
      ...(c.usable_facts?.length ? { usable_facts: c.usable_facts } : {}),
      ...(c.provenance ? { provenance: c.provenance } : {}),
      ...(c.generation ? { generation: c.generation } : {}),
      ...(c.hsk_lexical_audit ? { hsk_lexical_audit: c.hsk_lexical_audit } : {}),
    },
  };
}

/** direction만 안전하게 뽑는다(정규화 실패해도 편성 필터가 동작하게). */
export function coreDirection(input: unknown): LanguageDirection {
  const d = (input as { direction?: string } | null)?.direction;
  return d === "zh_ko" ? "zh_ko" : DEFAULT_DIRECTION;
}

/** provenance 성격의 필드를 제외해 내용 중복 해시를 정책 버전과 독립시킨다. */
export function coreContentForHash(
  core: Record<string, unknown>,
): Record<string, unknown> {
  const {
    provenance: _provenance,
    generation: _generation,
    length_policy: _lengthPolicy,
    hsk_lexical_audit: _hskLexicalAudit,
    ...content
  } = core;
  return content;
}
