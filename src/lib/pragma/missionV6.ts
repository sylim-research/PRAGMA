import { z } from "zod";
import { ChannelSchema, PdrSchema } from "./coreSchema";
import { MissionV5NativeSchema, normalizeMission, type MissionRuntime } from "./missionSchema";
import { FEATURE_CODES_BY_ACT, getTargetFeature } from "./targetFeatures";

// The adopted localhost flow, now for all nine speech acts. Existing
// generation/review validators keep their v1-v5 contract; this is a separate
// learner format. The item skeleton is act-neutral: only the judgment axis
// differs, and its names come from the target feature catalog, not from here.
const text = z.string().min(1).refine(value => value.trim().length > 0, "Nonblank text required");
export const ScaleCodeV6 = z.enum(["very_appropriate", "somewhat_appropriate", "somewhat_inappropriate", "very_inappropriate"]);
export const SpeechActV6 = z.enum([
  "request", "refusal", "apology", "thanks", "proposal", "agreement", "opposition", "compliment", "complaint",
]);
export type SpeechActV6 = z.infer<typeof SpeechActV6>;
// Bands are per-feature (a request is judged on directness, gratitude on
// calibration), so the field takes any nonblank code and the mission-level
// refinement checks it against this mission's feature.
const bandCode = text;
/** @deprecated Request-shaped bands. Use allowedBandCodes(featureCode). */
export const SpectrumCodeV6 = z.enum(["too_direct", "appropriate", "too_indirect"]);

// The approved request missions store "appropriate" where the catalog band
// schema says "within_band". Frozen for request alone so those rows keep
// parsing (2026-09-17 decision 6); the other eight acts use catalog codes as is.
const REQUEST_FEATURE = "request_mitigation_optionality";
const FROZEN_REQUEST_WITHIN_BAND = "appropriate";

/** Band codes this feature's content may carry, widest form. */
export function allowedBandCodes(featureCode: string): string[] {
  const feature = getTargetFeature(featureCode);
  if (!feature) return [];
  const codes = feature.band_schema.map(band => band.code);
  return featureCode === REQUEST_FEATURE ? [...codes, FROZEN_REQUEST_WITHIN_BAND] : codes;
}
/** The middle band exactly as content stores it for this feature. */
export function withinBandCodeFor(featureCode: string): string {
  if (featureCode === REQUEST_FEATURE) return FROZEN_REQUEST_WITHIN_BAND;
  return getTargetFeature(featureCode)?.within_band_code ?? "within_band";
}

const scene = {
  situation_ko: text, relation_ko: text, channel: ChannelSchema, pdr: PdrSchema,
  // Empty means the source already supplies the necessary context.
  learner_context_ko: z.string(),
  // Native MPJ5 summarizes any prior move inside situation_ko and leaves this
  // null; the key stays readable for content that does carry it.
  preceding_turn: z.string().min(1).nullable().optional(),
};
const common = { ...scene, short_label: text, title: text, prompt: text, source: text };
const scale = z.object({
  ...common, type: z.literal("scale4"), target: text,
  accepted_scale_codes: z.array(ScaleCodeV6).min(1).max(4), reference_scale_code: ScaleCodeV6,
  explanation_ko: text, revision_examples: z.array(text).min(1).max(2).optional(),
}).strict();
// Optional for pre-addition v6 content. New authoring uses one MJT2 reason choice.
// IDs identify contextual choices, not a fixed error taxonomy. accepted_id names the reference
// reason so the learner sees whether their reason matched; content written before it has none.
const scaleWithReason = scale.extend({
  id: z.literal(2),
  reason_choice: z.object({
    prompt: text,
    options: z.array(z.object({ id: text, text }).strict()).min(2),
    accepted_id: text.optional(),
  }).strict().optional(),
});
const correction = z.object({
  ...common, id: z.literal(3), type: z.literal("fix_choice"), target: text,
  corrections: z.array(z.object({ text, is_valid: z.boolean(), note_ko: text }).strict()).length(3),
  explanation_ko: text,
}).strict();
const free = z.object({
  ...common, id: z.literal(4), type: z.literal("free_correction"), target: text,
  reference_alternatives: z.array(text).min(1).max(2), explanation_ko: text,
  contrast: z.object({ context_ko: text, target: text, explanation_ko: text }).strict().optional(),
}).strict();
const spectrum = z.object({
  ...common, id: z.literal(5), type: z.literal("multi_judge"),
  candidates: z.array(z.object({
    text, accepted_band_codes: z.array(bandCode).min(1).max(3), note_ko: text,
  }).strict()).length(4),
}).strict();
const items = z.tuple([scale.extend({ id: z.literal(1) }), scaleWithReason, correction, free, spectrum]);
const rawSchema = z.object({
  schema_version: z.literal("mission_v6"),
  direction: z.enum(["ko_zh", "zh_ko"]),
  learning_goal: z.object({ kind: z.literal("speech_act"), speech_act: SpeechActV6 }).strict(),
  unit: MissionV5NativeSchema.shape.unit,
  mpj_items: items,
  lesson_points: z.array(z.object({ item_id: z.number().int().min(1).max(5), label: text, text }).strict()).length(5),
  production_task: MissionV5NativeSchema.shape.production_task.extend({ learner_context_ko: z.string() }).strict(),
  provenance: MissionV5NativeSchema.shape.provenance,
  // Same authoring/review/attribution records as other formats, not item pedagogy.
  // Optional keeps pre-integration v6 readable; normal approval still requires them.
  authoring: MissionV5NativeSchema.shape.authoring,
  quality_check: MissionV5NativeSchema.shape.quality_check,
  hsk_lexical_audit: MissionV5NativeSchema.shape.hsk_lexical_audit,
  item_lineage: MissionV5NativeSchema.shape.item_lineage,
}).strict();

// v6 items are self-contained scenarios like native MPJ5, so a prior move
// belongs inside situation_ko and this field stays empty (R8). The response acts
// carry their obligation on the core, not here. The key stays readable so
// content that wrongly carries a turn fails with this reason rather than as an
// unrecognized key.
function carriesPrecedingTurn(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export const MissionV6Schema = rawSchema.superRefine((raw, ctx) => {
  const mission = raw as MissionV6;
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  const act = mission.learning_goal.speech_act;
  const featureCode = mission.unit.target_feature;
  if (!(FEATURE_CODES_BY_ACT[act] ?? []).includes(featureCode)) {
    issue(["unit", "target_feature"], `Target feature must be one the catalog gives ${act}`);
  }
  const bands = allowedBandCodes(featureCode);
  const reasons = mission.mpj_items[1].reason_choice?.options;
  if (reasons && new Set(reasons.map(reason => reason.id)).size !== reasons.length) {
    issue(["mpj_items", 1, "reason_choice", "options"], "Reason choice IDs must be distinct");
  }
  const acceptedReason = mission.mpj_items[1].reason_choice?.accepted_id;
  if (reasons && acceptedReason !== undefined && !reasons.some(reason => reason.id === acceptedReason)) {
    issue(["mpj_items", 1, "reason_choice", "accepted_id"], "Accepted reason must be one of the options");
  }
  for (const [i, item] of mission.mpj_items.entries()) {
    if (item.type === "scale4" && (!item.accepted_scale_codes.includes(item.reference_scale_code)
      || new Set(item.accepted_scale_codes).size !== item.accepted_scale_codes.length)) {
      issue(["mpj_items", i, "accepted_scale_codes"], "Reference must be included in distinct accepted codes");
    }
    if (item.type === "fix_choice" && !item.corrections.some(c => c.is_valid)) issue(["mpj_items", i, "corrections"], "At least one usable correction is required");
    if (item.type === "multi_judge") item.candidates.forEach((candidate, index) => {
      if (new Set(candidate.accepted_band_codes).size !== candidate.accepted_band_codes.length) issue(["mpj_items", i, "candidates", index], "Duplicate reference bands");
      const unknown = candidate.accepted_band_codes.filter(code => !bands.includes(code));
      if (bands.length && unknown.length) {
        issue(["mpj_items", i, "candidates", index, "accepted_band_codes"], `Bands must come from ${featureCode}: ${unknown.join(", ")}`);
      }
    });
  }
  if (mission.lesson_points.some((point, index) => point.item_id !== index + 1)) issue(["lesson_points"], "Lesson points must follow item order");
  const task = mission.production_task;
  if ((task.mode === "translation") !== (task.source_modality === "written")) issue(["production_task", "source_modality"], "Task mode and modality must agree");
  if (task.mode === "interpreting" && !task.replay_limit) issue(["production_task", "replay_limit"], "Interpreting requires replay limit");
  if (carriesPrecedingTurn(task.preceding_turn)) {
    issue(["production_task", "preceding_turn"], "v6 scenarios are self-contained; summarize any prior move in situation_ko");
  }
  mission.mpj_items.forEach((item, index) => {
    if (carriesPrecedingTurn(item.preceding_turn)) {
      issue(["mpj_items", index, "preceding_turn"], "v6 scenarios are self-contained; summarize any prior move in situation_ko");
    }
  });
  if (task.focal_segments.filter(segment => segment.role === "head").length !== 1
    || task.focal_segments.some(segment => !task.source_text.includes(segment.text))) {
    issue(["production_task", "focal_segments"], "One head and source-grounded focal segments are required");
  }
});
// Explicit tuple avoids zod 3/strict:false widening deeply nested unions.
export type MissionV6 = Omit<z.infer<typeof rawSchema>, "mpj_items"> & { mpj_items: [
  z.infer<typeof scale> & { id: 1 }, z.infer<typeof scaleWithReason>,
  z.infer<typeof correction>, z.infer<typeof free>, z.infer<typeof spectrum>,
] };
export type LearnerMissionRuntime = MissionRuntime | MissionV6;

export function normalizeLearnerMission(input: unknown): { ok: boolean; data?: LearnerMissionRuntime; error?: z.ZodError } {
  if ((input as { schema_version?: string } | null)?.schema_version !== "mission_v6") return normalizeMission(input);
  const result = MissionV6Schema.safeParse(input);
  return result.success ? { ok: true, data: result.data as MissionV6 } : { ok: false, error: result.error };
}
