import { useNavigate } from "react-router-dom";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { COURSE_WEEKS } from "@/lib/mission/mockLearnerCourse";
import { getWeekProgress, WEEK_REQUEST } from "@/lib/mission/mockWeek";

// 개발 전용 과정 데모. 실제 학습자 수업 정본은 LearnerCourseLive다.

const CourseOverview = () => {
  const navigate = useNavigate();
  const weekProg = getWeekProgress();

  return (
    <LearnerJourneyShell nav
      headerRight={<span className="text-[12px] text-[#8899A6]">과정 데모</span>}
    >
      <div className="pb-20">
        <h2 className="text-[18px] font-bold">15주 과정 · 데모</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          고정 샘플로 학습 흐름을 확인하는 개발용 화면입니다. 실제 배정·진행 상태가 아닙니다.
        </p>
        <button
          type="button"
          onClick={() => navigate("/learner/course")}
          className="mt-4 flex w-full items-center justify-between rounded-[10px] border border-[#15202B] bg-[#15202B] px-4 py-3 text-left text-white transition-colors hover:bg-[#22303C]"
        >
          <span>
            <span className="block text-[14px] font-semibold">실제 강좌로 돌아가기</span>
            <span className="block text-[11.5px] text-[#B9C4CE]">게시·편성된 DB 강좌를 확인합니다</span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold text-[#FAD338]">→</span>
        </button>
        <ol className="mt-4 space-y-2">
          {COURSE_WEEKS.map((row) => {
            const isCurrent = row.status === "current";
            const isAssessment = row.weekType === "assessment";
            return (
              <li key={row.weekNo}>
                <button
                  type="button"
                  disabled={!isCurrent}
                  onClick={() => isCurrent && navigate(`/learner/demo/course/week/${WEEK_REQUEST.weekNo}`)}
                  className={[
                    "flex w-full items-center gap-3 rounded-[10px] border px-4 py-3 text-left",
                    isCurrent
                      ? "border-[#FAD338] bg-[#FFF8DE] hover:bg-[#FDF2C8]"
                      : isAssessment
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-[#EAE4D2] bg-white",
                    row.status === "locked" && !isAssessment ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold",
                      row.status === "done"
                        ? "bg-[#15202B] text-white"
                        : isCurrent
                          ? "bg-[#FAD338] text-[#15202B]"
                          : isAssessment
                            ? "border border-destructive/40 text-destructive"
                            : "border border-[#EAE4D2] text-muted-foreground",
                    ].join(" ")}
                  >
                    {row.status === "done" ? "✓" : row.weekNo}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium">{row.title}</span>
                    <span
                      className={[
                        "block text-[11.5px]",
                        isAssessment ? "font-medium text-destructive" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {row.stageLabel}
                    </span>
                  </span>
                  {isCurrent && (
                    <span className="shrink-0 text-[12px] font-semibold text-[#B8860B]">
                      진행 중 · {weekProg.done}/{weekProg.total} →
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </LearnerJourneyShell>
  );
};

export default CourseOverview;
