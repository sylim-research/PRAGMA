import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  type CoursePreset,
  type ThemeCode,
} from "@/lib/pragma/scenarioTopics";
import { getTargetFeature, DEFAULT_FEATURE_BY_ACT } from "@/lib/pragma/targetFeatures";
import { weeklyMaterialsPath } from "@/lib/curriculum/weeklyMaterials";
import { CurriculumEditor } from "./CurriculumEditor";
import { CENTRAL_QUESTION_GUIDANCE, isReinforcementWeek, REINFORCEMENT_DESCRIPTION, weekActivityLabel, weekCentralQuestion } from "@/lib/curriculum/weekGuidance";
import {
  COURSE_MODE_LABEL,
  COURSE_MODES,
  courseModePolicyFromLegacyRatio,
  expectedMissionModesForWeek,
  missionModesSummary,
  isCourseModePolicyValid,
  type CourseMode,
} from "@/lib/curriculum/courseModePolicy";

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
  const setOutlineId = (id: string) =>
    setSearchParams(id ? { outline: id } : {}, { replace: true });

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

  const preset: CoursePreset | undefined = useMemo(
    () => COURSE_PRESETS.find((p) => p.preset_code === presetCode),
    [presetCode],
  );

  // 제작 파이프라인 전체 통계 대신, 지금 선택한 편성 조건에서 실제로 쓸 수 있는
  // 검토 완료 미션 수만 보여준다. 부족 원인은 설명하되 내부 상태명은 노출하지 않는다.
  const availableMissionCount = useMemo(
    () =>
      cores.filter(
        (core) =>
          core.direction === direction &&
          core.learner_level === level &&
          isReviewedMission(core) &&
          core.is_native_mpj5 &&
          (courseMode === "mixed" ||
            (courseMode === "translation"
              ? core.mode === "translation"
              : core.mode === "stt_interpreting")) &&
          (themes.length === 0 || themes.includes(core.theme_code as ThemeCode)),
      ).length,
    [cores, courseMode, direction, level, themes],
  );

  const coreById = useMemo(() => {
    const m: Record<string, ComposerCore> = {};
    for (const c of cores) m[c.scenario_id] = c;
    return m;
  }, [cores]);

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

  // ── 프리셋 적용 = 주제·강좌 모드 빠른 채우기. 네 축의 정본은 현재 화면 선택값 ──
  const applyPreset = (code: string) => {
    setPresetCode(code);
    const p = COURSE_PRESETS.find((x) => x.preset_code === code);
    if (!p) return;
    setLevel(p.target_level);
    setDirection(p.language_direction);
    setThemes(p.included_themes);
    setCourseMode(p.course_mode);
    setInterpretingWeekCount(p.target_interpreting_week_count);
  };

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
        title="15주 수업 편성·강의계획서"
        compact
        description={
          structureEditor === "new"
            ? "새 교과목의 최소 정보만 정하면 표준 15주 강의 계획을 자동으로 준비합니다."
            : "필요한 주차 계획만 수정하고 저장하면 AI 편성 화면으로 돌아갑니다."
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
      title="15주 수업 편성·강의계획서"
      description="강좌 일정에 따라 주차별 학습 주제와 승인된 학습 미션을 편성합니다."
      compact
    >
      <div className="w-full max-w-[960px]">
      <section
        aria-label="교과목 설계 흐름"
        className="relative mb-3 overflow-hidden rounded-xl border border-[#D8D3C6] bg-white shadow-[0_6px_18px_rgba(21,32,43,0.07)]"
      >
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[#15202B]" />
        <div className="grid divide-y divide-[#EAE4D2] pt-1 md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            {
              step: "1",
              title: "교과목 설정",
              copy: "교과목명·수준·언어방향 설정",
            },
            {
              step: "2",
              title: "AI 자동 편성",
              copy: "주제·강좌 수행모드 기반 미션 배정",
            },
            {
              step: "3",
              title: "주차별 조정",
              copy: "필요한 주차의 미션 추가·제거",
            },
          ].map(({ step, title, copy }) => (
            <div key={step} className="flex items-start gap-2.5 px-4 py-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#15202B] text-[11px] font-semibold text-white">
                {step}
              </span>
              <div className="min-w-0">
                <span className="text-[15px] font-semibold leading-tight text-[#15202B]">{title}</span>
                <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 상단 컨트롤 ── */}
      <section>
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">
            {error} (관리자 로그인이 필요합니다)
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2DED2] bg-white p-3 text-[13px] shadow-[0_4px_14px_rgba(21,32,43,0.04)]">
          <span className="shrink-0 rounded-full bg-[#EEF2F1] px-3 py-1.5 font-semibold text-[#365F58]">
            1 · 교과목
          </span>
          <select
            aria-label="교과목 선택"
            value={outlineId}
            onChange={(event) => setOutlineId(event.target.value)}
            disabled={loading}
            className="h-9 min-w-[280px] max-w-[620px] flex-1 rounded-md border border-[#D9DED9] bg-white px-3"
          >
            <option value="">— 교과목 선택 —</option>
            {outlines.map((item) => (
              <option key={item.id} value={item.id}>
                {courseDisplayTitle(item)} · {LEVEL[item.level as LearnerLevel] ?? item.level}
              </option>
            ))}
          </select>

          {outlineId && (
            <Badge
              variant="outline"
              className={selectedIsPublished
                ? "h-7 shrink-0 border-[#9CC7B0] bg-[#F4FAF6] text-[#245E44]"
                : "h-7 shrink-0 border-[#D9DED9] bg-[#F6F5F1] text-[#5D6980]"}
            >
              {selectedIsPublished ? "공개" : "비공개"}
            </Badge>
          )}
          <Button className="h-9" variant="outline" onClick={() => setStructureEditor("new")}>
            새 교과목
          </Button>
          <Button
            className="h-9"
            variant="outline"
            onClick={() => setStructureEditor("current")}
            disabled={!outlineId}
          >
            주차 계획 수정
          </Button>
          <Button
            className="h-9"
            variant="outline"
            onClick={handleSave}
            disabled={!outlineId || saving}
          >
            {saving ? "저장 중…" : "편성 저장"}
          </Button>
          <Button
            className="h-9"
            variant="outline"
            onClick={openSyllabus}
            disabled={!outlineId || loadingOutline}
          >
            강의계획서
          </Button>

          {/* 위험 동작(비공개·삭제)은 오른쪽 끝으로 분리해 일상 동작과 섞이지 않게 한다. */}
          <div className="ml-auto flex items-center gap-2 border-l border-[#E2DED2] pl-3">
            {selectedIsPublished && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="h-9" variant="outline" disabled={unpublishing}>
                    {unpublishing ? "처리 중…" : "비공개"}
                  </Button>
                </AlertDialogTrigger>
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="h-9 border-[#D9B0AC] text-[#8B3531] hover:bg-[#FFF3F1] hover:text-[#8B3531]"
                  variant="outline"
                  disabled={!outlineId || deleting || selectedIsPublished}
                  title={selectedIsPublished ? "학습자에게 게시 중인 교과목은 삭제할 수 없습니다." : undefined}
                >
                  {deleting ? "삭제 중…" : "교과목 삭제"}
                </Button>
              </AlertDialogTrigger>
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
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-[#CFC9B9] bg-white shadow-[0_10px_26px_rgba(21,32,43,0.09)]">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1E2F3A] px-4 py-3 text-white">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FAD338]">
                    핵심 자동화
                  </span>
                  {axesDirty && (
                    <Badge className="border-0 bg-[#FAD338] font-normal text-[#15202B] hover:bg-[#FAD338]">
                      저장 전 변경
                    </Badge>
                  )}
                </div>
                <h2 className="mt-0.5 text-[18px] font-semibold leading-tight">2 · AI 자동 편성</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="whitespace-nowrap text-[11.5px] font-semibold text-[#F1EFE8]">
                    프리셋 · 빠른 시작
                  </span>
                  <select
                    value={presetCode}
                    onChange={(event) => applyPreset(event.target.value)}
                    className="h-9 min-w-[210px] rounded-md border border-white/20 bg-white px-2 text-[15px] text-[#15202B]"
                  >
                    <option value="">— 직접 설정 —</option>
                    {COURSE_PRESETS.map((item) => (
                      <option key={item.preset_code} value={item.preset_code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  className="h-9 bg-[#FAD338] text-[14px] font-semibold text-[#15202B] hover:bg-[#EAC42E]"
                  onClick={() => (outline ? autoFill(false) : setStructureEditor("new"))}
                  disabled={loadingOutline}
                >
                  {outline ? "AI 자동 채우기" : "AI 편성 시작"}
                </Button>
              </div>
            </div>

            <div className="px-4 py-3.5 text-[13px]">
            <div className="grid max-w-[900px] gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,210px)_minmax(180px,210px)_minmax(300px,420px)]">
              <label className="rounded-lg border border-[#E2DED2] bg-[#FAF9F5] p-3">
                <span className="flex items-center gap-2 font-semibold text-[#15202B]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E7E8] text-[11px]">1</span>
                  수준
                </span>
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value as LearnerLevel)}
                  className="mt-1.5 h-8 w-full rounded-md border border-[#D8D4C8] bg-white px-2"
                >
                  {LEVELS.map((item) => (
                    <option key={item} value={item}>{LEVEL[item]}</option>
                  ))}
                </select>
              </label>
              <label className="rounded-lg border border-[#E2DED2] bg-[#FAF9F5] p-3">
                <span className="flex items-center gap-2 font-semibold text-[#15202B]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E7E8] text-[11px]">2</span>
                  언어방향
                </span>
                <select
                  value={direction}
                  onChange={(event) => setDirection(event.target.value as LanguageDirection)}
                  className="mt-1.5 h-8 w-full rounded-md border border-[#D8D4C8] bg-white px-2"
                >
                  {DIRECTIONS.map((item) => (
                    <option key={item} value={item}>{DIRECTION_LABEL[item]}</option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-[#E2DED2] bg-[#FAF9F5] p-3 sm:col-span-2 lg:col-span-1">
                <span className="flex items-center gap-2 font-semibold text-[#15202B]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E7E8] text-[11px]">3</span>
                  강좌 수행모드
                </span>
                <select
                  value={courseMode}
                  onChange={(event) => changeCourseMode(event.target.value as CourseMode)}
                  className="mt-1.5 h-8 w-full rounded-md border border-[#D8D4C8] bg-white px-2"
                >
                  {COURSE_MODES.map((mode) => (
                    <option key={mode} value={mode}>{COURSE_MODE_LABEL[mode]}</option>
                  ))}
                </select>
                <p className="mt-2 text-[12px] leading-5 text-[#766C54]">
                  화행 학습 주차마다 {missionModesSummary(expectedMissionModesForWeek({ courseMode }, 2))}
                  {courseMode === "mixed" ? " · 각 역할에 맞는 별도의 상황으로 진행합니다." : " · 서로 다른 상황으로 진행합니다."}
                </p>
              </div>
            </div>

            <div className="mt-2.5 rounded-lg border border-[#D8D3C6] border-t-2 border-t-[#FAD338] bg-[#FBFAF6] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold text-[#15202B]">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E7E8] text-[11px]">4</span>
                  주제
                  <span className="font-normal text-[#766C54]">
                    {themes.length === 0 ? `전체 ${THEME_CODES.length}개` : `선택 ${themes.length}개`}
                  </span>
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  여러 주제를 함께 선택해 강의 맥락을 넓힐 수 있습니다.
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setThemes([])}
                  className={`rounded-md border px-3 py-1 transition ${
                    themes.length === 0
                      ? "border-[#15202B] bg-[#15202B] text-white"
                      : "border-[#EAE4D2] bg-white hover:bg-[#FAF8F2]"
                  }`}
                >
                  전체
                </button>
                {THEME_CODES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => toggleTheme(theme)}
                    className={`rounded-md border px-3 py-1 transition ${
                      themes.includes(theme)
                        ? "border-[#FAD338] bg-[#FFF3C4] text-[#15202B]"
                        : "border-[#EAE4D2] bg-white hover:bg-[#FAF8F2]"
                    }`}
                  >
                    {THEME_LABEL[theme]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#EAE4D2] pt-2.5 text-[11.5px] text-muted-foreground">
              {outline ? (
                <span>
                  현재 편성 · 번역 {assignedModeWeekCounts.translation}개 / 통역 {assignedModeWeekCounts.interpreting}개
                </span>
              ) : (
                <span className="font-medium text-[#365F58]">교과목 생성 전 편성 조건</span>
              )}
              <span
                className={`inline-flex rounded-full px-3 py-0.5 font-medium ${
                  availableMissionCount > 0
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-900"
                }`}
              >
                자동 편성 가능 {availableMissionCount}개
              </span>
              <span>
                {outline
                  ? "각 주차 미션은 아래에서 직접 교체할 수 있습니다."
                  : "현재 설정은 새 교과목에 그대로 적용됩니다."}
              </span>
            </div>

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
          </div>

        {/* 선택한 프리셋이 학기 전체에서 무엇을 반복시키는지 교수자에게 설명한다. */}
        {preset && (
          <div className="mt-3 rounded-lg border border-[#EAE4D2] bg-[#FAF7EE] p-3 text-[13px] leading-relaxed">
            <span className="font-medium">반복 원칙 · {preset.label}</span>
            <p className="mt-1">{preset.repetition_principle}</p>
          </div>
        )}
      </section>

      {/* ── 편성표 ── */}
      {!outlineId ? (
        <div className="mt-4 rounded-lg border border-dashed border-[#CFC9B9] bg-white/55 px-4 py-3 text-[12px] text-muted-foreground">
          교과목을 만들거나 기존 교과목을 선택하면 15주 미션 배치가 이곳에 나타납니다.
        </div>
      ) : loadingOutline ? (
        <p className="mt-4 text-[13px] text-muted-foreground">주차 골격을 불러오는 중…</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-l-4 border-[#FAD338] pl-3">
            <div>
              <h2 className="text-[18px] font-semibold">3 · 주차별 미션 조정</h2>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                AI 편성 결과를 확인하고, 필요한 주차에서 미션을 추가하거나 제거하세요.
              </p>
            </div>
            <span className="text-[12px] text-muted-foreground">
              현재 {assignedMissionCount}개 배정
            </span>
          </div>

          <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{CENTRAL_QUESTION_GUIDANCE}</p>
          <div className="mt-2.5 grid items-start gap-3 xl:grid-cols-2">
            {[weeks.slice(0, weekColumnBreak), weeks.slice(weekColumnBreak)].map((column, columnIndex) => (
              <div
                key={columnIndex === 0 ? "weeks-1-8" : "weeks-9-15"}
                className="overflow-hidden rounded-xl border border-[#EAE4D2] bg-white shadow-[0_4px_16px_rgba(21,32,43,0.04)] divide-y divide-[#EAE4D2]"
              >
                {column.map((w) => (
                  <WeekRow
                    key={w.id}
                    week={w}
                    items={assign[w.week_no] ?? []}
                    assignments={assign}
                    coreById={coreById}
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
                  />
                ))}
              </div>
            ))}
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
  onEditWeek,
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
  onEditWeek: () => void;
}) {
  const act = week.speech_act as SpeechActUI | null;
  const reinforcement = isReinforcementWeek(week);
  const isAssignable = week.type === "regular" && expectedModes.length > 0 && Boolean(act);
  const centralQuestion = weekCentralQuestion(week);
  // 미션에 확정된 초점이 없을 때만 주차 화행의 기본 초점을 보조값으로 사용한다.
  // 교수자 화면에서는 연구 구현 단계명 대신 실제 학습 초점만 보여준다.
  const plannedFeatureCode = act ? DEFAULT_FEATURE_BY_ACT[act] : undefined;
  const plannedLabel = plannedFeatureCode
    ? getTargetFeature(plannedFeatureCode)?.learner_label ?? plannedFeatureCode
    : null;
  const displayTitle = week.type === "orientation" ? "오리엔테이션" : weekActivityLabel(week);

  const cands = filterManualCandidates(candidates, {
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
    <div role="group" aria-label={`${week.week_no}주차 편성`} className={`px-3 py-2 ${isAssignable ? "bg-white" : "bg-[#FAF8F2]"}`}>
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        <span className="inline-flex h-6 min-w-[3rem] items-center justify-center rounded-md bg-[#ECEFF1] px-2 text-[12px] font-semibold text-[#46515A]">
          {week.week_no}주차
        </span>
        <span className="text-[13.5px] font-medium">{displayTitle}</span>
        {expectedModes.length > 0 && <span className="text-[11.5px] text-muted-foreground">{missionModesSummary(expectedModes)}</span>}
        {reinforcement && (
          <Button variant="outline" size="sm" className="h-7 text-[12px]" onClick={onEditWeek}>
            {act ? `${SPEECH_ACT_UI[act]} · 화행 변경` : "화행 선택"}
          </Button>
        )}
        <Link to={weeklyMaterialsPath(week.outline_id, week.week_no)} className="text-[11.5px] font-semibold text-[#2F6F63] hover:underline">
          주차 수업자료
        </Link>
        {items.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-[11.5px]">
            <span className="text-muted-foreground">미션 {items.length}개</span>
          </div>
        )}
        {isAssignable ? (
          <Button
            className={`${items.length > 0 ? "" : "ml-auto"} h-7 px-2 text-[12px] font-normal text-[#59636B] hover:bg-[#F3F1EA]`}
            variant="ghost"
            size="sm"
            onClick={onToggleAdd}
            disabled={items.length >= expectedModes.length && !adding}
          >
            {adding ? "닫기" : "+ 미션"}
          </Button>
        ) : null}
      </div>

      {centralQuestion && (
        <p className="mt-1 text-[12px] leading-5 text-[#52616B]" title={CENTRAL_QUESTION_GUIDANCE}>
          <span className="font-semibold">중심 질문 · </span>{centralQuestion}
        </p>
      )}
      {reinforcement && <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">{REINFORCEMENT_DESCRIPTION}</p>}

      {/* 주차 흐름을 끊지 않도록 배정 미션은 별도 카드가 아닌 구분선 목록으로 표시한다. */}
      {items.length > 0 && (
        <div className="mt-2.5 border-t border-[#F0EBDD]">
          {items.map((item) => {
            const core = coreById[item.scenario_id];
            const feature = core?.target_feature ? getTargetFeature(core.target_feature) : undefined;
            const featureLabel = core?.target_feature
              ? feature?.learner_label ?? core.target_feature
              : plannedLabel ?? "초점 미지정";
            return (
              <div
                key={item.scenario_id}
                className="border-b border-[#F0EBDD] py-2.5 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <p
                    className="line-clamp-2 min-w-0 flex-1 text-[12.5px] leading-relaxed"
                    title={core?.situation_ko ?? "누락된 시나리오"}
                  >
                    {core?.situation_ko ?? "(누락된 시나리오)"}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRemove(item.scenario_id)}
                      className="text-[11.5px] text-red-700 hover:underline"
                    >
                      제거
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-[#ECEFF1] px-2 py-0.5 text-[#52616B]">
                    {core
                      ? core.mode === "stt_interpreting"
                        ? MODE_LABEL.stt_interpreting
                        : MODE_LABEL.translation
                      : "모드 미지정"}
                  </span>
                  <span className="rounded-full bg-[#EAF5F1] px-2 py-0.5 text-[#2F6F63]">
                    {featureLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                    <p className="truncate text-[13px]">{c.situation_ko || "(상황 없음)"}</p>
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
