import { Link, useLocation } from "react-router-dom";
import { parseDemoStep } from "@/lib/demo/demoStepNavigation";
import { REPRESENTATIVE_DEMOS, representativeDemoPath, type DemoTaskMode } from "@/lib/demo/representativeMissionCatalog";

type DemoNavigationProps = { scenarioId?: string; mode: DemoTaskMode };

/**
 * 데모 미션 전환 — 어두운 헤더 안에 언어 방향별 알약 두 개로 둔다(「어느 미션인가」는 전역 설정이라 상단 바에 속한다).
 * 선택된 항목만 흰 바탕으로 뒤집는다 — 브랜드 색(네이비·옐로우·크림) 밖의 파랑은 쓰지 않는다.
 */
export function RepresentativeDemoNavigation({ scenarioId, mode }: DemoNavigationProps) {
  const step = parseDemoStep(useLocation().search);
  const current = REPRESENTATIVE_DEMOS.find(item => Object.values(item.missions).some(id => id === scenarioId)) ?? REPRESENTATIVE_DEMOS[0];
  return <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="데모 미션 선택">
    {REPRESENTATIVE_DEMOS.map(demo => {
      return <div key={demo.direction} role="group" aria-label={demo.label}
        className={`inline-flex items-center gap-2 rounded-full border py-0.5 pl-3 pr-1 ${current.direction === demo.direction ? "border-white/70" : "border-white/25"}`}>
        <span className="border-r border-white/25 pr-2 text-[13px] font-semibold text-white">{demo.label}</span>
        <div className="flex gap-0.5">
          {(["translation", "interpreting"] as const).map(taskMode => {
            const label = taskMode === "translation" ? "번역" : "통역";
            const selected = mode === taskMode && current.direction === demo.direction;
            return <Link key={taskMode} to={representativeDemoPath(demo.direction, taskMode, step)} aria-label={`${demo.label} ${label} 미션`} aria-current={selected ? "page" : undefined}
              className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#15202B] ${selected ? "bg-white text-[#15202B]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
              {label}
            </Link>;
          })}
        </div>
      </div>;
    })}
  </nav>;
}
