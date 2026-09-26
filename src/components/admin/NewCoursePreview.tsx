import { useMemo } from "react";
import { eligibleByMode, eligibleMissions, type CompositionConditions } from "@/lib/curriculum/compositionConditions";
import type { ComposerCore } from "@/lib/curriculum/composer";
import { COURSE_MODE_LABEL, expectedMissionModesForWeek } from "@/lib/curriculum/courseModePolicy";
import { STANDARD_15WEEK } from "@/lib/curriculum/template";
import { DIRECTION_LABEL, LEVEL, SPEECH_ACT_UI } from "@/lib/pragma/enums";
import { THEME_CODES } from "@/lib/pragma/scenarioTopics";

/**
 * 새 교과목 미리보기 — 조건을 바꿀 때마다 15주 골격과 주차별로 채울 수 있는 미션 수를 바로 보여 준다.
 * 저장·서버 호출 없이 화면 계산만 한다. 표준 골격(template)·후보 기준(compositionConditions)과 같은 규칙을 쓴다.
 */
export function NewCoursePreview({ cores, conditions }: { cores: ComposerCore[]; conditions: CompositionConditions }) {
  const eligible = useMemo(() => eligibleMissions(cores, conditions), [cores, conditions]);
  const policy = { courseMode: conditions.courseMode };
  const shortWeeks: number[] = [];
  const rows = STANDARD_15WEEK.map((week) => {
    if (!week.speech_act) return { week, slots: [] as ("translation" | "stt_interpreting")[], fill: [] as boolean[], have: null as null | { translation: number; interpreting: number } };
    const slots = expectedMissionModesForWeek(policy, week.week_no);
    const have = eligibleByMode(eligible, week.speech_act);
    // 자리마다 그 모드의 후보가 남아 있는지 — 같은 모드 자리 2개면 후보도 2개 필요하다.
    const used = { translation: 0, interpreting: 0 };
    const fill = slots.map((mode) => {
      const key = mode === "stt_interpreting" ? "interpreting" : "translation";
      used[key] += 1;
      return have[key] >= used[key];
    });
    if (fill.some((ok) => !ok)) shortWeeks.push(week.week_no);
    return { week, slots, fill, have };
  });
  const themeCount = conditions.themes.length === 0 ? THEME_CODES.length : conditions.themes.length;

  return (
    <aside aria-label="새 교과목 미리보기" className="overflow-hidden rounded-2xl border border-[#E8E2D3] bg-[#FFFDF8] xl:sticky xl:top-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[#233542] px-5 py-2.5 text-white">
        <span aria-hidden className="h-4 w-[4px] rounded-sm bg-[#FAD338]" />
        <h3 className="text-[15.5px] font-bold">이렇게 만들어집니다</h3>
      </div>
      <p className="border-b border-[#EFEAE0] px-5 py-2.5 text-[12.5px] leading-relaxed text-[#46515A]">
        {LEVEL[conditions.level]} · {DIRECTION_LABEL[conditions.direction]} · {COURSE_MODE_LABEL[conditions.courseMode]} · 편성 주제 {themeCount}개 · 편성 가능 미션 <b className="text-[#15202B]">{eligible.length}개</b>
      </p>
      <ol className="divide-y divide-[#F2EEE5] px-3 py-1">
        {rows.map(({ week, slots, fill, have }) => {
          const act = week.speech_act;
          const short = fill.some((ok) => !ok);
          return (
            <li key={week.week_no} className="grid grid-cols-[3rem_5.5rem_minmax(0,1fr)] items-center gap-x-2 px-2 py-1 text-[13px]">
              <span className="text-[12px] font-semibold text-[#66727A]">{week.week_no}주차</span>
              {act ? (
                <>
                  <span className="font-semibold text-[#15202B]">{SPEECH_ACT_UI[act]}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    {/* 자리 하나 = 점 하나. 채워지는 자리는 남색, 후보가 모자란 자리는 빈 원. */}
                    <span className="flex shrink-0 gap-1" aria-hidden>
                      {fill.map((ok, index) => (
                        <span key={index} className={`size-2.5 rounded-full ${ok ? "bg-[#233542]" : "border border-[#B45309] bg-white"}`} />
                      ))}
                    </span>
                    <span className={`truncate text-[12.5px] ${short ? "font-semibold text-[#8A4B08]" : "text-[#66727A]"}`}>
                      {have && (slots.includes("translation") && slots.includes("stt_interpreting")
                        ? `번역 ${have.translation} · 통역 ${have.interpreting}`
                        : slots[0] === "stt_interpreting" ? `통역 ${have.interpreting}` : `번역 ${have.translation}`)}
                      {short ? " · 미션 부족" : ""}
                    </span>
                  </span>
                </>
              ) : (
                <span className="col-span-2 text-[#5D6970]">{week.week_no === 13 ? "집중 보완 (화행은 개설 뒤 선택)" : week.title}</span>
              )}
            </li>
          );
        })}
      </ol>
      {shortWeeks.length > 0 && (
        <p className="border-t border-[#EAE4D2] px-5 py-2.5 text-[12.5px] text-[#8A4B08]">
          ⚠ {shortWeeks.map((n) => `${n}주차`).join(" · ")}는 조건에 맞는 미션이 모자랍니다. 편성 주제를 넓히거나 개설 뒤 직접 채웁니다.
        </p>
      )}
    </aside>
  );
}
