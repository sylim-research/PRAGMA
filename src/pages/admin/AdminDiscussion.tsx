import { AdminShell } from "@/components/AdminShell";
import { ClassResponsePanel } from "@/components/admin/ClassResponsePanel";

/**
 * 메타화용 토론 — 학습자 응답 분포를 바탕으로 판단의 차이와 근거를 논의할 지점을 고르는 화면.
 * 시스템 구조도 수업 운영 4단계와 같은 이름이다(2026-10-08 연구자 확정). 옛 「학습 수행 기록 › 학습자 응답 분포」 탭을 독립 메뉴로 옮겼다.
 */
const AdminDiscussion = () => (
  <AdminShell
    title="메타화용 토론"
    description="학습자 응답 분포를 바탕으로 판단의 차이와 근거를 논의할 지점을 고릅니다."
  >
    <ClassResponsePanel />
  </AdminShell>
);

export default AdminDiscussion;
