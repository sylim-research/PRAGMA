// Learner action tracking for research data export.
// All events stored under localStorage["learnerActions"] as a JSON array.

export const ACTIONS_KEY = "learnerActions";
export const SESSION_KEY = "sessionId";
export const SESSION_START_KEY = "sessionStartAt";

export type ActionType =
  | "session_start"
  | "page_visit"
  | "selection"
  | "input"
  | "rating"
  | "rollback"
  | "step_jump"
  | "revision"
  | "persona_feedback_request"
  | "persona_decision"
  | "final_decision"
  | "session_end";

export interface LearnerAction {
  timestamp: string;
  sessionId: string;
  actionType: ActionType;
  pageName: string;
  details: Record<string, unknown>;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ensureSession(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(SESSION_KEY, id);
    localStorage.setItem(SESSION_START_KEY, new Date().toISOString());
    pushAction({
      actionType: "session_start",
      pageName: typeof window !== "undefined" ? window.location.pathname : "/",
      details: {},
    });
  }
  return id;
}

interface PushArgs {
  actionType: ActionType;
  pageName: string;
  details?: Record<string, unknown>;
}

function pushAction({ actionType, pageName, details = {} }: PushArgs) {
  try {
    const sessionId = localStorage.getItem(SESSION_KEY) || "";
    const entry: LearnerAction = {
      timestamp: new Date().toISOString(),
      sessionId,
      actionType,
      pageName,
      details,
    };
    const raw = localStorage.getItem(ACTIONS_KEY);
    const arr: LearnerAction[] = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    localStorage.setItem(ACTIONS_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export function getActions(): LearnerAction[] {
  try {
    const raw = localStorage.getItem(ACTIONS_KEY);
    return raw ? (JSON.parse(raw) as LearnerAction[]) : [];
  } catch {
    return [];
  }
}
