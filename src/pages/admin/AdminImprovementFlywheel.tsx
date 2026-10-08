import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, DatabaseZap, GitBranch, LockKeyhole, RefreshCw } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

type CandidateRow = {
  id: string;
  candidate_key: string;
  signal_type: "learner_dissent_cluster";
  target_feature: string | null;
  content_hash: string | null;
  realization_pack_id: string | null;
  realization_pack_version: string | null;
  source_refs: string[];
  metrics: Record<string, unknown>;
  evidence_fingerprint: string;
  source_window_start: string | null;
  source_window_end: string | null;
  created_at: string;
};
type SourceRow = {
  id: string;
  candidate_id: string;
  source_type: string;
  source_id: string;
  source_field: string;
  source_snapshot: Record<string, unknown>;
  added_at: string;
};
type DecisionRow = {
  id: string;
  candidate_id: string;
  decision: "triage" | "approve" | "reject";
  note_ko: string;
  decided_at: string;
};

const PREVIEW_CANDIDATE: CandidateRow = {
  id: "51000000-0000-4000-8000-000000000001",
  candidate_key: "learner:preview-fingerprint",
  signal_type: "learner_dissent_cluster",
  target_feature: "request_mitigation_optionality",
  content_hash: "24adf002ee1d-preview",
  realization_pack_id: "pragma_ko_zh_request_refusal_thanks_v1",
  realization_pack_version: "1.2.0",
  source_refs: ["learner-event:5200…001", "learner-event:5200…002", "learner-event:5200…003"],
  metrics: { distinct_participant_count: 3, distinct_attempt_count: 3, dissent_event_count: 3 },
  evidence_fingerprint: "a".repeat(64),
  source_window_start: "2026-08-14T23:00:00.000Z",
  source_window_end: "2026-08-14T23:10:00.000Z",
  created_at: "2026-08-15T00:00:00.000Z",
};
const PREVIEW_SOURCES: SourceRow[] = [
  {
    id: "s1",
    candidate_id: PREVIEW_CANDIDATE.id,
    source_type: "learner_mission_event",
    source_id: "52000000-0000-4000-8000-000000000001",
    source_field: "learner_dissent_submitted",
    source_snapshot: { participant_count: 3 },
    added_at: PREVIEW_CANDIDATE.created_at,
  },
];
const PREVIEW_DECISION: DecisionRow = {
  id: "d1",
  candidate_id: PREVIEW_CANDIDATE.id,
  decision: "triage",
  note_ko: "여러 학습자가 같은 표현의 선택권 정도에 이견을 제기해 교수자가 확인 중",
  decided_at: "2026-08-15T00:10:00.000Z",
};

const DECISION_LABELS: Record<string, string> = {
  open: "검토 대기",
  triage: "확인 중",
  approve: "개선 승인",
  reject: "반영하지 않음",
};
const FEATURE_LABELS: Record<string, string> = {
  request_mitigation_optionality: "요청할 때 상대방의 선택권을 남기는 표현",
  refusal_softening: "거절을 부드럽게 만드는 표현",
  gratitude_calibration: "상황에 맞는 감사 강도",
};

const featureLabel = (value: string | null | undefined) =>
  value ? FEATURE_LABELS[value] ?? value : "관련 표현 미지정";
const short = (value: string | null | undefined, size = 10) =>
  value ? `${value.slice(0, size)}${value.length > size ? "…" : ""}` : "—";
const latestDecision = (candidateId: string, decisions: DecisionRow[]) =>
  decisions
    .filter((item) => item.candidate_id === candidateId)
    .sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0] ?? null;

const AdminImprovementFlywheel = ({ preview = false }: { preview?: boolean }) => {
  const { pathname } = useLocation();
  const [candidates, setCandidates] = useState<CandidateRow[]>(preview ? [PREVIEW_CANDIDATE] : []);
  const [sources, setSources] = useState<SourceRow[]>(preview ? PREVIEW_SOURCES : []);
  const [decisions, setDecisions] = useState<DecisionRow[]>(preview ? [PREVIEW_DECISION] : []);
  const [candidateId, setCandidateId] = useState(preview ? PREVIEW_CANDIDATE.id : "");
  const [decisionNote, setDecisionNote] = useState("");
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (preview) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [candidateResult, sourceResult, decisionResult] = await Promise.all([
      db.from("pragma_improvement_candidates")
        .select("id,candidate_key,signal_type,target_feature,content_hash,realization_pack_id,realization_pack_version,source_refs,metrics,evidence_fingerprint,source_window_start,source_window_end,created_at")
        .eq("signal_type", "learner_dissent_cluster")
        .order("created_at", { ascending: false }),
      db.from("pragma_improvement_candidate_sources")
        .select("id,candidate_id,source_type,source_id,source_field,source_snapshot,added_at")
        .eq("source_type", "learner_mission_event")
        .order("added_at", { ascending: false }),
      db.from("pragma_improvement_decisions")
        .select("id,candidate_id,decision,note_ko,decided_at")
        .in("decision", ["triage", "approve", "reject"])
        .order("decided_at", { ascending: false }),
    ]);
    const error = candidateResult.error ?? sourceResult.error ?? decisionResult.error;
    if (error) {
      setMessage(error.message);
    } else {
      const loaded = (candidateResult.data ?? []) as CandidateRow[];
      setCandidates(loaded);
      setSources((sourceResult.data ?? []) as SourceRow[]);
      setDecisions((decisionResult.data ?? []) as DecisionRow[]);
      setCandidateId((current) =>
        loaded.some((item) => item.id === current) ? current : loaded[0]?.id ?? "",
      );
    }
    setLoading(false);
  }, [preview]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = candidates.find((item) => item.id === candidateId) ?? null;
  const selectedSources = sources.filter((item) => item.candidate_id === candidateId);
  const selectedDecisions = decisions.filter((item) => item.candidate_id === candidateId);
  const currentDecision = latestDecision(candidateId, decisions);
  const counts = useMemo(
    () => ({
      open: candidates.filter((item) => !["approve", "reject"].includes(latestDecision(item.id, decisions)?.decision ?? "")).length,
      approved: decisions.filter((item) => item.decision === "approve").length,
    }),
    [candidates, decisions],
  );

  const materialize = async () => {
    if (preview) return;
    setSaving(true);
    setMessage(null);
    const { data, error } = await db.rpc("materialize_pragma_learner_improvement_candidates", {
      p_window_start: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      p_window_end: new Date().toISOString(),
      p_min_distinct_attempts: 3,
      p_min_distinct_participants: 3,
    });
    setMessage(error
      ? error.message
      : `학습자 이견 집계 ${short(String(data), 8)}를 저장했습니다. 콘텐츠는 자동 변경되지 않습니다.`);
    setSaving(false);
    if (!error) await load();
  };

  const decide = async (decision: DecisionRow["decision"]) => {
    if (preview || !selected || !decisionNote.trim()) return;
    setSaving(true);
    setMessage(null);
    const { error } = await db.rpc("record_pragma_improvement_decision", {
      p_candidate_id: selected.id,
      p_decision: decision,
      p_note_ko: decisionNote.trim(),
    });
    setMessage(error ? error.message : "교수자 판단을 추가했습니다.");
    setSaving(false);
    if (!error) {
      setDecisionNote("");
      await load();
    }
  };

  const canDecide = !currentDecision || currentDecision.decision === "triage";

  return (
    <AdminShell
      title="콘텐츠 개선 후보"
      description="학습 수행에서 반복된 학습자 이견을 모아 교수자가 콘텐츠 개선 여부를 결정합니다."
    >
      <div className="space-y-5">
        <section className="rounded-xl border border-[#E2DED2] bg-white p-5">
          <p className="text-xs font-semibold text-[#756F64]">학습 수행 근거</p>
          <h2 className="mt-1 text-lg font-semibold">반복되는 학습자 이견을 개선 검토로 연결</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            서로 다른 학습자 3명 이상의 이견만 후보로 모으며, 교수자가 근거를 확인해 개선 여부를
            결정합니다. 과거 전문가 검토 자료는 이 화면의 후보 생성에 사용하지 않습니다.
          </p>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to={pathname.startsWith("/prototype/") ? "/prototype/final-review" : "/admin/dashboard"}>
              <ArrowLeft className="mr-1 h-4 w-4" />운영·품질관리로 돌아가기
            </Link>
          </Button>
          <Badge className="gap-1 bg-slate-900 text-white">
            <LockKeyhole className="h-3.5 w-3.5" />자동 반영 없음 · 교수자 최종 결정
          </Badge>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">학습자 이견 후보</p><p className="mt-1 text-2xl font-semibold">{candidates.length}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">교수자 확인 대기</p><p className="mt-1 text-2xl font-semibold">{counts.open}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">개선 승인</p><p className="mt-1 text-2xl font-semibold">{counts.approved}</p></div>
        </section>

        <section className="rounded-xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold"><DatabaseZap className="h-5 w-5" />반복되는 문제 신호 찾기</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                최근 180일 동안 서로 다른 수행 3건·학습자 3명 이상이 같은 문항에 이의를 제기한 경우만
                후보로 만듭니다. 이미 사용한 기록은 다시 세지 않습니다.
              </p>
            </div>
            <Button onClick={materialize} disabled={preview || saving}><RefreshCw className="mr-1 h-4 w-4" />학습자 이견 새로 집계</Button>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <section className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">개선 후보 목록</h2>
            <div className="mt-3 space-y-2">
              {candidates.map((item) => {
                const state = latestDecision(item.id, decisions)?.decision ?? "open";
                return <button key={item.id} type="button" onClick={() => setCandidateId(item.id)} className={`w-full rounded-lg border p-3 text-left ${candidateId === item.id ? "border-amber-400 bg-amber-50" : "hover:bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">반복된 학습자 이견</span><Badge variant={state === "reject" ? "destructive" : "secondary"}>{DECISION_LABELS[state] ?? state}</Badge></div>
                  <p className="mt-1 text-xs text-slate-600">{featureLabel(item.target_feature)}</p>
                  <p className="mt-1 text-xs text-slate-500">근거 {item.source_refs.length}건</p>
                </button>;
              })}
              {!loading && candidates.length === 0 && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-slate-500">집계된 학습자 이견 후보가 없습니다.</p>}
            </div>
          </section>

          <div className="space-y-5">
            <section className="rounded-xl border bg-white p-5">
              <h2 className="flex items-center gap-2 font-semibold"><GitBranch className="h-5 w-5" />이 후보가 만들어진 근거</h2>
              {selected ? <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div><p className="text-xs text-slate-500">관련 표현·문항</p><p className="mt-1 text-sm">{featureLabel(selected.target_feature)}</p></div>
                  <div><p className="text-xs text-slate-500">근거 묶음 확인값</p><p className="mt-1 font-mono text-xs">{short(selected.evidence_fingerprint, 18)}</p></div>
                  <div><p className="text-xs text-slate-500">문제가 관찰된 기간</p><p className="mt-1 text-xs">{selected.source_window_start?.slice(0, 16) ?? "—"} → {selected.source_window_end?.slice(0, 16) ?? "—"}</p></div>
                  <div><p className="text-xs text-slate-500">콘텐츠 확인값</p><p className="mt-1 font-mono text-xs">{short(selected.content_hash, 18)}</p></div>
                </div>
                <details className="mt-4 rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">집계 정보 보기</summary><pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(selected.metrics, null, 2)}</pre></details>
                <div className="mt-3 flex flex-wrap gap-2">{selectedSources.map((source) => <Badge key={source.id} variant="outline">학습 수행 근거 {short(source.source_id, 8)}</Badge>)}</div>
              </> : <p className="mt-3 text-sm text-slate-500">왼쪽에서 개선 후보를 선택하세요.</p>}
            </section>

            <section className="rounded-xl border bg-white p-5">
              <h2 className="font-semibold">교수자가 개선 여부 결정</h2>
              <p className="mt-1 text-sm text-slate-600">학습 수행 근거와 실제 콘텐츠를 확인한 뒤 개선을 승인하거나 반영하지 않기로 결정합니다. 승인 결과가 콘텐츠를 자동 변경하지는 않습니다.</p>
              <Textarea className="mt-3" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="판단 근거를 한국어로 기록" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => decide("triage")} disabled={preview || saving || !selected || !decisionNote.trim() || !canDecide}>내용 확인 중</Button>
                <Button onClick={() => decide("approve")} disabled={preview || saving || !selected || !decisionNote.trim() || !canDecide}>개선 승인</Button>
                <Button variant="destructive" onClick={() => decide("reject")} disabled={preview || saving || !selected || !decisionNote.trim() || !canDecide}>반영하지 않음</Button>
              </div>
              <div className="mt-4 space-y-2">{selectedDecisions.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between gap-2"><Badge variant="secondary">{DECISION_LABELS[item.decision]}</Badge><span className="text-xs text-slate-500">{item.decided_at.slice(0, 16)}</span></div><p className="mt-2">{item.note_ko}</p></div>)}</div>
            </section>
          </div>
        </div>

        {message && <p className="rounded-lg border bg-white p-3 text-sm">{message}</p>}
        {preview && <p className="text-xs text-slate-500">미리보기 화면은 예시 자료만 보여주며 저장 기능은 잠겨 있습니다.</p>}
      </div>
    </AdminShell>
  );
};

export default AdminImprovementFlywheel;
