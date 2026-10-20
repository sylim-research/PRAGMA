// 개발 모드 전용: 로그인 없이 대표 미션 두 개로 주차 미션 자료 화면을 확인한다(운영 빌드에는 들어가지 않는다).
import { MissionHandoutPage } from "@/components/admin/MissionHandoutPage";
import { publicRepresentativeMission } from "@/lib/demo/representativeMission";
import { KO_ZH_INTERPRETING_MISSION_ID, REPRESENTATIVE_MISSION_ID } from "@/lib/demo/representativeMissionCatalog";
import { adaptRunnableMissionToCanonical } from "@/lib/mission/canonicalMissionRuntime";

const missions = [
  { ...adaptRunnableMissionToCanonical(publicRepresentativeMission(REPRESENTATIVE_MISSION_ID)), scenarioId: REPRESENTATIVE_MISSION_ID },
  { ...adaptRunnableMissionToCanonical(publicRepresentativeMission(KO_ZH_INTERPRETING_MISSION_ID)), scenarioId: KO_ZH_INTERPRETING_MISSION_ID },
];

const MissionHandoutDemo = () => <MissionHandoutPage missions={missions} heading="2주차 요청 화행" />;

export default MissionHandoutDemo;
