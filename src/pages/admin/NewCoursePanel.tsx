import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CompositionConditionFields } from "@/components/admin/CompositionConditionFields";
import { countAvailableMissions, type CompositionConditions } from "@/lib/curriculum/compositionConditions";
import { createCurriculumOutline, type CurriculumOutlineWithWeeks } from "@/lib/curriculum/api";
import type { ComposerCore } from "@/lib/curriculum/composer";
import type { CurriculumOutlineRow } from "@/lib/curriculum/types";
import { COURSE_MODES, type CourseMode } from "@/lib/curriculum/courseModePolicy";
import { createEmptyOutlineDraft } from "@/lib/curriculum/mappers";
import {
  createStandard15WeekTemplate,
  STANDARD_FINAL_WEEK,
  STANDARD_MIDTERM_WEEK,
  STANDARD_TARGET_ACTS,
} from "@/lib/curriculum/template";
import { validateCurriculum } from "@/lib/curriculum/validate";
import { LEVEL, type LanguageDirection, type LearnerLevel } from "@/lib/pragma/enums";
import { courseDisplayTitle, THEME_CODES, type ThemeCode } from "@/lib/pragma/scenarioTopics";

const DIRECT_DEFAULT: CompositionConditions = { level: "intermediate", direction: "ko_zh", courseMode: "mixed", themes: [] };

function interpretingWeeksFor(mode: CourseMode, sourceWeeks?: number): number {
  if (mode === "translation") return 0;
  if (mode === "interpreting") return 12;
  return sourceWeeks && sourceWeeks >= 1 && sourceWeeks <= 11 ? sourceWeeks : 6;
}

function conditionsOf(course: CurriculumOutlineRow): CompositionConditions {
  return {
    level: course.level as LearnerLevel,
    direction: course.language_direction as LanguageDirection,
    courseMode: COURSE_MODES.includes(course.course_mode as CourseMode) ? (course.course_mode as CourseMode) : "mixed",
    themes: (course.composition_theme_codes ?? []).filter((theme): theme is ThemeCode => THEME_CODES.includes(theme as ThemeCode)),
  };
}

/**
 * 새 교과목 편성 — ① 시작 방법(기존 교과목 조건 복사 / 처음부터) ② 조건 확인 ③ 교과목명.
 * 생성 결과는 표준 15주 계획이며, 미션 배치는 기존 교과목 탭에서 「편성 저장」으로 확정한다.
 */
export function NewCoursePanel({
  cores,
  courses,
  onCreated,
}: {
  cores: ComposerCore[];
  courses: CurriculumOutlineRow[];
  onCreated: (saved: CurriculumOutlineWithWeeks) => void;
}) {
  const [method, setMethod] = useState<"copy" | "blank">(courses.length > 0 ? "copy" : "blank");
  const [sourceId, setSourceId] = useState<string>(courses[0]?.id ?? "");
  const [conditions, setConditions] = useState<CompositionConditions>(courses[0] ? conditionsOf(courses[0]) : DIRECT_DEFAULT);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const source = method === "copy" ? courses.find((course) => course.id === sourceId) : undefined;
  const available = useMemo(() => countAvailableMissions(cores, conditions), [cores, conditions]);

  const chooseMethod = (next: "copy" | "blank") => {
    setMethod(next);
    const course = courses.find((item) => item.id === sourceId);
    setConditions(next === "copy" && course ? conditionsOf(course) : DIRECT_DEFAULT);
  };
  const chooseSource = (id: string) => {
    setSourceId(id);
    const course = courses.find((item) => item.id === id);
    if (course) setConditions(conditionsOf(course));
  };
  const patch = (next: Partial<CompositionConditions>) => setConditions((prev) => ({ ...prev, ...next }));

  const create = async () => {
    const name = title.trim();
    if (!name) {
      toast.warning("교과목명을 입력해 주세요.");
      document.getElementById("new-course-title")?.focus();
      return;
    }
    const outline = {
      ...createEmptyOutlineDraft(),
      title: name,
      level: conditions.level,
      language_direction: conditions.direction,
      composition_theme_codes: conditions.themes,
      course_mode: conditions.courseMode,
      target_interpreting_week_count: interpretingWeeksFor(conditions.courseMode, source?.target_interpreting_week_count),
      midterm_week: STANDARD_MIDTERM_WEEK,
      final_week: STANDARD_FINAL_WEEK,
      target_speech_acts: [...STANDARD_TARGET_ACTS],
    };
    const weeks = createStandard15WeekTemplate();
    const result = validateCurriculum(outline, weeks);
    if (result.errors.length > 0) {
      toast.error(result.errors[0].message);
      return;
    }
    setCreating(true);
    try {
      const saved = await createCurriculumOutline(outline, weeks);
      toast.success("새 교과목을 만들고 미션을 자동으로 채웠습니다. 확인 후 「편성 저장」을 눌러 주세요.");
      onCreated(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "교과목을 만들지 못했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-[15px] font-bold text-[#15202B]">
          <span className="mr-1.5 text-[#1F3A5F]">①</span>시작 방법
        </h2>
        <div role="radiogroup" aria-label="시작 방법" className="mt-2.5 flex flex-wrap items-center gap-2.5">
          <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${method === "copy" ? "border-[#1F3A5F] bg-[#F7F9FC]" : "border-[#E2DED2] bg-white"}`}>
            <input type="radio" name="new-course-method" checked={method === "copy"} onChange={() => chooseMethod("copy")} className="accent-[#1F3A5F]" />
            <span className="text-[14px] font-bold text-[#15202B]">기존 교과목 조건 복사</span>
            <select
              aria-label="복사할 교과목"
              value={sourceId}
              disabled={courses.length === 0}
              onFocus={() => method !== "copy" && chooseMethod("copy")}
              onChange={(event) => { setMethod("copy"); chooseSource(event.target.value); }}
              className="ml-1 h-8 rounded-md border border-[#D8D4C8] bg-white px-2 text-[13.5px] text-[#15202B]"
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {courseDisplayTitle(course)} · {LEVEL[course.level as LearnerLevel] ?? course.level}
                </option>
              ))}
            </select>
          </label>
          <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${method === "blank" ? "border-[#1F3A5F] bg-[#F7F9FC]" : "border-[#E2DED2] bg-white"}`}>
            <input type="radio" name="new-course-method" checked={method === "blank"} onChange={() => chooseMethod("blank")} className="accent-[#1F3A5F]" />
            <span className="text-[14px] font-bold text-[#15202B]">처음부터 설정</span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-[#E2DED2] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE4D2] px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-[15px] font-bold text-[#15202B]">
              <span className="mr-1.5 text-[#1F3A5F]">②</span>조건 확인 · <span className="mr-1.5 text-[#1F3A5F]">③</span>이름 정하기
            </h2>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                available > 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
              }`}
            >
              편성할 수 있는 미션 {available}개
            </span>
          </div>
          <Button className="h-9 px-5" onClick={create} disabled={creating}>
            {creating ? "만드는 중…" : "교과목 만들고 미션 자동 채우기"}
          </Button>
        </div>
        <div className="px-4 py-3">
          <CompositionConditionFields
            value={conditions}
            onLevel={(level) => patch({ level })}
            onDirection={(direction) => patch({ direction })}
            onCourseMode={(courseMode) => patch({ courseMode })}
            onThemes={(themes) => patch({ themes })}
            leading={
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] font-semibold text-[#46515A]">교과목명</span>
                <input
                  id="new-course-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={source ? `예: 2026-2 ${courseDisplayTitle(source)}` : "예: 2026-2 중급 한중 통번역"}
                  className="h-9 w-full rounded-md border border-[#D8D4C8] bg-white px-2 text-[13.5px] text-[#15202B]"
                />
              </label>
            }
          />
        </div>
      </section>
    </div>
  );
}
