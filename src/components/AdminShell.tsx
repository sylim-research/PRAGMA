import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { HomeBrand } from "@/components/HomeBrand";
import { ReviewPreparationStatus } from "@/components/admin/ReviewPreparationStatus";
import {
  ADMIN_DASHBOARD_ITEM,
  ADMIN_NAV_GROUPS,
  adminMobileNavValue,
  adminNavItemIsActive,
} from "@/lib/admin/adminNavigation";

interface AdminShellProps {
  title: string;
  description?: string;
  children?: ReactNode;
  compact?: boolean;
}

export const AdminShell = ({ title, description, children, compact = false }: AdminShellProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const mobileNavValue = adminMobileNavValue(pathname);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(
    () => new Set(ADMIN_NAV_GROUPS.map((_, index) => index)),
  );

  const toggleGroup = (groupIndex: number) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupIndex)) next.delete(groupIndex);
      else next.add(groupIndex);
      return next;
    });
  };

  const standaloneClasses = (active: boolean) =>
    [
      "ml-3 mr-2 rounded-lg py-2 pl-4 pr-3 text-[14px] font-semibold whitespace-nowrap shadow-sm transition-colors",
      active
        ? "bg-[#FAD338] text-[#15202B]"
        : "bg-[#F7F2DF] text-[#15202B] hover:bg-[#FFF1B8]",
    ].join(" ");

  const itemClasses = (active: boolean) =>
    [
      "mr-2 rounded-md px-3 py-[3px] text-[13.5px] leading-5 whitespace-nowrap transition-colors",
      active
        ? "bg-muted text-foreground font-normal"
        : "text-foreground font-normal hover:bg-muted hover:text-foreground",
    ].join(" ");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B] print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HomeBrand />
          <Link
            to="/learner/course"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[#8899A6] transition-colors hover:text-[#F1EFE8]"
          >
            학습자 수업 열기 ↗
          </Link>
        </div>
      </header>

      <div className={`flex gap-6 pl-5 pr-8 print:block print:p-0 ${compact ? "py-5" : "py-6"}`}>
        <aside className="hidden w-[285px] shrink-0 md:block print:hidden">
          <nav className="-mt-1 flex flex-col pl-6 pr-1">
            <Link
              to={ADMIN_DASHBOARD_ITEM.to}
              className={standaloneClasses(pathname === ADMIN_DASHBOARD_ITEM.to)}
            >
              {ADMIN_DASHBOARD_ITEM.label}
            </Link>

            {ADMIN_NAV_GROUPS.map((group, groupIndex) => {
              const groupActive = group.items.some((item) =>
                adminNavItemIsActive(item, pathname),
              );
              const expanded = expandedGroups.has(groupIndex);
              const groupLabel = group.header.replace(/^\d+\.\s*/, "");
              const panelId = `admin-nav-group-${groupIndex}`;

              // ml-3은 대시보드 링크와 같은 값이다 — 하위 항목의 세로선이 「운영 대시보드」 상자
              // 왼쪽 테두리와 맞아 1~4번 묶음이 그 아래에 종속돼 보인다.
              return (
                <div key={group.header} className="ml-3 mt-2 flex flex-col">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => toggleGroup(groupIndex)}
                    className={[
                      "mr-2 flex min-h-8 items-center gap-2 px-2.5 py-1.5 text-left text-[13.5px] font-semibold transition-colors",
                      groupActive
                        ? "rounded-md bg-[#15202B] text-white shadow-sm"
                        : "border-b border-[#D8D3C6] bg-transparent text-[#15202B] hover:bg-[#F2F0E8]",
                    ].join(" ")}
                  >
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FAD338] text-[11px] font-bold text-[#15202B]">
                      {groupIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{groupLabel}</span>
                    <ChevronDown
                      aria-hidden
                      className={[
                        "h-3.5 w-3.5 shrink-0 transition-transform",
                        groupActive ? "text-[#D8DEE4]" : "text-[#7D858C]",
                        expanded ? "rotate-180" : "",
                      ].join(" ")}
                    />
                  </button>
                  <div
                    id={panelId}
                    className={[
                      "mt-1 flex flex-col gap-px border-l pl-3",
                      expanded ? "" : "hidden",
                      groupActive ? "border-[#D6BC40]" : "border-[#e5e1d8]",
                    ].join(" ")}
                  >
                    {group.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={itemClasses(adminNavItemIsActive(item, pathname))}
                      >
                        {item.label}
                        {item.pending && (
                          <span className="ml-1.5 rounded-full bg-[#EDE9DD] px-1.5 py-[1px] align-middle text-[10px] font-normal text-[#8a857c]">
                            준비 중
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 print:w-full">
          <ReviewPreparationStatus />
          <div className="mb-5 print:hidden md:hidden">
            <label
              htmlFor="admin-mobile-navigation"
              className="mb-1.5 block text-[12px] font-medium text-muted-foreground"
            >
              관리자 메뉴
            </label>
            <select
              id="admin-mobile-navigation"
              value={mobileNavValue}
              onChange={(event) => {
                if (event.target.value) navigate(event.target.value);
              }}
              className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-[14px] text-foreground"
            >
              <option value="" disabled>이동할 화면 선택</option>
              <option value={ADMIN_DASHBOARD_ITEM.to}>{ADMIN_DASHBOARD_ITEM.label}</option>
              {ADMIN_NAV_GROUPS.map((group) => (
                <optgroup key={group.header} label={group.header}>
                  {group.items.map((item) => (
                    <option key={item.to} value={item.to}>
                      {item.label}{item.pending ? " · 준비 중" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex items-stretch gap-3 print:hidden">
            <span
              aria-hidden
              className="mt-1 w-[5px] shrink-0 self-stretch rounded-sm bg-[#FAD338]"
            />
            <div>
              <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          <div className="mt-6 print:mt-0">{children}</div>
        </main>
      </div>
    </div>
  );
};

export const AdminPlaceholder = ({
  title,
  description,
  note = "이 화면은 후속 단계에서 구현됩니다.",
}: {
  title: string;
  description?: string;
  note?: string;
}) => (
  <AdminShell title={title} description={description}>
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  </AdminShell>
);

export default AdminShell;
