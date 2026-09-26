import { DIRECTION_LABEL, LEVEL, MODE_LABEL, SPEECH_ACT_UI } from "@/lib/pragma/enums";
import { excludeSupersededRows, isComposerReadyMission, isGeneratedMission, type DashboardScenarioRow } from "./adminDashboardMetrics";

/** Read actual stored items, not mission count × the current five-item contract. */
export const DASHBOARD_SCENARIO_SELECT = [
  "scenario_id,supersedes_scenario_id,content_format,review_status,mission_status,updated_at,speech_act,learner_level,mode",
  "mission_schema_version:mission_content->>schema_version,authoring_stage:mission_content->authoring->>stage",
  "content_release_id:core_content->generation->>content_release_id,direction:core_content->>direction",
  "mission_mpj_items:mission_content->mpj_items,production_task_source:mission_content->production_task->>source_text",
].join(",");

export type ResourceDimension = "speech_act" | "learner_level" | "direction" | "mode";
export type ResourceScope = "all" | "ready";

export const RESOURCE_DIMENSIONS: { key: ResourceDimension; title: string; labels: Record<string, string>; query: string }[] = [
  { key: "speech_act", title: "화행별", labels: SPEECH_ACT_UI, query: "act" },
  { key: "learner_level", title: "수준별", labels: LEVEL, query: "level" },
  { key: "direction", title: "언어 방향별", labels: DIRECTION_LABEL, query: "direction" },
  { key: "mode", title: "수행 방식별", labels: MODE_LABEL, query: "mode" },
];

function summarizeResources(rows: readonly DashboardScenarioRow[]) {
  const counts: Record<ResourceDimension, Record<string, number>> = {
    speech_act: {}, learner_level: {}, direction: {}, mode: {},
  };
  let judgmentCount = 0;
  let productionCount = 0;
  let incompleteCount = 0;
  for (const row of rows) {
    const items = Array.isArray(row.mission_mpj_items) ? row.mission_mpj_items : [];
    const storedItems = items.filter(item => item && typeof item === "object" && typeof item.type === "string" && item.type.trim());
    const hasProduction = typeof row.production_task_source === "string" && row.production_task_source.trim().length > 0;
    judgmentCount += storedItems.length;
    productionCount += Number(hasProduction);
    if (!Array.isArray(row.mission_mpj_items) || !storedItems.length || storedItems.length !== items.length || !hasProduction) incompleteCount++;
    for (const { key } of RESOURCE_DIMENSIONS) {
      // Same legacy direction default as coreDirection() in the library.
      const value = key === "direction" ? (row.direction === "zh_ko" ? "zh_ko" : "ko_zh") : row[key] || "unknown";
      counts[key][value] = (counts[key][value] ?? 0) + 1;
    }
  }
  return { missionCount: rows.length, judgmentCount, productionCount, incompleteCount, counts };
}

export function summarizeDashboardResources(rows: readonly DashboardScenarioRow[]) {
  const missions = excludeSupersededRows(rows).filter(isGeneratedMission);
  return {
    all: summarizeResources(missions),
    ready: summarizeResources(missions.filter(isComposerReadyMission)),
  };
}

export type DashboardResources = ReturnType<typeof summarizeDashboardResources>;

/** 대시보드 숫자 → 학습 미션 제작 화면(같은 조건으로 거른 목록). 라이브러리는 메뉴에서 뺐다(2026-09-26). */
export function resourceAssemblyHref(scope: ResourceScope, dimension?: ResourceDimension, value?: string) {
  const params = new URLSearchParams({ state: scope === "ready" ? "v6_done" : "all" });
  const definition = RESOURCE_DIMENSIONS.find(item => item.key === dimension);
  if (definition && value) params.set(definition.query, value);
  return `/admin/assembly?${params}`;
}

export function resourceLibraryHref(scope: ResourceScope, dimension?: ResourceDimension, value?: string) {
  const params = new URLSearchParams({ view: scope === "ready" ? "ready" : "missions", current: "1" });
  const definition = RESOURCE_DIMENSIONS.find(item => item.key === dimension);
  if (definition && value) params.set(definition.query, value);
  return `/admin/library?${params}`;
}
