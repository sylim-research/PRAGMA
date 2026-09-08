import { BarChart3, ListChecks, MessageSquareText, UsersRound } from "lucide-react";

import type { MissionPattern } from "@/lib/mission/classResponsePatterns";

type Props = {
  pattern: MissionPattern;
  selectedItemId: number | null;
  onSelectItem: (itemId: number) => void;
  projector?: boolean;
};

/** 기존 익명 집계만 시각화한다. 선택 비율의 분모는 각 응답 축의 선택 건수다. */
export function ClassResponseDashboard({ pattern, selectedItemId, onSelectItem, projector = false }: Props) {
  const selected = pattern.items.find((item) => item.itemId === selectedItemId) ?? pattern.items[0];

  return <div className={projector ? "space-y-3" : "space-y-6"} aria-label="학급 응답 대시보드">
    {projector ? <p className="text-sm font-medium text-[#626B73]">집계 학습자 {pattern.learners}명 · 응답 있는 문항 {pattern.items.length}개 · 이견 제기 {pattern.dissents}건</p> : <dl className="grid grid-cols-3 gap-2 sm:gap-4">
      {[
        { label: "집계 학습자", value: pattern.learners, unit: "명", icon: UsersRound, dark: true },
        { label: "응답 있는 문항", value: pattern.items.length, unit: "개", icon: ListChecks, dark: false },
        { label: "이견 제기", value: pattern.dissents, unit: "건", icon: MessageSquareText, dark: false },
      ].map(({ label, value, unit, icon: Icon, dark }) => <div key={label} className={[
        "rounded-2xl border p-3 sm:p-5",
        dark ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#E5E3DB] bg-white text-[#15202B]",
      ].join(" ")}>
        <dt className={`flex items-center justify-between gap-1 text-xs font-semibold sm:text-sm ${dark ? "text-white/75" : "text-[#626B73]"}`}>
          {label}<Icon className="hidden h-5 w-5 sm:block" aria-hidden="true" />
        </dt>
        <dd className="mt-3 flex items-baseline gap-1.5 sm:gap-2">
          <span className={`text-3xl font-black tabular-nums tracking-tight sm:text-5xl ${dark ? "text-[#F3D248]" : ""}`}>{value}</span>
          <span className={`text-sm ${dark ? "text-white/75" : "text-[#626B73]"}`}>{unit}</span>
        </dd>
      </div>)}
    </dl>}

    {!selected ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
      {pattern.learners > 0 ? "집계된 기록에 문항별 선택 응답이 없습니다." : "아직 이 주차 미션의 수행 기록이 없습니다."} 주차 수업자료로 수업을 진행할 수 있습니다.
    </p> : <>
      <div>
        {!projector && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-[#15202B]"><BarChart3 className="h-4 w-4" aria-hidden="true" />문항별 응답 살펴보기</p>
          <p className="text-xs text-[#626B73]">문항을 선택하면 그래프가 바뀝니다.</p>
        </div>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="판단 문항 선택">
          {pattern.items.map((item) => <button
            key={item.itemId}
            type="button"
            aria-label={item.title}
            aria-pressed={item.itemId === selected.itemId}
            onClick={() => onSelectItem(item.itemId)}
            className={[
              "min-w-0 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2",
              item.itemId === selected.itemId
                ? "border-[#D4B137] bg-[#F8DC64] text-[#15202B] shadow-sm"
                : "border-[#E5E3DB] bg-white text-[#626B73] hover:border-[#C1B681] hover:bg-[#FFFCF1]",
            ].join(" ")}
          >
            <span className="block text-[11px] font-bold tracking-wider">판단 {String(item.itemId).padStart(2, "0")}</span>
            <span className="mt-1 block break-keep text-sm font-bold leading-5">{item.title.replace(/^판단 \d+\s*·\s*/, "")}</span>
          </button>)}
        </div>
      </div>

      <section aria-label={selected.title} className="overflow-hidden rounded-2xl border border-[#E0E3E5] bg-white shadow-sm">
        <div className={`border-b border-[#E9EBEC] bg-[#F6F8F8] px-4 sm:px-6 ${projector ? "py-3" : "py-5"}`}>
          <p className="text-xs font-bold tracking-wider text-[#65737D]">판단 {String(selected.itemId).padStart(2, "0")} · 선택 분포</p>
          <h3 className={`mt-1 font-black text-[#15202B] ${projector ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}>{selected.title.replace(/^판단 \d+\s*·\s*/, "")}</h3>
          {selected.targetPreview && <p className={`mt-3 break-keep border-l-4 border-[#E4C44E] pl-3 leading-relaxed text-[#334653] [overflow-wrap:anywhere] ${projector ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"}`}><span className="mr-3 inline-block text-xs font-semibold text-[#65737D]">판단한 표현</span>{selected.targetPreview}</p>}
        </div>

        <div className={`grid gap-8 p-4 sm:p-6 ${selected.groups.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {selected.groups.map((group, groupIndex) => <figure key={group.heading} className="min-w-0">
            <figcaption className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h4 className={`font-bold text-[#15202B] ${projector ? "text-xl" : "text-lg"}`}>{group.heading}</h4>
              <span className="text-xs font-medium text-[#65737D]">선택 {group.total}건 기준</span>
            </figcaption>
            <ol className="space-y-5">
              {group.choices.map((choice) => {
                const fraction = group.total > 0 ? choice.count / group.total : 0;
                const share = Math.round(fraction * 100);
                return <li key={choice.key} className="min-w-0">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <span className={`min-w-0 break-keep font-medium leading-relaxed text-[#334653] [overflow-wrap:anywhere] ${projector ? "text-lg" : "text-sm sm:text-base"}`}>{choice.label}</span>
                    <span className="flex shrink-0 items-baseline gap-2 text-[#15202B]">
                      <span className={`font-black tabular-nums ${projector ? "text-2xl" : "text-xl"}`}>{share}<span className="ml-0.5 text-xs font-semibold">%</span></span>
                      <span className="text-xs text-[#65737D]">{choice.count}건</span>
                    </span>
                  </div>
                  <div className={`relative overflow-hidden rounded-md bg-[#EDF0F1] ${projector ? "h-8" : "h-6"}`} aria-hidden="true">
                    <div
                      className={`h-full rounded-r-md ${groupIndex % 2 === 0 ? "bg-[#344F63]" : "bg-[#40827D]"}`}
                      style={{ width: `${Math.min(1, Math.max(0, fraction)) * 100}%` }}
                    />
                    <div className="pointer-events-none absolute inset-0 grid grid-cols-4">
                      {[0, 1, 2, 3].map((tick) => <span key={tick} className="border-r border-white/50 last:border-r-0" />)}
                    </div>
                  </div>
                </li>;
              })}
            </ol>
            <div className="mt-2 flex justify-between text-[11px] tabular-nums text-[#78848D]" aria-hidden="true">
              <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </figure>)}
        </div>
        <p className="border-t border-[#E9EBEC] px-4 py-3 text-xs leading-relaxed text-[#65737D] sm:px-6">
          각 그래프의 선택 건수를 기준으로 비율을 반올림해 표시합니다. 가장 많이 선택된 응답이 정답을 의미하지는 않습니다.
        </p>
      </section>
    </>}
  </div>;
}
