// 원자료 분석 보관함 접근층.
//
// 분석 결과는 지금까지 화면에만 있었다. 후보 3건 중 시나리오로 넘긴 1건만 살아남고
// 나머지는 화면을 벗어나면 사라졌다. 여기서 분석 1회를 통째로 남긴다.
//
// 테이블이 아직 원격에 없을 수 있다(마이그레이션 push는 별도 승인 사안). 그래서 모든
// 읽기·쓰기가 실패해도 화면이 죽지 않게 실패를 값으로 돌려준다 — 분석 자체는 DB 없이도
// 되므로, 보관만 조용히 접힌다.

import { supabase } from "@/integrations/supabase/client";
import type { AuthenticApply } from "@/pages/admin/AuthenticImportPanel";
import type { CoreProvenance, CoreSourceType } from "@/lib/pragma/coreSchema";

/** 후보의 enum 묶음(출발문·출처 제외) — conditions jsonb로 그대로 보관한다. */
export type AuthenticConditions = Omit<AuthenticApply, "provenance" | "source_text">;

export type AuthenticAnalysisInput = {
  source_type: "image" | "text";
  source_ref: string | null;
  source_original: string;
  extraction_confidence?: string | null;
  scene_ko?: string | null;
  linguistic_features_ko?: string | null;
  recommendation_reason_ko?: string | null;
  recommended_uses?: string[];
  connectable_speech_acts?: string[];
};

export type AuthenticCandidateInput = {
  usage_type: string;
  label_ko?: string | null;
  source_text?: string | null;
  preceding_turn?: string | null;
  situation_seed_ko?: string | null;
  source_usage_note_ko?: string | null;
  ai_adaptation_note_ko?: string | null;
  conditions: AuthenticConditions;
  expression?: Record<string, unknown> | null;
};

export type StoredCandidate = {
  id: string;
  analysis_id: string;
  ordinal: number;
  usage_type: string;
  label_ko: string | null;
  source_text: string | null;
  preceding_turn: string | null;
  situation_seed_ko: string | null;
  source_usage_note_ko: string | null;
  ai_adaptation_note_ko: string | null;
  conditions: AuthenticConditions;
  expression: Record<string, unknown> | null;
  status: "stored" | "used" | "held" | "discarded";
  used_scenario_id: string | null;
};

export type StoredAnalysis = {
  id: string;
  created_at: string;
  source_type: "image" | "text";
  source_ref: string | null;
  source_original: string;
  extraction_confidence: string | null;
  scene_ko: string | null;
  linguistic_features_ko: string | null;
  recommendation_reason_ko: string | null;
  recommended_uses: string[] | null;
  connectable_speech_acts: string[] | null;
  candidates: StoredCandidate[];
};

/** 보관 실패는 예외로 던지지 않는다 — 분석은 이미 화면에 있고, 보관만 못 한 상태다.
 *  이 레포는 strictNullChecks가 꺼져 있어 판별 union이 좁혀지지 않는다. 평평하게 둔다. */
export type StoreResult = { ok: boolean; analysisId?: string; reason?: string };

// 테이블·함수가 아직 없는 원격을 구분한다(마이그레이션 미적용).
const isMissingSchema = (message: string) =>
  /does not exist|schema cache|not find the function|relation .* does not exist/i.test(message);

export const AUTHENTIC_STORE_PENDING =
  "분석 기록 저장소가 아직 준비되지 않았습니다. 마이그레이션 적용 후 저장됩니다.";

export async function saveAuthenticAnalysis(
  analysis: AuthenticAnalysisInput,
  candidates: AuthenticCandidateInput[],
): Promise<StoreResult> {
  try {
    const { data, error } = await (supabase as any).rpc("save_authentic_analysis", {
      p_analysis: analysis,
      p_candidates: candidates,
    });
    if (error) {
      return {
        ok: false,
        reason: isMissingSchema(error.message) ? AUTHENTIC_STORE_PENDING : error.message,
      };
    }
    return { ok: true, analysisId: data as string };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export async function setCandidateStatus(
  candidateId: string,
  status: StoredCandidate["status"],
  scenarioId?: string | null,
): Promise<void> {
  await (supabase as any).rpc("set_authentic_candidate_status", {
    p_candidate_id: candidateId,
    p_status: status,
    p_scenario_id: scenarioId ?? null,
  });
}

export async function listAuthenticAnalyses(limit = 30): Promise<{
  rows: StoredAnalysis[];
  pending: boolean;
  error: string | null;
}> {
  try {
    const { data, error } = await (supabase as any)
      .from("authentic_analyses")
      .select("*, candidates:authentic_candidates(*)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingSchema(error.message)) return { rows: [], pending: true, error: null };
      return { rows: [], pending: false, error: error.message };
    }
    const rows = ((data ?? []) as StoredAnalysis[]).map((row) => ({
      ...row,
      candidates: [...(row.candidates ?? [])].sort((a, b) => a.ordinal - b.ordinal),
    }));
    return { rows, pending: false, error: null };
  } catch (e) {
    return { rows: [], pending: false, error: (e as Error).message };
  }
}

export async function getAnalysisById(id: string): Promise<StoredAnalysis | null> {
  const { data, error } = await (supabase as any)
    .from("authentic_analyses")
    .select("*, candidates:authentic_candidates(*)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as StoredAnalysis;
  return { ...row, candidates: [...(row.candidates ?? [])].sort((a, b) => a.ordinal - b.ordinal) };
}

export async function getStoredCandidate(candidateId: string): Promise<
  { candidate: StoredCandidate; analysis: StoredAnalysis } | null
> {
  const { data, error } = await (supabase as any)
    .from("authentic_candidates")
    .select("*, analysis:authentic_analyses(*)")
    .eq("id", candidateId)
    .maybeSingle();
  if (error || !data) return null;
  const { analysis, ...candidate } = data as StoredCandidate & { analysis: StoredAnalysis };
  return { candidate: candidate as StoredCandidate, analysis };
}

/** 보관된 후보를 생성기 폼이 받는 모양으로 되돌린다. */
export function storedCandidateToApply(
  candidate: StoredCandidate,
  analysis: StoredAnalysis,
): AuthenticApply {
  const sourceText = (candidate.source_text ?? "").trim();
  const original = (analysis.source_original ?? "").trim();
  const provenance: CoreProvenance = {
    source_type: (analysis.source_type === "image"
      ? "authentic_image"
      : "authentic_text") as CoreSourceType,
    source_ref: analysis.source_ref,
    source_original: original || null,
    // 사용 원문이 원자료와 다르면 AI가 재구성한 것이다(패널과 같은 규칙).
    ai_adapted: original.length > 0 && sourceText !== original,
  };
  return { ...candidate.conditions, source_text: sourceText, provenance };
}
