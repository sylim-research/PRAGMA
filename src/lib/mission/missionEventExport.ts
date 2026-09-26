import { supabase } from "@/integrations/supabase/client";

export type MissionEventExportFormat = "json" | "jsonl";
export type MissionEventExportRow = Record<string, unknown>;

const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (
    f: string,
    a: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>)(fn, args);

export async function fetchMissionEventExport(args: {
  from?: string | null;
  to?: string | null;
}): Promise<MissionEventExportRow[]> {
  const { data, error } = await rpc("export_learner_mission_events", {
    p_from: args.from || null,
    p_to: args.to || null,
  });
  if (error) throw new Error(error.message ?? "연구용 기록 내보내기 실패");
  if (!Array.isArray(data)) throw new Error("연구 데이터 응답 형식이 배열이 아닙니다.");
  return data.filter(
    (row): row is MissionEventExportRow => !!row && typeof row === "object" && !Array.isArray(row),
  );
}

export function serializeMissionEventExport(
  rows: MissionEventExportRow[],
  format: MissionEventExportFormat,
): string {
  return format === "jsonl"
    ? rows.map((row) => JSON.stringify(row)).join("\n")
    : JSON.stringify(rows, null, 2);
}

export function missionEventExportFilename(
  format: MissionEventExportFormat,
  now = new Date(),
): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `pragma_mission_events_v1_${stamp}.${format}`;
}

export function downloadMissionEventExport(
  rows: MissionEventExportRow[],
  format: MissionEventExportFormat,
): void {
  const text = serializeMissionEventExport(rows, format);
  const blob = new Blob([text], { type: format === "jsonl" ? "application/x-ndjson" : "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = missionEventExportFilename(format);
  anchor.click();
  URL.revokeObjectURL(url);
}

