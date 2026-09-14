import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const MISSION_EVENT_TYPES = [
  "mission_session_opened",
  "mission_resumed",
  "mpj_response_submitted",
  "context_judgment_submitted",
  "first_response_submitted",
  "feedback_received",
  "learner_dissent_submitted",
  "revision_submitted",
  "mission_completed",
] as const;

export type MissionEventType = (typeof MISSION_EVENT_TYPES)[number];

export interface AppendMissionEventInput {
  attemptId: string;
  scenarioId: string | null;
  missionId: string;
  eventType: MissionEventType;
  contentVersion: string | null;
  contentHash: string | null;
  policyVersion: string;
  consentVersion: string;
  featureId: string;
  speechAct: string | null;
  direction: "ko_zh" | "zh_ko";
  taskMode: "translation" | "interpreting";
  payload?: Record<string, unknown>;
  occurredAt?: string;
  courseContext?: {
    courseId: string;
    weekNo: number;
    assignmentId: string;
  };
}

export type AppendMissionEventResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_auth" | "error"; message?: string };

const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (
    f: string,
    a: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>)(fn, args);

export async function appendMissionEvent(
  input: AppendMissionEventInput,
): Promise<AppendMissionEventResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user?.id) return { ok: false, reason: "no_auth" };

  const { data, error } = await rpc("append_learner_mission_event", {
    p_payload: {
      attempt_id: input.attemptId,
      scenario_id: input.scenarioId,
      mission_id: input.missionId,
      event_type: input.eventType,
      content_version: input.contentVersion,
      content_hash: input.contentHash,
      policy_version: input.policyVersion,
      consent_version: input.consentVersion,
      feature_id: input.featureId,
      speech_act: input.speechAct,
      direction: input.direction,
      task_mode: input.taskMode,
      event_payload: (input.payload ?? {}) as Json,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      course_id: input.courseContext?.courseId ?? null,
      week_no: input.courseContext?.weekNo ?? null,
      assignment_id: input.courseContext?.assignmentId ?? null,
    },
  });
  if (error || !data) {
    return { ok: false, reason: "error", message: error?.message ?? "이벤트 저장 실패" };
  }
  return { ok: true, id: data as string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newAttemptId(): string {
  return crypto.randomUUID();
}

export function getOrCreateMissionAttemptId(storageKey: string): string {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && UUID_RE.test(stored)) return stored;
    const created = newAttemptId();
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return newAttemptId();
  }
}

export function rotateMissionAttemptId(storageKey: string): string {
  const created = newAttemptId();
  try {
    localStorage.setItem(storageKey, created);
  } catch {
    /* storage unavailable; in-memory id is still valid */
  }
  return created;
}
