const NATIVE_MPJ5_ANCHOR_TYPES = new Set(['judge3', 'fix_choice', 'reason'])
const NATIVE_MPJ5_CONTRAST_TYPES = new Set(['scale4', 'multi_judge'])
const PDR_AXES = ['p', 'd', 'r'] as const
const PDR_VALUES = {
  p: ['speaker_lower', 'equal', 'speaker_higher'],
  d: ['close', 'acquaintance', 'distant'],
  r: ['low', 'mid', 'high'],
} as const

type SituationTopologyRole = 'contrast_x' | 'anchor_a' | 'contrast_y' | 'new_event_c' | 'unknown'

export const NATIVE_MPJ5_TOPOLOGY_MAX_ATTEMPTS = 2

export type NativeMpj5TopologyFinding = {
  code: 'R27' | 'R28' | 'TOPOLOGY_CONTEXT'
  path: string
  message: string
}

export type NativeMpj5FrozenScene = {
  situation_ko: string
  relation_ko: string
  channel: string
  pdr: Record<string, unknown>
}

export type NativeMpj5FrozenTopology = {
  version: 'native_mpj5_scene_topology_v1'
  source_modality: 'written' | 'spoken'
  x: NativeMpj5FrozenScene
  anchor: NativeMpj5FrozenScene
  y: NativeMpj5FrozenScene
  c: NativeMpj5FrozenScene
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function situationRole(path: string): SituationTopologyRole {
  if (path === 'mpj_items[0].situation_ko') return 'contrast_x'
  if (/^mpj_items\[(1|2|3)\]\.situation_ko$/.test(path)) return 'anchor_a'
  if (path === 'mpj_items[4].situation_ko') return 'contrast_y'
  if (path === 'production_task.situation_ko') return 'new_event_c'
  return 'unknown'
}

function missionSituationAt(mission: Record<string, unknown>, path: string): Record<string, unknown> {
  if (path === 'production_task.situation_ko') return record(mission.production_task)
  const itemMatch = path.match(/^mpj_items\[(\d+)\]\.situation_ko$/)
  const items = Array.isArray(mission.mpj_items) ? mission.mpj_items : []
  return itemMatch ? record(items[Number(itemMatch[1])]) : {}
}

const CANONICAL_SITUATION_PATHS = [
  'mpj_items[0].situation_ko',
  'mpj_items[1].situation_ko',
  'mpj_items[4].situation_ko',
  'production_task.situation_ko',
] as const

/**
 * Gives the slot-local R27 repair model the exact role, frozen item context,
 * and Anchor A it must preserve. This is deliberately limited to situation
 * repair and does not alter candidate blueprints or mission structure.
 */
export function buildNativeMpj5SituationRepairPacket(
  mission: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  const target = missionSituationAt(mission, path)
  const anchor = missionSituationAt(mission, 'mpj_items[1].situation_ko')
  const role = situationRole(path)
  return {
    path,
    topology_role: role,
    current_situation_ko: target.situation_ko,
    target_context: {
      item_type: target.type ?? (role === 'new_event_c' ? 'production_task' : null),
      pdr: target.pdr,
      relation_ko: target.relation_ko,
      channel: target.channel,
      source: target.source ?? target.source_text,
      preceding_turn: target.preceding_turn ?? null,
      mode: target.mode,
    },
    anchor_a: {
      path: 'mpj_items[1].situation_ko',
      situation_ko: anchor.situation_ko,
      pdr: anchor.pdr,
      relation_ko: anchor.relation_ko,
      channel: anchor.channel,
    },
    role_requirement: role === 'anchor_a'
      ? 'MJT2 Anchor A의 situation_ko를 글자까지 그대로 사용'
      : role === 'new_event_c'
        ? 'Anchor A의 PDR과 화행을 유지하되 구체적 사건은 X/A/Y와 다른 New Event C'
        : role === 'contrast_x' || role === 'contrast_y'
          ? 'target_context의 한 축 대비 PDR과 화행을 유지하는 별도 사건; X/A/Y/C와 완전 중복 금지'
          : '지목된 situation_ko만 국소 교체',
    immutable_situations: CANONICAL_SITUATION_PATHS
      .filter((peerPath) => peerPath !== path)
      .map((peerPath) => ({
        path: peerPath,
        topology_role: situationRole(peerPath),
        situation_ko: missionSituationAt(mission, peerPath).situation_ko,
      })),
  }
}

/** Exact-string collision guard matching the existing R27 v2 topology. */
export function isNativeMpj5SituationReplacementTopologySafe(
  mission: Record<string, unknown>,
  path: string,
  replacement: string,
  acceptedReplacements: ReadonlyMap<string, string> = new Map(),
): boolean {
  const normalized = replacement.trim()
  if (!normalized) return false
  const role = situationRole(path)
  const anchor = String(missionSituationAt(mission, 'mpj_items[1].situation_ko').situation_ko ?? '').trim()
  if (role === 'anchor_a') return normalized === anchor
  if (role === 'unknown') return false

  return CANONICAL_SITUATION_PATHS
    .filter((peerPath) => peerPath !== path)
    .every((peerPath) => {
      const peer = acceptedReplacements.get(peerPath) ??
        String(missionSituationAt(mission, peerPath).situation_ko ?? '')
      return normalized !== peer.trim()
    })
}

function canonicalizeContrastPdr(
  candidatePdr: unknown,
  anchorPdr: Record<string, unknown>,
): Record<string, unknown> {
  const candidate = candidatePdr && typeof candidatePdr === 'object' && !Array.isArray(candidatePdr)
    ? candidatePdr as Record<string, unknown>
    : {}
  const changedAxis = PDR_AXES.find((axis) =>
    PDR_VALUES[axis].includes(candidate[axis] as never) && candidate[axis] !== anchorPdr[axis])
  const axis = changedAxis ?? 'r'
  const values = PDR_VALUES[axis]
  const candidateValue = candidate[axis]
  const anchorIndex = values.indexOf(anchorPdr[axis] as never)
  const changedValue = changedAxis
    ? candidateValue
    : values[(Math.max(anchorIndex, 0) + 1) % values.length]

  return {
    ...anchorPdr,
    [axis]: changedValue,
  }
}

function frozenScene(value: unknown, pdr: Record<string, unknown>): NativeMpj5FrozenScene {
  const source = record(value)
  return {
    situation_ko: typeof source.situation_ko === 'string' ? source.situation_ko.trim() : '',
    relation_ko: typeof source.relation_ko === 'string' ? source.relation_ko.trim() : '',
    channel: typeof source.channel === 'string' ? source.channel.trim() : '',
    pdr,
  }
}

function pdrDifferenceCount(a: Record<string, unknown>, b: Record<string, unknown>): number {
  return PDR_AXES.reduce((count, axis) => count + Number(a[axis] !== b[axis]), 0)
}

function situationShapeValid(value: string): boolean {
  return value.length <= 140 && (value.match(/[.!?。！？]/g) ?? []).length === 2
}

/**
 * Converts one topology-only model response into the authoritative server plan.
 * Preserve model-authored X/A/Y PDR until validation. Silently replacing these
 * codes can leave an incompatible scene (e.g. a supervisor with equal P).
 * Only DCT C is copied from the authoritative core.
 */
export function buildNativeMpj5FrozenTopology(
  value: unknown,
  core: {
    situation_ko?: unknown
    relation_ko?: unknown
    channel?: unknown
    pdr?: unknown
    source_modality?: unknown
  },
): { topology: NativeMpj5FrozenTopology; findings: NativeMpj5TopologyFinding[] } {
  const raw = record(record(value).topology ?? value)
  const anchorPdr = record(core.pdr)
  const sourceModality = core.source_modality === 'spoken' ? 'spoken' : 'written'
  const topology: NativeMpj5FrozenTopology = {
    version: 'native_mpj5_scene_topology_v1',
    source_modality: sourceModality,
    x: frozenScene(raw.x, { ...record(record(raw.x).pdr) }),
    anchor: frozenScene(raw.anchor, { ...record(record(raw.anchor).pdr) }),
    y: frozenScene(raw.y, { ...record(record(raw.y).pdr) }),
    c: {
      situation_ko: typeof core.situation_ko === 'string' ? core.situation_ko.trim() : '',
      relation_ko: typeof core.relation_ko === 'string' ? core.relation_ko.trim() : '',
      channel: typeof core.channel === 'string' ? core.channel.trim() : '',
      pdr: { ...anchorPdr },
    },
  }
  return { topology, findings: validateNativeMpj5FrozenTopology(topology, core) }
}

/** Existing R27/R28 predicates only; this deliberately adds no semantic detector. */
export function validateNativeMpj5FrozenTopology(
  value: unknown,
  core?: { situation_ko?: unknown; relation_ko?: unknown; pdr?: unknown; source_modality?: unknown },
): NativeMpj5TopologyFinding[] {
  const topology = record(value) as Partial<NativeMpj5FrozenTopology>
  const findings: NativeMpj5TopologyFinding[] = []
  const x = record(topology.x)
  const anchor = record(topology.anchor)
  const y = record(topology.y)
  const c = record(topology.c)
  const scenes = [
    ['x', x],
    ['anchor', anchor],
    ['y', y],
    ['c', c],
  ] as const

  for (const [slot, scene] of scenes) {
    for (const axis of PDR_AXES) {
      if (!PDR_VALUES[axis].includes(record(scene.pdr)[axis] as never)) {
        findings.push({
          code: 'TOPOLOGY_CONTEXT',
          path: `${slot}.pdr.${axis}`,
          message: `${slot.toUpperCase()} PDR 코드가 유효하지 않음: ${axis}`,
        })
      }
    }
    const situation = typeof scene.situation_ko === 'string' ? scene.situation_ko.trim() : ''
    const relation = typeof scene.relation_ko === 'string' ? scene.relation_ko.trim() : ''
    // C is the server-frozen DCT scene. Its two-sentence/140-char shape is an
    // existing full-mission R27 warning, not a topology regeneration gate.
    // Nonempty and all collision/PDR/new-event protections remain hard here.
    if (!situation || (slot !== 'c' && !situationShapeValid(situation))) {
      findings.push({
        code: 'R27',
        path: `${slot}.situation_ko`,
        message: !situation
          ? `${slot.toUpperCase()} situation_ko가 비어 있음`
          : `${slot.toUpperCase()} situation_ko는 140자 이내의 정확히 2문장이어야 함`,
      })
    }
    if (!relation) {
      findings.push({
        code: 'TOPOLOGY_CONTEXT',
        path: `${slot}.relation_ko`,
        message: `${slot.toUpperCase()} relation_ko가 비어 있음`,
      })
    }
  }

  const normalized = scenes.map(([slot, scene]) => [slot, String(scene.situation_ko ?? '').trim()] as const)
  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      if (!normalized[i][1] || normalized[i][1] !== normalized[j][1]) continue
      findings.push({
        code: 'R27',
        path: `${normalized[j][0]}.situation_ko`,
        message: `${normalized[i][0].toUpperCase()}와 ${normalized[j][0].toUpperCase()} situation_ko가 완전히 중복됨`,
      })
    }
  }

  const anchorPdr = record(anchor.pdr)
  if (pdrDifferenceCount(record(x.pdr), anchorPdr) !== 1) {
    findings.push({ code: 'R27', path: 'x.pdr', message: 'Contrast X는 Anchor PDR에서 정확히 한 축만 달라야 함' })
  }
  if (pdrDifferenceCount(record(y.pdr), anchorPdr) !== 1) {
    findings.push({ code: 'R27', path: 'y.pdr', message: 'Contrast Y는 Anchor PDR에서 정확히 한 축만 달라야 함' })
  }
  if (pdrDifferenceCount(record(c.pdr), anchorPdr) !== 0) {
    findings.push({ code: 'R27', path: 'c.pdr', message: 'New Event C는 Anchor PDR을 그대로 사용해야 함' })
  }

  const sourceModality = topology.source_modality === 'spoken' ? 'spoken' : 'written'
  const allowedChannels = sourceModality === 'spoken'
    ? new Set(['facetoface', 'phone'])
    : new Set(['email', 'messenger'])
  for (const [slot, scene] of scenes.slice(0, 3)) {
    if (!allowedChannels.has(String(scene.channel ?? ''))) {
      findings.push({
        code: 'R28',
        path: `${slot}.channel`,
        message: `${slot.toUpperCase()} channel이 ${sourceModality} 수행 방식과 맞지 않음`,
      })
    }
  }

  if (core) {
    const expectedPdr = record(core.pdr)
    if (String(c.situation_ko ?? '').trim() !== String(core.situation_ko ?? '').trim() ||
        String(c.relation_ko ?? '').trim() !== String(core.relation_ko ?? '').trim() ||
        pdrDifferenceCount(record(c.pdr), expectedPdr) !== 0 ||
        topology.source_modality !== (core.source_modality === 'spoken' ? 'spoken' : 'written')) {
      findings.push({
        code: 'TOPOLOGY_CONTEXT',
        path: 'c',
        message: 'Frozen topology의 C/core lineage가 현재 core와 일치하지 않음',
      })
    }
  }
  return findings
}

/** Applies all frozen scene/PDR fields without touching model-authored candidates or feedback. */
export function applyNativeMpj5FrozenTopology<T>(
  items: T[],
  topology: NativeMpj5FrozenTopology,
): T[] {
  if (items.length !== 5) return items
  const scenes = [topology.x, topology.anchor, topology.anchor, topology.anchor, topology.y]
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const scene = scenes[index]
    return {
      ...(item as Record<string, unknown>),
      situation_ko: scene.situation_ko,
      relation_ko: scene.relation_ko,
      channel: scene.channel,
      pdr: { ...scene.pdr },
    } as T
  })
}

/**
 * Current native MPJ5 fixes three item contexts to the production-task PDR and
 * keeps exactly one valid model-authored contrast axis for scale4/multi_judge.
 * PDR is an experiment input, not model-authored content, so canonicalize the
 * copied metadata before provenance hashing instead of paying for retries when
 * the model changes only these codes.
 */
export function canonicalizeNativeMpj5AnchorPdr<T>(items: T[], anchorPdr: unknown): T[] {
  if (!anchorPdr || typeof anchorPdr !== 'object' || Array.isArray(anchorPdr)) return items

  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const record = item as Record<string, unknown>
    const itemType = String(record.type ?? '')
    if (NATIVE_MPJ5_CONTRAST_TYPES.has(itemType)) {
      return {
        ...record,
        pdr: canonicalizeContrastPdr(record.pdr, anchorPdr as Record<string, unknown>),
      } as T
    }
    if (!NATIVE_MPJ5_ANCHOR_TYPES.has(itemType)) return item
    return {
      ...record,
      pdr: { ...(anchorPdr as Record<string, unknown>) },
    } as T
  })
}

/**
 * R27 v2 context topology: X → A → A → A → Y.
 *
 * The model authors Anchor A once in MJT2. The server then freezes that exact
 * learner-facing situation (and its relation/channel metadata) onto MJT3·4
 * before candidate blueprints, provenance hashing, or persistence. Candidate
 * expressions remain model-authored and are not touched here.
 */
export function canonicalizeNativeMpj5ContextTopology<T>(items: T[], anchorPdr: unknown): T[] {
  const canonicalPdrItems = canonicalizeNativeMpj5AnchorPdr(items, anchorPdr)
  if (canonicalPdrItems.length !== 5) return canonicalPdrItems

  const anchor = canonicalPdrItems[1]
  if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) return canonicalPdrItems
  const anchorRecord = anchor as Record<string, unknown>
  if (String(anchorRecord.type ?? '') !== 'judge3' || typeof anchorRecord.situation_ko !== 'string') {
    return canonicalPdrItems
  }

  return canonicalPdrItems.map((item, index) => {
    if (index !== 2 && index !== 3) return item
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    const record = item as Record<string, unknown>
    if (!NATIVE_MPJ5_ANCHOR_TYPES.has(String(record.type ?? ''))) return item
    return {
      ...record,
      situation_ko: anchorRecord.situation_ko,
      relation_ko: anchorRecord.relation_ko,
      channel: anchorRecord.channel,
    } as T
  })
}
