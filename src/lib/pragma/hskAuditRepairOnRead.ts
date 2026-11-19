// HSK 어휘 대조 v1 기록(분절 보정 전)을 화면에서 읽을 때 보정한다(2026-11-19).
// 승인된 미션의 mission_content는 DB에서 바꿀 수 없으므로(guard_content_review_scenario),
// 저장값은 그대로 두고 저장된 목록 밖 후보만 HSK 표제어로 다시 나눠 본다. 서버 v2와 같은 규칙(repairSegmentation)을 쓴다.
import {
  HSK3_MAX_INTRO_LEVEL,
  repairSegmentation,
  type HskTokenMatch,
} from "../../../supabase/functions/_shared/hskLexicalAudit";
import type { AuditSnapshot } from "@/lib/pragma/hskAuditSnapshot";

/** 표제어 → 등급(없으면 null)을 한꺼번에 알려 주는 조회 함수. 화면에서는 hsk3_match_tokens RPC로 만든다. */
export type HskLevelLookup = (tokens: string[]) => Promise<HskTokenMatch[]>;

function substrings(token: string, maxLen = 4) {
  const chars = [...token];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    for (let n = 1; n <= maxLen && i + n <= chars.length; n++) out.push(chars.slice(i, i + n).join(""));
  }
  return out;
}

/**
 * 분절 보정 기록이 없는 완료 기록을 보정한다. 저장된 후보 목록이 잘린 기록(목록 밖 > 저장 후보 수)은
 * 정확히 셀 수 없으므로 그대로 둔다(repairSource = null).
 */
export async function repairAuditsOnRead(
  audits: AuditSnapshot[],
  lookup: HskLevelLookup,
): Promise<AuditSnapshot[]> {
  const targets = audits.filter((audit) =>
    audit.status === "complete"
    && audit.repairSource === null
    && audit.distinctTokenCount != null
    && audit.matchedTokenCount != null
    && audit.referenceCeiling != null
    && audit.distinctTokenCount - audit.matchedTokenCount === audit.candidates.length);
  if (targets.length === 0) return audits;

  // 후보와 그 조각을 한 번에 조회해 둔다(등급 캐시).
  const wanted = new Set<string>();
  for (const audit of targets) for (const word of audit.candidates) for (const piece of substrings(word)) wanted.add(piece);
  const level = new Map<string, number>();
  const list = [...wanted];
  for (let i = 0; i < list.length; i += 400) {
    for (const row of await lookup(list.slice(i, i + 400))) level.set(row.headword, row.intro_level);
  }
  const cachedMatch = async (tokens: string[], ceiling: number) =>
    tokens.filter((token) => (level.get(token) ?? Infinity) <= ceiling)
      .map((headword) => ({ headword, intro_level: level.get(headword) as number }));

  const repairedByAudit = new Map<AuditSnapshot, AuditSnapshot>();
  for (const audit of targets) {
    // HSK 어느 등급에든 실린 단어(예: 保管)는 쪼개지 않는다 — 서버 v2와 같은 규칙.
    const unmatched = audit.candidates.filter((word) => !level.has(word));
    const repair = await repairSegmentation({
      unmatched,
      referenceCeiling: audit.referenceCeiling as number,
      matchTokens: async (tokens) => cachedMatch(tokens, HSK3_MAX_INTRO_LEVEL),
    });
    const repaired = new Set(repair.map((row) => row.token));
    repairedByAudit.set(audit, {
      ...audit,
      matchedTokenCount: (audit.matchedTokenCount as number) + repaired.size,
      rawMatchedTokenCount: audit.matchedTokenCount,
      repairedTokenCount: repaired.size,
      repairedExamples: repair.slice(0, 20).map((row) => `${row.token}→${row.parts.join("+")}`),
      candidates: audit.candidates.filter((word) => !repaired.has(word)),
      repairSource: "on_read",
    });
  }
  return audits.map((audit) => repairedByAudit.get(audit) ?? audit);
}
