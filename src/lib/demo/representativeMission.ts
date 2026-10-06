// 대표 교과목 2주차 첫 슬롯의 승인본(2026-10-02 연구자 직접 승인, 택배 보관 장면). 공개 데모는 DB·AI 호출 없이 snapshot을 읽는다.
// DCT 피드백은 같은 승인본으로 남긴 2026-10-04 attempt fe5051ac-7819-4d36-88d5-b3b7b629264d의 실제 기록이다.
// 이전 승인본(95209155, 택배 대리 수령 장면)과 그 2026-09-28 기록은 역사 기록으로 보존하며 이 데모에 쓰지 않는다.

import { normalizeLearnerMission } from "@/lib/pragma/missionV6";
import type { CanonicalRunnableMission } from "@/lib/mission/missionDb";
import type { SpeechActUI } from "@/lib/pragma/enums";
import { REPRESENTATIVE_MISSION_SNAPSHOT as snapshot } from "./representativeMissionSnapshot";

import { REVERSE_REPRESENTATIVE_SNAPSHOT } from "./reverseRepresentativeSnapshot";
import { REPRESENTATIVE_MISSION_ID, REVERSE_REPRESENTATIVE_MISSION_ID, type DemoTaskMode } from "./representativeMissionCatalog";
export { REPRESENTATIVE_MISSION_PATH, REPRESENTATIVE_MISSION_ID } from "./representativeMissionCatalog";

export function publicRepresentativeMission(scenarioId = REPRESENTATIVE_MISSION_ID, mode?: DemoTaskMode): CanonicalRunnableMission {
  const selected = scenarioId === REPRESENTATIVE_MISSION_ID ? snapshot
    : scenarioId === REVERSE_REPRESENTATIVE_MISSION_ID ? REVERSE_REPRESENTATIVE_SNAPSHOT : null;
  if (!selected) throw new Error("알 수 없는 대표 미션입니다.");
  const parsed = normalizeLearnerMission(structuredClone(selected.mission_content));
  if (!parsed.ok || !parsed.data) throw new Error("대표 미션 스냅숏 형식이 유효하지 않습니다.");
  // Public presentation override only. Never change the approved snapshot or persist this copy.
  // The feedback note identifies the original recorded modality.
  if (mode) parsed.data.production_task.mode = mode;
  return {
    scenario_id: selected.scenario_id,
    speech_act: selected.speech_act as SpeechActUI,
    learner_level: null,
    mission_status: selected.mission_status,
    release_gate_mode: null,
    direction: parsed.data.direction,
    mission: parsed.data,
  };
}
