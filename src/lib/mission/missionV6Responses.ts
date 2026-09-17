import { z } from "zod";
import { ScaleCodeV6, allowedBandCodes, type MissionV6 } from "@/lib/pragma/missionV6";
import type { MpjResponseTrace } from "./missionAttemptRow";

const base = { completed_at: z.string().datetime() };
const scale = z.object({ ...base, item_type: z.literal("scale4"), scale_code: ScaleCodeV6 }).strict();
export const MissionV6ResponsesSchema = z.tuple([
  scale.extend({ item_id: z.literal(1) }),
  // scale_code stays the first judgment made before reasons; revised_scale_code is present only when it changed afterwards.
  scale.extend({ item_id: z.literal(2), reason_id: z.string().min(1).optional(), revised_scale_code: ScaleCodeV6.optional() }),
  z.object({ ...base, item_id: z.literal(3), item_type: z.literal("fix_choice"), correction_indexes: z.array(z.number().int().min(0).max(2)).length(1) }).strict(),
  z.object({ ...base, item_id: z.literal(4), item_type: z.literal("free_correction"), revised_text: z.string().refine(value => value.trim().length > 0, "A submitted correction is required") }).strict(),
  // Band names differ per speech act, so the codes are checked against this mission's feature below.
  z.object({ ...base, item_id: z.literal(5), item_type: z.literal("multi_judge"), candidate_band_codes: z.array(z.string().min(1)).length(4) }).strict(),
]);

/** Validate membership against the exact content, without judging the reason. */
export function parseMissionV6Responses(mission: MissionV6, input: unknown): MpjResponseTrace[] {
  const parsed = MissionV6ResponsesSchema.parse(input);
  const choices = mission.mpj_items[1].reason_choice?.options;
  const selected = parsed[1].reason_id;
  if (choices ? !choices.some(choice => choice.id === selected) : selected !== undefined) {
    throw new z.ZodError([{ code: z.ZodIssueCode.custom, path: [1, "reason_id"],
      message: "Select one reason from this mission's MJT2 choices" }]);
  }
  const revised = parsed[1].revised_scale_code;
  if (revised !== undefined && (!choices || revised === parsed[1].scale_code)) {
    throw new z.ZodError([{ code: z.ZodIssueCode.custom, path: [1, "revised_scale_code"],
      message: "A revised judgment follows reasons and differs from the first judgment" }]);
  }
  const bands = allowedBandCodes(mission.unit.target_feature);
  const strayBand = parsed[4].candidate_band_codes.findIndex(code => !bands.includes(code));
  if (bands.length && strayBand >= 0) {
    throw new z.ZodError([{ code: z.ZodIssueCode.custom, path: [4, "candidate_band_codes", strayBand],
      message: `Each judgment must be a band of ${mission.unit.target_feature}` }]);
  }
  return parsed as MpjResponseTrace[];
}

/** Read actual choices, never reference answers. Existing v5 mapping is separate. */
export function buildMissionV6Responses(mission: MissionV6, responses: Record<string, unknown>, completedAt: string): MpjResponseTrace[] {
  const response = (id: string) => (responses[id] ?? {}) as Record<string, unknown>;
  const correctionIds = response("A3").correctionIds;
  const picks = response("A5").candidateJudgments as Record<string, unknown> | undefined;
  const trace = (index: number, values: Record<string, unknown>) => ({
    item_id: mission.mpj_items[index].id, item_type: mission.mpj_items[index].type, completed_at: completedAt, ...values,
  });
  const judgment = response("A2");
  return parseMissionV6Responses(mission, [
    trace(0, { scale_code: response("A1").pick }),
    trace(1, { scale_code: judgment.pick,
      ...(judgment.reasonId !== undefined ? { reason_id: judgment.reasonId } : {}),
      ...(judgment.revisedPick !== undefined && judgment.revisedPick !== judgment.pick ? { revised_scale_code: judgment.revisedPick } : {}) }),
    trace(2, { correction_indexes: Array.isArray(correctionIds)
      ? correctionIds.map(id => mission.mpj_items[2].corrections.findIndex((_, index) => id === `A3-${index}`)) : undefined }),
    trace(3, { revised_text: response("A4").revisedText }),
    trace(4, { candidate_band_codes: mission.mpj_items[4].candidates.map((_, index) => picks?.[`A5-${index}`]) }),
  ]);
}
