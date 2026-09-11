/**
 * Server-side severity for primary_reason_ambiguity (mission critic ⑨).
 *
 * The critic names which branch of ⑨ its finding falls under; the server derives the severity from that
 * branch instead of trusting the self-reported severity. A note that concludes "the distractor is secondary"
 * (branch ⓑ, the normal state of a distractor) can then no longer surface as a content fail.
 */
export const REASON_BRANCHES = [
  'false_premise',          // ⓐ the distractor's premise is not true of the source/scene/target
  'paraphrase_of_primary',  // the distractor restates the primary reason
  'competing_clear',        // ⓒ clearly competes with the primary as the biggest reason
  'competing_possible',     // ⓒ might compete with the primary
  'primary_off_focus',      // the accepted primary is a meaning/grammar issue, not the target feature
  'not_a_reason',           // an option only states a fact and gives no reason
  'secondary',              // ⓑ true and clearly secondary or another dimension — not a defect
] as const
export type ReasonBranch = typeof REASON_BRANCHES[number]

const FAIL_BRANCHES = new Set<string>([
  'false_premise', 'paraphrase_of_primary', 'competing_clear', 'primary_off_focus', 'not_a_reason',
])

export function calibrateReasonSeverity(
  reported: 'warning' | 'fail',
  branch: unknown,
): { severity: 'warning' | 'fail'; prefix: string } {
  const value = typeof branch === 'string' ? branch : ''
  if (FAIL_BRANCHES.has(value)) return { severity: 'fail', prefix: '' }
  if (value === 'competing_possible') return { severity: 'warning', prefix: '' }
  if (value === 'secondary') return { severity: 'warning', prefix: '[critic_reason_secondary_calibrated] ' }
  // No usable branch: never let an unclassified reason finding block as a content fail.
  return reported === 'fail'
    ? { severity: 'warning', prefix: '[critic_reason_branch_missing] ' }
    : { severity: 'warning', prefix: '' }
}
