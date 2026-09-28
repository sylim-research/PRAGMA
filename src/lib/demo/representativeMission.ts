// 4.3 주대표와 랜딩페이지 시연은 한중 화용 2주차 첫 슬롯의 택배 미션이다(2026-09-27 재승인본).
// 시연은 로그인 없이 여는 모델 하우스다. DB·AI를 쓰지 않고, 최신 승인본(scenario 051532cc, mission_content_hash
// 3b213fbc…)을 옮겨 둔 스냅숏으로 실행한다. 실제 수업은 종전대로 DB 콘텐츠를 읽는다.
// 미션을 새 버전으로 바꾸면 스냅숏과 시연용 예시 답안·피드백도 함께 갱신한다.

import { normalizeLearnerMission } from "@/lib/pragma/missionV6";
import type { CanonicalRunnableMission } from "@/lib/mission/missionDb";
import type { SpeechActUI } from "@/lib/pragma/enums";
import { REPRESENTATIVE_MISSION_SNAPSHOT as snapshot } from "./representativeMissionSnapshot";

export const REPRESENTATIVE_MISSION_PATH = "/demo/mission";
export const REPRESENTATIVE_MISSION_ID = "051532cc-c3a2-4440-9a5e-efc54e9ac481";

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
