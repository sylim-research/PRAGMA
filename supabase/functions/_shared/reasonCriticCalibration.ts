/**
 * Server-side severity for primary_reason_ambiguity (mission critic ⑨), quality_v24.
 *
 * Every distractor is by design "not the biggest reason", so the critic's own severity for a finding on a
 * distractor is unreliable: notes that conclude "secondary, does not compete" still arrived as fail, and a
 * named-branch list (v23) was mis-applied the same way. The server therefore knows which option is the
 * accepted primary and asks the critic only two facts about a distractor:
 *   reason_observation_present — the wording/position/fact the distractor describes really is in the
 *                                target/source/scene (whether it is the cause is not asked here);
 *   reason_competition         — none | possible | clear, against the primary.
 * The severity follows from those facts. Findings on the primary option or on the item as a whole keep the
 * critic's severity (e.g. a primary that is a meaning/grammar issue rather than the target feature).
 */
export const REASON_COMPETITION = ['none', 'possible', 'clear'] as const

type Severity = 'warning' | 'fail'

export function calibrateReasonFinding(
  mission: Record<string, unknown>,
  where: string,
  reported: Severity,
  facts: { reason_observation_present?: unknown; reason_competition?: unknown },
): { severity: Severity; prefix: string } {
  const match = /^mpj_items\[(\d+)\]\.reasons\[(\d+)\]/.exec(where)
  const items = Array.isArray(mission.mpj_items) ? mission.mpj_items as Array<Record<string, unknown>> : []
  const item = match ? items[Number(match[1])] : undefined
  const reasons = item && Array.isArray(item.reasons) ? item.reasons as Array<Record<string, unknown>> : []
  const reason = match ? reasons[Number(match[2])] : undefined
  const accepted = typeof item?.accepted_reason_id === 'string' ? item.accepted_reason_id : ''
  const onDistractor = Boolean(reason && accepted && reason.id !== accepted)
  if (!onDistractor) return { severity: reported, prefix: '' }

  const present = facts.reason_observation_present
  const competition = typeof facts.reason_competition === 'string' ? facts.reason_competition : ''
  if (present === false) return { severity: 'fail', prefix: '[reason_false_premise] ' }
  if (competition === 'clear') return { severity: 'fail', prefix: '[reason_competes_clear] ' }
  if (competition === 'possible') return { severity: 'warning', prefix: '[reason_competes_possible] ' }
  if (present === true && competition === 'none') {
    return { severity: 'warning', prefix: '[critic_reason_secondary_calibrated] ' }
  }
  // Facts missing: an unclassified distractor finding never blocks as a content fail.
  return { severity: 'warning', prefix: '[critic_reason_facts_missing] ' }
}
