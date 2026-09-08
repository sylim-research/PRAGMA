import { useState } from "react";
import { FileText, Type, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractTeachingPdf } from "@/lib/curriculum/teachingSourceApi";
import type { TeachingInputKind, TeachingInputSource } from "../../../supabase/functions/_shared/teachingMaterial";

const kinds = [{ id: "pdf", label: "PDF", Icon: FileText }, { id: "text", label: "텍스트·전사문", Icon: Type }] as const;
const field = "mt-1 w-full min-w-0 rounded-lg border bg-white p-2.5 text-sm leading-6";
const emptySource = (kind: TeachingInputKind, label: string, ref = ""): TeachingInputSource => ({ id: `S${crypto.randomUUID().slice(0,8)}`,
  kind, label, ref, text: "", confirmed: false, extraction: { method: "manual_text", detail: "직접 입력", extractedCharacters: 0, warnings: [] } });

export function TeachingSourceCollection({ sources, selected, onChange, onSelected, disabled, onBusy }: {
  sources: TeachingInputSource[]; selected: string[]; onChange: (sources: TeachingInputSource[]) => void;
  onSelected: (ids: string[]) => void; disabled: boolean; onBusy: (busy: boolean) => void;
}) {
  const [kind, setKind] = useState<TeachingInputKind>("pdf");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const update = (id: string, change: Partial<TeachingInputSource>) => onChange(sources.map(s => s.id === id ? { ...s, ...change } : s));
  const add = (source: TeachingInputSource) => { onChange([...sources, source]); onSelected([...selected, source.id]); setOpen(source.id); };
  const importFiles = async (files: File[]) => {
    if (sources.length + files.length > 6) { setError("한 번에 보관할 소스는 6개까지입니다."); return; }
    setBusy(true); onBusy(true); setError(""); const added: TeachingInputSource[] = []; const failures: string[] = [];
    for (const file of files) {
      try {
        const base = emptySource(kind, file.name, file.name);
        const result = await extractTeachingPdf(file);
        added.push({ ...base, ...result });
      } catch (cause) { failures.push(`${file.name}: ${cause instanceof Error ? cause.message : "추출 실패"}`); }
    }
    if (added.length) { onChange([...sources, ...added]); onSelected([...selected, ...added.map(s => s.id)]); setOpen(added[0].id); }
    setError(failures.join("\n")); setBusy(false); onBusy(false);
  };
  const locked = disabled || busy;
  return <section aria-label="근거 소스" className="min-w-0 rounded-2xl border bg-white p-4 sm:p-5">
    <h2 className="text-lg font-bold">1. 근거 소스</h2>
    <p className="mt-1 text-sm leading-6 text-muted-foreground">수업에 사용할 원문을 넣고, 추출 내용과 출처를 확인하세요.</p>
    <fieldset disabled={locked} className="mt-4 min-w-0">
      <legend className="sr-only">소스 추가</legend>
      <div className="grid grid-cols-2 gap-2">{kinds.map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={kind === id}
        onClick={() => { setKind(id); setError(""); }} className={`flex min-w-0 flex-col items-center gap-1.5 rounded-lg border px-1 py-3 text-xs font-semibold ${kind === id ? "border-[#D3BC50] bg-[#FFF5CD]" : "border-transparent bg-[#F5F6F7] hover:bg-[#EBEEF0]"}`}>
        <Icon size={18} aria-hidden="true" />{label}</button>)}</div>
      <div className="mt-3 rounded-xl border border-dashed bg-[#FAFAF8] p-3">
        {kind === "text" ? <div><Button variant="outline" disabled={sources.length >= 6} onClick={() => add(emptySource("text", "새 텍스트 자료"))}><Plus size={15} className="mr-2" />텍스트 소스 추가</Button>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">직접 입력한 원문이나 확인한 영상·음성 전사문을 출처와 함께 넣으세요. 링크만으로 내용을 읽지는 않습니다.</p></div>
          : <label className="block text-sm font-semibold">논문·교재 PDF 선택
            <input aria-label={`${kind} 파일`} type="file" multiple disabled={sources.length >= 6} className="mt-3 block w-full min-w-0 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-[#EAE6D6] file:px-3 file:py-2"
              accept="application/pdf,.pdf"
              onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void importFiles(files); }} />
            <span className="mt-2 block text-xs font-normal leading-5 text-muted-foreground">20MB·100쪽까지. PDF는 브라우저에서 읽습니다. 스캔본은 확인한 본문을 텍스트로 넣어 주세요.</span></label>}
      </div>
    </fieldset>
    {busy && <p role="status" className="mt-3 text-sm">원문을 읽고 있습니다…</p>}
    {error && <p role="alert" className="mt-3 whitespace-pre-wrap text-sm text-destructive">{error}</p>}
    <div className="mt-5 flex items-center justify-between text-sm"><strong>소스 목록 · {sources.length}/6</strong><span className="text-muted-foreground">선택 {selected.length}개</span></div>
    {!sources.length && <p className="py-8 text-center text-sm leading-6 text-muted-foreground">논문, 발화 사례, 교재 등<br />이번 수업의 근거가 될 자료를 추가하세요.</p>}
    <fieldset disabled={locked} className="mt-3 space-y-3 min-w-0"><legend className="sr-only">등록한 소스 확인</legend>
      {sources.map(source => <div key={source.id} className="min-w-0 rounded-xl border p-3">
        <div className="flex items-start gap-2"><input type="checkbox" aria-label={`${source.label} 사용`} className="mt-1" checked={selected.includes(source.id)}
          onChange={e => onSelected(e.target.checked ? [...selected, source.id] : selected.filter(id => id !== source.id))} />
          <button type="button" className="min-w-0 flex-1 text-left" aria-expanded={open === source.id} onClick={() => setOpen(open === source.id ? null : source.id)}>
            <span className="block break-words text-sm font-semibold">{source.label}</span><span className={`mt-1 block text-xs ${source.confirmed ? "text-emerald-700" : "text-amber-800"}`}>{source.confirmed ? "원문 확인됨" : "원문 확인 필요"} · {source.text.length.toLocaleString()}자</span></button>
          <button type="button" aria-label={`${source.label} 삭제`} className="p-1 text-muted-foreground" onClick={() => { onChange(sources.filter(s => s.id !== source.id)); onSelected(selected.filter(id => id !== source.id)); }}><Trash2 size={16} /></button></div>
        {open === source.id && <div className="mt-3 space-y-3">
          <label className="block text-xs font-semibold">자료 제목<input className={field} maxLength={160} value={source.label} onChange={e => update(source.id, { label: e.target.value, confirmed: false })} /></label>
          <label className="block text-xs font-semibold">출처 · 저자·연도·쪽수 또는 주소<input className={field} maxLength={500} value={source.ref} onChange={e => update(source.id, { ref: e.target.value, confirmed: false })} /></label>
          {source.extraction.warnings.map(w => <p key={w} className="text-xs leading-5 text-amber-900">{w}</p>)}
          <label className="block text-xs font-semibold">생성에 사용할 원문<textarea className={field} rows={10} value={source.text} onChange={e => update(source.id, { text: e.target.value, confirmed: false })} /></label>
          <p className="text-xs leading-5 text-muted-foreground">{source.extraction.detail} · {source.extraction.method.startsWith("manual") ? "" : `최초 추출 ${source.extraction.extractedCharacters.toLocaleString()}자 / `}사용 본문 {source.text.length.toLocaleString()}자. 필요한 범위를 직접 편집할 수 있습니다.</p>
          <Button size="sm" variant={source.confirmed ? "outline" : "default"} disabled={!source.text.trim() || !source.label.trim() || !source.ref.trim() || source.text.length > 60000}
            onClick={() => { update(source.id, { confirmed: true }); setOpen(null); }}><CheckCircle2 size={15} className="mr-2" />원문·출처 확인 완료</Button>
        </div>}
      </div>)}
    </fieldset>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">선택한 본문 합계 {sources.filter(s => selected.includes(s.id)).reduce((sum,s) => sum+s.text.length,0).toLocaleString()} / 60,000자 · 파일 종류나 출처 표시만으로 신뢰성이 보장되지는 않습니다.</p>
  </section>;
}
