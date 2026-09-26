import type { ComposerCore } from "@/lib/curriculum/composer";
import type { AssignedItem, AssignMap } from "@/lib/curriculum/composerPlanning";
import type { CurriculumOutlineRow, CurriculumWeekRow } from "@/lib/curriculum/types";
import {
  DIRECTION_LABEL,
  DOMAIN,
  LEVEL,
  MODE_LABEL,
  SPEECH_ACT_UI,
  type Domain,
  type LanguageDirection,
  type LearnerLevel,
  type SpeechActUI,
} from "@/lib/pragma/enums";
import { COURSE_MODE_LABEL, expectedMissionModesForWeek, missionModesSummary, type CourseMode } from "@/lib/curriculum/courseModePolicy";
import { courseDisplayTitle } from "@/lib/pragma/scenarioTopics";
import { CENTRAL_QUESTION_GUIDANCE, isReinforcementWeek, REINFORCEMENT_DESCRIPTION, weekActivityLabel, weekCentralQuestion } from "@/lib/curriculum/weekGuidance";
import {
  EMPTY_SYLLABUS_SETTINGS,
  SYLLABUS_EVALUATION_ROWS,
  hasSyllabusEvaluationWeights,
  syllabusEvaluationTotal,
  type CurriculumSyllabusSettings,
} from "@/lib/curriculum/syllabusSettings";

interface CurriculumSyllabusProps {
  outline: CurriculumOutlineRow;
  weeks: CurriculumWeekRow[];
  assignments: AssignMap;
  coreById: Record<string, ComposerCore>;
  settings?: CurriculumSyllabusSettings;
}

function assignmentTitle(item: AssignedItem, coreById: Record<string, ComposerCore>) {
  const core = coreById[item.scenario_id];
  if (!core) return "배정 미션 확인 필요";
  const mode = core.mode === "stt_interpreting" ? MODE_LABEL.stt_interpreting : MODE_LABEL.translation;
  return `${mode} · ${core.situation_ko || "상황 제목 없음"}`;
}

function weeklyActivity(week: CurriculumWeekRow, items: AssignedItem[], courseMode: CourseMode) {
  if (week.type === "orientation") return "수업 안내 · 학습 흐름 확인";
  if (week.type === "midterm") return "중간 수행 점검 · 피드백";
  if (week.type === "final") return "기말 수행 점검 · 성찰";
  if (isReinforcementWeek(week)) return "선정 이유 공유 → 기존 사례 검토 → 같은 화행의 새 상황 수행 → 선택 이유 설명";
  const planned = missionModesSummary(expectedMissionModesForWeek({ courseMode }, week.week_no));
  if (!items.length) return planned ? `${planned} · 편성 준비` : "주차 계획에 따른 수업 활동";
  return `${planned} · 각 미션의 판단 → 산출 → 피드백·수정`;
}

function weeklyAssignment(week: CurriculumWeekRow, items: AssignedItem[]) {
  if (week.type === "orientation") return "학습 환경 확인";
  if (week.type === "midterm" || week.type === "final") return "수행 결과·학습노트 정리";
  if (!items.length) return "교수자 계획 참조";
  return "배정 미션 완료 · 주차 학습노트 정리";
}

export function CurriculumSyllabus({
  outline,
  weeks,
  assignments,
  coreById,
  settings = EMPTY_SYLLABUS_SETTINGS,
}: CurriculumSyllabusProps) {
  const targetActs = (outline.target_speech_acts ?? [])
    .map((act) => SPEECH_ACT_UI[act as SpeechActUI] ?? act)
    .join(" · ");
  const levelLabel = LEVEL[outline.level as LearnerLevel] ?? outline.level;
  const directionLabel = DIRECTION_LABEL[outline.language_direction as LanguageDirection]
    ?? outline.language_direction;
  const courseModeLabel = COURSE_MODE_LABEL[outline.course_mode as CourseMode] ?? outline.course_mode;

  return (
    <article className="curriculum-syllabus mx-auto max-w-[1000px] bg-white text-[#15202B]">
      <header className="border-b-4 border-[#15202B] pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#486C65]">PRAGMA COURSE SYLLABUS</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">{courseDisplayTitle(outline)}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#52616B]">
          {outline.semester_goal || "학기 목표는 교과목 편성 화면에서 입력합니다."}
        </p>
      </header>

      <section className="mt-5 grid gap-px overflow-hidden rounded-lg border border-[#CCD5D1] bg-[#CCD5D1] sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["수준", levelLabel],
          ["언어 방향", directionLabel],
          ["수행 방식", courseModeLabel],
          ["주차·미션", `${outline.week_count}주 · 화행별 ${missionModesSummary(expectedMissionModesForWeek({ courseMode: outline.course_mode as CourseMode }, 2))}`],
          ["영역", DOMAIN[outline.domain as Domain] ?? outline.domain],
          ["핵심 화행", targetActs || "주차 계획 참조"],
          ["담당교수", settings.instructorName || "교수자 입력"],
          ["수업시간·강의실", settings.scheduleLocation || "교수자 입력"],
        ].map(([label, value]) => (
          <div key={label} className="bg-[#F7F9F8] px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#65756F]">{label}</p>
            <p className="mt-1 text-[12.5px] font-medium leading-snug">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#CCD5D1] p-3">
          <h2 className="text-[12px] font-bold">교과목 개요</h2>
          <p className="mt-2 text-[11px] leading-5 text-[#52616B]">
            {levelLabel} 학습자를 대상으로 {directionLabel} {courseModeLabel} 수행을 연습하며,
            {targetActs ? ` ${targetActs} 화행을` : " 주차별 화행을"} 실제 편성 미션으로 학습합니다.
          </p>
        </div>
        <div className="rounded-lg border border-[#CCD5D1] p-3">
          <h2 className="text-[12px] font-bold">학기 학습목표</h2>
          <p className="mt-2 text-[11px] leading-5 text-[#52616B]">
            {outline.semester_goal || "교과목 편성 화면에서 입력합니다."}
          </p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="border-l-4 border-[#FAD338] pl-2 text-lg font-bold">학습 운영 원칙</h2>
        <div className="mt-2 grid gap-2 text-[12px] leading-relaxed sm:grid-cols-2">
          <p className="rounded-md bg-[#F7F9F8] px-3 py-2">같은 화행의 {missionModesSummary(expectedMissionModesForWeek({ courseMode: outline.course_mode as CourseMode }, 2))}를 서로 다른 상황에서 수행합니다. 각 미션은 MJT5+DCT1로 완결됩니다.</p>
          <p className="rounded-md bg-[#F7F9F8] px-3 py-2">MJT 수행 뒤 5 POINT LESSON으로 핵심 판단 근거를 확인합니다.</p>
          <p className="rounded-md bg-[#F7F9F8] px-3 py-2">DCT는 최초 산출 → 최소 피드백 → 수정 → 참고안 비교 순서로 진행합니다.</p>
          <p className="rounded-md bg-[#F7F9F8] px-3 py-2">교수자는 승인된 미션의 6단계 수업자료와 학생 활동지를 함께 활용합니다.</p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="border-l-4 border-[#FAD338] pl-2 text-lg font-bold">주차별 수업 계획</h2>
        <p className="mt-2 text-[11px] leading-5 text-[#52616B]">{CENTRAL_QUESTION_GUIDANCE}</p>
        <p className="mt-1 text-[11px] leading-5 text-[#52616B]">13주 · {REINFORCEMENT_DESCRIPTION}</p>
        <div className="mt-2 overflow-hidden rounded-lg border border-[#C9D2CE]">
          <table className="w-full table-fixed border-collapse text-left text-[9.5px] leading-snug">
            <thead className="bg-[#15202B] text-white">
              <tr>
                <th className="w-[5%] px-1.5 py-2">주차</th>
                <th className="w-[10%] px-1.5 py-2">화행·활동</th>
                <th className="w-[17%] px-1.5 py-2">중심 질문·학습목표</th>
                <th className="w-[16%] px-1.5 py-2">미션 세트 A</th>
                <th className="w-[16%] px-1.5 py-2">미션 세트 B</th>
                <th className="w-[20%] px-1.5 py-2">수업활동</th>
                <th className="w-[16%] px-1.5 py-2">과제·산출물</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => {
                const items = assignments[week.week_no] ?? [];
                const title = weekActivityLabel(week);
                const centralQuestion = weekCentralQuestion(week);
                const goals = week.can_do?.length
                  ? week.can_do.join(" · ")
                  : week.competency_focus || (centralQuestion ? null : "교수자 계획 참조");

                return (
                  <tr key={week.id} className="border-t border-[#DDE3E0] align-top even:bg-[#F8FAF9]">
                    <td className="px-1.5 py-2 font-bold">{week.week_no}</td>
                    <td className="px-1.5 py-2 font-semibold">{title}
                      {isReinforcementWeek(week) && <p className="mt-1 font-normal">{week.speech_act ? SPEECH_ACT_UI[week.speech_act as SpeechActUI] : "교강사 선정 예정"}</p>}
                    </td>
                    <td className="px-1.5 py-2">
                      {centralQuestion && <p><span className="font-semibold">중심 질문 · </span>{centralQuestion}</p>}
                      {goals && <p className={centralQuestion ? "mt-1 text-[#52616B]" : ""}>{goals}</p>}
                    </td>
                    <td className="px-1.5 py-2">{items[0] ? assignmentTitle(items[0], coreById) : "—"}</td>
                    <td className="px-1.5 py-2">{items[1] ? assignmentTitle(items[1], coreById) : "—"}</td>
                    <td className="px-1.5 py-2">{weeklyActivity(week, items, outline.course_mode as CourseMode)}</td>
                    <td className="px-1.5 py-2">{weeklyAssignment(week, items)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-2">
          <h2 className="border-l-4 border-[#FAD338] pl-2 text-lg font-bold">학습목표–평가 근거 대응</h2>
          <p className="text-[10px] text-[#65756F]">
            평가 비중 합계 {hasSyllabusEvaluationWeights(settings) ? `${syllabusEvaluationTotal(settings)}%` : "교수자 입력"}
          </p>
        </div>
        <div className="mt-2 overflow-hidden rounded-lg border border-[#C9D2CE]">
          <table className="w-full border-collapse text-left text-[11px] leading-snug">
            <thead className="bg-[#EEF2F1] text-[#26333B]">
              <tr>
                <th className="w-[28%] px-3 py-2">평가 항목·학습목표</th>
                <th className="px-3 py-2">PRAGMA 평가 근거</th>
                <th className="w-[14%] px-3 py-2 text-center">비중</th>
              </tr>
            </thead>
            <tbody>
              {SYLLABUS_EVALUATION_ROWS.map((row) => (
                <tr key={row.key} className="border-t border-[#DDE3E0]">
                  <td className="px-3 py-2 font-semibold">{row.label}</td>
                  <td className="px-3 py-2">{row.evidence}</td>
                  <td className="px-3 py-2 text-center font-semibold">
                    {settings.evaluationWeights[row.key] === null
                      ? "교수자 입력"
                      : `${settings.evaluationWeights[row.key]}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          ["출결·과제 정책", settings.attendanceAssignmentPolicy || "교수자 입력"],
          ["교재·참고자료", settings.materials || "교수자 입력"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#CCD5D1] p-3">
            <h2 className="text-[12px] font-bold">{label}</h2>
            <p className="mt-2 whitespace-pre-line text-[11px] leading-5 text-[#52616B]">{value}</p>
          </div>
        ))}
      </section>

      <footer className="mt-6 border-t border-[#CCD5D1] pt-3 text-[10px] text-[#65756F]">
        이 문서는 PRAGMA에 저장된 교과목·주차·미션 편성의 현재 화면 상태를 바탕으로 작성되었습니다.
      </footer>
    </article>
  );
}

export default CurriculumSyllabus;
