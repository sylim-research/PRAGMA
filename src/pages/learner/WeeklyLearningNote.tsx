import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { WeeklyMaterialDocument } from "@/components/curriculum/WeeklyMaterialDocument";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";
import { getApprovedWeeklyMaterial } from "@/lib/pragma/contentReviewApi";

// 기존 /note 주소를 유지한다. 승인된 공개 스냅샷만 읽고 수행 기록은 수정하지 않는다.
const WeeklyLearningNote = (_props: { allowSample?: boolean }) => {
  const { courseId, weekNo: weekParam } = useParams();
  const { data: course, error, isPending } = useLearnerCourse(courseId);
  const week = course?.weeks.find((item) => item.week_no === Number(weekParam));
  const materialQuery = useQuery({
    queryKey: ["approved-weekly-material", course?.outline.id, week?.week_no],
    queryFn: () => getApprovedWeeklyMaterial(course!.outline.id, week!.week_no),
    enabled: Boolean(course && week), retry: false,
  });
  const coursePath = course ? `/learner/course/${course.outline.id}` : "/learner/course";

  return (
    <LearnerJourneyShell headerRight={<span className="text-xs text-[#B9C4CE]">이번 주 수업자료</span>}>
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <Link to={week ? `${coursePath}/week/${week.week_no}` : coursePath} className="text-sm">
          ← {week ? "주차로 돌아가기" : "교과목 선택"}
        </Link>
        {materialQuery.data && <button onClick={() => window.print()} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold">
          인쇄·PDF
        </button>}
      </div>
      {isPending ? <p role="status">수업자료를 불러오는 중…</p>
        : error ? <p role="alert">수업자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        : !course || !week ? <p>이 주차의 수업자료를 찾을 수 없습니다.</p>
        : materialQuery.isPending ? <p role="status">승인된 수업자료를 확인하는 중…</p>
        : materialQuery.isError ? <p role="alert">승인된 수업자료를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        : !materialQuery.data ? <p role="status">이번 주 수업자료는 교수자 검수 후 공개됩니다. 학습 미션과 수행 기록은 주차 화면에서 이용할 수 있습니다.</p>
        : <>
          <WeeklyMaterialDocument material={materialQuery.data.material} />
          <p className="mt-5 text-xs leading-5 text-muted-foreground">
            교수자가 확정한 주차 자료입니다. 개인 답안과 피드백은 웹앱 수행 기록에서 확인합니다.
          </p>
        </>}
    </LearnerJourneyShell>
  );
};

export default WeeklyLearningNote;
