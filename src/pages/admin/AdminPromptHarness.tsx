import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { PROMPT_SNAPSHOT, type PromptSnapshotEntry } from "@/lib/pragma/promptSnapshot.generated";
import { ACTIVE_RULE_IDS } from "@/lib/pragma/missionRules";

type PromptTemplate = {
  id: string;
  prompt_key: string;
  title: string | null;
  content: string;
  category: string | null;
  version: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  prompt_key: string;
  title: string;
  category: string;
  content: string;
  notes: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  prompt_key: "",
  title: "",
  category: "",
  content: "",
  notes: "",
  is_active: true,
};

const GROUP_ORDER = ["generation", "review", "report", "golden_fta"] as const;

const CATEGORY_TO_GROUP: Record<string, (typeof GROUP_ORDER)[number]> = {
  generation: "generation",
  review: "review",
  report: "report",
  golden: "golden_fta",
  fta: "golden_fta",
};

const GROUP_LABEL: Record<(typeof GROUP_ORDER)[number], string> = {
  generation: "① 시나리오 생성",
  review: "② AI 검토",
  report: "③ 수행 리포트",
  golden_fta: "④ 기준 자료",
};

const GROUP_DESCRIPTION: Record<(typeof GROUP_ORDER)[number], string> = {
  generation: "AI가 상황 시나리오·번역 후보를 만들 때 지켜야 할 규칙",
  review: "생성된 결과를 학습자에게보내기 전에 점검하는 기준",
  report: "학습자의 수행 기록을 분석해 강약점·다음 학습을 정리하는 틀",
  golden_fta: "생성·점검의 기준이 되는 모범 사례와 이론적 설계 근거",
};

const CARD_ORDER: Record<string, number> = {
  metadata_lock_block: 1,
  source_text_responsibility_block: 2,
  candidate_contrast_block: 3,
  reviewer_checklist_block: 4,
  report_schema_block: 5,
  golden_examples: 6,
  fta_design_note: 7,
};

const CARD_DISPLAY: Record<
  string,
  { title: string; subtitle: string }
> = {
  metadata_lock_block: {
    title: "입력 조건 고정",
    subtitle:
      "화행·상황·수준 등 관리자가 정한 조건이 생성 중 바뀌지 않도록 고정",
  },
  source_text_responsibility_block: {
    title: "원문 충실성 규칙",
    subtitle: "원문에 없는 사실·사과·약속을 지어내지 않도록 통제",
  },
  candidate_contrast_block: {
    title: "번역 후보 대비 설계",
    subtitle:
      "직접성 차이로 여러 후보를 만들어 학습자가 화용 차이를 판단하게 함",
  },
  reviewer_checklist_block: {
    title: "콘텐츠 점검표",
    subtitle: "생성 결과가 기준을 지켰는지 항목별로 점검",
  },
  report_schema_block: {
    title: "리포트 구조 틀",
    subtitle: "수행 기록 기반 강약점·추천의 출력 형식",
  },
  golden_examples: {
    title: "모범·오류 예시",
    subtitle: "통과·실패·수정 사례 모음",
  },
  fta_design_note: {
    title: "상황·공손성 설계 노트",
    subtitle:
      "상황 변수(P/D/R)와 번역 직접성을 잇는 이론적 설계 근거",
  },
};

// ── 저장소 정본(읽기 전용) ─────────────────────────────────────────────
// 이 섹션의 원문은 promptSnapshot.generated.ts에서 온다. 그 파일은 build마다
// 실제 edge 소스에서 자동 재생성되므로(prebuild) 화면이 코드보다 낡을 수 없다.
// 편집 경로는 만들지 않는다 — 프롬프트를 고치려면 코드를 고쳐야 한다.
const SNAPSHOT_GROUP_LABEL: Record<string, string> = {
  core: "시나리오 생성",
  mission: "미션 승격 (MJT + 산출 과제)",
  review: "프롬프트 통제 기반 검토",
  runtime: "학습자 실행 중 피드백",
  authoring: "실제 자료 활용",
};
const HARNESS_SECTION_ORDER = ["core", "mission", "review", "runtime", "authoring"];

/** 배치가 실제로 사용한 지문 — scenarios 행에서 집계(계약 provenance). */
type UsedHashRow = { hash: string | null; count: number; first: string; last: string };

function HarnessOverview() {
  return (
    <section
      aria-labelledby="harness-overview-title"
      className="rounded-xl border border-[#D9D2BF] bg-white p-4 sm:p-5"
    >
      <div className="max-w-[48rem]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A7621]">
          품질관리 구조
        </p>
        <h2 id="harness-overview-title" className="mt-1 text-[18px] font-bold text-[#26333B]">
          자동 점검은 두 방식으로, 최종 권한은 교수자에게 둡니다
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          품질 점검 자동화는 규칙 기반 검사와 프롬프트 통제 기반 검토를 함께 사용합니다. 두 방식은
          조정 후보와 근거를 제공하며, 교수자가 콘텐츠를 감수한 뒤 수업 사용·공개 자격을 최종 승인합니다.
        </p>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-[#E5DEC9] bg-[#FBFAF6] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#6D5C1F]">자동 점검 ①</span>
            <Badge variant="outline" className="bg-white font-normal">재현 가능</Badge>
          </div>
          <h3 className="mt-2 text-[14px] font-bold">규칙 기반 검사</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            같은 입력에는 같은 결과를 냅니다. HSK 어휘 참고 범위 점검과 현행 규칙 {ACTIVE_RULE_IDS.length}개가
            여기에 속합니다.
          </p>
        </div>
        <div className="rounded-lg border border-[#D8E0E5] bg-[#F7FAFB] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#3F6172]">자동 점검 ②</span>
            <Badge variant="outline" className="bg-white font-normal">문맥 검토</Badge>
          </div>
          <h3 className="mt-2 text-[14px] font-bold">프롬프트 통제 기반 검토</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            생성과 분리된 AI가 버전이 관리되는 지시문에 따라 의미·자연성·후보 자격을 검토합니다.
          </p>
        </div>
        <div className="rounded-lg border border-[#E1DDD4] bg-[#FAF9F7] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#6D675D]">운영 결정</span>
            <Badge variant="outline" className="bg-white font-normal">최종 권한</Badge>
          </div>
          <h3 className="mt-2 text-[14px] font-bold">교수자 최종 승인</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            자동 검사 근거를 보고 더 쉽게 또는 더 도전적으로 조정할지와 학습자 공개 여부를
            결정합니다.
          </p>
        </div>
      </div>
    </section>
  );
}

function ProvenanceBanner({
  used,
  loading,
  error,
}: {
  used: UsedHashRow[];
  loading: boolean;
  error: string | null;
}) {
  const snap = PROMPT_SNAPSHOT;
  const matched = used.find((u) => u.hash === snap.core_surface_hash);
  const legacyNull = used.find((u) => u.hash === null);
  const mismatched = used.filter((u) => u.hash && u.hash !== snap.core_surface_hash);
  const mismatchTotal = mismatched.reduce((sum, row) => sum + row.count, 0);
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <section className="rounded-xl border border-[#EAE4D2] bg-[#FBFAF7] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Lock className="h-4 w-4 text-[#8a857c]" />
        <h2 className="text-[15px] font-bold">프롬프트·지문 관리 · 읽기 전용</h2>
        <Badge variant="outline" className="font-normal">
          커밋 {snap.git_commit}
        </Badge>
        {snap.git_dirty && (
          <Badge variant="outline" className="border-amber-400 bg-amber-50 font-normal text-amber-900">
            edge 소스에 미커밋 변경 있음
          </Badge>
        )}
      </div>
      <p className="mt-2 max-w-[42rem] text-[12.5px] leading-relaxed text-muted-foreground">
        아래에는 모델에 실제로 전송되는 지시문과 모델 설정, 출력 형식, 버전·지문을 함께 표시합니다.
        <code>PROBE_*</code>는 호출마다 달라지는 입력값 자리이고, 실제 값은 시나리오 행에 따로
        저장됩니다.
      </p>

      <div className="mt-3 grid gap-2 text-[12.5px] sm:grid-cols-2">
        <div className="rounded-lg border border-[#EAE4D2] bg-white px-3 py-2">
          <div className="text-[11.5px] text-muted-foreground">시나리오 생성 표면 지문 (SHA-256)</div>
          <div className="mt-0.5 break-all font-mono text-[11px]">{snap.core_surface_hash}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            모델 {snap.generation_config.model} · temperature {snap.generation_config.temperature} ·{" "}
            {snap.generation_config.response_format}
          </div>
        </div>
        <div className="rounded-lg border border-[#EAE4D2] bg-white px-3 py-2">
          <div className="text-[11.5px] text-muted-foreground">이 지문으로 생성된 현행 시나리오</div>
          {loading ? (
            <div className="mt-1 text-[12px] text-muted-foreground">확인 중…</div>
          ) : error ? (
            <>
              <div className="mt-0.5 text-[15px] font-bold text-amber-800">확인 필요</div>
              <div className="text-[11px] text-muted-foreground">
                시나리오 조회 실패 — 관리자 로그인이 필요합니다(0건이라는 뜻이 아닙니다)
              </div>
            </>
          ) : matched ? (
            <>
              <div className="mt-0.5 text-[20px] font-bold text-emerald-800">{matched.count}건</div>
              <div className="text-[11px] text-muted-foreground">
                {matched.first.slice(0, 10)} ~ {matched.last.slice(0, 10)} · 저장소 정본과 일치 ✓
              </div>
            </>
          ) : (
            <>
              <div className="mt-0.5 text-[20px] font-bold text-[#8a857c]">0건</div>
              <div className="text-[11px] text-muted-foreground">
                아직 이 프롬프트로 생성된 시나리오가 없습니다
              </div>
            </>
          )}
        </div>
      </div>

      {/* 지문이 없는 현행분 — 지문 기록 도입 전 생성분과, 생성 함수를 거치지 않고 등록된 변환본이 섞여 있다.
          숨기지 않고 정직하게 표기한다(소급 기록 금지). */}
      {!loading && !error && legacyNull && (
        <p className="mt-2 max-w-[46rem] rounded-lg bg-[#F6F3EA] px-3 py-2 text-[12px] text-[#4F5D68]">
          지문이 기록되지 않은 현행 시나리오 <b>{legacyNull.count}건</b>({legacyNull.first.slice(0, 10)} ~{" "}
          {legacyNull.last.slice(0, 10)}) — 지문 기록 도입 전 생성분과 생성 함수 밖에서 등록된 변환본입니다.
          어떤 지시문이었는지 소급해 채우지 않았습니다.
        </p>
      )}

      {/* 과거 지문을 한 줄씩 늘어놓으면 현재 하네스가 화면 아래로 밀린다. 증거는 접어서 보존한다. */}
      {!loading && !error && mismatched.length > 0 && (
        <div className="mt-2 max-w-[46rem] rounded-lg bg-[#F6F3EA] px-3 py-2 text-[12px] text-[#4F5D68]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              이전 버전 지시문 <b>{mismatched.length}종</b>으로 생성된 현행 시나리오 <b>{mismatchTotal}건</b>
            </p>
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              className="inline-flex items-center gap-1 font-semibold underline decoration-[#B9C3CA] underline-offset-2"
            >
              {historyOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {historyOpen ? "이력 닫기" : "이력 보기"}
            </button>
          </div>
          {historyOpen && (
            <ul className="mt-2 space-y-1 border-t border-[#E6E1D5] pt-2">
              {mismatched.map((row) => (
                <li key={row.hash}>
                  <span className="font-mono">{row.hash?.slice(0, 12)}…</span> · {row.count}건 ·{" "}
                  {row.first.slice(0, 10)} ~ {row.last.slice(0, 10)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-2 text-[11.5px] text-muted-foreground">
        스냅샷 캡처: {new Date(snap.generated_at).toLocaleString()} · 출처 {snap.edge_source}
      </p>
    </section>
  );
}

function SnapshotCard({ entry }: { entry: PromptSnapshotEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-left"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <CardTitle className="text-base">{entry.label}</CardTitle>
          </button>
          <Badge variant="outline" className="font-mono text-[11px]">
            {entry.sha256.slice(0, 10)}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            {entry.text.length.toLocaleString()}자
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p>
      </CardHeader>
      {open && (
        <CardContent className="p-4 pt-0">
          <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
            {entry.text}
          </pre>
          <p className="mt-2 break-all font-mono text-[10.5px] text-muted-foreground">
            {entry.key} · sha256 {entry.sha256}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function sortByDisplayOrder(rows: PromptTemplate[]): PromptTemplate[] {
  return [...rows].sort((a, b) => {
    const ao = CARD_ORDER[a.prompt_key] ?? 99;
    const bo = CARD_ORDER[b.prompt_key] ?? 99;
    if (ao !== bo) return ao - bo;
    return (a.prompt_key ?? "").localeCompare(b.prompt_key ?? "");
  });
}


const AdminPromptHarness = () => {
  const [rows, setRows] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromptTemplate | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);
  // 실제 생성에 쓰인 지문 — 저장소 정본과 대조해 "이 데이터가 이 프롬프트에서 나왔다"를 보인다.
  const [usedHashes, setUsedHashes] = useState<UsedHashRow[]>([]);
  const [usedLoading, setUsedLoading] = useState(true);
  const [usedError, setUsedError] = useState<string | null>(null);

  const loadUsed = useCallback(async () => {
    setUsedLoading(true);
    const { data, error } = await supabase
      .from("scenarios")
      .select("prompt_snapshot_hash, created_at")
      .eq("content_format", "scenario_core_v1")
      // 현행(보관 안 된) 시나리오만 센다 — 보관·폐기된 초안까지 섞으면 숫자가 현재 라이브러리를 말하지 않는다.
      .is("archived_at", null)
      .limit(2000);
    // 조회 실패(RLS·비로그인)를 0건으로 표시하면 화면이 조용히 거짓말한다 —
    // "확인 필요"로 구분해서 내보낸다.
    if (error || !data) {
      setUsedError(error?.message ?? "조회 실패");
      setUsedHashes([]);
      setUsedLoading(false);
      return;
    }
    setUsedError(null);
    const acc = new Map<string, UsedHashRow>();
    for (const r of data as { prompt_snapshot_hash: string | null; created_at: string }[]) {
      const key = r.prompt_snapshot_hash ?? "__missing_hash__";
      const cur = acc.get(key);
      if (!cur) {
        acc.set(key, {
          hash: r.prompt_snapshot_hash,
          count: 1,
          first: r.created_at,
          last: r.created_at,
        });
      } else {
        cur.count += 1;
        if (r.created_at < cur.first) cur.first = r.created_at;
        if (r.created_at > cur.last) cur.last = r.created_at;
      }
    }
    setUsedHashes([...acc.values()].sort((a, b) => b.count - a.count));
    setUsedLoading(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prompt_templates")
      .select("*")
      .order("category", { ascending: true, nullsFirst: false })
      .order("prompt_key", { ascending: true })
      .order("version", { ascending: false });
    if (error) {
      toast.error(`불러오기 실패: ${error.message}`);
      setRows([]);
    } else {
      setRows((data ?? []) as PromptTemplate[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    void loadUsed();
  }, [load, loadUsed]);

  const grouped = useMemo(() => {
    const g: Partial<Record<(typeof GROUP_ORDER)[number], PromptTemplate[]>> = {};
    for (const r of rows) {
      const cat = r.category?.trim() || "기타";
      const groupKey = CATEGORY_TO_GROUP[cat] ?? "golden_fta";
      (g[groupKey] ||= []).push(r);
    }
    for (const k of GROUP_ORDER) {
      if (g[k]) g[k] = sortByDisplayOrder(g[k]!);
    }
    return g;
  }, [rows]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (row: PromptTemplate) => {
    setEditing(row);
    setForm({
      id: row.id,
      prompt_key: row.prompt_key,
      title: row.title ?? "",
      category: row.category ?? "",
      content: row.content ?? "",
      notes: row.notes ?? "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.prompt_key.trim()) {
      toast.error("prompt_key는 필수입니다.");
      return;
    }
    if (!form.content) {
      toast.error("content는 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("prompt_templates")
          .update({
            prompt_key: form.prompt_key.trim(),
            title: form.title || null,
            category: form.category || null,
            content: form.content,
            notes: form.notes || null,
            is_active: form.is_active,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("수정되었습니다.");
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("prompt_templates").insert({
          prompt_key: form.prompt_key.trim(),
          title: form.title || null,
          category: form.category || null,
          content: form.content,
          notes: form.notes || null,
          is_active: form.is_active,
          version: 1,
          created_by: userData.user?.id ?? null,
        });
        if (error) throw error;
        toast.success("추가되었습니다.");
      }
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      toast.error(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("prompt_templates")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast.error(`삭제 실패: ${error.message}`);
    } else {
      toast.success("삭제되었습니다.");
      await load();
    }
    setDeleteTarget(null);
  };

  return (
    <AdminShell
      title="생성 계약·프롬프트"
      description="생성 계약과 버전이 관리되는 프롬프트, 자동 점검 규칙, 교수자 감수와 최종 승인의 관계를 확인합니다."
    >
      <HarnessOverview />

      <div className="mt-6">
        <ProvenanceBanner used={usedHashes} loading={usedLoading} error={usedError} />
      </div>

      <div className="mt-6 space-y-6">
        {HARNESS_SECTION_ORDER.map((g) => {
          const items = PROMPT_SNAPSHOT.prompts.filter((p) => p.group === g);
          if (items.length === 0) return null;
          return (
            <div key={g}>
              <h3 className="mb-2 text-[15px] font-bold">{SNAPSHOT_GROUP_LABEL[g] ?? g}</h3>
              <div className="space-y-2">
                {items.map((p) => (
                  <SnapshotCard key={p.key} entry={p} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 아래는 별개 저장소(prompt_templates 테이블) ──
          2026-07-06에 만들었으나 생성 파이프라인이 조회하지 않는다. 위 정본과
          혼동되지 않게 시각적으로 분리하고, 쓰이지 않는다는 사실을 명시한다.
          마감 후 삭제 후보 — 지금 지우지 않는다(마감 직전 DB 삭제 금지). */}
      <div className="mt-10 border-t-2 border-dashed border-[#EAE4D2] pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold text-[#8a857c]">
              Legacy 문서 보관함
            </h3>
            <Badge variant="outline">DB legacy</Badge>
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
              런타임 미사용
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLegacyOpen((open) => !open)}>
            {legacyOpen ? (
              <ChevronDown className="mr-1 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-1 h-4 w-4" />
            )}
            {legacyOpen ? "보관함 닫기" : `보관함 열기 (${rows.length})`}
          </Button>
        </div>
      </div>

      {legacyOpen && (
        <>
          <div className="mb-4 mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              총 {rows.length}개 · 단계 {GROUP_ORDER.length}개
            </p>
            <Button variant="outline" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> 새 보관 문서 추가
            </Button>
          </div>

          {loading ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              불러오는 중…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border p-6 text-sm text-muted-foreground">
              등록된 보관 문서가 없습니다.
            </div>
          ) : (
            <div className="space-y-8">
              {GROUP_ORDER.map((groupKey) => {
                const items = grouped[groupKey];
                if (!items || items.length === 0) return null;
                return (
                  <div key={groupKey}>
                    <div className="mb-3">
                      <h2 className="text-lg font-bold uppercase tracking-wide text-foreground">
                        {GROUP_LABEL[groupKey]}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {GROUP_DESCRIPTION[groupKey]}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {items.map((row) => {
                        const isOpen = !!expanded[row.id];
                        const display = CARD_DISPLAY[row.prompt_key];
                        const displayTitle =
                          display?.title || row.title || row.prompt_key;
                        const isEmpty = !row.content.trim();
                        return (
                          <Card key={row.id}>
                            <CardHeader className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpanded((s) => ({ ...s, [row.id]: !isOpen }))
                                      }
                                      className="flex items-center gap-1 text-left"
                                    >
                                      {isOpen ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                      <CardTitle className="text-base">
                                        {displayTitle}
                                      </CardTitle>
                                    </button>
                                    <Badge variant="outline" className="font-mono text-[11px]">
                                      {row.prompt_key}
                                    </Badge>
                                    <Badge variant="secondary">v{row.version}</Badge>
                                    <Badge variant="outline">DB legacy</Badge>
                                    <Badge
                                      variant="outline"
                                      className={
                                        isEmpty
                                          ? "border-amber-300 bg-amber-50 text-amber-900"
                                          : "border-slate-300 bg-slate-50 text-slate-700"
                                      }
                                    >
                                      {isEmpty ? "빈 문서" : "보관 문서"}
                                    </Badge>
                                    <Badge variant="outline">
                                      {row.is_active ? "DB 활성 플래그" : "DB 비활성 플래그"}
                                    </Badge>
                                  </div>
                                  {display?.subtitle && (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {display.subtitle}
                                    </p>
                                  )}
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    업데이트: {new Date(row.updated_at).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEdit(row)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteTarget(row)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            {isOpen && (
                              <CardContent className="p-4 pt-0">
                                <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
                                  {row.content || "(비어 있음)"}
                                </pre>
                                {row.notes && (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    메모: {row.notes}
                                  </p>
                                )}
                              </CardContent>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "프롬프트 수정" : "새 프롬프트 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>prompt_key *</Label>
              <Input
                value={form.prompt_key}
                onChange={(e) => setForm((f) => ({ ...f, prompt_key: e.target.value }))}
                placeholder="예: metadata_lock_block"
              />
            </div>
            <div>
              <Label>title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="사람이 읽는 제목"
              />
            </div>
            <div>
              <Label>category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="generation / review / report / fta / golden 등"
              />
            </div>
            <div>
              <Label>content *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={12}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label>notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              <Label>활성 (is_active)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "저장 중…" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 프롬프트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.prompt_key} (v{deleteTarget?.version}) 를 영구 삭제합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
};

export default AdminPromptHarness;
