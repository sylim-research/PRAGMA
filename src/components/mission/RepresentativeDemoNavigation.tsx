import { Link, useLocation } from "react-router-dom";
import { parseDemoStep } from "@/lib/demo/demoStepNavigation";
import { DemoBadge } from "@/components/mission/DemoBadge";
import { REPRESENTATIVE_DEMOS, representativeDemoPath, type DemoTaskMode } from "@/lib/demo/representativeMissionCatalog";

type DemoNavigationProps = { scenarioId?: string; mode: DemoTaskMode };

export function RepresentativeDemoHeader() {
  return <DemoBadge />;
}

export function RepresentativeDemoNavigation({ scenarioId, mode }: DemoNavigationProps) {
  const step = parseDemoStep(useLocation().search);
  const current = REPRESENTATIVE_DEMOS.find(item => Object.values(item.missions).some(id => id === scenarioId)) ?? REPRESENTATIVE_DEMOS[0];
  return <nav className="-mt-4 mb-1 flex flex-wrap items-center justify-end gap-2" aria-label="데모 미션 선택">
    {REPRESENTATIVE_DEMOS.map(demo => {
      return <div key={demo.direction} role="group" aria-label={demo.label}
        className={`inline-flex items-center gap-2 rounded-full border bg-white/70 py-0.5 pl-3 pr-1 ${current.direction === demo.direction ? "border-[#3276A8]" : "border-[#D6CFBD]"}`}>
        <span className="border-r border-[#D6CFBD] pr-2 text-[13px] font-semibold text-[#15202B]">{demo.label}</span>
        <div className="flex gap-0.5">
          {(["translation", "interpreting"] as const).map(taskMode => {
            const label = taskMode === "translation" ? "번역" : "통역";
            const selected = mode === taskMode && current.direction === demo.direction;
            return <Link key={taskMode} to={representativeDemoPath(demo.direction, taskMode, step)} aria-label={`${demo.label} ${label}`} aria-current={selected ? "page" : undefined}
              className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-full px-3 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 ${selected ? "bg-[#3276A8] text-white" : "text-[#5C6A7A] hover:bg-[#F1EFE8] hover:text-[#15202B]"}`}>
              {label}
            </Link>;
          })}
        </div>
      </div>;
    })}
  </nav>;
}
