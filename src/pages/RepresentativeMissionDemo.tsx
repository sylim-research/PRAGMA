import { useLocation } from "react-router-dom";
import CanonicalMissionRun from "@/pages/learner/CanonicalMissionRun";
import { parseRepresentativeDemo } from "@/lib/demo/representativeMissionCatalog";

export default function RepresentativeMissionDemo() {
  const location = useLocation();
  const demo = parseRepresentativeDemo(location.search);
  return <CanonicalMissionRun key={`${demo.scenarioId}:${demo.mode}`} demoMode scenarioId={demo.scenarioId} demoTaskMode={demo.mode} />;
}
