import { useMemo, useState } from "react";

import { MODE_LABEL, SPEECH_ACT_UI, type SpeechActUI } from "@/lib/pragma/enums";
import type {
  CandidatesItemView,
  ClassDiscussion,
  CorrectionsItemView,
  DctCaseView,
  DiscussionItemView,
  FreeItemView,
  GenericItemView,
  ScaleItemView,
  Slice,
  SliceTone,
} from "@/lib/mission/classDiscussion";
import { DivergingBar, Donut, ON_TONE, SpectrumStrip, StackedBar, TONE } from "@/components/charts/responseCharts";

/** 보드 상태 — 패널이 들고 있어 「크게 보기」로 열어도 같은 문항·사례가 보인다. */
export interface ClassDiscussionBoardState {
  itemId: number | null;
  dctView: "class" | "cases";
  /** 사례 비교에 올린 익명 응답 번호(최대 2). */
  compare: string[];
}

// eslint-disable-next-line react-refresh/only-export-components -- 보드와 함께 쓰는 초기 상태 하나뿐이다.
export const INITIAL_BOARD_STATE: ClassDiscussionBoardState = { itemId: null, dctView: "class", compare: [] };

type Props = {
  data: ClassDiscussion;
  demo: boolean;
  state: ClassDiscussionBoardState;
  onChange: (next: ClassDiscussionBoardState) => void;
  projector?: boolean;
};

const TEXT_TONE: Record<SliceTone, string> = {
  navy: "#2B3F4F",
  navyLight: "#5F7488",
  amber: "#9A6F14",
  rust: "#8E3E2C",
  teal: "#245449",
  slate: "#64727F",
};

const DIRECTION_LABEL: Record<string, string> = { ko_zh: "한→중", zh_ko: "중→한" };

/** 교수자가 응답을 고른 뒤 검토할 관점(논문 5.2.2). 시스템이 원인을 확정하지 않는다. */
const PERSPECTIVES = [
  { title: "복수의 적절한 선택 가능성", question: "두 표현이 각각 어떤 조건에서 성립하는가?" },
  { title: "판단 근거의 차이", question: "직접성·선택권·선행 맥락 중 무엇에 주목했는가?" },
  { title: "콘텐츠의 불명확성", question: "판단에 필요한 정보가 빠져 있거나 서로 다르게 읽히는가?" },
] as const;

const DCT_QUESTIONS = [
  "AI는 어떤 부분의 수정을 권고했는가?",
  "학습자는 어떤 상황·관계을 근거로 이견을 제시했는가?",
  "유지하거나 수정한 표현은 원문의 의미와 화행목적을 어떻게 보존하는가?",
] as const;

const percent = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);
const hasHan = (text: string) => /\p{Script=Han}/u.test(text);
const zh = (text: string) => (hasHan(text) ? "font-zh" : "break-keep");

function Legend({ slices, size, column = false }: { slices: Slice[]; size: string; column?: boolean }) {
  return <ul className={`flex ${column ? "flex-col gap-y-1.5" : "flex-wrap gap-x-4 gap-y-1"} ${size}`}>
    {slices.map((slice) => <li key={slice.key} className="flex items-center gap-1.5 text-[#44525C]">
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TONE[slice.tone] }} aria-hidden="true" />
      <span className="break-keep">{slice.label}</span>
      <span className="font-semibold tabular-nums text-[#15202B]">{slice.count}</span>
    </li>)}
  </ul>;
}

/** 수정안·수정문처럼 범주색이 없는 항목의 막대. */
function PlainBar({ count, total, tone = "navy", height = "h-2.5" }: { count: number; total: number; tone?: SliceTone; height?: string }) {
  return <div className={`w-full overflow-hidden rounded-sm bg-[#EEF0F2] ${height}`} aria-hidden="true">
    <div className="h-full rounded-r-sm" style={{ width: `${percent(count, total)}%`, backgroundColor: TONE[tone] }} />
  </div>;
}

function ItemSummaryCard({ item, active, onClick }: { item: DiscussionItemView; active: boolean; onClick: () => void }) {
  return <button
    type="button"
    aria-pressed={active}
    aria-label={`MJT ${item.itemId} · ${item.activity}`}
    onClick={onClick}
    className={[
      "-mb-px min-w-0 border-b-2 px-3 py-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]",
      active ? "border-[#15202B] font-bold text-[#15202B]" : "border-transparent text-[#6B7780] hover:text-[#15202B]",
    ].join(" ")}
  >
    <span className="mr-1.5 text-[11px] font-bold text-[#B8860B]">MJT {item.itemId}</span>{item.activity}
  </button>;
}

function Scene({ item, size }: { item: DiscussionItemView; size: string }) {
  return <dl className={`grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-1 ${size} text-[#44525C]`}>
    {item.relation && <><dt className="font-semibold text-[#7A858C]">관계</dt><dd className="break-keep">{item.relation}</dd></>}
    {item.situation && <><dt className="font-semibold text-[#7A858C]">상황</dt><dd className="break-keep">{item.situation}</dd></>}
    {item.source && <><dt className="font-semibold text-[#7A858C]">원문</dt><dd className={zh(item.source)}>{item.source}</dd></>}
  </dl>;
}

function TargetLine({ text, label, size }: { text: string; label: string; size: string }) {
  return <p className={`break-keep border-l-[3px] border-[#E4C44E] pl-3 leading-relaxed text-[#15202B] ${size}`}>
    <span className="mr-3 inline-block text-[11.5px] font-semibold text-[#7A858C]">{label}</span>
    <span className={zh(text)}>{text}</span>
  </p>;
}

function ScaleDetail({ item, size, projector }: { item: ScaleItemView; size: string; projector: boolean }) {
  const reasons = item.reasons;
  const activeRows = reasons?.cross.filter((row) => row.total > 0) ?? [];
  const cellMax = Math.max(1, ...activeRows.flatMap((row) => Object.values(row.byReason)));
  return <div className="space-y-4">
    {item.target && <TargetLine text={item.target} label="판단한 표현" size={projector ? "text-[22px]" : "text-[17px]"} />}
    <div className="grid items-center gap-4 lg:grid-cols-[170px_1fr]">
      <div className="flex items-center gap-4 lg:justify-center">
        <Donut slices={item.slices} total={item.total} size={projector ? 176 : 150} centerLabel={String(item.total)} centerSub="명 응답" />
        <div className="lg:hidden"><Legend slices={item.slices} size={size} /></div>
      </div>
      <div className="min-w-0 rounded-lg border border-[#EEEBE2] bg-[#FDFCF9] px-4 pt-3">
        <p className="text-[12px] font-semibold text-[#7A858C]">척도 위 학급 분포</p>
        <SpectrumStrip slices={item.slices} total={item.total} />
      </div>
    </div>
    {reasons && <div className="rounded-lg border border-[#E2DED2]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E2DED2] bg-[#FBF9F3] px-3 py-2">
        <p className={`font-bold text-[#15202B] ${size}`}>판단 × 선택 이유</p>
        <p className="text-[12px] text-[#7A858C]">
          이유를 고른 응답 {reasons.options.reduce((sum, option) => sum + option.count, 0)}건
          {reasons.revised > 0 && ` · 이유를 본 뒤 판단을 바꾼 응답 ${reasons.revised}건`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className={`w-full border-collapse ${size}`}>
          <thead>
            <tr className="text-left text-[#7A858C]">
              <th scope="col" className="w-[7.5rem] px-3 py-2 font-semibold">판단</th>
              {reasons.options.map((option, index) => <th key={option.id} scope="col" title={option.text} className="px-3 py-2 font-semibold">
                <span className="text-[#15202B]">이유 {index + 1}</span>
                <span className="ml-1.5 font-normal tabular-nums text-[#7A858C]">{option.count}건</span>
              </th>)}
              <th scope="col" className="w-[3.5rem] px-3 py-2 text-right font-semibold">계</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => {
              const max = Math.max(...reasons.options.map((option) => row.byReason[option.id] ?? 0));
              return <tr key={row.key} className="border-t border-[#EEEBE2]">
                <th scope="row" className="px-3 py-2 text-left font-semibold">
                  <span className="flex items-center gap-1.5" style={{ color: TEXT_TONE[row.tone] }}>
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TONE[row.tone] }} aria-hidden="true" />{row.label}
                  </span>
                </th>
                {reasons.options.map((option) => {
                  const count = row.byReason[option.id] ?? 0;
                  const strength = count === 0 ? 0 : 0.18 + (count / Math.max(1, cellMax)) * 0.62;
                  return <td
                    key={option.id}
                    className={`px-3 py-2 tabular-nums ${count === 0 ? "text-[#B5BDC4]" : count === max ? "font-bold" : ""}`}
                    style={count > 0 ? { backgroundColor: `color-mix(in srgb, ${TONE[row.tone]} ${Math.round(strength * 100)}%, white)`, color: strength > 0.5 ? ON_TONE[row.tone] : "#15202B" } : undefined}
                  >{count}</td>;
                })}
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#15202B]">{row.total}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <ol className={`space-y-1 border-t border-[#E2DED2] bg-[#FBF9F3] px-3 py-2.5 ${size} text-[#44525C]`} aria-label="선택 이유">
        {reasons.options.map((option, index) => <li key={option.id} className="flex gap-2 break-keep leading-relaxed">
          <span className="shrink-0 font-semibold text-[#15202B]">이유 {index + 1}</span>{option.text}
        </li>)}
      </ol>
    </div>}
  </div>;
}

function CandidatesDetail({ item, size, projector }: { item: CandidatesItemView; size: string; projector: boolean }) {
  // 발산 축: 왼쪽 = 두 번째 바깥 범주(과소), 가운데 = 적정, 오른쪽 = 첫 바깥 범주(과잉). 카탈로그 순서는 [과잉, 적정, 과소].
  const axis = (slices: Slice[]) => {
    const middle = item.bands.find((band) => band.tone === "teal")?.code;
    const outer = item.bands.filter((band) => band.code !== middle);
    const order = [outer[1]?.code, middle, outer[0]?.code];
    return order.map((code) => slices.find((slice) => slice.key === code)).filter((slice): slice is Slice => Boolean(slice));
  };
  const [leftBand, , rightBand] = axis(item.candidates[0]?.slices ?? []);
  return <div className="space-y-3">
    <div className={`flex items-center justify-between px-1 ${size} text-[#7A858C]`}>
      <span className="flex items-center gap-1.5">{leftBand && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TONE[leftBand.tone] }} />}← {leftBand?.label ?? "과소"}</span>
      <span className="font-semibold text-[#245449]">적정 범주는 축 가운데</span>
      <span className="flex items-center gap-1.5">{rightBand?.label ?? "과잉"} →{rightBand && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TONE[rightBand.tone] }} />}</span>
    </div>
    <ol className="space-y-3">
      {item.candidates.map((candidate) => <li key={candidate.index} className="rounded-lg border border-[#E2DED2] px-3 py-2.5">
        <p className={`flex gap-2 leading-relaxed text-[#15202B] ${projector ? "text-[19px]" : "text-[15.5px]"}`}>
          <span className="shrink-0 text-[12px] font-bold text-[#B8860B]">표현 {candidate.index + 1}</span>
          <span className={zh(candidate.text)}>{candidate.text}</span>
        </p>
        <div className="mt-2.5"><DivergingBar slices={axis(candidate.slices)} total={candidate.total} height={projector ? "h-7" : "h-6"} /></div>
        <div className="mt-2"><Legend slices={axis(candidate.slices).filter((slice) => slice.count > 0)} size={size} /></div>
      </li>)}
    </ol>
  </div>;
}

function CorrectionsDetail({ item, size, projector }: { item: CorrectionsItemView; size: string; projector: boolean }) {
  return <div className="space-y-4">
    {item.target && <TargetLine text={item.target} label="고치기 전 표현" size={projector ? "text-[20px]" : "text-[16px]"} />}
    <ol className="space-y-3">
      {item.corrections.map((correction) => <li key={correction.index}>
        <div className="flex items-start justify-between gap-3">
          <p className={`flex min-w-0 gap-2 leading-relaxed text-[#15202B] ${projector ? "text-[19px]" : "text-[15.5px]"}`}>
            <span className="shrink-0 text-[12px] font-bold text-[#B8860B]">수정안 {correction.index + 1}</span>
            <span className={zh(correction.text)}>{correction.text}</span>
          </p>
          <span className={`shrink-0 tabular-nums ${size}`}>
            <span className="font-bold text-[#15202B]">{correction.count}</span>
            <span className="ml-1 text-[#7A858C]">{percent(correction.count, item.total)}%</span>
          </span>
        </div>
        <div className="mt-1.5"><PlainBar count={correction.count} total={item.total} height={projector ? "h-3.5" : "h-2.5"} /></div>
      </li>)}
    </ol>
  </div>;
}

function FreeDetail({ item, size, projector }: { item: FreeItemView; size: string; projector: boolean }) {
  return <div className="space-y-4">
    {item.target && <TargetLine text={item.target} label="고치기 전 표현" size={projector ? "text-[20px]" : "text-[16px]"} />}
    <div className="flex items-baseline justify-between gap-2">
      <p className={`font-bold text-[#15202B] ${size}`}>익명 수정문 {item.texts.length}종</p>
      <p className="text-[12px] text-[#7A858C]">수정문은 분류하지 않고 그대로 보여 줍니다.</p>
    </div>
    <ol className="grid gap-2 sm:grid-cols-2">
      {item.texts.map((entry, index) => <li key={entry.text} className="rounded-lg border border-[#E2DED2] bg-[#FFFDF8] px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2 text-[12px]">
          <span className="font-bold text-[#B8860B]">수정문 {index + 1}</span>
          <span className="tabular-nums text-[#44525C]">{entry.count > 1 ? `같은 문장 ${entry.count}건` : "1건"}</span>
        </div>
        <p className={`mt-1 leading-relaxed text-[#15202B] ${zh(entry.text)} ${projector ? "text-[19px]" : "text-[15.5px]"}`}>{entry.text}</p>
      </li>)}
    </ol>
  </div>;
}

function GenericDetail({ item, size, projector }: { item: GenericItemView; size: string; projector: boolean }) {
  return <div className="space-y-4">
    {item.target && <TargetLine text={item.target} label="판단한 표현" size={projector ? "text-[20px]" : "text-[16px]"} />}
    {item.groups.map((group) => <div key={group.heading}>
      <p className={`mb-2 font-bold text-[#15202B] ${size}`}>{group.heading}<span className="ml-2 font-normal text-[#7A858C]">선택 {group.total}건</span></p>
      <ol className="space-y-2">
        {group.choices.map((choice) => <li key={choice.key}>
          <div className={`flex items-start justify-between gap-3 ${size}`}>
            <span className={`min-w-0 text-[#15202B] ${zh(choice.label)}`}>{choice.label}</span>
            <span className="shrink-0 tabular-nums"><span className="font-bold">{choice.count}</span><span className="ml-1 text-[#7A858C]">{percent(choice.count, group.total)}%</span></span>
          </div>
          <div className="mt-1"><PlainBar count={choice.count} total={group.total} height={projector ? "h-3" : "h-2"} /></div>
        </li>)}
      </ol>
    </div>)}
  </div>;
}

function decisionLabel(decision: DctCaseView["decision"]) {
  return decision === "revised" ? "수정" : decision === "retained" ? "초안 유지" : "—";
}

function CaseColumn({ item, size, projector }: { item: DctCaseView; size: string; projector: boolean }) {
  const text = projector ? "text-[18px]" : "text-[15px]";
  const feedback = item.feedback;
  return <article aria-label={item.id} className="min-w-0 rounded-xl border border-[#E2DED2] bg-white">
    <header className="flex flex-wrap items-center gap-2 border-b border-[#E2DED2] bg-[#FBF9F3] px-3 py-2">
      <span className={`font-bold text-[#15202B] ${size}`}>{item.id}</span>
      <span className="rounded-full border border-[#15202B] px-2 py-0.5 text-[11px] font-bold text-[#15202B]">{decisionLabel(item.decision)}</span>
      {item.dissent && <span className="rounded-full bg-[#B8860B] px-2 py-0.5 text-[11px] font-bold text-white">이견 제시</span>}
    </header>
    <ol className="divide-y divide-[#EEEBE2]">
      <li className="px-3 py-2.5">
        <p className="text-[11.5px] font-semibold text-[#7A858C]">초안</p>
        <p className={`mt-0.5 leading-relaxed text-[#15202B] ${item.first ? zh(item.first) : ""} ${text}`}>{item.first ?? "—"}</p>
      </li>
      <li className="px-3 py-2.5">
        <p className="text-[11.5px] font-semibold text-[#7A858C]">AI 피드백</p>
        {feedback ? <div className={`mt-0.5 space-y-1 ${size}`}>
          <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[#15202B]">
            {feedback.band && <span><span className="text-[#7A858C]">화용 </span><span className="font-semibold">{feedback.band}</span></span>}
            {feedback.scope && <span><span className="text-[#7A858C]">다시 볼 곳 </span><span className="font-semibold">{feedback.scope}</span></span>}
          </p>
          {feedback.feature && <p className="break-keep leading-relaxed text-[#44525C]">{feedback.feature}</p>}
          {feedback.alternative && <p className={`leading-relaxed text-[#44525C] ${zh(feedback.alternative)}`}><span className="mr-2 text-[11.5px] font-semibold text-[#7A858C]">대안</span>{feedback.alternative}</p>}
        </div> : <p className={`mt-0.5 text-[#7A858C] ${size}`}>피드백 기록 없음</p>}
      </li>
      <li className="px-3 py-2.5">
        <p className="text-[11.5px] font-semibold text-[#7A858C]">학습자의 이견·근거</p>
        {item.dissent ? <div className={`mt-0.5 space-y-1 ${size}`}>
          {item.dissent.conditions.length > 0 && <p className="flex flex-wrap gap-1.5">
            {item.dissent.conditions.map((condition) => <span key={condition} className="rounded-md border border-[#D9CFA8] bg-[#FFFBEC] px-1.5 py-0.5 text-[12px] text-[#5F573D]">{condition}</span>)}
          </p>}
          {item.dissent.reason && <p className="break-keep leading-relaxed text-[#15202B]">{item.dissent.reason}</p>}
        </div> : <p className={`mt-0.5 text-[#7A858C] ${size}`}>이견 없음</p>}
      </li>
      <li className="px-3 py-2.5">
        <p className="text-[11.5px] font-semibold text-[#7A858C]">최종안</p>
        <p className={`mt-0.5 leading-relaxed font-semibold text-[#15202B] ${item.final ? zh(item.final) : ""} ${text}`}>{item.final ?? "—"}</p>
      </li>
    </ol>
  </article>;
}

/**
 * 데모에서 사례 비교를 처음 열면 「응답 1」(공개 시연 미션과 같은 학습자)과 첫 이견 사례를 나란히 올린다.
 * 실제 응답에서는 교수자가 직접 고른다.
 */
// eslint-disable-next-line react-refresh/only-export-components -- 데모 도판 경로와 같은 기본 선택을 쓴다.
export function defaultDemoCompare(data: ClassDiscussion): string[] {
  const cases = data.dct.cases;
  const first = cases.find((item) => item.id === "응답 1");
  const dissent = cases.find((item) => item.dissent && item.id !== first?.id);
  return [first?.id, dissent?.id].filter((id): id is string => Boolean(id));
}

function DctSection({ data, demo, state, onChange, size, projector }: { data: ClassDiscussion; demo: boolean; state: ClassDiscussionBoardState; onChange: Props["onChange"]; size: string; projector: boolean }) {
  const dct = data.dct;
  const decisionSlices: Slice[] = [
    { key: "retained", label: "초안 유지", count: dct.retained, tone: "navy" },
    { key: "revised", label: "수정", count: dct.revised, tone: "amber" },
  ];
  const dissentSlices: Slice[] = [
    { key: "dissent", label: "이견 제시", count: dct.dissents, tone: "rust" },
    { key: "none", label: "이견 없음", count: dct.total - dct.dissents, tone: "slate" },
  ];
  const withVerdict = dct.verdicts.reduce((sum, slice) => sum + slice.count, 0);
  const compared = state.compare.map((id) => dct.cases.find((item) => item.id === id)).filter((item): item is DctCaseView => Boolean(item));
  const toggleCase = (id: string) => {
    const next = state.compare.includes(id)
      ? state.compare.filter((item) => item !== id)
      : [...state.compare.slice(-1), id];
    onChange({ ...state, compare: next });
  };
  const modeLabel = dct.mode === "interpreting" ? "통역" : dct.mode === "translation" ? "번역" : null;
  const dissentCount = dct.cases.filter((item) => item.dissent).length;
  const [showAll, setShowAll] = useState(false);
  const listAll = showAll || dissentCount === 0;
  const listed = listAll ? dct.cases : dct.cases.filter((item) => item.dissent || state.compare.includes(item.id));

  return <section aria-label="DCT형 통번역 과제" className="rounded-xl border border-[#E2DED2] bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DED2] px-4 py-2.5">
      <h3 className={`flex items-center gap-2 font-bold text-[#15202B] ${projector ? "text-[18px]" : "text-[15px]"}`}>
        <span className="inline-block h-4 w-1 rounded-sm bg-[#FAD338]" aria-hidden="true" />DCT형 통번역 과제{modeLabel && <span className="font-normal text-[#7A858C]">· {modeLabel}</span>}
      </h3>
      <div role="tablist" aria-label="DCT형 통번역 과제 보기" className="flex overflow-hidden rounded-md border border-[#15202B]">
        {([["class", "학급 전체"], ["cases", "사례 비교"]] as const).map(([key, label]) => <button
          key={key}
          type="button"
          role="tab"
          aria-selected={state.dctView === key}
          onClick={() => onChange({ ...state, dctView: key, compare: key === "cases" && demo && state.compare.length === 0 ? defaultDemoCompare(data) : state.compare })}
          className={`px-3 py-1 text-[12.5px] font-semibold ${state.dctView === key ? "bg-[#15202B] text-white" : "bg-white text-[#15202B] hover:bg-[#F3F1EA]"}`}
        >{label}</button>)}
      </div>
    </div>

    {dct.total === 0 ? <p className={`px-4 py-4 text-[#7A858C] ${size}`}>저장된 통번역 산출이 없습니다.</p>
      : state.dctView === "class" ? <div className="grid gap-4 px-4 py-4 lg:grid-cols-3">
        <div>
          <p className={`font-semibold text-[#15202B] ${size}`}>최종 결정 <span className="font-normal text-[#7A858C]">{dct.total}명</span></p>
          <div className="mt-2 flex items-center gap-4">
            <Donut slices={decisionSlices} total={dct.total} size={104} thickness={16} centerLabel={`${percent(dct.revised, dct.total)}%`} centerSub="수정" />
            <Legend slices={decisionSlices} size={size} column />
          </div>
        </div>
        <div>
          <p className={`font-semibold text-[#15202B] ${size}`}>이견 제시 <span className="font-normal text-[#7A858C]">수정 여부와 따로 셉니다</span></p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Donut slices={dissentSlices} total={dct.total} size={104} thickness={16} centerLabel={`${percent(dct.dissents, dct.total)}%`} centerSub="이견" />
            <Legend slices={dissentSlices} size={size} column />
            {dct.dissents > 0 && <button
              type="button"
              onClick={() => onChange({ ...state, dctView: "cases", compare: dct.cases.filter((item) => item.dissent).slice(0, 2).map((item) => item.id) })}
              className="text-[12.5px] font-semibold text-[#15202B] underline-offset-4 hover:underline"
            >이견 사례 열기</button>}
          </div>
        </div>
        <div>
          <p className={`font-semibold text-[#15202B] ${size}`}>AI 피드백의 화용 판정 <span className="font-normal text-[#7A858C]">초안 기준 {withVerdict}건</span></p>
          {withVerdict > 0 ? <>
            <div className="mt-2"><StackedBar slices={dct.verdicts} total={withVerdict} height={projector ? "h-7" : "h-6"} labels /></div>
            <div className="mt-1.5"><Legend slices={dct.verdicts.filter((slice) => slice.count > 0)} size={size} /></div>
          </> : <p className={`mt-2 text-[#7A858C] ${size}`}>피드백 기록 없음</p>}
        </div>
      </div>
      : <div className="px-4 py-4">
        {dct.source && <dl className={`mb-4 grid grid-cols-[3.5rem_1fr] gap-x-3 ${size} text-[#44525C]`}>
          <dt className="font-semibold text-[#7A858C]">원문</dt>
          <dd className={zh(dct.source)}>{dct.source}</dd>
        </dl>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`font-semibold text-[#15202B] ${size}`}>비교할 응답을 두 개까지 고르세요.</p>
          <div className="flex items-center gap-3">
            <p className="text-[12px] text-[#7A858C]">익명 번호이며 계정과 연결되지 않습니다.</p>
            {dissentCount > 0 && <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="rounded-md border border-[#15202B] px-2.5 py-1 text-[12px] font-semibold text-[#15202B] hover:bg-[#F3F1EA]"
            >{showAll ? `이견 제시만 보기 (${dissentCount})` : `전체 응답 보기 (${dct.cases.length})`}</button>}
          </div>
        </div>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="익명 응답 목록">
          {listed.map((item) => {
            const active = state.compare.includes(item.id);
            return <li key={item.id}><button
              type="button"
              aria-pressed={active}
              onClick={() => toggleCase(item.id)}
              className={[
                "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]",
                active ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#DCD8CC] bg-white text-[#44525C] hover:border-[#B9B29C]",
              ].join(" ")}
            >
              <span className="font-semibold">{item.id}</span>
              <span className={active ? "text-[#D8DEE2]" : "text-[#7A858C]"}>{decisionLabel(item.decision)}</span>
              {item.dissent && <span className="inline-block h-2 w-2 rounded-full bg-[#B8860B]" aria-label="이견 제시" />}
            </button></li>;
          })}
        </ul>
        {compared.length > 0 && <div className={`mt-4 grid gap-3 ${compared.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {compared.map((item) => <CaseColumn key={item.id} item={item} size={size} projector={projector} />)}
        </div>}
        <ol className={`mt-4 grid gap-1.5 rounded-lg bg-[#FBF9F3] px-4 py-3 ${size} text-[#44525C] sm:grid-cols-3`}>
          {DCT_QUESTIONS.map((question, index) => <li key={question} className="flex gap-2 break-keep"><span className="font-bold text-[#B8860B]">{index + 1}</span>{question}</li>)}
        </ol>
      </div>}
  </section>;
}

/** 학급 응답을 보고 토론할 지점을 고르는 보드 — 판단 분포 → 근거 비교 → 토론 질문(논문 5.2.2). */
export function ClassDiscussionBoard({ data, demo, state, onChange, projector = false }: Props) {
  const size = projector ? "text-[15.5px]" : "text-[13.5px]";
  const selected = data.items.find((item) => item.itemId === state.itemId) ?? data.items[0] ?? null;
  const speechAct = data.speechAct ? SPEECH_ACT_UI[data.speechAct as SpeechActUI] ?? data.speechAct : null;
  const modeLabel = data.dct.mode === "interpreting" ? MODE_LABEL.stt_interpreting : data.dct.mode === "translation" ? MODE_LABEL.translation : null;
  const summary = useMemo(() => [speechAct, modeLabel, data.direction ? DIRECTION_LABEL[data.direction] ?? data.direction : null, data.focus].filter(Boolean), [speechAct, modeLabel, data.direction, data.focus]);

  return <div className="space-y-3" aria-label="학급 응답 토론 보드">
    <p className={`text-[#5D6970] ${size}`}>
      {[...summary, `응답 ${data.learners}명`].join(" · ")}
    </p>

    {data.items.length === 0 ? <p className={`rounded-xl border border-dashed border-[#DAD6CA] bg-white p-5 text-[#5D6970] ${size}`}>
      집계된 기록에 MJT 판단 응답이 없습니다.
    </p> : <>
      <div className="flex flex-wrap border-b border-[#E2DED2]" aria-label="MJT 판단 문항">
        {data.items.map((item) => <ItemSummaryCard
          key={item.itemId}
          item={item}
          active={selected?.itemId === item.itemId}
          onClick={() => onChange({ ...state, itemId: item.itemId })}
        />)}
      </div>

      {selected && <section aria-label={`MJT ${selected.itemId} · ${selected.activity}`} className="rounded-xl border border-[#E2DED2] bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E2DED2] px-4 py-2.5">
          <h3 className={`flex items-center gap-2 font-bold text-[#15202B] ${projector ? "text-[18px]" : "text-[15px]"}`}>
            <span className="inline-block h-4 w-1 rounded-sm bg-[#FAD338]" aria-hidden="true" />MJT {selected.itemId} · {selected.activity}{selected.title && <span className="font-normal text-[#7A858C]">· {selected.title}</span>}
          </h3>
          <p className="text-[12px] tabular-nums text-[#7A858C]">응답 {selected.total}명</p>
        </div>
        <div className="space-y-4 px-4 py-4">
          <Scene item={selected} size={size} />
          {selected.kind === "scale" && <ScaleDetail item={selected} size={size} projector={projector} />}
          {selected.kind === "candidates" && <CandidatesDetail item={selected} size={size} projector={projector} />}
          {selected.kind === "corrections" && <CorrectionsDetail item={selected} size={size} projector={projector} />}
          {selected.kind === "free" && <FreeDetail item={selected} size={size} projector={projector} />}
          {selected.kind === "generic" && <GenericDetail item={selected} size={size} projector={projector} />}
        </div>
        <p className="border-t border-[#EEEBE2] px-4 py-2 text-[12px] text-[#7A858C]">비율은 각 문항의 응답 수 기준입니다. 많이 고른 응답이 정답을 뜻하지 않습니다.</p>
      </section>}
    </>}

    <DctSection data={data} demo={demo} state={state} onChange={onChange} size={size} projector={projector} />

    <section aria-label="토론에서 검토할 관점" className="rounded-xl border border-[#E2DED2] bg-white">
      <div className="border-b border-[#E2DED2] px-4 py-2.5">
        <h3 className={`flex items-center gap-2 font-bold text-[#15202B] ${projector ? "text-[18px]" : "text-[15px]"}`}>
          <span className="inline-block h-4 w-1 rounded-sm bg-[#FAD338]" aria-hidden="true" />토론에서 검토할 관점
          <span className="font-normal text-[#7A858C]">· 응답이 갈린 원인은 교수자가 판단합니다</span>
        </h3>
      </div>
      <dl className={`grid divide-y divide-[#EEEBE2] ${size} sm:grid-cols-3 sm:divide-x sm:divide-y-0`}>
        {PERSPECTIVES.map((perspective) => <div key={perspective.title} className="px-4 py-3">
          <dt className="font-bold text-[#15202B]">{perspective.title}</dt>
          <dd className="mt-1 break-keep leading-relaxed text-[#44525C]">{perspective.question}</dd>
        </div>)}
      </dl>
    </section>
  </div>;
}
