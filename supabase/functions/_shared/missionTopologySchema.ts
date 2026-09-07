const values = {
  p: ['speaker_lower', 'equal', 'speaker_higher'],
  d: ['close', 'acquaintance', 'distant'],
  r: ['low', 'mid', 'high'],
} as const

/** Constrain the authored plan rather than rewriting its PDR after generation. */
export function missionTopologySchema(anchor: Record<string, unknown>, spoken: boolean) {
  const axes = ['p', 'd', 'r'] as const
  const fixedPdr = (pdr: Record<string, unknown>) => ({
    type: 'object',
    additionalProperties: false,
    required: [...axes],
    properties: Object.fromEntries(axes.map(axis => [
      axis, { type: 'string', enum: [pdr[axis]] },
    ])),
  })
  for (const axis of axes) {
    if (!values[axis].includes(anchor[axis] as never)) throw new Error('Invalid core PDR: ' + axis)
  }
  const contrasts = axes.flatMap(axis => values[axis]
    .filter(value => value !== anchor[axis])
    .map(value => fixedPdr({ ...anchor, [axis]: value })))
  const scene = (pdr: object) => ({
    type: 'object',
    additionalProperties: false,
    required: ['situation_ko', 'relation_ko', 'channel', 'pdr'],
    properties: {
      situation_ko: { type: 'string' },
      relation_ko: { type: 'string' },
      channel: { type: 'string', enum: spoken ? ['facetoface', 'phone'] : ['email', 'messenger'] },
      pdr,
    },
  })
  return {
    type: 'object',
    additionalProperties: false,
    required: ['x', 'anchor', 'y'],
    properties: {
      x: scene({ anyOf: contrasts }),
      anchor: scene(fixedPdr(anchor)),
      y: scene({ anyOf: contrasts }),
    },
  }
}
