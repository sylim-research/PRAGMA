// 학습자별 기록 「보기」 — 학습자가 실제로 고르고 쓴 것만 MJT → 통번역 과제 → 이견 순서로 보여 준다. 미션 내용(상황·관계)은 싣지 않는다.
// 학습자가 실제로 고른·쓴 값은 남색 테두리로 표시해, 제시된 내용과 학습자의 응답이 한눈에 갈리게 한다.
import type { ReactNode } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import type { LearningRecordDetail, RecordChoice } from "@/lib/admin/learningRecordDetail";

const NAVY = "#1F2A44";

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-[#ECE8DD] py-4 first:border-t-0 first:pt-2">
      <h3 className="mb-2.5 flex flex-wrap items-baseline gap-x-2 text-[14px] font-bold text-[#15202B]">
        {title}
        {aside && <span className="text-xs font-semibold text-[#6B645A]">{aside}</span>}
      </h3>
      {children}
    </section>
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
      {choice.label && <div className="text-[12px] text-[#6B645A]">{choice.label}</div>}
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
  const { context, mjt, task, dissent } = detail;
  const steps: Array<{ title: string; aside?: ReactNode; body: ReactNode }> = [];

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
    aside: context.mode,
    body: (
      <div className="space-y-2.5">
      {context.source && <p className="px-1 text-[13px] leading-relaxed text-[#46515A]"><span className="mr-2 font-semibold text-[#6B645A]">{context.sourceLabel}</span>{context.source}</p>}
      <Flow>
        {[
          <Box key="first" className="h-full">
            <Caption>초안</Caption>
            <p className="text-sm leading-relaxed">{task.first ?? "—"}</p>
          </Box>,
          <Box key="feedback" className="h-full bg-[#FAF8F3]">
            <Caption>AI 피드백</Caption>
            {task.feedback.length > 0
              ? task.feedback.map((line) => <p key={line} className="text-[13px] leading-relaxed">{line}</p>)
              : <p className="text-[13px]">—</p>}
          </Box>,
          <Box key="final" className="h-full">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Caption>최종안</Caption>
              {task.decision && <Answer>{task.decision}</Answer>}
            </div>
            <p className="text-sm leading-relaxed">{task.final ?? "—"}</p>
            {task.hintOpened !== null && (
              <p className="mt-2 text-[12px] text-[#6B645A]">어휘 힌트 {task.hintOpened ? "열어 봄" : "열지 않음"}</p>
            )}
          </Box>,
        ]}
      </Flow>
      </div>
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
    <div>
      {steps.map((step) => (
        <Section key={step.title} title={step.title} aside={step.aside}>
          {step.body}
        </Section>
      ))}
    </div>
  );
}
