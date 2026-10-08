import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";

/**
 * 「기록 백업·내보내기」 — 수업 편성 백업·복원과 연구용 기록 내보내기를 한 메뉴의 두 탭으로 묶는다(2026-10-08).
 * 두 화면은 주소(/admin/data-backup, /admin/export)와 내용을 그대로 두고, 머리와 탭만 공유한다.
 */
const TABS = [
  { key: "backup", to: "/admin/data-backup", label: "수업 편성 백업·복원", note: "교과목의 15주 편성과 미션 배치를 파일로 저장하고 복원합니다. 학습 수행 기록은 포함하지 않습니다." },
  { key: "export", to: "/admin/export", label: "연구용 기록 내보내기", note: "동의한 학습자의 학습 수행 기록을 가명 처리해 연구용 파일로 내려받습니다." },
] as const;

export function RecordToolsShell({ active, children }: { active: (typeof TABS)[number]["key"]; children: ReactNode }) {
  const current = TABS.find((tab) => tab.key === active)!;
  return (
    <AdminShell
      title="기록 백업·내보내기"
      description="수업 편성을 파일로 보관·복원하고, 연구에 쓸 학습 수행 기록을 내려받습니다."
      compact
    >
      <div role="tablist" aria-label="기록 도구" className="mb-2 flex gap-1 border-b border-[#E2DED2]">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            to={tab.to}
            role="tab"
            aria-selected={tab.key === active}
            className={[
              "-mb-px border-b-2 px-4 py-2 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]",
              tab.key === active ? "border-[#15202B] font-semibold text-[#15202B]" : "border-transparent text-[#6B7780] hover:text-[#15202B]",
            ].join(" ")}
          >{tab.label}</Link>
        ))}
      </div>
      <p className="mb-4 text-[13px] text-[#52616B]">{current.note}</p>
      {children}
    </AdminShell>
  );
}
