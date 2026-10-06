export type DemoDirection = "ko_zh" | "zh_ko";
export type DemoTaskMode = "translation" | "interpreting";

export const REPRESENTATIVE_MISSION_PATH = "/demo/mission";
export const REPRESENTATIVE_MISSION_ID = "24fb6841-6868-4e14-8e54-4e946466dc8e";
export const REVERSE_REPRESENTATIVE_MISSION_ID = "a44d3c46-4ec2-428e-a056-3ff65bea0d57";
export const REPRESENTATIVE_DEMOS = [
  { direction: "ko_zh", label: "한 → 중", title: "이웃에게 택배 보관 부탁하기", scenarioId: REPRESENTATIVE_MISSION_ID, originalMode: "translation" },
  { direction: "zh_ko", label: "중 → 한", title: "회의 일정 변경 요청하기", scenarioId: REVERSE_REPRESENTATIVE_MISSION_ID, originalMode: "interpreting" },
] as const;

export function representativeDemoPath(direction: DemoDirection, mode: DemoTaskMode) {
  return `${REPRESENTATIVE_MISSION_PATH}?direction=${direction}&mode=${mode}`;
}

export function parseRepresentativeDemo(search: string) {
  const params = new URLSearchParams(search);
  const demo = REPRESENTATIVE_DEMOS[params.get("direction") === "zh_ko" ? 1 : 0];
  const requestedMode = params.get("mode");
  const mode = requestedMode === "translation" || requestedMode === "interpreting" ? requestedMode : demo.originalMode;
  return { ...demo, mode };
}
