// 「실제 자료 활용」 — /admin/authentic (2026-07-30 승격, 사용자 결정).
// 이전에는 개별 생성 화면의 접이식 패널이었으나, 자료 입력→추출→AI 해석→후보 비교→
// 생성기 채우기의 완결된 저작 워크플로우라 독립 화면으로 분리했다.
// 생성 로직은 복제하지 않는다 — 후보 선택 시 페이로드를 sessionStorage로 넘기고
// /admin/generator가 기존 applyAuthentic 경로로 소비한다.

import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import AuthenticImportPanel, {
  AUTHENTIC_HANDOFF_KEY,
  type AuthenticApply,
} from "./AuthenticImportPanel";

const AdminAuthentic = () => {
  const navigate = useNavigate();

  const handleApply = (a: AuthenticApply) => {
    try {
      sessionStorage.setItem(AUTHENTIC_HANDOFF_KEY, JSON.stringify(a));
    } catch {
      // sessionStorage 실패(프라이빗 모드 등) — 전달 없이 생성기만 연다.
    }
    navigate("/admin/generator?from=authentic");
  };

  return (
    <AdminShell
      title="원자료 분석·미션 재료"
      description="실제 자료의 확정 원문과 AI 변형을 구분해 확인하고, 교수자가 선택한 근거만 시나리오 생성기로 전달합니다."
    >
      {/* 4단계 제작 흐름 — 이 화면은 입력 폼이 아니라 변환 파이프라인이다 */}
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[#EAE4D2] bg-white px-4 py-2.5 text-[12px]">
        {["원자료 가져오기", "추출 문구 확인", "활용 방향 분석", "근거 확인·후보 선택"].map((step, i) => (
          <span key={step} className="flex items-center gap-2">
            {i > 0 && <span className="text-[#C9C2B2]">→</span>}
            <span className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FAD338] text-[10.5px] font-bold text-[#1d2336]">
                {i + 1}
              </span>
              <span className="text-[#5B5446]">{step}</span>
            </span>
          </span>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          교수자 후보 선택 → 근거와 함께 생성기로 단일 전달
        </span>
      </div>
      <div className="mt-4">
        <AuthenticImportPanel onApply={handleApply} />
      </div>
    </AdminShell>
  );
};

export default AdminAuthentic;
