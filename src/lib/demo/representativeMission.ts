// 대표 교과목 2주차 첫 슬롯의 승인본(2026-10-02 연구자 직접 승인, 택배 보관 장면). 공개 데모는 DB·AI 호출 없이 snapshot을 읽는다.
// DCT 피드백은 같은 승인본으로 남긴 2026-10-04 attempt fe5051ac-7819-4d36-88d5-b3b7b629264d의 실제 기록이다.
// 이전 승인본(95209155, 택배 대리 수령 장면)과 그 2026-09-28 기록은 역사 기록으로 보존하며 이 데모에 쓰지 않는다.

import { normalizeLearnerMission } from "@/lib/pragma/missionV6";
import type { CanonicalRunnableMission } from "@/lib/mission/missionDb";
import type { SpeechActUI } from "@/lib/pragma/enums";
import { REPRESENTATIVE_MISSION_SNAPSHOT as snapshot } from "./representativeMissionSnapshot";

export const REPRESENTATIVE_MISSION_PATH = "/demo/mission";
export const REPRESENTATIVE_MISSION_ID = "24fb6841-6868-4e14-8e54-4e946466dc8e";

export function publicRepresentativeMission(): CanonicalRunnableMission {
  const parsed = normalizeLearnerMission(snapshot.mission_content);
  if (!parsed.ok || !parsed.data) throw new Error("대표 미션 스냅숏 형식이 유효하지 않습니다.");
  return {
    scenario_id: snapshot.scenario_id,
    speech_act: snapshot.speech_act as SpeechActUI,
    learner_level: null,
    mission_status: snapshot.mission_status,
    release_gate_mode: null,
    direction: parsed.data.direction,
    mission: parsed.data,
  };
}
