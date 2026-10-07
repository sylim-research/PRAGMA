import { Link, useLocation } from "react-router-dom";
import { parseDemoStep } from "@/lib/demo/demoStepNavigation";
import { REPRESENTATIVE_DEMOS, representativeDemoPath, type DemoTaskMode } from "@/lib/demo/representativeMissionCatalog";

type DemoNavigationProps = { scenarioId?: string; mode: DemoTaskMode };

export function RepresentativeDemoNavigation({ scenarioId, mode }: DemoNavigationProps) {
  const step = parseDemoStep(useLocation().search);
  const current = REPRESENTATIVE_DEMOS.find(item => Object.values(item.missions).some(id => id === scenarioId)) ?? REPRESENTATIVE_DEMOS[0];
  return <nav className="mb-3" aria-label="데모 미션 선택">
    <p className="mb-2 text-[14px] font-bold text-[#243B53]">체험 미션 선택</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {REPRESENTATIVE_DEMOS.flatMap(demo => (["translation", "interpreting"] as const).map(taskMode => {
        const label = taskMode === "translation" ? "번역" : "통역";
        const selected = mode === taskMode && current.direction === demo.direction;
        return <Link key={`${demo.direction}-${taskMode}`} to={representativeDemoPath(demo.direction, taskMode, step)} aria-label={`${demo.label} ${label} 미션`} aria-current={selected ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[14px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3276A8] focus-visible:ring-offset-2 ${selected ? "border-[#3276A8] bg-[#3276A8] text-white" : "border-[#CBD5DF] bg-white text-[#243B53] hover:border-[#3276A8] hover:bg-[#EDF4FA]"}`}>
          <span>{demo.label}</span><span>{label} 미션</span>
          {selected && <span aria-hidden="true" className="text-[13px]">✓</span>}
        </Link>;
      }))}
    </div>
  </nav>;
}
