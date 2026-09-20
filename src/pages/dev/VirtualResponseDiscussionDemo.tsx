import { ClassResponseDashboard } from "@/components/admin/ClassResponseDashboard";
import {
  VIRTUAL_DISCUSSION_QUESTIONS,
  VIRTUAL_RESPONSE_MJT1,
  VIRTUAL_RESPONSE_NOTICE,
  VIRTUAL_RESPONSE_SOURCE,
  virtualResponsePattern,
} from "@/lib/demo/virtualClassResponseFixture";

/**
 * 논문 제5장 수업 활용 예시 — 가상 응답 분포로 교수자가 토론을 이끄는 장면(개발 모드 전용).
 * 운영 학급 응답 화면·DB와 무관하다. 데이터는 로컬 fixture뿐이며, 다수 응답을 정답으로 표시하거나
 * 비율에서 학습자 능력·판단 이유를 추론하지 않는다.
 */
const VirtualResponseDiscussionDemo = () => (
  <main className="min-h-screen bg-[#F3F1EA] px-6 py-10 text-[#15202B]">
    <figure
      id="virtual-response-figure"
      data-testid="virtual-response-figure"
      className="mx-auto w-full max-w-[1000px] space-y-6 rounded-2xl border border-[#D9D5C8] bg-white p-8"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] font-black tracking-tight">가상 응답을 이용한 학급 토론 예시</h1>
        <p className="rounded-full border-2 border-[#15202B] px-4 py-1.5 text-[15px] font-bold">{VIRTUAL_RESPONSE_NOTICE}</p>
      </header>

      <section aria-label="상황" className="rounded-xl bg-[#F6F8F8] px-6 py-5">
        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-4 gap-y-2.5 text-[17px] leading-relaxed">
          <dt className="font-bold text-[#65737D]">상황</dt>
          <dd className="break-keep">{VIRTUAL_RESPONSE_MJT1.situationKo}</dd>
          <dt className="font-bold text-[#65737D]">관계</dt>
          <dd>{VIRTUAL_RESPONSE_MJT1.relationKo}</dd>
          <dt className="font-bold text-[#65737D]">원문</dt>
          <dd className="font-semibold">{VIRTUAL_RESPONSE_MJT1.source}</dd>
        </dl>
      </section>

      <ClassResponseDashboard
        pattern={virtualResponsePattern}
        selectedItemId={1}
        onSelectItem={() => undefined}
        projector
        figureOnly
      />

      <section aria-label="교수자 토론 질문" className="rounded-xl border border-[#E0E3E5] px-6 py-5">
        <h2 className="text-[17px] font-bold">교수자 토론 질문</h2>
        <ol className="mt-3 space-y-2 text-[17px] leading-relaxed">
          {VIRTUAL_DISCUSSION_QUESTIONS.map((question, index) => (
            <li key={question} className="flex gap-2.5">
              <span className="font-bold">{"①②③"[index]}</span>
              <span className="break-keep">{question}</span>
            </li>
          ))}
        </ol>
      </section>
    </figure>

    {/* 그림 밖 — 캡처 범위에 들어가지 않는 출처 표기. */}
    <p className="mx-auto mt-4 max-w-[1000px] text-xs text-[#65737D]">
      콘텐츠 출처: {VIRTUAL_RESPONSE_SOURCE.item} · scenario {VIRTUAL_RESPONSE_SOURCE.scenarioId} ·{" "}
      {VIRTUAL_RESPONSE_SOURCE.schemaVersion} · content_hash {VIRTUAL_RESPONSE_SOURCE.contentHash.slice(0, 8)} ·{" "}
      {VIRTUAL_RESPONSE_SOURCE.placement}
    </p>
  </main>
);

export default VirtualResponseDiscussionDemo;
