import { useMemo, useRef, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
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
  DEFAULT_QUOTA,
  FULL_BATCH_QUOTA_495,
  ZH_KO_VALIDATION_ACTS,
  ZH_KO_VALIDATION_DELIVERY_CELLS,
  auditTopicCompatibility,
  auditTopicCoverage,
  buildBatchPlan,
  buildZhKoValidationPlan,
  interpretingCount,
  summarizePlan,
  type BatchQuota,
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
  type CoreQualityAxis,
  type CoreQualityPilotResult,
} from "@/lib/pragma/coreQualityAudit";
import { THEME_LABEL } from "@/lib/pragma/scenarioTopics";
import { toast } from "sonner";

// 배치 생성 — 셀 목록을 순회하며 기존 생성기를 반복 호출한다.
//
// 이 화면의 핵심은 '실행'이 아니라 **실행 전 분포 검산**이다.
// 화행 × 수준만 채우면 개수는 늘어도 도메인·산업·통역이 한쪽으로 쏠리고,
// 교강사가 "직장 · 무역" 필터를 눌렀을 때 0건이 나온다.
// 그래서 계획을 먼저 보여주고, 무엇이 몇 개 생기는지 눈으로 확인한 뒤 돌린다.
//
// AI 호출 전에는 관리자 세션을 선행 검사해 비용 낭비를 막는다.
// 최종 접근 제어는 다른 /admin/* 화면과 동일하게 DB(RLS·is_admin)가 맡는다.

const LEVEL_ORDER: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
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
  const [quota, setQuota] = useState<BatchQuota>(DEFAULT_QUOTA);
  // 언어 방향(0-l·89) — zh_ko는 고정 9화행·30셀 혼합 파일럿으로 전환.
  const [direction, setDirection] = useState<LanguageDirection>("ko_zh");
  const [running, setRunning] = useState(false);
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

  const switchDirection = (d: LanguageDirection) => {
    if (running) return;
    setDirection(d);
    if (d === "ko_zh") setQuota(DEFAULT_QUOTA);
    setCoreRunId(getOrCreateCoreRunId(d));
    setResumeRunId("");
  };

  const targetActs = direction === "zh_ko" ? ZH_KO_VALIDATION_ACTS : undefined;
  const targetActCount = targetActs?.length ?? Object.keys(SPEECH_ACT_UI).length;
  const topicCoverage = useMemo(() => auditTopicCoverage(targetActs), [targetActs]);
  const topicCompatibility = useMemo(
    () => auditTopicCompatibility(targetActs),
    [targetActs],
  );
  const plan = useMemo(
    () =>
      topicCoverage.missing.length === 0 && topicCompatibility.length === 0
        ? direction === "zh_ko"
          ? buildZhKoValidationPlan()
          : buildBatchPlan(quota, direction)
        : [],
    [
      quota,
      direction,
      topicCoverage.missing.length,
      topicCompatibility.length,
    ],
  );
  // zh_ko는 핵심 3화행 18셀 + 확장 6화행 중급 12셀의 명시 커버리지만 감사한다.
  const summary = useMemo(
    () => summarizePlan(
      plan,
      targetActs,
      direction === "zh_ko" ? ZH_KO_VALIDATION_DELIVERY_CELLS : undefined,
    ),
    [direction, plan, targetActs],
  );
  const selectedPlan = useMemo(
    () => parseSelectedPlanIndexes(selectedCellNumbers, plan.length),
    [selectedCellNumbers, plan.length],
  );
  const isLargeKoZhBatch = direction === "ko_zh" && summary.total >= 400;
  const isApprovedFullBatch =
    direction === "ko_zh" &&
    summary.total === 495 &&
    summary.emptyActPdrCells.length === 0 &&
    summary.minActPdrCount >= 2 &&
    summary.emptyActLevelModeCells.length === 0 &&
    summary.minActLevelModeCount >= 3;
  const fullBatchBlocked = isLargeKoZhBatch && !isApprovedFullBatch;

  const setLevelQuota = (level: LearnerLevel, value: number) =>
    setQuota((q) => ({ ...q, perLevel: { ...q.perLevel, [level]: Math.max(0, value) } }));

  const loadFullBatchPreset = () => {
    if (running) return;
    setDirection("ko_zh");
    setQuota(FULL_BATCH_QUOTA_495);
    const next = createCoreRunId("ko_zh");
    persistCoreRunId("ko_zh", next);
    setCoreRunId(next);
  };

  const start = async () => {
    if (fullBatchBlocked) {
      toast.error("400건 이상 본배치는 승인된 495 프리셋과 243·54셀 게이트를 모두 충족해야 합니다.");
      return;
    }
    const preflight = await preflightAdminBatch();
    if ("message" in preflight) {
      toast.error(preflight.message);
      return;
    }

    let existingItems: Awaited<ReturnType<typeof loadExistingCoreRunItems>>;
    try {
      existingItems = await loadExistingCoreRunItems(coreRunId);
    } catch {
      toast.error("기존 배치 진행 상태를 읽지 못했습니다. 다시 로그인한 뒤 실행해 주세요.");
      return;
    }
    if (existingItems.size > 0) {
      toast.info(`같은 배치 ID로 저장된 ${existingItems.size}건은 AI 호출 없이 건너뜁니다.`);
    }

    setRunning(true);
    setResults([]);
    setDone(0);
    setActiveTotal(plan.length);
    setAuditResults([]);
    setAuditDone(0);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const onProgress = (d: number, _total: number, last: CoreCellResult) => {
      setDone(d);
      setResults((prev) => [...prev, last]);
    };
    const out = await runCoreBatch(plan, {
      runId: coreRunId,
      existingItems,
      concurrency: 3,
      signal: ctrl.signal,
      onProgress,
    });
    setResults(out);
    setRunning(false);
    abortRef.current = null;
  };

  const startSelected = async (runMode: "current" | "fresh") => {
    if (selectedPlan.invalid || selectedPlan.indexes.length === 0) {
      toast.error("현재 계획 안의 셀 번호를 쉼표로 입력해 주세요.");
      return;
    }
    const preflight = await preflightAdminBatch();
    if ("message" in preflight) {
      toast.error(preflight.message);
      return;
    }

    const selectedCells = selectedPlan.indexes.map((index) => plan[index]);
    const targetRunId = runMode === "current" ? coreRunId : createCoreRunId(direction);
    let existingItems: Awaited<ReturnType<typeof loadExistingCoreRunItems>> | undefined;
    if (runMode === "current") {
      try {
        existingItems = await loadExistingCoreRunItems(targetRunId);
      } catch {
        toast.error("기존 배치 진행 상태를 읽지 못했습니다. 다시 로그인한 뒤 실행해 주세요.");
        return;
      }
    } else {
      persistCoreRunId(direction, targetRunId);
      setCoreRunId(targetRunId);
    }
    setRunning(true);
    setResults([]);
    setDone(0);
    setActiveTotal(selectedCells.length);
    setAuditResults([]);
    setAuditDone(0);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const out = await runCoreBatch(selectedCells, {
      runId: targetRunId,
      itemIndexes: selectedPlan.indexes,
      existingItems,
      concurrency: 3,
      signal: ctrl.signal,
      onProgress: (count, _total, last) => {
        setDone(count);
        setResults((previous) => [...previous, last]);
      },
    });
    setResults(out);
    setRunning(false);
    abortRef.current = null;
  };

  const stop = () => abortRef.current?.abort();

  const startFreshCoreRun = () => {
    if (running) return;
    if (
      results.length > 0
      && !window.confirm("새 배치 ID를 만들면 다음 실행은 기존 저장분을 건너뛰지 않습니다. 계속할까요?")
    ) {
      return;
    }
    const next = createCoreRunId(direction);
    persistCoreRunId(direction, next);
    setCoreRunId(next);
    setResults([]);
    setDone(0);
    setAuditResults([]);
    setAuditDone(0);
    toast.success("새 배치 ID를 만들었습니다.");
  };

  const loadCoreRunId = () => {
    if (running) return;
    const next = resumeRunId.trim();
    if (!isCoreRunIdForDirection(next, direction)) {
      toast.error(`${DIRECTION_LABEL[direction]} 방향의 시나리오 배치 ID를 입력해 주세요.`);
      return;
    }
    persistCoreRunId(direction, next);
    setCoreRunId(next);
    setResumeRunId("");
    setResults([]);
    setDone(0);
    setActiveTotal(0);
    setAuditResults([]);
    setAuditDone(0);
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
    if (auditRunning || auditableCoreResults.length === 0) return;
    setAuditRunning(true);
    setAuditResults([]);
    setAuditDone(0);
    const out = await runCoreQualityPilot(auditableCoreResults, {
      concurrency: 2,
      onProgress: (count, _total, last) => {
        setAuditDone(count);
        setAuditResults((previous) => [...previous, last]);
      },
    });
    setAuditResults(out);
    setAuditRunning(false);
  };

  return (
    <AdminShell
      title="시나리오 배치 생성"
      description="정해진 조건 조합에 따라 AI 생성 학습 콘텐츠의 상황과 원문을 여러 건 만들고 내부 확인 대기 상태로 저장합니다."
    >
      {/* ── 생성 설정 (코어·방향·할당량 압축) ── */}
      <section className="rounded-xl border border-[#EAE4D2] bg-white p-4">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              생성 방식
            </div>
            <div className="mt-1.5">
              <Badge variant="secondary" className="px-2.5 py-1 font-semibold">
                시나리오 · v1.4
              </Badge>
            </div>
          </div>

          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              언어 방향
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <Button
                size="sm"
                variant={direction === "ko_zh" ? "default" : "outline"}
                onClick={() => switchDirection("ko_zh")}
                disabled={running}
              >
                {DIRECTION_LABEL.ko_zh}
              </Button>
              <Button
                size="sm"
                variant={direction === "zh_ko" ? "default" : "outline"}
                onClick={() => switchDirection("zh_ko")}
                disabled={running}
              >
                {DIRECTION_LABEL.zh_ko} · 9화행 검증
              </Button>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={loadFullBatchPreset}
            disabled={running}
          >
            495 본배치 프리셋
          </Button>
        </div>

        <p className="mt-2.5 max-w-[42rem] text-[12px] text-muted-foreground">
          상황·원문·태그를 생성해 시나리오 라이브러리를 채웁니다.{" "}
          {direction === "zh_ko"
            ? "중→한은 핵심 3화행 18셀과 확장 6화행 중급 12셀을 합친 30셀 혼합 파일럿을 우선 검증합니다."
            : "본 배치는 연구 구인 243셀(화행×P×D×R)과 전달 커버리지 54셀(화행×수준×모드)을 별도로 검산합니다."}
        </p>

        <div className="mt-3 border-t border-[#EAE4D2] pt-3">
          {direction === "zh_ko" ? (
            <div className="grid gap-2 text-[12px] sm:grid-cols-2">
              <div className="rounded-lg bg-[#FAF8F2] px-4 py-3">
                <div className="font-semibold">핵심 3화행 · 18셀</div>
                <p className="mt-1 text-muted-foreground">
                  요청·거절·감사 × 3수준 × 번역/통역
                </p>
              </div>
              <div className="rounded-lg bg-[#FAF8F2] px-4 py-3">
                <div className="font-semibold">확장 6화행 · 12셀</div>
                <p className="mt-1 text-muted-foreground">
                  사과·제안·동의·반대·칭찬·불만 × 중급 × 번역/통역
                </p>
              </div>
              <p className="sm:col-span-2 text-[11px] text-muted-foreground">
                고정 파일럿입니다. 인간 눈검사 전에는 54셀이나 본배치로 자동 확대하지 않습니다.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              {LEVEL_ORDER.map((lv) => (
                <div key={lv} className="w-[104px]">
                  <Label className="text-[11.5px] text-muted-foreground">{LEVEL[lv]}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={quota.perLevel[lv]}
                    disabled={running}
                    onChange={(e) => setLevelQuota(lv, Number(e.target.value))}
                    className="mt-1 h-8 text-[13px]"
                  />
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    →{" "}
                    {targetActCount * (quota.perLevel[lv] + interpretingCount(quota.perLevel[lv], quota.interpretingRatio))}
                    개
                  </p>
                </div>
              ))}
              <div className="w-[104px]">
                <Label className="text-[11.5px] text-muted-foreground">통역 비율</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={quota.interpretingRatio}
                  disabled={running}
                  onChange={(e) =>
                    setQuota((q) => ({ ...q, interpretingRatio: Number(e.target.value) }))
                  }
                  className="mt-1 h-8 text-[13px]"
                />
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  번역 건수 대비 통역 생성 비율
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 실행 전 분포 검산 ── */}
      <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[15px] font-bold">이대로 실행하면 생기는 것</h3>
          <span className="text-[20px] font-bold">{summary.total}개</span>
        </div>

        {topicCoverage.missing.length > 0 && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-900">
            ⛔ 화행·도메인 일치 topic이 없어 실행을 차단했습니다:{" "}
            {topicCoverage.missing
              .map(({ speechAct, domain }) => `${SPEECH_ACT_UI[speechAct]}×${DOMAIN[domain]}`)
              .join(", ")}
          </p>
        )}
        {topicCoverage.wildcardOnly.length > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
            ⚠️ 명시 topic 없이 화행 중립 시드에만 의존하는 비블로커 조합:{" "}
            {topicCoverage.wildcardOnly
              .map(({ speechAct, domain }) => `${SPEECH_ACT_UI[speechAct]}×${DOMAIN[domain]}`)
              .join(", ")}
          </p>
        )}
        {topicCompatibility.length > 0 && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-900">
            ⛔ P·D·모드와 호환되는 topic이 없는 조합 {topicCompatibility.length}개가 있어 실행을
            차단했습니다. topic 카탈로그의 역할·매체 제약을 먼저 조정해야 합니다.
          </p>
        )}
        {fullBatchBlocked && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-900">
            ⛔ 400건 이상 실행은 승인된 495건 계획만 허용합니다. 495 프리셋을 불러오고
            243 구인셀과 54 전달셀이 모두 채워지는지 확인하십시오.
          </p>
        )}
        {isApprovedFullBatch && (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-900">
            ✅ 승인된 495 본배치 계획입니다. 243 구인셀과 54 전달셀 게이트를 모두 충족합니다.
          </p>
        )}

        {/* 2열이면 박스 하나가 600px가 되어 「입문」과 「18」 사이가
            한참 벌어진다 — 눈이 라벨과 수치를 잇지 못한다. 4열로 좁혀 라벨과
            수치를 붙인다. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Dist title="수준별" rows={LEVEL_ORDER.map((l) => [LEVEL[l], summary.byLevel[l] ?? 0])} />
          <Dist
            title="주제 · 도메인별"
            rows={Object.entries(DOMAIN).map(([k, label]) => [label, summary.byDomain[k] ?? 0])}
          />
          <Dist
            title="주제 · 산업별 (직장 도메인 안에서)"
            rows={Object.entries(INDUSTRY).map(([k, label]) => [label, summary.byIndustry[k] ?? 0])}
          />
          <Dist
            title="과업 유형"
            rows={[
              [MODE_LABEL.translation, summary.translation],
              [MODE_LABEL.stt_interpreting, summary.interpreting],
            ]}
          />
        </div>

        <div className="mt-4 rounded-lg bg-[#FAF8F2] px-4 py-3">
          <div className="text-[12.5px] font-semibold">시나리오 테마별 (theme) — 프리셋 선반이 비지 않게</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(THEME_LABEL).map(([k, label]) => (
              <Badge key={k} variant="secondary" className="font-normal">
                {label} {summary.byTheme[k] ?? 0}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-[#FAF8F2] px-4 py-3">
          <div className="text-[12.5px] font-semibold">화행별</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(SPEECH_ACT_UI).map(([k, label]) => (
              <Badge key={k} variant="secondary" className="font-normal">
                {label} {summary.bySpeechAct[k] ?? 0}
              </Badge>
            ))}
          </div>
        </div>

        {(() => {
          const cellUnitLabel = direction === "zh_ko" ? "30셀(9화행 혼합 검증)" : "54셀";
          return summary.emptyActLevelModeCells.length > 0 ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
              ⚠️ 화행 × 수준 × 모드 {cellUnitLabel}(생성 수준 한정) 중 <b>{summary.emptyActLevelModeCells.length}셀이 빕니다</b>:{" "}
              {summary.emptyActLevelModeCells.join(", ")}
            </p>
          ) : (
            <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-900">
              ✅ {cellUnitLabel}(생성 수준 한정)이 모두 채워집니다 · 셀당 최소 {summary.minActLevelModeCount}개
              {direction === "ko_zh" && summary.minActLevelModeCount < 3 && (
                <span className="text-amber-800">
                  {" "}— 500 본 배치는 셀당 ≥3 권장(현재 {summary.underMinCells.length}셀이 3 미만)
                </span>
              )}
            </p>
          );
        })()}

        {summary.emptyActPdrCells.length > 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
            ⚠️ 연구 구인 행렬 {targetActCount * 27}셀(화행 × P × D × R) 중{" "}
            <b>{summary.emptyActPdrCells.length}셀이 빕니다.</b>{" "}
            소규모 스모크에서는 허용되지만 495건 본 배치에서는 0이어야 합니다.
          </p>
        ) : (
          <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-[12.5px] text-emerald-900">
            ✅ 연구 구인 행렬 {targetActCount * 27}셀이 모두 채워집니다 · 셀당 최소{" "}
            {summary.minActPdrCount}개
          </p>
        )}
      </section>

      {/* ── 실행 ── */}
      <section className="mt-4 rounded-xl border border-[#EAE4D2] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FAF8F2] px-3 py-2.5">
          <div className="min-w-0 text-[12px] text-muted-foreground">
            배치 ID{" "}
            <code className="break-all font-mono text-[11.5px] text-foreground">
              {coreRunId}
            </code>
            <span className="ml-2">중단 후 같은 ID로 다시 실행하면 저장 완료 항목을 건너뜁니다.</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={startFreshCoreRun}
            disabled={running}
          >
            새 배치 ID
          </Button>
        </div>
        {/* flex-1이면 배치 ID 입력이 1093px까지 늘어난다(실측 사용률 8%).
            내용(core_ko_zh_1785458303114)에 맞춰 고정한다. */}
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="w-[280px]">
            <Label htmlFor="resume-core-run-id" className="text-[11.5px] text-muted-foreground">
              기존 배치 ID 불러오기
            </Label>
            <Input
              id="resume-core-run-id"
              value={resumeRunId}
              onChange={(event) => setResumeRunId(event.target.value)}
              placeholder={`core_${direction}_…`}
              disabled={running}
              className="mt-1 h-8 font-mono text-[12px]"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={loadCoreRunId}
            disabled={running || resumeRunId.trim().length === 0}
          >
            불러오기
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={start}
            disabled={
              running ||
              summary.total === 0 ||
              topicCoverage.missing.length > 0 ||
              topicCompatibility.length > 0 ||
              fullBatchBlocked
            }
          >
            {running ? "생성 중…" : `${summary.total}개 생성 시작`}
          </Button>
          {running && (
            <Button variant="outline" onClick={stop}>
              중단
            </Button>
          )}
          {results.length > 0 && (
            <span className="text-[13px] text-muted-foreground">
              성공 {okCount}
              {reusedCount > 0 ? ` (기존 ${reusedCount}건 건너뜀)` : ""}
              {warnCount > 0 ? ` (경고 ${warnCount})` : ""} · 실패 {failCount}
            </span>
          )}
        </div>

        <div className="mt-4 border-t border-[#EAE4D2] pt-4">
          <div className="flex flex-wrap items-end gap-2">
            {/* 「13, 14, 17」 정도를 넣는 칸이다 — flex-1이면 852px까지 늘어난다. */}
            <div className="w-[260px]">
              <Label htmlFor="selected-core-cells" className="text-[11.5px] text-muted-foreground">
                선택 셀 실행 · 현재 계획의 셀 번호
              </Label>
              <Input
                id="selected-core-cells"
                value={selectedCellNumbers}
                onChange={(event) => setSelectedCellNumbers(event.target.value)}
                placeholder="예: 13, 14, 17"
                disabled={running}
                className="mt-1 h-8 text-[13px]"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => startSelected("current")}
              disabled={
                running ||
                selectedPlan.invalid ||
                selectedPlan.indexes.length === 0 ||
                plan.length === 0
              }
            >
              선택 {selectedPlan.indexes.length}셀 · 현재 ID 재개
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => startSelected("fresh")}
              disabled={
                running ||
                selectedPlan.invalid ||
                selectedPlan.indexes.length === 0 ||
                plan.length === 0
              }
            >
              선택 {selectedPlan.indexes.length}셀 · 새 ID로 생성
            </Button>
          </div>
          <p className="mt-1.5 max-w-[42rem] text-[11.5px] text-muted-foreground">
            중단된 배치는 현재 ID로 미완료 셀만 재개합니다. 검수 탈락 셀을 교체할 때만 새 ID로
            생성합니다. 두 방식 모두 시나리오 생성 프롬프트와 해당 해시는 바뀌지 않습니다.
          </p>
          {selectedPlan.indexes.length > 0 && !selectedPlan.invalid && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedPlan.indexes.map((index) => {
                const cell = plan[index];
                return (
                  <Badge key={index} variant="secondary" className="font-normal">
                    #{index + 1} {SPEECH_ACT_UI[cell.speech_act_ui]} · {LEVEL[cell.level]} ·{" "}
                    {MODE_LABEL[cell.mode]}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {(running || results.length > 0) && (
          <div className="mt-4">
            <Progress value={(done / Math.max(1, activeTotal)) * 100} />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {done} / {activeTotal}
            </p>
          </div>
        )}

        <p className="mt-4 text-[12.5px] text-muted-foreground">
          생성물은 <b>검수 대기</b>(needs_review · archived_only)로 저장됩니다. 승인 화면을 거쳐야
          학습자에게 노출됩니다.
        </p>

        {failures.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="text-[13px] font-semibold text-red-900">
              실패 {failures.length}건 — 조건과 사유
            </div>
            <ul className="mt-2 space-y-1 text-[12px] text-red-900">
              {failures.slice(0, 20).map((f) => (
                <li key={f.index}>
                  {SPEECH_ACT_UI[f.cell.speech_act_ui]} · {LEVEL[f.cell.level]} ·{" "}
                  {DOMAIN[f.cell.domain]} — {f.ruleFailFirst ?? f.error}
                  {typeof f.coreContent?.situation_ko === "string" && (
                    <span className="mt-0.5 block pl-3 text-[11px] text-red-800">
                      생성 상황 · {f.coreContent.situation_ko}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {failures.length > 20 && (
              <p className="mt-2 text-[12px] text-red-900">
                …외 {failures.length - 20}건 (같은 사유일 가능성이 높습니다)
              </p>
            )}
          </div>
        )}

        {auditableCoreResults.length > 0 && !running && (
          <div className="mt-4 rounded-lg border border-[#EAE4D2] bg-[#FAF8F2] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold">설계 기준 준수 AI 비평 파일럿</div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  감사 표시 전용이며 저장·배치 게이트가 아닙니다. 18건 눈검사와 대조해
                  BLOCKER 11건 중 9건 이상 검출하고 수용 4건을 fail로 오판하지 않을 때만 확대합니다.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={startCoreAudit}
                disabled={auditRunning}
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
      </section>
    </AdminShell>
  );
};

const Dist = ({ title, rows }: { title: string; rows: [string, number][] }) => (
  <div className="rounded-lg bg-[#FAF8F2] px-4 py-3">
    <div className="text-[12.5px] font-semibold">{title}</div>
    <ul className="mt-2 space-y-1">
      {rows.map(([label, n]) => (
        <li key={label} className="flex items-baseline justify-between text-[12.5px]">
          <span className="text-muted-foreground">{label}</span>
          <span className={n === 0 ? "font-semibold text-amber-700" : "font-semibold"}>{n}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default AdminBatch;
