// 교수자용 주차 미션 자료(문항지·해설지). 플랫폼을 쓸 수 없는 수업에 대비해 교수자가 미리 인쇄하거나 PDF로 저장해 둔다.
// 학습자 화면과 같은 view model을 읽어, 학습자가 보는 문항을 그대로 옮긴다. AI 피드백과 학습자 응답은 넣지 않는다.
import type {
  CanonicalMissionViewModel,
  ChoiceOption,
  MissionContext,
  MissionQuest,
} from "@/lib/mission/canonicalMissionPreview";

export type HandoutKind = "student" | "teacher";

const CHANNEL_NOTE = (context: MissionContext) => [context.relation, context.channel].filter(Boolean).join(" · ");

function optionLabel(options: ChoiceOption[], id: string | undefined) {
  return options.find((option) => option.id === id)?.label ?? id ?? "";
}

function Rich({ text }: { text: string }) {
  // 해설 문자열은 학습자 화면용 표시를 담고 있다: 백틱으로 감싼 목표어 표현, 끝의 「표현 메모」 블록.
  // 학습자 화면과 같이 표현 메모는 빼고, 백틱 표현은 굵게만 보인다.
  const lines = text.split(/\r?\n/);
  const memoAt = lines.findIndex((line) => line.trim() === "표현 메모");
  const body = (memoAt < 0 ? lines : lines.slice(0, memoAt)).join("\n").trim();
  return (
    <span className="whitespace-pre-line">
      {body.split(/(`[^`]+`)/g).map((part, index) =>
        part.startsWith("`") && part.endsWith("`") ? <strong key={index} className="font-semibold">{part.slice(1, -1)}</strong> : part,
      )}
    </span>
  );
}

function Boxes({ options }: { options: ChoiceOption[] }) {
  return (
    <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
      {options.map((option) => (
        <span key={option.id}>☐ {option.label}</span>
      ))}
    </p>
  );
}

function WriteLines({ count = 3 }: { count?: number }) {
  return (
    <div className="mt-2 space-y-5" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="border-b border-[#9AA3A9]" />
      ))}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  // 해설지에만 나오는 기준·해설 상자.
  return <div className="mt-2 rounded border-l-4 border-[#1F3A5F] bg-[#F4F6F8] px-3 py-2 text-[13px] leading-relaxed text-[#15202B] print:bg-white">{children}</div>;
}

function Scene({ context, source, sourceLabel }: { context: MissionContext; source?: string; sourceLabel: string }) {
  return (
    <div className="mt-1 space-y-1 text-[13.5px] leading-relaxed">
      <p><span className="font-semibold">상황</span> {context.situation}</p>
      {CHANNEL_NOTE(context) && <p className="text-[#46515A]"><span className="font-semibold text-[#15202B]">관계·매체</span> {CHANNEL_NOTE(context)}</p>}
      {context.precedingTurn && <p><span className="font-semibold">상대의 말</span> {context.precedingTurn}</p>}
      {source && <p><span className="font-semibold">{sourceLabel}</span> {source}</p>}
    </div>
  );
}

function Target({ text }: { text: string }) {
  return <p className="mt-1.5 rounded border border-[#D9D4C7] px-3 py-1.5 text-[14px]">{text}</p>;
}

function QuestBlock({ quest, number, kind, sourceLabel, outputName }: { quest: MissionQuest; number: number; kind: HandoutKind; sourceLabel: string; outputName: string }) {
  const teacher = kind === "teacher";
  const heading = quest.kind === "dct" ? "통번역 과제" : `판단 문항 ${number}`;
  // 저장된 짧은 이름이 「번역하기」로 남은 통역 미션이 있어, 과제 이름은 미션의 실제 수행 방식으로 붙인다.
  const subLabel = quest.kind === "dct" ? outputName : quest.shortLabel;
  return (
    <section className="break-inside-avoid border-t border-[#E2DED2] pt-3">
      <h3 className="text-[14px] font-bold text-[#15202B]">
        {heading} <span className="font-semibold text-[#66727A]">· {subLabel}</span>
      </h3>
      <Scene context={quest.context} source={quest.source} sourceLabel={sourceLabel} />
      {"prompt" in quest && quest.prompt && <p className="mt-2 text-[13.5px] font-semibold">{quest.prompt}</p>}

      {quest.kind === "scale" && (
        <>
          <Target text={quest.target} />
          <Boxes options={quest.options} />
          {quest.reasonChoice && (
            <>
              <p className="mt-2 text-[13.5px] font-semibold">{quest.reasonChoice.prompt}</p>
              <ul className="mt-1 space-y-0.5 text-[13px]">
                {quest.reasonChoice.options.map((option) => <li key={option.id}>☐ {option.label}</li>)}
              </ul>
            </>
          )}
          {teacher && (
            <Key>
              <p><span className="font-semibold">기준 판단</span> {optionLabel(quest.options, quest.referenceAnswer)}
                {quest.acceptedAnswers && quest.acceptedAnswers.length > 1 && ` (인정: ${quest.acceptedAnswers.map((id) => optionLabel(quest.options, id)).join(", ")})`}</p>
              {quest.reasonChoice?.acceptedId && <p><span className="font-semibold">참고 이유</span> {optionLabel(quest.reasonChoice.options, quest.reasonChoice.acceptedId)}</p>}
              <p className="mt-1"><Rich text={quest.feedback} /></p>
              {quest.revisionExamples && quest.revisionExamples.length > 0 && (
                <p className="mt-1"><span className="font-semibold">참고 표현</span> {quest.revisionExamples.join(" / ")}</p>
              )}
            </Key>
          )}
        </>
      )}

      {quest.kind === "spectrum" && (
        <ol className="mt-1.5 space-y-2">
          {quest.candidates.map((candidate, index) => (
            <li key={candidate.id}>
              <p className="text-[14px]">({String.fromCharCode(97 + index)}) {candidate.text}</p>
              <Boxes options={quest.options} />
              {teacher && (
                <Key>
                  <p><span className="font-semibold">기준</span> {candidate.acceptedAnswers.map((id) => optionLabel(quest.options, id)).join(", ")}</p>
                  <p className="mt-1"><Rich text={candidate.note} /></p>
                </Key>
              )}
            </li>
          ))}
        </ol>
      )}

      {quest.kind === "fix_choice" && (
        <>
          <Target text={quest.target} />
          <Boxes options={quest.judgmentOptions} />
          <p className="mt-2 text-[13px] font-semibold">고쳐 쓴다면</p>
          <ul className="mt-1 space-y-0.5 text-[13.5px]">
            {quest.corrections.map((correction) => (
              <li key={correction.id}>☐ {correction.text}{teacher && <span className="ml-2 text-[12.5px] font-semibold text-[#1F3A5F]">{correction.valid ? "· 적절" : "· 부적절"}</span>}</li>
            ))}
          </ul>
          {teacher && (
            <Key>
              <p><span className="font-semibold">기준 판단</span> {optionLabel(quest.judgmentOptions, quest.referenceJudgment)}</p>
              {quest.corrections.map((correction) => <p key={correction.id} className="mt-1">· {correction.text} — <Rich text={correction.note} /></p>)}
              <p className="mt-1"><Rich text={quest.feedback} /></p>
            </Key>
          )}
        </>
      )}

      {quest.kind === "free_correction" && (
        <>
          <Target text={quest.target} />
          <WriteLines count={2} />
          {teacher && (
            <Key>
              <p><span className="font-semibold">참고 표현</span> {quest.references.join(" / ")}</p>
              <p className="mt-1"><Rich text={quest.feedback} /></p>
            </Key>
          )}
        </>
      )}

      {quest.kind === "reason" && (
        <>
          <Target text={quest.target} />
          <ul className="mt-1 space-y-0.5 text-[13.5px]">{quest.reasons.map((reason) => <li key={reason.id}>☐ {reason.text}</li>)}</ul>
          {teacher && (
            <Key>
              <p><span className="font-semibold">참고 이유</span> {quest.reasons.find((reason) => reason.id === quest.acceptedReasonId)?.text}</p>
              <p className="mt-1"><Rich text={quest.feedback} /></p>
            </Key>
          )}
        </>
      )}

      {quest.kind === "best_worst" && (
        <>
          <ol className="mt-1.5 space-y-1 text-[14px]">
            {quest.candidates.map((candidate, index) => <li key={candidate.id}>({String.fromCharCode(97 + index)}) {candidate.text}</li>)}
          </ol>
          {teacher && (
            <Key>
              {quest.candidates.map((candidate) => <p key={candidate.id} className="mt-1">· {candidate.text} — <Rich text={candidate.note} /></p>)}
              <p className="mt-1"><Rich text={quest.feedback} /></p>
            </Key>
          )}
        </>
      )}

      {quest.kind === "dct" && (
        <>
          {quest.vocabularyHints.length > 0 && (
            <p className="mt-1.5 text-[13px] text-[#46515A]">
              <span className="font-semibold text-[#15202B]">어휘 도움</span>{" "}
              {quest.vocabularyHints.map((hint) => `${hint.source} → ${hint.target}`).join(" · ")}
            </p>
          )}
          <p className="mt-2 text-[13px] font-semibold">초안</p>
          <WriteLines count={3} />
          <p className="mt-3 text-[13px] font-semibold">최종안</p>
          <WriteLines count={3} />
          {teacher && (
            <Key>
              <p><span className="font-semibold">참고 표현</span> {quest.referenceAnswer}</p>
              {quest.feedback.alternatives.some((alt) => alt.text.trim() !== quest.referenceAnswer.trim()) && (
                <p className="mt-1"><span className="font-semibold">다른 가능한 표현</span> {quest.feedback.alternatives.filter((alt) => alt.text.trim() !== quest.referenceAnswer.trim()).map((alt) => alt.text).join(" / ")}</p>
              )}
              <p className="mt-1"><Rich text={`${quest.feedback.issue} ${quest.feedback.action}`} /></p>
            </Key>
          )}
        </>
      )}
    </section>
  );
}

export function MissionHandout({
  mission,
  index,
  kind,
}: {
  mission: CanonicalMissionViewModel;
  index: number;
  kind: HandoutKind;
}) {
  const quests = mission.quests.filter((quest) => quest.kind !== "dct_feedback");
  const sourceLabel = mission.activityMode === "interpreting" ? "원발화" : "원문";
  const outputName = mission.activityMode === "interpreting" ? "통역(교수자가 원발화를 읽어 준다)" : "번역";
  let judgment = 0;
  return (
    <article className={`space-y-3 ${index > 0 ? "break-before-page" : ""}`} aria-label={`미션 ${index + 1}`}>
      <header className="border-b-2 border-[#15202B] pb-2">
        <p className="text-[12.5px] font-semibold text-[#66727A]">미션 {index + 1}</p>
        <h2 className="text-[17px] font-bold text-[#15202B]">
          {mission.speechAct} · {mission.direction} {mission.activityMode === "interpreting" ? "통역" : "번역"}
        </h2>
      </header>
      {quests.map((quest) => {
        if (quest.kind !== "dct") judgment += 1;
        return <QuestBlock key={quest.id} quest={quest} number={judgment} kind={kind} sourceLabel={sourceLabel} outputName={outputName} />;
      })}
      {kind === "teacher" && (
        <section className="break-inside-avoid border-t border-[#E2DED2] pt-3">
          <h3 className="text-[14px] font-bold text-[#15202B]">핵심 정리</h3>
          <p className="mt-1 text-[13.5px]"><Rich text={mission.summaryPrinciple} /></p>
          <ul className="mt-1 space-y-0.5 text-[13px]">
            {mission.lessonPoints.map((point) => <li key={point.questId}>· <span className="font-semibold">{point.label}</span> <Rich text={point.text} /></li>)}
          </ul>
        </section>
      )}
    </article>
  );
}

export default MissionHandout;
