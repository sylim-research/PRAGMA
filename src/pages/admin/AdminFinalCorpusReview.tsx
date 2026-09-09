import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import AdminShell from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type RunRow = { id: string; target_count: number; created_at: string };
type LineageRow = {
  id: string;
  version_no: number;
  scenario_id: string;
  mission_content: Record<string, unknown>;
  validation_result: Record<string, unknown>;
  ai_quality_result: Record<string, unknown>;
};
type ScenarioRow = { scenario_id: string; speech_act: string; generation_item_key: string; mission_status: string };
type ReviewRow = { id: string; lineage_version_id: string; verdict: "approve" | "revise" | "reject"; automated_warning: boolean; attention_mode: string; review_duration_seconds: number; reviewed_at: string };
type ReviewItem = ScenarioRow & { lineage: LineageRow | null; review: ReviewRow | null; warning: boolean; hskCandidateCount: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any; rpc: (name: string, args?: Record<string, unknown>) => any };

const PREVIEW_ITEMS: ReviewItem[] = [
  { scenario_id: "10000000-0000-4000-8000-000000000081", speech_act: "request", generation_item_key: "request-001", mission_status: "reviewed", warning: false, hskCandidateCount: 0, review: { id: "r1", lineage_version_id: "l1", verdict: "approve", automated_warning: false, attention_mode: "automated_pass_confirmation", review_duration_seconds: 22, reviewed_at: "2026-08-15T00:00:00Z" }, lineage: { id: "l1", version_no: 2, scenario_id: "10000000-0000-4000-8000-000000000081", mission_content: { title: "업무 일정 조정 요청" }, validation_result: { result: "pass" }, ai_quality_result: { verdict: "pass" } } },
  { scenario_id: "10000000-0000-4000-8000-000000000082", speech_act: "refusal", generation_item_key: "refusal-001", mission_status: "reviewed", warning: true, hskCandidateCount: 2, review: null, lineage: { id: "l2", version_no: 2, scenario_id: "10000000-0000-4000-8000-000000000082", mission_content: { title: "공식 초대 거절", hsk_lexical_audit: { out_of_reference_candidates: ["协商", "改期"] } }, validation_result: { result: "warning" }, ai_quality_result: { verdict: "warning" } } },
  { scenario_id: "10000000-0000-4000-8000-000000000083", speech_act: "thanks", generation_item_key: "thanks-001", mission_status: "reviewed", warning: false, hskCandidateCount: 0, review: null, lineage: { id: "l3", version_no: 2, scenario_id: "10000000-0000-4000-8000-000000000083", mission_content: { title: "협조에 대한 감사" }, validation_result: { result: "pass" }, ai_quality_result: { verdict: "pass" } } },
];

const stringify = (value: unknown) => JSON.stringify(value, null, 2);

const AdminFinalCorpusReview = ({ preview = false }: { preview?: boolean }) => {
  const [searchParams] = useSearchParams();
  const [runs, setRuns] = useState<RunRow[]>(preview ? [{ id: "preview-run", target_count: 504, created_at: "2026-08-15T00:00:00Z" }] : []);
  const [runId, setRunId] = useState(preview ? "preview-run" : "");
  const [items, setItems] = useState<ReviewItem[]>(preview ? PREVIEW_ITEMS : []);
  const [filter, setFilter] = useState<"pending" | "warning" | "all">(
    searchParams.get("focus") === "hsk" ? "warning" : "pending",
  );
  const [selectedId, setSelectedId] = useState(preview ? PREVIEW_ITEMS[1].scenario_id : "");
  const [reviewStartedAt, setReviewStartedAt] = useState(() => new Date().toISOString());
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(!preview);

  const loadRuns = useCallback(async () => {
    if (preview) return;
    const { data, error } = await db.from("pragma_final_corpus_generation_runs").select("id,target_count,created_at").order("created_at", { ascending: false });
    if (error) { setMessage(error.message); return; }
    const rows = (data ?? []) as RunRow[];
    setRuns(rows);
    setRunId((current) => current || rows[0]?.id || "");
  }, [preview]);

  const loadItems = useCallback(async () => {
    if (preview || !runId) { setLoading(false); return; }
    setLoading(true);
    const scenarioResult = await db.from("scenarios").select("scenario_id,speech_act,generation_item_key,mission_status").eq("final_corpus_generation_run_id", runId).order("generation_item_key");
    if (scenarioResult.error) { setMessage(scenarioResult.error.message); setLoading(false); return; }
    const scenarios = (scenarioResult.data ?? []) as ScenarioRow[];
    const ids = scenarios.map((item) => item.scenario_id);
    if (!ids.length) { setItems([]); setLoading(false); return; }
    const [lineageResult, reviewResult] = await Promise.all([
      db.from("mission_lineage_versions").select("id,version_no,scenario_id,mission_content,validation_result,ai_quality_result").in("scenario_id", ids).in("stage", ["generated", "reviewed"]),
      db.from("pragma_final_corpus_researcher_item_reviews").select("id,lineage_version_id,verdict,automated_warning,attention_mode,review_duration_seconds,reviewed_at").eq("generation_run_id", runId).order("reviewed_at", { ascending: false }),
    ]);
    const error = lineageResult.error ?? reviewResult.error;
    if (error) { setMessage(error.message); setLoading(false); return; }
    const lineageByScenario = new Map<string, LineageRow>();
    for (const row of (lineageResult.data ?? []) as LineageRow[]) {
      const current = lineageByScenario.get(row.scenario_id);
      if (!current || row.version_no > current.version_no) lineageByScenario.set(row.scenario_id, row);
    }
    const reviewByLineage = new Map<string, ReviewRow>();
    for (const row of (reviewResult.data ?? []) as ReviewRow[]) if (!reviewByLineage.has(row.lineage_version_id)) reviewByLineage.set(row.lineage_version_id, row);
    const next = scenarios.map((scenario) => {
      const lineage = lineageByScenario.get(scenario.scenario_id) ?? null;
      const validation = stringify(lineage?.validation_result ?? {}).toLowerCase();
      const quality = stringify(lineage?.ai_quality_result ?? {}).toLowerCase();
      const audit = lineage?.mission_content?.hsk_lexical_audit as { out_of_reference_candidates?: unknown } | undefined;
      const hskCandidateCount = Array.isArray(audit?.out_of_reference_candidates)
        ? audit.out_of_reference_candidates.length
        : 0;
      return {
        ...scenario,
        lineage,
        review: lineage ? reviewByLineage.get(lineage.id) ?? null : null,
        warning: validation.includes("warning") || quality.includes("warning") || hskCandidateCount > 0,
        hskCandidateCount,
      };
    });
    setItems(next);
    setSelectedId((current) => current || next.find((item) => !item.review)?.scenario_id || next[0]?.scenario_id || "");
    setLoading(false);
  }, [preview, runId]);

  useEffect(() => { void loadRuns(); }, [loadRuns]);
  useEffect(() => { void loadItems(); }, [loadItems]);
  useEffect(() => { setReviewStartedAt(new Date().toISOString()); }, [selectedId]);

  const visible = useMemo(() => items.filter((item) => filter === "all" || (filter === "pending" ? !item.review : item.warning && !item.review)), [filter, items]);
  const selected = items.find((item) => item.scenario_id === selectedId) ?? visible[0] ?? null;
  const selectedIndex = visible.findIndex((item) => item.scenario_id === selected?.scenario_id);
  const approved = items.filter((item) => item.review?.verdict === "approve").length;
  const warningCount = items.filter((item) => item.warning && !item.review).length;
  const reviewedWarnings = items.filter((item) => item.review?.automated_warning && item.review.review_duration_seconds > 0);
  const reviewedClean = items.filter((item) => item.review && !item.review.automated_warning && item.review.review_duration_seconds > 0);
  const averageSeconds = (rows: ReviewItem[]) => rows.length ? Math.round(rows.reduce((sum, item) => sum + (item.review?.review_duration_seconds ?? 0), 0) / rows.length) : null;

  const move = (offset: number) => {
    if (!visible.length) return;
    const index = Math.min(Math.max(selectedIndex + offset, 0), visible.length - 1);
    setSelectedId(visible[index].scenario_id);
  };

  return <AdminShell title="과거 정식 생성 검토 기록" description="기존 정식 생성 작업의 검토 이력을 읽는 화면입니다. 교수자가 현재 콘텐츠를 감수한 뒤 최종 승인하는 일은 「교수자 최종 승인」 화면에서 진행합니다.">
    <div className="space-y-5">
      <Link className="inline-block font-semibold underline" to="/admin/review">교수자 최종 승인로 이동 →</Link>
      <div className="flex flex-wrap items-center justify-between gap-3"><Button asChild variant="ghost" size="sm"><Link to="/admin/dashboard"><ArrowLeft className="mr-1 h-4 w-4" />운영 대시보드</Link></Button><Badge className="bg-slate-900 text-white">과거 기록 · 읽기 전용</Badge></div>

      <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
        <strong>이력 범위:</strong> 과거 정식 생성 작업에 연결된 자동 점검과 연구자 검토 기록입니다. 전체 운영 콘텐츠의 점검률이나 현재 콘텐츠 승인 완료율이 아닙니다.
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">정식 문항</p><p className="mt-1 text-2xl font-semibold">{items.length}/{runs.find((run) => run.id === runId)?.target_count ?? "—"}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">자동 점검·이상 없음 확인</p><p className="mt-1 text-2xl font-semibold">{approved}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">먼저 볼 자동 경고</p><p className="mt-1 text-2xl font-semibold">{warningCount}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />평균 확인시간</p><p className="mt-1 text-sm font-semibold">경고 {averageSeconds(reviewedWarnings) ?? "—"}초 · 무경고 {averageSeconds(reviewedClean) ?? "—"}초</p></div>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_190px]">
          <Select value={runId} onValueChange={setRunId}><SelectTrigger><SelectValue placeholder={loading ? "정식 생성 작업을 불러오는 중…" : "정식 생성 작업 선택"} /></SelectTrigger><SelectContent>{runs.map((run) => <SelectItem key={run.id} value={run.id}>정식 {run.target_count}개 생성 작업 · {run.id.slice(0, 8)}</SelectItem>)}</SelectContent></Select>
          <Select value={filter} onValueChange={(value: typeof filter) => setFilter(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">아직 보지 않은 문항</SelectItem><SelectItem value="warning">자동 경고 먼저</SelectItem><SelectItem value="all">전체 문항</SelectItem></SelectContent></Select>
        </div>
      </section>

      {selected ? <section className="rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{selected.generation_item_key} · {selected.speech_act}</p><h2 className="mt-1 text-lg font-semibold">{String(selected.lineage?.mission_content?.title ?? "AI 학습문항")}</h2></div><Badge variant={selected.warning ? "destructive" : "secondary"}>{selected.hskCandidateCount > 0 ? `HSK 후보 ${selected.hskCandidateCount}개 · 집중 검토` : selected.warning ? "자동 경고 · 집중 검토" : "자동 점검 통과"}</Badge></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-semibold">AI 생성 콘텐츠</p><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5">{stringify(selected.lineage?.mission_content ?? {})}</pre></div><div className="space-y-3"><div className="rounded-lg border p-4"><p className="text-xs font-semibold">품질 점검 자동화 결과</p><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs">{stringify({ validation: selected.lineage?.validation_result, quality: selected.lineage?.ai_quality_result, hsk_reference: selected.lineage?.mission_content?.hsk_lexical_audit })}</pre></div></div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Button variant="outline" onClick={() => move(-1)} disabled={selectedIndex <= 0}><ChevronLeft className="h-4 w-4" />이전</Button><Button variant="outline" onClick={() => move(1)} disabled={selectedIndex < 0 || selectedIndex >= visible.length - 1}>다음<ChevronRight className="h-4 w-4" /></Button></div></div>
      </section> : <section className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">{loading ? "문항을 불러오는 중입니다." : "선택한 조건에 해당하는 문항이 없습니다."}</section>}
      {message && <p className="rounded-lg border bg-white p-3 text-sm">{message}</p>}
      {preview && <p className="text-xs text-slate-500">미리보기 화면에서는 연구자 판정을 저장하지 않습니다.</p>}
    </div>
  </AdminShell>;
};

export default AdminFinalCorpusReview;
