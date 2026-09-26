import { isReviewedMission } from "@/lib/curriculum/composerEligibility";

export type LibraryView = "ready" | "pending" | "missions" | "materials";
export const LIBRARY_VIEWS: { value: LibraryView; label: string }[] = [
  { value: "ready", label: "편성 가능 미션" },
  { value: "pending", label: "승인 전 미션" },
  { value: "missions", label: "전체 미션" },
  { value: "materials", label: "미션 생성 전 시나리오" },
];

export interface LibraryMissionState {
  mission_status: string | null;
  mission_schema_version: string | null;
  mission_mpj_items: unknown;
  core_content: { generation?: { content_release_id?: string } } | null;
}

export function libraryHasMission(row: LibraryMissionState): boolean {
  return Boolean(row.mission_schema_version || row.mission_status);
}

/** 편성기의 공개 범위·네이티브 MJT5 요건을 그대로 사용한다. */
export function libraryMissionIsReady(row: LibraryMissionState): boolean {
  return isReviewedMission({
    mission_status: row.mission_status,
    content_release_id: row.core_content?.generation?.content_release_id,
  }) && (row.mission_schema_version === "mission_v5" || row.mission_schema_version === "mission_v6")
    && Array.isArray(row.mission_mpj_items) && row.mission_mpj_items.length === 5;
}

export function libraryMatchesView(row: LibraryMissionState, view: LibraryView): boolean {
  if (view === "ready") return libraryMissionIsReady(row);
  if (view === "materials") return !libraryHasMission(row);
  if (view === "missions") return libraryHasMission(row);
  return libraryHasMission(row) && !["reviewed", "released"].includes(row.mission_status ?? "");
}

export function libraryMissionLabel(row: LibraryMissionState): string {
  if (!libraryHasMission(row)) return "시나리오 재료";
  if (libraryMissionIsReady(row)) return "편성 가능";
  if (["reviewed", "released"].includes(row.mission_status ?? "")) return "현재 편성 대상 아님";
  return "승인 전";
}
