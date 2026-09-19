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
//
// 2026-09-14: 세 화면 모두 「왼쪽 대기열 + 오른쪽 작업대」로 통일했다. 진입하면 대기열 첫 미션이
// 작업대에 열리고, 작업을 마쳐도 다음 미션으로 저절로 넘어가지 않는다(「다음 미션 ▶」으로만 이동).
// 여는 것은 읽기뿐이며, 조립·유료 AI 검토·승인은 지금처럼 버튼을 눌러야 실행된다.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import type { LearnerMissionRuntime, MissionV6 } from "@/lib/pragma/missionV6";
import { toast } from "sonner";
import { startReviewPreparation, useReviewPreparationQueue } from "@/lib/pragma/reviewPreparationQueue";
import { fetchAllPages } from "@/lib/pragma/paginatedRows";
import {
  DASHBOARD_REVIEW_CRITERIA_VERSION,
  DASHBOARD_REVIEW_RUN_SELECT,
  type DashboardAssignmentRow,
  type DashboardReviewRunRow,
  type DashboardScenarioRow,
} from "@/lib/admin/adminDashboardMetrics";
import {
  groupAssignments,
  missionVersionLabel,
  placementLabel,
  professorQueueOf,
  qualityCheckQueueOf,
  reviewProgressLabel,
  traceLabel,
  updatedAtLabel,
  type ProfessorQueue,
  type QualityCheckQueue,
} from "@/lib/admin/professorReviewQueue";

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
  supersedes_scenario_id?: string | null;
  created_at?: string | null;
  core_content: {
    /** 명사구 한 줄 요약. 학습자 메뉴 제목과 같은 필드이며 목록에서 미션을 판별하는 이름으로 쓴다. */
    brief_note_ko?: string;
    situation_ko?: string;
    relation_ko?: string;
    source_text?: string;
    source_text_ko?: string;
    direction?: string;
  } | null;
  // 점검·최종 승인 화면에서만 함께 읽는 판별 정보.
  review_status?: string | null;
  updated_at?: string | null;
  mission_schema_version?: string | null;
  mission_content_hash?: string | null;
}

const REVIEW_META_SELECT =
  ", review_status, updated_at, mission_schema_version:mission_content->>schema_version, mission_content_hash:mission_content->provenance->>mission_content_hash";

type ReviewMeta = {
  runs: DashboardReviewRunRow[];
  assignments: DashboardAssignmentRow[];
  outlineTitles: Map<string, string>;
};

type ReviewInfo = { queue: ProfessorQueue; check: QualityCheckQueue; progress: string; placement: string };

const toDashboardRow = (r: CoreRow): DashboardScenarioRow => ({
  scenario_id: r.scenario_id,
  content_format: "scenario_core_v1",
  review_status: r.review_status ?? null,
  mission_status: r.mission_status,
  mission_schema_version: r.mission_schema_version ?? null,
  authoring_stage: null,
  updated_at: r.updated_at ?? null,
});

// 상호 배타 4상태. failed는 DB 상태가 아니라 이번 세션의 조립 시도 결과다.
type AssemblyState = "core_only" | "generated" | "reviewed" | "failed";
const STATE_KO: Record<AssemblyState, string> = {
  core_only: "시나리오만 (조립 대기)",
  generated: "미션 생성됨 (감수 대기)",
  reviewed: "검토 완료 상태",
  failed: "이번 조립 실패",
};

// 상태 칩. 점검 화면의 칩은 DB 상태가 아니라 같은 generated 미션을 검수 단계로 나눈 보기다.
// 2026-09-19: 「학습 미션 조립」을 v6 제작 현황판으로 바꿨다. v6 미션은 화면이 아니라 변환 스크립트로
// 등록되므로(v5 승인본 → v6 변환·집필 → 자동 검사·AI 검토 → 교수자 승인 → 편성) 이 화면은 읽기만 한다.
type ProductionState = "v6_review" | "v6_done" | "v5_only" | "core_only";
type StateChip = "all" | AssemblyState | ProductionState | ProfessorQueue | Exclude<QualityCheckQueue, "decision">;
const ASSEMBLY_CHIPS: StateChip[] = ["v6_review", "v6_done", "v5_only", "core_only", "all"];
const PRODUCTION_KO: Record<ProductionState, string> = {
  v6_review: "v6 검토 중",
  v6_done: "v6 승인 완료",
  v5_only: "v5 · 변환 전",
  core_only: "시나리오만",
};
const QUALITY_CHIPS: StateChip[] = ["needs_check", "rules_error", "decision", "all"];
const PROFESSOR_CHIPS: StateChip[] = ["decision", "in_progress", "reviewed", "all"];

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
  "scenario_id, speech_act, learner_level, domain, industry_sector, mode, source_modality, theme_code, topic_code, mission_status, generation_run_id, generation_item_key, prompt_snapshot_hash, supersedes_scenario_id, created_at, core_content";

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

const titleOf = (r: CoreRow) => r.core_content?.brief_note_ko?.trim() || r.core_content?.situation_ko || "—";

/**
 * 한 컴포넌트가 세 화면을 그린다. 대기열·필터 기계장치가 같기 때문이며, 화면마다 다른 것은
 * 대기열의 상태 칩·정렬과 작업대에서 할 수 있는 일이다.
 *   reviewMode=false      → 학습 미션 조립 (코어를 미션으로 만든다)
 *   reviewMode + aiReview → 자동 품질 점검·AI 검토 (판단 자료를 준비한다. 승인 기능 없음)
 *   reviewMode            → 교수자 최종 승인 (감수하고 승인한다)
 * 목록 데이터를 나누지 않는다 — 같은 미션과 검토 이력을 공유하고 상태별 보기만 다르다.
 */
const AdminAssembly = ({ reviewMode = false, aiReview = false }: { reviewMode?: boolean; aiReview?: boolean }) => {
  const [searchParams] = useSearchParams();
  // 교수자 최종 승인 화면. 자동 품질 점검 화면도 reviewMode를 쓰므로 aiReview로 가른다.
  const professorScreen = reviewMode && !aiReview;
  const chips = professorScreen ? PROFESSOR_CHIPS : aiReview ? QUALITY_CHIPS : ASSEMBLY_CHIPS;
  const [rows, setRows] = useState<CoreRow[]>([]);
  const [reviewMeta, setReviewMeta] = useState<ReviewMeta | null>(null);
  const [generationModel, setGenerationModel] = useState<"existing" | "astra">("existing");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 라이브러리 「조립에서 열기」가 넘긴 초기 필터.
  const initAct = searchParams.get("act");
  const initLevel = searchParams.get("level");

  // 각 화면이 맡은 일부터 띄운다 — 조립은 아직 미션이 없는 코어, 점검은 점검이 필요한 미션,
  // 최종 승인은 교수자 차례가 된 미션(결정 대기).
  const [fState, setFState] = useState<StateChip>(chips[0]);
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
  const [search, setSearch] = useState("");
  // 조립은 방금 만든 것을 확인하는 일이 많아 최신순, 점검·승인은 밀린 일부터 줄이도록 오래 기다린 순.
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">(reviewMode ? "oldest" : "newest");
  const [showAll, setShowAll] = useState(false);
  // 대기열 상단의 두 필터는 한 줄짜리 토글로 두고, 펼친 쪽만 아래에 연다(기본 접힘).
  const [openFilter, setOpenFilter] = useState<"axis" | "advanced" | null>(null);
  // 교수자 최종 승인은 한 미션을 깊게 읽는 화면이라 대기열을 옆에 두지 않고 필요할 때만 서랍으로 연다.
  const [queueOpen, setQueueOpen] = useState(false);
  useEffect(() => {
    if (!queueOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setQueueOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queueOpen]);

  const [busy, setBusy] = useState<string | null>(null);
  const [assemblyProgress, setAssemblyProgress] = useState<{
    id: string;
    stage: PromoteStage;
  } | null>(null);
  // 이번 세션의 조립 실패: scenario_id → 실패 사유(R규칙 포함).
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, { mission: LearnerMissionRuntime; warnings: string[] }>>({});
  // 작업대에 열린 미션. 대기열 필터와 따로 둔다 — 작업을 마쳐 대기열에서 빠져도 결과를 계속 보여 준다.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 선택한 미션이 대기열에서 빠졌을 때 「다음 미션」을 정하는 기준 위치.
  const [anchorIndex, setAnchorIndex] = useState(0);
  const pendingScenarioId = useRef(searchParams.get("scenarioId"));
  const previewLoading = useRef(new Set<string>());
  const [reviewSelection, setReviewSelection] = useState<Set<string>>(new Set());
  const reviewQueue = useReviewPreparationQueue();
  useEffect(() => { setReviewSelection(new Set()); }, [fState, fAct, fLevel, fMode, fDirection, fRun, fHash, search]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      // scenarios의 신규 조립 메타 컬럼이 생성 타입보다 앞서 배포돼 임시 query builder cast가 필요하다.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as unknown as { from: (t: string) => any };
      const select = CORE_ROW_SELECT + REVIEW_META_SELECT;
      let request = db
        .from("scenarios")
        .select(select)
        .eq("content_format", "scenario_core_v1")
        .order("created_at", { ascending: false })
        .limit(ROW_CAP);
      if (reviewMode) request = request.in("mission_status", ["generated", "reviewed", "released"]);
      // 보관(archived_at) 행은 조립·검토·승인 후보가 아니다. 직접 링크(scenarioId)로 여는 미션만 아래에서 따로 읽는다.
      request = request.neq("review_status", "revise_required").is("archived_at", null);
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("조회 시간이 15초를 초과했습니다.")), QUERY_TIMEOUT_MS);
      });
      // 검수 단계 판정(검수 이력)과 교과목·주차(편성)는 목록 전체에 대해 한 번씩만 읽는다.
      // 대시보드와 같은 조회 조건이어야 두 화면의 「교수자 차례」 수가 같다.
      const page = <T,>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) =>
        fetchAllPages<T>(async (from, to) => await query(from, to));
      const metaRequest: Promise<ReviewMeta | null> = Promise.all([
          page<DashboardReviewRunRow>((from, to) => db.from("content_review_runs").select(DASHBOARD_REVIEW_RUN_SELECT)
            .eq("kind", "mission").eq("criteria_version", DASHBOARD_REVIEW_CRITERIA_VERSION).is("superseded_by", null)
            .order("created_at", { ascending: false }).range(from, to)),
          page<DashboardAssignmentRow>((from, to) => db.from("curriculum_week_scenarios").select("outline_id,week_no,scenario_id")
            .order("week_no", { ascending: true }).order("outline_id", { ascending: true }).range(from, to)),
          page<{ id: string; title: string }>((from, to) => db.from("curriculum_outlines").select("id,title")
            .order("id", { ascending: true }).range(from, to)),
        ]).then(([runs, assignments, outlines]) => ({
          runs, assignments, outlineTitles: new Map(outlines.map((outline) => [outline.id, outline.title])),
        }));
      const [{ data, error: queryError }, meta] = await Promise.race([
        Promise.all([
          request as PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
          metaRequest,
        ]),
        timeout,
      ]);
      if (queryError) throw new Error(queryError.message);
      let loaded = (data ?? []) as CoreRow[];
      const linkedId = searchParams.get("scenarioId");
      // 더 새 판이 대체한 옛 판(다른 행의 supersedes_scenario_id가 가리키는 행)은 목록·숫자에서 뺀다. DB는 그대로다.
      const replaced = new Set(loaded.map((row) => row.supersedes_scenario_id).filter(Boolean));
      loaded = loaded.filter((row) => !replaced.has(row.scenario_id) || row.scenario_id === linkedId);
      if (linkedId && !loaded.some((row) => row.scenario_id === linkedId)) {
        const { data: linked } = await db.from("scenarios").select(select).eq("scenario_id", linkedId).maybeSingle();
        if (linked) loaded = [linked as CoreRow, ...loaded];
      }
      setReviewMeta(meta);
      setRows(loaded);
    } catch (cause) {
      console.error("[admin] 목록 조회 실패", cause);
      setError("목록을 불러오지 못했습니다.");
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

  const productionOf = useCallback((r: CoreRow): ProductionState => {
    if (!r.mission_status) return "core_only";
    if (r.mission_schema_version !== "mission_v6") return "v5_only";
    return r.mission_status === "reviewed" || r.mission_status === "released" ? "v6_done" : "v6_review";
  }, []);

  // 줄마다 검수 이력·편성 전체를 다시 훑지 않도록 scenario_id별로 한 번 묶어 판정해 둔다.
  const reviewInfo = useMemo(() => {
    const info = new Map<string, ReviewInfo>();
    if (!reviewMeta) return info;
    const runsByTarget = new Map<string, DashboardReviewRunRow[]>();
    for (const run of reviewMeta.runs) {
      const list = runsByTarget.get(run.target_id);
      if (list) list.push(run);
      else runsByTarget.set(run.target_id, [run]);
    }
    const assignmentsByScenario = groupAssignments(reviewMeta.assignments);
    for (const r of rows) {
      const dashboardRow = toDashboardRow(r);
      const runs = runsByTarget.get(r.scenario_id) ?? [];
      info.set(r.scenario_id, {
        queue: professorQueueOf(dashboardRow, runs),
        check: qualityCheckQueueOf(dashboardRow, runs),
        progress: reviewProgressLabel(dashboardRow, runs),
        placement: placementLabel(assignmentsByScenario.get(r.scenario_id), reviewMeta.outlineTitles),
      });
    }
    return info;
  }, [reviewMeta, rows]);

  const matchesState = useCallback(
    (r: CoreRow, state: StateChip) => {
      if (state === "all") return true;
      if (!reviewMode) return productionOf(r) === state;
      if (state === "decision" || state === "in_progress") {
        return stateOf(r) === "generated" && (reviewInfo.get(r.scenario_id)?.queue ?? "in_progress") === state;
      }
      if (state === "needs_check" || state === "rules_error") {
        return stateOf(r) === "generated" && (reviewInfo.get(r.scenario_id)?.check ?? "needs_check") === state;
      }
      return stateOf(r) === state;
    },
    [reviewInfo, stateOf, reviewMode, productionOf],
  );

  const chipLabel = (chip: StateChip) => {
    if (chip === "all") return "전체";
    if (!reviewMode && chip in PRODUCTION_KO) return PRODUCTION_KO[chip as ProductionState];
    if (chip === "decision") return aiReview ? "교수자 승인 대기" : "결정 대기";
    if (chip === "in_progress") return "검수 진행 중";
    // 대시보드와 같은 집합은 같은 이름으로 부른다.
    if (chip === "needs_check") return "품질 점검 대기";
    if (chip === "rules_error") return "규칙 검사 불통과";
    // reviewed·released 상태 전체라 교수자 최종 승인 기록이 없는 옛 미션도 들어 있다 — 대시보드 「교수자 승인 완료」(최종 승인 기록 기준)와 다른 집합이다.
    if (chip === "reviewed" && professorScreen) return "검토 완료 상태";
    return STATE_KO[chip];
  };

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
  const matchedExceptState = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (fAct === "all" || r.speech_act === fAct) &&
        (fLevel === "all" || r.learner_level === fLevel) &&
        (fMode === "all" || r.mode === fMode) &&
        (fDirection === "all" || coreDirection(r.core_content) === fDirection) &&
        (fRun === "all" || r.generation_run_id === fRun) &&
        (fHash === "all" || (r.prompt_snapshot_hash ?? "null") === fHash) &&
        (!needle || [r.core_content?.brief_note_ko, r.core_content?.situation_ko, r.scenario_id, r.mission_content_hash?.slice(0, 7)]
          .some((text) => text?.toLowerCase().includes(needle))),
    );
  }, [rows, fAct, fLevel, fMode, fDirection, fRun, fHash, search]);

  const filtered = useMemo(() => {
    const list = matchedExceptState.filter((r) => matchesState(r, fState));
    // 조회 자체가 생성 최신순이다. 점검·승인은 마지막 수정 시각으로 기다린 시간을 잰다.
    if (!reviewMode) return sortOrder === "newest" ? list : [...list].reverse();
    const time = (r: CoreRow) => (r.updated_at ? Date.parse(r.updated_at) : Number.NaN);
    return [...list].sort((a, b) => {
      const ta = time(a), tb = time(b);
      if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.isNaN(ta) ? (Number.isNaN(tb) ? 0 : 1) : -1;
      return sortOrder === "oldest" ? ta - tb : tb - ta;
    });
  }, [matchedExceptState, fState, matchesState, reviewMode, sortOrder]);

  const dash = useMemo(() => {
    const d = {} as Record<StateChip, number>;
    for (const chip of chips) d[chip] = matchedExceptState.filter((r) => matchesState(r, chip)).length;
    return d;
  }, [chips, matchedExceptState, matchesState]);

  // 진입·필터 변경 시에만 대기열 첫 미션을 연다. 작업을 마쳐 대기열이 바뀌어도 선택은 그대로 둔다.
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const matchesRef = useRef(matchesState);
  matchesRef.current = matchesState;
  useEffect(() => {
    if (loading) return;
    const linkedId = pendingScenarioId.current;
    if (linkedId) {
      pendingScenarioId.current = null;
      const linked = rowsRef.current.find((row) => row.scenario_id === linkedId);
      if (linked) {
        const chip = chips.find((candidate) => candidate !== "all" && matchesRef.current(linked, candidate)) ?? "all";
        setFState(chip);
        setSelectedId(linkedId);
        return;
      }
    }
    const list = filteredRef.current;
    setSelectedId((current) => (current && list.some((row) => row.scenario_id === current) ? current : list[0]?.scenario_id ?? null));
    setAnchorIndex(0);
  }, [loading, chips, fState, fAct, fLevel, fMode, fDirection, fRun, fHash, search, sortOrder]);

  const selectedRow = selectedId ? rows.find((row) => row.scenario_id === selectedId) ?? null : null;
  const selectedIndex = selectedId ? filtered.findIndex((row) => row.scenario_id === selectedId) : -1;
  const prevRow = selectedIndex >= 0 ? filtered[selectedIndex - 1] : filtered[anchorIndex - 1];
  const nextRow = selectedIndex >= 0 ? filtered[selectedIndex + 1] : filtered[anchorIndex];

  const selectRow = useCallback((row: CoreRow | undefined) => {
    if (!row) return;
    const index = filteredRef.current.findIndex((candidate) => candidate.scenario_id === row.scenario_id);
    setSelectedId(row.scenario_id);
    setAnchorIndex(Math.max(index, 0));
    if (index >= LIST_CAP) setShowAll(true);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`queue-${selectedId}`)?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId, queueOpen]);

  // 작업대에 연 미션의 저장본을 읽는다(읽기 전용). 생성·검수 실행은 여기서 일어나지 않는다.
  useEffect(() => {
    if (!selectedRow) return;
    const id = selectedRow.scenario_id;
    const st = stateOf(selectedRow);
    if ((st !== "generated" && st !== "reviewed") || preview[id] || previewLoading.current.has(id)) return;
    previewLoading.current.add(id);
    fetchMissionForReview(id, { includeV6: true })
      .then((res) => {
        if (res) setPreview((m) => ({ ...m, [id]: { mission: res.mission, warnings: [] } }));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "미션 조회 실패"))
      .finally(() => previewLoading.current.delete(id));
  }, [selectedRow, stateOf, preview]);

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
      setSelectedId(replacement.scenario_id);
      setBusy(null);
      toast.info("기존 미션은 반려 이력으로 보존했습니다. 새 시나리오로 다시 조립합니다.");
      await onAssemble(replacement);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "반려·재조립 준비 실패");
    } finally {
      setBusy(null);
    }
  };

  const visible = showAll ? filtered : filtered.slice(0, LIST_CAP);
  // 접혀 있어도 필터가 걸려 있는지 알 수 있어야 한다.
  const axisFilterActive = fAct !== "all" || fLevel !== "all" || fMode !== "all" || fDirection !== "all";
  const nextLabel = professorScreen && fState === "decision" ? "다음 결정 대기 미션 ▶" : "다음 미션 ▶";

  const badges = (r: CoreRow, size: "sm" | "md") => {
    const cls = size === "sm" ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-[12.5px]";
    const direction = coreDirection(r.core_content);
    const mode = r.mode === "stt_interpreting" ? "stt_interpreting" : "translation";
    if (!reviewMode) {
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={["rounded font-bold", cls, ACT_TONE[r.speech_act]].join(" ")}>{SPEECH_ACT_UI[r.speech_act]}</span>
          <span className="text-[12px] text-[#66727A]">{[DIRECTION_LABEL[direction], LEVEL[r.learner_level], MODE_LABEL[mode]].join(" · ")}</span>
        </span>
      );
    }
    return (
      <span className="flex flex-wrap items-center gap-1">
        <span className={["rounded font-bold", cls, ACT_TONE[r.speech_act]].join(" ")}>{SPEECH_ACT_UI[r.speech_act]}</span>
        <span className={["rounded border font-bold", cls, DIRECTION_TONE[direction]].join(" ")}>{DIRECTION_LABEL[direction]}</span>
        <span className={["rounded border font-semibold", cls, LEVEL_TONE[r.learner_level]].join(" ")}>{LEVEL[r.learner_level]}</span>
        <span className={["rounded border font-semibold", cls, MODE_TONE[mode]].join(" ")}>{MODE_LABEL[mode]}</span>
      </span>
    );
  };

  // 대기열 카드에는 고르는 데 필요한 것만. 전체 해시·run ID·원본은 작업대의 세부 추적 정보에 둔다.
  const cardMeta = (r: CoreRow) => {
    const info = reviewInfo.get(r.scenario_id);
    const st = stateOf(r);
    if (!reviewMode) {
      const production = productionOf(r);
      return [fState === "all" ? PRODUCTION_KO[production] : null,
        production === "v6_review" ? info?.progress : production === "v6_done" ? info?.placement : null];
    }
    if (aiReview) return [info?.progress, traceLabel(r.mission_content_hash)];
    return [info?.placement, missionVersionLabel(r.mission_schema_version),
      fState === "decision" ? null : info?.progress, traceLabel(r.mission_content_hash)];
  };

  const contextLabels = (r: CoreRow) => [
    r.domain ? DOMAIN[r.domain] : null,
    r.industry_sector ? (INDUSTRY[r.industry_sector as keyof typeof INDUSTRY] ?? r.industry_sector) : null,
    r.theme_code ? THEME_LABEL[r.theme_code] : null,
  ].filter(Boolean) as string[];

  const emptyWorkbench = () => {
    if (professorScreen && fState === "decision") {
      return (
        <>
          <p>지금 결정할 미션이 없습니다.</p>
          {dash.in_progress > 0 && (
            <Link className="mt-2 inline-block font-semibold text-[#15202B] underline underline-offset-4" to="/admin/ai-review">
              검수 진행 중인 {dash.in_progress}개는 품질 점검 화면에서 확인하세요 →
            </Link>
          )}
        </>
      );
    }
    if (aiReview && fState === "needs_check") {
      return (
        <>
          <p>지금 점검할 미션이 없습니다.</p>
          {dash.decision > 0 && (
            <Link className="mt-2 inline-block font-semibold text-[#15202B] underline underline-offset-4" to="/admin/review">
              교수자 승인 대기 {dash.decision}개는 교수자 최종 승인 화면에서 확인하세요 →
            </Link>
          )}
        </>
      );
    }
    return <p>조건에 맞는 미션이 없습니다. 상태·필터를 바꾸거나 시나리오 개별·배치 생성에서 새 시나리오를 만드세요.</p>;
  };

  const queueButton = (
    <Button size="sm" variant="outline" aria-label="미션 목록 열기" aria-expanded={queueOpen}
      className="h-8 shrink-0 gap-1.5 px-2.5 text-[12.5px]" onClick={() => setQueueOpen(true)}>
      <span aria-hidden>☰</span>{chipLabel(fState)}<span className="tabular-nums text-[#66727A]">{dash[fState]}</span>
    </Button>
  );

  const renderWorkbench = (r: CoreRow) => {
    const st = stateOf(r);
    const info = reviewInfo.get(r.scenario_id);
    const context = contextLabels(r);
    const isAssembling = busy === r.scenario_id && assemblyProgress?.id === r.scenario_id;
    const loaded = preview[r.scenario_id];
    // 머리 한 줄에 식별 정보를 모은다. 본문에서 같은 상태를 다시 말하지 않는다.
    // The final-approval screen already implies the review stage, so the header omits pipeline status.
    const metaLine = reviewMode
      ? [missionVersionLabel(r.mission_schema_version), info?.placement === "편성 전" ? null : info?.placement, updatedAtLabel(r.updated_at), traceLabel(r.mission_content_hash)]
      : [PRODUCTION_KO[productionOf(r)], ...context];
    const scenarioText = (
      <p className="max-w-[54rem] text-[13.5px] leading-relaxed text-[#202B33]">
        {r.core_content?.situation_ko ?? "—"}
        {reviewMode && context.length > 0 && <span className="ml-2 text-[12px] text-[#7A868D]">맥락 · {context.join(" · ")}</span>}
      </p>
    );
    const loadingMission = <p className="text-[13px] text-muted-foreground" role="status">미션을 불러오는 중…</p>;

    return (
      <div key={r.scenario_id}>
        {/* 긴 작업 중에도 지금 어느 미션을 보는지 잃지 않도록 머리는 두 줄로 줄여 위에 붙인다. */}
        <header className="sticky top-16 z-10 flex items-start justify-between gap-3 rounded-t-xl border-b border-[#ECE8DE] bg-white/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          {professorScreen && queueButton}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex min-w-0 items-center gap-2">
              {/* 배지는 줄바꿈하지 않고, 좁아지면 옆의 식별 정보가 먼저 말줄임된다. */}
              <span className="shrink-0 [&>span]:flex-nowrap">{badges(r, "sm")}</span>
              <p className="min-w-0 truncate text-[12px] text-[#7A868D]" title={metaLine.filter(Boolean).join(" · ")}>
                {metaLine.filter(Boolean).join(" · ")}
              </p>
            </div>
            <h2 className="line-clamp-2 text-[16px] font-bold leading-snug text-[#202B33]">{titleOf(r)}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-[#66727A]">
            {selectedIndex >= 0 && <span className="tabular-nums">{selectedIndex + 1} / {filtered.length}</span>}
            <Button size="sm" variant="outline" className="h-7 px-2 text-[12px]" disabled={!prevRow} onClick={() => selectRow(prevRow)}><ChevronLeft className="size-3.5" />이전</Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-[12px]" disabled={!nextRow} onClick={() => selectRow(nextRow)}>다음<ChevronRight className="size-3.5" /></Button>
          </div>
        </header>
        <div className="space-y-3 px-4 py-3 xl:px-5">

        {/* ── 학습 미션 제작 현황: 읽기만 하는 화면 ── */}
        {!reviewMode && (
          <>
            {scenarioText}
            <ProductionPath production={productionOf(r)} row={r} info={info} />
            {productionOf(r) !== "core_only" && productionOf(r) !== "v5_only" && (!loaded ? loadingMission : (
              loaded.mission.schema_version === "mission_v6" && <MissionOutline mission={loaded.mission} />
            ))}
            {(productionOf(r) === "v6_review" || productionOf(r) === "v6_done") && (
              <Link to={`${productionOf(r) === "v6_done" ? "/admin/review" : "/admin/ai-review"}?scenarioId=${r.scenario_id}`}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#15202B] underline underline-offset-4">
                {productionOf(r) === "v6_done" ? "교수자 최종 승인 화면에서 보기" : "품질 점검 화면에서 열기"}<ChevronRight className="size-3.5" />
              </Link>
            )}
          </>
        )}

        {/* ── 자동 품질 점검·AI 검토: 검사하고 넘기는 화면 ── */}
        {aiReview && (
          <>
            {(st === "generated" || st === "reviewed") && (
              <ContentReviewPanel framed={false} target={{ kind: "mission", targetId: r.scenario_id }}
                handoffHref={`/admin/review?scenarioId=${r.scenario_id}`} />
            )}
            <details>
              <summary className="cursor-pointer text-[12.5px] font-semibold text-[#5D6970]">시나리오 전문</summary>
              <div className="mt-1.5">{scenarioText}</div>
            </details>
          </>
        )}

        {/* ── 교수자 최종 승인: 결정하는 화면 ── */}
        {professorScreen && (
          <>
            {/* 감수 대상은 아래 학생 화면이다. 코어 원문은 필요할 때만 펼친다. */}
            <details>
              <summary className="cursor-pointer text-[12.5px] font-semibold text-[#5D6970]">시나리오 전문</summary>
              <div className="mt-1.5">{scenarioText}</div>
            </details>
            {st === "generated" && info?.queue !== "decision" && (
              <div className="rounded-xl border border-[#D8D3C4] bg-[#FBFAF6] px-4 py-3 text-[13.5px]">
                <p className="text-[#3F4E57]">이 미션은 아직 교수자 차례가 아닙니다 · {info?.progress ?? "검수 상태 확인 중"}</p>
                <Link to={`/admin/ai-review?scenarioId=${r.scenario_id}`} className="mt-2 inline-block font-semibold text-[#15202B] underline underline-offset-4">
                  품질 점검 화면에서 이 미션 열기 →
                </Link>
              </div>
            )}
            {st === "generated" && info?.queue === "decision" && (!loaded ? loadingMission : (
              <ProfessorMissionWorkbench
                scenarioId={r.scenario_id}
                key={`${loaded.mission.provenance?.mission_content_hash ?? "draft"}-${loaded.mission.quality_check?.verdict ?? "none"}`}
                mission={loaded.mission}
                busy={busy === r.scenario_id}
                onSave={(edits) => onSaveEdits(r, edits)}
                onReview={(overrides, approval) => onReview(r, overrides, approval)}
                traceHash={r.mission_content_hash ?? loaded.mission.provenance?.mission_content_hash}
              />
            ))}
            {st === "reviewed" && <ContentReviewPanel experiential framed={false} target={{ kind: "mission", targetId: r.scenario_id }} historicalApproval />}
          </>
        )}

        {/* 작업을 마쳐도 저절로 넘어가지 않는다. 결과를 확인한 뒤 교수자가 넘긴다. */}
        {reviewMode && (
          <footer className="flex justify-end pt-1">
            <Button size="sm" variant="outline" disabled={!nextRow} onClick={() => selectRow(nextRow)}>{nextLabel}</Button>
          </footer>
        )}
        </div>
      </div>
    );
  };

  return (
    <AdminShell
      title={aiReview ? "자동 품질 점검·AI 검토" : reviewMode ? "교수자 최종 승인" : "학습 미션 제작 현황"}
      description={aiReview
        ? "자동 점검·AI 검토로 감수 자료를 준비합니다. 승인은 하지 않습니다."
        : reviewMode
          ? "현재 콘텐츠를 감수하고 수업 사용을 최종 승인합니다."
          : "v6 학습 미션이 제작 경로의 어느 단계에 있는지 봅니다."}
    >
      {loading ? (
        <p className="mt-4 text-[13px] text-muted-foreground">불러오는 중…</p>
      ) : error ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
          <p>{error} 관리자 로그인 상태를 확인해 주세요.</p>
          <Button size="sm" variant="outline" onClick={() => void loadRows()}>다시 불러오기</Button>
        </div>
      ) : (
        <div className={professorScreen ? "grid items-start"
          : reviewMode ? "grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]"
            : "grid items-start gap-4 xl:grid-cols-2"}>
          {/* ── 왼쪽 대기열 (교수자 최종 승인에서는 서랍) ── */}
          {(!professorScreen || queueOpen) && <>
          {professorScreen && <div aria-hidden className="fixed inset-0 z-40 bg-[#15202B]/30" onClick={() => setQueueOpen(false)} />}
          <aside aria-label="대기열"
            className={professorScreen
              ? "fixed inset-y-0 left-0 z-50 flex w-[380px] max-w-[90vw] flex-col overflow-hidden border-r border-[#E2DED2] bg-[#F7F6F1] shadow-xl"
              : "flex flex-col overflow-hidden rounded-xl border border-[#E2DED2] bg-[#F7F6F1] xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)]"}>
            {professorScreen && (
              <div className="flex items-center justify-between border-b border-[#E2DED2] bg-white px-3 py-2">
                <span className="text-[13.5px] font-bold text-[#233542]">미션 목록</span>
                <Button size="sm" variant="ghost" className="h-7 px-2" aria-label="미션 목록 닫기" onClick={() => setQueueOpen(false)}>닫기 ✕</Button>
              </div>
            )}
            <div className="space-y-1.5 border-b border-[#E2DED2] px-2.5 py-2">
              {rows.length >= ROW_CAP && (
                <p className="rounded-md border border-[#FCD34D] bg-[#FEF3C7] px-2 py-1 text-[12px] text-[#92400E]">
                  ⚠️ 조회 상한 {ROW_CAP}건 — 최신 {ROW_CAP}건만 보고 있습니다.
                </p>
              )}
              <div className="flex flex-wrap gap-1" role="group" aria-label="상태">
                {chips.filter((s) => reviewMode || s === "all" || s === fState || dash[s] > 0).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFState(s)}
                    aria-pressed={fState === s}
                    className={[
                      "rounded-full border px-2 py-0.5 text-[12px] transition-colors",
                      fState === s
                        ? "border-[#233542] bg-[#233542] font-semibold text-white"
                        : "border-[#DDE2E4] bg-white text-[#46515A] hover:bg-[#F3F5F6]",
                    ].join(" ")}
                  >
                    {chipLabel(s)}
                    <span className="ml-1 tabular-nums opacity-80">{dash[s]}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  id="queue-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="제목·상황·Trace 검색"
                  aria-label="대기열 검색"
                  className="h-7 min-w-0 flex-1 rounded-md border border-[#D9D7CF] bg-white px-2 text-[12.5px]"
                />
                <select
                  id="queue-sort"
                  aria-label="정렬"
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}
                  className="h-7 rounded-md border border-[#D9D7CF] bg-white px-1 text-[12px] text-[#46515A]"
                >
                  {reviewMode
                    ? <><option value="oldest">오래 기다린 순</option><option value="newest">최근 수정순</option></>
                    : <><option value="newest">최신순</option><option value="oldest">오래된 순</option></>}
                </select>
              </div>
              <div className="flex gap-1.5 text-[12px]">
                {([["axis", "필터", axisFilterActive], ["advanced", "고급",  fRun !== "all" || fHash !== "all"]] as const).map(([key, label, active]) => (
                  <button key={key} type="button" aria-expanded={openFilter === key}
                    onClick={() => setOpenFilter((current) => (current === key ? null : key))}
                    className={[
                      "flex h-7 min-w-0 items-center gap-1 rounded-md border px-2 font-semibold",
                      openFilter === key ? "border-[#233542] bg-white text-[#233542]" : "border-[#DDE2E4] bg-white text-[#46515A] hover:bg-[#F3F5F6]",
                    ].join(" ")}>
                    <span className="truncate">{label}</span>
                    {active && <span className="shrink-0 rounded bg-[#F6EDD0] px-1 text-[11px] text-[#8A6B24]">적용</span>}
                    <span aria-hidden className="shrink-0 text-[#8C969B]">{openFilter === key ? "▴" : "▾"}</span>
                  </button>
                ))}
              </div>
              {openFilter === "axis" && (
                <div className="grid grid-cols-2 gap-1.5">
                  <AxisSel index="1" label="화행" value={fAct} onChange={(v) => setFAct(v as typeof fAct)}
                    opts={[["all", "전체"], ...ACTS.map((a) => [a, SPEECH_ACT_UI[a]] as [string, string])]} />
                  <AxisSel index="2" label="수준" value={fLevel} onChange={(v) => setFLevel(v as typeof fLevel)}
                    opts={[["all", "전체"], ...LEVELS.map((l) => [l, LEVEL[l]] as [string, string])]} />
                  <AxisSel index="3" label="모드" value={fMode} onChange={(v) => setFMode(v as typeof fMode)}
                    opts={[["all", "전체"], ["translation", MODE_LABEL.translation], ["stt_interpreting", MODE_LABEL.stt_interpreting]]} />
                  <AxisSel index="4" label="언어방향" value={fDirection} onChange={(v) => setFDirection(v as typeof fDirection)}
                    opts={[["all", "전체"], ...Object.entries(DIRECTION_LABEL)]} />
                </div>
              )}
              {openFilter === "advanced" && (
                <div className="grid gap-1.5">
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
              )}
            </div>

            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5" aria-label="미션 목록">
              {visible.map((r) => {
                const st = stateOf(r);
                const selected = r.scenario_id === selectedId;
                const meta = cardMeta(r).filter(Boolean);
                return (
                  <li key={r.scenario_id} id={`queue-${r.scenario_id}`}
                    className={[
                      "flex gap-2 rounded-md border px-2 py-1.5",
                      selected ? "border-[#233542] bg-white shadow-[inset_3px_0_0_#233542]" : "border-transparent bg-white/70 hover:border-[#D5D9DB] hover:bg-white",
                    ].join(" ")}>
                    {aiReview && st === "generated" && (
                      <input type="checkbox" className="mt-1 shrink-0" aria-label={`감수 자료 준비 선택 ${r.scenario_id}`} disabled={reviewQueue.active}
                        checked={reviewSelection.has(r.scenario_id)} onChange={(event) => setReviewSelection((current) => {
                          const next = new Set(current); if (event.target.checked) next.add(r.scenario_id); else next.delete(r.scenario_id); return next;
                        })} />
                    )}
                    <button type="button" className="min-w-0 flex-1 space-y-0.5 text-left" aria-current={selected ? "true" : undefined}
                      onClick={() => { selectRow(r); if (professorScreen) setQueueOpen(false); }}>
                      {badges(r, "sm")}
                      <span className="line-clamp-2 block text-[14px] font-medium leading-snug text-[#202B33]">{titleOf(r)}</span>
                      {meta.length > 0 && (
                        <span className="block truncate text-[12px] text-[#7A868D]" title={meta.join(" · ")}>{meta.join(" · ")}</span>
                      )}
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">이 조건의 미션이 없습니다.</li>
              )}
              {filtered.length > LIST_CAP && (
                <li>
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((prev) => !prev)}>
                    {showAll ? `처음 ${LIST_CAP}개만 보기` : `전체 ${filtered.length}개 모두 표시`}
                  </Button>
                </li>
              )}
            </ul>

            {/* 일괄 감수 자료 준비는 늘 보인다. 실행은 버튼으로만. 진행 상황은 AdminShell 상단 표시가 따로 보여 준다. */}
            {aiReview && (
              <div className="space-y-1 border-t border-[#E2DED2] bg-white px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-1 text-[12px]">
                  <span className="font-semibold text-[#202B33]">{reviewSelection.size}건 선택</span>
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[12px]" disabled={reviewQueue.active}
                    onClick={() => setReviewSelection(new Set(visible.filter((row) => stateOf(row) === "generated").map((row) => row.scenario_id)))}>표시된 미션 모두 선택</Button>
                  {reviewSelection.size > 0 && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[12px]" disabled={reviewQueue.active} onClick={() => setReviewSelection(new Set())}>선택 해제</Button>}
                </div>
                <Button size="sm" className="h-8 w-full" disabled={reviewSelection.size === 0 || reviewQueue.active || Boolean(busy)} onClick={() => void startReviewPreparation(
                  filtered.filter((row) => reviewSelection.has(row.scenario_id) && stateOf(row) === "generated").map((row) => ({
                    target: { kind: "mission" as const, targetId: row.scenario_id },
                    label: `${SPEECH_ACT_UI[row.speech_act]} · ${row.scenario_id.slice(0, 8)}`,
                  })))}>{reviewSelection.size}건 감수 자료 준비</Button>
                <p className="text-[12px] text-muted-foreground">저장 결과 재사용 · 없을 때만 유료 AI 검토</p>
              </div>
            )}
          </aside>
          </>}

          {/* ── 오른쪽 작업대 ── */}
          <section aria-label="작업대" className="min-w-0 rounded-xl border border-[#E2DED2] bg-white">
            {selectedRow ? renderWorkbench(selectedRow) : (
              <div className="space-y-3 py-10 text-center text-[13.5px] text-[#46515A]">
                {professorScreen && <div className="flex justify-center">{queueButton}</div>}
                {emptyWorkbench()}
              </div>
            )}
          </section>
        </div>
      )}
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
      <span className="flex size-4.5 items-center justify-center rounded-full bg-[#E7ECEE] text-[11px] text-[#53656F]">{index}</span>
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
        <span className="text-[12px] font-semibold text-[#233542]">{progressLabel(stage)}</span>
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
                "mt-1 block truncate text-[11px]",
                isActive ? "font-semibold text-[#233542]" : isDone ? "text-[#53656F]" : "text-[#98A1A6]",
              ].join(" ")}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

type StepStatus = "done" | "current" | "todo";

/** v6 제작 경로 5단계. 단계 판정은 대시보드·점검·승인 화면과 같은 검수 이력·편성 조회를 쓴다. */
const ProductionPath = ({ production, row, info }: { production: ProductionState; row: CoreRow; info: ReviewInfo | undefined }) => {
  const v6 = production === "v6_review" || production === "v6_done";
  const approved = production === "v6_done";
  const decision = production === "v6_review" && info?.queue === "decision";
  const placed = Boolean(info?.placement && info.placement !== "편성 전");
  const created = row.created_at
    ? `${new Date(row.created_at).getMonth() + 1}/${new Date(row.created_at).getDate()}`
    : null;
  const steps: { label: string; status: StepStatus; detail?: string | null }[] = [
    { label: "v5 원본", status: production === "core_only" ? "todo" : "done", detail: production === "core_only" ? "미션 없음" : null },
    { label: "v6 변환·집필", status: v6 ? "done" : production === "v5_only" ? "current" : "todo", detail: v6 ? created : production === "v5_only" ? "변환 전" : null },
    { label: "자동 검사·AI 검토", status: approved || decision ? "done" : production === "v6_review" ? "current" : "todo", detail: production === "v6_review" && !decision ? info?.progress : null },
    { label: "교수자 승인", status: approved ? "done" : decision ? "current" : "todo", detail: decision ? "승인 대기" : null },
    { label: "편성", status: placed ? "done" : approved ? "current" : "todo", detail: placed ? info?.placement : approved ? "편성 전" : null },
  ];
  return (
    <section aria-label="제작 경로" className="rounded-lg border border-[#E7E2D4] bg-[#FBFAF6] px-4 py-3">
      <h3 className="mb-2.5 text-[13px] font-bold text-[#233542]">제작 경로</h3>
      <ol className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => (
          <li key={step.label} className="relative min-w-0">
            {index > 0 && (
              <span aria-hidden className={["absolute right-[calc(50%+14px)] top-[11px] h-px w-[calc(100%-20px)]",
                step.status === "todo" ? "bg-[#DDD8CB]" : "bg-[#233542]"].join(" ")} />
            )}
            <span className="flex flex-col items-center text-center">
              <span className={["relative z-[1] flex size-6 items-center justify-center rounded-full text-[11.5px] font-bold tabular-nums",
                step.status === "done" ? "bg-[#233542] text-white"
                  : step.status === "current" ? "border-2 border-[#C08A2E] bg-white text-[#8A5A14]"
                    : "border border-[#D6D1C3] bg-white text-[#9AA2A6]"].join(" ")}>
                {step.status === "done" ? "✓" : index + 1}
              </span>
              <span className={["mt-1.5 text-[12.5px] leading-tight",
                step.status === "todo" ? "text-[#9AA2A6]" : "font-semibold text-[#233542]"].join(" ")}>{step.label}</span>
              {step.detail && (
                <span className={["mt-0.5 line-clamp-2 text-[11.5px] leading-snug",
                  step.status === "current" ? "text-[#8A5A14]" : "text-[#66727A]"].join(" ")}>{step.detail}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
};

/** 학습 미션 설계 — 판단 문항 5개의 제목과 직접 산출 과제. 문항 본문은 품질 점검·승인 화면에서 본다. */
const MissionOutline = ({ mission }: { mission: LearnerMissionRuntime }) => {
  const v6 = mission as MissionV6;
  const task = v6.production_task;
  return (
    <section aria-label="학습 미션 설계" className="rounded-lg border border-[#ECE8DE] px-4 py-3">
      <h3 className="mb-2 text-[13px] font-bold text-[#233542]">학습 미션 설계</h3>
      <ol className="divide-y divide-[#F0EDE4] text-[13px]">
        {v6.mpj_items.map((item, index) => (
          <li key={index} className="flex gap-3 py-1.5">
            <span className="w-[4.5rem] shrink-0 font-semibold tabular-nums text-[#66727A]">MJT 문항 {index + 1}</span>
            <span className="min-w-0 text-[#202B33]">{item.title}</span>
          </li>
        ))}
        <li className="flex gap-3 py-1.5">
          <span className="w-[4.5rem] shrink-0 font-semibold text-[#66727A]">DCT 문항</span>
          <span className="min-w-0 text-[#202B33]">{task.mode === "interpreting" ? "통역" : "번역"} 산출 1회 · AI 피드백 후 다듬기</span>
        </li>
      </ol>
    </section>
  );
};

export default AdminAssembly;
