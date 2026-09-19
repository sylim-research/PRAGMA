import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DOMAIN, LEVEL, MODE_LABEL, PDR_BURDEN_SHORT, PDR_DISTANCE_SHORT, PDR_POWER_SHORT, SPEECH_ACT_UI } from "@/lib/pragma/enums";
import type { BatchCell } from "@/lib/pragma/batchPlan";

const PAGE_SIZE = 10;

export function BatchPlanItems({ plan, selected, disabled, onSelect, actions }: {
  plan: BatchCell[];
  selected: readonly number[];
  disabled: boolean;
  onSelect: (indexes: number[]) => void;
  actions?: React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [plan]);
  const pages = Math.max(1, Math.ceil(plan.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * PAGE_SIZE;
  const indexes = plan.slice(start, start + PAGE_SIZE).map((_, i) => start + i);
  const toggle = (index: number) => onSelect(selected.includes(index)
    ? selected.filter(value => value !== index)
    : [...selected, index].sort((a, b) => a - b));

  return <section aria-labelledby="batch-items-heading" className="rounded-xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="batch-items-heading" className="font-bold">생성 항목 확인·선택</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={disabled || !indexes.length}
          onClick={() => onSelect([...new Set([...selected, ...indexes])].sort((a, b) => a - b))}>이 페이지 선택</Button>
        <Button size="sm" variant="outline" disabled={disabled || !selected.length} onClick={() => onSelect([])}>선택 해제</Button>
      </div>
    </div>
    {actions && <div className="mt-3 rounded-lg bg-[#FAF8F2] px-3 py-2">{actions}</div>}
    <div className="mt-4 max-w-full overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead className="whitespace-nowrap border-y bg-[#FAF8F2] text-muted-foreground">
          <tr><th className="w-10 px-2 py-2">선택</th><th className="w-10 px-2 py-2">번호</th><th className="w-20 px-2 py-2">화행·수준</th><th className="w-24 px-2 py-2">과업·도메인</th><th className="w-24 px-2 py-2">P·D·R</th><th className="px-2 py-2">장면 시드</th></tr>
        </thead>
        <tbody className="divide-y">{indexes.map(index => {
          const cell = plan[index];
          return <tr key={index} className={selected.includes(index) ? "bg-[#FFFBEA]" : ""}>
            <td className="p-2"><input type="checkbox" aria-label={"생성 항목 " + (index + 1) + " 선택"}
              className="h-4 w-4 accent-[#15202B]" checked={selected.includes(index)} disabled={disabled}
              onChange={() => toggle(index)} /></td>
            <td className="p-2 tabular-nums">{index + 1}</td>
            <td className="whitespace-nowrap p-2">{SPEECH_ACT_UI[cell.speech_act_ui]}<span className="mt-1 block text-muted-foreground">{LEVEL[cell.level]}</span></td>
            <td className="whitespace-nowrap p-2">{MODE_LABEL[cell.mode]}<span className="mt-1 block text-muted-foreground">{DOMAIN[cell.domain]}</span></td>
            <td className="whitespace-nowrap p-2 leading-5 text-[#3F4E59]">{PDR_POWER_SHORT[cell.pdr_power]}<span className="block">{PDR_DISTANCE_SHORT[cell.pdr_distance]}</span><span className="block">{PDR_BURDEN_SHORT[cell.pdr_burden]}</span></td>
            <td className="min-w-[200px] p-2 leading-5">{cell.situation_seed_ko}</td>
          </tr>;
        })}{!plan.length && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">생성 조건과 수량을 설정하면 항목이 표시됩니다.</td></tr>}</tbody>
      </table>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{plan.length ? start + 1 : 0}–{Math.min(start + PAGE_SIZE, plan.length)} / {plan.length}건 · 선택 {selected.length}건</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>이전 항목</Button>
        <span>{currentPage + 1} / {pages}</span>
        <Button size="sm" variant="outline" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>다음 항목</Button>
      </div>
    </div>
  </section>;
}
