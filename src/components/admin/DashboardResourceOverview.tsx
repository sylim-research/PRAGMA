import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, CheckCircle2, MessagesSquare } from "lucide-react";
import { RESOURCE_DIMENSIONS, resourceLibraryHref, type DashboardResources, type ResourceScope } from "@/lib/admin/adminDashboardResources";

const number = (value: number | undefined) => value == null ? "—" : value.toLocaleString("ko-KR");

export function DashboardResourceOverview({ resources, error, status }: {
  resources: DashboardResources | null;
  error: string | null;
  status: React.ReactNode;
}) {
  const [scope, setScope] = useState<ResourceScope>("all");
  const selected = resources?.[scope];
  const cards = [
    { label: "MJT 문항", value: resources?.all.judgmentCount, unit: "문항", note: "미션에 포함된 판단 문항", icon: BookOpen, to: resourceLibraryHref("all") },
    { label: "DCT형 통번역 과제", value: resources?.all.productionCount, unit: "과제", note: "미션에 포함된 DCT형 과제", icon: MessagesSquare, to: resourceLibraryHref("all") },
    { label: "편성 가능 학습 미션", value: resources?.ready.missionCount, unit: "개 미션", note: "수업에 편성할 수 있는 자료", icon: CheckCircle2, to: resourceLibraryHref("ready"), ready: true },
  ];

  return <>
    <section aria-labelledby="resource-overview-title" className="mt-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-[#8B7324]">RESOURCE LIBRARY</p>
          <h2 id="resource-overview-title" className="text-[26px] font-bold tracking-tight text-[#15202B]">보유 학습 자료</h2>
        </div>
        {status}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {cards.map(({ label, value, unit, note, icon: Icon, to, ready }) => (
          <Link key={label} to={to} className={[
            "group flex min-h-[108px] flex-col rounded-2xl border px-5 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B3932F]",
            ready ? "border-[#15202B] bg-[#15202B] text-white hover:bg-[#233440]" : "border-[#E6E1D5] bg-white text-[#15202B] hover:border-[#C5B05F]",
          ].join(" ")}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{label}</span>
              <Icon aria-hidden className={ready ? "h-5 w-5 text-[#EFD65B]" : "h-5 w-5 text-[#8B825F]"} />
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-[30px] font-bold leading-none tracking-[-0.045em] tabular-nums">{error ? "—" : number(value)}</span>
              <span className={ready ? "text-sm text-[#C5CFD4]" : "text-sm text-[#647079]"}>{unit}</span>
            </div>
            <div className={"mt-auto flex items-center justify-between gap-1 pt-2 text-xs " + (ready ? "text-[#C5CFD4]" : "text-[#647079]")}>
              <span>{note}</span><ArrowUpRight aria-hidden className="h-4 w-4 shrink-0" />
            </div>
          </Link>
        ))}
      </div>
      {!!resources?.all.incompleteCount && <p className="mt-1 text-xs text-amber-800">문항·산출 정보 확인이 필요한 미션 {resources.all.incompleteCount}개 · 확인된 구성요소만 집계</p>}
    </section>

    <section aria-labelledby="resource-distribution-title" className="mt-3 rounded-2xl border border-[#E6E1D5] bg-white px-5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="resource-distribution-title" className="text-base font-bold text-[#253441]">학습 자료 구성</h2>
        </div>
        <div aria-label="자료 구성 집계 범위" className="inline-flex rounded-lg bg-[#F4F2EA] p-1">
          {([['all', '전체 보유'], ['ready', '편성 가능']] as const).map(([value, label]) => <button
            key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}
            className={"rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B852E] " + (scope === value ? "bg-[#15202B] text-white" : "text-[#5D6971] hover:text-[#15202B]")}
          >{label}</button>)}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[1.95fr_0.8fr_0.8fr_0.8fr]">
        {RESOURCE_DIMENSIONS.map(({ key, title, labels }) => {
          const counts = selected?.counts[key] ?? {};
          const max = Math.max(1, ...Object.values(counts));
          const unknown = Object.entries(counts).filter(([code]) => !(code in labels)).reduce((sum, [, count]) => sum + count, 0);
          return <div key={key}>
            <h3 className="mb-2 text-xs font-semibold text-[#647079]">{title}</h3>
            <div className={key === 'speech_act' ? "grid grid-cols-3 gap-2" : "space-y-3"}>
              {Object.entries(labels).map(([code, label]) => {
                const count = counts[code] ?? 0;
                return key === 'speech_act' ? <Link key={code} to={resourceLibraryHref(scope, key, code)}
                  className="flex items-baseline justify-between gap-2 rounded-xl bg-[#F8F6EE] px-3.5 py-2 transition-colors hover:bg-[#F2E9BB] focus-visible:ring-2 focus-visible:ring-[#B3932F]">
                  <span className="text-sm text-[#3F4C55]">{label}</span>
                  <span className="text-xl font-semibold tabular-nums text-[#243640]">{selected ? number(count) : "—"}</span>
                </Link> : <Link key={code} to={resourceLibraryHref(scope, key, code)} className="group block rounded focus-visible:ring-2 focus-visible:ring-[#B3932F]">
                  <div className="flex items-center justify-between gap-2 text-sm"><span className="text-[#3A4750] group-hover:text-[#15202B]">{label}</span><span className="font-semibold tabular-nums text-[#243640]">{selected ? number(count) : "—"}</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1F0E9]"><div className="h-full rounded-full bg-[#D9C45C]" style={{ width: `${count / max * 100}%` }} /></div>
                </Link>;
              })}
            </div>
            {unknown > 0 && <p className="mt-2 text-xs text-amber-800">미분류 {unknown}개</p>}
          </div>;
        })}
      </div>
    </section>
  </>;
}
