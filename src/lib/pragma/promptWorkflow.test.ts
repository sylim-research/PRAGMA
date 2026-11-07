import { describe, expect, it } from "vitest";
import { PROMPT_SNAPSHOT } from "./promptSnapshot.generated";
import {
  HIDDEN_PROMPT_KEYS,
  OMITTED_PROMPT_KEYS,
  PROMPT_WORKFLOW,
  SIDE_FEATURE_PROMPTS,
  type WorkflowDirection,
  type WorkflowMode,
} from "./promptWorkflow";

const DIRS: WorkflowDirection[] = ["ko_zh", "zh_ko"];
const MODES: WorkflowMode[] = ["translation", "interpreting"];
const snapshotKeys = new Set(PROMPT_SNAPSHOT.prompts.map((p) => p.key));

function workflowKeys() {
  const keys = new Set<string>(SIDE_FEATURE_PROMPTS);
  for (const stage of PROMPT_WORKFLOW) for (const step of stage.steps)
    for (const dir of DIRS) for (const mode of MODES) for (const key of step.prompts(dir, mode)) keys.add(key);
  return keys;
}

describe("운영 프롬프트 제작 흐름 지도", () => {
  it("흐름이 가리키는 프롬프트는 모두 스냅숏에 있다", () => {
    const missing = [...workflowKeys()].filter((key) => !snapshotKeys.has(key));
    expect(missing).toEqual([]);
  });

  it("화면에 보일 프롬프트는 모두 흐름 어딘가에 놓인다", () => {
    const placed = workflowKeys();
    const visible = PROMPT_SNAPSHOT.prompts
      .map((p) => p.key)
      .filter((key) => !HIDDEN_PROMPT_KEYS.has(key) && !OMITTED_PROMPT_KEYS.has(key));
    expect(visible.filter((key) => !placed.has(key))).toEqual([]);
  });

  it("숨긴 프롬프트는 흐름에 나오지 않는다", () => {
    expect([...workflowKeys()].filter((key) => HIDDEN_PROMPT_KEYS.has(key))).toEqual([]);
  });

  it("방향·방식에 따라 다른 판을 고른다", () => {
    const write = PROMPT_WORKFLOW[1].steps[0];
    expect(write.prompts("zh_ko", "interpreting")[0]).toBe("mission_v6.system.zh_ko.spoken");
    expect(write.prompts("ko_zh", "translation")[0]).toBe("mission_v6.system");
    const gate = PROMPT_WORKFLOW[0].steps.find((s) => s.id === "core_gate")!;
    expect(gate.model!("ko_zh")).toBe("GPT-6 Astra");
    expect(gate.model!("zh_ko")).toBe("Gemini 3.1 Pro");
  });
});
