import { describe, expect, it, vi } from 'vitest'
import {
  collectMissionChineseTexts,
  createHskLexicalAudit,
  extractDistinctChineseTokens,
  hskReferenceCeiling,
  repairSegmentation,
} from '../../../supabase/functions/_shared/hskLexicalAudit'

describe('HSK 3.0 lexical reference policy', () => {
  it('maps PRAGMA levels to cumulative lexical ceilings without claiming equivalence', () => {
    expect(hskReferenceCeiling('beginner_intermediate')).toBe(4)
    expect(hskReferenceCeiling('intermediate')).toBe(5)
    expect(hskReferenceCeiling('advanced')).toBe(6)
    expect(hskReferenceCeiling(undefined, '중급 · 중국어 어휘 참고 상한 HSK 5급 누적')).toBe(5)
  })

  it('extracts distinct Chinese word-like tokens', () => {
    const tokens = extractDistinctChineseTokens(['您好，我们今天确认合同。', '合同已经确认。'])
    expect(tokens).toContain('合同')
    expect(new Set(tokens).size).toBe(tokens.length)
  })

  it('collects Chinese target fields for ko_zh missions', () => {
    const result = collectMissionChineseTexts({
      mpj_items: [{ target: '请确认。', recommended_example: '麻烦您确认。', corrections: [{ text: '请您确认。' }] }],
      production_task: { reference_alternatives: [{ text: '能否请您确认合同？' }] },
    }, 'ko_zh')
    expect(result.scope).toBe('zh_target_mission')
    expect(result.texts).toContain('能否请您确认合同？')
  })

  it('collects only Chinese source fields for zh_ko missions', () => {
    const result = collectMissionChineseTexts({
      mpj_items: [{ source: '请确认合同。', target: '계약을 확인해 주세요.' }],
      production_task: { source_text: '我们需要今天确认合同。', reference_alternatives: [{ text: '확인 부탁드립니다.' }] },
    }, 'zh_ko')
    expect(result.scope).toBe('zh_source_mission')
    expect(result.texts).toEqual(['请确认合同。', '我们需要今天确认合同。'])
  })

  it('returns a non-blocking audit with review candidates', async () => {
    const matchTokens = vi.fn(async (tokens: string[]) =>
      tokens.filter((token) => token === '合同').map((headword) => ({ headword, intro_level: 4 })),
    )
    const audit = await createHskLexicalAudit({
      texts: ['请确认合同。'],
      direction: 'ko_zh',
      scope: 'zh_target_mission',
      referenceCeiling: 4,
      matchTokens,
    })
    expect(audit.status).toBe('complete')
    expect(audit.non_blocking).toBe(true)
    expect(audit.matched_token_count).toBeGreaterThanOrEqual(1)
    expect(audit.out_of_reference_candidates).not.toContain('合同')
  })

  it('does not fail generation when the reference lookup is unavailable', async () => {
    const audit = await createHskLexicalAudit({
      texts: ['请确认合同。'],
      direction: 'ko_zh',
      scope: 'zh_target_mission',
      referenceCeiling: 4,
      matchTokens: async () => { throw new Error('table missing') },
    })
    expect(audit.status).toBe('unavailable')
    expect(audit.non_blocking).toBe(true)
  })
})

describe('HSK audit segmentation repair (v2)', () => {
  // 작은 HSK 사전: 표제어 → 등급
  const DICT: Record<string, number> = { 您: 1, 好: 1, 我: 1, 只: 1, 想: 1, 把: 3, 周: 2, 五: 1, 保管: 6, 保: 5, 管: 4, 合同: 4, 核实: 7, 核: 7 }
  const matchTokens = vi.fn(async (tokens: string[], ceiling: number) =>
    tokens.filter((t) => DICT[t] !== undefined && DICT[t] <= ceiling).map((headword) => ({ headword, intro_level: DICT[headword] })),
  )

  it('splits combined tokens into HSK headwords and counts them when every part is within the ceiling', async () => {
    const repaired = await repairSegmentation({ unmatched: ['您好', '我只', '周五', '助教'], referenceCeiling: 5, matchTokens })
    expect(repaired).toEqual([
      { token: '您好', parts: ['您', '好'] },
      { token: '我只', parts: ['我', '只'] },
      { token: '周五', parts: ['周', '五'] },
    ])
  })

  it('does not split genuine higher-level headwords and keeps the raw value for traceability', async () => {
    const audit = await createHskLexicalAudit({
      texts: ['您好', '保管', '核实', '合同'],
      direction: 'ko_zh',
      scope: 'zh_target_mission',
      referenceCeiling: 5,
      matchTokens: async (tokens, ceiling) => matchTokens(tokens, ceiling),
    })
    // 保管(6급)·核实(7급)은 표제어이므로 쪼개 세지 않는다.
    expect(audit.out_of_reference_candidates).toEqual(expect.arrayContaining(['保管', '核实']))
    expect(audit.out_of_reference_candidates).not.toContain('您好')
    expect(audit.segmentation_repair?.repaired_examples).toContain('您好→您+好')
    expect(audit.segmentation_repair?.raw_matched_token_count).toBe(audit.matched_token_count - (audit.segmentation_repair?.repaired_token_count ?? 0))
    expect(audit.policy_version).toBe('hsk3_lexical_reference_v2')
  })
})
