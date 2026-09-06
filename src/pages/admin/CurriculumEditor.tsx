import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCurriculumOutline,
  createCurriculumOutline,
  updateCurriculumOutline,
  type CurriculumOutlineWithWeeks,
} from "@/lib/curriculum/api";
import {
  outlineRowToDraft,
  weekRowToDraft,
  createEmptyOutlineDraft,
} from "@/lib/curriculum/mappers";
import {
  createStandard15WeekTemplate,
  STANDARD_TARGET_ACTS,
  STANDARD_MIDTERM_WEEK,
  STANDARD_FINAL_WEEK,
  ROLE_LABEL,
  STAGE_LABEL,
  weekRole,
} from "@/lib/curriculum/template";
import { validateCurriculum } from "@/lib/curriculum/validate";
import type { CurriculumValidationResult } from "@/lib/curriculum/validate";
import type {
  CurriculumOutlineDraft,
  CurriculumWeekDraft,
  CurriculumStatus,
  CurriculumWeekType,
} from "@/lib/curriculum/types";
import {
  assignmentStructureIssues,
  type AssignMap,
} from "@/lib/curriculum/composerPlanning";
import type { ComposerCore } from "@/lib/curriculum/composer";
import {
  SPEECH_ACT_UI,
  LEVEL,
} from "@/lib/pragma/enums";
import { buildCanDoSuggestions } from "@/lib/curriculum/canDoGuide";
import { CENTRAL_QUESTION_GUIDANCE, isReinforcementWeek, previouslyLearnedActs, REINFORCEMENT_DESCRIPTION, REINFORCEMENT_TITLE, weekActivityLabel, weekCentralQuestion } from "@/lib/curriculum/weekGuidance";
import type {
  SpeechActUI,
  LearnerLevel,
  LanguageDirection,
} from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";
import type { CourseMode } from "@/lib/curriculum/courseModePolicy";

const LANGUAGE_DIRECTION_LABEL: Record<LanguageDirection, string> = {
  ko_zh: "한→중",
  zh_ko: "중→한",
};
const STATUS_LABEL: Record<CurriculumStatus, string> = {
  draft: "초안",
  published: "게시",
  archived: "보관",
};
const WEEK_TYPE_LABEL: Record<CurriculumWeekType, string> = {
  orientation: "오리엔테이션",
  regular: "정규",
  midterm: "중간",
  final: "기말",
};

const NONE = "__none__";

// Fields that only make sense on a regular week (mirror validate.ts).
const REGULAR_WEEK = "regular";

interface CurriculumEditorProps {
  /** null = create a new outline; otherwise edit the existing one. */
  outlineId: string | null;
  initialOpenWeek?: number | null;
  onClose: () => void;
  onSaved: (saved: CurriculumOutlineWithWeeks) => void;
  /** 현재 Composer 편성. 주차 계획 변경 전 공통 불변조건을 검사한다. */
  assignments?: AssignMap;
  coreById?: Record<string, ComposerCore>;
  compositionLevel?: LearnerLevel;
  compositionDirection?: LanguageDirection;
  compositionThemes?: ThemeCode[];
  compositionCourseMode?: CourseMode;
  compositionInterpretingWeekCount?: number;
}

export const CurriculumEditor = ({
  outlineId,
  initialOpenWeek = null,
  onClose,
  onSaved,
  assignments = {},
  coreById = {},
  compositionLevel,
  compositionDirection,
  compositionThemes,
  compositionCourseMode,
  compositionInterpretingWeekCount,
}: CurriculumEditorProps) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outline, setOutline] = useState<CurriculumOutlineDraft | null>(null);
  const [weeks, setWeeks] = useState<CurriculumWeekDraft[]>([]);
  const [saving, setSaving] = useState(false);
  // Validation is only surfaced after a save attempt (avoids nagging on load).
  const [issues, setIssues] = useState<CurriculumValidationResult | null>(null);
  // 주차별 상세 override 펼침 상태(기본 접힘 — 표준 골격은 수기 입력 불요).
  const [openWeek, setOpenWeek] = useState<number | null>(initialOpenWeek);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        if (outlineId === null) {
          if (!cancelled) {
            // 새 과정 = 공통 표준 골격 자동 생성. 중간=8·기말=15·목표화행 9종·15주
            // draft를 미리 채워, 제목·수준·방향·프리셋만 정하면 저장되게 한다.
            const emptyOutline = createEmptyOutlineDraft();
            setOutline({
              ...emptyOutline,
              level: compositionLevel ?? emptyOutline.level,
              language_direction: compositionDirection ?? emptyOutline.language_direction,
              composition_theme_codes: compositionThemes ?? emptyOutline.composition_theme_codes,
              course_mode: compositionCourseMode ?? emptyOutline.course_mode,
              target_interpreting_week_count:
                compositionInterpretingWeekCount ?? emptyOutline.target_interpreting_week_count,
              midterm_week: STANDARD_MIDTERM_WEEK,
              final_week: STANDARD_FINAL_WEEK,
              target_speech_acts: [...STANDARD_TARGET_ACTS],
            });
            setWeeks(createStandard15WeekTemplate());
          }
        } else {
          const { outline: row, weeks: weekRows } = await getCurriculumOutline(outlineId);
          if (!cancelled) {
            setOutline(outlineRowToDraft(row));
            setWeeks(weekRows.map(weekRowToDraft));
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "교과목을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [
    compositionDirection,
    compositionCourseMode,
    compositionInterpretingWeekCount,
    compositionLevel,
    compositionThemes,
    outlineId,
  ]);

  const patchOutline = (patch: Partial<CurriculumOutlineDraft>) =>
    setOutline((prev) => (prev ? { ...prev, ...patch } : prev));

  const patchWeek = (index: number, patch: Partial<CurriculumWeekDraft>) =>
    setWeeks((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  const addCanDoSuggestion = (index: number, suggestion: string) => {
    const current = weeks[index]?.can_do ?? [];
    if (current.includes(suggestion)) {
      toast.info("이미 추가된 Can-do 목표입니다.");
      return;
    }
    if (current.length >= 2) {
      toast.warning("Can-do 목표는 주차당 최대 2개입니다. 기존 목표를 수정하거나 삭제해 주세요.");
      return;
    }
    patchWeek(index, { can_do: [...current, suggestion] });
  };

  const handleSave = async () => {
    if (!outline) return;
    const result = validateCurriculum(outline, weeks);
    setIssues(result);
    if (result.errors.length > 0) {
      toast.error(`저장할 수 없습니다. 오류 ${result.errors.length}건을 확인하세요.`);
      return;
    }
    if (outlineId !== null) {
      const assignmentIssues = assignmentStructureIssues(
        assignments,
        coreById,
        weeks,
        compositionLevel ?? outline.level,
        compositionDirection ?? outline.language_direction,
        outline.scenarios_per_week,
        {
          courseMode: compositionCourseMode ?? outline.course_mode,
          interpretingWeekCount:
            compositionInterpretingWeekCount ?? outline.target_interpreting_week_count,
        },
      );
      if (assignmentIssues.length > 0) {
        const affectedWeeks = [...new Set(assignmentIssues.map((issue) => issue.weekNo))];
        toast.error(
          `현재 미션 배정과 충돌하는 주차가 있습니다 (${affectedWeeks.join(", ")}주차). 먼저 미션을 교체하거나 제거하세요.`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      let saved: CurriculumOutlineWithWeeks;
      if (outlineId === null) {
        saved = await createCurriculumOutline(outline, weeks);
      } else {
        saved = await updateCurriculumOutline(outlineId, outline, weeks);
      }
      toast.success(
        outlineId === null
          ? "새 교과목과 표준 15주 강의 계획을 만들었습니다."
          : "주차 계획을 저장했습니다.",
      );
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const numToInput = (v: number | null) => (v === null ? "" : String(v));
  const inputToNullableNum = (raw: string): number | null => {
    const t = raw.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const errors = issues?.errors ?? [];
  const warnings = issues?.warnings ?? [];
  const weekNumbers = useMemo(() => Array.from({ length: 15 }, (_, i) => i + 1), []);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        불러오는 중…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[13px] text-destructive">
          교과목 조회 실패: {loadError}
        </div>
        <Button variant="outline" onClick={onClose}>
          ← 목록으로
        </Button>
      </div>
    );
  }
  if (!outline) return null;

  if (outlineId === null) {
    return (
      <div className="max-w-[58rem] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">새 교과목 빠르게 만들기</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              세 가지만 정하면 표준 15주 계획을 자동으로 준비하고 바로 미션 편성으로 이어집니다.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            취소
          </Button>
        </div>

        {errors.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[13px] text-destructive">
            {errors.map((error) => (
              <div key={`${error.code}-${error.week_no ?? "outline"}`}>{error.message}</div>
            ))}
          </div>
        )}

        <section className="rounded-xl border border-[#D7E3DC] bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>교과목명</Label>
              <Input
                value={outline.title}
                onChange={(event) => patchOutline({ title: event.target.value })}
                placeholder="예: 2026-2 중급 한중 통번역"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>수준</Label>
              <Select
                value={outline.level}
                onValueChange={(value) => patchOutline({ level: value as LearnerLevel })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEVEL) as LearnerLevel[]).map((key) => (
                    <SelectItem key={key} value={key}>{LEVEL[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>언어방향</Label>
              <Select
                value={outline.language_direction}
                onValueChange={(value) =>
                  patchOutline({ language_direction: value as LanguageDirection })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LANGUAGE_DIRECTION_LABEL) as LanguageDirection[]).map((key) => (
                    <SelectItem key={key} value={key}>{LANGUAGE_DIRECTION_LABEL[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              ["15주 골격", "표준 수업 흐름을 자동 생성"],
              ["평가 주차 보호", "8주차 중간·15주차 기말"],
              ["AI 편성으로 이동", "주제·모드 비율은 다음 단계에서"],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg bg-[#FAF7EE] px-3 py-3">
                <p className="text-[12px] font-semibold text-[#6B5518]">{title}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={handleSave} disabled={saving || outline.title.trim() === ""}>
              {saving ? "만드는 중…" : "교과목 만들고 편성 시작"}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">주차 계획 수정</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-[13px] text-destructive">
          <div className="mb-1 font-medium">오류 {errors.length}건 — 저장이 차단됩니다</div>
          <ul className="list-disc space-y-0.5 pl-5">
            {errors.map((e, i) => (
              <li key={`${e.code}-${e.week_no ?? "o"}-${i}`}>
                {e.week_no ? `${e.week_no}주차: ` : ""}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-400/50 bg-amber-50 p-3 text-[13px] text-amber-800">
          <div className="mb-1 font-medium">경고 {warnings.length}건 — 저장은 가능합니다</div>
          <ul className="list-disc space-y-0.5 pl-5">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${w.week_no ?? "o"}-${i}`}>
                {w.week_no ? `${w.week_no}주차: ` : ""}
                {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Outline fields ── */}
      <section className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-muted-foreground">교과목 기본정보</h3>
        <p className="max-w-[42rem] text-[12.5px] text-muted-foreground">
          제목과 운영 상태를 정합니다. 수준·주제·모드·언어방향은 저장 후 돌아가는
          AI 편성 화면 한 곳에서 조절합니다.
        </p>
        {/* 폼은 화면이 아니라 내용 폭에 맞춘다 — 전폭 2열이면 「중급」
            하나를 고르는 선택지가 590px가 된다. */}
        <div className="grid max-w-[46rem] gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>제목</Label>
            <Input
              value={outline.title}
              onChange={(e) => patchOutline({ title: e.target.value })}
              placeholder="예: 2026-2 중급 통번역"
            />
          </div>
          {/* 상태는 「고급 설정」 안에 있었다 — 게시하려면 접힌 패널을 펼쳐서 초안을
              게시로 바꿔야 했다. 저장 다음으로 자주 쓰는 조작이라 기본 정보로 올린다. */}
          <div className="space-y-1.5">
            <Label>상태</Label>
            <Select value={outline.status} onValueChange={(v) => patchOutline({ status: v as CurriculumStatus })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as CurriculumStatus[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {STATUS_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-muted-foreground">
              「게시」로 바꿔야 학습자 쪽에서 이 교과목을 사용합니다.
            </p>
          </div>
        </div>

        {/* 학기마다 달라질 수 있는 운영값만 남긴다. 주차 수와 미사용 학기 목표는 노출하지 않는다. */}
        <details className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          <summary className="cursor-pointer text-[12.5px] font-medium text-muted-foreground">
            평가 주차와 기본 미션 수
          </summary>
          <div className="mt-3 grid max-w-[46rem] gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>중간고사 주차</Label>
              <Input
                type="number"
                value={numToInput(outline.midterm_week)}
                onChange={(e) => patchOutline({ midterm_week: inputToNullableNum(e.target.value) })}
                placeholder="예: 8"
              />
            </div>
            <div className="space-y-1.5">
              <Label>기말고사 주차</Label>
              <Input
                type="number"
                value={numToInput(outline.final_week)}
                onChange={(e) => patchOutline({ final_week: inputToNullableNum(e.target.value) })}
                placeholder="예: 15"
              />
            </div>
            <div className="space-y-1.5">
              <Label>주차당 기본 미션 수</Label>
              <Input
                type="number"
                value={String(outline.scenarios_per_week)}
                onChange={(e) => patchOutline({ scenarios_per_week: inputToNullableNum(e.target.value) ?? 0 })}
              />
            </div>
          </div>
        </details>
      </section>

      {/* ── Weeks ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">15주 수업 계획</h3>
          <span className="text-[12px] text-muted-foreground">
            표준 계획이 자동으로 준비됩니다. 바꿀 주차만 「수정」하세요.
          </span>
        </div>
        {weeks.map((w, i) => {
          const isRegular = w.type === REGULAR_WEEK;
          const reinforcement = isReinforcementWeek(w);
          const centralQuestion = weekCentralQuestion(w);
          const role = weekRole(w.week_no);
          const open = openWeek === w.week_no;
          const canDoSuggestions = buildCanDoSuggestions(
            w,
            outline.language_direction,
          );
          return (
            <div key={w.week_no} className="space-y-3 rounded-lg border border-border bg-card p-4">
              {/* 컴팩트 헤더 — 주차·역할·화행·제목(읽기) + 수정 토글 */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex h-7 min-w-[3rem] items-center justify-center rounded-md bg-muted px-2 text-[13px] font-medium">
                  {w.week_no}주차
                </span>
                <span className="rounded bg-[#EEF2F6] px-2 py-0.5 text-[11.5px] font-medium text-[#5B6B76]">
                  {ROLE_LABEL[role]} · {STAGE_LABEL[role]}
                </span>
                {w.speech_act && (
                  <span className="rounded bg-[#FFF3C4] px-2 py-0.5 text-[11.5px] font-medium text-[#6B5518]">
                    {SPEECH_ACT_UI[w.speech_act]}
                  </span>
                )}
                {w.review_released && (
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11.5px] font-medium text-emerald-800">
                    복습 공개
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{weekActivityLabel(w)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[12px]"
                  onClick={() => setOpenWeek(open ? null : w.week_no)}
                >
                  {open ? "닫기" : "수정"}
                </Button>
              </div>

              {centralQuestion && (
                <div className="text-[12px] leading-5 text-muted-foreground">
                  <p><span className="font-semibold">중심 질문 · </span>{centralQuestion}</p>
                  {open && <p className="mt-1">{CENTRAL_QUESTION_GUIDANCE}</p>}
                </div>
              )}
              {reinforcement && <p className="text-[12px] leading-5 text-muted-foreground">{REINFORCEMENT_DESCRIPTION}</p>}

              {open && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-40">
                      <Select
                        value={w.type}
                        onValueChange={(v) => patchWeek(i, { type: v as CurriculumWeekType })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(WEEK_TYPE_LABEL) as CurriculumWeekType[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {WEEK_TYPE_LABEL[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="h-8 flex-1"
                      value={w.title}
                      onChange={(e) => patchWeek(i, { title: e.target.value })}
                      placeholder="주차 제목 (선택)"
                    />
                  </div>

                  {isRegular && (
                    <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                      <NullableSelect
                        label={reinforcement ? "집중 보완할 화행" : "수업 초점 · 화행"}
                        value={w.speech_act}
                        options={reinforcement
                          ? Object.fromEntries(previouslyLearnedActs(weeks).map((act) => [act, SPEECH_ACT_UI[act]]))
                          : SPEECH_ACT_UI}
                        onChange={(v) => patchWeek(i, {
                          speech_act: v as SpeechActUI | null,
                          ...(reinforcement ? { title: REINFORCEMENT_TITLE, scenario_slots: 2 } : {}),
                        })}
                      />
                      <div className="space-y-1.5">
                        <Label className="text-[12px]">이 주차의 미션 수</Label>
                        {reinforcement ? <p className="text-[13px]">같은 화행 · 새 상황의 미션 2개</p> : <Input
                          type="number"
                          min={0}
                          className="h-8"
                          value={numToInput(w.scenario_slots)}
                          onChange={(e) =>
                            patchWeek(i, { scenario_slots: inputToNullableNum(e.target.value) })
                          }
                          placeholder={`기본 ${outline.scenarios_per_week}개`}
                        />}
                      </div>
                    </div>
                  )}

                  <details className="rounded-lg border border-[#EAE4D2] bg-[#FAF8F2] px-4 py-3">
                    <summary className="cursor-pointer text-[12.5px] font-medium text-muted-foreground">
                      학습자 화면 세부 설정 (선택)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-[12px]">Can-do 학습목표 (선택)</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11.5px]"
                              >
                                <CircleHelp className="mr-1 h-3.5 w-3.5" />
                                작성 가이드
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-[380px] space-y-3">
                              <div>
                                <p className="text-[13px] font-semibold">상황 중심 Can-do 작성 틀</p>
                                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                                  [상황·관계]에서 [소통 행동]을 [맥락 조건]에 맞게 수행할 수 있다.
                                </p>
                                <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                                  행동 중심 원리를 반영한 PRAGMA 내부 가이드이며, CEFR·ACTFL의
                                  공식 표준 문구를 옮긴 것은 아닙니다.
                                </p>
                              </div>
                              <div className="space-y-2">
                                {canDoSuggestions.map((suggestion) => (
                                  <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => addCanDoSuggestion(i, suggestion)}
                                    className="w-full rounded-md border border-[#EAE4D2] bg-[#FAF8F2] px-3 py-2 text-left text-[11.5px] leading-relaxed transition hover:bg-[#FFF7CC]"
                                  >
                                    {suggestion}
                                    <span className="mt-1 block font-semibold text-[#7A4A0A]">
                                      이 목표 추가
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Textarea
                          rows={2}
                          value={w.can_do.join("\n")}
                          onChange={(e) =>
                            patchWeek(i, {
                              can_do: e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter((s) => s !== ""),
                            })
                          }
                          placeholder="비워두면 주차 화행과 언어방향을 바탕으로 기본 목표를 제공합니다."
                        />
                      </div>

                    </div>
                  </details>
                </>
              )}
            </div>
          );
        })}
      </section>

      <div className="flex justify-end gap-2 pb-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
      </div>
    </div>
  );
};

// Small nullable-select helper (shadcn Select can't hold an empty value, so a
// sentinel option represents "미선택").
function NullableSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: Record<string, string>;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px]">{label}</Label>
      <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>미선택</SelectItem>
          {Object.keys(options).map((k) => (
            <SelectItem key={k} value={k}>
              {options[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default CurriculumEditor;
