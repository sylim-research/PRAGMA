import { describe, expect, it } from 'vitest'
import { missionCriticContent } from '../../../supabase/functions/_shared/missionConsistency'
import { missionTopologySchema } from '../../../supabase/functions/_shared/missionTopologySchema'

describe('content consistency inputs', () => {
  it('keeps the current candidate and removes old verdicts and quoted repair history', () => {
    const current = { text: '지금 표시하는 후보', note_ko: '현재 해설' }
    const input = {
      schema_version: 'mission_v5', mpj_items: [{ candidates: [current] }],
      production_task: { source_text: '원문' },
      quality_check: { findings: [{ note_ko: '삭제된 후보 인용' }] },
      provenance: { repair_history: '이전 후보' }, authoring: { prior_grade: 'pass' },
      hsk_lexical_audit: { status: 'old' },
    }
    expect(missionCriticContent(input)).toEqual({
      schema_version: 'mission_v5', mpj_items: [{ candidates: [current] }],
      production_task: { source_text: '원문' },
    })
    expect(input.quality_check.findings).toHaveLength(1)
  })

  it('offers only six one-axis contrasts and fixes the Anchor to the core codes', () => {
    const anchor = { p: 'equal', d: 'distant', r: 'low' }
    const schema = missionTopologySchema(anchor, true)
    const contrasts = (schema.properties.x.properties.pdr as { anyOf: Array<{
      properties: Record<string, { enum: unknown[] }>
    }> }).anyOf
    expect(contrasts).toHaveLength(6)
    for (const candidate of contrasts) {
      expect(Object.entries(anchor).filter(([axis, value]) =>
        candidate.properties[axis].enum[0] !== value)).toHaveLength(1)
    }
    expect(schema.properties.anchor.properties.pdr).toMatchObject({
      properties: { p: { enum: ['equal'] }, d: { enum: ['distant'] }, r: { enum: ['low'] } },
    })
    expect(schema.properties.x.properties.channel.enum).toEqual(['facetoface', 'phone'])
    expect(() => missionTopologySchema({ ...anchor, p: 'higher' }, false)).toThrow()
  })
})
