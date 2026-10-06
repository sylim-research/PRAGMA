import type { DemoStep } from "./demoStepNavigation";

export type DemoDirection = "ko_zh" | "zh_ko";
export type DemoTaskMode = "translation" | "interpreting";

export const REPRESENTATIVE_MISSION_PATH = "/demo/mission";
export const REPRESENTATIVE_MISSION_ID = "24fb6841-6868-4e14-8e54-4e946466dc8e";
export const REVERSE_REPRESENTATIVE_MISSION_ID = "a44d3c46-4ec2-428e-a056-3ff65bea0d57";
export const KO_ZH_INTERPRETING_MISSION_ID = "6867d6b6-ef09-4cca-a69b-bfa281303ec3";
export const ZH_KO_TRANSLATION_MISSION_ID = "2c7959ad-aac4-4d7a-a17a-e679d7a0b1d1";
// Each direction × mode opens its own approved mission.
export const REPRESENTATIVE_DEMOS = [
  { direction: "ko_zh", label: "한 → 중", originalMode: "translation",
    missions: { translation: REPRESENTATIVE_MISSION_ID, interpreting: KO_ZH_INTERPRETING_MISSION_ID } },
  { direction: "zh_ko", label: "중 → 한", originalMode: "interpreting",
    missions: { translation: ZH_KO_TRANSLATION_MISSION_ID, interpreting: REVERSE_REPRESENTATIVE_MISSION_ID } },
] as const;

export function representativeDemoPath(direction: DemoDirection, mode: DemoTaskMode, step?: DemoStep) {
  return `${REPRESENTATIVE_MISSION_PATH}?direction=${direction}&mode=${mode}${step ? `&step=${step}` : ""}`;
}

export function parseRepresentativeDemo(search: string) {
  const params = new URLSearchParams(search);
  const demo = REPRESENTATIVE_DEMOS[params.get("direction") === "zh_ko" ? 1 : 0];
  const requestedMode = params.get("mode");
  const mode = requestedMode === "translation" || requestedMode === "interpreting" ? requestedMode : demo.originalMode;
  return { ...demo, mode, scenarioId: demo.missions[mode] };
}
