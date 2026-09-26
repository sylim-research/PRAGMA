import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { CurriculumSyllabus } from "@/components/admin/CurriculumSyllabus";
import { CurriculumSyllabusSettingsForm } from "@/components/admin/CurriculumSyllabusSettingsForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  deleteCurriculumOutline,
  unpublishCurriculumOutline,
  getCurriculumOutline,
  listCurriculumOutlines,
  updateCurriculumCompositionAxes,
} from "@/lib/curriculum/api";
import type { CurriculumOutlineRow, CurriculumWeekRow } from "@/lib/curriculum/types";
import {
  EMPTY_SYLLABUS_SETTINGS,
  loadCurriculumSyllabusSettings,
  saveCurriculumSyllabusSettings,
  syllabusEvaluationIsValid,
  type CurriculumSyllabusSettings,
} from "@/lib/curriculum/syllabusSettings";
import {
  listCoreScenarios,
  listWeekAssignments,
  saveWeekAssignments,
  type ComposerCore,
  type WeekAssignment,
} from "@/lib/curriculum/composer";
import { isReviewedMission } from "@/lib/curriculum/composerEligibility";
import {
  addAssignment,
  buildAutomaticAssignments,
  assignmentStructureIssues,
  duplicateScenarioIds,
  filterManualCandidates,
  removeAssignment,
  type AssignedItem,
  type AssignMap,
} from "@/lib/curriculum/composerPlanning";
import {
  DIRECTION_LABEL,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type GenMode,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import {
  COURSE_PRESETS,
  courseDisplayTitle,
  THEME_CODES,
  THEME_LABEL,
  type ThemeCode,
} from "@/lib/pragma/scenarioTopics";
import { getTargetFeature, DEFAULT_FEATURE_BY_ACT } from "@/lib/pragma/targetFeatures";
import { CurriculumEditor } from "./CurriculumEditor";
import { NewCoursePanel } from "./NewCoursePanel";
import { CompositionConditionFields } from "@/components/admin/CompositionConditionFields";
import { countAvailableMissions } from "@/lib/curriculum/compositionConditions";
import { isReinforcementWeek, REINFORCEMENT_DESCRIPTION, weekActivityLabel } from "@/lib/curriculum/weekGuidance";
import {
  COURSE_MODE_LABEL,
  COURSE_MODES,
  courseModePolicyFromLegacyRatio,
  expectedMissionModesForWeek,
  missionModesSummary,
  isCourseModePolicyValid,
  type CourseMode,
} from "@/lib/curriculum/courseModePolicy";

// 이 브라우저에서 마지막으로 연 교과목(편의 기능). 서버 상태가 아니다.
const LAST_OUTLINE_KEY = "pragma.admin.composer.lastOutline";
const CONDITION_LABEL = "text-[11.5px] font-semibold text-[#46515A]";
const CONDITION_SELECT = "h-9 w-full rounded-md border border-[#D8D4C8] bg-white px-2 text-[13.5px] text-[#15202B]";
const SETTINGS_MENU_ITEM =
  "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] text-[#26333B] hover:bg-[#F6F5F1] disabled:pointer-events-none disabled:opacity-50";

// 15주 편성기 (태스크 D) — 관리자구조md §6-2 + 계약 0-g·47.
// 흐름: 강좌 골격 선택 → 수준·주제·모드·언어방향 조절 → 자동 채우기
//       → 주차별 수동 교체 → 저장. 편성 후보와 저장 대상은 검토 완료 미션으로 제한한다.
// 읽기 전용 데이터는 scenario_core_v1 코어. 저장은 curriculum_week_scenarios.
//
// 네 편성 축을 한 화면에 둔다(지도교수 요구). 프리셋은 주제·강좌 모드를 빠르게
// 채우는 편의일 뿐이며, 교강사가 모든 축을 개별 조정한다.

const LEVELS: LearnerLevel[] = ["beginner_intermediate", "intermediate", "advanced"];
const DIRECTIONS: LanguageDirection[] = ["ko_zh", "zh_ko"];

const themePolicyKey = (themes: ThemeCode[]) => [...themes].sort().join("|");

const AdminComposer = () => {
  const [outlines, setOutlines] = useState<CurriculumOutlineRow[]>([]);
  const [cores, setCores] = useState<ComposerCore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 선택된 커리큘럼은 URL(?outline=)에 보관 → 새로고침해도 유지되고 저장분이 다시 뜬다.
  const [searchParams, setSearchParams] = useSearchParams();
  const outlineId = searchParams.get("outline") ?? "";
  const libraryScenarioId = searchParams.get("scenarioId");
  const setOutlineId = (id: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    if (id) next.set("outline", id);
    else next.delete("outline");
    return next;
  }, { replace: true });

  // 교과목 단위 설정 메뉴와, 그 안의 확인 대화상자(메뉴가 닫혀도 대화상자는 유지되도록 밖에 둔다).
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(true);
  // 「새 교과목 개설」(/admin/composer/new)과 「15주 수업 편성」(/admin/composer)은 메뉴가 따로다(2026-09-26 연구자 결정).
  const location = useLocation();
  const navigate = useNavigate();
  const tab: "existing" | "new" = location.pathname === "/admin/composer/new" ? "new" : "existing";
  const setTab = (next: "existing" | "new") => navigate(next === "new" ? "/admin/composer/new" : "/admin/composer");
  // 새 교과목을 만든 직후, 그 교과목이 다 불러와지면 미션 자동 채우기를 한 번 실행한다.
  // 새 교과목을 만든 뒤 편성 화면으로 넘어오면(주소가 바뀌어 화면이 새로 그려져도) 자동 채우기를 이어서 한다.
  const [pendingAutoFillId, setPendingAutoFillId] = useState<string | null>(() => (location.state as { autoFillId?: string } | null)?.autoFillId ?? null);
  const [confirmAction, setConfirmAction] = useState<"unpublish" | "delete" | null>(null);

  const [outline, setOutline] = useState<CurriculumOutlineRow | null>(null);
  const [weeks, setWeeks] = useState<CurriculumWeekRow[]>([]);
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [structureEditor, setStructureEditor] = useState<"new" | "current" | null>(null);
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [syllabusOpen, setSyllabusOpen] = useState(false);
  const [syllabusSettings, setSyllabusSettings] = useState<CurriculumSyllabusSettings>(
    EMPTY_SYLLABUS_SETTINGS,
  );
  const [reloadToken, setReloadToken] = useState(0);

  // 수준·방향도 편성기의 교강사 조절 축이다. 저장 시 outline 메타에 함께 반영한다.
  const [level, setLevel] = useState<LearnerLevel>("intermediate");
  const [direction, setDirection] = useState<LanguageDirection>("ko_zh");
  // 테마·강좌 모드 = 프리셋과 독립. 프리셋 선택 시 여기에 복사(빠른 채우기).
  const [themes, setThemes] = useState<ThemeCode[]>([]);
  const [courseMode, setCourseMode] = useState<CourseMode>("translation");
  const [interpretingWeekCount, setInterpretingWeekCount] = useState(0);
  const [policyBaseline, setPolicyBaseline] = useState<{
    themeKey: string;
    courseMode: CourseMode;
    interpretingWeekCount: number;
  } | null>(null);
  const [presetCode, setPresetCode] = useState<string>("");

  const [assign, setAssign] = useState<AssignMap>({});
  const [deleting, setDeleting] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [loadedAssignments, setLoadedAssignments] = useState<WeekAssignment[] | null>(null);
  const [addingWeek, setAddingWeek] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoFillShortages, setAutoFillShortages] = useState<
    Array<{ weekNo: number; missingSlots: number }>
  >([]);


  // 제작 파이프라인 전체 통계 대신, 지금 선택한 편성 조건에서 실제로 쓸 수 있는
  // 검토 완료 미션 수만 보여준다. 부족 원인은 설명하되 내부 상태명은 노출하지 않는다.
  const availableMissionCount = useMemo(
    () => countAvailableMissions(cores, { level, direction, courseMode, themes }),
    [cores, courseMode, direction, level, themes],
  );


  // 새 판이 있는 옛 판. 편성에는 「교체 필요」로 표시하고, 새로 추가할 후보에서는 뺀다.
  const replacedIds = useMemo(() => new Set(cores.map((core) => core.supersedes_scenario_id).filter(Boolean) as string[]), [cores]);
  const coreById = useMemo(() => {
    const m: Record<string, ComposerCore> = {};
    for (const c of cores) m[c.scenario_id] = c;
    return m;
  }, [cores]);
  const libraryMission = libraryScenarioId ? coreById[libraryScenarioId] : null;
  const libraryMissionAssigned = libraryScenarioId && Object.values(assign)
    .some((items) => items.some((item) => item.scenario_id === libraryScenarioId));
  const libraryTargetWeeks = libraryMission && outline?.id === outlineId && !loadingOutline && loadedAssignments !== null
    ? weeks.filter((week) => week.type === "regular" && week.speech_act
      && filterManualCandidates([libraryMission], {
        act: week.speech_act as SpeechActUI, level, direction, themes, assignments: assign,
        expectedModes: expectedMissionModesForWeek({ courseMode }, week.week_no), weekNo: week.week_no, coreById,
      }).length > 0)
    : [];

  // ── 초기 로드: 커리큘럼 목록 + 코어 전건 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [os, cs] = await Promise.all([listCurriculumOutlines(), listCoreScenarios()]);
        if (cancelled) return;
        setOutlines(os);
        setCores(cs);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // 교과목이 있으면 빈 화면으로 시작하지 않는다. 주소 지정 > 이 브라우저에서 마지막으로 연 교과목 > 첫 교과목.
  useEffect(() => {
    if (loading || outlineId || outlines.length === 0) return;
    let remembered: string | null = null;
    try { remembered = window.localStorage.getItem(LAST_OUTLINE_KEY); } catch { /* 저장소를 쓸 수 없으면 첫 교과목 */ }
    setOutlineId((outlines.find((item) => item.id === remembered) ?? outlines[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, outlineId, outlines]);
  useEffect(() => {
    if (!outlineId) return;
    try { window.localStorage.setItem(LAST_OUTLINE_KEY, outlineId); } catch { /* 기억은 편의 기능이라 실패해도 무시 */ }
  }, [outlineId]);

  // ── 커리큘럼 선택 시: 주차 골격 + 기존 배정 로드(새로고침 복원 경로) ──
  useEffect(() => {
    if (!outlineId) {
      setOutline(null);
      setWeeks([]);
      setAssign({});
      setLoadedAssignments(null);
      setLevel("intermediate");
      setDirection("ko_zh");
      setThemes([]);
      setCourseMode("translation");
      setInterpretingWeekCount(0);
      setPolicyBaseline(null);
      setPresetCode("");
      setAutoFillShortages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingOutline(true);
      setLoadedAssignments(null);
      setError(null);
      try {
        const [{ outline: o, weeks: w }, existing] = await Promise.all([
          getCurriculumOutline(outlineId),
          listWeekAssignments(outlineId),
        ]);
        if (cancelled) return;
        setOutline(o);
        setWeeks(w);
        setLevel(o.level as LearnerLevel);
        setDirection(o.language_direction as LanguageDirection);
        const hasStoredPolicy =
          Array.isArray(o.composition_theme_codes) &&
          COURSE_MODES.includes(o.course_mode as CourseMode) &&
          isCourseModePolicyValid({
            courseMode: o.course_mode as CourseMode,
            interpretingWeekCount: o.target_interpreting_week_count,
          });
        if (hasStoredPolicy) {
          const storedThemes = o.composition_theme_codes.filter((theme): theme is ThemeCode =>
            THEME_CODES.includes(theme as ThemeCode),
          );
          setThemes(storedThemes);
          setCourseMode(o.course_mode as CourseMode);
          setInterpretingWeekCount(o.target_interpreting_week_count);
          setPolicyBaseline({
            themeKey: themePolicyKey(storedThemes),
            courseMode: o.course_mode as CourseMode,
            interpretingWeekCount: o.target_interpreting_week_count,
          });
        } else {
          setPolicyBaseline(null);
        }
        setPresetCode("");
        setAutoFillShortages([]);
        setAssign(assignmentsToMap(existing));
        setLoadedAssignments(existing);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "교과목을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoadingOutline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [outlineId]);

  // migration 적용 전 만들어진 legacy outline은 저장된 정책 열이 없을 수 있다.
  // 그 경우에만 legacy 비율을 12주 정수 정책으로 해석해 이전 동작을 보존한다.
  useEffect(() => {
    if (!outlineId || loadedAssignments === null || cores.length === 0) return;
    if (
      outline &&
      Array.isArray(outline.composition_theme_codes) &&
      COURSE_MODES.includes(outline.course_mode as CourseMode) &&
      isCourseModePolicyValid({
        courseMode: outline.course_mode as CourseMode,
        interpretingWeekCount: outline.target_interpreting_week_count,
      })
    ) {
      return;
    }
    const assignedCores = loadedAssignments
      .map((item) => cores.find((core) => core.scenario_id === item.scenario_id))
      .filter((core): core is ComposerCore => Boolean(core));
    const legacyPolicy = courseModePolicyFromLegacyRatio(outline?.target_interpreting_ratio);
    if (assignedCores.length === 0) {
      setThemes([]);
      setCourseMode(legacyPolicy.courseMode);
      setInterpretingWeekCount(legacyPolicy.interpretingWeekCount);
      setPolicyBaseline({
        themeKey: "",
        courseMode: legacyPolicy.courseMode,
        interpretingWeekCount: legacyPolicy.interpretingWeekCount,
      });
      setPresetCode("");
      return;
    }
    const assignedThemes = [...new Set(
      assignedCores
        .map((core) => core.theme_code)
        .filter((theme): theme is ThemeCode => Boolean(theme)),
    )];
    const legacyThemes = assignedThemes.length === THEME_CODES.length ? [] : assignedThemes;
    setThemes(legacyThemes);
    setCourseMode(legacyPolicy.courseMode);
    setInterpretingWeekCount(legacyPolicy.interpretingWeekCount);
    setPolicyBaseline({
      themeKey: themePolicyKey(legacyThemes),
      courseMode: legacyPolicy.courseMode,
      interpretingWeekCount: legacyPolicy.interpretingWeekCount,
    });
    setPresetCode("");
  }, [cores, loadedAssignments, outline, outlineId]);

  const toggleTheme = (t: ThemeCode) =>
    setThemes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const changeCourseMode = (nextMode: CourseMode) => {
    setCourseMode(nextMode);
    setInterpretingWeekCount(
      nextMode === "translation"
        ? 0
        : nextMode === "interpreting"
          ? 12
          : interpretingWeekCount >= 1 && interpretingWeekCount <= 11
            ? interpretingWeekCount
            : 6,
    );
  };

  // 편성 조건이 바뀌면 직전 자동 채우기의 부족 경고는 더 이상 현재 조건을 설명하지 않는다.
  useEffect(() => {
    setAutoFillShortages([]);
  }, [level, direction, themes, courseMode, interpretingWeekCount]);

  // ── 자동 채우기 (수준·주제·강좌 모드·언어방향 = 현재 선택값) ──
  const autoFill = (allowThemeExpansion = false) => {
    if (!outline) return;
    const result = buildAutomaticAssignments({
      weeks,
      cores,
      level,
      direction,
      themes,
      courseModePolicy: { courseMode, interpretingWeekCount },
      defaultScenariosPerWeek: outline.scenarios_per_week ?? 3,
      allowThemeExpansion,
    });
    setAssign(result.assignments);
    setAutoFillShortages(result.shortages);
    setAddingWeek(null);
    if (result.shortages.length > 0) {
      toast.warning(
        `자동 채우기 완료 — ${result.shortages.length}개 주차에 미션이 부족합니다. 선택 주제는 유지했습니다.`,
      );
    } else {
      toast.success(
        `자동 채우기 완료 — ${result.filledWeeks}개 주차에 미션 ${result.totalAssigned}개 (저장 전)`,
      );
    }
    if (result.expandedThemeWeeks.length > 0) {
      toast.info(`교수자 승인으로 ${result.expandedThemeWeeks.length}개 주차의 주제 범위를 확대했습니다.`);
    }
  };

  const removeItem = (weekNo: number, scenarioId: string) =>
    setAssign((prev) => removeAssignment(prev, weekNo, scenarioId));

  const addItem = (weekNo: number, c: ComposerCore) =>
    setAssign((prev) => addAssignment(
      prev,
      weekNo,
      c,
      expectedMissionModesForWeek({ courseMode }, weekNo),
      coreById,
    ));

  // 교과목 삭제 — 주차·미션 배정은 DB의 ON DELETE CASCADE가 함께 지운다.
  // 학습자 수행 기록(learner_mission_logs)은 outline을 참조하지 않으므로 보존된다.
  const selectedOutline = outlines.find((item) => item.id === outlineId);
  const selectedIsPublished = selectedOutline?.status === "published";
  const assignedCount = Object.values(assign).reduce((total, items) => total + items.length, 0);

  const handleUnpublish = async () => {
    if (!outlineId || !selectedIsPublished) return;
    setUnpublishing(true);
    setError(null);
    try {
      await unpublishCurriculumOutline(outlineId);
      setOutlines((prev) =>
        prev.map((item) => (item.id === outlineId ? { ...item, status: "draft" } : item)),
      );
      toast.success("비공개로 바꿨습니다.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "비공개로 바꾸지 못했습니다.";
      setError(message);
      toast.error(message);
    } finally {
      setUnpublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!outlineId || selectedIsPublished) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCurriculumOutline(outlineId);
      setOutlines((prev) => prev.filter((item) => item.id !== outlineId));
      setOutlineId("");
      setWeeks([]);
      setAssign({});
      toast.success("교과목을 삭제했습니다.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "교과목을 삭제하지 못했습니다.";
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!outlineId) return;
    const flat: WeekAssignment[] = [];
    for (const [weekNoStr, items] of Object.entries(assign)) {
      const weekNo = Number(weekNoStr);
      items.forEach((it, i) =>
        flat.push({
          week_no: weekNo,
          scenario_id: it.scenario_id,
          position: i,
          slot_role: it.slot_role,
          pair_contract_version: it.pair_contract_version ?? null,
          mission_role: it.mission_role ?? null,
          changed_context_axes: it.changed_context_axes ?? [],
          diagnostic_dimensions: it.diagnostic_dimensions ?? [],
        }),
      );
    }
    const unreviewed = flat.filter((item) => !isReviewedMission(coreById[item.scenario_id]));
    if (unreviewed.length > 0) {
      toast.error(`검토 완료되지 않은 미션 ${unreviewed.length}개를 편성에서 제거한 뒤 저장하세요.`);
      return;
    }
    const duplicates = duplicateScenarioIds(assign);
    if (duplicates.length > 0) {
      toast.error(`같은 시나리오가 여러 주차에 중복 배정되어 있습니다 (${duplicates.length}개).`);
      return;
    }
    const structureIssues = assignmentStructureIssues(
      assign,
      coreById,
      weeks,
      level,
      direction,
      outline?.scenarios_per_week ?? 0,
      { courseMode, interpretingWeekCount },
    );
    if (structureIssues.length > 0) {
      toast.error(
        `주차 계획과 맞지 않는 배정 ${structureIssues.length}건이 있습니다. 자동 채우기하거나 교체한 뒤 저장하세요.`,
      );
      return;
    }
    setSaving(true);
    try {
      // 현재 배정이 새 축과 호환됨을 먼저 확인했으므로, 축을 바꿔도 기존 편성이
      // 불일치 상태가 되지 않는다. 주차 골격은 이 전용 API가 건드리지 않는다.
      const compositionUpdate = await updateCurriculumCompositionAxes(outlineId, {
        level,
        language_direction: direction,
        composition_theme_codes: themes,
        course_mode: courseMode,
        target_interpreting_week_count: interpretingWeekCount,
      });
      await saveWeekAssignments(outlineId, flat);
      // 저장 직후 DB에서 두 층을 다시 읽어와 실제 반영을 확인(라운드트립 증명).
      const [{ outline: reloadedOutline, weeks: reloadedWeeks }, reloaded] = await Promise.all([
        getCurriculumOutline(outlineId),
        listWeekAssignments(outlineId),
      ]);
      const reloadedHasPolicy =
        Array.isArray(reloadedOutline.composition_theme_codes) &&
        COURSE_MODES.includes(reloadedOutline.course_mode as CourseMode) &&
        isCourseModePolicyValid({
          courseMode: reloadedOutline.course_mode as CourseMode,
          interpretingWeekCount: reloadedOutline.target_interpreting_week_count,
        });
      const savedThemes = reloadedHasPolicy
        ? reloadedOutline.composition_theme_codes.filter(
            (theme): theme is ThemeCode => THEME_CODES.includes(theme as ThemeCode),
          )
        : themes;
      const savedCourseMode = reloadedHasPolicy
        ? reloadedOutline.course_mode as CourseMode
        : courseMode;
      const savedInterpretingWeekCount = reloadedHasPolicy
        ? reloadedOutline.target_interpreting_week_count
        : interpretingWeekCount;
      const hydratedOutline = reloadedHasPolicy
        ? reloadedOutline
        : {
            ...reloadedOutline,
            composition_theme_codes: savedThemes,
            course_mode: savedCourseMode,
            target_interpreting_week_count: savedInterpretingWeekCount,
          };
      setOutline(hydratedOutline);
      setWeeks(reloadedWeeks);
      setLevel(reloadedOutline.level as LearnerLevel);
      setDirection(reloadedOutline.language_direction as LanguageDirection);
      setThemes(savedThemes);
      setCourseMode(savedCourseMode);
      setInterpretingWeekCount(savedInterpretingWeekCount);
      setPolicyBaseline({
        themeKey: themePolicyKey(savedThemes),
        courseMode: savedCourseMode,
        interpretingWeekCount: savedInterpretingWeekCount,
      });
      setOutlines((prev) => prev.map((item) => (item.id === outlineId ? hydratedOutline : item)));
      setAssign(assignmentsToMap(reloaded));
      toast.success(`편성 저장 완료 — DB에서 ${reloaded.length}개 확인`);
      if (!compositionUpdate.compositionPolicyPersisted) {
        toast.warning("DB 확장 전 호환 모드: 강좌 모드는 legacy 비율로 근사 저장됩니다.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const assignedModeWeekCounts = useMemo(() => {
    let interpreting = 0;
    let translation = 0;
    for (const week of weeks.filter((item) => item.type === "regular" && item.speech_act)) {
      for (const item of assign[week.week_no] ?? []) {
        const mode = coreById[item.scenario_id]?.mode;
        if (mode === "stt_interpreting") interpreting += 1;
        else if (mode === "translation") translation += 1;
      }
    }
    return { interpreting, translation };
  }, [assign, coreById, weeks]);
  const assignedMissionCount = useMemo(
    () => Object.values(assign).reduce((total, items) => total + items.length, 0),
    [assign],
  );

  const axesDirty = Boolean(
    outline &&
      ((outline.level as LearnerLevel) !== level ||
        (outline.language_direction as LanguageDirection) !== direction ||
        (policyBaseline !== null &&
          (policyBaseline.themeKey !== themePolicyKey(themes) ||
            policyBaseline.courseMode !== courseMode ||
            policyBaseline.interpretingWeekCount !== interpretingWeekCount))),
  );
  const weekColumnBreak = Math.ceil(weeks.length / 2);

  const handleStructureSaved = (saved: {
    outline: CurriculumOutlineRow;
    weeks: CurriculumWeekRow[];
  }) => {
    setStructureEditor(null);
    setEditingWeek(null);
    setOutline(saved.outline);
    setWeeks(saved.weeks);
    setOutlineId(saved.outline.id);
    setReloadToken((token) => token + 1);
  };

  const handleCourseCreated = (saved: { outline: CurriculumOutlineRow; weeks: CurriculumWeekRow[] }) => {
    setLoadedAssignments(null);
    setPendingAutoFillId(saved.outline.id);
    handleStructureSaved(saved);
    navigate(`/admin/composer?outline=${saved.outline.id}`, { state: { autoFillId: saved.outline.id } });
  };

  useEffect(() => {
    if (!pendingAutoFillId || outline?.id !== pendingAutoFillId || loadingOutline || loadedAssignments === null) return;
    setPendingAutoFillId(null);
    autoFill(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoFillId, outline, loadingOutline, loadedAssignments]);

  const openSyllabus = () => {
    if (!outlineId) return;
    setSyllabusSettings(loadCurriculumSyllabusSettings(outlineId));
    setSyllabusOpen(true);
  };

  const handleSaveSyllabusSettings = () => {
    if (!outlineId) return;
    if (!syllabusEvaluationIsValid(syllabusSettings)) {
      toast.error("평가 비중 합계를 100%로 맞춰주세요.");
      return;
    }
    try {
      saveCurriculumSyllabusSettings(outlineId, syllabusSettings);
      toast.success("강의계획서 교수자 항목을 이 브라우저에 저장했습니다.");
    } catch {
      toast.error("교수자 항목을 저장하지 못했습니다.");
    }
  };

  if (structureEditor) {
    return (
      <AdminShell
        title="15주 수업 편성"
        compact
        description={
          structureEditor === "new"
            ? "새 교과목의 최소 정보만 정하면 표준 15주 강의 계획을 자동으로 준비합니다."
            : "필요한 주차 계획만 수정하고 저장하면 편성 화면으로 돌아갑니다."
        }
      >
        <section className="rounded-xl border border-[#D7E3DC] bg-[#F8FCF9] p-5">
          <CurriculumEditor
            outlineId={structureEditor === "new" ? null : outlineId}
            initialOpenWeek={editingWeek}
            assignments={assign}
            coreById={coreById}
            compositionLevel={level}
            compositionDirection={direction}
            compositionThemes={themes}
            compositionCourseMode={courseMode}
            compositionInterpretingWeekCount={interpretingWeekCount}
            onClose={() => { setStructureEditor(null); setEditingWeek(null); }}
            onSaved={handleStructureSaved}
          />
        </section>
      </AdminShell>
    );
  }

  if (syllabusOpen && outline) {
    return (
      <AdminShell
        title="15주 강의계획서"
        description="저장된 15주 편성을 수업 운영 문서로 확인하고 인쇄·PDF로 내보냅니다."
        compact
      >
        <CurriculumSyllabusSettingsForm
          settings={syllabusSettings}
          onChange={setSyllabusSettings}
          onSave={handleSaveSyllabusSettings}
        />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2DED2] bg-white p-3 print:hidden">
          <div>
            <p className="text-[13px] font-semibold text-[#15202B]">현재 화면 편성 기준</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">최신 편성을 반영하려면 먼저 돌아가서 편성 저장을 눌러주세요.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSyllabusOpen(false)}>편성으로 돌아가기</Button>
            <Button onClick={() => window.print()}>강의계획서 인쇄·PDF</Button>
          </div>
        </div>
        <CurriculumSyllabus
          outline={outline}
          weeks={weeks}
          assignments={assign}
          coreById={coreById}
          settings={syllabusSettings}
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={tab === "new" ? "새 교과목 개설" : "15주 수업 편성"}
      description={tab === "new"
        ? "수준·방향·수행 방식과 편성 주제를 정하면 승인된 학습 미션으로 15주를 자동 편성합니다."
        : "교수자가 최종 승인한 학습 미션을 교과목의 15주에 배치합니다."}
      compact
    >
      <div className="w-full">
      {libraryScenarioId && <section aria-label="라이브러리에서 선택한 미션" className="mb-4 rounded-xl border border-[#D6BC40] bg-[#FFFBEA] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">라이브러리에서 선택한 미션</h2>
          <Link to="/admin/library" className="text-[12px] underline">라이브러리로 돌아가기</Link>
        </div>
        {loading ? <p className="mt-2 text-sm">미션 확인 중…</p> : !libraryMission ? (
          <p role="alert" className="mt-2 text-sm">선택한 미션을 불러오지 못했습니다. 라이브러리에서 다시 확인해 주세요.</p>
        ) : <>
          <p className="mt-2 text-[13px] leading-6">{libraryMission.situation_ko}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{SPEECH_ACT_UI[libraryMission.speech_act]} · {LEVEL[libraryMission.learner_level]} · {DIRECTION_LABEL[libraryMission.direction]} · {MODE_LABEL[libraryMission.mode]}</p>
          {!outlineId ? <p className="mt-3 text-[13px]">아래에서 교과목을 선택하면 이 미션을 추가할 수 있는 주차가 나타납니다.</p>
            : loadingOutline || loadedAssignments === null ? <p className="mt-3 text-[13px]">교과목 편성 확인 중…</p>
            : libraryMissionAssigned ? <p role="status" className="mt-3 text-[13px]">현재 교과목 편성에 포함되어 있습니다. 변경한 편성은 ‘편성 저장’으로 확정해 주세요.</p>
            : libraryTargetWeeks.length === 0 ? <p role="status" className="mt-3 text-[13px]">현재 교과목 조건과 남은 자리에 맞는 주차가 없습니다. 수준·방향·주제·화행과 기존 편성을 확인해 주세요.</p>
            : <div className="mt-3 flex flex-wrap items-center gap-2">
              {libraryTargetWeeks.map((week) => <Button key={week.id} size="sm" variant="outline" disabled={saving}
                onClick={() => addItem(week.week_no, libraryMission)}>{week.week_no}주차에 추가</Button>)}
              <span className="text-[12px] text-muted-foreground">추가한 뒤 ‘편성 저장’을 눌러 확정합니다.</span>
            </div>}
        </>}
      </section>}
      {/* ── 상단 컨트롤 ── */}
      <section>
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            {error} (교수자 로그인이 필요합니다)
          </p>
        )}

        {tab === "new" && <div><NewCoursePanel cores={cores} courses={outlines} onCreated={handleCourseCreated} /></div>}

        {tab === "existing" && outlines.length > 0 && (
          <div role="radiogroup" aria-label="교과목 선택" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {outlines.map((item) => {
              const selected = item.id === outlineId;
              const published = item.status === "published";
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-course-id={item.id}
                  disabled={loading}
                  onClick={() => setOutlineId(item.id)}
                  className={`flex flex-col gap-2 rounded-xl border bg-white px-4 py-4 text-left transition ${
                    selected
                      ? "border-[#7D90A8] shadow-[0_0_0_1px_#7D90A8] bg-[#F7F9FC]"
                      : "border-[#E2DED2] hover:border-[#9FB0C6]"
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-bold leading-snug text-[#15202B]">{courseDisplayTitle(item)}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      published ? "bg-[#E8F4EC] text-[#245E44]" : "bg-[#FFF3D6] text-[#8A5A14]"
                    }`}>
                      {published ? "공개" : "비공개"}
                    </span>
                  </span>
                  <span className="text-[13px] font-medium text-[#1F3A5F]">
                    {LEVEL[item.level as LearnerLevel] ?? item.level} · {DIRECTION_LABEL[item.language_direction as LanguageDirection] ?? item.language_direction} · {COURSE_MODE_LABEL[item.course_mode as CourseMode] ?? item.course_mode}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 확인 대화상자 — 메뉴 밖에 두어 메뉴가 닫혀도 유지된다. 내용과 동작은 이전과 같다. */}
        {selectedIsPublished && (
              <AlertDialog open={confirmAction === "unpublish"} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>이 교과목을 비공개로 바꾸시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-left">
                        <p className="font-semibold text-[#15202B]">{selectedOutline && courseDisplayTitle(selectedOutline)}</p>
                        <p>학습자 수업 화면에서 이 교과목이 보이지 않게 됩니다.</p>
                        <p>편성 내용과 학습자 수행 기록은 그대로 남습니다.</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUnpublish}>비공개</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <AlertDialog open={confirmAction === "delete"} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>이 교과목을 삭제하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-left">
                      <p className="font-semibold text-[#15202B]">{selectedOutline && courseDisplayTitle(selectedOutline)}</p>
                      <p>15주 주차 계획과 현재 배정된 미션 {assignedCount}건이 함께 삭제됩니다.</p>
                      <p>학습자 수행 기록과 시나리오·미션 자체는 삭제되지 않습니다.</p>
                      <p className="font-semibold text-[#8B3531]">되돌릴 수 없습니다.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

        {/* 편성 조건(기본 펼침)과 일상 업무. 조건 네 축은 한 줄, 주제는 한 줄에 둔다. 저장만 채운 버튼으로 둔다. */}
        {tab === "existing" && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#D8D3C4] bg-white">
          {/* 교과목 상자 = 이름 머리 + 편성 조건. 주차별 미션 배치는 바로 아래 별도 상자다(2026-09-26). */}
          {/* 작업 머리 = 지금 고친 교과목 이름. 카드 줄(고르기) 아래에서 「이 교과목을 편성한다」가 먼저 읽히게. */}
          {outline && <h2 className="border-b border-[#EAE4D2] bg-[#FBFAF6] px-5 py-3.5 text-[19px] font-bold tracking-tight text-[#15202B]">{courseDisplayTitle(outline)}</h2>}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                aria-expanded={conditionsOpen}
                onClick={() => setConditionsOpen((open) => !open)}
                className="flex items-center gap-1.5 text-[15px] font-bold text-[#15202B]"
              >
                편성 조건
                <span aria-hidden className="text-[11.5px] font-semibold text-[#1F3A5F]">{conditionsOpen ? "▲ 접기" : "▼ 펼치기"}</span>
              </button>
              {axesDirty && <Badge variant="outline">저장 전 변경</Badge>}
              {!conditionsOpen && (
                <span className="text-[12.5px] text-muted-foreground">
                  {LEVEL[level]} · {DIRECTION_LABEL[direction]} · {COURSE_MODE_LABEL[courseMode]} · {themes.length ? "편성 주제 " + themes.length + "개" : "편성 주제 전체"}
                </span>
              )}
              <span className="text-[12px] text-[#46515A]">
                {outline
                  ? `배치됨 · 번역 ${assignedModeWeekCounts.translation} · 통역 ${assignedModeWeekCounts.interpreting}`
                  : "현재 설정은 새 교과목에 그대로 적용됩니다."}
              </span>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                  availableMissionCount > 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
                }`}
              >
                편성 가능 미션 {availableMissionCount}개
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* 강의계획서 보기는 숨김(2026-09-19). 교수자 항목이 브라우저에만 저장돼 운영에 쓰기 어렵다. 코드는 되살릴 수 있게 둔다. */}
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSettingsOpen(false);
              }}
            >
              <Button
                className="h-9 gap-1.5"
                variant="outline"
                aria-haspopup="menu"
                aria-expanded={settingsOpen}
                disabled={!outlineId}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                교과목 설정 <span aria-hidden className="text-muted-foreground">⋯</span>
              </Button>
              {settingsOpen && (
                <div
                  role="menu"
                  aria-label="교과목 설정"
                  onMouseDown={(event) => event.preventDefault()}
                  className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-[#E2DED2] bg-white p-1.5 shadow-[0_12px_32px_rgba(21,32,43,0.12)]"
                >
                  <button type="button" role="menuitem" className={SETTINGS_MENU_ITEM}
                    onClick={() => { setSettingsOpen(false); setStructureEditor("current"); }}>
                    주차 계획 수정
                  </button>
                  <Link role="menuitem" className={SETTINGS_MENU_ITEM} onClick={() => setSettingsOpen(false)}
                    to={outlineId ? `/admin/data-backup?courseId=${encodeURIComponent(outlineId)}` : "/admin/data-backup"}>
                    백업·복원
                  </Link>
                  {selectedIsPublished && (
                    <button type="button" role="menuitem" className={SETTINGS_MENU_ITEM} disabled={unpublishing}
                      onClick={() => { setSettingsOpen(false); setConfirmAction("unpublish"); }}>
                      {unpublishing ? "처리 중…" : "학습자에게 비공개로 전환"}
                    </button>
                  )}
                  <div className="my-1.5 border-t border-[#EFEBE1]" />
                  <p className="px-2.5 pb-0.5 pt-1 text-[11px] font-semibold text-[#8B3531]">위험 작업</p>
                  <button type="button" role="menuitem" disabled={deleting || selectedIsPublished}
                    className={`${SETTINGS_MENU_ITEM} flex-col items-start text-[#8B3531] hover:bg-[#FFF3F1]`}
                    onClick={() => { setSettingsOpen(false); setConfirmAction("delete"); }}>
                    <span>{deleting ? "삭제 중…" : "교과목 삭제"}</span>
                    <span className="text-[11px] text-[#9AA3A9]">
                      {selectedIsPublished ? "학습자에게 공개 중인 교과목은 삭제할 수 없습니다." : "주차 계획과 배정이 함께 삭제됩니다."}
                    </span>
                  </button>
                </div>
              )}
            </div>
              <Button className="h-9" variant="outline" onClick={() => autoFill(false)} disabled={!outline || loadingOutline}>
                미션 자동 채우기
              </Button>
              <Button className="h-9 px-5" onClick={handleSave} disabled={!outlineId || saving}>
                {saving ? "저장 중…" : "편성 저장"}
              </Button>
            </div>
          </div>
          {conditionsOpen && (
            <div className="border-t border-[#EAE4D2] px-4 py-3">
              <CompositionConditionFields
                value={{ level, direction, courseMode, themes }}
                onLevel={setLevel}
                onDirection={setDirection}
                onCourseMode={changeCourseMode}
                onThemes={setThemes}
              />
            </div>
          )}
            {autoFillShortages.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <span>
                  선택 주제를 지키면서 채우지 못한 주차가 {autoFillShortages.length}개 있습니다: {" "}
                  {autoFillShortages.map((item) => `${item.weekNo}주차 ${item.missingSlots}개`).join(", ")}
                </span>
                {themes.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => autoFill(true)}>
                    다른 주제까지 확대해 다시 채우기
                  </Button>
                )}
              </div>
            )}

        </div>
        )}
      </section>

      {/* ── 편성표 ── */}
      {tab === "new" ? null : !outlineId ? (
        !loading && outlines.length === 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#CFC9B9] bg-white/60 px-5 py-4">
            <p className="text-[13px] text-[#46515A]">아직 교과목이 없습니다.</p>
            <Button className="h-9" onClick={() => setTab("new")}>+ 새 교과목 편성</Button>
          </div>
        ) : (
          <p className="mt-4 text-[13px] text-muted-foreground">교과목을 불러오는 중…</p>
        )
      ) : loadingOutline ? (
        <p className="mt-4 text-[13px] text-muted-foreground">주차 골격을 불러오는 중…</p>
      ) : (
        <>
          <div className="mt-5 overflow-hidden rounded-2xl border border-[#D8D3C4] bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#EAE4D2] bg-[#FBFAF6] px-5 py-3.5">
            <h3 className="text-[19px] font-bold tracking-tight text-[#15202B]">주차별 미션 배치</h3>
            <span className="text-[12.5px] text-[#66727A]">
              배치 {assignedMissionCount}개
            </span>
          </div>

          {/* 15주 흐름이 끊기지 않도록 1주부터 15주까지 한 줄에 한 주씩 세로로 둔다. */}
          <div className="grid items-start px-2 py-1">
            {[weeks].map((column, columnIndex) => (
              <div
                key={columnIndex === 0 ? "weeks-1-15" : "weeks"}
                className="overflow-hidden bg-white divide-y divide-[#EFEAE0]"
              >
                {column.map((w) => (
                  <WeekRow
                    key={w.id}
                    week={w}
                    items={assign[w.week_no] ?? []}
                    assignments={assign}
                    coreById={coreById}
                    replaced={replacedIds}
                    candidates={cores}
                    level={level}
                    themes={themes}
                    direction={direction}
                    onEditWeek={() => { setEditingWeek(w.week_no); setStructureEditor("current"); }}
                    expectedModes={expectedMissionModesForWeek(
                      { courseMode },
                      w.week_no,
                    )}
                    adding={addingWeek === w.week_no}
                    onToggleAdd={() =>
                      setAddingWeek((cur) => (cur === w.week_no ? null : w.week_no))
                    }
                    onAdd={(c) => addItem(w.week_no, c)}
                    onRemove={(sid) => removeItem(w.week_no, sid)}
                    onReplace={(sid) => { removeItem(w.week_no, sid); setAddingWeek(w.week_no); }}
                  />
                ))}
              </div>
            ))}
          </div>
          </div>
        </>
      )}
      </div>
    </AdminShell>
  );
};

function assignmentsToMap(rows: WeekAssignment[]): AssignMap {
  const m: AssignMap = {};
  for (const a of rows) {
    (m[a.week_no] ??= []).push({
      scenario_id: a.scenario_id,
      slot_role: a.slot_role,
      pair_contract_version: a.pair_contract_version ?? null,
      mission_role: a.mission_role ?? null,
      changed_context_axes: a.changed_context_axes ?? [],
      diagnostic_dimensions: a.diagnostic_dimensions ?? [],
    });
  }
  return m;
}

// ── 주차 한 행 ──────────────────────────────────────────────────────────
function WeekRow({
  week,
  items,
  assignments,
  coreById,
  candidates,
  level,
  themes,
  direction,
  expectedModes,
  adding,
  onToggleAdd,
  onAdd,
  onRemove,
  onReplace,
  onEditWeek,
  replaced,
}: {
  week: CurriculumWeekRow;
  items: AssignedItem[];
  assignments: AssignMap;
  coreById: Record<string, ComposerCore>;
  candidates: ComposerCore[];
  level: LearnerLevel;
  themes: ThemeCode[];
  /** 현재 편성 언어 방향 — 후보 필터 절대 조건(0-l·91, 오배정 창 방지) */
  direction: LanguageDirection;
  expectedModes: GenMode[];
  adding: boolean;
  onToggleAdd: () => void;
  onAdd: (c: ComposerCore) => void;
  onRemove: (scenarioId: string) => void;
  /** 옛 판 미션을 빼고 같은 자리의 후보 목록을 바로 연다. */
  onReplace: (scenarioId: string) => void;
  onEditWeek: () => void;
  replaced?: ReadonlySet<string>;
}) {
  const act = week.speech_act as SpeechActUI | null;
  const reinforcement = isReinforcementWeek(week);
  const isAssignable = week.type === "regular" && expectedModes.length > 0 && Boolean(act);
  // 미션에 확정된 초점이 없을 때만 주차 화행의 기본 초점을 보조값으로 사용한다.
  // 교수자 화면에서는 연구 구현 단계명 대신 실제 학습 초점만 보여준다.
  const plannedFeatureCode = act ? DEFAULT_FEATURE_BY_ACT[act] : undefined;
  const plannedLabel = plannedFeatureCode
    ? getTargetFeature(plannedFeatureCode)?.learner_label ?? plannedFeatureCode
    : null;
  // 화행 주차는 「요청 화행」처럼 네 글자로 보인다.
  // 7·14주는 미션 없이 누적 수행 기록으로 성찰·정리하는 주차다(2026-09-19 GPT 교차검증 A안 수정).
  const displayTitle = week.type === "orientation"
    ? "오리엔테이션"
    : act && !reinforcement ? `${SPEECH_ACT_UI[act]} 화행`
    : week.type === "regular" && week.week_no === 7 ? "전반부 성찰·정리"
    : week.type === "regular" && week.week_no === 14 ? "종합 성찰·정리"
    : weekActivityLabel(week);

  const cands = filterManualCandidates(candidates.filter((candidate) => !replaced?.has(candidate.scenario_id)), {
    act,
    level,
    direction,
    themes,
    assignments,
    expectedModes,
    weekNo: week.week_no,
    coreById,
  });

  return (
    <div role="group" aria-label={`${week.week_no}주차 편성`} className="bg-white px-3 py-3">
      {/* 한 주차 = 한 줄. 열 너비를 고정해 15개 주차의 칸이 세로로 맞는다. 주차마다 같은 「번역 1개 · 통역 1개」 열은 두지 않는다 — 그 폭을 미션 제목에 준다. */}
      <div className="grid min-h-10 grid-cols-[3.5rem_10rem_minmax(0,1fr)_3.75rem] items-center gap-x-3">
        <span className="inline-flex h-6 items-center justify-center rounded-md bg-[#ECEFF1] text-[12px] font-semibold text-[#46515A]">
          {week.week_no}주차
        </span>
        {isAssignable || reinforcement ? (
          <>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] font-bold text-[#15202B]" title={reinforcement ? REINFORCEMENT_DESCRIPTION : displayTitle}>
                {reinforcement ? "선택 화행 집중 보완" : displayTitle}
              </span>
              {reinforcement && (
                <span className="flex items-center gap-1.5 text-[11.5px]">
                  <span className="font-semibold text-[#15202B]">{act ? `${SPEECH_ACT_UI[act]} 화행` : "화행 미정"}</span>
                  <button type="button" onClick={onEditWeek} className="font-semibold text-[#1F3A5F] underline-offset-2 hover:underline">
                    {act ? "바꾸기" : "고르기"}
                  </button>
                </span>
              )}
            </span>
            <span className="grid min-w-0 grid-cols-2 gap-2">
              {expectedModes.map((mode, index) => {
                const item = items[index];
                const core = item ? coreById[item.scenario_id] : undefined;
                if (!item) {
                  return (
                    <span key={`empty-${index}`} className="truncate rounded-md border border-dashed border-[#E3C77A] bg-[#FFFBEF] px-2 py-1 text-[12px] font-medium text-[#8A5A14]">
                      빈 자리
                    </span>
                  );
                }
                const feature = core?.target_feature ? getTargetFeature(core.target_feature) : undefined;
                const featureLabel = core?.target_feature ? feature?.learner_label ?? core.target_feature : plannedLabel ?? "초점 미지정";
                const title = core ? core.brief_note_ko?.trim() || core.situation_ko : "(누락된 시나리오)";
                const needsReplace = Boolean(core && (core.schema_version !== "mission_v6" || replaced?.has(item.scenario_id)));
                return (
                  <span
                    key={item.scenario_id}
                    className={`group flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 ${needsReplace ? "border-[#F0C9A8] bg-[#FFF7F0]" : "border-[#E6E1D4] bg-[#FCFBF8]"}`}
                    title={[title, `초점 · ${featureLabel}`, needsReplace ? (replaced?.has(item.scenario_id) ? "새 판 있음 · 교체 필요" : "교체 필요") : ""].filter(Boolean).join("\n")}
                  >
                    <span className={`shrink-0 rounded px-1.5 py-px text-[11px] font-bold ${core?.mode === "stt_interpreting" ? "bg-[#E4ECF7] text-[#1F3A5F]" : "bg-[#F3E9D2] text-[#8A5A14]"}`}>
                      {core ? (core.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation) : "?"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#202B33]">{title}</span>
                    {needsReplace && <button type="button" onClick={() => onReplace(item.scenario_id)} aria-label={`${title} 교체하기`}
                      className="shrink-0 rounded-full border border-[#D98A5C] bg-white px-2 py-0.5 text-[11px] font-bold text-[#9A3F1C] hover:bg-[#9A3F1C] hover:text-white">교체하기 →</button>}
                    {/* 제거 ×는 평소 숨기고 칩에 마우스를 올리거나 키보드로 닿을 때만 보인다 — 배치표가 삭제 목록처럼 보이지 않게. */}
                    <button
                      type="button"
                      aria-label={`${title} 제거`}
                      onClick={() => onRemove(item.scenario_id)}
                      className="shrink-0 px-0.5 text-[13px] font-bold leading-none text-red-700 opacity-0 transition-opacity hover:text-red-900 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </span>
            {/* 자리가 다 찼으면 추가 버튼을 숨긴다(흐린 비활성 버튼 금지). 교체는 × 후 추가. */}
            {isAssignable && (items.length < expectedModes.length || adding) ? (
              <Button
                className="h-7 px-2 text-[12px] font-semibold text-[#1F3A5F] hover:bg-[#EEF2F7]"
                variant="ghost"
                size="sm"
                onClick={onToggleAdd}
              >
                {adding ? "닫기" : "+ 미션"}
              </Button>
            ) : <span />}
          </>
        ) : (
          <span className="col-span-3 text-[13.5px] font-semibold text-[#46515A]">{displayTitle}</span>
        )}
      </div>

      {/* 후보 추가 패널 */}
      {adding && isAssignable && (
        <div className="mt-3 rounded-lg border border-dashed border-[#D8D0BC] bg-[#FAF8F2] p-3">
          <p className="mb-2 text-[11.5px] text-muted-foreground">
            현재 방향·수준·주제와 {missionModesSummary(expectedModes)} 구성에서 아직 채우지 않은 모드에 맞는 검토 완료 미션만 표시됩니다. 같은 상황의 복제본은 제외됩니다.
          </p>
          {cands.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              조건에 맞는 후보 시나리오가 없습니다
              {act ? ` (${SPEECH_ACT_UI[act]} · ${LEVEL[level]}${themes.length ? " · 선택 주제" : ""})` : ""}.
            </p>
          ) : (
            <ul className="max-h-60 space-y-1.5 overflow-y-auto">
              {cands.slice(0, 40).map((c) => (
                <li
                  key={c.scenario_id}
                  className="flex items-center gap-2 rounded-md bg-white px-3 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]" title={c.situation_ko}>{c.brief_note_ko?.trim() || c.situation_ko || "(상황 없음)"}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {c.theme_code ? THEME_LABEL[c.theme_code] : "—"} ·{" "}
                      {c.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" disabled={reinforcement && items.length >= 2} onClick={() => onAdd(c)}>
                    추가
                  </Button>
                </li>
              ))}
              {cands.length > 40 && (
                <li className="px-3 py-1 text-[11.5px] text-muted-foreground">
                  … 외 {cands.length - 40}개(상위 40개만 표시)
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminComposer;
