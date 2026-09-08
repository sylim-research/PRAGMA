import { supabase } from "@/integrations/supabase/client";
import type { TeachingInputSource } from "../../../supabase/functions/_shared/teachingMaterial";
import { teachingYoutubeUrl } from "../../../supabase/functions/_shared/teachingSourceInput";
export { teachingYoutubeUrl };
export type ExtractedTeachingSource = Pick<TeachingInputSource, "text" | "extraction">;

export async function extractTeachingSource(kind: "image" | "audio", input: File): Promise<ExtractedTeachingSource> {
  const body = new FormData(); body.append("kind", kind); body.append("file", input);
  const { data, error } = await supabase.functions.invoke("teaching-sources", { body });
  if (error) {
    let message = "소스 추출 서비스를 확인해 주세요. 확인한 본문을 직접 입력할 수 있습니다.";
    if (error.context instanceof Response) { try { message = (await error.context.json()).error ?? message; } catch { /* network */ } }
    throw new Error(message);
  }
  if (data?.error || typeof data?.text !== "string" || !data.extraction) throw new Error(data?.error ?? "원문 응답이 올바르지 않습니다.");
  return data;
}

/** PDF stays in the browser; only teacher-confirmed text is sent when generating. */
export async function extractTeachingPdf(file: File): Promise<ExtractedTeachingSource> {
  if (file.size > 20 * 1024 * 1024) throw new Error("PDF는 20MB까지 읽을 수 있습니다. 필요한 부분만 나누어 올려 주세요.");
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error("PDF는 100쪽까지 읽습니다. 사용할 쪽을 나누어 올려 주세요.");
    const pages: string[] = []; const empty: number[] = []; let size = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n); const content = await page.getTextContent();
      const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").trim();
      if (!text) empty.push(n);
      const section = `[PDF ${n}쪽]\n${text || "[추출 가능한 텍스트 없음]"}`;
      size += section.length + (n > 1 ? 2 : 0); if (size > 60000) throw new Error("추출 본문이 60,000자를 넘습니다. 필요한 쪽만 나누어 올려 주세요. 일부만 잘라 사용하지 않았습니다.");
      pages.push(section); page.cleanup();
    }
    if (empty.length === pdf.numPages) throw new Error("스캔 PDF에는 추출 가능한 텍스트가 없습니다. 필요한 쪽을 이미지로 올려 문자 인식을 실행해 주세요.");
    const text = pages.join("\n\n");
    return { text, extraction: { method: "pdf_text", detail: `${pdf.numPages}쪽 중 ${pdf.numPages - empty.length}쪽 텍스트 추출`, extractedCharacters: text.length,
      warnings: ["PDF 텍스트만 추출했습니다. 표의 읽기 순서·도표·각주는 원본과 대조해 주세요.",
        ...(empty.length ? [`텍스트 없는 쪽: ${empty.join(", ")}. 해당 쪽의 내용은 근거에 포함되지 않습니다.`] : [])] } };
  } finally { await task.destroy(); }
}
