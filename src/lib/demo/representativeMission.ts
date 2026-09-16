// 디펜스용 대표 미션의 단일 진입 계약.
// 실제 실행기는 CanonicalMissionRun을 그대로 쓰고, UUID만 이 파일에서 고정한다.

// 대표 미션은 mission_v6 후보다(2026-09-16). 학습자 계정에서 열리려면 이 미션이
// 교수자 승인 뒤 공개 교과목 주차에 편성돼 있어야 한다(관리자는 승인 전에도 열람 가능).
const DEFAULT_REPRESENTATIVE_MISSION_ID = "630e6459-cec4-4b56-8dca-d87085beebef";

export const REPRESENTATIVE_MISSION_PATH = "/demo/mission";

export const REPRESENTATIVE_MISSION_SCENARIO_ID =
  import.meta.env.VITE_DEMO_MISSION_ID?.trim() || DEFAULT_REPRESENTATIVE_MISSION_ID;
