// 디펜스용 대표 미션의 단일 진입 계약.
// 실제 실행기는 CanonicalMissionRun을 그대로 쓰고, UUID만 이 파일에서 고정한다.

const DEFAULT_REPRESENTATIVE_MISSION_ID = "f8de3f59-cd86-4636-b516-a8ead78ac0ac";

export const REPRESENTATIVE_MISSION_PATH = "/demo/mission";

export const REPRESENTATIVE_MISSION_SCENARIO_ID =
  import.meta.env.VITE_DEMO_MISSION_ID?.trim() || DEFAULT_REPRESENTATIVE_MISSION_ID;
