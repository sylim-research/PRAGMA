import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { HomeBrand } from "@/components/HomeBrand";
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
  /** 제목을 화면에서 숨기고 보조기기용 제목으로만 남긴다(사이드바에 같은 이름이 있는 홈 화면용). */
  hideTitle?: boolean;
}

export const AdminShell = ({ title, description, children, compact = false, hideTitle = false }: AdminShellProps) => {
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
      "ml-3 mr-2 rounded-lg py-2 pl-4 pr-3 text-[14.5px] font-semibold whitespace-nowrap shadow-sm transition-colors",
      active
        ? "bg-[#FAD338] text-[#15202B]"
        : "bg-[#F7F2DF] text-[#15202B] hover:bg-[#FFF1B8]",
    ].join(" ");

  const itemClasses = (active: boolean) =>
    [
      "mr-2 rounded-md px-3 py-[2.5px] text-[13.5px] leading-5 whitespace-nowrap transition-colors",
      active
        ? "bg-muted text-foreground font-normal"
        : "text-foreground font-normal hover:bg-muted hover:text-foreground",
    ].join(" ");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B] print:hidden">
        {/* 본문과 같은 좌우 여백을 쓴다 — 로고가 사이드바 「운영 워크플로우」 상자 왼쪽 선과, 오른쪽 링크가 본문 오른쪽 끝과 맞는다. */}
        <div className="mx-auto flex max-w-[1553px] items-center justify-between px-5 py-4 md:pr-6">
          <div className="md:pl-9">
            <HomeBrand />
          </div>
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

      {/* 관리자 화면 폭 기준 하나: 사이드바 285 + 간격 24 + 본문 최대 1,200px. 넓은 모니터에서는 가운데 정렬한다. */}
      <div className={`mx-auto flex max-w-[1553px] gap-6 px-5 md:pr-6 print:block print:p-0 ${compact ? "py-5" : "py-6"}`}>
        <aside className="hidden w-[285px] shrink-0 md:sticky md:top-20 md:block md:max-h-[calc(100dvh-5rem)] md:-mt-2 md:self-start md:overflow-y-auto print:hidden">
          <nav className="flex flex-col pb-1 pl-6 pr-1 pt-1">
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
                      "mr-2 flex min-h-8 items-center gap-2 px-2.5 py-1.5 text-left text-[14px] font-semibold transition-colors",
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

          <div className={hideTitle ? "sr-only" : "flex items-stretch gap-3 print:hidden"}>
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
          <div className={`${description ? "mt-5" : "mt-3"} print:mt-0`}>{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AdminShell;
