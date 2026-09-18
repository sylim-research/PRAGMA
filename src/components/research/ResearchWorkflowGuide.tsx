import { Link, useLocation } from "react-router-dom";

type ResearchStep = "missions" | "release";

const STEPS: Array<{
  id: ResearchStep;
  short: string;
  title: string;
  purpose: string;
  owner: string;
  done: string;
  adminPath: string;
  previewPath: string;
}> = [
  {
    id: "missions",
    short: "자동 품질 점검",
    title: "학습 콘텐츠 자동 품질 점검",
    purpose: "시스템이 전체 학습 콘텐츠를 점검하고, 교수자는 경고가 있는 콘텐츠를 우선 확인합니다.",
    owner: "시스템(자동 점검) · 교수자(경고 확인)",
    done: "자동 점검 결과와 교수자 확인 기록",
    adminPath: "/admin/research-qa/final-review",
    previewPath: "/prototype/final-review",
  },
  {
    id: "release",
    short: "교수자 최종 승인",
    title: "교수자 최종 승인과 학습자 공개",
    purpose: "자동 점검 결과를 확인한 교수자가 수업 사용 여부와 학습자 공개를 최종 결정합니다.",
    owner: "교수자",
    done: "수업에서 사용할 승인 학습 콘텐츠",
    adminPath: "/admin/research-qa/releases",
    previewPath: "/prototype/mission-release",
  },
];

export const ResearchWorkflowGuide = ({ current }: { current: ResearchStep | "overview" }) => {
  const { pathname } = useLocation();
  const preview = pathname.startsWith("/prototype/");
  const activeIndex = STEPS.findIndex((step) => step.id === current);
  const active = activeIndex >= 0 ? STEPS[activeIndex] : null;

  return (
    <section className="mb-6 rounded-xl border border-[#D9D4C8] bg-white p-5" aria-label="학습 콘텐츠 품질관리 진행 순서">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-[#756F64]">학습 콘텐츠 품질관리 2단계</p>
          <h2 className="mt-1 text-lg font-semibold">{active ? `현재 ${activeIndex + 1}단계 · ${active.title}` : "자동 점검부터 교수자 공개 결정까지"}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {active?.purpose ?? "자동 품질 점검으로 오류 후보를 찾고, 교수자가 감수한 뒤 최종 승인한 학습 콘텐츠만 수업에 사용합니다."}
          </p>
        </div>
        {active && (
          <div className="grid gap-1 rounded-lg bg-[#F7F4EC] px-4 py-3 text-xs text-[#5E5A52] sm:min-w-[230px]">
            <p><strong>담당:</strong> {active.owner}</p>
            <p><strong>완료 결과:</strong> {active.done}</p>
          </div>
        )}
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-2">
        {STEPS.map((step, index) => {
          const isActive = step.id === current;
          const path = preview ? step.previewPath : step.adminPath;
          return (
            <li key={step.id}>
              <Link
                to={path}
                aria-current={isActive ? "step" : undefined}
                className={`flex h-full items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  isActive
                    ? "border-[#D6AD00] bg-[#FFF6C7] font-semibold text-[#332A00]"
                    : "border-[#E5E1D8] bg-[#FCFBF8] text-[#625D54] hover:bg-[#F5F1E8]"
                }`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${isActive ? "bg-[#15202B] text-white" : "bg-[#EDE9DD]"}`}>
                  {index + 1}
                </span>
                <span>{step.short}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default ResearchWorkflowGuide;
