import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Layers, MessagesSquare } from "lucide-react";
import { RESOURCE_DIMENSIONS, resourceAssemblyHref, type DashboardResources, type ResourceScope } from "@/lib/admin/adminDashboardResources";

const number = (value: number | undefined) => value == null ? "—" : value.toLocaleString("ko-KR");

export function DashboardResourceOverview({ resources, error, status }: {
  resources: DashboardResources | null;
  error: string | null;
  status: React.ReactNode;
}) {
  const [scope, setScope] = useState<ResourceScope>("all");
  const selected = resources?.[scope];
  // 순서 = 제작 흐름: 시나리오 → 미션에 든 MJT·DCT → 편성 가능 미션.
  const cards = [
    { label: "시나리오", value: resources?.scenarioCount, unit: "개", note: "생성된 학습 상황 설정", icon: Layers },
    { label: "MJT 문항", value: resources?.all.judgmentCount, unit: "문항", note: "미션에 포함된 MJT 문항", icon: BookOpen },
    { label: "DCT형 통번역 과제", value: resources?.all.productionCount, unit: "과제", note: "미션에 포함된 통번역 과제", icon: MessagesSquare },
    { label: "편성 가능 학습 미션", value: resources?.ready.missionCount, unit: "개 미션", note: "수업에 편성할 수 있는 학습 미션", icon: CheckCircle2 },
  ];

  return <>
    <section aria-labelledby="resource-overview-title" className="mt-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-[#8B7324]">LEARNING CONTENT</p>
          <h2 id="resource-overview-title" className="text-[26px] font-bold tracking-tight text-[#15202B]">보유 학습 콘텐츠</h2>
        </div>
        {status}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 위 카드 세 개는 요약이라 누르지 않는다. 아래 화행·수준·방향·수행 방식 숫자는 학습 미션 제작 목록으로 연결한다. */}
        {cards.map(({ label, value, unit, note, icon: Icon }) => (
          <div key={label} className={[
            "flex min-h-[108px] flex-col rounded-2xl border px-5 py-3.5",
            "border-[#E6E1D5] bg-white text-[#15202B]",
          ].join(" ")}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{label}</span>
              <Icon aria-hidden className="h-5 w-5 text-[#8B825F]" />
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-[30px] font-bold leading-none tracking-[-0.045em] tabular-nums">{error ? "—" : number(value)}</span>
              <span className="text-sm text-[#647079]">{unit}</span>
            </div>
            <div className="mt-auto flex items-center justify-between gap-1 pt-2 text-xs text-[#647079]">
              <span>{note}</span>
            </div>
          </div>
        ))}
      </div>
      {!!resources?.all.incompleteCount && <p className="mt-1 text-xs text-amber-800">문항·산출 정보 확인이 필요한 미션 {resources.all.incompleteCount}개 · 확인된 구성요소만 집계</p>}
    </section>

    <section aria-labelledby="resource-distribution-title" className="mt-3 rounded-2xl border border-[#E6E1D5] bg-white px-5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id="resource-distribution-title" className="text-base font-bold text-[#253441]">학습 콘텐츠 구성</h2>
        </div>
        <div aria-label="콘텐츠 구성 집계 범위" className="inline-flex rounded-lg bg-[#F4F2EA] p-1">
          {([['all', '전체 보유'], ['ready', '편성 가능']] as const).map(([value, label]) => <button
            key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}
            className={"rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B852E] " + (scope === value ? "bg-[#15202B] text-white" : "text-[#5D6971] hover:text-[#15202B]")}
          >{label}</button>)}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[2.06fr_0.8fr_0.8fr_0.8fr]">
        {RESOURCE_DIMENSIONS.map(({ key, title, labels }) => {
          const counts = selected?.counts[key] ?? {};
          const max = Math.max(1, ...Object.values(counts));
          const unknown = Object.entries(counts).filter(([code]) => !(code in labels)).reduce((sum, [, count]) => sum + count, 0);
          return <div key={key}>
            <h3 className="mb-2 text-xs font-semibold text-[#647079]">{title}</h3>
            <div className={key === 'speech_act' ? "grid grid-cols-3 gap-2" : "space-y-3"}>
              {Object.entries(labels).map(([code, label]) => {
                const count = counts[code] ?? 0;
                return key === 'speech_act' ? <Link key={code} to={resourceAssemblyHref(scope, key, code)} title={`${label} 학습 미션 보기`}
                  className="flex items-baseline justify-between gap-2 rounded-xl bg-[#F8F6EE] px-3.5 py-2 transition-colors hover:bg-[#F2E9BB] focus-visible:ring-2 focus-visible:ring-[#B3932F]">
                  <span className="text-sm text-[#3F4C55]">{label}</span>
                  <span className="text-xl font-semibold tabular-nums text-[#243640]">{selected ? number(count) : "—"}</span>
                </Link> : <Link key={code} to={resourceAssemblyHref(scope, key, code)} className="group block rounded focus-visible:ring-2 focus-visible:ring-[#B3932F]">
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
