import { useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { BatchPlanItems } from "@/components/admin/BatchPlanItems";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  DIRECTION_LABEL,
  DOMAIN,
  INDUSTRY,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type LanguageDirection,
  type LearnerLevel,
} from "@/lib/pragma/enums";
import {
  auditTopicCompatibility,
  auditTopicCoverage,
  buildBatchPlan,
  productionModeCounts,
  summarizePlan,
  type BatchCell,
  type DeliveryCoverageCell,
} from "@/lib/pragma/batchPlan";
import { preflightAdminBatch } from "@/lib/pragma/adminBatchPreflight";
import {
  loadExistingCoreRunItems,
  runCoreBatch,
  type CoreCellResult,
} from "@/lib/pragma/coreBatchRun";
import {
  createCoreRunId,
} from "@/lib/pragma/coreRunIdentity";
import {
  CORE_AXIS_LABEL,
  CORE_QUALITY_AXES,
  runCoreQualityPilot,
  type CoreQualityPilotResult,
} from "@/lib/pragma/coreQualityAudit";
import { THEME_LABEL } from "@/lib/pragma/scenarioTopics";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

// 배치 생성 — 셀 목록을 순회하며 기존 생성기를 반복 호출한다.
//
// 생성 계획·분포 확인부터 AI 생성·점검·저장·재개까지 한 작업 흐름으로 제공한다.
// 연구 구인 분포와 교육용 전달 분포는 별도로 확인한다.
//
// AI 호출 전에는 관리자 세션을 선행 검사해 비용 낭비를 막는다.
// 최종 접근 제어는 다른 /admin/* 화면과 동일하게 DB(RLS·is_admin)가 맡는다.

const LEVEL_ORDER: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const LEVEL_CARD_CLASS: Record<LearnerLevel, string> = {
  beginner_intermediate: "border border-[#EAE4D2] bg-[#FAF8F2]",
  intermediate: "border border-[#EAE4D2] bg-[#FAF8F2]",
  advanced: "border border-[#EAE4D2] bg-[#FAF8F2]",
};
// summarizePlan의 조합 라벨(speechAct·level·과업)은 내부 코드라 화면에서 우리말로 옮긴다.
const humanizeCell = (label: string) => {
  const [act, level, mode] = label.split("·");
  return [SPEECH_ACT_UI[act as keyof typeof SPEECH_ACT_UI] ?? act, LEVEL[level as keyof typeof LEVEL] ?? level, mode].join(" · ");
};
const EMPTY_LEVEL_COUNTS = { beginner_intermediate: 0, intermediate: 0, advanced: 0 };
type ProductionSetting = { total: number; interpretingPercent: number };
const coreRunStorageKey = (direction: LanguageDirection) =>
  `pragma:admin-core-batch-run:${direction}`;

const getOrCreateCoreRunId = (direction: LanguageDirection) => {
  const fresh = createCoreRunId(direction);
  if (typeof window === "undefined") return fresh;
  const key = coreRunStorageKey(direction);
  const stored = window.localStorage.getItem(key);
  if (stored) return stored;
  window.localStorage.setItem(key, fresh);
  return fresh;
};

const persistCoreRunId = (direction: LanguageDirection, runId: string) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(coreRunStorageKey(direction), runId);
  }
};

const parseSelectedPlanIndexes = (raw: string, total: number) => {
  const tokens = raw.split(/[\s,]+/).filter(Boolean);
  const invalid = tokens.some((token) => {
    const value = Number(token);
    return !Number.isInteger(value) || value < 1 || value > total;
  });
  const indexes = Array.from(
    new Set(
      tokens
        .map(Number)
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= total)
        .map((value) => value - 1),
    ),
  ).sort((a, b) => a - b);
  return { indexes, invalid };
};

const AdminBatch = () => {
  // 처음 열면 예시 계획을 채워 둔다(9의 배수 → 화행마다 5건, 수준·과업 36조합 모두 채움).
  // 생성은 「전체 N건 생성 시작」을 눌러야만 시작된다.
  const [settings, setSettings] = useState<Record<LearnerLevel, ProductionSetting>>({
    beginner_intermediate: { total: 18, interpretingPercent: 0 },
    intermediate: { total: 18, interpretingPercent: 50 },
    advanced: { total: 9, interpretingPercent: 100 },
  });
  const [direction, setDirection] = useState<LanguageDirection>("ko_zh");
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [executionError, setExecutionError] = useState("");
  const [results, setResults] = useState<CoreCellResult[]>([]);
  const [done, setDone] = useState(0);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResults, setAuditResults] = useState<CoreQualityPilotResult[]>([]);
  const [auditDone, setAuditDone] = useState(0);
  const [coreRunId, setCoreRunId] = useState(() => getOrCreateCoreRunId("ko_zh"));
  const [selectedCellNumbers, setSelectedCellNumbers] = useState("");
  const [activeTotal, setActiveTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const actionRef = useRef(false);
  const busy = running || preparing || auditRunning;

  const resetExecutionDisplay = () => {
    setResults([]);
    setDone(0);
    setActiveTotal(0);
    setAuditResults([]);
    setAuditDone(0);
    setExecutionError("");
    setSelectedCellNumbers("");
  };

  const switchDirection = (d: LanguageDirection) => {
    if (busy || direction === d) return;
    resetExecutionDisplay();
    setDirection(d);
    setCoreRunId(getOrCreateCoreRunId(d));
  };

  const targetActCount = Object.keys(SPEECH_ACT_UI).length;
  const topicCoverage = useMemo(() => auditTopicCoverage(), []);
  const topicCompatibility = useMemo(() => auditTopicCompatibility(), []);
  const modeCounts = useMemo(() => Object.fromEntries(LEVEL_ORDER.map(level => [
    level, productionModeCounts(settings[level].total, settings[level].interpretingPercent),
  ])) as Record<LearnerLevel, ReturnType<typeof productionModeCounts>>, [settings]);
  const plan = useMemo(
    () => topicCoverage.missing.length === 0 && topicCompatibility.length === 0
      ? buildBatchPlan({ perLevel: EMPTY_LEVEL_COUNTS, interpretingRatio: 0, perLevelModeCounts: modeCounts }, direction)
      : [],
    [modeCounts, direction, topicCoverage.missing.length, topicCompatibility.length],
  );
  const deliveryCells = useMemo(() => LEVEL_ORDER.flatMap(level =>
    (Object.keys(modeCounts[level]) as Array<BatchCell["mode"]>)
      .filter(mode => modeCounts[level][mode] > 0)
      .flatMap(mode => Object.keys(SPEECH_ACT_UI).map(speechAct => ({
        speechAct, level, mode,
      } as DeliveryCoverageCell))),
  ), [modeCounts]);
  const summary = useMemo(() => summarizePlan(plan, undefined, deliveryCells), [plan, deliveryCells]);
  const selectedPlan = useMemo(
    () => parseSelectedPlanIndexes(selectedCellNumbers, plan.length),
    [selectedCellNumbers, plan.length],
  );
  const deliveryCellCount = deliveryCells.length;
  const selectPlanIndexes = (indexes: number[]) =>
    setSelectedCellNumbers([...new Set(indexes)].sort((a, b) => a - b).map(index => index + 1).join(", "));

  const setProductionSetting = (level: LearnerLevel, field: keyof ProductionSetting, value: number) => {
    if (busy || !Number.isFinite(value)) return;
    resetExecutionDisplay();
    const next = Math.max(0, Math.floor(value));
    setSettings(previous => ({ ...previous, [level]: {
      ...previous[level], [field]: field === "interpretingPercent" ? Math.min(100, next) : next,
    } }));
  };

  const executeBatch = async (cells: BatchCell[], runMode: "current" | "fresh", itemIndexes?: readonly number[]) => {
    if (actionRef.current || busy || !cells.length) return;
    actionRef.current = true;
    setPreparing(true);
    setExecutionError("");
    try {
      const preflight = await preflightAdminBatch();
      if ("message" in preflight) {
        setExecutionError(preflight.message);
        toast.error(preflight.message);
        return;
      }
      const targetRunId = runMode === "current" ? coreRunId : createCoreRunId(direction);
      const existingItems = runMode === "current" ? await loadExistingCoreRunItems(targetRunId) : undefined;
      if (runMode === "fresh") {
        persistCoreRunId(direction, targetRunId);
        setCoreRunId(targetRunId);
      }
      setResults([]);
      setDone(0);
      setActiveTotal(cells.length);
      setAuditResults([]);
      setAuditDone(0);
      setPreparing(false);
      setRunning(true);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const out = await runCoreBatch(cells, {
        runId: targetRunId, itemIndexes, existingItems,
        concurrency: 3, signal: ctrl.signal,
        onProgress: (count, _total, last) => {
          setDone(count);
          setResults(previous => [...previous, last]);
        },
      });
      setResults(out);
      setDone(out.length);
      // 전체 계획이 실패 없이 끝나면 다음 실행 번호로 넘긴다. 같은 번호로 다시 누르면 모두
      // 「이미 저장됨」으로 건너뛰기 때문이다. 끊겼거나 실패가 남으면 번호를 유지해 이어서 돌린다.
      if (!itemIndexes && !ctrl.signal.aborted && out.length === cells.length && out.every(result => result.ok)) {
        const next = createCoreRunId(direction);
        persistCoreRunId(direction, next);
        setCoreRunId(next);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "배치 실행 상태를 확인하지 못했습니다. 연결과 관리자 세션을 확인한 뒤 같은 ID로 재개해 주세요.";
      setExecutionError(message);
      toast.error(message);
    } finally {
      setPreparing(false);
      setRunning(false);
      abortRef.current = null;
      actionRef.current = false;
    }
  };

  const start = () => executeBatch(plan, "current");

  const startSelected = (runMode: "current" | "fresh") => {
    if (selectedPlan.invalid || selectedPlan.indexes.length === 0) {
      toast.error("현재 계획 안의 항목 번호를 쉼표로 입력해 주세요.");
      return;
    }
    const indexes = selectedPlan.indexes;
    setSelectedCellNumbers("");
    return executeBatch(indexes.map(index => plan[index]), runMode, indexes);
  };

  const stop = () => abortRef.current?.abort();

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  const reusedCount = results.filter(
    (result) => result.ok && "reused" in result && result.reused,
  ).length;
  const warnCount = results.filter((r) => r.ok && r.ruleResult === "warning").length;
  const failures = results.filter((r) => !r.ok);
  const auditableCoreResults = results.filter(
    (result): result is CoreCellResult =>
      result.ok && Boolean(result.coreContent),
  );
  const auditPass = auditResults.filter((result) => result.check?.verdict === "pass").length;
  const auditWarning = auditResults.filter((result) => result.check?.verdict === "warning").length;
  const auditFail = auditResults.filter((result) => result.check?.verdict === "fail").length;
  const auditErrors = auditResults.filter((result) => !result.ok).length;

  const startCoreAudit = async () => {
    if (actionRef.current || busy || auditableCoreResults.length === 0) return;
    actionRef.current = true;
    setAuditRunning(true);
    setAuditResults([]);
    setAuditDone(0);
    setExecutionError("");
    try {
      const out = await runCoreQualityPilot(auditableCoreResults, {
        concurrency: 2,
        onProgress: (count, _total, last) => {
          setAuditDone(count);
          setAuditResults(previous => [...previous, last]);
        },
      });
      setAuditResults(out);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 비평 결과를 불러오지 못했습니다.";
      setExecutionError(message);
      toast.error(message);
    } finally {
      setAuditRunning(false);
      actionRef.current = false;
    }
  };

  return (
    <AdminShell title="시나리오 배치 생성"
      description="조건별 생성 계획을 세우고 AI로 시나리오의 상황·원문을 생성합니다. 생성·점검·저장 결과를 확인한 뒤 학습 미션 제작으로 연결합니다.">
      <div className="space-y-5">
        <div className="space-y-5">
          <div className="min-w-0 space-y-5">
            <section aria-labelledby="batch-config-heading" className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h2 id="batch-config-heading" className="flex shrink-0 items-center gap-2 text-lg font-bold"><StepNum n={1} />생성 조건</h2>
                <div className="order-last flex w-full items-center gap-2 sm:order-none sm:ml-4 sm:w-auto">
                  <span className="text-[13px] font-semibold text-[#3F4E59]">언어 방향</span>
                  <div role="group" aria-label="언어 방향" className="inline-flex gap-1.5">
                    {(["ko_zh", "zh_ko"] as const).map(d =>
                      <button key={d} type="button" aria-pressed={direction === d} disabled={busy} onClick={() => switchDirection(d)}
                        className={"h-9 rounded-md px-5 text-[13.5px] transition-colors disabled:opacity-60 " + (direction === d ? "border-2 border-[#BA7517] bg-[#FBEFD9] font-semibold text-[#7A4A0A]" : "border border-[#EAE4D2] bg-white font-medium text-[#3F4E59] hover:bg-[#FAF8F2]")}>
                        {DIRECTION_LABEL[d]}
                      </button>)}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {LEVEL_ORDER.map(level => {
                  const counts = modeCounts[level];
                  return <div key={level} role="group" aria-label={LEVEL[level] + " 생성 설정"} className={"min-w-0 rounded-lg px-3 py-2 transition-shadow " + LEVEL_CARD_CLASS[level] + ""}>
                    <p className="flex flex-wrap items-baseline gap-x-2 font-bold">
                      <span className="text-sm">{LEVEL[level]}</span>
                      <span className="text-xl leading-6 tabular-nums">{settings[level].total}<span className="ml-1 text-xs font-medium">건</span></span>
                    </p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <div className="min-w-0">
                        <Label htmlFor={"batch-total-" + level} className="text-[13px]">생성 건수</Label>
                        <Input id={"batch-total-" + level} aria-label={LEVEL[level] + " · 총 생성 건수"} type="number" min={0} step={1} value={settings[level].total}
                          disabled={busy} onChange={event => setProductionSetting(level, "total", Number(event.target.value))} className="mt-1 h-8 bg-white px-2" />
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor={"batch-percent-" + level} className="whitespace-nowrap text-[13px]">통역(%)</Label>
                        <Input id={"batch-percent-" + level} aria-label={LEVEL[level] + " · 통역 비율"} type="number" min={0} max={100} step={1} value={settings[level].interpretingPercent}
                          disabled={busy} onChange={event => setProductionSetting(level, "interpretingPercent", Number(event.target.value))} className="mt-1 h-8 bg-white px-2" />
                      </div>
                    </div>
                    <p className="mt-1 text-[12.5px] tabular-nums text-[#4E5A63]">번역 {counts.translation} · 통역 {counts.stt_interpreting}</p>
                  </div>;
                })}
              </div>
            </section>

            <section aria-labelledby="batch-plan-heading" className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="batch-plan-heading" className="flex items-center gap-2 text-lg font-bold"><StepNum n={2} />생성 계획·분포</h2>
              </div>
              {/* 넓은 화면에서는 건수 3개와 분포 충족도 2개를 한 줄에 둔다(7칸 = 1칸×3 + 2칸×2).
                  「화행 N개」 카드는 뺐다 — 생성 건수가 아닌 값이 건수 카드 사이에 섞여 단위가 헷갈렸다. 화행은 아래 화행별이 보여 준다. */}
              <div className="mt-3 grid grid-cols-3 gap-2.5 lg:grid-cols-7">
                <PlanMetric label="총 생성 예정" value={summary.total} primary />
                <PlanMetric label="번역" value={summary.translation} />
                <PlanMetric label="통역" value={summary.interpreting} />
                {summary.total > 0 && <>
                  {/* 제목과 설명이 같은 말을 되풀이해서, 조합 식 하나를 제목으로 쓴다. */}
                  <CoverageCard className="border-[#EAE4D2] bg-[#FAF8F2] lg:col-span-2" title="화행 × 수준 × 번역/통역" filled={deliveryCellCount - summary.emptyActLevelModeCells.length} total={deliveryCellCount} />
                  <CoverageCard className="border-[#EAE4D2] bg-[#FAF8F2] lg:col-span-2" title="화행 × P × D × R" filled={targetActCount * 27 - summary.emptyActPdrCells.length} total={targetActCount * 27} />
                </>}
              </div>
              {topicCoverage.missing.length > 0 && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-900">생성 시드가 없는 조건: {topicCoverage.missing.map(({ speechAct, domain }) => SPEECH_ACT_UI[speechAct] + " · " + DOMAIN[domain]).join(", ")}. 조건을 보완한 뒤 실행할 수 있습니다.</p>}
              {topicCompatibility.length > 0 && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-900">관계·거리·모드와 호환되는 생성 시드가 없는 조합 {topicCompatibility.length}개가 있습니다. 시드 조건을 먼저 조정해 주세요.</p>}
              {topicCoverage.wildcardOnly.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">화행 중립 시드를 사용하는 조건: {topicCoverage.wildcardOnly.map(({ speechAct, domain }) => SPEECH_ACT_UI[speechAct] + " · " + DOMAIN[domain]).join(", ")}. 생성 결과에서 화행 적합성을 확인해 주세요.</p>}

              {summary.total === 0 ? (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-[#D9D2BF] bg-[#FAF8F2] px-4 py-5">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FBEFD9] text-[#7A4A0A]"><Sparkles className="h-4 w-4" aria-hidden /></span>
                  <p className="text-sm font-medium text-[#3F4E59]">① 에서 건수를 정하면 화행·관계 분포가 여기에 채워집니다.</p>
                </div>
              ) : <>
              {summary.emptyActLevelModeCells.length > 0 && <p className="mt-2 break-words text-xs leading-5 text-amber-800">아직 비어 있는 조합: {summary.emptyActLevelModeCells.map(humanizeCell).join(", ")}</p>}

              {/* 수준별·도메인별은 항목이 짧아 좁게 둔다(이름과 숫자가 멀어지면 짝이 안 읽힌다). */}
              <div className="mt-3 grid items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-[0.75fr_0.75fr_1fr_1fr] lg:items-stretch">
                <Dist title="수준별" rows={LEVEL_ORDER.map(level => [LEVEL[level], summary.byLevel[level] ?? 0])} />
                <Dist title="도메인별" rows={Object.entries(DOMAIN).map(([key, label]) => [label, summary.byDomain[key] ?? 0])} />
                <Dist className="border border-[#EAE4D2] bg-[#FAF8F2] lg:row-span-2" title="편성 주제별" rows={Object.entries(THEME_LABEL).map(([key, label]) => [label, summary.byTheme[key] ?? 0])} />
                <Dist className="border border-[#EAE4D2] bg-[#FAF8F2] lg:row-span-2" title="업종 배경별 (직장)" rows={Object.entries(INDUSTRY).map(([key, label]) => [label, summary.byIndustry[key] ?? 0])} />
                {/* 수준별·도메인별 아래 빈자리를 화행별이 채운다(넓은 화면 기준 1~2열, 두 번째 줄). */}
                <div className="rounded-lg border border-[#EAE4D2] bg-[#FAF8F2] px-3 py-2 sm:col-span-2">
                  <h3 className="text-[13.5px] font-semibold">화행별</h3>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">{Object.entries(SPEECH_ACT_UI).map(([key, label]) =>
                    <Badge key={key} variant="outline" className="gap-2 bg-white py-0.5 text-[13px] font-normal">{label}<span className="font-semibold tabular-nums">{summary.bySpeechAct[key] ?? 0}</span></Badge>)}</div>
                </div>
              </div>
              </>}
            </section>
            {/* 생성 실행은 따로 단계를 두지 않는다 — 항목을 고른 표 바로 아래에서 시작한다. */}
            <BatchPlanItems plan={plan} selected={selectedPlan.indexes} disabled={busy} onSelect={selectPlanIndexes} footer={
          <div id="batch-execution" aria-label="생성 실행" className="scroll-mt-20">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <p className="text-xs text-muted-foreground">{DIRECTION_LABEL[direction]} · 총 {summary.total}건 계획</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button className="h-10 min-w-[220px] gap-1.5 bg-[#15202B] text-[14px] font-semibold text-white hover:bg-[#15202B]/90 disabled:cursor-not-allowed disabled:bg-[#56636D] disabled:opacity-100" onClick={selectedPlan.indexes.length > 0 ? () => startSelected("current") : start} disabled={busy || plan.length === 0}>
                  <Sparkles className="h-4 w-4 text-[#FAD338]" aria-hidden />
                  {preparing ? "실행 준비 중…" : running ? "AI 생성 중…" : selectedPlan.indexes.length > 0 ? "선택 " + selectedPlan.indexes.length + "건 생성 시작" : "전체 " + summary.total + "건 생성 시작"}
                </Button>
                {running && <Button className="h-10" variant="outline" onClick={stop}>생성 중단</Button>}
              </div>
            </div>
            {executionError && <p role="alert" className="mt-3 text-xs leading-5 text-red-800">{executionError}</p>}
            {activeTotal > 0 && <div className="mt-4" aria-live="polite">
              <div className="mb-2 flex justify-between text-xs"><span>{running ? "생성·저장 진행" : done < activeTotal ? "중단된 실행" : "실행 완료"}</span><span>{done} / {activeTotal}</span></div>
              <Progress value={(done / Math.max(1, activeTotal)) * 100} aria-label="배치 생성 진행률" />
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><dt className="text-muted-foreground">새로 저장</dt><dd className="mt-1 font-bold">{okCount - reusedCount}건</dd></div>
                <div><dt className="text-muted-foreground">기존 저장 재사용</dt><dd className="mt-1 font-bold">{reusedCount}건</dd></div>
                <div><dt className="text-muted-foreground">경고 포함</dt><dd className="mt-1 font-bold">{warnCount}건</dd></div>
                <div><dt className="text-muted-foreground">실패</dt><dd className="mt-1 font-bold">{failCount}건</dd></div>
              </dl>
            </div>}
          </div>} />
          </div>
        </div>

        {failures.length > 0 && <section aria-label="배치 생성 실패" className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold text-red-900">실패 {failures.length}건 · 조건과 사유</h2>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => selectPlanIndexes(failures.map(result => result.index))}>실패 항목 선택</Button>
          </div>
          <ul className="mt-3 max-h-80 space-y-2 overflow-auto text-xs leading-5 text-red-900">{failures.map(result =>
            <li key={result.index}>#{result.index + 1} {SPEECH_ACT_UI[result.cell.speech_act_ui]} · {LEVEL[result.cell.level]} · {DOMAIN[result.cell.domain]} — {result.ruleFailFirst ?? result.error}
              {typeof result.coreContent?.situation_ko === "string" && <p className="mt-1">생성 상황 · {result.coreContent.situation_ko}</p>}
            </li>)}</ul>
        </section>}
        {auditableCoreResults.length > 0 && !running && !preparing && (
          <div className="mt-4 rounded-lg border border-[#EAE4D2] bg-[#FAF8F2] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold">설계 기준 준수 AI 비평 파일럿</div>
              </div>
              <Button
                variant="outline"
                onClick={startCoreAudit}
                disabled={busy}
              >
                {auditRunning
                  ? `비평 중 ${auditDone}/${auditableCoreResults.length}`
                  : `${auditableCoreResults.length}건 비평 실행`}
              </Button>
            </div>

            {auditResults.length > 0 && (
              <div className="mt-3">
                <p className="text-[12.5px] font-semibold">
                  pass {auditPass} · warning {auditWarning} · fail {auditFail} · 호출 실패 {auditErrors}
                </p>
                <ul className="mt-2 max-h-80 space-y-2 overflow-auto text-[11.5px]">
                  {auditResults.map((result) => {
                    const cell = result.source.cell;
                    const core = result.source.coreContent as {
                      situation_ko?: string;
                      relation_ko?: string;
                      source_text?: string;
                      preceding_turn?: string | null;
                      context_spec?: {
                        role_pair?: { speaker_ko?: string; addressee_ko?: string };
                        decision_authority?: string;
                      };
                    };
                    const flaggedAxes = result.check
                      ? CORE_QUALITY_AXES.filter(
                          (axis) => result.check?.axes[axis] && result.check.axes[axis].verdict !== "pass",
                        )
                      : [];
                    return (
                      <li key={result.index} className="rounded-md border bg-white px-3 py-2">
                        <div className="font-semibold">
                          #{result.index + 1} {SPEECH_ACT_UI[cell.speech_act_ui]} · {DOMAIN[cell.domain]} ·{" "}
                          {MODE_LABEL[cell.mode]} — {result.check?.verdict ?? "error"}
                        </div>
                        <div className="mt-0.5 text-muted-foreground">
                          {result.check?.summary_ko ?? result.error}
                        </div>
                        {flaggedAxes.map((axis) => (
                          <div key={axis} className="mt-1 text-amber-900">
                            {CORE_AXIS_LABEL[axis]} {result.check?.axes[axis]?.verdict}:{" "}
                            {result.check?.axes[axis]?.reason_ko}
                          </div>
                        ))}
                        {result.check && result.check.verdict !== "pass" && (
                          <div className="mt-2 space-y-0.5 rounded bg-[#FAF8F2] px-2.5 py-2 text-[11px] leading-relaxed">
                            <div>상황 · {core.situation_ko ?? "—"}</div>
                            <div>관계 · {core.relation_ko ?? "—"}</div>
                            {core.preceding_turn && <div>상대의 직전 발화 · {core.preceding_turn}</div>}
                            <div>원문 · {core.source_text ?? "—"}</div>
                            {core.context_spec?.role_pair && (
                              <div>
                                기대 역할 · {core.context_spec.role_pair.speaker_ko ?? "—"} →{" "}
                                {core.context_spec.role_pair.addressee_ko ?? "—"}
                              </div>
                            )}
                            {core.context_spec?.decision_authority && (
                              <div>결정 권한 · {core.context_spec.decision_authority}</div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
};

const StepNum = ({ n }: { n: number }) =>
  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FBEFD9] text-xs font-bold text-[#7A4A0A]">{n}</span>;

const PlanMetric = ({ label, value, unit = "건", primary = false, className = "border border-[#EAE4D2] bg-[#FAF8F2]" }: { label: string; value: number; unit?: string; primary?: boolean; className?: string }) =>
  <div className={"rounded-lg px-3 py-2 " + (primary ? "bg-[#15202B] text-white" : className)}>
    <p className="text-[13px] font-medium">{label}</p><p className="mt-1 text-2xl font-bold leading-7 tabular-nums">{value}<span className="ml-1 text-xs font-normal">{unit}</span></p>
  </div>;

const CoverageCard = ({ title, filled, total, className = "border-[#EAE4D2] bg-[#FAF8F2]" }: { title: string; filled: number; total: number; className?: string }) =>
  <div className={"flex flex-col justify-center rounded-lg border px-3 py-2 " + className}>
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-[14px] font-semibold text-[#15202B]">{title}</h3><span className="text-[14px] font-semibold tabular-nums text-[#15202B]">{filled} / {total}<span className="ml-0.5 text-[12.5px] font-normal text-[#4E5A63]">조합</span></span></div>
    <Progress className="mt-2.5 h-1.5" value={total ? filled / total * 100 : 0} aria-label={title} />
  </div>;


const Dist = ({ title, rows, className = "border border-[#EAE4D2] bg-[#FAF8F2]" }: { title: string; rows: [string, number][]; className?: string }) => (
  <div className={"rounded-lg px-3 py-2 " + className}>
    <div className="text-[13.5px] font-semibold">{title}</div>
    {/* 칸이 넓어도 이름과 숫자가 한눈에 짝지어지도록 목록 폭을 제한한다. */}
    <ul className="mt-1.5 max-w-[220px] space-y-0.5">
      {rows.map(([label, n]) => (
        <li key={label} className="flex items-baseline justify-between gap-3 text-[13.5px]">
          <span className="text-[#4E5A63]">{label}</span>
          <span className={n === 0 ? "font-semibold text-[#B9AF97]" : "font-semibold text-[#15202B]"}>{n}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default AdminBatch;
