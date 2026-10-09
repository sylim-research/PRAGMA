import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArchiveRestore, FileDown } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";

/**
 * 「연구 기록·수업 백업」 — 연구용 기록 내보내기(기본)와 수업 편성 백업·복원을 한 메뉴의 두 탭으로 묶는다(2026-10-08).
 * 두 화면은 주소(/admin/data-backup, /admin/export)와 내용을 그대로 두고, 머리와 탭만 공유한다.
 */
const TABS = [
  { key: "export", to: "/admin/export", label: "연구용 기록 내보내기", icon: FileDown, note: "동의한 학습자의 학습 수행 기록을 가명 처리해 연구용 파일로 내려받습니다." },
  { key: "backup", to: "/admin/data-backup", label: "수업 편성 백업·복원", icon: ArchiveRestore, note: "교과목의 15주 편성과 미션 배치를 파일로 저장하고 복원합니다. 학습 수행 기록은 포함하지 않습니다." },
] as const;

export function RecordToolsShell({ active, children }: { active: (typeof TABS)[number]["key"]; children: ReactNode }) {
  const current = TABS.find((tab) => tab.key === active)!;
  return (
    <AdminShell
      title="연구 기록·수업 백업"
      description="연구에 쓸 학습 수행 기록을 내려받고, 수업 편성을 파일로 보관·복원합니다."
      compact
    >
      {/* 탭이 눌리는 버튼으로 보이게 — 테두리 있는 버튼 두 개, 고른 쪽은 남색 채움(2026-10-08). */}
      <div role="tablist" aria-label="기록 도구" className="mb-3 flex flex-wrap gap-2">
        {TABS.map(({ key, to, label, icon: Icon }) => (
          <Link
            key={key}
            to={to}
            role="tab"
            aria-selected={key === active}
            className={[
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[14.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]",
              key === active
                ? "border-[#15202B] bg-[#15202B] text-white"
                : "border-[#D8D3C4] bg-white text-[#15202B] hover:border-[#15202B] hover:bg-[#FBFAF6]",
            ].join(" ")}
          ><Icon aria-hidden className="h-4 w-4" />{label}</Link>
        ))}
      </div>
      <p className="mb-4 text-[13px] text-[#52616B]">{current.note}</p>
      {children}
    </AdminShell>
  );
}
