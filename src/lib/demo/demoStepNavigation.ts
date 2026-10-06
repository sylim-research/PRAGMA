// Demo numbers follow the manuscript's presentation order; stored quest IDs are unchanged.
export const DEMO_MJT_QUEST_IDS = ["A1", "A2", "A5", "A3", "A4"] as const;
export type DemoStep = "mjt1" | "mjt2" | "mjt3" | "mjt4" | "mjt5" | "dct";
type Quest = { id: string; kind: string };

export function parseDemoStep(search: string): DemoStep | undefined {
  const step = new URLSearchParams(search).get("step");
  return step && /^(mjt[1-5]|dct)$/.test(step) ? step as DemoStep : undefined;
}

export function demoQuestIndex(quests: Quest[], step?: DemoStep) {
  if (!step) return -1;
  if (step === "dct") return quests.findIndex(quest => quest.kind === "dct");
  return quests.findIndex(quest => quest.id === DEMO_MJT_QUEST_IDS[Number(step.slice(3)) - 1]);
}

export function demoStepForQuest(quest: Quest): DemoStep | undefined {
  if (quest.kind === "dct" || quest.kind === "dct_feedback") return "dct";
  const index = DEMO_MJT_QUEST_IDS.findIndex(id => id === quest.id);
  return index < 0 ? undefined : `mjt${index + 1}` as DemoStep;
}
