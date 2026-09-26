export type AdminNavItem = {
  to: string;
  label: string;
  pending?: boolean;
  activePaths?: readonly string[];
  /** 그룹이 좁은 폭이어도 이 화면만 넓은 폭을 쓴다. */
  wideCanvas?: boolean;
};

export type AdminNavGroup = {
  header: string;
  wideCanvas?: boolean;
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
    { to: "/admin/prompt-harness", label: "생성 계약·프롬프트" },
    { to: "/admin/corpus", label: "HSK 3.0 어휘 참조" },
  ]},
  { header: "2. 시나리오 생성", wideCanvas: true, items: [
    { to: "/admin/authentic", label: "실제 자료 활용 분석" },
    { to: "/admin/generator", label: "시나리오 개별 생성" },
    { to: "/admin/batch", label: "시나리오 배치 생성" },
  ]},
  { header: "3. 학습 미션 제작·승인", wideCanvas: true, items: [
    { to: "/admin/assembly", label: "학습 미션 제작" },
    { to: "/admin/ai-review", label: "자동 품질 점검·AI 검토" },
    // 제작·승인 묶음은 교수자 최종 승인으로 끝난다. 승인된 미션을 고르는 라이브러리는 수업 운영의 첫 단계다.
    { to: "/admin/review", label: "교수자 최종 승인", activePaths: ["/admin/research-qa/final-review", "/admin/research-qa/releases", "/admin/cross-vendor"] },
  ]},
  { header: "4. 수업 운영", items: [
    // 학습 미션 라이브러리(/admin/library)는 메뉴에서 뺐다(2026-09-26 연구자 결정). 화면·주소는 남아 있다.
    { to: "/admin/composer/new", label: "새 교과목 개설" },
    { to: "/admin/composer", label: "15주 수업 편성" },
    { to: "/admin/decision-traces", label: "학습 수행 기록", activePaths: ["/admin/class-responses", "/admin/package", "/admin/teaching-generator"] },
  ]},
  { header: "5. 관리 도구", items: [
    { to: "/admin/learners", label: "학습자 관리" },
    { to: "/admin/data-backup", label: "수업 데이터 백업·복원" },
    { to: "/admin/export", label: "연구 데이터 내보내기" },
  ]},
] as const;

const PRIORITY_PATHS = [
  "/admin/review",
  "/admin/composer",
  "/admin/learners",
  "/admin/decision-traces",
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
const WIDE_CANVAS_PATHS = ADMIN_NAV_GROUPS
  .flatMap((group) => group.items.filter((item) => group.wideCanvas || ("wideCanvas" in item && item.wideCanvas)))
  .flatMap((item) => [item.to, ...(item.activePaths ?? [])]);

export function adminUsesWideCanvas(pathname: string) {
  return WIDE_CANVAS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function adminMobileNavValue(pathname: string) {
  const active = ADMIN_NAV_GROUPS.flatMap((group) => group.items)
    .find((item) => adminNavItemIsActive(item, pathname));
  if (active) return active.to;
  return pathname === ADMIN_DASHBOARD_ITEM.to ? ADMIN_DASHBOARD_ITEM.to : "";
}
