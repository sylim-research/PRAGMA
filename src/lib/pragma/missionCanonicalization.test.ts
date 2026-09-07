import { describe, expect, it } from 'vitest'

import {
  NATIVE_MPJ5_TOPOLOGY_MAX_ATTEMPTS,
  applyNativeMpj5FrozenTopology,
  buildNativeMpj5FrozenTopology,
  buildNativeMpj5SituationRepairPacket,
  canonicalizeNativeMpj5AnchorPdr,
  canonicalizeNativeMpj5ContextTopology,
  isNativeMpj5SituationReplacementTopologySafe,
} from '../../../supabase/functions/_shared/missionCanonicalization'

describe('native MPJ5 frozen topology', () => {
  const core = {
    situation_ko: '학과장에게 다음 주 발표 자료를 메일로 보낸다. 오늘 중 검토를 정중히 요청해야 한다.',
    relation_ko: '학생과 학과장',
    channel: 'email',
    pdr: { p: 'speaker_lower', d: 'distant', r: 'mid' },
    source_modality: 'written',
  }
  const raw = {
    x: {
      situation_ko: '친한 동료에게 회의 자료를 메신저로 보낸다. 내일까지 의견을 편하게 부탁한다.',
      relation_ko: '친한 동료 사이',
      channel: 'messenger',
      pdr: { p: 'equal', d: 'distant', r: 'mid' },
    },
    anchor: {
      situation_ko: '지도교수에게 연구 계획서를 메일로 보낸다. 이번 주 안에 검토를 정중히 부탁한다.',
      relation_ko: '학생과 지도교수',
      channel: 'email',
      pdr: { p: 'speaker_lower', d: 'distant', r: 'mid' },
    },
    y: {
      situation_ko: '회사 대표에게 계약 초안을 메일로 보낸다. 오늘 안에 승인을 매우 정중히 요청한다.',
      relation_ko: '인턴과 회사 대표',
      channel: 'email',
      pdr: { p: 'speaker_lower', d: 'distant', r: 'high' },
    },
  }

  it('accepts aligned PDR and freezes C without changing authored X/A/Y codes', () => {
    const built = buildNativeMpj5FrozenTopology(raw, core)

    expect(NATIVE_MPJ5_TOPOLOGY_MAX_ATTEMPTS).toBe(2)
    expect(built.findings).toEqual([])
    expect(built.topology.anchor.pdr).toEqual(core.pdr)
    expect(built.topology.c).toMatchObject({
      situation_ko: core.situation_ko,
      relation_ko: core.relation_ko,
      pdr: core.pdr,
    })
    expect(built.topology.x.pdr).toEqual({ ...core.pdr, p: 'equal' })
    expect(built.topology.y.pdr).toEqual({ ...core.pdr, r: 'high' })
  })

  it('overwrites only scene topology and preserves model-authored candidate content', () => {
    const { topology } = buildNativeMpj5FrozenTopology(raw, core)
    const items = Array.from({ length: 5 }, (_, index) => ({
      type: `type-${index}`,
      situation_ko: `model scene ${index}`,
      candidates: [`candidate-${index}`],
      feedback: { keep: index },
    }))

    const applied = applyNativeMpj5FrozenTopology(items, topology)

    expect(applied.map((item) => item.situation_ko)).toEqual([
      topology.x.situation_ko,
      topology.anchor.situation_ko,
      topology.anchor.situation_ko,
      topology.anchor.situation_ko,
      topology.y.situation_ko,
    ])
    expect(applied[3].candidates).toEqual(['candidate-3'])
    expect(applied[3].feedback).toEqual({ keep: 3 })
  })

  it('rejects literal scene collisions before full-mission generation', () => {
    const duplicate = {
      ...raw,
      y: { ...raw.y, situation_ko: raw.x.situation_ko },
    }

    const built = buildNativeMpj5FrozenTopology(duplicate, core)
    expect(built.findings).toContainEqual(expect.objectContaining({ code: 'R27', path: 'y.situation_ko' }))
  })

  it('rejects a conflicting Anchor instead of hiding it with the core PDR', () => {
    const authoredPdr = { p: 'speaker_higher', d: 'close', r: 'high' }
    const built = buildNativeMpj5FrozenTopology({
      ...raw, anchor: { ...raw.anchor, pdr: authoredPdr },
    }, core)
    expect(built.topology.anchor.pdr).toEqual(authoredPdr)
    expect(built.findings).toContainEqual(expect.objectContaining({ code: 'R27', path: 'c.pdr' }))
  })

  it.each([
    { ...core.pdr },
    { ...core.pdr, p: 'equal', r: 'high' },
    { p: 'invalid', d: 'distant', r: 'mid' },
    {},
  ])('rejects invalid contrasts without inventing or dropping axes: %j', (pdr) => {
    const built = buildNativeMpj5FrozenTopology({ ...raw, x: { ...raw.x, pdr } }, core)
    expect(built.topology.x.pdr).toEqual(pdr)
    expect(built.findings.some(f => f.path.startsWith('x.pdr'))).toBe(true)
  })

  it('keeps C nonempty and collision hard while leaving its shape to the mission warning', () => {
    const oneSentenceCore = { ...core, situation_ko: '학과장에게 검토를 요청하는 한 문장 장면이다.' }
    const oneSentence = buildNativeMpj5FrozenTopology(raw, oneSentenceCore)
    expect(oneSentence.findings).not.toContainEqual(expect.objectContaining({ path: 'c.situation_ko' }))

    const colliding = buildNativeMpj5FrozenTopology({
      ...raw,
      anchor: { ...raw.anchor, situation_ko: core.situation_ko },
    }, core)
    expect(colliding.findings).toContainEqual(expect.objectContaining({ code: 'R27', path: 'c.situation_ko' }))

    const empty = buildNativeMpj5FrozenTopology(raw, { ...core, situation_ko: '' })
    expect(empty.findings).toContainEqual(expect.objectContaining({ code: 'R27', path: 'c.situation_ko' }))
  })
})

describe('canonicalizeNativeMpj5AnchorPdr', () => {
  it('copies the production PDR onto anchor items and preserves one axis for both contrasts', () => {
    const anchor = { p: 'equal', d: 'acquaintance', r: 'low' }
    const items = [
      { type: 'scale4', pdr: { p: 'speaker_lower', d: 'distant', r: 'mid' } },
      { type: 'judge3', pdr: { p: 'speaker_lower', d: 'distant', r: 'mid' } },
      { type: 'fix_choice', pdr: { p: 'speaker_higher', d: 'close', r: 'high' } },
      { type: 'reason', pdr: { p: 'speaker_lower', d: 'close', r: 'high' } },
      { type: 'multi_judge', pdr: { p: 'equal', d: 'close', r: 'low' } },
    ]

    const result = canonicalizeNativeMpj5AnchorPdr(items, anchor)

    expect(result.map((item) => item.pdr)).toEqual([
      { p: 'speaker_lower', d: 'acquaintance', r: 'low' },
      anchor,
      anchor,
      anchor,
      items[4].pdr,
    ])
  })

  it('reduces multi-axis X/Y contrasts to one valid axis', () => {
    const anchor = { p: 'equal', d: 'acquaintance', r: 'low' }
    const items = [
      { type: 'scale4', pdr: { p: 'speaker_lower', d: 'distant', r: 'high' } },
      { type: 'multi_judge', pdr: { p: 'speaker_higher', d: 'close', r: 'high' } },
    ]

    expect(canonicalizeNativeMpj5AnchorPdr(items, anchor)).toEqual([
      { type: 'scale4', pdr: { p: 'speaker_lower', d: 'acquaintance', r: 'low' } },
      { type: 'multi_judge', pdr: { p: 'speaker_higher', d: 'acquaintance', r: 'low' } },
    ])
  })

  it('creates a deterministic adjacent burden contrast when the model copied the anchor', () => {
    const anchor = { p: 'equal', d: 'close', r: 'low' }
    const items = [{ type: 'multi_judge', pdr: { ...anchor } }]

    expect(canonicalizeNativeMpj5AnchorPdr(items, anchor)).toEqual([
      { type: 'multi_judge', pdr: { p: 'equal', d: 'close', r: 'mid' } },
    ])
  })

  it('leaves items unchanged when the production PDR is absent', () => {
    const items = [{ type: 'reason', pdr: { p: 'equal', d: 'close', r: 'low' } }]
    expect(canonicalizeNativeMpj5AnchorPdr(items, null)).toBe(items)
  })
})

describe('canonicalizeNativeMpj5ContextTopology', () => {
  it('freezes MJT2 Anchor A onto MJT3 and MJT4 without changing expressions', () => {
    const anchorPdr = { p: 'equal', d: 'acquaintance', r: 'mid' }
    const items = [
      { type: 'scale4', situation_ko: 'Contrast X', relation_ko: 'X relation', channel: 'messenger', pdr: { ...anchorPdr, r: 'low' } },
      { type: 'judge3', situation_ko: 'Anchor A', relation_ko: 'A relation', channel: 'email', pdr: anchorPdr, target: 'judge' },
      { type: 'fix_choice', situation_ko: 'old fix scene', relation_ko: 'old relation', channel: 'messenger', pdr: anchorPdr, corrections: ['fixed'] },
      { type: 'reason', situation_ko: 'old reason scene', relation_ko: 'old relation', channel: 'messenger', pdr: anchorPdr, reasons: ['fixed'] },
      { type: 'multi_judge', situation_ko: 'Contrast Y', relation_ko: 'Y relation', channel: 'messenger', pdr: { ...anchorPdr, r: 'high' } },
    ]

    const result = canonicalizeNativeMpj5ContextTopology(items, anchorPdr)

    expect(result.map((item) => item.situation_ko)).toEqual([
      'Contrast X', 'Anchor A', 'Anchor A', 'Anchor A', 'Contrast Y',
    ])
    expect(result[2]).toMatchObject({ relation_ko: 'A relation', channel: 'email', corrections: ['fixed'] })
    expect(result[3]).toMatchObject({ relation_ko: 'A relation', channel: 'email', reasons: ['fixed'] })
  })

  it('gives R27 repair the frozen slot context and Anchor A', () => {
    const mission = {
      mpj_items: [
        { type: 'scale4', situation_ko: 'X', pdr: { p: 'equal', d: 'close', r: 'low' }, source: 'source X' },
        { type: 'judge3', situation_ko: 'A', pdr: { p: 'equal', d: 'close', r: 'mid' }, relation_ko: 'anchor relation', channel: 'email' },
        { type: 'fix_choice', situation_ko: 'A' },
        { type: 'reason', situation_ko: 'A' },
        { type: 'multi_judge', situation_ko: 'A', pdr: { p: 'equal', d: 'close', r: 'high' }, source: 'source Y' },
      ],
      production_task: { situation_ko: 'C', pdr: { p: 'equal', d: 'close', r: 'mid' } },
    }

    expect(buildNativeMpj5SituationRepairPacket(mission, 'mpj_items[4].situation_ko')).toMatchObject({
      topology_role: 'contrast_y',
      target_context: { pdr: { p: 'equal', d: 'close', r: 'high' }, source: 'source Y' },
      anchor_a: { situation_ko: 'A', relation_ko: 'anchor relation', channel: 'email' },
    })
  })

  it('rejects topology collisions across multiple situation replacements', () => {
    const mission = {
      mpj_items: [
        { type: 'scale4', situation_ko: 'A' },
        { type: 'judge3', situation_ko: 'A' },
        { type: 'fix_choice', situation_ko: 'A' },
        { type: 'reason', situation_ko: 'A' },
        { type: 'multi_judge', situation_ko: 'A' },
      ],
      production_task: { situation_ko: 'C' },
    }
    const accepted = new Map([['mpj_items[0].situation_ko', 'new contrast']])

    expect(isNativeMpj5SituationReplacementTopologySafe(
      mission, 'mpj_items[4].situation_ko', 'new contrast', accepted,
    )).toBe(false)
    expect(isNativeMpj5SituationReplacementTopologySafe(
      mission, 'mpj_items[4].situation_ko', 'different contrast', accepted,
    )).toBe(true)
    expect(isNativeMpj5SituationReplacementTopologySafe(
      mission, 'mpj_items[2].situation_ko', 'A', accepted,
    )).toBe(true)
  })
})
