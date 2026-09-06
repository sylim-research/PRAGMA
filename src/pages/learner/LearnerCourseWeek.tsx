import { Link, Navigate, useParams } from "react-router-dom";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";

// Keep saved links and the mission/handout return path working after merging
// week detail into the course syllabus. Authentication remains on both routes.
const LearnerCourseWeek = () => {
  const { courseId, weekNo: weekParam } = useParams<{ courseId: string; weekNo: string }>();
  const weekNo = Number(weekParam);
  if (courseId && Number.isInteger(weekNo) && weekNo >= 1 && weekNo <= 15) {
    return <Navigate to={`/learner/course/${encodeURIComponent(courseId)}?week=${weekNo}`} replace />;
  }
  return (
    <LearnerJourneyShell>
      <p className="text-sm">이 주차 계획을 찾을 수 없습니다.</p>
      <Link to="/learner/course" className="mt-3 inline-block text-sm font-bold">← 교과목 선택으로 돌아가기</Link>
    </LearnerJourneyShell>
  );
};

export default LearnerCourseWeek;
