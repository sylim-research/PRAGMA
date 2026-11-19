export const HSK3_REFERENCE_SOURCE_ID = 'hsk30_syllabus_2025_11_effective_2026_07'
export const HSK3_LEXICAL_AUDIT_POLICY_VERSION = 'hsk3_lexical_reference_v2'
/** HSK 3.0 표제어의 최고 등급(7–9급 묶음 포함). 분절 보정에서 「어느 등급에도 없는 단어」를 가릴 때 쓴다. */
export const HSK3_MAX_INTRO_LEVEL = 9
export const HSK3_SEGMENTATION_REPAIR_METHOD = 'hsk_headword_max_match_v1'

export type HskAuditDirection = 'ko_zh' | 'zh_ko'
export type HskAuditScope = 'zh_source_core' | 'zh_source_mission' | 'zh_target_mission'

export interface HskTokenMatch {
  headword: string
  intro_level: number
}

export interface HskLexicalAudit {
  status: 'complete' | 'not_applicable' | 'unavailable'
  policy_version: string
  source_id: string
  direction: HskAuditDirection
  scope: HskAuditScope
  reference_ceiling: number
  distinct_token_count: number
  matched_token_count: number
  coverage_ratio: number | null
  out_of_reference_candidates: string[]
  non_blocking: true
  note: string
  /** v2: 자동 분절이 묶은 결합형(예: 您好, 我只)을 HSK 표제어로 나눠 다시 대조한 기록. 보정 전 값도 남긴다. */
  segmentation_repair?: HskSegmentationRepair
}

export interface HskSegmentationRepair {
  method: string
  raw_matched_token_count: number
  raw_coverage_ratio: number
  repaired_token_count: number
  repaired_examples: string[]
}

type Segment = { segment: string; isWordLike?: boolean }
type SegmenterLike = { segment(text: string): Iterable<Segment> }
type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity?: 'grapheme' | 'word' | 'sentence' },
) => SegmenterLike

const HAN = /\p{Script=Han}/u
const HAN_RUN = /\p{Script=Han}+/gu

export function hskReferenceCeiling(level?: string | null, levelLabel?: string | null): number {
  if (level === 'advanced') return 6
  if (level === 'intermediate') return 5
  if (level === 'beginner_intermediate') return 4
  if (/HSK\s*6/.test(levelLabel ?? '')) return 6
  if (/HSK\s*5/.test(levelLabel ?? '')) return 5
  return 4
}

export function extractDistinctChineseTokens(texts: string[], maxTokens = 160): string[] {
  const tokens = new Set<string>()
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter
  const segmenter = Segmenter ? new Segmenter('zh', { granularity: 'word' }) : null

  for (const text of texts) {
    if (!text || !HAN.test(text)) continue
    if (segmenter) {
      for (const item of segmenter.segment(text)) {
        const token = item.segment.trim()
        if (item.isWordLike !== false && HAN.test(token)) tokens.add(token)
        if (tokens.size >= maxTokens) return [...tokens]
      }
    } else {
      for (const run of text.match(HAN_RUN) ?? []) {
        for (const token of [...run]) {
          tokens.add(token)
          if (tokens.size >= maxTokens) return [...tokens]
        }
      }
    }
  }
  return [...tokens]
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function textArray(value: unknown, field = 'text'): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => stringValue(recordValue(item)[field]))
    .filter((item): item is string => Boolean(item))
}

export function collectMissionChineseTexts(
  missionContent: unknown,
  direction: HskAuditDirection,
): { scope: HskAuditScope; texts: string[] } {
  const mission = recordValue(missionContent)
  const items = Array.isArray(mission.mpj_items) ? mission.mpj_items.map(recordValue) : []
  const production = recordValue(mission.production_task)
  const texts: string[] = []

  if (direction === 'zh_ko') {
    for (const item of items) {
      const source = stringValue(item.source)
      if (source) texts.push(source)
    }
    const productionSource = stringValue(production.source_text)
    if (productionSource) texts.push(productionSource)
    return { scope: 'zh_source_mission', texts }
  }

  for (const item of items) {
    for (const field of ['target', 'recommended_example', 'preceding_turn']) {
      const text = stringValue(item[field])
      if (text) texts.push(text)
    }
    texts.push(...textArray(item.corrections), ...textArray(item.candidates))
  }
  const precedingTurn = stringValue(production.preceding_turn)
  if (precedingTurn) texts.push(precedingTurn)
  texts.push(...textArray(production.reference_alternatives))
  return { scope: 'zh_target_mission', texts }
}

export async function createHskLexicalAudit(args: {
  texts: string[]
  direction: HskAuditDirection
  scope: HskAuditScope
  referenceCeiling: number
  matchTokens: (tokens: string[], referenceCeiling: number) => Promise<HskTokenMatch[]>
}): Promise<HskLexicalAudit> {
  const tokens = extractDistinctChineseTokens(args.texts)
  const base = {
    policy_version: HSK3_LEXICAL_AUDIT_POLICY_VERSION,
    source_id: HSK3_REFERENCE_SOURCE_ID,
    direction: args.direction,
    scope: args.scope,
    reference_ceiling: args.referenceCeiling,
    non_blocking: true as const,
  }
  if (tokens.length === 0) {
    return {
      ...base,
      status: 'not_applicable',
      distinct_token_count: 0,
      matched_token_count: 0,
      coverage_ratio: null,
      out_of_reference_candidates: [],
      note: 'No Chinese word-like tokens were detected in the audited fields.',
    }
  }

  try {
    // 모든 등급(1–9급)으로 조회해, 상한 안 단어와 「HSK 어디에도 표제어로 없는 단어」를 가른다.
    const levelOf = new Map<string, number>()
    for (const row of await args.matchTokens(tokens, HSK3_MAX_INTRO_LEVEL)) levelOf.set(row.headword, row.intro_level)
    const rawMatched = tokens.filter((token) => (levelOf.get(token) ?? Infinity) <= args.referenceCeiling)
    const repair = await repairSegmentation({
      unmatched: tokens.filter((token) => !levelOf.has(token)),
      referenceCeiling: args.referenceCeiling,
      matchTokens: args.matchTokens,
    })
    const repaired = new Set(repair.map((row) => row.token))
    const matchedCount = rawMatched.length + repaired.size
    const outside = tokens.filter((token) => (levelOf.get(token) ?? Infinity) > args.referenceCeiling && !repaired.has(token))
    return {
      ...base,
      status: 'complete',
      distinct_token_count: tokens.length,
      matched_token_count: matchedCount,
      coverage_ratio: Number((matchedCount / tokens.length).toFixed(4)),
      out_of_reference_candidates: outside.slice(0, 40),
      note: 'Candidate review only: unmatched tokens may be proper nouns, terms, or vocabulary above/outside the reference dataset. Combined tokens whose parts are all reference headwords are counted as matched (segmentation_repair).',
      segmentation_repair: {
        method: HSK3_SEGMENTATION_REPAIR_METHOD,
        raw_matched_token_count: rawMatched.length,
        raw_coverage_ratio: Number((rawMatched.length / tokens.length).toFixed(4)),
        repaired_token_count: repaired.size,
        repaired_examples: repair.slice(0, 20).map((row) => `${row.token}→${row.parts.join('+')}`),
      },
    }
  } catch (error) {
    return {
      ...base,
      status: 'unavailable',
      distinct_token_count: tokens.length,
      matched_token_count: 0,
      coverage_ratio: null,
      out_of_reference_candidates: [],
      note: `Reference lookup unavailable; generation was not blocked. ${error instanceof Error ? error.message : String(error)}`.slice(0, 300),
    }
  }
}

/**
 * 자동 분절(ICU)이 두 단어 이상을 하나로 묶어 HSK 표제어에 없게 된 단어를 HSK 표제어 사전(1–9급)으로
 * 가장 긴 단어부터 다시 나눈다. 나뉜 조각이 모두 참조 상한 이하의 표제어일 때만 「보정」으로 센다.
 * HSK에 어느 등급으로든 실린 단어(예: 保管 6급)는 쪼개지 않는다 — 호출하는 쪽이 그런 단어를 넘기지 않는다.
 */
export async function repairSegmentation(args: {
  unmatched: string[]
  referenceCeiling: number
  matchTokens: (tokens: string[], referenceCeiling: number) => Promise<HskTokenMatch[]>
  maxPieceLength?: number
}): Promise<Array<{ token: string; parts: string[] }>> {
  const maxLen = args.maxPieceLength ?? 4
  const candidates = args.unmatched.filter((token) => [...token].length > 1)
  if (candidates.length === 0) return []
  const pieces = new Set<string>()
  for (const token of candidates) {
    const chars = [...token]
    for (let i = 0; i < chars.length; i++) {
      for (let n = 1; n <= maxLen && i + n <= chars.length; n++) pieces.add(chars.slice(i, i + n).join(''))
    }
  }
  const dict = new Map<string, number>()
  for (const row of await args.matchTokens([...pieces], HSK3_MAX_INTRO_LEVEL)) dict.set(row.headword, row.intro_level)
  const result: Array<{ token: string; parts: string[] }> = []
  for (const token of candidates) {
    const chars = [...token]
    const parts: string[] = []
    let i = 0
    while (i < chars.length) {
      let n = Math.min(maxLen, chars.length - i)
      while (n > 1 && !dict.has(chars.slice(i, i + n).join(''))) n--
      parts.push(chars.slice(i, i + n).join(''))
      i += n
    }
    if (parts.length > 1 && parts.every((part) => (dict.get(part) ?? Infinity) <= args.referenceCeiling)) {
      result.push({ token, parts })
    }
  }
  return result
}
