// Entry-gate selection (task_mode / language_direction) — written by the
// learner-facing G1/G2 screens, read by the decision_traces snapshot writer.
//
// Stored in localStorage under dedicated keys so this never collides with the
// existing 5-step workflow drafts or the (session_id, scenario_key) guard.

export const TASK_MODE_KEY = "entryGate.taskMode";
export const LANGUAGE_DIRECTION_KEY = "entryGate.languageDirection";
export const SCENARIO_ID_KEY = "entryGate.scenarioId";

export type TaskMode = "translation" | "interpreting";
export type LanguageDirection = "ko_to_zh" | "zh_to_ko";

export function setTaskMode(mode: TaskMode) {
  try {
    localStorage.setItem(TASK_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function setLanguageDirection(dir: LanguageDirection) {
  try {
    localStorage.setItem(LANGUAGE_DIRECTION_KEY, dir);
  } catch {
    /* ignore */
  }
}

export function getTaskMode(): TaskMode | null {
  try {
    const v = localStorage.getItem(TASK_MODE_KEY);
    return v === "translation" || v === "interpreting" ? v : null;
  } catch {
    return null;
  }
}
