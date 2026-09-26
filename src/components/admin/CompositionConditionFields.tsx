import {
  COMPOSITION_DIRECTIONS,
  COMPOSITION_LEVELS,
  courseModeHint,
  type CompositionConditions,
} from "@/lib/curriculum/compositionConditions";
import { COURSE_MODE_LABEL, COURSE_MODES, type CourseMode } from "@/lib/curriculum/courseModePolicy";
import { DIRECTION_LABEL, LEVEL, type LanguageDirection, type LearnerLevel } from "@/lib/pragma/enums";
import { THEME_CODES, THEME_LABEL, type ThemeCode } from "@/lib/pragma/scenarioTopics";

const LABEL = "text-[11.5px] font-semibold text-[#46515A]";
const SELECT = "h-9 w-full rounded-md border border-[#D8D4C8] bg-white px-2 text-[13.5px] text-[#15202B]";

/** 편성 조건 입력 — 수준·언어방향·번역·통역 비율을 한 줄, 주제를 한 줄에 둔다. */
export function CompositionConditionFields({
  value,
  onLevel,
  onDirection,
  onCourseMode,
  onThemes,
  leading,
}: {
  value: CompositionConditions;
  onLevel: (level: LearnerLevel) => void;
  onDirection: (direction: LanguageDirection) => void;
  onCourseMode: (mode: CourseMode) => void;
  onThemes: (themes: ThemeCode[]) => void;
  /** 조건 줄 맨 앞에 붙는 칸(예: 교과목명). */
  leading?: React.ReactNode;
}) {
  const toggleTheme = (theme: ThemeCode) =>
    onThemes(value.themes.includes(theme) ? value.themes.filter((item) => item !== theme) : [...value.themes, theme]);
  return (
    <div className="space-y-2.5 text-[13px]">
      <div className={`grid gap-x-4 gap-y-2 sm:grid-cols-2 ${leading ? "lg:grid-cols-[minmax(200px,1.4fr)_minmax(110px,0.8fr)_minmax(110px,0.8fr)_minmax(190px,1.2fr)]" : "lg:grid-cols-[minmax(110px,1fr)_minmax(110px,1fr)_minmax(190px,1.4fr)]"}`}>
        {leading}
        <label className="flex flex-col gap-1">
          <span className={LABEL}>수준</span>
          <select value={value.level} onChange={(event) => onLevel(event.target.value as LearnerLevel)} className={SELECT}>
            {COMPOSITION_LEVELS.map((item) => (
              <option key={item} value={item}>{LEVEL[item]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>언어방향</span>
          <select value={value.direction} onChange={(event) => onDirection(event.target.value as LanguageDirection)} className={SELECT}>
            {COMPOSITION_DIRECTIONS.map((item) => (
              <option key={item} value={item}>{DIRECTION_LABEL[item]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>번역·통역 비율</span>
          <select
            value={value.courseMode}
            onChange={(event) => onCourseMode(event.target.value as CourseMode)}
            title={courseModeHint(value.courseMode)}
            className={SELECT}
          >
            {COURSE_MODES.map((mode) => (
              <option key={mode} value={mode}>{COURSE_MODE_LABEL[mode]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${LABEL} mr-1.5`}>
          편성 주제 <span className="font-normal">{value.themes.length === 0 ? `전체 ${THEME_CODES.length}개` : `선택 ${value.themes.length}개`}</span>
        </span>
        <button
          type="button"
          onClick={() => onThemes([])}
          className={`rounded-md border px-2.5 py-0.5 transition ${
            value.themes.length === 0 ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#EAE4D2] bg-white hover:bg-[#FAF8F2]"
          }`}
        >
          전체
        </button>
        {THEME_CODES.map((theme) => (
          <button
            key={theme}
            type="button"
            onClick={() => toggleTheme(theme)}
            className={`rounded-md border px-2.5 py-0.5 transition ${
              value.themes.includes(theme) ? "border-[#FAD338] bg-[#FFF3C4] text-[#15202B]" : "border-[#EAE4D2] bg-white hover:bg-[#FAF8F2]"
            }`}
          >
            {THEME_LABEL[theme]}
          </button>
        ))}
      </div>
    </div>
  );
}
