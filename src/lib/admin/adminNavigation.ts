export type AdminNavItem = {
  to: string;
  label: string;
  pending?: boolean;
  activePaths?: readonly string[];
  /** 그룹이 좁은 폭이어도 이 화면만 넓은 폭을 쓴다. */
};

export type AdminNavGroup = {
  header: string;
  items: readonly AdminNavItem[];
};

export const ADMIN_DASHBOARD_ITEM: AdminNavItem = {
  to: "/admin/dashboard",
  label: "PRAGMA 대시보드",
};

// 제작 기준 → 재료 → 제작·승인 → 수업 운영 순서로 모든 그룹을 기본 펼침한다.
// 기존 경로와 권한은 유지한다.
export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  { header: "1. 콘텐츠 제작 기준", items: [
    { to: "/admin/prompt-harness", label: "생성계약·운영 프롬프트" },
  ]},
  { header: "2. 시나리오 생성", items: [
    { to: "/admin/authentic", label: "실제 자료 활용 분석" },
    { to: "/admin/generator", label: "시나리오 개별 생성" },
    { to: "/admin/batch", label: "시나리오 배치 생성" },
  ]},
  { header: "3. 학습 미션 제작·승인", items: [
    { to: "/admin/assembly", label: "학습 미션 제작" },
    // HSK 대조는 미션 생성 직후 자동으로 남는 참고 기록이다 — 제작 기준·생성계약과 같은 층위가 아니다(2026-09-27 정본).
    // 화면 폭은 옮기기 전과 같게 둔다.
    { to: "/admin/ai-review", label: "자동 품질 점검·AI 검토" },
    { to: "/admin/corpus", label: "HSK 3.0 어휘 대조" },
    // 제작·승인 묶음은 교수자 최종 승인으로 끝난다. 승인된 미션을 고르는 라이브러리는 수업 운영의 첫 단계다.
    { to: "/admin/review", label: "교수자 감수·최종 승인", activePaths: ["/admin/research-qa/final-review", "/admin/research-qa/releases", "/admin/cross-vendor"] },
  ]},
  { header: "4. 수업 운영", items: [
    { to: "/admin/library", label: "학습 미션 관리" },
    { to: "/admin/composer/new", label: "신규 교과목 개설" },
    { to: "/admin/composer", label: "주차별 미션 배치" },
    // 학습 수행 기록(/admin/decision-traces)은 학습자 관리처럼 메뉴에 두지 않는다 — 대시보드 카드·시스템 구조도 링크로 연다(2026-10-08).
    { to: "/admin/discussion", label: "메타화용 토론", activePaths: ["/admin/class-responses", "/admin/package", "/admin/teaching-generator"] },
  ]},
  { header: "5. 관리 도구", items: [
    { to: "/admin/export", label: "연구 기록·편성 백업", activePaths: ["/admin/data-backup"] },
  ]},
] as const;

const PRIORITY_PATHS = [
  "/admin/review",
  "/admin/composer",
  "/admin/library",
  "/admin/discussion",
  "/admin/export",
] as const;

const ALL_ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
export const ADMIN_PRIORITY_LINKS = PRIORITY_PATHS.map((path) => {
  const item = ALL_ADMIN_NAV_ITEMS.find((candidate) => candidate.to === path);
  if (!item) throw new Error(`Missing required admin navigation item: ${path}`);
  return item;
});

export function adminNavItemIsActive(item: AdminNavItem, pathname: string) {
  return item.to === pathname || item.activePaths?.includes(pathname) === true;
}

// 메뉴 순서가 바뀌어도 기존 시나리오·검토 화면의 폭을 유지한다.
export function adminMobileNavValue(pathname: string) {
  const active = ADMIN_NAV_GROUPS.flatMap((group) => group.items)
    .find((item) => adminNavItemIsActive(item, pathname));
  if (active) return active.to;
  return pathname === ADMIN_DASHBOARD_ITEM.to ? ADMIN_DASHBOARD_ITEM.to : "";
}
