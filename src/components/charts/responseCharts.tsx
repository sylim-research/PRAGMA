/* eslint-disable react-refresh/only-export-components -- 색 상수와 차트 컴포넌트를 한 파일에 둔다. */
// 학급 응답 시각화 — 운영 학급 응답 보드와 학습자 「내 기록」이 같이 쓴다. 차트 라이브러리 없이 SVG·CSS로 그린다.
// 평균·점수를 만들지 않고 범주별 건수와 비율만 그린다.

import type { Slice, SliceTone } from "@/lib/mission/classDiscussion";

const percent = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

export const TONE: Record<SliceTone, string> = {
  navy: "#344F63",
  navyLight: "#8AA0B3",
  amber: "#D9A441",
  rust: "#B5533C",
  teal: "#2F6B5E",
  slate: "#9AA8B6",
};

/** 밝은 칸에는 남색 글자, 짙은 칸에는 흰 글자. */
export const ON_TONE: Record<SliceTone, string> = {
  navy: "#FFFFFF", navyLight: "#15202B", amber: "#15202B", rust: "#FFFFFF", teal: "#FFFFFF", slate: "#15202B",
};

/** labels=true면 칸 안에 비율을 적는다(8% 미만 칸은 비운다) — 범례에서 비율 한 층을 덜어 낸다. */
export function StackedBar({ slices, total, height = "h-3", labels = false }: { slices: Slice[]; total: number; height?: string; labels?: boolean }) {
  return <div className={`flex w-full overflow-hidden rounded-sm bg-[#EEF0F2] ${height}`} aria-hidden="true">
    {slices.filter((slice) => slice.count > 0).map((slice) => {
      const share = percent(slice.count, total);
      return <span
        key={slice.key}
        className="flex h-full items-center justify-center overflow-hidden text-[12.5px] font-semibold tabular-nums"
        style={{ width: `${(slice.count / Math.max(1, total)) * 100}%`, backgroundColor: TONE[slice.tone], color: ON_TONE[slice.tone] }}
      >{labels && share >= 8 ? `${share}%` : null}</span>;
    })}
  </div>;
}


/** 도넛(SVG). 범주별 호를 stroke-dasharray로 그린다 — 차트 라이브러리 없이 그린다. */
export function Donut({ slices, total, size = 150, thickness = 22, centerLabel, centerSub }: {
  slices: Slice[]; total: number; size?: number; thickness?: number; centerLabel: string; centerSub?: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel} ${centerSub ?? ""}`} className="shrink-0">
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF0F2" strokeWidth={thickness} />
    {slices.filter((slice) => slice.count > 0).map((slice) => {
      const len = (slice.count / Math.max(1, total)) * c;
      const el = <circle
        key={slice.key}
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={TONE[slice.tone]} strokeWidth={thickness}
        strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />;
      offset += len;
      return el;
    })}
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" dy={centerSub ? -8 : 0} className="fill-[#15202B] text-[23px] font-black tabular-nums">{centerLabel}</text>
    {centerSub && <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" dy={14} className="fill-[#7A858C] text-[12.5px] font-semibold">{centerSub}</text>}
  </svg>;
}

/** 4점 척도를 한 축(매우 적절 → 매우 부적절)에 놓고, 척도별 학급 비율을 원의 크기와 숫자로 보인다. */
export function SpectrumStrip({ slices, total, mine, label = "적절성 척도 위 응답 분포", className = "h-auto w-full" }: { slices: Slice[]; total: number; mine?: string | null; label?: string; className?: string }) {
  const width = 560;
  const step = width / slices.length;
  return <svg viewBox={`0 0 ${width} ${mine ? 146 : 128}`} className={className} role="img" aria-label={label}>
    <g transform={mine ? "translate(0 18)" : undefined}>
    <defs>
      <linearGradient id="spectrum-band" x1="0" x2="1" y1="0" y2="0">
        {slices.map((slice, index) => <stop key={slice.key} offset={`${(index / Math.max(1, slices.length - 1)) * 100}%`} stopColor={TONE[slice.tone]} />)}
      </linearGradient>
    </defs>
    <rect x={step / 2} y={76} width={width - step} height={6} rx={3} fill="url(#spectrum-band)" opacity={0.55} />
    {slices.map((slice, index) => {
      const x = step * index + step / 2;
      const share = percent(slice.count, total);
      const r = 8 + Math.sqrt(share) * 3.2;
      return <g key={slice.key}>
        <line x1={x} x2={x} y1={79} y2={62} stroke="#D9D5C8" strokeWidth={1} />
        {mine === slice.key && <>
          <circle cx={x} cy={46} r={r + 5} fill="none" stroke="#15202B" strokeWidth={2.5} />
          <rect x={x - 13} y={46 - r - 25} width={26} height={17} rx={8.5} fill="#15202B" />
          <text x={x} y={46 - r - 16.5} textAnchor="middle" dominantBaseline="central" fill="#FAD338" className="text-[13px] font-bold">나</text>
        </>}
        <circle cx={x} cy={46} r={r} fill={TONE[slice.tone]} />
        <text x={x} y={46} textAnchor="middle" dominantBaseline="central" fill={ON_TONE[slice.tone]} className="text-[14.5px] font-bold tabular-nums">{share}%</text>
        <text x={x} y={104} textAnchor="middle" className="fill-[#26323D] text-[15px] font-semibold">{slice.label}</text>
        <text x={x} y={122} textAnchor="middle" className="fill-[#5C6A7A] text-[13.5px] tabular-nums">{slice.count}명</text>
      </g>;
    })}
    </g>
  </svg>;
}

/**
 * 발산형 막대 — 가운데 범주(적정)를 축 중앙에 두고, 양쪽 범주를 좌·우로 펼친다.
 * slices는 [왼쪽 범주, 가운데 범주, 오른쪽 범주] 순서를 기대하며, 그 밖의 범주는 오른쪽에 붙인다.
 */
export function DivergingBar({ slices, total, height = "h-6" }: { slices: Slice[]; total: number; height?: string }) {
  const [left, middle, ...rest] = slices;
  // 한쪽이 전부여도 넘치지 않게 1%를 폭 0.5%로 그린다(좌·우 각각 최대 50%).
  const share = (slice?: Slice) => (slice ? (slice.count / Math.max(1, total)) * 50 : 0);
  const start = 50 - share(left) - share(middle) / 2;
  const ordered = [left, middle, ...rest].filter((slice): slice is Slice => Boolean(slice) && slice.count > 0);
  return <div className={`relative w-full ${height}`} aria-hidden="true">
    <div className="absolute inset-y-0 left-1/2 w-px bg-[#B9B29C]" />
    <div className="absolute inset-y-0 flex overflow-hidden rounded-sm" style={{ left: `${Math.max(0, start)}%`, width: `${ordered.reduce((sum, slice) => sum + share(slice), 0)}%` }}>
      {ordered.map((slice) => {
        const value = percent(slice.count, total);
        return <span
          key={slice.key}
          className="flex h-full items-center justify-center overflow-hidden text-[12.5px] font-semibold tabular-nums"
          style={{ width: `${(share(slice) / ordered.reduce((sum, item) => sum + share(item), 0)) * 100}%`, backgroundColor: TONE[slice.tone], color: ON_TONE[slice.tone] }}
        >{value >= 8 ? `${value}%` : null}</span>;
      })}
    </div>
  </div>;
}

