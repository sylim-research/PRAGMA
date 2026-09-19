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
  isCoreRunIdForDirection,
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
  beginner_intermediate: "bg-[#EDF4FA]",
  intermediate: "bg-[#EEF5F0]",
  advanced: "bg-[#EDF3F4]",
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
  const [resumeRunId, setResumeRunId] = useState("");
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
    setResumeRunId("");
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
    return executeBatch(selectedPlan.indexes.map(index => plan[index]), runMode, selectedPlan.indexes);
  };

  const stop = () => abortRef.current?.abort();

  const startFreshCoreRun = () => {
    if (busy) return;
    if (
      results.length > 0
      && !window.confirm("새 배치 ID를 만들면 다음 실행은 기존 저장분을 건너뛰지 않습니다. 계속할까요?")
    ) {
      return;
    }
    const next = createCoreRunId(direction);
    persistCoreRunId(direction, next);
    setCoreRunId(next);
    resetExecutionDisplay();
    toast.success("새 배치 ID를 만들었습니다.");
  };

  const loadCoreRunId = () => {
    if (busy) return;
    const next = resumeRunId.trim();
    if (!isCoreRunIdForDirection(next, direction)) {
      toast.error(`${DIRECTION_LABEL[direction]} 방향의 시나리오 배치 ID를 입력해 주세요.`);
      return;
    }
    persistCoreRunId(direction, next);
    setCoreRunId(next);
    setResumeRunId("");
    resetExecutionDisplay();
    toast.success("기존 배치 ID를 불러왔습니다.");
  };

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
      description="조건별 생성 계획을 세우고 AI로 상황·원문을 자동 제작합니다. 생성·점검·저장 결과를 확인한 뒤 학습 미션 조립으로 연결합니다.">
      <div className="space-y-5">
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <section aria-labelledby="batch-config-heading" className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h2 id="batch-config-heading" className="flex shrink-0 items-center gap-2 text-lg font-bold"><StepNum n={1} />생성 조건</h2>
                <div role="group" aria-label="언어 방향" className="order-last flex w-full gap-1.5 sm:order-none sm:w-auto">
                  <Button size="sm" className="h-8 px-3" variant={direction === "ko_zh" ? "default" : "outline"} aria-pressed={direction === "ko_zh"} disabled={busy} onClick={() => switchDirection("ko_zh")}>한→중</Button>
                  <Button size="sm" className="h-8 px-3" variant={direction === "zh_ko" ? "default" : "outline"} aria-pressed={direction === "zh_ko"} disabled={busy} onClick={() => switchDirection("zh_ko")}>중→한</Button>
                </div>
              </div>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {LEVEL_ORDER.map(level => {
                  const counts = modeCounts[level];
                  return <div key={level} role="group" aria-label={LEVEL[level] + " 생성 설정"} className={"min-w-0 rounded-lg px-3 py-2 transition-shadow " + LEVEL_CARD_CLASS[level] + (settings[level].total > 0 ? " ring-1 ring-[#D9B51C]/50" : "")}>
                    <p className="flex flex-wrap items-baseline gap-x-2 font-bold">
                      <span className="text-sm">{LEVEL[level]}</span>
                      <span className="text-xl leading-6 tabular-nums">{settings[level].total}<span className="ml-1 text-xs font-medium">건</span></span>
                    </p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <div className="min-w-0">
                        <Label htmlFor={"batch-total-" + level} className="text-xs">생성 건수</Label>
                        <Input id={"batch-total-" + level} aria-label={LEVEL[level] + " · 총 생성 건수"} type="number" min={0} step={1} value={settings[level].total}
                          disabled={busy} onChange={event => setProductionSetting(level, "total", Number(event.target.value))} className="mt-1 h-8 bg-white px-2" />
                      </div>
                      <div className="min-w-0">
                        <Label htmlFor={"batch-percent-" + level} className="whitespace-nowrap text-xs">통역(%)</Label>
                        <Input id={"batch-percent-" + level} aria-label={LEVEL[level] + " · 통역 비율"} type="number" min={0} max={100} step={1} value={settings[level].interpretingPercent}
                          disabled={busy} onChange={event => setProductionSetting(level, "interpretingPercent", Number(event.target.value))} className="mt-1 h-8 bg-white px-2" />
                      </div>
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">번역 {counts.translation} · 통역 {counts.stt_interpreting}</p>
                  </div>;
                })}
              </div>
            </section>

            <section aria-labelledby="batch-plan-heading" className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="batch-plan-heading" className="flex items-center gap-2 text-lg font-bold"><StepNum n={2} />생성 계획·분포</h2>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                <PlanMetric label="총 생성 예정" value={summary.total} primary />
                <PlanMetric label="번역" value={summary.translation} />
                <PlanMetric label="통역" value={summary.interpreting} className="bg-[#EEF5F0]" />
                <PlanMetric label="화행" value={Object.keys(summary.bySpeechAct).length} unit="개" className="bg-[#EDF3F4]" />
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
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <CoverageCard title="화행·수준·과업 분포" filled={deliveryCellCount - summary.emptyActLevelModeCells.length} total={deliveryCellCount}
                  description="화행 × 수준 × 번역/통역" />
                <CoverageCard title="관계·거리·부담 분포" className="border-[#D8E5DC] bg-[#F6FAF7]" filled={targetActCount * 27 - summary.emptyActPdrCells.length} total={targetActCount * 27}
                  description="화행 × P × D × R" />
              </div>
              {summary.emptyActLevelModeCells.length > 0 && <p className="mt-2 break-words text-xs leading-5 text-amber-800">아직 비어 있는 조합: {summary.emptyActLevelModeCells.map(humanizeCell).join(", ")}</p>}

              <div className="mt-3 grid items-start gap-2.5 sm:grid-cols-2">
                <Dist title="수준별" rows={LEVEL_ORDER.map(level => [LEVEL[level], summary.byLevel[level] ?? 0])} />
                <Dist title="도메인별" className="bg-[#EEF5F0]" rows={Object.entries(DOMAIN).map(([key, label]) => [label, summary.byDomain[key] ?? 0])} />
                <Dist title="테마별" rows={Object.entries(THEME_LABEL).map(([key, label]) => [label, summary.byTheme[key] ?? 0])} />
                <Dist title="직장 도메인 · 산업별" className="bg-[#EEF5F0]" rows={Object.entries(INDUSTRY).map(([key, label]) => [label, summary.byIndustry[key] ?? 0])} />
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-semibold">화행별</h3>
                <div className="mt-2 flex flex-wrap gap-2">{Object.entries(SPEECH_ACT_UI).map(([key, label]) =>
                  <Badge key={key} variant="outline" className="gap-2 py-1 font-normal">{label}<span className="font-semibold tabular-nums">{summary.bySpeechAct[key] ?? 0}</span></Badge>)}</div>
              </div>
              </>}
            </section>
            <BatchPlanItems plan={plan} selected={selectedPlan.indexes} disabled={busy} onSelect={selectPlanIndexes} />
          </div>

          <aside id="batch-execution" aria-labelledby="batch-execution-heading" className="min-w-0 scroll-mt-20 rounded-xl border bg-white p-5 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto">
            <h2 id="batch-execution-heading" className="flex items-center gap-2 text-lg font-bold"><StepNum n={3} />생성 실행</h2>
            <p className="mt-2 text-xs text-muted-foreground">{DIRECTION_LABEL[direction]} · 총 {summary.total}건 계획</p>
            <Button className="mt-4 h-10 w-full gap-1.5 bg-[#15202B] text-[14px] font-semibold text-white hover:bg-[#15202B]/90 disabled:cursor-not-allowed disabled:bg-[#56636D] disabled:opacity-100" onClick={start} disabled={busy || plan.length === 0}>
              <Sparkles className="h-4 w-4 text-[#FAD338]" aria-hidden />
              {preparing ? "실행 준비 중…" : running ? "AI 생성 중…" : "전체 " + summary.total + "건 생성 시작"}
            </Button>
            {running && <Button className="mt-2 w-full" variant="outline" onClick={stop}>생성 중단</Button>}
            {executionError && <p role="alert" className="mt-3 text-xs leading-5 text-red-800">{executionError}</p>}
            {activeTotal > 0 && <div className="mt-4" aria-live="polite">
              <div className="mb-2 flex justify-between text-xs"><span>{running ? "생성·저장 진행" : done < activeTotal ? "중단된 실행" : "실행 완료"}</span><span>{done} / {activeTotal}</span></div>
              <Progress value={(done / Math.max(1, activeTotal)) * 100} aria-label="배치 생성 진행률" />
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-muted-foreground">새로 저장</dt><dd className="mt-1 font-bold">{okCount - reusedCount}건</dd></div>
                <div><dt className="text-muted-foreground">기존 저장 재사용</dt><dd className="mt-1 font-bold">{reusedCount}건</dd></div>
                <div><dt className="text-muted-foreground">경고 포함</dt><dd className="mt-1 font-bold">{warnCount}건</dd></div>
                <div><dt className="text-muted-foreground">실패</dt><dd className="mt-1 font-bold">{failCount}건</dd></div>
              </dl>
            </div>}

            <details open className="mt-5 border-t pt-4">
              <summary className="cursor-pointer text-sm font-semibold">이어서 하기·불러오기</summary>
              <div className="mt-3 rounded-lg bg-[#FAF8F2] p-3">
                <p className="text-xs font-semibold">지금 실행 번호</p>
                <code className="mt-1.5 block break-all text-[11px] text-[#5A6670]">{coreRunId}</code>
              </div>
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-semibold">고른 항목만 생성</h3>
              <Label htmlFor="selected-core-cells" className="mt-3 block text-xs">선택 항목 번호</Label>
              <Input id="selected-core-cells" value={selectedCellNumbers} disabled={busy} className="mt-2"
                onChange={event => setSelectedCellNumbers(event.target.value)} placeholder="예: 13, 14, 17" aria-invalid={selectedPlan.invalid} />
              {selectedPlan.invalid && <p role="alert" className="mt-2 text-xs text-red-800">1–{plan.length} 사이의 정수 번호를 쉼표로 구분해 주세요.</p>}
              <Button className="mt-3 w-full border-[#15202B]/30 font-semibold text-[#15202B] hover:bg-[#F3F0E7] disabled:border-[#D9D2BF] disabled:text-[#56636D] disabled:opacity-100" variant="outline" disabled={busy || selectedPlan.invalid || !selectedPlan.indexes.length}
                onClick={() => startSelected("current")}>선택 {selectedPlan.indexes.length}건 · 이어서 생성</Button>
              <Button className="mt-2 w-full border-[#15202B]/30 font-semibold text-[#15202B] hover:bg-[#F3F0E7] disabled:border-[#D9D2BF] disabled:text-[#56636D] disabled:opacity-100" variant="outline" disabled={busy || selectedPlan.invalid || !selectedPlan.indexes.length}
                onClick={() => startSelected("fresh")}>선택 {selectedPlan.indexes.length}건 · 새로 생성</Button>
            </div>

            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-semibold">지난 실행 불러오기</h3>
              <Label htmlFor="resume-core-run-id" className="mt-3 block text-xs">지난 실행 번호</Label>
              <Input id="resume-core-run-id" value={resumeRunId} disabled={busy} className="mt-2 min-w-0 font-mono text-xs"
                onChange={event => setResumeRunId(event.target.value)} placeholder={"core_" + direction + "_…"} />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="border-[#15202B]/30 font-semibold text-[#15202B] hover:bg-[#F3F0E7] disabled:border-[#D9D2BF] disabled:text-[#56636D] disabled:opacity-100" onClick={loadCoreRunId} disabled={busy || !resumeRunId.trim()}>불러오기</Button>
                <Button size="sm" variant="outline" className="border-[#15202B]/30 font-semibold text-[#15202B] hover:bg-[#F3F0E7] disabled:border-[#D9D2BF] disabled:text-[#56636D] disabled:opacity-100" onClick={startFreshCoreRun} disabled={busy}>새 실행 시작</Button>
              </div>
            </div>
            </details>
          </aside>
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

const PlanMetric = ({ label, value, unit = "건", primary = false, className = "bg-[#EDF4FA]" }: { label: string; value: number; unit?: string; primary?: boolean; className?: string }) =>
  <div className={"rounded-lg px-3 py-2 " + (primary ? "bg-[#15202B] text-white" : className)}>
    <p className="text-xs">{label}</p><p className="mt-1 text-2xl font-bold leading-7 tabular-nums">{value}<span className="ml-1 text-xs font-normal">{unit}</span></p>
  </div>;

const CoverageCard = ({ title, filled, total, description, className = "border-[#D6E2EB] bg-[#F6F9FC]" }: { title: string; filled: number; total: number; description: string; className?: string }) =>
  <div className={"rounded-lg border px-3 py-2 " + className}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><h3 className="font-semibold">{title}</h3><span className="tabular-nums">{filled} / {total}조합</span></div>
    <Progress className="mt-2 h-1.5" value={total ? filled / total * 100 : 0} aria-label={title} />
    <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
  </div>;


const Dist = ({ title, rows, className = "bg-[#EDF4FA]" }: { title: string; rows: [string, number][]; className?: string }) => (
  <div className={"rounded-lg px-3 py-2 " + className}>
    <div className="text-[12.5px] font-semibold">{title}</div>
    <ul className="mt-1.5 space-y-0.5">
      {rows.map(([label, n]) => (
        <li key={label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
          <span className="text-muted-foreground">{label}</span>
          <span className={n === 0 ? "font-semibold text-amber-700" : "font-semibold"}>{n}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default AdminBatch;
