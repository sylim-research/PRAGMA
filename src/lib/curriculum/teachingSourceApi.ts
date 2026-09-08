import type { TeachingInputSource } from "../../../supabase/functions/_shared/teachingMaterial";
export type ExtractedTeachingSource = Pick<TeachingInputSource, "text" | "extraction">;

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
    if (empty.length === pdf.numPages) throw new Error("스캔 PDF에는 추출 가능한 텍스트가 없습니다. 원본에서 확인한 본문을 텍스트 소스로 넣어 주세요.");
    const text = pages.join("\n\n");
    return { text, extraction: { method: "pdf_text", detail: `${pdf.numPages}쪽 중 ${pdf.numPages - empty.length}쪽 텍스트 추출`, extractedCharacters: text.length,
      warnings: ["PDF 텍스트만 추출했습니다. 표의 읽기 순서·도표·각주는 원본과 대조해 주세요.",
        ...(empty.length ? [`텍스트 없는 쪽: ${empty.join(", ")}. 해당 쪽의 내용은 근거에 포함되지 않습니다.`] : [])] } };
  } finally { await task.destroy(); }
}
