import { GenerationJobsPanel } from '@/components/admin/GenerationJobsPanel';
// 「학습 미션 조립」 — /admin/assembly (2026-07-30 신설, 사용자·Codex·Claude 수렴안).
//
// 코어(미션 재료)가 학습 콘텐츠(네이티브 MPJ5+DCT1 미션)로 바뀌는 결정적 변환이 이전에는
// 라이브러리 행 안의 작은 버튼으로 숨어 있었다. 이 화면이 그 변환의 정식 작업대다:
//   미션 재료 라이브러리 → [학습 미션 조립] → 검수·승인 → 주차별 편성
//
// 계기판은 누적이 아니라 **상호 배타 4상태**로 보여준다(Codex 지적 — "328 → n"
// 표기는 앞 숫자에 뒤 상태가 포함되는지 모호하다): 코어만 / 미션 생성됨 / 검토완료
// / 이번 세션 조립 실패.
//
// prompt_snapshot_hash 필터는 편의가 아니라 안전장치다 — 서로 다른 생성 계열
// (예: dc8f1494… 신계열 vs 구계열·legacy NULL)을 한 배치에 섞어 조립하는 것은
// 금지사항이다. A2(다중 선택·일괄 조립)는 별도 승인 후 이 화면에 추가된다.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DOMAIN,
  DIRECTION_LABEL,
  INDUSTRY,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type Domain,
  type GenMode,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import { coreDirection } from "@/lib/pragma/coreSchema";
import { THEME_LABEL, type ThemeCode } from "@/lib/pragma/scenarioTopics";
import { DEFAULT_FEATURE_BY_ACT } from "@/lib/pragma/targetFeatures";
import {
  promoteCore,
  reviseMissionDraft,
  reviewMission,
  supersedeMissionForRework,
  type ProfessorIssueOverride,
  type ProfessorMissionEdits,
  type PromotableCore,
  type PromoteStage,
} from "@/lib/pragma/promoteMission";
import { fetchMissionForReview } from "@/lib/mission/missionDb";
import { MissionPreview } from "@/components/admin/MissionPreview";
import { ProfessorMissionWorkbench } from "@/components/admin/ProfessorMissionWorkbench";
import { ContentReviewPanel } from "@/components/admin/ContentReviewPanel";
import type { ContentReviewApproval } from "@/lib/pragma/contentReviewApi";
import type { LearnerMissionRuntime } from "@/lib/pragma/missionV6";
import { toast } from "sonner";
import { startReviewPreparation, useReviewPreparationQueue } from "@/lib/pragma/reviewPreparationQueue";

interface CoreRow {
  scenario_id: string;
  speech_act: SpeechActUI;
  learner_level: LearnerLevel;
  domain: Domain | null;
  industry_sector: string | null;
  mode: GenMode | null;
  source_modality: string | null;
  theme_code: ThemeCode | null;
  topic_code: string | null;
  mission_status: string | null;
  generation_run_id: string | null;
  generation_item_key: string | null;
  prompt_snapshot_hash: string | null;
  core_content: {
    /** 명사구 한 줄 요약. 학습자 메뉴 제목과 같은 필드이며 목록에서 미션을 판별하는 이름으로 쓴다. */
    brief_note_ko?: string;
    situation_ko?: string;
    relation_ko?: string;
    source_text?: string;
    source_text_ko?: string;
    direction?: string;
  } | null;
}

// 상호 배타 4상태. failed는 DB 상태가 아니라 이번 세션의 조립 시도 결과다.
type AssemblyState = "core_only" | "generated" | "reviewed" | "failed";
const STATE_KO: Record<AssemblyState, string> = {
  core_only: "시나리오만 (조립 대기)",
  generated: "미션 생성됨 (감수 대기)",
  reviewed: "검토 완료",
  failed: "이번 조립 실패",
};
const STATE_TONE: Record<AssemblyState, string> = {
  core_only: "border-[#DDE1E2] bg-[#F3F5F5] text-[#59656D]",
  generated: "border-[#E7D9B8] bg-[#F8F3E8] text-[#765F1C]",
  reviewed: "border-[#CEE0D4] bg-[#EDF5F0] text-[#38634B]",
  failed: "border-[#E5CFCC] bg-[#F7EFEE] text-[#7B453F]",
};

// ── 목록 배지 색 ──
// 네 축을 눈으로 갈라 읽기 위한 것이지 장식이 아니다. 축마다 다른 방식으로 구분한다:
// 화행 9개는 서로 다른 색면, 언어방향 2개는 대비되는 색면, 수준 3개는 같은 계열의
// 농도(입문→고급), 모드 2개는 테두리형. 같은 축 안에서만 색을 비교하면 된다.
// 화행 9개 — 크림 바탕에 얹히는 저채도 색면. 색은 구분을 위한 것이므로 서로 다른 색상을
// 쓰되 채도를 낮춰 화면의 크림·네이비 톤을 깨지 않는다. 글자는 같은 색상의 짙은 값을 쓴다.
const ACT_TONE: Record<SpeechActUI, string> = {
  request: "bg-[#E3EAF1] text-[#3B566E]",
  refusal: "bg-[#F0E2DF] text-[#774843]",
  apology: "bg-[#F2E8D6] text-[#775F33]",
  thanks: "bg-[#E3EBE3] text-[#46604A]",
  proposal: "bg-[#E8E5EF] text-[#554F76]",
  agreement: "bg-[#EFE3E8] text-[#71485A]",
  opposition: "bg-[#E3E6E9] text-[#48535D]",
  compliment: "bg-[#DEEAE9] text-[#3D615E]",
  complaint: "bg-[#F1E4DB] text-[#79523F]",
};
// 언어방향 2개 — 브랜드 색 한 쌍(금·네이비)을 옅게 쓴다. 서로 반대편에 있어 한눈에 갈린다.
const DIRECTION_TONE: Record<LanguageDirection, string> = {
  ko_zh: "border-[#DFCC92] bg-[#F6EDD0] text-[#6B551A]",
  zh_ko: "border-[#BDCAD5] bg-[#E7ECF1] text-[#38495B]",
};
// 수준 3개 — 순서가 있는 축이라 색상을 바꾸지 않고 같은 계열의 농도만 올린다.
const LEVEL_TONE: Record<LearnerLevel, string> = {
  beginner_intermediate: "border-[#DCDDD8] bg-[#F6F6F3] text-[#6E7370]",
  intermediate: "border-[#C6C8C1] bg-[#EAEBE6] text-[#535853]",
  advanced: "border-[#A9ADA4] bg-[#DCDED7] text-[#383C38]",
};
// 모드 2개 — 색면 대신 테두리형으로 두어 위 세 축과 층이 갈린다.
const MODE_TONE: Record<GenMode, string> = {
  translation: "border-[#D5D8D3] bg-white text-[#5A625E]",
  stt_interpreting: "border-[#C3C0D2] bg-[#F1F0F6] text-[#5A5378]",
};

const ACTS = Object.keys(SPEECH_ACT_UI) as SpeechActUI[];
const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const QUERY_TIMEOUT_MS = 15_000;
// 대기열은 훑는 자리가 아니라 고르는 자리다. 한 화면 분량만 먼저 보여 준다.
const LIST_CAP = 20;
// 조회 상한. 495 배치를 두 번 돌리면 코어가 1000을 넘어 상한에 조용히 잘린다
// (2026-07-31 실측 1299건) — 상한에 닿으면 화면에 알린다.
const ROW_CAP = 4000;
const CORE_ROW_SELECT =
  "scenario_id, speech_act, learner_level, domain, industry_sector, mode, source_modality, theme_code, topic_code, mission_status, generation_run_id, generation_item_key, prompt_snapshot_hash, core_content";

const PROGRESS_STEPS = ["초안 생성", "구조 검사", "AI 품질", "격리 저장", "문항 수리"] as const;

const progressIndex = (stage: PromoteStage) => {
  if (stage.phase === "generating" || stage.phase === "preparing") return 0;
  if (stage.phase === "checking") return 1;
  if (stage.phase === "quality") return 2;
  if (stage.phase === "saving") return 3;
  return 4;
};

const progressLabel = (stage: PromoteStage) => {
  if (stage.phase === "preparing") return "조립 조건 확인";
  if (stage.phase === "generating") return `미션 생성 · ${stage.attempt}/${stage.maxAttempts}차`;
  if (stage.phase === "checking") return `규칙 검사 · ${stage.attempt}/${stage.maxAttempts}차`;
  if (stage.phase === "quality") return "AI 검토";
  if (stage.phase === "saving") return "유효 초안 격리 저장";
  if (stage.phase === "repairing") return "지목 문항 1회 수리";
  return "수리본 재검사";
};

/**
 * 한 컴포넌트가 세 화면을 그린다. 목록·필터 기계장치가 같기 때문이며, 화면마다 다른 것은
 * 조회 범위와 그 자리에서 할 수 있는 일이다.
 *   reviewMode=false      → 학습 미션 조립 (코어를 미션으로 만든다)
 *   reviewMode + aiReview → 자동 품질 점검·AI 검토 (판단 자료를 준비한다. 승인 기능 없음)
 *   reviewMode            → 교수자 최종 승인 (감수하고 승인한다)
 * 목록 데이터를 나누지 않는다 — 같은 미션과 검토 이력을 공유하고 상태별 보기만 다르다.
 */
const AdminAssembly = ({ reviewMode = false, aiReview = false }: { reviewMode?: boolean; aiReview?: boolean }) => {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<CoreRow[]>([]);
  const [generationModel, setGenerationModel] = useState<"existing" | "astra">("existing");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 라이브러리 「조립에서 열기」가 넘긴 초기 필터.
  const initAct = searchParams.get("act");
  const initLevel = searchParams.get("level");

  // 각 화면이 맡은 일부터 띄운다 — 조립은 아직 미션이 없는 코어, 감수는 감수 대기 미션.
  // 상태가 하나로 걸러져 있으면 행의 상태 배지도 함께 사라진다(모든 행이 같은 값이므로).
  const [fState, setFState] = useState<"all" | AssemblyState>(
    searchParams.get("scenarioId") ? "all" : reviewMode ? "generated" : "core_only",
  );
  const [fAct, setFAct] = useState<"all" | SpeechActUI>(
    ACTS.includes(initAct as SpeechActUI) ? (initAct as SpeechActUI) : "all",
  );
  const [fLevel, setFLevel] = useState<"all" | LearnerLevel>(
    LEVELS.includes(initLevel as LearnerLevel) ? (initLevel as LearnerLevel) : "all",
  );
  const [fMode, setFMode] = useState<"all" | GenMode>("all");
  const [fDirection, setFDirection] = useState<"all" | LanguageDirection>("all");
  const [fRun, setFRun] = useState<string>("all");
  const [fHash, setFHash] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);

  const [busy, setBusy] = useState<string | null>(null);
  const [assemblyProgress, setAssemblyProgress] = useState<{
    id: string;
    stage: PromoteStage;
  } | null>(null);
  // 이번 세션의 조립 실패: scenario_id → 실패 사유(R규칙 포함).
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, { mission: LearnerMissionRuntime; warnings: string[] }>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [reviewSelection, setReviewSelection] = useState<Set<string>>(new Set());
  const reviewQueue = useReviewPreparationQueue();
  useEffect(() => { setReviewSelection(new Set()); }, [fState, fAct, fLevel, fMode, fDirection, fRun, fHash]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      // scenarios의 신규 조립 메타 컬럼이 생성 타입보다 앞서 배포돼 임시 query builder cast가 필요하다.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let request = (supabase as unknown as { from: (t: string) => any })
        .from("scenarios")
        .select(CORE_ROW_SELECT)
        .eq("content_format", "scenario_core_v1")
        .order("created_at", { ascending: false })
        .limit(ROW_CAP);
      if (reviewMode) request = request.in("mission_status", ["generated", "reviewed", "released"]);
      if (searchParams.get("scenarioId")) request = request.eq("scenario_id", searchParams.get("scenarioId"));
      // 보관(archived_at) 행은 조립·검토·승인 후보가 아니다. 직접 링크(scenarioId)로 여는 경우만 예외.
      else request = request.neq("review_status", "revise_required").is("archived_at", null);
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("조회 시간이 15초를 초과했습니다.")), QUERY_TIMEOUT_MS);
      });
      const { data, error: queryError } = await Promise.race([
        request as PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
        timeout,
      ]);
      if (queryError) throw new Error(queryError.message);
      setRows((data ?? []) as CoreRow[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "시나리오를 불러오지 못했습니다.");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [reviewMode, searchParams]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const stateOf = useCallback(
    (r: CoreRow): AssemblyState => {
      if (failures[r.scenario_id] && !r.mission_status) return "failed";
      if (r.mission_status === "reviewed" || r.mission_status === "released") return "reviewed";
      if (r.mission_status === "generated") return "generated";
      return "core_only";
    },
    [failures],
  );

  const runIds = useMemo(
    () => [...new Set(rows.map((r) => r.generation_run_id).filter(Boolean))] as string[],
    [rows],
  );
  const hashes = useMemo(() => {
    const set = new Set(rows.map((r) => r.prompt_snapshot_hash ?? "null"));
    return [...set];
  }, [rows]);

  // 상태를 뺀 나머지 필터. 상태 칩의 건수는 이 결과에서 세야 상태를 바꾸기 전에
  // 각 상태가 몇 건인지 보인다.
  const matchedExceptState = useMemo(
    () =>
      rows.filter(
        (r) =>
          (fAct === "all" || r.speech_act === fAct) &&
          (fLevel === "all" || r.learner_level === fLevel) &&
          (fMode === "all" || r.mode === fMode) &&
          (fDirection === "all" || coreDirection(r.core_content) === fDirection) &&
          (fRun === "all" || r.generation_run_id === fRun) &&
          (fHash === "all" || (r.prompt_snapshot_hash ?? "null") === fHash),
      ),
    [rows, fAct, fLevel, fMode, fDirection, fRun, fHash],
  );

  const filtered = useMemo(
    () => matchedExceptState.filter((r) => fState === "all" || stateOf(r) === fState),
    [matchedExceptState, fState, stateOf],
  );

  const dash = useMemo(() => {
    const d: Record<AssemblyState, number> = { core_only: 0, generated: 0, reviewed: 0, failed: 0 };
    for (const r of matchedExceptState) d[stateOf(r)] += 1;
    return d;
  }, [matchedExceptState, stateOf]);

  const setStatus = (id: string, status: string) =>
    setRows((prev) => prev.map((r) => (r.scenario_id === id ? { ...r, mission_status: status } : r)));

  const onAssemble = async (r: CoreRow, resumeAstra = false, generationJobId?: string) => {
    setBusy(r.scenario_id);
    setAssemblyProgress({ id: r.scenario_id, stage: { phase: "preparing" } });
    setRowMsg((m) => ({ ...m, [r.scenario_id]: "" }));
    try {
      const res = await promoteCore(r as unknown as PromotableCore, {
        generationModel: resumeAstra ? "astra" : generationModel,
        generationJobId,
        onGenerationJob: (job) => setRowMsg(m => ({ ...m, [r.scenario_id]: job.status === "completed"
          ? "Astra 생성 완료 · AI 검토 시작" : "Astra 생성 중 · " + job.completed_steps + "단계 완료. 화면을 닫아도 결과를 보존합니다." })),
        onProgress: (stage) =>
          setAssemblyProgress((current) =>
            current?.id === r.scenario_id ? { ...current, stage } : current,
          ),
      });
      if (res.ok) {
        setStatus(r.scenario_id, "generated");
        setFailures((f) => {
          const { [r.scenario_id]: _drop, ...rest } = f;
          return rest;
        });
        // 검증②(0-n·94) 결과가 있으면 함께 알린다 — 없으면(호출 실패) 침묵하지 않고 표기.
        const qLabel = res.quality
          ? { pass: "AI점검 통과", warning: "AI점검 주의", fail: "AI점검 결함" }[res.quality.verdict]
          : "AI점검 미실행";
        setRowMsg((m) => ({
          ...m,
          [r.scenario_id]: `유효 초안 저장(${res.ruleResult}, 전체 생성 ${res.attempts}회) · ${qLabel}${res.repaired ? " · 지목 문항 수리 완료" : ""}${res.repairError ? ` · 자동 수리 보류: ${res.repairError}` : ""}`,
        }));
        if (res.mission) {
          const warnings = (res.violations ?? [])
            .filter((v) => v.level === "warning")
            .map((v) => `${v.id}: ${v.message}`);
          // 품질점검은 저장 직전에 붙으므로 엣지 응답 미션에는 없다 — 미리보기용으로 합친다.
          const withQuality = res.quality ? { ...res.mission, quality_check: res.quality } : res.mission;
          setPreview((m) => ({ ...m, [r.scenario_id]: { mission: withQuality, warnings } }));
          setOpenId(r.scenario_id); // 조립 직후 바로 눈검사 뷰 펼침
        }
        if (res.quality?.verdict === "fail") {
          toast.warning("유효 초안을 저장했습니다. 남은 결함은 교수자가 문항 단위로 수정하거나 근거를 남겨 승인할 수 있습니다.");
        } else {
          toast.success("미션 조립 완료 — 교수자 감수 대기");
        }
      } else {
        const failViolations = (res.violations ?? []).filter((v) => v.level === "fail");
        const failIds = [...new Set(failViolations.map((v) => v.id))];
        const failDetails = failViolations.map((v) => `${v.id}: ${v.message}`).join(" / ");
        const msg = [
          `${res.error ?? "조립 실패"}${failIds.length ? ` · ${failIds.join(",")}` : ""}`,
          failDetails,
        ]
          .filter(Boolean)
          .join(" — ");
        setFailures((f) => ({ ...f, [r.scenario_id]: msg }));
        toast.error(msg);
      }
    } catch (e) {
      const msg = `오류: ${e instanceof Error ? e.message : e}`;
      setFailures((f) => ({ ...f, [r.scenario_id]: msg }));
    } finally {
      setBusy(null);
      setAssemblyProgress(null);
    }
  };

  const onSaveEdits = async (r: CoreRow, edits: ProfessorMissionEdits) => {
    setBusy(r.scenario_id);
    try {
      const res = await reviseMissionDraft(r as unknown as PromotableCore, edits);
      if (!res.ok || !res.mission) {
        toast.error(res.error ?? "교수자 수정본 저장 실패");
        return;
      }
      const warnings = (res.violations ?? [])
        .filter((violation) => violation.level === "warning")
        .map((violation) => `${violation.id}: ${violation.message}`);
      const mission = res.quality
        ? { ...res.mission, quality_check: res.quality }
        : res.mission;
      setPreview((current) => ({
        ...current,
        [r.scenario_id]: { mission, warnings },
      }));
      setRowMsg((current) => ({
        ...current,
        [r.scenario_id]: `교수자 수정본 저장 · AI 품질 ${res.quality?.verdict ?? "미확인"}`,
      }));
      toast.success("수정한 문항을 구조검사·AI 재점검 후 새 이력으로 저장했습니다.");
    } finally {
      setBusy(null);
    }
  };

  const onReview = async (r: CoreRow, overrides: ProfessorIssueOverride[], approval: ContentReviewApproval) => {
    setBusy(r.scenario_id);
    try {
      const res = await reviewMission(r as unknown as PromotableCore, overrides, approval);
      if (res.ok) {
        setStatus(r.scenario_id, "reviewed");
        if (res.mission) {
          setPreview((current) => ({
            ...current,
            [r.scenario_id]: { mission: res.mission!, warnings: [] },
          }));
        }
        toast.success("검토 완료(reviewed) — 학습자 실행 가능");
      } else {
        throw new Error(res.error ?? "검토 처리 실패");
      }
    } finally {
      setBusy(null);
    }
  };

  const onRework = async (r: CoreRow) => {
    setBusy(r.scenario_id);
    setRowMsg((m) => ({ ...m, [r.scenario_id]: "기존 생성물을 보존하고 재작업 시나리오를 만드는 중…" }));
    try {
      const superseded = await supersedeMissionForRework(r.scenario_id);
      if (superseded.ok === false) {
        toast.error(superseded.error);
        return;
      }

      // RPC가 만든 정확한 run/item 메타를 다시 읽어 provenance에도 새 값을 사용한다.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: fetchError } = await (supabase as unknown as { from: (t: string) => any })
        .from("scenarios")
        .select(CORE_ROW_SELECT)
        .eq("scenario_id", superseded.scenarioId)
        .single();
      if (fetchError || !data) throw new Error(fetchError?.message ?? "재작업 시나리오 조회 실패");

      const replacement = data as CoreRow;
      setRows((prev) => [replacement, ...prev.filter((row) => row.scenario_id !== r.scenario_id)]);
      setPreview((prev) => {
        const { [r.scenario_id]: _drop, ...rest } = prev;
        return rest;
      });
      setOpenId(null);
      setBusy(null);
      toast.info("기존 미션은 반려 이력으로 보존했습니다. 새 시나리오로 다시 조립합니다.");
      await onAssemble(replacement);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "반려·재조립 준비 실패");
    } finally {
      setBusy(null);
    }
  };

  const togglePreview = async (r: CoreRow) => {
    if (openId === r.scenario_id) {
      setOpenId(null);
      return;
    }
    setOpenId(r.scenario_id);
    if (!preview[r.scenario_id]) {
      try {
        const res = await fetchMissionForReview(r.scenario_id, { includeV6: true });
        if (res) setPreview((m) => ({ ...m, [r.scenario_id]: { mission: res.mission, warnings: [] } }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "미션 조회 실패");
      }
    }
  };

  const visible = showAll ? filtered : filtered.slice(0, LIST_CAP);
  // 접혀 있어도 4축 필터가 걸려 있는지 알 수 있어야 한다.
  const axisFilterActive = fAct !== "all" || fLevel !== "all" || fMode !== "all" || fDirection !== "all";

  return (
    <AdminShell
      title={aiReview ? "자동 품질 점검·AI 검토" : reviewMode ? "교수자 최종 승인" : "학습 미션 조립"}
      description={aiReview
        ? "규칙 기반 자동 점검과 AI 검토로 교수자가 판단할 자료를 준비합니다. 이 화면에는 승인 기능이 없습니다."
        : reviewMode
          ? "교수자가 수업에 사용할 현재 콘텐츠를 감수한 뒤 최종 승인합니다. 미션을 열어 시작하세요."
          : "시나리오를 MJT 5문항과 직접 산출 과제로 완성하고, 감수할 수 있는 학습 미션으로 저장합니다."}
    >
      <div className="max-w-[1080px]">
      {!reviewMode && <>
        <label className="my-4 flex flex-wrap items-center gap-3 text-sm">미션 생성 모델
          <select aria-label="미션 생성 모델" value={generationModel} disabled={!!busy}
            onChange={e => setGenerationModel(e.target.value as "existing" | "astra")} className="rounded-lg border bg-white px-3 py-2">
            <option value="existing">기존 모델</option><option value="astra">Astra · 결과 보존 생성</option>
          </select>
          <span className="text-muted-foreground">Astra는 수 분 걸릴 수 있습니다. 완료 후 AI 검토를 진행합니다.</span>
        </label>
        <GenerationJobsPanel busy={!!busy} savedIds={new Set(rows.filter(r => r.mission_status).map(r => r.scenario_id))}
          onResume={async (id, jobId) => {
            const { data, error } = await supabase.from("scenarios").select("*").eq("scenario_id", id).single();
            if (error || !data) { toast.error("시나리오를 불러오지 못했습니다."); return; }
            if (data.mission_status) { toast.info("이미 생성된 미션입니다. 교수자 최종 승인 화면에서 확인해 주세요."); return; }
            setGenerationModel("astra"); void onAssemble(data as unknown as CoreRow, true, jobId);
          }} />
      </>}
      {reviewMode && searchParams.get("scenarioId") && (
        <p className="mb-3 text-sm"><Link className="underline" to="/admin/review">← 전체 미션 목록</Link></p>
      )}
      {/* 이 화면이 무엇을 하는 자리인지 맨 위에 두고, 필터를 그 바로 아래·목록 바로 위에 둔다.
          상태는 계기판 카드가 아니라 필터의 한 축으로 둔다 — 카드가 유일한 상태 필터였다. */}
      <section className="rounded-xl border border-[#E2DED2] bg-white p-3.5">
        {rows.length >= ROW_CAP && (
          <p className="mt-2 rounded-md border border-[#FCD34D] bg-[#FEF3C7] px-3 py-2 text-[12px] text-[#92400E]">
            ⚠️ 조회 상한 {ROW_CAP}건에 도달했습니다 — 최신 {ROW_CAP}건만 보고 있습니다. 아래 숫자를
            전체 현황으로 읽지 마세요.
          </p>
        )}

        {/* 상태는 처리 순서를 정하는 첫 축이라 다른 필터보다 앞에 둔다. 건수를 함께 보여
            계기판 카드가 알려주던 현황을 잃지 않는다. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-bold text-[#233542]">상태</span>
          {(["all", ...(reviewMode ? ["generated", "reviewed"] : Object.keys(STATE_KO))] as Array<"all" | AssemblyState>).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFState(s)}
              aria-pressed={fState === s}
              className={[
                "rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors",
                fState === s
                  ? "border-[#233542] bg-[#233542] font-semibold text-white"
                  : "border-[#DDE2E4] bg-white text-[#46515A] hover:bg-[#F3F5F6]",
              ].join(" ")}
            >
              {s === "all" ? "전체" : STATE_KO[s]}
              <span className="ml-1.5 tabular-nums opacity-80">{s === "all" ? matchedExceptState.length : dash[s]}</span>
            </button>
          ))}
        </div>

        {/* ── 학습설계 축과 생성 기준은 역할이 다르므로 시각적으로 분리한다. ── */}
        <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1.45fr_1fr]">
          {/* 필요한 미션을 바로 찾는 것이 두 화면 모두의 첫 동작이라 펼쳐 둔다. */}
          <details open
            className="rounded-lg border border-[#DDE2E4] border-t-4 border-t-[#18232D] bg-[#F8FAFA] p-3 pt-2">
            {/* summary에 display:flex를 주면 펼침 표시가 사라지므로 배지는 띄워서 배치한다. */}
            <summary className="mb-2 cursor-pointer">
              <span className="float-right rounded-full bg-[#E7ECEE] px-2.5 py-1 text-[12px] font-semibold text-[#53656F]">
                PRAGMA 편성 기준
              </span>
              <span className="ml-1 text-[14.5px] font-bold text-[#233542]">학습설계 4축</span>
              {axisFilterActive && <span className="ml-2 text-[12.5px] font-semibold text-[#8A6B24]">필터 적용 중</span>}
            </summary>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AxisSel index="1" label="화행" value={fAct} onChange={(v) => setFAct(v as typeof fAct)}
                opts={[["all", "전체"], ...ACTS.map((a) => [a, SPEECH_ACT_UI[a]] as [string, string])]} />
              <AxisSel index="2" label="수준" value={fLevel} onChange={(v) => setFLevel(v as typeof fLevel)}
                opts={[["all", "전체"], ...LEVELS.map((l) => [l, LEVEL[l]] as [string, string])]} />
              <AxisSel index="3" label="모드" value={fMode} onChange={(v) => setFMode(v as typeof fMode)}
                opts={[["all", "전체"], ["translation", MODE_LABEL.translation], ["stt_interpreting", MODE_LABEL.stt_interpreting]]} />
              <AxisSel index="4" label="언어방향" value={fDirection} onChange={(v) => setFDirection(v as typeof fDirection)}
                opts={[["all", "전체"], ...Object.entries(DIRECTION_LABEL)]} />
            </div>
          </details>

          <details open className="rounded-lg border border-[#E6E1D5] border-t-4 border-t-[#18232D] bg-[#FBFAF6] p-3 pt-2">
            <summary className="cursor-pointer text-[14.5px] font-bold text-[#3D464D]">고급 필터 (연구자용)
              {(fRun !== "all" || fHash !== "all") && <span className="ml-2 text-xs font-normal">필터 적용 중</span>}
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <CompactSel label="생성 run" value={fRun} onChange={setFRun}
                opts={[["all", "전체"], ...runIds.map((id) => {
                  const label = id.length > 24 ? `${id.slice(0, 12)}…${id.slice(-8)}` : id;
                  const duplicate = runIds.some(other => other !== id &&
                    (other.length > 24 ? `${other.slice(0, 12)}…${other.slice(-8)}` : other) === label);
                  return [id, duplicate ? id : label] as [string, string];
                })]} />
              <CompactSel label="프롬프트 계열" value={fHash} onChange={setFHash}
                opts={[["all", "전체"], ...hashes.map((h) => [h, h === "null" ? "legacy·없음" : `${h.slice(0, 10)}…`] as [string, string])]} />
            </div>
          </details>
        </div>
      </section>

      {loading ? (
        <p className="mt-4 text-[13px] text-muted-foreground">불러오는 중…</p>
      ) : error ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
          <p>조회 실패: {error} 관리자 로그인 상태를 확인해 주세요.</p>
          <Button size="sm" variant="outline" onClick={() => void loadRows()}>다시 불러오기</Button>
        </div>
      ) : (
        <section className="mt-4 space-y-2">
          {/* 일괄 AI 검토는 쓸 때만 필요하다. 행을 하나라도 고른 뒤에 한 줄로 나타난다.
              진행 상황은 AdminShell 상단의 ReviewPreparationStatus가 따로 보여 준다. */}
          {aiReview && reviewSelection.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#D8D3C4] bg-white px-4 py-2.5">
              <span className="text-[14px] font-semibold text-[#202B33]">{reviewSelection.size}건 선택됨</span>
              <Button size="sm" variant="outline" disabled={reviewQueue.active} onClick={() => setReviewSelection(new Set(visible.filter((row) => stateOf(row) === "generated").map((row) => row.scenario_id)))}>표시된 미션 모두 선택</Button>
              <Button size="sm" variant="ghost" disabled={reviewQueue.active} onClick={() => setReviewSelection(new Set())}>선택 해제</Button>
              <Button size="sm" disabled={reviewQueue.active || Boolean(busy)} onClick={() => void startReviewPreparation(
                filtered.filter((row) => reviewSelection.has(row.scenario_id) && stateOf(row) === "generated").map((row) => ({
                  target: { kind: "mission" as const, targetId: row.scenario_id },
                  label: `${SPEECH_ACT_UI[row.speech_act]} · ${row.scenario_id.slice(0, 8)}`,
                })))}>{reviewSelection.size}건 감수 자료 준비</Button>
              <p className="w-full text-[12px] text-muted-foreground">저장된 결과를 재사용하며, 없을 때만 유료 AI 검토를 실행합니다.</p>
            </div>
          )}
          <ul className="space-y-2">
            {visible.map((r) => {
              const st = stateOf(r);
              const previewMission = preview[r.scenario_id]?.mission;
              const isAssembling = busy === r.scenario_id && assemblyProgress?.id === r.scenario_id;
              const contextLabels = [
                r.domain ? DOMAIN[r.domain] : null,
                r.industry_sector
                  ? (INDUSTRY[r.industry_sector as keyof typeof INDUSTRY] ?? r.industry_sector)
                  : null,
                r.theme_code ? THEME_LABEL[r.theme_code] : null,
              ].filter(Boolean) as string[];
              return (
                <li key={r.scenario_id} className="rounded-lg border border-[#E7E2D7] bg-[#FBFAF6] px-4 py-3">
                  {/* 대기열은 어느 미션을 감수할지 「고르는」 자리다. 판별에 필요한 만큼만 한 줄로
                      보이고, 상황 전문·맥락은 행을 펼쳤을 때 본다. */}
                  <div className="flex items-center gap-3">
                    {/* 상태가 하나로 걸러져 있으면 모든 행이 같은 값이라 배지가 정보를 주지 않는다.
                        「전체」로 볼 때만 상태를 표시한다. */}
                    {fState === "all" && (
                      <span className={["shrink-0 rounded-md border px-2 py-0.5 text-[11px]", STATE_TONE[st]].join(" ")}>
                        {STATE_KO[st]}
                      </span>
                    )}
                    <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
                      <span className={["w-[3.5rem] rounded-md px-2 py-1 text-center text-[13px] font-bold", ACT_TONE[r.speech_act]].join(" ")}>
                        {SPEECH_ACT_UI[r.speech_act]}
                      </span>
                      <span className={["rounded-md border px-2 py-1 text-[13px] font-bold", DIRECTION_TONE[coreDirection(r.core_content)]].join(" ")}>
                        {DIRECTION_LABEL[coreDirection(r.core_content)]}
                      </span>
                      <span className={["rounded-md border px-2 py-1 text-[12.5px] font-semibold", LEVEL_TONE[r.learner_level]].join(" ")}>
                        {LEVEL[r.learner_level]}
                      </span>
                      <span className={["rounded-md border px-2 py-1 text-[12.5px] font-semibold", MODE_TONE[r.mode === "stt_interpreting" ? "stt_interpreting" : "translation"]].join(" ")}>
                        {r.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation}
                      </span>
                    </span>
                    {/* 목록은 미션을 「고르는」 자리라 명사구 요약을 제목으로 쓴다. 상황 전문은 펼쳤을 때 본다. */}
                    <p
                      className="min-w-0 flex-1 truncate text-[15px] font-medium text-[#202B33]"
                      title={[r.core_content?.situation_ko, contextLabels.length ? `맥락 · ${contextLabels.join(" · ")}` : null]
                        .filter(Boolean).join("\n\n")}
                    >
                      {r.core_content?.brief_note_ko?.trim() || r.core_content?.situation_ko || "—"}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {(st === "core_only" || st === "failed") &&
                        (DEFAULT_FEATURE_BY_ACT[r.speech_act] ? (
                          <Button size="sm" disabled={busy === r.scenario_id} onClick={() => onAssemble(r)}>
                            {isAssembling && <span className="mr-1.5 size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                            {isAssembling ? "조립 중" : st === "failed" ? "다시 조립" : "미션 조립"}
                          </Button>
                        ) : (
                          <span className="text-[11.5px] text-muted-foreground">화용 초점 카탈로그 없음 — 조립 불가</span>
                        ))}
                      {st === "generated" && !reviewMode && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy === r.scenario_id}
                            title="현재 생성물은 이력에 보존하고 같은 시나리오로 새 미션을 조립합니다."
                            onClick={() => onRework(r)}
                          >
                            반려·재조립
                          </Button>
                        </>
                      )}
                      {(st === "generated" || st === "reviewed") && (
                        <>
                        {aiReview && st === "generated" && <label className="mr-2 flex items-center gap-2 text-[13px]">
                          <input type="checkbox" aria-label={`감수 자료 준비 선택 ${r.scenario_id}`} disabled={reviewQueue.active}
                            checked={reviewSelection.has(r.scenario_id)} onChange={(event) => setReviewSelection((current) => {
                              const next = new Set(current); if (event.target.checked) next.add(r.scenario_id); else next.delete(r.scenario_id); return next;
                            })} />선택
                        </label>}
                        <Button size="sm" variant="ghost" onClick={() => togglePreview(r)}>
                          {openId === r.scenario_id ? "미션 접기 ▴" : aiReview ? "점검·검토 결과 보기 ▾" : reviewMode ? "학생 화면으로 감수하기 ▾" : "미션 보기 ▾"}
                        </Button>
                        </>
                      )}
                      {!isAssembling && rowMsg[r.scenario_id] && (
                        <span className="text-[11.5px] text-muted-foreground">{rowMsg[r.scenario_id]}</span>
                      )}
                    </div>
                  </div>
                  {failures[r.scenario_id] && st === "failed" && (
                    <p className="mt-2 rounded-md border border-[#E5CFCC] bg-[#F7EFEE] px-3 py-2 text-[12px] leading-relaxed text-[#7B453F]">
                      {failures[r.scenario_id]}
                    </p>
                  )}
                  {isAssembling && rowMsg[r.scenario_id] && <p className="mt-2 text-xs" role="status">{rowMsg[r.scenario_id]}</p>}
                  {isAssembling && assemblyProgress && <AssemblyProgressView stage={assemblyProgress.stage} />}
                  {/* 제목으로 접어 둔 상황 전문과 맥락은 펼치면 그대로 보인다. */}
                  {openId === r.scenario_id && (
                    <div className="mt-2.5 border-t border-[#ECE8DE] pt-2.5">
                      <p className="max-w-[54rem] text-[14.5px] leading-[1.8] text-[#202B33]">
                        {r.core_content?.situation_ko ?? "—"}
                      </p>
                      {contextLabels.length > 0 && (
                        <p className="mt-2 text-[12.5px] text-[#758087]">
                          <span className="font-semibold text-[#5D6970]">맥락</span>
                          <span className="mx-1.5 text-[#B2B8BB]">·</span>
                          {contextLabels.join(" · ")}
                        </p>
                      )}
                    </div>
                  )}
                  {openId === r.scenario_id && preview[r.scenario_id] && (
                    <>
                      {!reviewMode && previewMission && previewMission.schema_version !== "mission_v6" && <MissionPreview
                        mission={previewMission}
                        warnings={preview[r.scenario_id].warnings}
                      />}
                      {aiReview && (st === "generated" || st === "reviewed") && (
                        <ContentReviewPanel target={{ kind: "mission", targetId: r.scenario_id }}
                          handoffHref={`/admin/review?scenarioId=${r.scenario_id}`} />
                      )}
                      {!aiReview && st === "generated" && (
                        <ProfessorMissionWorkbench
                          scenarioId={r.scenario_id}
                          key={`${preview[r.scenario_id].mission.provenance?.mission_content_hash ?? "draft"}-${preview[r.scenario_id].mission.quality_check?.verdict ?? "none"}`}
                          mission={preview[r.scenario_id].mission}
                          busy={busy === r.scenario_id}
                          onSave={(edits) => onSaveEdits(r, edits)}
                          onReview={(overrides, approval) => onReview(r, overrides, approval)}
                          approvalHref={reviewMode ? undefined : `/admin/review?scenarioId=${r.scenario_id}`}
                        />
                      )}
                      {reviewMode && !aiReview && st === "reviewed" && <ContentReviewPanel experiential target={{ kind: "mission", targetId: r.scenario_id }} historicalApproval />}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {/* 한 번 펼치면 되돌릴 수 없어 목록이 계속 길게 남던 문제를 고친다. */}
          {filtered.length > LIST_CAP && (
            <Button variant="outline" className="w-full" onClick={() => setShowAll((prev) => !prev)}>
              {showAll ? `처음 ${LIST_CAP}개만 보기` : `전체 ${filtered.length}개 모두 표시`}
            </Button>
          )}
          {filtered.length === 0 && (
            <p className="rounded-md border border-dashed border-[#EAE4D2] bg-white px-4 py-8 text-center text-[13px] text-muted-foreground">
              조건에 맞는 재료가 없습니다. 필터를 조정하거나 시나리오 개별·배치 생성에서 새 시나리오를 만드세요.
            </p>
          )}
        </section>
      )}
      </div>
    </AdminShell>
  );
};

const SelectField = ({
  value,
  onChange,
  opts,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
  className?: string;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`h-9 w-full min-w-0 rounded-md border border-[#D9D7CF] bg-white px-2 text-[13.5px] text-[#26333B] focus:outline-none focus:ring-2 focus:ring-[#526B78]/20 ${className}`}
  >
    {opts.map(([v, l]) => (
      <option key={v} value={v}>{l}</option>
    ))}
  </select>
);

const AxisSel = ({
  index,
  label,
  value,
  onChange,
  opts,
}: {
  index: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
}) => (
  <label className="rounded-md border border-[#E1E5E6] bg-white p-2">
    <span className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#34444D]">
      <span className="flex size-4.5 items-center justify-center rounded-full bg-[#E7ECEE] text-[10.5px] text-[#53656F]">{index}</span>
      {label}
    </span>
    <SelectField value={value} onChange={onChange} opts={opts} />
  </label>
);

const CompactSel = ({
  label,
  value,
  onChange,
  opts,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: [string, string][];
}) => (
  <label>
    <span className="mb-1 block text-[12px] font-medium text-[#696D6C]">{label}</span>
    <SelectField value={value} onChange={onChange} opts={opts} />
  </label>
);

const AssemblyProgressView = ({
  stage,
}: {
  stage: PromoteStage;
}) => {
  const activeIndex = progressIndex(stage);
  return (
    <div className="min-w-0 rounded-md bg-[#F1F4F5] px-3 py-2" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11.5px] font-semibold text-[#233542]">{progressLabel(stage)}</span>
      </div>
      <ol className="mt-1.5 grid grid-cols-5 gap-1.5">
        {PROGRESS_STEPS.map((label, index) => {
          const isActive = index === activeIndex;
          const isDone = index < activeIndex;
          return (
            <li key={label} className="min-w-0">
              <span
                className={[
                  "block h-1 rounded-full transition-colors",
                  isActive ? "bg-[#233542]" : isDone ? "bg-[#6F8794]" : "bg-[#DDE4E6]",
                ].join(" ")}
              />
              <span className={[
                "mt-1 block truncate text-[10px]",
                isActive ? "font-semibold text-[#233542]" : isDone ? "text-[#53656F]" : "text-[#98A1A6]",
              ].join(" ")}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default AdminAssembly;
