import { supabase } from "@/integrations/supabase/client";
import { validateTeachingContent, type TeachingConfig, type TeachingContent, type TeachingDraft } from "../../../supabase/functions/_shared/teachingMaterial";
export type TeachingState = { draft: TeachingDraft | null; current: boolean };
export interface TeachingPreview {
  system: string; user: string; inputHash: string; sourceHash: string;
  model: string; promptVersion: string; characters: number;
  sources: Array<{ id: string; label: string; characters: number }>;
}
export async function getTeachingState(courseId: string, weekNo: number): Promise<TeachingState> {
  const { data, error } = await (supabase as any).rpc("get_teaching_material_state", { p_outline_id: courseId, p_week_no: weekNo });
  if (error) throw new Error("생성 자료를 불러오지 못했습니다. 서비스 연결 상태를 확인해 주세요.");
  if (!data || typeof data.current !== "boolean") throw new Error("자료 응답을 확인하지 못했습니다.");
  if (data.draft) {
    if (data.draft.outline_id !== courseId || data.draft.week_no !== weekNo
      || !["lesson", "discussion"].includes(data.draft.kind) || !Array.isArray(data.draft.sources)) throw new Error("자료의 대상과 구성을 확인해 주세요.");
    validateTeachingContent(data.draft.content, data.draft.kind, data.draft.sources.map((source: { id: string }) => source.id));
  }
  return data;
}
export async function teachingRequest<T extends TeachingState | TeachingPreview>(input: {
  action: "preview" | "generate" | "edit"; courseId: string; weekNo: number;
  expectedRevision: number; config?: TeachingConfig; inputHash?: string; content?: TeachingContent;
}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("teaching-materials", { body: input });
  if (error) {
    let message = "자료 생성 서비스를 사용할 수 없습니다. 새로고침해 저장 여부를 확인한 뒤 다시 시도해 주세요.";
    if (error.context instanceof Response) {
      try { message = (await error.context.json())?.error || message; } catch { /* transport failure */ }
    }
    throw new Error(message);
  }
  if (data?.error || !data) throw new Error(data?.error ?? "자료 응답을 확인하지 못했습니다.");
  return data as T;
}
