import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DOMAIN, LEVEL, MODE_LABEL, PDR_BURDEN, PDR_DISTANCE, PDR_POWER, SPEECH_ACT_UI } from "@/lib/pragma/enums";
import { getScenarioTopic } from "@/lib/pragma/scenarioTopics";
import type { BatchCell } from "@/lib/pragma/batchPlan";

const PAGE_SIZE = 20;

// 짧은 범주 칸은 고르게 나누고 주제가 나머지를 쓴다 — 글자가 왼쪽에 몰리지 않게.
const COLUMN_WIDTHS = ["5%", "5%", "8%", "8%", "8%", "8%", "10%", "8%", "8%", "32%"];

export function BatchPlanItems({ plan, selected, disabled, onSelect, actions, footer }: {
  plan: BatchCell[];
  selected: readonly number[];
  disabled: boolean;
  onSelect: (indexes: number[]) => void;
  actions?: React.ReactNode;
  /** 표 아래 실행 영역(생성 시작 버튼·진행 상황). 항목을 고른 자리에서 바로 실행한다. */
  footer?: React.ReactNode;
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
  const pageSelectedCount = indexes.filter(index => selected.includes(index)).length;
  const pageAllSelected = indexes.length > 0 && pageSelectedCount === indexes.length;
  const pageCheckRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (pageCheckRef.current) pageCheckRef.current.indeterminate = pageSelectedCount > 0 && !pageAllSelected;
  }, [pageSelectedCount, pageAllSelected]);

  return <section aria-labelledby="batch-items-heading" className="rounded-xl border bg-white p-5">
    <h2 id="batch-items-heading" className="flex items-center gap-2 text-lg font-bold"><span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FBEFD9] text-xs font-bold text-[#7A4A0A]">3</span>생성 항목 확인·실행</h2>
    {actions && <div className="mt-3 rounded-lg bg-[#FAF8F2] px-3 py-2">{actions}</div>}
    <div className="mt-4 max-w-full overflow-x-auto">
      <table className="w-full min-w-[820px] table-fixed text-[14px]">
        <colgroup>{COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
        <thead className="whitespace-nowrap border-y bg-[#FAF8F2] text-[#4E5A63]">
          <tr><th className="px-2 py-2 text-center font-semibold">
            {/* 머리 칸 체크박스: 누르면 이 페이지 전체 선택, 다시 누르면 이 페이지 전체 해제. 일부만 골랐으면 반쯤 찬 표시. */}
            <input ref={pageCheckRef} type="checkbox" aria-label="이 페이지 전체 선택" className="h-4 w-4 align-middle accent-[#15202B]"
              checked={pageAllSelected} disabled={disabled || !indexes.length}
              onChange={() => onSelect(pageAllSelected
                ? selected.filter(value => !indexes.includes(value))
                : [...new Set([...selected, ...indexes])].sort((a, b) => a - b))} />
          </th>{["번호", "화행", "수준", "수행 방식", "도메인", "권력", "거리", "부담도"].map(label =>
            <th key={label} className="px-2 py-2 text-center font-semibold">{label}</th>)}<th className="px-3 py-2 text-left font-semibold">장면 소재</th></tr>
        </thead>
        <tbody className="divide-y">{indexes.map(index => {
          const cell = plan[index];
          return <tr key={index} className={selected.includes(index) ? "bg-[#FFFBEA]" : ""}>
            <td className="px-2 py-1.5 text-center"><input type="checkbox" aria-label={"생성 항목 " + (index + 1) + " 선택"}
              className="h-4 w-4 accent-[#15202B]" checked={selected.includes(index)} disabled={disabled}
              onChange={() => toggle(index)} /></td>
            <td className="px-2 py-1.5 text-center tabular-nums">{index + 1}</td>
            <td className="whitespace-nowrap px-2 py-1.5 text-center font-medium">{SPEECH_ACT_UI[cell.speech_act_ui]}</td>
            <td className="whitespace-nowrap px-2 py-1.5 text-center">{LEVEL[cell.level]}</td>
            <td className="whitespace-nowrap px-2 py-1.5 text-center">{MODE_LABEL[cell.mode]}</td>
            <td className="whitespace-nowrap px-2 py-1.5 text-center">{DOMAIN[cell.domain]}</td>
            <td className="whitespace-nowrap px-2 py-1.5 text-center text-[#3F4E59]">{PDR_POWER[cell.pdr_power]}</td>
            <td className="whitespace-nowrap px-2 py-1.5 text-center text-[#3F4E59]">{PDR_DISTANCE[cell.pdr_distance].split(" (")[0]}</td>
            <td className="whitespace-nowrap px-2 py-1.5 text-center text-[#3F4E59]">{PDR_BURDEN[cell.pdr_burden]}</td>
            <td className="truncate px-3 py-1.5 text-left" title={cell.situation_seed_ko}>{getScenarioTopic(cell.topic_code)?.labelKo ?? cell.situation_seed_ko}</td>
          </tr>;
        })}{!plan.length && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">생성 조건과 수량을 설정하면 항목이 표시됩니다.</td></tr>}</tbody>
      </table>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#4E5A63]">
      <span>{plan.length ? start + 1 : 0}–{Math.min(start + PAGE_SIZE, plan.length)} / {plan.length}건 · 선택 {selected.length}건</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>이전 항목</Button>
        <span>{currentPage + 1} / {pages}</span>
        <Button size="sm" variant="outline" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>다음 항목</Button>
      </div>
    </div>
    {footer && <div className="mt-4 border-t pt-4">{footer}</div>}
  </section>;
}
