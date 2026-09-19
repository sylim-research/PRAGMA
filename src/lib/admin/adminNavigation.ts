export type AdminNavItem = {
  to: string;
  label: string;
  pending?: boolean;
  activePaths?: readonly string[];
};

export type AdminNavGroup = {
  header: string;
  items: readonly AdminNavItem[];
};

export const ADMIN_DASHBOARD_ITEM: AdminNavItem = {
  to: "/admin/dashboard",
  label: "PRAGMA 운영 워크플로우",
};

// 관리자 메뉴·모바일 선택기·대시보드 바로가기가 함께 쓰는 단일 정본이다.
//
// 그룹은 콘텐츠가 지나는 순서를 따른다: 생성 기준 → 미션 재료 → 미션 제작·품질 관리 →
// 수업 운영 → 기록.
//
// 1번과 3번 머리의 「기준」이 겹쳐 보이므로 가르는 규칙을 적어 둔다. 1번은 생성기가
// 소비하는 제약이고(프롬프트 계약이 생성에 들어가고 HSK가 어휘 상한을 건다), 3번의
// 「미션 설계 기준」은 사람이 읽는 구조라 아무것도 소비하지 않는다.
//
// 시나리오는 상황문과 원문만 가진 재료이고 학습 콘텐츠가 아니므로 미션과 같은 층에
// 두지 않는다 — 그룹명 「학습 미션 재료」가 그 지위를 이름으로 말한다.
//
// 3번은 같은 미션의 연속된 생애다 — 조립에서 자동 점검·AI 검토를 거쳐 교수자 승인으로
// 간다. 항목 순서가 그 순서다. 그 안에서 AI 검토와 교수자의 결정은 갈라 놓는다 —
// AI 화면에는 승인 기능이 없고, 승인은 교수자 화면에서만 일어난다.
export const ADMIN_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    header: "1. 생성 기준",
    items: [
      { to: "/admin/prompt-harness", label: "생성 계약·프롬프트" },
      { to: "/admin/corpus", label: "HSK 3.0 어휘 코퍼스" },
    ],
  },
  {
    header: "2. 학습 미션 재료",
    items: [
      { to: "/admin/authentic", label: "실제 자료 활용 분석" },
      { to: "/admin/generator", label: "시나리오 개별 생성" },
      { to: "/admin/batch", label: "시나리오 배치 생성" },
    ],
  },
  {
    // 「미션 설계 기준」 화면은 아직 없다. 만들기 전에는 죽은 항목을 두지 않고,
    // 생기면 맨 앞에 붙인다.
    header: "3. 학습 미션 제작·품질 관리",
    items: [
      { to: "/admin/assembly", label: "학습 미션 제작 현황" },
      { to: "/admin/ai-review", label: "자동 품질 점검·AI 검토" },
      {
        to: "/admin/review",
        label: "교수자 최종 승인",
        activePaths: ["/admin/research-qa/final-review", "/admin/research-qa/releases", "/admin/cross-vendor"],
      },
      { to: "/admin/library", label: "콘텐츠 현황" },
    ],
  },
  {
    header: "4. 수업 운영",
    items: [
      { to: "/admin/composer", label: "수업 편성·강의계획서", activePaths: ["/admin/data-backup"] },
      { to: "/admin/learners", label: "학습자 관리" },
    ],
  },
  {
    header: "5. 학습 기록·연구 활용",
    items: [
      { to: "/admin/decision-traces", label: "학습 수행 기록", activePaths: ["/admin/class-responses", "/admin/package", "/admin/teaching-generator"] },
      { to: "/admin/export", label: "연구 데이터 내보내기" },
    ],
  },
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

export function adminMobileNavValue(pathname: string) {
  const active = ADMIN_NAV_GROUPS.flatMap((group) => group.items)
    .find((item) => adminNavItemIsActive(item, pathname));
  if (active) return active.to;
  return pathname === ADMIN_DASHBOARD_ITEM.to ? ADMIN_DASHBOARD_ITEM.to : "";
}
