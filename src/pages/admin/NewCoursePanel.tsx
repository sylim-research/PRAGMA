import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CompositionConditionFields } from "@/components/admin/CompositionConditionFields";
import { countAvailableMissions, type CompositionConditions } from "@/lib/curriculum/compositionConditions";
import { createCurriculumOutline, type CurriculumOutlineWithWeeks } from "@/lib/curriculum/api";
import type { ComposerCore } from "@/lib/curriculum/composer";
import { COURSE_MODE_LABEL, type CourseMode } from "@/lib/curriculum/courseModePolicy";
import { createEmptyOutlineDraft } from "@/lib/curriculum/mappers";
import {
  createStandard15WeekTemplate,
  STANDARD_FINAL_WEEK,
  STANDARD_MIDTERM_WEEK,
  STANDARD_TARGET_ACTS,
} from "@/lib/curriculum/template";
import { validateCurriculum } from "@/lib/curriculum/validate";
import { DIRECTION_LABEL, LEVEL } from "@/lib/pragma/enums";
import { COURSE_PRESETS, THEME_CODES, THEME_LABEL } from "@/lib/pragma/scenarioTopics";

const DIRECT = "direct";
const DIRECT_DEFAULT: CompositionConditions = { level: "intermediate", direction: "ko_zh", courseMode: "mixed", themes: [] };

function interpretingWeeksFor(mode: CourseMode, presetWeeks?: number): number {
  if (mode === "translation") return 0;
  if (mode === "interpreting") return 12;
  return presetWeeks && presetWeeks >= 1 && presetWeeks <= 11 ? presetWeeks : 6;
}

/**
 * 새 교과목 편성 — ① 출발점(표준 교과목 유형 또는 직접 설정) ② 조건 확인 ③ 이름 입력 후 생성.
 * 생성 결과는 표준 15주 계획이며, 미션 배치는 기존 교과목 탭에서 「편성 저장」으로 확정한다.
 */
export function NewCoursePanel({
  cores,
  onCreated,
}: {
  cores: ComposerCore[];
  onCreated: (saved: CurriculumOutlineWithWeeks) => void;
}) {
  const [start, setStart] = useState<string>(COURSE_PRESETS[0]?.preset_code ?? DIRECT);
  const initialPreset = COURSE_PRESETS[0];
  const [conditions, setConditions] = useState<CompositionConditions>(
    initialPreset
      ? {
          level: initialPreset.target_level,
          direction: initialPreset.language_direction,
          courseMode: initialPreset.course_mode,
          themes: [...initialPreset.included_themes],
        }
      : DIRECT_DEFAULT,
  );
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const preset = COURSE_PRESETS.find((item) => item.preset_code === start);
  const available = useMemo(() => countAvailableMissions(cores, conditions), [cores, conditions]);

  const choose = (code: string) => {
    setStart(code);
    const next = COURSE_PRESETS.find((item) => item.preset_code === code);
    setConditions(
      next
        ? { level: next.target_level, direction: next.language_direction, courseMode: next.course_mode, themes: [...next.included_themes] }
        : DIRECT_DEFAULT,
    );
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
      target_interpreting_week_count: interpretingWeeksFor(conditions.courseMode, preset?.target_interpreting_week_count),
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

  const startCard = (code: string, name: string, meta: string, themes: string) => {
    const selected = start === code;
    return (
      <button
        key={code}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => choose(code)}
        className={`flex flex-col gap-1 rounded-xl border bg-white px-3.5 py-2.5 text-left transition ${
          selected ? "border-[#1F3A5F] bg-[#F7F9FC] shadow-[0_0_0_1px_#1F3A5F]" : "border-[#E2DED2] hover:border-[#9FB0C6]"
        }`}
      >
        <span className="text-[14px] font-bold text-[#15202B]">{name}</span>
        {meta && <span className="text-[12.5px] font-medium text-[#1F3A5F]">{meta}</span>}
        <span className="text-[12px] text-[#46515A]">{themes}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-[15px] font-bold text-[#15202B]">
          <span className="mr-1.5 text-[#1F3A5F]">①</span>출발점 고르기
        </h2>
        <div role="radiogroup" aria-label="출발점" className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {COURSE_PRESETS.map((item) =>
            startCard(
              item.preset_code,
              item.label,
              `${LEVEL[item.target_level]} · ${DIRECTION_LABEL[item.language_direction]} · ${COURSE_MODE_LABEL[item.course_mode]}`,
              `주제 · ${item.included_themes.map((theme) => THEME_LABEL[theme]).join(" · ")}`,
            ),
          )}
          {startCard(DIRECT, "직접 설정", "", `수준·방향·비율·주제를 처음부터 정합니다 (주제 ${THEME_CODES.length}개 중 선택).`)}
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
                  placeholder={preset ? `예: 2026-2 ${preset.label}` : "예: 2026-2 중급 한중 통번역"}
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
