import { forwardRef, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, Maximize2, MessageCircle, RotateCcw, X } from "lucide-react";
import type { WeeklyOpening } from "@/lib/curriculum/weeklyOpening";
import "./weeklyOpeningLesson.css";

const STEPS = [
  { label: "장면 만나기", time: "2분" }, { label: "첫 판단", time: "3분" },
  { label: "단서 더하기", time: "4분" }, { label: "함께 정리", time: "3분" },
];
const VOICES = ["그대로 전달해도 좋아요", "한 부분을 바꾸고 싶어요", "아직 정보가 더 필요해요"];

const OpeningSession = forwardRef<HTMLDivElement, { opening: WeeklyOpening; onClose: () => void }>(function OpeningSession({ opening, onClose }, ref) {
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [voice, setVoice] = useState<number | null>(null);
  const [explanation, setExplanation] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [step]);
  const move = (delta: number) => setStep((current) => Math.max(0, Math.min(STEPS.length - 1, current + delta)));
  return <Dialog.Content ref={ref} className="opening-room" onKeyDown={(event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); move(1); }
    if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); move(-1); }
  }}>
    <header className="opening-room-header">
      <div className="opening-brand"><span /> PRAGMA <span className="opening-brand-divider">/</span> <span className="opening-brand-caption">함께 여는 수업</span></div>
      <div className="opening-room-tools"><span>교수자 미리보기</span><Dialog.Close className="opening-icon-button" aria-label="수업 화면 닫기"><X size={22} /></Dialog.Close></div>
    </header>
    <div ref={scrollRef} className="opening-scroll">
      <div className="opening-course"><p>{opening.courseTitle} <span>· {opening.weekNo}주차</span></p><p>{opening.contextLabel}</p></div>
      <Dialog.Title className="sr-only">{opening.weekNo}주차 도입 수업</Dialog.Title>
      <Dialog.Description className="sr-only">교수자가 진행하는 10~15분 도입 활동. 좌우 방향키로 이동하고 Escape로 닫습니다. 응답은 저장하거나 채점하지 않습니다.</Dialog.Description>
      <main className={`opening-stage opening-stage-${step}`} key={step} aria-live="polite">
        <div className="opening-eyebrow"><span>0{step + 1}</span> {STEPS[step].label} <span className="opening-time">약 {STEPS[step].time}</span></div>
        <h1>{step === 0 ? opening.question : step === 1 ? "지금, 여러분의 생각은?" : step === 2 ? "이 사실을 알게 된다면?" : "무엇 때문에 생각이 달라졌나요?"}</h1>
        {step <= 1 && <>
          <p className="opening-scene">{opening.scene}</p>
          <div className="opening-language-pair">
            {opening.source && <section className="opening-source"><p className="opening-label">{opening.source.language === "ko" ? "한국어" : "중국어"} 원문</p><p lang={opening.source.language}>{opening.source.text}</p></section>}
            {opening.rendering ? <section className="opening-utterance"><p className="opening-label">함께 살펴볼 {opening.rendering.language === "ko" ? "한국어" : "중국어"} 초안</p><blockquote lang={opening.rendering.language}>{opening.rendering.text}</blockquote><p className="opening-example">수업용 구성 예시</p></section> : <section className="opening-utterance"><blockquote>{opening.firstPrompt}</blockquote></section>}
          </div>
          <p className="opening-role">{opening.role}</p>
          {step === 0 && <div className="opening-invitation"><MessageCircle size={21} /><span>잠깐 생각한 뒤, 옆 사람에게 첫 느낌을 말해 보세요.</span></div>}
          {step === 1 && <section className="opening-discussion" aria-label="토론할 의견">
            <p className="opening-prompt">{opening.firstPrompt}</p>
            <div className="opening-voices">{VOICES.map((label, index) => <button key={label} className="opening-voice" aria-pressed={voice === index} onClick={() => setVoice(voice === index ? null : index)}><span>{String.fromCharCode(65 + index)}</span>{label}{voice === index && <Check size={19} />}</button>)}</div>
            <p className="opening-support">{voice !== null ? "이 의견의 근거가 된 표현 한 곳을 짚어 봅시다. 다른 의견도 들어 볼까요?" : opening.support}</p>
          </section>}
        </>}
        {step === 2 && <>
          {opening.rendering && <div className="opening-recall"><span>같은 초안</span><p lang={opening.rendering.language}>{opening.rendering.text}</p><button aria-expanded={showSource} onClick={() => setShowSource(!showSource)}>원문 {showSource ? "접기" : "다시 보기"}<ChevronDown size={16} /></button>{showSource && opening.source && <p className="opening-recall-source" lang={opening.source.language}>{opening.source.text}</p>}</div>}
          <p className="opening-prompt">단서를 하나씩 열고, 처음의 판단을 다시 이야기해 봅시다.</p>
          <div className="opening-clues">{opening.clues.map((clue, index) => {
            const visible = revealed.includes(index);
            return <section className={`opening-clue ${visible ? "is-revealed" : ""}`} key={clue.title}>
              <button aria-expanded={visible} onClick={() => setRevealed((current) => visible ? current.filter((item) => item !== index) : [...current, index])}><span className="opening-clue-number">0{index + 1}</span><span>{clue.title}</span><span className="opening-clue-action">{visible ? "접기" : "단서 열기"}<Eye size={18} /></span></button>
              {visible ? <div className="opening-clue-content"><p>{clue.fact}</p><p className="opening-clue-question">{clue.question}</p></div> : <p className="opening-clue-covered">아직 이야기하지 않은 맥락이 있습니다.</p>}
            </section>;
          })}</div>
          <div className="opening-invitation"><MessageCircle size={22} /><span>{revealed.length ? "판단이 달라졌나요? 그대로라면, 그 이유는 무엇인가요?" : "어떤 정보를 가장 먼저 알고 싶은가요?"}</span></div>
        </>}
        {step === 3 && <>
          <div className="opening-reason-line"><span>알게 된 사실</span><ArrowRight /><span>내가 고른 표현</span><ArrowRight /><span>그렇게 고른 이유</span></div>
          <p className="opening-prompt">“저는 ___라는 사실을 보고, ___라는 표현을 선택했습니다.”</p>
          <button className="opening-reveal-explanation" aria-expanded={explanation} onClick={() => setExplanation(!explanation)}>{explanation ? "정리 접기" : "의견을 들은 뒤, 연결해 보기"}<ChevronDown size={20} /></button>
          {explanation && <div className="opening-connections">{opening.connections.map((connection, index) => <section key={index}><p>{connection.observation}</p><ArrowRight aria-hidden="true" /><p>{connection.choice}</p></section>)}</div>}
          <section className="opening-goals"><p className="opening-label">이번 주, 이 판단을 어디에 쓸까요?</p>{opening.goals.map((goal, index) => <p key={index}>{goal}</p>)}<p className="opening-transfer">{opening.transfer}</p></section>
        </>}
      </main>
    </div>
    <footer className="opening-controls">
      <nav aria-label="도입 활동 단계">{STEPS.map((item, index) => <button key={item.label} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}><span>0{index + 1}</span><span>{item.label}</span></button>)}</nav>
      <div className="opening-move"><button className="opening-icon-button" aria-label="처음부터 다시 시작" onClick={() => { setStep(0); setRevealed([]); setVoice(null); setExplanation(false); setShowSource(false); }}><RotateCcw size={18} /></button><button className="opening-back" disabled={step === 0} onClick={() => move(-1)}><ArrowLeft size={18} /><span>이전</span></button><button className="opening-next" onClick={() => step === 3 ? onClose() : move(1)}>{step === 3 ? "이번 주 활동으로" : step === 0 ? "첫 생각 나누기" : step === 1 ? "단서 살펴보기" : "함께 정리하기"}<ArrowRight size={18} /></button></div>
    </footer>
  </Dialog.Content>;
});

export function WeeklyOpeningLesson({ opening, onStart }: { opening: WeeklyOpening; onStart?: () => void }) {
  const [open, setOpen] = useState(false);
  return <section className="opening-launcher" aria-label="주차 도입 수업">
    <div className="opening-launcher-copy"><p className="opening-label">수업의 첫 10–15분</p><h2>한 장면에서 시작하는 오늘의 수업</h2><p>{opening.contextLabel}</p><p className="opening-launcher-goal">학습 초점 · {opening.goals[0] ?? "주차 학습목표를 먼저 설정해 주세요."}</p></div>
    <div className="opening-launcher-action"><Dialog.Root open={open} onOpenChange={(next) => { if (next) onStart?.(); setOpen(next); }}>
      <Dialog.Trigger disabled={opening.status === "unavailable"} className="opening-launch-button"><Maximize2 size={18} />도입 수업 화면 열기<ArrowRight size={18} /></Dialog.Trigger>
      <Dialog.Portal><Dialog.Overlay className="opening-overlay" />{open && <OpeningSession opening={opening} onClose={() => setOpen(false)} />}</Dialog.Portal>
    </Dialog.Root><p>{opening.notice}</p></div>
  </section>;
}
