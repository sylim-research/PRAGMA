import { Link, useLocation, useNavigate } from "react-router-dom";
import { ProfileWizardPreview } from "@/components/ProfileWizardForm";
import { parseRepresentativeDemo, representativeDemoPath } from "@/lib/demo/representativeMissionCatalog";

export default function LearnerProfileDemo() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const demo = parseRepresentativeDemo(search);
  const returnPath = representativeDemoPath(demo.direction, demo.mode);
  return <main className="min-h-screen bg-[#F8F6EE] px-5 py-8 text-[#15202B]">
    <div className="mx-auto max-w-[640px]">
      <Link to={returnPath} className="text-sm underline underline-offset-4">대표 미션 체험으로 돌아가기</Link>
      <h1 className="mt-6 text-2xl font-bold">학습자 등록·프로필 화면</h1>
      <p className="mt-3 text-sm leading-6 text-[#536572]">실제 학습자는 Google 로그인 후 프로필을 작성합니다. 여기서는 준비된 시연용 정보로 입력 화면을 살펴볼 수 있습니다.</p>
      <p className="mb-6 mt-3 rounded-xl border border-[#DED9CD] bg-white px-4 py-3 text-sm">시연용 프로필 · 입력 내용과 동의 선택은 저장되지 않습니다.</p>
      <ProfileWizardPreview onCompleted={() => navigate(returnPath)} />
    </div>
  </main>;
}
