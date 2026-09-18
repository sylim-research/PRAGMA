import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";
import { PROMPT_SNAPSHOT, type PromptSnapshotEntry } from "@/lib/pragma/promptSnapshot.generated";
import { ACTIVE_RULE_IDS } from "@/lib/pragma/missionRules";

// ── 저장소 정본(읽기 전용) ─────────────────────────────────────────────
// 이 섹션의 원문은 promptSnapshot.generated.ts에서 온다. 그 파일은 build마다
// 실제 edge 소스에서 자동 재생성되므로(prebuild) 화면이 코드보다 낡을 수 없다.
// 편집 경로는 만들지 않는다 — 프롬프트를 고치려면 코드를 고쳐야 한다.
const SNAPSHOT_GROUP_LABEL: Record<string, string> = {
  core: "상황 시나리오 생성",
  mission: "학습 미션 조립 (MJT + DCT)",
  review: "프롬프트 통제 기반 검토",
  runtime: "학습자 피드백",
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
          규칙 검사와 AI 검토가 근거를 제시하고, 교수자가 감수해 최종 승인합니다.
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
        모델에 실제로 보내는 지시문을 모델 설정·출력 형식·지문과 함께 보여 줍니다. 호출마다
        달라지는 입력값은 각 시나리오에 따로 저장됩니다.
      </p>

      <div className="mt-3 grid gap-2 text-[12.5px] sm:grid-cols-2">
        <div className="rounded-lg border border-[#EAE4D2] bg-white px-3 py-2">
          <div className="text-[11.5px] text-muted-foreground">상황 시나리오 생성 지시문의 지문 (SHA-256)</div>
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

      {/* 지문이 없는 현행분 — 생성 함수를 거치지 않고 직접 등록된 변환·집필본이다(2026-09-19 실측: 현행 80건 모두 09-13~09-18).
          숨기지 않고 정직하게 표기한다(소급 기록 금지). */}
      {!loading && !error && legacyNull && (
        <p className="mt-2 max-w-[46rem] rounded-lg bg-[#F6F3EA] px-3 py-2 text-[12px] text-[#4F5D68]">
          지문이 기록되지 않은 현행 시나리오 <b>{legacyNull.count}건</b>({legacyNull.first.slice(0, 10)} ~{" "}
          {legacyNull.last.slice(0, 10)}) — 생성 함수를 거치지 않고 직접 등록된 시나리오(변환·집필본)입니다.
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
        기준 시점 {new Date(snap.generated_at).toLocaleString()} · 출처 {snap.edge_source}
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

const AdminPromptHarness = () => {
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

  useEffect(() => {
    void loadUsed();
  }, [loadUsed]);

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
    </AdminShell>
  );
};

export default AdminPromptHarness;
