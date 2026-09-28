// 4.3 주대표와 랜딩페이지 시연은 한중 화용 2주차 첫 슬롯의 택배 미션이다.
// 로그인한 사용자는 승인·편성된 DB 콘텐츠를 그대로 읽는다.
// 비로그인 방문자는 DB를 읽을 권한이 없으므로, 같은 승인본(v3, mission_content_hash
// bbf072ba…)을 옮겨 둔 스냅숏으로 시연한다. 미션을 새 버전으로 바꾸면 스냅숏도 갱신한다.

import { normalizeLearnerMission } from "@/lib/pragma/missionV6";
import type { CanonicalRunnableMission } from "@/lib/mission/missionDb";
import type { SpeechActUI } from "@/lib/pragma/enums";
import { REPRESENTATIVE_MISSION_SNAPSHOT as snapshot } from "./representativeMissionSnapshot";

export const REPRESENTATIVE_MISSION_PATH = "/demo/mission";
export const REPRESENTATIVE_MISSION_ID = "3da0c62d-e91f-4f68-9b74-28cd9d42f044";

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
