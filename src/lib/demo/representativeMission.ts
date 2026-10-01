// 대표 교과목 2주차 첫 슬롯의 2026-10-01 재승인본. 공개 데모는 DB·AI 호출 없이 snapshot을 읽는다.
// DCT·A/B 산출은 불변이므로 2026-09-28 attempt 41fb9065-a621-41b0-8d14-7c030b5b04d1의 피드백을 재사용한다.
// 그 기록의 원 scenario는 051532cc-c3a2-4440-9a5e-efc54e9ac481, 원 hash는 3b213fbc547ad2e53834f5557ce53ebe7359a39de3e1781d297e2b37abd3e764이다.
// 새 콘텐츠에서 피드백을 재생성·재검증한 기록이 아니다. 원문 기록 파일은 변경하지 않는다.

import { normalizeLearnerMission } from "@/lib/pragma/missionV6";
import type { CanonicalRunnableMission } from "@/lib/mission/missionDb";
import type { SpeechActUI } from "@/lib/pragma/enums";
import { REPRESENTATIVE_MISSION_SNAPSHOT as snapshot } from "./representativeMissionSnapshot";

export const REPRESENTATIVE_MISSION_PATH = "/demo/mission";
export const REPRESENTATIVE_MISSION_ID = "95209155-0067-44f3-a01d-81378939584f";

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
