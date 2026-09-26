// 학습 수행 기록 「보기」 — 한 번의 수행을 ①상황 → ②MJT → ③통번역 과제 → ④이견 순서의 흐름으로 그린다.
// 학습자가 실제로 고른·쓴 값은 남색 테두리로 표시해, 제시된 내용과 학습자의 응답이 한눈에 갈리게 한다.
import type { ReactNode } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import type { LearningRecordDetail, RecordChoice } from "@/lib/admin/learningRecordDetail";

const NAVY = "#1F2A44";

function Step({ no, title, last = false, children }: { no: number; title: string; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative flex gap-4">
      {!last && <span aria-hidden className="absolute left-[13px] top-8 bottom-0 w-px bg-[#E2DED2]" />}
      <span
        className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
        style={{ background: NAVY }}
      >
        {no}
      </span>
      <div className="min-w-0 flex-1 pb-6">
        <h3 className="mb-2 text-[15px] font-bold leading-7 text-[#15202B]">{title}</h3>
        {children}
      </div>
    </li>
  );
}

const Box = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`min-w-0 rounded-lg border border-[#E2DED2] bg-white p-3 ${className}`}>{children}</div>
);

const Caption = ({ children }: { children: ReactNode }) => (
  <div className="mb-1 text-xs font-semibold text-[#6B645A]">{children}</div>
);

/** 학습자가 고른·쓴 값 — 남색 테두리 */
const Answer = ({ children }: { children: ReactNode }) => (
  <span
    className="inline-block max-w-full whitespace-pre-wrap break-words rounded-md border-[1.5px] bg-[#FFFDF8] px-2 py-0.5 text-[13px] font-semibold"
    style={{ borderColor: NAVY, color: NAVY }}
  >
    {children}
  </span>
);

function Choice({ choice }: { choice: RecordChoice }) {
  return (
    <div className="mt-2">
      {choice.label && <div className="text-[11px] text-[#6B645A]">{choice.label}</div>}
      <Answer>{choice.value}</Answer>
    </div>
  );
}

function Flow({ children }: { children: ReactNode[] }) {
  return (
    <div className="flex flex-col items-stretch gap-2 lg:flex-row">
      {children.flatMap((child, index) => [
        index > 0 ? (
          <span key={`arrow-${index}`} aria-hidden className="flex items-center justify-center text-[#B8A780]">
            <ArrowDown className="h-4 w-4 lg:hidden" />
            <ArrowRight className="hidden h-4 w-4 lg:block" />
          </span>
        ) : null,
        <div key={`step-${index}`} className="min-w-0 flex-1">{child}</div>,
      ])}
    </div>
  );
}

export function LearningRecordDetailView({ detail }: { detail: LearningRecordDetail }) {
  const { context, mjt, task, dissent, meta } = detail;
  const steps: Array<{ title: string; body: ReactNode }> = [];

  steps.push({
    title: "상황과 출발텍스트",
    body: (
      <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Box className="bg-[#FBF5E6]">
          {context.relation && (<><Caption>관계</Caption><p className="text-sm">{context.relation}</p></>)}
          {context.situation && (<div className="mt-2"><Caption>상황</Caption><p className="text-sm leading-relaxed">{context.situation}</p></div>)}
          {context.mode && <p className="mt-2 text-xs font-semibold" style={{ color: NAVY }}>{context.mode}</p>}
        </Box>
        <Box>
          <Caption>{context.sourceLabel}</Caption>
          <p className="text-sm leading-relaxed">{context.source ?? "—"}</p>
        </Box>
      </div>
    ),
  });

  if (mjt.length > 0) {
    steps.push({
      title: "MJT 판단",
      body: (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {mjt.map((card, index) => (
            <Box key={`${card.id}-${index}`} className={card.rows.length > 0 ? "sm:col-span-2 xl:col-span-3" : ""}>
              <div className="text-xs font-bold" style={{ color: NAVY }}>
                MJT{card.id ?? "?"} <span className="font-semibold text-[#6B645A]">· {card.activity}</span>
              </div>
              {card.target && <p className="mt-1.5 text-sm leading-relaxed text-[#15202B]">{card.target}</p>}
              {card.choices.map((choice, choiceIndex) => <Choice key={choiceIndex} choice={choice} />)}
              {card.rows.length > 0 && (
                <ul className="mt-2 divide-y divide-[#F0ECE2]">
                  {card.rows.map((row, rowIndex) => (
                    <li key={rowIndex} className="flex flex-col gap-1 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <span className="min-w-0 text-sm leading-relaxed">{row.label}</span>
                      <span className="shrink-0"><Answer>{row.value}</Answer></span>
                    </li>
                  ))}
                </ul>
              )}
            </Box>
          ))}
        </div>
      ),
    });
  }

  steps.push({
    title: "DCT형 통번역 과제",
    body: (
      <Flow>
        {[
          <Box key="first" className="h-full">
            <Caption>최초 산출</Caption>
            <p className="text-sm leading-relaxed">{task.first ?? "—"}</p>
          </Box>,
          <Box key="feedback" className="h-full bg-[#FBF5E6]">
            <Caption>AI 피드백</Caption>
            {task.feedback.length > 0
              ? task.feedback.map((line) => <p key={line} className="text-[13px] leading-relaxed">{line}</p>)
              : <p className="text-[13px]">—</p>}
          </Box>,
          <Box key="final" className="h-full">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Caption>최종 산출</Caption>
              {task.decision && <Answer>{task.decision}</Answer>}
            </div>
            <p className="text-sm leading-relaxed">{task.final ?? "—"}</p>
            {task.hintOpened !== null && (
              <p className="mt-2 text-[11px] text-[#6B645A]">어휘 힌트 {task.hintOpened ? "열어 봄" : "열지 않음"}</p>
            )}
          </Box>,
        ]}
      </Flow>
    ),
  });

  if (dissent) {
    steps.push({
      title: "AI 피드백에 대한 이견",
      body: (
        <Box>
          <div className="flex flex-wrap gap-1.5">
            {dissent.conditions.map((condition) => <Answer key={condition}>{condition}</Answer>)}
          </div>
          {dissent.reason && <p className="mt-2 text-sm leading-relaxed">{dissent.reason}</p>}
        </Box>
      ),
    });
  }

  return (
    <div className="rounded-lg border border-[#E2DED2] bg-[#FFFDF8] p-4">
      <ol>
        {steps.map((step, index) => (
          <Step key={step.title} no={index + 1} title={step.title} last={index === steps.length - 1}>
            {step.body}
          </Step>
        ))}
      </ol>
      {meta.length > 0 && (
        <p className="border-t border-[#E2DED2] pt-2 text-xs tabular-nums text-[#6B645A]">{meta.join("  ·  ")}</p>
      )}
    </div>
  );
}
