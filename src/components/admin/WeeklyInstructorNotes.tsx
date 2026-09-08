import type { LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
import type { InstructorMissionGuide } from "@/lib/pragma/instructorGuide";
import { weeklyInstructorContent } from "@/lib/curriculum/weeklyInstructorContent";

export interface WeeklyMissionNotes {
  scenarioId: string;
  label: string;
  guide: InstructorMissionGuide;
}

/** 관리자 페이지에서만 가져온다. 공용 자료 모델·프로젝터·HTML은 이 컴포넌트를 사용하지 않는다. */
export function WeeklyInstructorNotes({ week, direction, missions, generatedNotes = [] }: {
  week: LearnerCourseWeek;
  direction: string;
  missions: WeeklyMissionNotes[];
  generatedNotes?: Array<{ title: string; body: string }>;
}) {
  const { features, procedure, missionCases = [] } = weeklyInstructorContent(week, direction);
  return <section aria-label="교수자 전용 메모" className="space-y-4 rounded-xl border border-[#DBD3BD] bg-[#FFFCF2] p-5">
    <div>
      <h2 className="text-lg font-bold">교수자 전용 메모</h2>
      <p className="mt-1 text-xs text-muted-foreground">공용 화면·유인물·HTML에 포함되지 않습니다. 기존 검토 기준과 배정 미션의 해설을 참고합니다.</p>
    </div>
    {generatedNotes.map((note, index) => <div key={index} className="rounded-lg border bg-white p-4 [overflow-wrap:anywhere]">
      <h3 className="font-semibold">{note.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{note.body}</p>
    </div>)}
    {features.map((feature) => <div key={feature.code} className="rounded-lg border bg-white p-4">
      <h3 className="font-semibold">{feature.label}</h3>
      <p className="mt-2 text-sm leading-6">{feature.note}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
        {feature.confounds.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </div>)}
    <p className="text-sm leading-6">{procedure}</p>
    <h3 className="font-bold">미션별 핵심 해설</h3>
    {missions.map(({ scenarioId, label, guide }) => <details key={scenarioId} className="rounded-lg border bg-white p-4">
      <summary className="cursor-pointer font-semibold">{label} · {guide.speechActKo}</summary>
      <p className="mt-3 text-sm leading-6">{guide.situationKo}</p>
      {guide.misconceptionKo && <p className="mt-2 text-sm"><strong>예상 오개념:</strong> {guide.misconceptionKo}</p>}
      {guide.coreReasonKo && <p className="mt-2 text-sm"><strong>지도 핵심:</strong> {guide.coreReasonKo}</p>}
      {missionCases.filter((item) => item.scenarioId === scenarioId).map((item) =>
        guide.situationKo !== item.situationKo || guide.dct.sourceText !== item.sourceText
          || !guide.dct.alternatives.some((alternative) => alternative.text === item.referenceText)
          ? <p key={item.scenarioId} className="mt-3 text-sm">연결 지도안의 상황·원문·참고 산출이 현재 DCT와 다릅니다. 교수자 재확인 전 사례 설명을 표시하지 않습니다.</p>
          : <details key={item.scenarioId} className="mt-3 rounded border border-[#DBD3BD] bg-[#FFFCF2] p-3 text-sm">
            <summary className="cursor-pointer font-semibold">{item.title}</summary>
            <p className="mt-2 font-semibold">{item.status}</p>
            <p className="mt-2"><strong>상황:</strong> {item.contextNote}</p>
            <p className="mt-2"><strong>원문 의도:</strong> {item.sourceIntent}</p>
            <h4 className="mt-4 font-semibold">문헌 사례와 이 미션의 연결</h4>
            <p className="mt-2">{item.literature.source}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">{item.literature.examples.map((example) => <li key={example}>{example}</li>)}</ul>
            <p className="mt-2">{item.literature.note}</p>
            <p className="mt-2">{item.referenceNote}</p>
            <h4 className="mt-4 font-semibold">무엇에 비추어 판단하는가</h4>
            <ul className="mt-2 space-y-2">{item.criteria.map((criterion) => <li key={criterion.label}><strong>{criterion.label}:</strong> {criterion.note}</li>)}</ul>
            <h4 className="mt-4 font-semibold">지도용 경계 예 · 새 정답표가 아님</h4>
            <ul className="mt-2 space-y-3">{item.boundaries.map((boundary) => <li key={boundary.text}><p>{boundary.text}</p><p className="mt-1">{boundary.note}</p></li>)}</ul>
            <p className="mt-4">{item.procedure}</p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{item.evidenceLimit}</p>
          </details>)}
      {guide.mpjItems.map((item) => <details key={item.id} className="mt-3 rounded border p-3 text-sm">
        <summary className="cursor-pointer font-semibold">MJT {item.id} · {item.titleKo}</summary>
        <p className="mt-2">{item.designIntentKo}</p>
        <ul className="mt-2 space-y-3">{item.candidates.map((candidate, index) => <li key={index}>
          <p>{candidate.text}</p>
          <p className="text-[#53656F]">{candidate.judgmentKo && `${candidate.judgmentKo} · `}{candidate.noteKo}</p>
        </li>)}</ul>
      </details>)}
      <details className="mt-3 rounded border p-3 text-sm">
        <summary className="cursor-pointer font-semibold">DCT · 참고 산출과 해설</summary>
        <p className="mt-2">{guide.dct.sourceText}</p>
        <ul className="mt-3 space-y-3">{guide.dct.alternatives.map((alternative, index) => <li key={index}>
          <p>{alternative.text}</p><p className="text-[#53656F]">{alternative.noteKo}</p>
        </li>)}</ul>
      </details>
    </details>)}
    {!missions.length && <p className="text-sm text-muted-foreground">확인할 미션 해설이 없습니다. 미션 편성·공개 상태를 확인해 주세요.</p>}
  </section>;
}
