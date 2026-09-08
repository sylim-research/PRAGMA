import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Eye,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { PeerResponsesPanel } from "@/components/learner/PeerResponsesPanel";
import { InterpretingConsole } from "@/components/mission/InterpretingConsole";
import {
  CANONICAL_MISSION_PREVIEW,
  comparisonCandidateLabel,
  type BestWorstQuest,
  type ChoiceOption,
  type DctFeedbackQuest,
  type DctQuest,
  type FixChoiceQuest,
  type MissionContext,
  type MissionLessonPoint,
  type MissionQuest,
  type CanonicalMissionViewModel,
  type ReasonQuest,
  type ScaleQuest,
} from "@/lib/mission/canonicalMissionPreview";
import { fetchMissionByScenario, type RunnableMission } from "@/lib/mission/missionDb";
import {
  adaptRunnableMissionToCanonical,
  UnsupportedCanonicalMissionRuntimeError,
} from "@/lib/mission/canonicalMissionRuntime";
import { requestFeedback } from "@/lib/mission/missionFeedback";
import { saveMissionAttempt, type MpjResponseTrace, type SaveAttemptInput } from "@/lib/mission/missionLog";
import { learnerChoiceMapFromTraces } from "@/lib/mission/classResponsePatterns";
import {
  appendMissionEvent,
  getOrCreateMissionAttemptId,
  rotateMissionAttemptId,
  type MissionEventType,
} from "@/lib/mission/missionEvents";
import {
  parseMissionCourseLocation,
  type MissionCourseLocation,
} from "@/lib/mission/missionCourseContext";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import type { RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import { CONSENT_VERSION, POLICY_VERSION } from "@/lib/research/versions";
import LegacyMissionRun from "@/pages/learner/LegacyMissionRun";

/** 현재 승인된 MPJ5 + DCT1 학습 경험의 유일한 정본 실행기. */
const CanonicalMissionContext = createContext<CanonicalMissionViewModel>(CANONICAL_MISSION_PREVIEW);
const useCanonicalMission = () => useContext(CanonicalMissionContext);
const RuntimeMissionContext = createContext<RunnableMission | null>(null);
const useRuntimeMission = () => useContext(RuntimeMissionContext);

type QuestResponse = Record<string, unknown>;
type FeedbackLevel = "very_good" | "recommend" | "required";
type FeedbackCriterion = {
  key: "meaning" | "language" | "pragmatics";
  label: string;
  question: string;
  level: FeedbackLevel;
  body: string;
};
type DctEvaluation = {
  /** false면 자동 판정이 없으므로 수정 필요 여부를 추론하지 않는다. */
  available?: boolean;
  criteria: FeedbackCriterion[];
  headline: string;
  body: string;
  highlights: string[];
  feedback: string;
  action?: string;
  example: string;
  takeaway: string;
};
type DissentResponse = {
  conditions: string[];
  reason: string;
};
type DctResponse = {
  first: string;
  revised: string;
  reflected: boolean;
  evaluation?: DctEvaluation;
  runtimeFeedback?: RuntimeFeedback;
  dissent?: DissentResponse;
};
type DevPreviewPreset = "all_good" | "direct" | "over_mitigated" | "mixed";

const panel = "rounded-2xl border border-[#DDD8CB] bg-white";
const taskPanel = "rounded-2xl border-2 border-[#C9D0DA] bg-white shadow-[0_8px_24px_rgba(21,32,43,0.05)]";
const taskPanelBody = `${taskPanel} px-4 py-3 sm:px-5`;
const optionGrid = "mt-3 grid gap-1.5";
// break-keep — 없으면 한국어 낱말 중간에서 줄이 끊긴다(좁은 화면에서 특히).
// 비활성 상태를 옅게 — 기본 disabled 회색이 활성 버튼만큼 무거워 「지금 눌러야 할 것」이 흐려진다.
const actionButton = "w-full disabled:bg-[#E9E7E0] disabled:text-[#98A0AC] disabled:opacity-100";
const optionBase = "w-full rounded-xl border px-4 py-2 text-left text-[15px] break-keep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-1";

type SceneIntroSlide = {
  eyebrow: string;
  title: string;
  body?: string;
  action: string;
  tone: "navy" | "yellow" | "green";
};

type SceneIntroConfig = {
  missionLabel: string;
  previewOnly?: boolean;
  slides: readonly SceneIntroSlide[];
};

const MISSION_A_SCENE_INTRO: SceneIntroConfig = {
  missionLabel: "미션 1",
  slides: [
    {
      eyebrow: "01 · 오늘의 장면",
      title: "다음 주 화요일 면접에 참석하기 어려워, 아직 만난 적 없는 인턴십 담당자에게 같은 주 다른 날로 조정을 요청해야 합니다.",
      action: "장면 속 단서 보기",
      tone: "navy",
    },
    {
      eyebrow: "02 · 장면 속 단서",
      title: "그런데, 이런 조건이 있습니다",
      body: "아직 만난 적 없는 인턴십 담당자에게 처음 보내는 이메일이고, 이미 정해진 면접 일정의 변경을 요청합니다.",
      action: "내가 할 일 확인",
      tone: "yellow",
    },
    {
      eyebrow: "03 · 당신의 선택",
      title: "어떤 중국어 요청이 이 장면에 어울릴까요?",
      body: "먼저 다섯 장면의 번역안을 비교하며 판단 기준을 찾아봅니다. 그다음 이 장면으로 돌아와 직접 번역합니다.",
      action: "5개 장면으로 감 잡기",
      tone: "green",
    },
  ],
};

const MISSION_B_SCENE_INTRO: SceneIntroConfig = {
  missionLabel: "미션 2",
  previewOnly: true,
  slides: [
    {
      eyebrow: "01 · 새로운 장면",
      title: "같이 프로젝트를 하는 친한 동급생에게 오늘 저녁 온라인 회의를 30분 늦춰 달라고 요청해야 합니다.",
      action: "장면 속 단서 보기",
      tone: "navy",
    },
    {
      eyebrow: "02 · 새 장면의 단서",
      title: "이 장면에는 이런 조건이 있습니다",
      body: "이미 친한 동급생에게 메신저로 연락하며, 약속 자체를 바꾸는 대신 시작 시간을 30분 조정해 달라고 부탁합니다.",
      action: "이번 장면에서 할 일 확인",
      tone: "yellow",
    },
    {
      eyebrow: "03 · 이번 장면에서의 선택",
      title: "이번 장면에는 어떤 중국어 요청이 어울릴까요?",
      body: "이 장면의 상대와 채널, 부탁의 크기를 살펴보고 어울리는 표현을 선택합니다.",
      action: "도입 다시 보기",
      tone: "green",
    },
  ],
};

function buildSceneIntroConfig(mission: CanonicalMissionViewModel): SceneIntroConfig {
  if (!mission.scenarioId) return MISSION_A_SCENE_INTRO;

  const production = mission.quests.find((quest): quest is DctQuest => quest.kind === "dct");
  const context = production?.context ?? mission.quests[0]?.context;
  const situation = context?.situation ?? "이번 미션의 상황을 확인하고 알맞은 표현을 선택합니다.";
  const contextFacts = context
    ? [
        `상대·관계는 ${context.relation}입니다.`,
        `채널은 ${context.channel}이고, 부담은 ${context.pdr.r}입니다.`,
      ].join(" ")
    : "상대와 관계, 채널, 부탁의 크기를 차례로 확인합니다.";
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";

  return {
    missionLabel: mission.metaLabel ?? "이번 미션",
    slides: [
      {
        eyebrow: "01 · 오늘의 장면",
        title: situation,
        action: "장면 속 단서 보기",
        tone: "navy",
      },
      {
        eyebrow: "02 · 장면 속 단서",
        title: "그런데, 이런 조건이 있습니다",
        body: contextFacts,
        action: "내가 할 일 확인",
        tone: "yellow",
      },
      {
        eyebrow: "03 · 당신의 선택",
        title: `어떤 ${mission.targetLanguage.label} ${mission.speechAct} 표현이 이 장면에 어울릴까요?`,
        body: `먼저 다섯 장면의 ${outputName}안을 비교하며 판단 기준을 찾아봅니다. 그다음 이 장면으로 돌아와 직접 ${outputName}합니다.`,
        action: "5개 장면으로 감 잡기",
        tone: "green",
      },
    ],
  };
}

const SCENE_INTRO_STEP_IDS = ["scene-1", "scene-2", "scene-3"] as const;

function shuffle<T>(values: readonly T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function normalize(value: string) {
  return value.normalize("NFKC").replace(/[\p{P}\p{S}\p{Z}\s]+/gu, "").toLowerCase();
}

type DraftValidation = {
  valid: boolean;
  hint?: string;
};

function validateDraft(value: string, targetLanguage = "중국어", outputName = "번역"): DraftValidation {
  const compact = normalize(value);
  if (compact.length === 0 || compact.startsWith(normalize(`${targetLanguage} ${outputName}`))) {
    return { valid: false, hint: `${targetLanguage} ${outputName}안을 작성해 주세요.` };
  }
  if (targetLanguage === "한국어") {
    const hangulCount = value.match(/\p{Script=Hangul}/gu)?.length ?? 0;
    if (hangulCount === 0) return { valid: false, hint: "한국어 문장으로 작성해 주세요." };
    if (hangulCount < 4) return { valid: false, hint: "조금 더 완전한 한국어 문장으로 작성해 주세요." };
    return { valid: true };
  }
  const hanCount = value.match(/\p{Script=Han}/gu)?.length ?? 0;
  if (hanCount === 0) {
    return { valid: false, hint: "중국어 문장으로 작성해 주세요." };
  }
  if (hanCount < 4) {
    return { valid: false, hint: "조금 더 완전한 중국어 문장으로 작성해 주세요." };
  }
  return { valid: true };
}

function isMeaningfulDraft(value: string, targetLanguage = "중국어", outputName = "번역") {
  return validateDraft(value, targetLanguage, outputName).valid;
}

const NEXT_ACTION_LABEL: Record<string, string> = {
  A1: "다음: 상황에 맞는지 판단하기",
  A2: "다음: 판단하고 고쳐 보기",
  A3: "다음: 부적절한 이유 찾기",
  A4: "다음: BEST·WORST 고르기",
};

function nextActionLabel(quest: MissionQuest) {
  return NEXT_ACTION_LABEL[quest.id] ?? "다음 문항으로";
}

function ActionBar({ hint, children }: { hint?: string; children: React.ReactNode }) {
  return (
    // 일반 문서 흐름에 둔다 — 하단에 고정하면 첫 화면부터 뷰포트 바닥을 가려, 자료를 읽기 전에 판단을 요구하게 된다.
    <div className="mt-3 rounded-2xl border border-[#D8D4C8] bg-white p-2.5 shadow-[0_2px_10px_rgba(21,32,43,0.05)]">
      {hint && <p className="mb-2 break-keep px-2 text-xs font-bold text-[#647084]" aria-live="polite">{hint}</p>}
      {children}
    </div>
  );
}

function SceneIntroFlow({ config, step, onNext, onPrevious, onSelect }: {
  config: SceneIntroConfig;
  step: number;
  onNext: () => void;
  onPrevious: () => void;
  onSelect: (step: number) => void;
}) {
  const slide = config.slides[step];
  const isLast = step === config.slides.length - 1;
  const toneClass = slide.tone === "navy"
    ? "bg-[#1B2733] text-[#F7F3E8]"
    : slide.tone === "yellow"
      ? "bg-[#F5C842] text-[#15202B]"
      : "bg-[#E8EFE7] text-[#15202B]";
  const ghostClass = slide.tone === "navy"
    ? "text-white/[0.045]"
    : slide.tone === "yellow"
      ? "text-[#15202B]/[0.055]"
      : "text-[#2E6C58]/[0.06]";
  const eyebrowClass = slide.tone === "navy"
    ? "text-[#F5C842]"
    : slide.tone === "yellow"
      ? "text-[#6B5500]"
      : "text-[#2E6C58]";

  return (
    <div className="mx-auto w-full max-w-[720px] pt-1">
      <section
        className="rounded-[28px] border border-[#DED8C8] bg-[#F9F6EC] p-2.5 shadow-[0_18px_48px_rgba(21,32,43,0.13)] sm:p-3"
        aria-label={`${config.missionLabel} 장면 도입 ${step + 1}/${config.slides.length}`}
      >
        <div
          key={step}
          className={`relative flex min-h-[320px] flex-col overflow-hidden rounded-[21px] px-6 py-6 sm:min-h-[350px] sm:px-9 sm:py-8 ${toneClass}`}
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -right-2 -top-10 select-none text-[136px] font-black leading-none tracking-[-0.08em] sm:text-[170px] ${ghostClass}`}
          >
            0{step + 1}
          </span>

          <div className="relative z-10 flex h-full flex-1 flex-col">
            <p className={`text-[11px] font-bold tracking-[0.16em] ${eyebrowClass}`}>
              {slide.eyebrow}
            </p>

            {slide.tone === "navy" ? (
              <h1
                style={{ textWrap: "balance" }}
                className="mt-auto max-w-[590px] break-keep pb-1 text-[21px] font-semibold leading-[1.42] tracking-[-0.03em] text-[#F7F3E8] sm:text-[24px]"
              >
                {slide.title}
              </h1>
            ) : (
              <div className="my-auto max-w-[590px]">
                <h1
                  style={{ textWrap: "balance" }}
                  className={`break-keep font-bold leading-[1.35] tracking-[-0.03em] text-[#15202B] ${slide.tone === "green" ? "text-[25px] sm:text-[31px]" : "text-[22px] sm:text-[27px]"}`}
                >
                  {slide.title}
                </h1>
                {slide.body && (
                  <p className={`mt-5 max-w-[570px] break-keep font-medium tracking-[-0.012em] ${slide.tone === "green" ? "text-[14px] leading-[1.7] text-[#53615A] sm:text-[15px]" : "text-[15px] leading-[1.75] text-[#3E3A2D] sm:text-[16px]"}`}>
                    {slide.body}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-[58px] items-center justify-between gap-3 px-2 pt-2.5 sm:px-3">
          <div className="flex items-center gap-2" aria-label={`카드 ${step + 1} / ${config.slides.length}`}>
            {config.slides.map((item, index) => (
              <button
                key={item.eyebrow}
                type="button"
                aria-label={`${index + 1}번 카드 보기`}
                aria-current={step === index ? "step" : undefined}
                onClick={() => onSelect(index)}
                className={`h-2 rounded-full transition-all ${step === index ? "w-7 bg-[#15202B]" : "w-2 bg-[#C9C1AD] hover:bg-[#8F8776]"}`}
              />
            ))}
            <span className="ml-1 hidden text-[11px] font-semibold tabular-nums text-[#777063] sm:inline">
              {step + 1} / {config.slides.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                type="button"
                aria-label="이전 카드"
                onClick={onPrevious}
                className="whitespace-nowrap rounded-full px-2.5 py-2 text-[12px] font-semibold text-[#6D675C] hover:bg-[#EEE9DC] hover:text-[#15202B] sm:px-3 sm:text-[12.5px]"
              >
                <span aria-hidden="true" className="sm:hidden">←</span>
                <span className="hidden sm:inline">이전</span>
              </button>
            )}
            <Button
              type="button"
              onClick={onNext}
              className={`h-auto whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-semibold tracking-[-0.015em] shadow-none transition-transform hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none sm:px-6 sm:text-[13.5px] ${slide.tone === "navy" ? "bg-[#F5C842] text-[#15202B] hover:bg-[#FCE07A]" : "bg-[#15202B] text-white hover:bg-[#273849]"}`}
            >
              {slide.action} <span aria-hidden="true">→</span>
            </Button>
          </div>
        </div>
        {isLast && (
          <span className="sr-only">
            {config.previewOnly ? "미션 2 장면 도입 검토용 화면입니다." : "다음 화면부터 표현 판단 1/5가 시작됩니다."}
          </span>
        )}
      </section>
    </div>
  );
}

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, highlights = [], target = false }: {
  text: string;
  highlights?: string[];
  target?: boolean;
}) {
  if (highlights.length === 0) return <>{text}</>;
  const ordered = [...highlights].sort((a, b) => b.length - a.length);
  const expression = new RegExp(`(${ordered.map(escaped).join("|")})`, "g");
  const highlightSet = new Set(highlights);
  return (
    <>
      {text.split(expression).map((part, index) => {
        if (!highlightSet.has(part)) return <span key={`${part}-${index}`}>{part}</span>;
        const highlightClass = target
          ? part.trim().length >= text.trim().length * 0.7
            ? "bg-transparent font-normal text-inherit underline decoration-[#C9A90E] decoration-2 underline-offset-4"
            : "rounded-sm bg-[#FFF5C8] px-0.5 font-normal text-inherit underline decoration-[#C9A90E] decoration-2 underline-offset-4"
          : "bg-transparent font-normal text-inherit underline decoration-[#E8C62F] decoration-2 underline-offset-4";
        const chineseFont = /\p{Script=Han}/u.test(part) ? "font-zh" : "";
        return <mark key={`${part}-${index}`} className={`${highlightClass} ${chineseFont}`}>{part}</mark>;
      })}
    </>
  );
}

function RichLine({ text, highlights = [] }: { text: string; highlights?: string[] }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, index) => part.startsWith("`") && part.endsWith("`") ? (
        <span key={index} className="font-zh rounded bg-white/75 px-1.5 py-0.5 font-semibold text-[#183E2E]">
          <HighlightedText text={part.slice(1, -1)} highlights={highlights} target />
        </span>
      ) : <span key={index}><HighlightedText text={part} highlights={highlights} target /></span>)}
    </>
  );
}

function SentenceLines({ text, highlights = [] }: { text: string; highlights?: string[] }) {
  const lines = text.split(/\n|(?<=[.!?。！？])\s+/).filter(Boolean);
  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => <p key={`${line}-${index}`}><RichLine text={line} highlights={highlights} /></p>)}
    </div>
  );
}

function ContextCard({ context, headerRight }: {
  context: MissionContext;
  headerRight?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E2DED4] bg-[#F4F2EC] px-4 py-3 sm:px-5">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <p className="text-xs font-bold text-[#5D6980]">상황</p>
        {headerRight}
      </div>
      <h2 className="mt-1.5 break-keep text-[17px] font-bold leading-7 text-[#101B2B]">
        {context.situation}
      </h2>
      {context.precedingTurn && (
        <div className="mt-3 rounded-xl border-l-4 border-[#F0D34F] bg-[#F7F5EF] px-4 py-2.5">
          <p className="text-[11px] font-bold text-[#697386]">상대의 말</p>
          <p className="mt-1 break-keep text-[15px] leading-6">{context.precedingTurn}</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[
          ["P", context.pdr.p],
          ["D", context.pdr.d],
          ["R", context.pdr.r],
        ].map(([label, value]) => (
          <span key={label} className="rounded-full border border-[#D3D8E1] bg-white px-2.5 py-1 text-xs font-bold text-[#4D5A70]">
            {label} · {value}
          </span>
        ))}
      </div>
    </section>
  );
}

function LanguagePair({ source, target, targetHighlights = [] }: {
  source: string;
  target?: string;
  targetHighlights?: string[];
}) {
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역안" : "번역안";
  const sourceFont = mission.sourceLanguage.code === "zh" ? "font-zh" : "";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  return (
    <section className="overflow-hidden rounded-2xl border border-[#C9D0DA] bg-white shadow-sm">
      <div className="flex items-start gap-4 bg-[#FBF8EE] px-4 py-3 sm:px-5">
        <span className="mt-0.5 inline-flex h-9 min-w-12 shrink-0 items-center justify-center rounded-lg border border-[#E4CB50] bg-[#FFF7D1] px-3 text-sm font-black text-[#142033]">{mission.sourceLanguage.badge}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-[#697386]">원문</p>
          <p className={`${sourceFont} mt-0.5 break-keep text-[17px] font-normal leading-8 text-[#101B2B]`}>{source}</p>
        </div>
      </div>
      {target && (
        <div className="flex items-start gap-4 border-t border-dashed border-[#D8D4C8] px-4 py-3 sm:px-5">
          <span className="mt-0.5 inline-flex h-9 min-w-12 shrink-0 items-center justify-center rounded-lg bg-[#15202B] px-3 text-sm font-black text-white">{mission.targetLanguage.badge}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[#697386]">{mission.targetLanguage.label} {outputName}</p>
            <p className={`${targetFont} mt-0.5 text-[16.5px] font-normal leading-8 text-[#101B2B]`}>
              <HighlightedText text={target} highlights={targetHighlights} target />
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function optionState(answered: boolean, picked: boolean, correct: boolean) {
  if (!answered) {
    return picked
      ? "border-[#15202B] bg-[#F8F7F2] font-bold text-[#15202B] ring-1 ring-[#15202B]"
      : "border-[#D8D4C8] bg-white hover:bg-[#FAF8F2]";
  }
  if (correct) return "border-[#4D8568] bg-white text-[#245E44]";
  if (picked) return "border-[#C86E68] bg-[#FFF3F1] font-bold text-[#8B3531]";
  return "border-[#E0DDD5] bg-[#FAF9F6] text-[#8A92A0]";
}

function OptionButton({ option, value, disabled, answered = false, acceptedIds = [], radio = false, onSelect }: {
  option: ChoiceOption;
  value: string | null;
  disabled?: boolean;
  answered?: boolean;
  acceptedIds?: string[];
  radio?: boolean;
  onSelect: (id: string) => void;
}) {
  const picked = value === option.id;
  const accepted = acceptedIds.includes(option.id);
  return (
    <button
      type="button"
      role={radio ? "radio" : undefined}
      aria-checked={radio ? picked : undefined}
      disabled={disabled}
      onClick={() => onSelect(option.id)}
      className={`${optionBase} ${optionState(answered, picked, accepted)} disabled:cursor-default`}
    >
      <span className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="flex min-w-0 flex-col items-start">
          <span>{option.label}</span>
          {option.description && <span className="mt-0.5 text-left text-xs font-normal leading-5 opacity-70">{option.description}</span>}
        </span>
        {answered && (
          <span className="flex shrink-0 flex-wrap items-center gap-1.5">
            {picked && <span className={`inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-black ${accepted ? "border-[#15202B] text-[#15202B]" : "border-[#C86E68] text-[#8B3531]"}`}>{accepted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}내 선택</span>}
            {accepted && <span className="inline-flex items-center gap-1 rounded-full border border-[#80AB94] bg-white px-2 py-0.5 text-[10px] font-black text-[#245E44]"><Check className="h-3 w-3" />권장 답안</span>}
          </span>
        )}
      </span>
    </button>
  );
}

function FeedbackBox({ verdict, feedback, action, highlights = [] }: {
  verdict?: string;
  feedback: string;
  action?: string;
  highlights?: string[];
}) {
  return (
    <div className="break-keep rounded-xl border border-[#DDD8CB] border-l-4 border-l-[#E0C43C] bg-[#FAF9F5] px-4 py-3.5 text-[14px] leading-7 text-[#3F4A59]">
      {verdict && <p className="mb-2 font-black text-[#4A5568]">{verdict}</p>}
      <SentenceLines text={feedback} highlights={highlights} />
      {action && (
        <div className="mt-3 rounded-lg border border-[#E5E1D8] bg-white px-3 py-2.5 font-semibold text-[#3F4A59]">
          <RichLine text={action} highlights={highlights} />
        </div>
      )}
    </div>
  );
}

const DISSENT_CONDITIONS = [
  { code: "relationship", label: "관계·친밀도에 대한 다른 판단" },
  { code: "burden", label: "행위의 부담 크기에 대한 다른 판단" },
  { code: "preceding", label: "앞선 대화 흐름을 더 고려함" },
  { code: "experience", label: "실제 사용 경험과 차이가 있음" },
] as const;

export function MissionDissentPanel({ onSubmit }: { onSubmit: (dissent: DissentResponse) => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-xl border border-[#CFE4D8] bg-[#F2FAF6] px-4 py-3 text-[12.5px] leading-5 text-[#2E7D5B]">
        이의 제기를 남겼습니다. AI 참고 판정과 나의 판단을 함께 수행 기록에 저장합니다.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-[#B9C4CE] bg-white px-4 py-3 text-left text-[12.5px] text-[#3B4A57] transition hover:bg-[#F7F9FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
      >
        AI 참고 판정과 다르게 본 부분이 있다면 <b>이의 제기하기 →</b>
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-[#B9C4CE] bg-white px-4 py-4" aria-labelledby="mission-dissent-heading">
      <h3 id="mission-dissent-heading" className="text-sm font-black">AI 참고 판정에 대한 이의 제기</h3>
      <p className="mt-1 break-keep text-xs leading-5 text-[#687387]">AI 참고 판정은 그대로 보존됩니다. 다르게 판단한 조건이나 이유를 남기면 최종안을 유지하거나 수정할 때 함께 기록됩니다.</p>
      <div className="mt-3 grid gap-2">
        {DISSENT_CONDITIONS.map((condition) => {
          const selected = picked.includes(condition.code);
          return (
            <button
              key={condition.code}
              type="button"
              aria-pressed={selected}
              onClick={() => setPicked((current) => selected ? current.filter((code) => code !== condition.code) : [...current, condition.code])}
              className={`rounded-lg border px-3 py-2 text-left text-[12.5px] transition ${selected ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#E4E0D7] bg-white text-[#3B4A57] hover:bg-[#F7F9FA]"}`}
            >
              {condition.label}
            </button>
          );
        })}
      </div>
      <Textarea className="mt-3 text-[12.5px]" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="한 줄 이유 (선택)" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          disabled={picked.length === 0 && !reason.trim()}
          onClick={() => {
            onSubmit({ conditions: picked, reason: reason.trim() });
            setSent(true);
          }}
          >
            이의 제기 남기기
          </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>닫기</Button>
      </div>
    </section>
  );
}

function ScaleView({ quest, onDone, devAutofill = false, revealAnswers = false }: { quest: ScaleQuest; onDone: (response: QuestResponse) => void; devAutofill?: boolean; revealAnswers?: boolean }) {
  const [pick, setPick] = useState<string | null>(() => devAutofill || revealAnswers ? quest.referenceAnswer : null);
  const [answered, setAnswered] = useState(revealAnswers);
  const acceptedIds = quest.acceptedAnswers ?? [quest.referenceAnswer];
  const acceptedLabel = quest.options
    .filter((option) => acceptedIds.includes(option.id))
    .map((option) => option.label)
    .join(" ~ ");
  return (
    <QuestScaffold quest={quest} target={quest.target} targetHighlights={answered ? quest.targetHighlights : undefined}>
      <section className={taskPanelBody}>
        <p className="mb-1 text-[11px] font-black text-[#6B7280]">지금 할 일</p>
        <h3 className="text-base font-bold">{quest.prompt}</h3>
        <div className={optionGrid}>
          {quest.options.map((option) => (
            <OptionButton key={option.id} option={option} value={pick} disabled={answered} answered={answered} acceptedIds={acceptedIds} onSelect={setPick} />
          ))}
        </div>
        {answered && <div className="mt-4"><FeedbackBox verdict={`권장 답안 · 이 상황에서는 ${acceptedLabel}`} feedback={quest.feedback} highlights={quest.targetHighlights} /></div>}
      </section>
      <ActionBar hint={!answered && !pick ? "가장 알맞은 답을 하나 선택해 주세요." : undefined}>
        {!answered ? (
          <Button className={`h-11 ${actionButton}`} disabled={!pick} onClick={() => setAnswered(true)}>{pick ? "답안 확인하기" : "답을 선택해 주세요"}</Button>
        ) : (
          <Button className="h-12 w-full" onClick={() => onDone({ pick })}>{nextActionLabel(quest)} <ChevronRight className="ml-1 h-4 w-4" /></Button>
        )}
      </ActionBar>
    </QuestScaffold>
  );
}

function FixChoiceView({ quest, responses, onDone, devAutofill = false, revealAnswers = false }: {
  quest: FixChoiceQuest;
  responses: Record<string, QuestResponse | DctResponse>;
  onDone: (response: QuestResponse) => void;
  devAutofill?: boolean;
  revealAnswers?: boolean;
}) {
  const mission = useCanonicalMission();
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  const linkedJudgment = quest.judgmentQuestId
    ? (responses[quest.judgmentQuestId] as QuestResponse | undefined)?.pick as string | undefined
    : undefined;
  const [judgment, setJudgment] = useState<string | null>(() => revealAnswers ? quest.referenceJudgment : linkedJudgment ?? (devAutofill ? quest.referenceJudgment : null));
  const [locked, setLocked] = useState(Boolean(linkedJudgment) || devAutofill || revealAnswers);
  const [correctionId, setCorrectionId] = useState<string | null>(() => devAutofill || revealAnswers
    ? (quest.corrections.find((option) => option.valid)?.id ?? null)
    : null
  );
  const [answered, setAnswered] = useState(revealAnswers);
  const order = useMemo(() => shuffle(quest.corrections), [quest.corrections]);
  const referenceLabel = quest.judgmentOptions.find((option) => option.id === quest.referenceJudgment)?.label;
  const judgmentLabel = quest.judgmentOptions.find((option) => option.id === judgment)?.label;
  const judgmentMatched = judgment === quest.referenceJudgment;
  return (
    <QuestScaffold quest={quest} target={quest.target} targetHighlights={answered ? quest.targetHighlights : undefined}>
      <section className={taskPanelBody}>
        <p className="mb-1 text-[11px] font-black text-[#6B7280]">지금 할 일</p>
        <h3 className="text-base font-bold">{quest.prompt}</h3>
        <div className={optionGrid}>
          {quest.judgmentOptions.map((option) => (
            <OptionButton key={option.id} option={option} value={judgment} disabled={locked} answered={locked} acceptedIds={[quest.referenceJudgment]} onSelect={setJudgment} />
          ))}
        </div>
        {locked && (
          <div className="mt-5 border-t border-[#E4E0D5] pt-4">
            <div className={`rounded-xl border px-4 py-3 text-sm leading-6 ${judgmentMatched ? "border-[#BFD9CC] bg-[#F2F8F4] text-[#245E44]" : "border-[#E2AAA5] bg-[#FFF3F1] text-[#713E3A]"}`}>
              <p className="flex items-center gap-2 font-black">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${judgmentMatched ? "bg-[#DCEFE4] text-[#245E44]" : "bg-[#F4D8D5] text-[#8B3531]"}`}>
                  {judgmentMatched ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
                </span>
                {judgmentMatched ? "권장 답안과 같아요" : "권장 답안과 달라요"}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                <span className="mt-2 rounded-full border border-current bg-white px-2 py-0.5">내 답안 · {judgmentLabel}</span>
                <span className="mt-2 rounded-full border border-[#80AB94] bg-white px-2 py-0.5 text-[#245E44]">권장 답안 · {referenceLabel}</span>
              </div>
              <p className="mt-2 break-keep">
                {judgmentMatched
                  ? "이 장면을 읽은 방향이 같습니다. 이제 같은 뜻을 더 자연스럽게 옮긴 안을 찾아보세요."
                  : "관계와 채널 단서를 다시 보고 수정안을 골라보세요."}
              </p>
            </div>
            <div className="mt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-bold">가장 알맞게 고친 표현은 무엇일까요?</h4>
                <span className={`text-xs font-black ${correctionId ? "text-[#245E44]" : "text-[#687387]"}`} aria-live="polite">{correctionId ? "1개 선택됨 · 확인할 수 있어요" : "1개를 선택하세요"}</span>
              </div>
              <div className={optionGrid}>
                {order.map((correction) => {
                  const picked = correctionId === correction.id;
                  const state = answered
                    ? correction.valid
                      ? "border-[#4D8568] bg-white text-[#245E44]"
                      : picked
                        ? "border-[#15202B] bg-[#F3F4F5] text-[#15202B]"
                        : "border-[#E0DDD5] bg-[#FAF9F6] text-[#8A92A0]"
                    : picked
                      ? "border-[#15202B] bg-[#F8F7F2] text-[#15202B] ring-1 ring-[#15202B]"
                      : "border-[#D8D4C8] bg-white";
                  return (
                    <button key={correction.id} type="button" disabled={answered} aria-pressed={picked} onClick={() => setCorrectionId(correction.id)} className={`${optionBase} min-w-0 [overflow-wrap:anywhere] ${state} disabled:cursor-default`}>
                      <span className="flex flex-col items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-3">
                        <span className={`${targetFont} min-w-0 max-w-full break-normal text-[16.5px] font-normal leading-7`}>{correction.text}</span>
                        {answered && (
                          <span className="flex max-w-full flex-wrap gap-1.5 sm:shrink-0 sm:justify-end">
                            {picked && <span className="rounded-full border border-[#15202B] bg-white px-2 py-0.5 text-[10px] font-black text-[#15202B]">내 선택</span>}
                            {correction.valid && <span className="rounded-full border border-[#80AB94] bg-white px-2 py-0.5 text-[10px] font-black text-[#245E44]">권장 수정안</span>}
                          </span>
                        )}
                      </span>
                      {answered && <span className="mt-1 block break-keep text-xs font-normal leading-5">{correction.note}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {answered && <div className="mt-4"><FeedbackBox verdict={`권장 답안 · 이 상황에서는 ${referenceLabel}`} feedback={quest.feedback} highlights={quest.targetHighlights} /></div>}
      </section>
      <ActionBar hint={!locked && !judgment ? "이 상황에서의 적절성을 먼저 판단해 주세요." : locked && !answered && !correctionId ? "가장 알맞은 교정안 하나를 선택해 주세요." : undefined}>
        {!locked ? (
          <Button className={`h-12 ${actionButton}`} disabled={!judgment} onClick={() => setLocked(true)}>{judgment ? "판단 확인하기" : "답을 선택해 주세요"}</Button>
        ) : !answered ? (
          <Button className={`h-12 ${actionButton}`} disabled={!correctionId} onClick={() => setAnswered(true)}>교정안 확인하기</Button>
        ) : (
          <Button className="h-12 w-full" onClick={() => onDone({ judgment, correctionIds: correctionId ? [correctionId] : [] })}>{nextActionLabel(quest)} <ChevronRight className="ml-1 h-4 w-4" /></Button>
        )}
      </ActionBar>
    </QuestScaffold>
  );
}

export function ReasonView({ quest, onDone, devAutofill = false, revealAnswers = false }: { quest: ReasonQuest; onDone: (response: QuestResponse) => void; devAutofill?: boolean; revealAnswers?: boolean }) {
  const acceptedReasonIds = quest.acceptedReasonIds ?? [quest.acceptedReasonId];
  const [reasonId, setReasonId] = useState<string | null>(() => devAutofill || revealAnswers ? quest.acceptedReasonId : null);
  const [answered, setAnswered] = useState(revealAnswers);
  const reasonOrder = useMemo(() => shuffle(quest.reasons), [quest.reasons]);
  const selectedReason = quest.reasons.find((reason) => reason.id === reasonId);
  const acceptedReason = quest.reasons.find((reason) => acceptedReasonIds.includes(reason.id));
  const reasonAccepted = reasonId ? acceptedReasonIds.includes(reasonId) : false;
  const reasonFeedback = reasonAccepted
    ? {
        verdict: "핵심 이유를 찾았어요",
        intro: "이 상황에서 표현이 어색해지는 핵심 원인을 찾았습니다.",
        action: "다음 문항에서도 상황 단서와 표현의 기능을 연결해 보세요.",
      }
    : {
        verdict: "핵심 이유를 다시 확인해요",
        intro: "선택한 이유보다 이 상황의 관계·거리·부담을 더 직접 설명하는 이유가 있습니다.",
        action: selectedReason ? `내가 고른 이유 · ${selectedReason.text}` : undefined,
      };
  return (
    <QuestScaffold quest={quest} target={quest.target} targetHighlights={answered ? quest.targetHighlights : undefined}>
      <section className={taskPanelBody}>
        <p className="mb-1 text-[11px] font-black text-[#6B7280]">지금 할 일</p>
        <h3 className="text-base font-bold">이 표현이 상황에 맞지 않는 가장 큰 이유는 무엇일까요?</h3>
            <div role="radiogroup" aria-label="가장 큰 이유 하나" className={optionGrid}>
              {reasonOrder.map((reason) => (
                <OptionButton
                  key={reason.id}
                  option={{ id: reason.id, label: reason.text }}
                  value={reasonId}
                  disabled={answered}
                  answered={answered}
                  acceptedIds={acceptedReasonIds}
                  radio
                  onSelect={setReasonId}
                />
              ))}
            </div>
            {!answered && <p className="mt-2 break-keep text-xs leading-5 text-[#687387]">세 이유 중 이 상황의 화용적 부적절성을 가장 잘 설명하는 하나를 고르세요.</p>}
        {answered && acceptedReason && (
          <div className="mt-4">
            <FeedbackBox
              verdict={reasonFeedback.verdict}
              feedback={`${reasonFeedback.intro} 핵심 이유는 “${acceptedReason.text}”입니다. ${quest.feedback}`}
              action={reasonFeedback.action}
              highlights={quest.targetHighlights}
            />
          </div>
        )}
      </section>
      <ActionBar hint={!answered && !reasonId ? "가장 큰 이유 하나를 선택해 주세요." : undefined}>
        {!answered ? (
          <Button className={`h-12 ${actionButton}`} disabled={!reasonId} onClick={() => setAnswered(true)}>이유 확인하기</Button>
        ) : (
          <Button
            className="h-12 w-full"
            onClick={() => {
              if (reasonId) onDone({ reasonId });
            }}
          >
            {nextActionLabel(quest)} <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </ActionBar>
    </QuestScaffold>
  );
}

function BestWorstView({ quest, onDone, devAutofill = false, revealAnswers = false }: { quest: BestWorstQuest; onDone: (response: QuestResponse) => void; devAutofill?: boolean; revealAnswers?: boolean }) {
  const mission = useCanonicalMission();
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  const [best, setBest] = useState<string | null>(() => devAutofill || revealAnswers ? quest.bestId : null);
  const [worst, setWorst] = useState<string | null>(() => devAutofill || revealAnswers ? quest.worstId : null);
  const [answered, setAnswered] = useState(revealAnswers);
  const order = useMemo(() => shuffle(quest.candidates), [quest.candidates]);
  return (
    <QuestScaffold quest={quest}>
      <section className={taskPanelBody}>
        <p className="mb-1 text-[11px] font-black text-[#6B7280]">지금 할 일</p>
        <h3 className="text-base font-bold">{quest.prompt}</h3>
        {!answered && (
          <p className="mt-2 text-xs font-black text-[#687387]" aria-live="polite">
            {best && worst ? "두 표현 선택 완료 · 확인할 수 있어요" : best ? "BEST 선택 완료 · WORST를 골라주세요" : worst ? "WORST 선택 완료 · BEST를 골라주세요" : "BEST와 WORST를 하나씩 골라주세요"}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <span className="inline-flex h-8 min-w-11 items-center justify-center rounded-lg bg-[#15202B] px-2.5 text-xs font-black text-white">{mission.targetLanguage.badge}</span>
          <span className="text-sm font-bold text-[#5D6980]">산출 후보</span>
        </div>
        <div className="mt-2 grid gap-2">
          {order.map((candidate) => {
            const bestPicked = best === candidate.id;
            const worstPicked = worst === candidate.id;
            const role = comparisonCandidateLabel(quest, candidate.role);
            const isBestRole = candidate.role === "best";
            const isWorstRole = candidate.role === "worst";
            const answeredStyle = isBestRole
              ? "border-[#4D8568] bg-[#EEF7F2]"
              : isWorstRole
                ? "border-[#B96B67] bg-[#FFF1EF]"
                : "border-[#D8D4C8] bg-[#FAF9F6]";
            return (
              <div key={candidate.id} className={`rounded-xl border px-4 py-2 ${answered ? answeredStyle : "border-[#D8D4C8] bg-white"}`}>
                {answered ? (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_max-content] sm:items-start sm:gap-4">
                    <div className="min-w-0">
                      <p className={`${targetFont} text-[17px] leading-7`}>{candidate.text}</p>
                      <p className="mt-1 break-keep text-[13px] leading-5 text-[#536075]">{candidate.note}</p>
                    </div>
                    <div className="flex flex-nowrap gap-1.5 whitespace-nowrap sm:justify-end">
                      <span className={`rounded px-2 py-1 text-[11px] font-black ${isBestRole ? "bg-[#DCEFE4] text-[#245E44]" : isWorstRole ? "bg-[#F4D8D5] text-[#8B3531]" : "bg-[#EEECE6]"}`}>{role}</span>
                      {bestPicked && <span className="rounded bg-[#15202B] px-2 py-1 text-[11px] font-black text-white">내 BEST</span>}
                      {worstPicked && <span className="rounded bg-[#15202B] px-2 py-1 text-[11px] font-black text-white">내 WORST</span>}
                    </div>
                  </div>
                ) : (
                  // 좁은 화면에서는 후보 문장이 3~4자마다 끊기지 않도록 버튼을 아래로 내린다.
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <p className={`${targetFont} min-w-0 text-[17px] leading-7`}>{candidate.text}</p>
                    <div className="flex shrink-0 gap-2">
                    <button type="button" disabled={worstPicked} onClick={() => setBest(candidate.id)} className={`h-9 flex-1 rounded-lg border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-1 disabled:opacity-50 sm:flex-none ${bestPicked ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#D8D4C8] hover:bg-[#F8F7F2]"}`}>BEST</button>
                    <button type="button" disabled={bestPicked} onClick={() => setWorst(candidate.id)} className={`h-9 flex-1 rounded-lg border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-1 disabled:opacity-50 sm:flex-none ${worstPicked ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#D8D4C8] hover:bg-[#F8F7F2]"}`}>WORST</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <ActionBar hint={!answered ? (best && worst ? "두 표현 선택 완료 · 확인할 수 있어요" : best ? "BEST 선택 완료 · WORST를 골라주세요" : worst ? "WORST 선택 완료 · BEST를 골라주세요" : "BEST와 WORST를 하나씩 골라주세요") : undefined}>
        {!answered ? (
          <Button className={`h-12 ${actionButton}`} disabled={!best || !worst || best === worst} onClick={() => setAnswered(true)}>두 표현 확인하기</Button>
        ) : (
          <Button className="h-12 w-full" onClick={() => onDone({ best, worst })}>다음: 직접 산출 <ChevronRight className="ml-1 h-4 w-4" /></Button>
        )}
      </ActionBar>
    </QuestScaffold>
  );
}

function hasMitigation(text: string) {
  return /能否|能不能|可以|方便|麻烦|请问|是否|好吗|吗/.test(text);
}

function isOverMitigated(text: string) {
  const matches = text.match(/方便|麻烦|抱歉|不好意思|打扰|添麻烦|不知/g) ?? [];
  return matches.length >= 3 || text.length > 72;
}

function VocabularyHints({ quest }: { quest: DctQuest }) {
  const mission = useCanonicalMission();
  const supportLevel = mission.supportLevel;
  if (supportLevel === "advanced" || quest.vocabularyHints.length === 0) return null;
  const chips = (
    <div className="flex flex-wrap gap-2">
      {quest.vocabularyHints.map((hint) => (
        <span key={hint.source} className="rounded-full border border-[#D8D4C8] bg-[#FAF8F2] px-3 py-1.5 text-xs">
          <b>{hint.source}</b> · <span className={mission.targetLanguage.code === "zh" ? "font-zh" : ""}>{hint.target}</span>
        </span>
      ))}
    </div>
  );
  if (supportLevel === "beginner") return <div className="mt-3">{chips}</div>;
  return (
    <details className="mt-3 rounded-lg border border-dashed border-[#D8D4C8] bg-[#FCFBF7] px-3 py-2.5">
      <summary className="cursor-pointer text-xs font-bold text-[#5D6980]">단어 힌트 보기</summary>
      <div className="mt-3">{chips}</div>
    </details>
  );
}

function sourceAlignedRows(source: string) {
  const estimatedLines = source
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 34)), 0);
  return Math.min(7, Math.max(3, Math.ceil(estimatedLines * 1.2)));
}

function DctDraftCard({ quest, value, onChange }: { quest: DctQuest; value: string; onChange: (value: string) => void }) {
  const mission = useCanonicalMission();
  const sourceFont = mission.sourceLanguage.code === "zh" ? "font-zh" : "";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  return (
    <section className={`${panel} overflow-hidden`}>
      <div className="flex items-start gap-4 bg-[#FBF8EE] px-4 py-3 sm:px-5">
        <span className="mt-0.5 inline-flex h-9 min-w-12 shrink-0 items-center justify-center rounded-lg border border-[#E4CB50] bg-[#FFF7D1] px-3 text-sm font-black text-[#142033]">{mission.sourceLanguage.badge}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-[#697386]">{mission.sourceLanguage.label} 원문</p>
          <p className={`${sourceFont} mt-0.5 break-keep text-[17px] leading-8`}>{quest.source}</p>
        </div>
      </div>
      <div className="border-t border-dashed border-[#D8D4C8] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-9 min-w-12 items-center justify-center rounded-lg bg-[#15202B] px-3 text-sm font-black text-white">{mission.targetLanguage.badge}</span>
          <div>
            <p className="text-[11px] font-bold text-[#697386]">{mission.targetLanguage.label} 번역안</p>
            <p className="mt-0.5 text-sm font-bold">{quest.prompt}</p>
          </div>
        </div>
        <Textarea
          id={`${quest.id}-draft`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={sourceAlignedRows(quest.source)}
          className={`${targetFont} mt-3 resize-y bg-white text-[16.5px] leading-8`}
          placeholder={`${mission.targetLanguage.label} 번역을 작성하세요.`}
        />
        <VocabularyHints quest={quest} />
      </div>
    </section>
  );
}

const FEEDBACK_LEVEL_LABEL: Record<FeedbackLevel, string> = {
  very_good: "안정",
  recommend: "보완 권장",
  required: "수정 필요",
};

const FEEDBACK_LEVEL_STYLE: Record<FeedbackLevel, string> = {
  very_good: "bg-[#EAF4ED] text-[#286247]",
  recommend: "bg-[#FFF2B8] text-[#725B12]",
  required: "bg-[#FCE7E4] text-[#8D3B36]",
};

const FEEDBACK_LEVEL_CARD_STYLE: Record<FeedbackLevel, string> = {
  very_good: "border-[#C6DDCE] bg-[#F4FAF6]",
  recommend: "border-[#E2C84F] bg-[#FFFAE8]",
  required: "border-[#D79A94] bg-[#FFF7F5]",
};

/**
 * 학습자에게는 의미 → 언어 → 화용의 고정 우선순위로 한 항목만 보여 준다.
 * 세 기준의 판정은 저장·연구용 구조에 그대로 보존한다.
 */
export function primaryFeedbackCriterion(criteria: FeedbackCriterion[]) {
  return criteria.find((criterion) => criterion.level !== "very_good") ?? criteria[0];
}

function collectHighlights(text: string, expressions: string[]) {
  return expressions.filter((expression) => text.includes(expression));
}

function findRequestClause(text: string, pattern: RegExp) {
  return text
    .split(/(?<=[。！？!?])/)
    .map((part) => part.trim())
    .find((part) => pattern.test(part));
}

function evaluateDct(quest: DctFeedbackQuest, text: string): DctEvaluation {
  const compact = text.replace(/\s+/g, "");
  const isFirst = quest.dctId === "A-DCT";
  const meaningOk = isFirst
    ? /面试/.test(compact) && /(周二|星期二)/.test(compact) && /(调整|改|其他日期|其他时间)/.test(compact)
    : /(文件|资料)/.test(compact) && /(打不开|无法打开|不能打开)/.test(compact) && /(再发|重新发|再发送|重新发送)/.test(compact);
  const hanCount = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const languageLevel: FeedbackLevel = hanCount < 8 ? "required" : "very_good";
  const harsh = /必须|务必|立刻|赶紧|给我/.test(text);
  const pragmaticIssue = quest.feedback.mode === "needs_mitigation" ? !hasMitigation(text) : isOverMitigated(text);
  const pragmaticLevel: FeedbackLevel = harsh ? "required" : pragmaticIssue ? "recommend" : "very_good";
  const detectedHighlights = collectHighlights(text, isFirst
    ? ["请给我", "给我", "必须", "务必", "立刻", "赶紧"]
    : ["如果您方便的话", "不知道能不能麻烦您", "给您添麻烦了", "非常抱歉", "不好意思", "打扰您了"]
  );
  const requestClause = findRequestClause(text, isFirst
    ? /(调整|改到|改成|其他日期|其他时间)/
    : /(再发|重新发|再发送|重新发送)/
  );
  const highlights = detectedHighlights.length > 0
    ? detectedHighlights
    : pragmaticIssue && requestClause
      ? [requestClause]
      : languageLevel === "required" && text.trim()
        ? [text.trim()]
        : [];
  const criteria: FeedbackCriterion[] = [
    {
      key: "meaning",
      label: "의미 전달",
      question: "뜻이 제대로 전달됐나요?",
      level: meaningOk ? "very_good" : "required",
      body: meaningOk
        ? "원문의 핵심 요청과 조건을 빠뜨리지 않고 옮겼습니다."
        : "누가 무엇을 요청하는지와 핵심 조건을 다시 확인해 주세요.",
    },
    {
      key: "language",
      label: "문법 정확성",
      question: "중국어 표현이 자연스러운가요?",
      level: languageLevel,
      body: languageLevel === "very_good"
        ? "의미를 이해하는 데 방해가 되는 표현 문제는 없습니다."
        : "문장이 너무 짧거나 불완전합니다. 중국어 문장으로 다시 작성해 주세요.",
    },
    {
      key: "pragmatics",
      label: "화용 적절성",
      question: "이 관계와 상황에 잘 맞나요?",
      level: pragmaticLevel,
      body: pragmaticLevel === "very_good"
        ? "상대와 요청 부담에 맞는 말투를 사용했습니다."
        : harsh
          ? "상대에게 지시하는 듯한 표현을 요청의 형태로 바꾸는 것이 좋습니다."
          : isFirst
            ? "상대가 거절하거나 다른 일정을 제안할 여지를 조금 더 남겨 보세요."
            : "부담이 작은 요청에 완화 표현이 겹쳐 다소 무겁게 들릴 수 있습니다.",
    },
  ];
  const levels = criteria.map((criterion) => criterion.level);
  const overall: FeedbackLevel = levels.includes("required") ? "required" : levels.includes("recommend") ? "recommend" : "very_good";
  return {
    criteria,
    headline: overall === "very_good"
      ? "아주 좋습니다. 이 번역으로 충분합니다."
      : overall === "recommend"
        ? "뜻은 잘 전달됐습니다. 한 곳만 보완하면 더 좋아집니다."
        : "핵심 의미나 표현을 다시 확인해 주세요.",
    body: overall === "very_good" ? quest.feedback.success : quest.feedback.issue,
    highlights,
    feedback: overall === "very_good" ? quest.feedback.success : quest.feedback.issue,
    action: overall === "very_good" ? undefined : quest.feedback.action,
    example: quest.referenceAnswer,
    takeaway: !meaningOk
      ? "번역을 마치기 전에 원문의 요청과 조건이 모두 들어갔는지 확인하세요."
      : languageLevel !== "very_good"
        ? "뜻을 옮긴 뒤 중국어 문장이 완결되었는지 한 번 더 읽어 보세요."
        : isFirst
          ? "부담이 큰 요청에서는 상대가 결정할 여지를 표현했는지 확인하세요."
          : "부담이 작은 요청에서는 완화 표현을 여러 겹 겹치지 않았는지 확인하세요.",
  };
}

function feedbackLevel(ok: boolean, warning = false): FeedbackLevel {
  return ok ? "very_good" : warning ? "recommend" : "required";
}

function evaluationFromRuntimeFeedback(
  runtime: RunnableMission,
  quest: DctFeedbackQuest,
  feedback: RuntimeFeedback,
): DctEvaluation {
  const feature = getTargetFeature(runtime.mission.unit.target_feature);
  const targetLanguage = runtime.mission.direction === "zh_ko" ? "한국어" : "중국어";
  const outputName = runtime.mission.production_task.mode === "interpreting" ? "통역" : "번역";
  const pragmaticOk = Boolean(
    feature && feedback.verdicts.pragmatic_appropriateness.band_code === feature.within_band_code,
  );
  const meaningLevel = feedback.verdicts.semantic_fidelity === "preserved"
    ? "very_good"
    : feedback.verdicts.semantic_fidelity === "minor_loss"
      ? "recommend"
      : "required";
  const grammarLevel = feedbackLevel(feedback.verdicts.grammatical_accuracy === "clean");
  const pragmaticLevel = feedbackLevel(pragmaticOk, true);
  const grammarNote = feedback.blocks.grammar[0];
  const criteria: FeedbackCriterion[] = [
    {
      key: "meaning",
      label: "의미 전달",
      question: "뜻이 제대로 전달됐나요?",
      level: meaningLevel,
      body: feedback.blocks.meaning_ko || (meaningLevel === "very_good"
        ? "원문의 핵심 의미가 유지되었습니다."
        : "원문에서 빠지거나 달라진 의미를 다시 확인해 주세요."),
    },
    {
      key: "language",
      label: "문법 정확성",
      question: `${targetLanguage} 표현이 자연스러운가요?`,
      level: grammarLevel,
      body: grammarNote?.explanation_ko || (grammarLevel === "very_good"
        ? "의미 이해를 막는 문법 문제는 확인되지 않았습니다."
        : "이해를 방해하는 표현을 다시 확인해 주세요."),
    },
    {
      key: "pragmatics",
      label: "화용 적절성",
      question: "이 관계와 상황에 잘 맞나요?",
      level: pragmaticLevel,
      body: feedback.blocks.feature_ko || (pragmaticOk
        ? "이번 목표 화용 요소의 적정 범위에 들어갑니다."
        : "관계와 상황에 맞게 표현의 정도를 다시 조절해 보세요."),
    },
  ];
  const primary = primaryFeedbackCriterion(criteria);
  const allGood = criteria.every((criterion) => criterion.level === "very_good");
  const action = feedback.revision_scope === "grammar"
    ? grammarNote?.suggested_correction
    : feedback.revision_scope === "feature"
      ? feedback.blocks.feature_ko
      : feedback.revision_scope === "meaning"
        ? feedback.blocks.meaning_ko
        : undefined;
  return {
    criteria,
    headline: allGood ? `아주 좋습니다. 이 ${outputName}으로 충분합니다.` : "피드백을 확인하고 한 번 다듬어 보세요.",
    body: primary.body,
    highlights: grammarNote?.anchor_text ? [grammarNote.anchor_text] : [],
    feedback: primary.body,
    action,
    example: feedback.blocks.alternatives[0]?.text ?? quest.referenceAnswer,
    takeaway: runtime.mission.unit.closing_ko,
  };
}

function unavailableRuntimeEvaluation(
  quest: DctFeedbackQuest,
  message: string,
  targetLanguage = "중국어",
  outputName = "번역",
): DctEvaluation {
  const body = `자동 피드백을 불러오지 못했습니다. 참고 표현과 원문을 비교해 직접 다듬어 주세요. (${message})`;
  return {
    available: false,
    criteria: [
      { key: "meaning", label: "의미 전달", question: "뜻이 제대로 전달됐나요?", level: "recommend", body },
      { key: "language", label: "문법 정확성", question: `${targetLanguage} 표현이 자연스러운가요?`, level: "recommend", body },
      { key: "pragmatics", label: "화용 적절성", question: "이 관계와 상황에 잘 맞나요?", level: "recommend", body },
    ],
    headline: "자동 피드백을 불러오지 못했습니다.",
    body,
    highlights: [],
    feedback: body,
    action: `참고 표현을 복사하지 말고, 내 ${outputName}에서 한 곳을 직접 점검해 보세요.`,
    example: quest.referenceAnswer,
    takeaway: "판정이 불가능했던 수행은 점수로 해석하지 않습니다.",
  };
}

export function feedbackNeedsRevision(
  evaluation: Pick<DctEvaluation, "available" | "criteria">,
): boolean {
  return evaluation.available !== false
    && evaluation.criteria.some((criterion) => criterion.level !== "very_good");
}

const DEV_PREVIEW_COPY: Record<DevPreviewPreset, { label: string; a: string }> = {
  all_good: {
    label: "수정 없이 확정",
    a: "您好，下周二的面试我可能无法参加，非常抱歉。请问能否调整到同一周的其他日期？",
  },
  direct: {
    label: "화용 보완 · 직접적",
    a: "您好，下周二的面试我无法参加，请把面试改到周三。",
  },
  over_mitigated: {
    label: "수정 없이 확정 · 완화형",
    a: "您好，下周二的面试我可能无法参加，非常抱歉。请问能否调整到同一周的其他日期？",
  },
  mixed: {
    label: "화용 보완 · 기본",
    a: "您好，下周二的面试我无法参加，请把面试改到周三。",
  },
};

function readDevPreviewPreset(): DevPreviewPreset {
  if (typeof window === "undefined") return "mixed";
  const value = new URLSearchParams(window.location.search).get("preset") as DevPreviewPreset | null;
  return value && value in DEV_PREVIEW_COPY ? value : "mixed";
}

function buildDevPreviewResponses(preset: DevPreviewPreset, finalized: boolean) {
  const mission = CANONICAL_MISSION_PREVIEW;
  const copy = DEV_PREVIEW_COPY[preset];
  const dctResponses = ["A-DCT"].reduce<Record<string, DctResponse>>((result, dctId) => {
    const feedbackQuest = mission.quests.find(
      (quest): quest is DctFeedbackQuest => quest.kind === "dct_feedback" && quest.dctId === dctId,
    );
    if (!feedbackQuest) return result;
    const first = copy.a;
    const evaluation = evaluateDct(feedbackQuest, first);
    const needsChange = evaluation.criteria.some((criterion) => criterion.level !== "very_good");
    result[dctId] = {
      first,
      revised: finalized && needsChange ? feedbackQuest.referenceAnswer : first,
      reflected: finalized && needsChange,
      evaluation,
    };
    return result;
  }, {});

  return mission.quests.reduce<Record<string, QuestResponse | DctResponse>>((result, quest) => {
    if (quest.kind === "scale") result[quest.id] = { pick: quest.referenceAnswer };
    if (quest.kind === "fix_choice") result[quest.id] = {
      judgment: quest.referenceJudgment,
      correctionIds: quest.corrections.filter((option) => option.valid).map((option) => option.id),
    };
    if (quest.kind === "reason") result[quest.id] = { reasonId: quest.acceptedReasonId };
    if (quest.kind === "best_worst") result[quest.id] = { best: quest.bestId, worst: quest.worstId };
    if (quest.kind === "dct") result[quest.id] = dctResponses[quest.id];
    if (quest.kind === "dct_feedback") result[quest.id] = dctResponses[quest.dctId];
    return result;
  }, {});
}

function DctDraftView({ quest, onDone, devMode = false, devAutofill = false, devDraft = "" }: {
  quest: DctQuest;
  onDone: (response: DctResponse) => void;
  devMode?: boolean;
  devAutofill?: boolean;
  devDraft?: string;
}) {
  const mission = useCanonicalMission();
  const [draft, setDraft] = useState(() => devAutofill ? devDraft : "");
  const validation = validateDraft(draft, mission.targetLanguage.label);
  const canSubmit = devMode || validation.valid;
  if (mission.activityMode === "interpreting") {
    return (
      <QuestScaffold quest={quest}>
        <InterpretingConsole
          sourceText={quest.source}
          sourceLanguage={mission.sourceLanguage}
          targetLanguage={mission.targetLanguage}
          learnerLevel={mission.supportLevel}
          replayLimit={quest.replayLimit}
          demoTranscript={devAutofill ? devDraft : undefined}
          onSubmit={(transcript) => onDone({ first: transcript, revised: transcript, reflected: false })}
        />
      </QuestScaffold>
    );
  }
  return (
    <QuestScaffold quest={quest}>
      <DctDraftCard quest={quest} value={draft} onChange={setDraft} />
      <ActionBar hint={devMode ? undefined : validation.hint}>
        <Button className={`h-12 ${actionButton}`} disabled={!canSubmit} onClick={() => onDone({ first: draft.trim(), revised: draft.trim(), reflected: false })}>{canSubmit ? "번역 제출하기" : "번역안을 작성해 주세요"} <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </ActionBar>
    </QuestScaffold>
  );
}

function FeedbackLoading() {
  return (
    <section className={`${panel} overflow-hidden`} aria-live="polite">
      <div className="flex items-center justify-between bg-[#F8F7F2] px-5 py-4">
        <div>
          <p className="text-xs font-black text-[#596579]">AI 피드백 준비 중</p>
          <p className="mt-1 text-base font-black">답안에서 먼저 살펴볼 한 가지를 찾고 있습니다</p>
        </div>
        <LoaderCircle className="h-6 w-6 animate-spin text-[#C6A521]" />
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        {["의미 전달", "문법 정확성", "화용 적절성"].map((label, index) => (
          <div key={label} className="rounded-xl border border-[#E2DED3] bg-[#FAF9F5] p-4">
            <span className="text-xs font-black text-[#7B8493]">{index + 1}</span>
            <p className="mt-2 text-sm font-black">{label}</p>
            <span className="mt-3 inline-flex gap-1" aria-hidden="true"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C9A62E]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C9A62E] [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C9A62E] [animation-delay:300ms]" /></span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StudentAnswerCard({ text, highlights = [] }: { text: string; highlights?: string[] }) {
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  return (
    <section className="rounded-2xl bg-[#15202B] p-5 text-white shadow-[0_12px_28px_rgba(21,32,43,0.12)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-[#F0D44F]">내 {outputName}</p>
        <span className="inline-flex h-8 min-w-11 items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-black text-white/90">{mission.targetLanguage.badge}</span>
      </div>
      <p className={`${targetFont} mt-4 whitespace-pre-wrap text-[17px] leading-8 text-white sm:text-[18px]`}>
        <HighlightedText text={text} highlights={highlights} target />
      </p>
    </section>
  );
}

function DctContextReview({ quest, first }: { quest: DctFeedbackQuest; first: string }) {
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const sourceFont = mission.sourceLanguage.code === "zh" ? "font-zh" : "";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  return (
    <details className="group rounded-xl border border-[#DDD8CB] bg-[#FAF9F5]">
      <summary className="cursor-pointer list-none px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-black text-[#4F5B6F]"><Eye className="h-3.5 w-3.5" /> 원문·상황 다시 보기</p>
            <p className="mt-1 text-xs leading-5 text-[#707A8B]">{quest.context.relation} · {quest.context.channel}</p>
          </div>
          <span className="shrink-0 text-xs font-bold text-[#6A7485]"><span className="group-open:hidden">펼치기</span><span className="hidden group-open:inline">접기</span></span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-[#D9DEE7] bg-white px-2.5 py-1 text-[11px] font-bold text-[#536075]">P · {quest.context.pdr.p}</span>
          <span className="rounded-full border border-[#D9DEE7] bg-white px-2.5 py-1 text-[11px] font-bold text-[#536075]">D · {quest.context.pdr.d}</span>
          <span className="rounded-full border border-[#D9DEE7] bg-white px-2.5 py-1 text-[11px] font-bold text-[#536075]">R · {quest.context.pdr.r}</span>
        </div>
      </summary>
      <div className="space-y-3 border-t border-[#E2DED4] px-4 py-4 sm:px-5">
        <div>
          <p className="text-[11px] font-black text-[#707A8B]">상황</p>
          <p className="mt-1 text-sm leading-6">{quest.context.situation}</p>
        </div>
        <div>
          <p className="text-[11px] font-black text-[#707A8B]">{mission.sourceLanguage.label} 원문</p>
          <p className={`${sourceFont} mt-1 text-sm font-bold leading-6`}>{quest.source}</p>
        </div>
        <div>
          <p className="text-[11px] font-black text-[#707A8B]">내 첫 {outputName}</p>
          <p className={`${targetFont} mt-1 text-[15px] leading-7`}>{first}</p>
        </div>
      </div>
    </details>
  );
}

export function DctFeedbackView({ quest, response, onDone, onRevisionStateChange, devMode = false, devAutofill = false, demoFillRequest = 0 }: {
  quest: DctFeedbackQuest;
  response?: DctResponse;
  onDone: (response: DctResponse) => void;
  onRevisionStateChange?: (open: boolean) => void;
  devMode?: boolean;
  devAutofill?: boolean;
  demoFillRequest?: number;
}) {
  const runtime = useRuntimeMission();
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  const first = response?.first ?? "";
  const [ready, setReady] = useState(false);
  const previewEvaluation = useMemo(() => evaluateDct(quest, first), [first, quest]);
  const [evaluation, setEvaluation] = useState<DctEvaluation>(previewEvaluation);
  const [runtimeFeedback, setRuntimeFeedback] = useState<RuntimeFeedback | undefined>(response?.runtimeFeedback);
  const [revised, setRevised] = useState(() => devAutofill ? quest.referenceAnswer : first);
  const [revisionOpen, setRevisionOpen] = useState(devAutofill);
  const [dissent, setDissent] = useState<DissentResponse | undefined>(response?.dissent);
  const revisionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!demoFillRequest) return;
    const example = quest.feedback.alternatives.find(item => normalize(item.text) !== normalize(first))?.text
      ?? quest.referenceAnswer;
    setRevised(example);
    setRevisionOpen(true);
  }, [demoFillRequest, first, quest]);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (runtime) {
      void requestFeedback(runtime.mission, first).then((result) => {
        if (cancelled) return;
        if (result.ok && result.feedback) {
          setRuntimeFeedback(result.feedback);
          setEvaluation(evaluationFromRuntimeFeedback(runtime, quest, result.feedback));
        } else {
          setRuntimeFeedback(undefined);
          setEvaluation(unavailableRuntimeEvaluation(
            quest,
            result.error ?? "알 수 없는 오류",
            mission.targetLanguage.label,
            outputName,
          ));
        }
        setReady(true);
      });
      return () => { cancelled = true; };
    }
    const timer = window.setTimeout(() => setReady(true), 1250);
    return () => window.clearTimeout(timer);
  }, [first, mission.targetLanguage.label, outputName, previewEvaluation, quest, runtime]);
  useEffect(() => {
    if (!revisionOpen) return;
    const timer = window.setTimeout(() => revisionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    return () => window.clearTimeout(timer);
  }, [revisionOpen]);
  useEffect(() => {
    onRevisionStateChange?.(revisionOpen);
  }, [onRevisionStateChange, revisionOpen]);
  const reflected = normalize(first) !== normalize(revised);
  const feedbackUnavailable = evaluation.available === false;
  const needsChange = feedbackNeedsRevision(evaluation);
  const primaryCriterion = primaryFeedbackCriterion(evaluation.criteria);
  const overallHeadline = feedbackUnavailable
    ? "자동 피드백을 확인하지 못했습니다."
    : primaryCriterion.level === "required"
      ? "다시 살펴봐야 합니다."
      : primaryCriterion.level === "recommend"
        ? "한 가지만 고치면 됩니다."
        : "이대로 확정해도 좋습니다.";
  const overallBadge = feedbackUnavailable
    ? "판정 보류"
    : `${primaryCriterion.label} · ${FEEDBACK_LEVEL_LABEL[primaryCriterion.level]}`;
  const overallBody = feedbackUnavailable || needsChange
    ? evaluation.feedback
    : "원문의 의미와 의도를 유지하면서, 관계와 상황에도 맞는 표현을 사용했습니다.";
  const revisionValidation = validateDraft(revised, mission.targetLanguage.label, outputName);
  const canConfirmRevision = devMode || (revisionValidation.valid && (!needsChange || reflected));
  const canRetainWithDissent = Boolean(dissent);
  const actionHint = devMode ? undefined : revisionValidation.hint ?? (needsChange && !reflected && !canRetainWithDissent ? `피드백을 반영해 한 곳 이상 수정하거나, 이의 제기에 근거를 남겨 첫 ${outputName}을 유지해 주세요.` : undefined);
  const retainFirstResponse = () => onDone({
    first,
    revised: first.trim(),
    reflected: false,
    evaluation,
    runtimeFeedback,
    dissent,
  });
  if (!isMeaningfulDraft(first, mission.targetLanguage.label, outputName)) {
    return (
      <section className={`${panel} p-5 sm:p-6`}>
        <h2 className="text-lg font-black">분석할 {outputName}이 없습니다.</h2>
        <p className="mt-2 text-sm leading-6 text-[#5B6678]">{outputName} 실습 단계에서 {mission.targetLanguage.label} 답안을 먼저 제출해 주세요.</p>
      </section>
    );
  }
  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-xs font-bold text-[#776727]">{progressLabel(quest)}</p>
        <h1 className="mt-1 text-xl font-black">{outputName} 피드백</h1>
      </div>
      <StudentAnswerCard text={first} highlights={ready ? evaluation.highlights : []} />
      {!ready ? <FeedbackLoading /> : (
        <>
          <section className={`${panel} overflow-hidden border ${feedbackUnavailable || needsChange ? "border-[#E0CB72]" : "border-[#B8D4C2]"}`}>
            <div className={`p-5 sm:p-6 ${feedbackUnavailable || needsChange ? "bg-[#FFFCF0]" : "bg-[#F7FBF8]"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F0D44F] text-[#15202B]"><Sparkles className="h-5 w-5" /></span>
                  <div>
                    <p className="text-xs font-black text-[#596579]">답안 피드백</p>
                    <h2 className="mt-1 text-lg font-black leading-7">{overallHeadline}</h2>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black ${feedbackUnavailable ? "bg-[#EEECE6] text-[#596579]" : needsChange ? FEEDBACK_LEVEL_STYLE[primaryCriterion.level] : FEEDBACK_LEVEL_STYLE.very_good}`}>{overallBadge}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#4F5B6E]">{overallBody}</p>
            </div>

            <div className="border-t border-[#E6E1D6] p-4 sm:p-5">
              <article className={`rounded-xl border p-4 ${FEEDBACK_LEVEL_CARD_STYLE[primaryCriterion.level]}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-black text-[#4F5B6E]">먼저 확인할 한 가지 · {primaryCriterion.label}</h3>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${FEEDBACK_LEVEL_STYLE[primaryCriterion.level]}`}>{FEEDBACK_LEVEL_LABEL[primaryCriterion.level]}</span>
                </div>
                <p className="mt-4 text-sm font-black leading-6">{primaryCriterion.body}</p>
              </article>
            </div>

            <p className="border-t border-[#EEEAE1] px-5 py-3 text-[11px] leading-5 text-[#6D7788]">AI가 생성한 참고 피드백입니다. 상황에 따라 다른 판단도 가능합니다.</p>
          </section>

          <MissionDissentPanel onSubmit={setDissent} />

          {revisionOpen ? (
            <>
              <section ref={revisionRef} className={`${panel} scroll-mt-24 p-5 sm:p-6`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black text-[#776727]">다시 다듬기</p>
                    <h2 className="mt-1 text-lg font-black">피드백을 반영해 다시 써보세요.</h2>
                  </div>
                  {needsChange && <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${FEEDBACK_LEVEL_STYLE[primaryCriterion.level]}`}>{primaryCriterion.label} · {FEEDBACK_LEVEL_LABEL[primaryCriterion.level]}</span>}
                </div>
                {needsChange && (
                  <div className="mt-4 rounded-xl border-l-4 border-[#E0C247] bg-[#FFFBEC] px-4 py-3">
                    <p className="text-sm font-black leading-6">{primaryCriterion.body}</p>
                    {evaluation.action && <p className="mt-1 text-sm leading-6 text-[#566175]"><RichLine text={evaluation.action} /></p>}
                  </div>
                )}
                <Textarea id={`${quest.id}-revise`} value={revised} onChange={(event) => setRevised(event.target.value)} rows={sourceAlignedRows(quest.source)} className={`${targetFont} mt-4 resize-y bg-white text-[16.5px] leading-8`} />
                <div className="mt-3"><DctContextReview quest={quest} first={first} /></div>
              </section>
              <ActionBar hint={actionHint}>
                <div className="grid gap-2">
                  <Button className={`h-12 ${actionButton}`} disabled={!canConfirmRevision} onClick={() => onDone({ first, revised: revised.trim(), reflected, evaluation, runtimeFeedback, dissent })}>{reflected ? "수정안 확정하기" : needsChange ? "피드백을 반영해 수정해 주세요" : `이 ${outputName}으로 확정하기`} <ChevronRight className="ml-1 h-4 w-4" /></Button>
                  {needsChange && !reflected && canRetainWithDissent && (
                    <Button variant="outline" className="h-11 w-full" onClick={retainFirstResponse}>수정하지 않고 첫 {outputName} 유지하기</Button>
                  )}
                </div>
              </ActionBar>
            </>
          ) : (
            <ActionBar>
              {needsChange ? (
                <div className="grid gap-2">
                  <Button className="h-12 w-full" onClick={() => setRevisionOpen(true)}>한 번 다듬어보기 <ChevronRight className="ml-1 h-4 w-4" /></Button>
                  <Button variant="outline" className="h-11 w-full" disabled={!canRetainWithDissent} onClick={retainFirstResponse}>내 {outputName}을 유지하고 확정하기</Button>
                  {!canRetainWithDissent && <p className="px-1 text-center text-[11px] leading-5 text-[#6D7788]">첫 {outputName}을 유지하려면 위의 이의 제기에 판단 근거를 남겨 주세요.</p>}
                </div>
              ) : (
                <div className="grid gap-2">
                  <Button className="h-12 w-full" onClick={() => onDone({ first, revised: first.trim(), reflected: false, evaluation, runtimeFeedback, dissent })}>이 {outputName}으로 확정하기 <ChevronRight className="ml-1 h-4 w-4" /></Button>
                  <Button variant="outline" className="h-11 w-full" onClick={() => setRevisionOpen(true)}>다른 표현도 시도해보기</Button>
                </div>
              )}
            </ActionBar>
          )}
        </>
      )}
    </div>
  );
}

function QuestScaffold({ quest, target, targetHighlights, children }: {
  quest: MissionQuest;
  target?: string;
  targetHighlights?: string[];
  children: React.ReactNode;
}) {
  const mission = useCanonicalMission();
  return (
    <div className={quest.id === "A1" ? "space-y-2.5" : "space-y-3"}>
      {quest.id === "A1" && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
          <h1 className="text-lg font-black tracking-[-0.02em] text-[#15202B]">상황에 맞는 표현 판단하기</h1>
          <p className="text-xs font-bold text-[#776727]">
            {mission.metaLabel ?? `${mission.weekNo}주차`} · {mission.speechAct}
          </p>
        </div>
      )}
      <ContextCard context={quest.context} />
      {quest.kind !== "dct" && <LanguagePair source={quest.source} target={target} targetHighlights={targetHighlights} />}
      {children}
    </div>
  );
}

const PROGRESS_LABELS: Record<string, string> = {
  A1: "첫인상 판단",
  A2: "맥락 대비 판단",
  A3: "판단하고 고쳐보기",
  A4: "이유 찾기",
  A5: "여러 초안 비교",
  "A-DCT": "내 산출 작성",
  "A-FEEDBACK": "피드백 확인",
};

function progressLabel(quest: MissionQuest) {
  return PROGRESS_LABELS[quest.id] ?? quest.shortLabel;
}

const MACRO_PROGRESS = ["장면 이해", "표현 판단", "직접 산출", "피드백", "다듬기"] as const;

function macroProgressIndex(activeIndex: number, completed: boolean | undefined, revisionOpen: boolean, sceneIntroStep: number | null) {
  if (completed) return MACRO_PROGRESS.length;
  if (sceneIntroStep !== null) return 0;
  if (activeIndex <= 4) return 1;
  if (activeIndex === 5) return 2;
  return revisionOpen ? 4 : 3;
}

function Progress({ activeIndex, completed, reviewIndex = null, revisionOpen = false, sceneIntroStep = null, sceneIntroConfig = MISSION_A_SCENE_INTRO, mpjRecapOpen = false }: {
  activeIndex: number;
  completed?: boolean;
  reviewIndex?: number | null;
  revisionOpen?: boolean;
  sceneIntroStep?: number | null;
  sceneIntroConfig?: SceneIntroConfig;
  mpjRecapOpen?: boolean;
}) {
  const quests = useCanonicalMission().quests;
  const macroIndex = macroProgressIndex(activeIndex, completed, revisionOpen, sceneIntroStep);
  const detail = completed
    ? { phase: "미션 완료", activity: "내 산출 돌아보기" }
      : reviewIndex !== null
      ? { phase: "기록 검토", activity: progressLabel(quests[reviewIndex]) }
      : sceneIntroStep !== null
        ? { phase: "장면 이해", activity: sceneIntroConfig.slides[sceneIntroStep].eyebrow.replace(/^\d+ · /, "") }
      : mpjRecapOpen
        ? { phase: "직접 산출", activity: "산출 전 정리" }
      : activeIndex <= 4
        ? { phase: `표현 판단 · ${activeIndex + 1}/5`, activity: progressLabel(quests[activeIndex]) }
        : activeIndex === 5
          ? { phase: "직접 산출", activity: progressLabel(quests[activeIndex]) }
          : revisionOpen
            ? { phase: "다듬기", activity: "내 산출 수정" }
            : { phase: "피드백", activity: progressLabel(quests[activeIndex]) };
  return (
    <section className="sticky top-16 z-30 border-b border-[#DDD8CC] bg-[#FBFAF6] px-3 py-2.5 sm:px-4" aria-label="미션 학습 흐름">
      <div className="flex items-center gap-3 sm:gap-4">
        <ol className="grid min-w-0 flex-1 grid-cols-5" aria-label="장면 이해, 표현 판단, 직접 산출, 피드백, 다듬기">
          {MACRO_PROGRESS.map((label, index) => {
            const done = Boolean(completed) || index < macroIndex;
            const active = !completed && index === macroIndex;
            return (
              <li key={label} className="relative flex min-w-0 items-center justify-center gap-1 sm:gap-1.5">
                {index > 0 && (
                  <span className={`absolute right-1/2 top-1/2 h-px w-full ${done || active ? "bg-[#9AA3AD]" : "bg-[#D9D6CD]"}`} aria-hidden />
                )}
                <span className={`relative z-10 h-2.5 w-2.5 shrink-0 rounded-full border ${done ? "border-[#D3B62D] bg-[#F3D248]" : active ? "border-[#15202B] bg-[#15202B] ring-2 ring-[#E8D04C] ring-offset-1 ring-offset-[#FBFAF6]" : "border-[#CFCBC0] bg-white"}`} aria-hidden />
                <span className={`relative z-10 break-keep bg-[#FBFAF6] px-0.5 text-center text-[11px] font-bold leading-4 sm:text-[12px] ${active ? "font-black text-[#15202B]" : done ? "text-[#687387]" : "text-[#A0A5AD]"}`}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="hidden min-w-[7.5rem] border-l border-[#DDD8CC] pl-3 text-right sm:block">
          <p className="text-[13px] font-black text-[#15202B]">{detail.activity}</p>
          <p className="mt-0.5 text-[10px] font-bold text-[#8A919D]">{detail.phase}</p>
        </div>
      </div>
      <p className="mt-1.5 truncate text-right text-[11px] font-bold text-[#747E8C] sm:hidden">{detail.activity}</p>
      <span className="sr-only">현재 단계: {detail.phase}, {detail.activity}</span>
    </section>
  );
}

function QuestRenderer({ quest, responses, onDone, onRevisionStateChange, devMode = false, devAutofill = false, devDraft = "", revealAnswers = false, demoFillRequest = 0 }: {
  quest: MissionQuest;
  responses: Record<string, QuestResponse | DctResponse>;
  onDone: (response: QuestResponse | DctResponse) => void;
  onRevisionStateChange?: (open: boolean) => void;
  devMode?: boolean;
  devAutofill?: boolean;
  devDraft?: string;
  revealAnswers?: boolean;
  demoFillRequest?: number;
}) {
  if (quest.kind === "scale") return <ScaleView quest={quest} onDone={onDone} devAutofill={devAutofill} revealAnswers={revealAnswers} />;
  if (quest.kind === "fix_choice") return <FixChoiceView quest={quest} responses={responses} onDone={onDone} devAutofill={devAutofill} revealAnswers={revealAnswers} />;
  if (quest.kind === "reason") return <ReasonView quest={quest} onDone={onDone} devAutofill={devAutofill} revealAnswers={revealAnswers} />;
  if (quest.kind === "best_worst") return <BestWorstView quest={quest} onDone={onDone} devAutofill={devAutofill} revealAnswers={revealAnswers} />;
  if (quest.kind === "dct_feedback") return <DctFeedbackView quest={quest} response={responses[quest.dctId] as DctResponse | undefined} onDone={onDone} onRevisionStateChange={onRevisionStateChange} devMode={devMode} devAutofill={devAutofill} demoFillRequest={demoFillRequest} />;
  return <DctDraftView quest={quest} onDone={onDone} devMode={devMode} devAutofill={devAutofill} devDraft={devDraft} />;
}

/** Admin-only host uses the same learner components, without the attempt runner.
 * No learner events, answer storage, or synthetic/live DCT feedback is produced.
 */
export function CanonicalReviewStage({ mission, section, revealAnswers, onNext }: {
  mission: CanonicalMissionViewModel; section: string; revealAnswers: boolean; onNext: () => void;
}) {
  const [sceneStep, setSceneStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, QuestResponse | DctResponse>>({});
  const quest = section === "dct" ? mission.quests.find((item) => item.kind === "dct")
    : section.startsWith("mjt-") ? mission.quests[Number(section.slice(4))] : undefined;
  return <RuntimeMissionContext.Provider value={null}><CanonicalMissionContext.Provider value={mission}>
    <div className="space-y-5">
      {section === "scene" ? <SceneIntroFlow config={buildSceneIntroConfig(mission)} step={sceneStep}
        onNext={() => sceneStep < 2 ? setSceneStep(sceneStep + 1) : onNext()} onPrevious={() => setSceneStep(Math.max(0, sceneStep - 1))} onSelect={setSceneStep} />
        : section === "recap" ? <MpjLessonBridge lessonPoints={mission.lessonPoints} onContinue={onNext} />
        : quest && quest.kind !== "dct_feedback" ? <>
          <QuestRenderer key={`${quest.id}-${revealAnswers}`} quest={quest} responses={responses} revealAnswers={revealAnswers}
            onDone={(response) => {
              setResponses((current) => ({ ...current, [quest.id]: response }));
              if (quest.kind !== "dct") onNext();
            }} />
          {quest.kind === "dct" && (revealAnswers || responses[quest.id]) && <section className={`${panel} space-y-3 p-5`}>
            <h3 className="font-bold">DCT 참고 표현·해설</h3>
            <p className="text-sm text-muted-foreground">정적 콘텐츠 감수입니다. 이 화면의 제출은 학습 기록이나 AI 피드백 요청을 만들지 않습니다.</p>
            {!quest.feedback.alternatives.length && <p className="whitespace-pre-wrap text-lg">{quest.referenceAnswer}</p>}
            {quest.feedback.alternatives.map((alternative, index) => <div key={index} className="border-t pt-3">
              <p className="whitespace-pre-wrap text-lg">{alternative.text}</p><p className="mt-1 text-sm">{alternative.note}</p>
            </div>)}
          </section>}
        </> : <p role="alert">이 문항을 학습자 화면으로 표시할 수 없습니다.</p>}
    </div>
  </CanonicalMissionContext.Provider></RuntimeMissionContext.Provider>;
}

function MpjLessonBridge({ lessonPoints, onContinue }: {
  lessonPoints: MissionLessonPoint[];
  onContinue: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#DED9CD] bg-[#FCFBF7] px-5 py-6 shadow-[0_10px_28px_rgba(21,32,43,0.05)] sm:px-8 sm:py-7" aria-label="직접 산출 전 5 POINT LESSON">
      <p className="text-[11px] font-black tracking-[0.12em] text-[#8A7419]">직접 산출하기 전에</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <h1 className="break-keep text-2xl font-black tracking-[-0.03em] text-[#15202B]">문항별 핵심 5가지</h1>
        <span className="text-[10px] font-black tracking-[0.14em] text-[#8B94A1]">5 POINT LESSON</span>
      </div>
      <ol className="mt-4 border-y border-[#E2DED4]">
        {lessonPoints.map((point, index) => (
          <li key={point.questId} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-t border-[#E2DED4] py-3 first:border-t-0 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-4">
            <span className="pt-0.5 text-sm font-black tabular-nums text-[#B49A23]">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <p className="text-[11px] font-black tracking-[0.06em] text-[#7A8493]">{point.label}</p>
              <p className="mt-1 break-keep text-[16px] font-semibold leading-7 text-[#263444] [overflow-wrap:anywhere] sm:text-[16.5px]">
                <HighlightedText text={point.text} highlights={point.highlights} target />
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex justify-end">
        <Button type="button" className="h-11 px-5 font-black" onClick={onContinue}>
          직접 산출해 보기 <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
function responseLabel(quest: MissionQuest, response: QuestResponse) {
  if (quest.kind === "scale") return quest.options.find((item) => item.id === response.pick)?.label ?? "선택 기록";
  if (quest.kind === "fix_choice") {
    const judgment = quest.judgmentOptions.find((item) => item.id === response.judgment)?.label;
    const ids = new Set((response.correctionIds as string[] | undefined) ?? []);
    const corrections = quest.corrections.filter((item) => ids.has(item.id)).map((item) => item.text);
    return `${judgment ?? "판정"} · ${corrections.join(" / ")}`;
  }
  if (quest.kind === "reason") {
    const judgment = response.initialJudgment === "appropriate" ? "적절하다" : response.initialJudgment === "inappropriate" ? "적절하지 않다" : null;
    const reason = quest.reasons.find((item) => item.id === response.reasonId)?.text;
    return [judgment, reason].filter(Boolean).join(" · ") || "이유 기록";
  }
  if (quest.kind === "best_worst") {
    const best = quest.candidates.find((item) => item.id === response.best)?.text;
    const worst = quest.candidates.find((item) => item.id === response.worst)?.text;
    return `내 BEST · ${best ?? "-"}\n내 WORST · ${worst ?? "-"}`;
  }
  return "";
}

function questFeedback(quest: MissionQuest) {
  if (quest.kind === "scale" || quest.kind === "fix_choice" || quest.kind === "reason") return quest.feedback;
  if (quest.kind === "best_worst") return quest.candidates.map((item) => `${comparisonCandidateLabel(quest, item.role)} · ${item.note}`).join("\n");
  return "";
}

function ReviewModeBanner({ index, completed, onExit }: { index: number; completed: boolean; onExit: () => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[#C9D0DA] bg-[#F2F4F7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <p className="text-xs font-black text-[#526075]">{index + 1}단계 기록을 다시 보는 중</p>
        <p className="mt-1 break-keep text-xs leading-5 text-[#6A7485]">완료한 답과 피드백을 확인하고 있습니다. 새로운 문제를 푸는 화면이 아닙니다.</p>
      </div>
      <Button variant="outline" className="h-9 shrink-0 bg-white px-4 text-xs" onClick={onExit}>
        {completed ? "미션 완료 화면으로 돌아가기" : "현재 학습 단계로 돌아가기"}
      </Button>
    </section>
  );
}

function CompletedQuestReview({ quest, response }: {
  quest: MissionQuest;
  response: QuestResponse | DctResponse;
}) {
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  const dct = quest.kind === "dct" ? response as DctResponse : undefined;
  const feedbackResponse = quest.kind === "dct_feedback" ? response as DctResponse : undefined;
  return (
    <div className="space-y-4">
      <div className="px-1">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#776727]"><Eye className="h-3.5 w-3.5" /> {progressLabel(quest)} · 학습 기록</p>
          <h1 className="mt-1 text-xl font-black">{quest.title}</h1>
        </div>
      </div>
      <ContextCard context={quest.context} />
      <LanguagePair
        source={quest.source}
        target={feedbackResponse ? feedbackResponse.revised : "target" in quest ? quest.target : undefined}
        targetHighlights={feedbackResponse?.evaluation?.highlights ?? quest.targetHighlights}
      />
      <section className={`${panel} p-4 sm:p-5`}>
        {feedbackResponse ? (
          <div className="space-y-4">
            <p className="text-xs font-bold text-[#677287]">원포인트 피드백 결과</p>
            {feedbackResponse.evaluation && (() => {
              const criterion = primaryFeedbackCriterion(feedbackResponse.evaluation.criteria);
              return (
                <div className="rounded-xl border border-[#E2DED3] p-3">
                  <p className="text-xs font-black">{criterion.label}</p>
                  <span className={`mt-2 inline-block rounded-full px-2 py-1 text-[10px] font-black ${FEEDBACK_LEVEL_STYLE[criterion.level]}`}>{FEEDBACK_LEVEL_LABEL[criterion.level]}</span>
                </div>
              );
            })()}
            <div><p className="text-xs font-bold text-[#677287]">최종 {outputName}</p><p className={`${targetFont} mt-1 text-[17px] leading-8`}>{feedbackResponse.revised}</p></div>
          </div>
        ) : dct ? (
          <div><p className="text-xs font-bold text-[#677287]">내 첫 {outputName}</p><p className={`${targetFont} mt-1 text-[17px] leading-8`}>{dct.first}</p></div>
        ) : (
          <>
            <p className="text-xs font-bold text-[#677287]">내가 고른 답</p>
            <div className="mt-2 whitespace-pre-line rounded-xl bg-[#F6F4EE] p-4 text-sm leading-7"><RichLine text={responseLabel(quest, response)} /></div>
            <div className="mt-4"><FeedbackBox feedback={questFeedback(quest)} highlights={quest.targetHighlights} /></div>
          </>
        )}
      </section>
    </div>
  );
}

export function CompletionRecord({ label, response, alternatives = [] }: {
  label: string;
  response?: DctResponse;
  alternatives?: DctQuest["feedback"]["alternatives"];
}) {
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  if (!response || !isMeaningfulDraft(response.first, mission.targetLanguage.label, outputName)) return null;
  const evaluation = response.evaluation;
  const needsAttention = evaluation?.criteria.filter((criterion) => criterion.level !== "very_good") ?? [];
  const retainedAgainstFeedback = Boolean(response.dissent && !response.reflected && needsAttention.length > 0);
  return (
    <article className={`${panel} overflow-hidden`}>
      <div className="border-b border-[#E3DFD4] bg-[#F8F6EF] px-5 py-4">
        <p className="text-xs font-black text-[#6B5518]">{label}</p>
      </div>
      <div className="space-y-5 p-5">
        {/* 수정 전 = 중립 박스, 수정 후 = 강조 박스. 두 덩어리로 묶어야 전·후가 한눈에 대비된다. */}
        <div className="rounded-xl border border-[#E5E1D8] bg-[#FAF9F5] p-4">
          <p className="text-[11px] font-bold text-[#7A8495]">내가 실제로 한 {mission.targetLanguage.label} {outputName}</p>
          <p className={`${targetFont} mt-2 text-[17px] leading-8`}><HighlightedText text={response.first} highlights={evaluation?.highlights} target /></p>
        </div>
        {evaluation && needsAttention.length > 0 ? (
          <div className="rounded-xl border border-[#DDD8CB] border-l-4 border-l-[#E0C43C] bg-[#FAF9F5] p-4">
            <p className="text-xs font-black text-[#725B12]">수정이 필요했던 부분</p>
            {evaluation.highlights.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {evaluation.highlights.map((highlight) => <span key={highlight} className={`${targetFont} rounded-md bg-[#FFF5C8] px-2.5 py-1.5 text-[15px] underline decoration-[#C9A90E] decoration-2 underline-offset-4`}>{highlight}</span>)}
              </div>
            ) : <p className="mt-2 text-sm">다시 살펴본 기준: {needsAttention.map((criterion) => criterion.label).join(" · ")}</p>}
            <p className="mt-3 text-xs font-black text-[#725B12]">왜 고쳤나요?</p>
            <p className="mt-1 break-keep text-sm leading-6 text-[#4F5A6B]">{evaluation.feedback}</p>
          </div>
        ) : evaluation ? (
          <div className="rounded-xl border border-[#BFD9CC] bg-[#F2F8F4] p-4">
            <p className="text-xs font-black text-[#286247]">잘한 점</p>
            <p className="mt-2 break-keep text-sm leading-6">{evaluation.feedback}</p>
          </div>
        ) : null}
        {response.reflected ? (
          <div className="rounded-xl border-2 border-[#9CC7B0] bg-[#F4FAF6] p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-black text-[#245E44]"><Check className="h-3.5 w-3.5" />피드백을 반영한 최종 {outputName}</p>
            <p className={`${targetFont} mt-2 text-[17px] leading-8`}>{response.revised}</p>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#286247]"><Check className="h-3.5 w-3.5" />{retainedAgainstFeedback ? `AI 참고 판정과 다르게 보고 첫 ${outputName}을 최종안으로 유지했습니다.` : `첫 ${outputName}을 최종안으로 확정했습니다.`}</p>
        )}
        {alternatives.length > 0 && (
          <div className="border-t border-[#E5E1D8] pt-5">
            <p className="text-xs font-black text-[#596579]">수정 완료 후 보는 참고 표현</p>
            <div className="mt-3 space-y-3">
              {alternatives.map((alternative) => (
                <div key={alternative.text} className="rounded-xl bg-[#F8F7F2] p-4">
                  <p className={`${targetFont} text-[16px] leading-7`}>{alternative.text}</p>
                  <p className="mt-1.5 text-xs leading-5 text-[#667185]">{alternative.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function DissentSummary({ dissent }: { dissent?: DissentResponse }) {
  if (!dissent) return null;
  const labels = dissent.conditions.map((code) => DISSENT_CONDITIONS.find((condition) => condition.code === code)?.label ?? code);
  return (
    <section className="rounded-2xl border border-[#CFE4D8] bg-[#F2FAF6] p-5 sm:p-6">
      <p className="text-xs font-black text-[#2E7D5B]">내가 다르게 본 부분</p>
      <h2 className="mt-1 text-base font-black">AI 참고 판정과 나의 판단 근거를 함께 기록했습니다.</h2>
      {labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {labels.map((label) => <span key={label} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#356B55]">{label}</span>)}
        </div>
      )}
      {dissent.reason && <p className="mt-3 break-keep text-sm leading-6 text-[#4F5B63]">{dissent.reason}</p>}
    </section>
  );
}

export function CompletionActions({ onRestart, onRetrySave, runtime = false, saveState = "idle" }: {
  onRestart: () => void;
  onRetrySave?: () => void;
  runtime?: boolean;
  saveState?: "idle" | "saving" | "saved" | "error";
}) {
  const returnCourseId = new URLSearchParams(window.location.search).get("courseId");
  const returnWeekNo = Number(new URLSearchParams(window.location.search).get("weekNo"));
  const returnPath = returnCourseId && Number.isInteger(returnWeekNo)
    ? `/learner/course/${encodeURIComponent(returnCourseId)}/week/${returnWeekNo}`
    : null;
  const saving = runtime && saveState === "saving";
  return (
    <section className={`${panel} p-4 sm:p-5`}>
      <div className={`grid gap-2 ${returnPath ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {returnPath && (
          <Link
            to={returnPath}
            aria-disabled={saving || undefined}
            onClick={(event) => { if (saving) event.preventDefault(); }}
            className="flex h-12 items-center justify-center rounded-md bg-[#F3D248] px-4 text-center text-sm font-bold text-[#15202B] transition hover:bg-[#F7DF73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
          >
            이번 주 학습으로 돌아가기
          </Link>
        )}
        <Link
          to="/learner/records#correction-notes"
          aria-disabled={saving || undefined}
          onClick={(event) => { if (saving) event.preventDefault(); }}
          className="flex h-12 items-center justify-center rounded-md bg-[#15202B] px-4 text-sm font-bold text-white transition hover:bg-[#263547] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
        >
          나의 학습 기록 보기
        </Link>
        <Button variant="outline" className="h-12 w-full" onClick={onRestart} disabled={saving}><RotateCcw className="mr-2 h-4 w-4" />처음부터 다시 보기</Button>
      </div>
      {runtime && saveState === "error" && onRetrySave && (
        <Button className="mt-3" onClick={onRetrySave}>학습 기록 저장 다시 시도</Button>
      )}
      <p role={saveState === "error" ? "alert" : "status"} className="mt-3 break-keep text-[11px] leading-5 text-[#6A7485]">
        {runtime
          ? saveState === "saving"
            ? "학습 기록을 저장하고 있습니다."
            : saveState === "saved"
              ? "학습 기록에 저장되었습니다."
              : saveState === "error"
                ? "학습 기록을 저장하지 못했습니다. 답안은 이 화면에 남아 있으니, 화면을 떠나기 전에 저장을 다시 시도해 주세요."
                : "학습 기록 저장을 준비하고 있습니다."
          : "현재 미리보기의 답안과 의견은 DB에 저장되지 않습니다."}
      </p>
    </section>
  );
}

function SessionPatternSummary({ responses }: { responses: Array<DctResponse | undefined> }) {
  const mission = useCanonicalMission();
  const evaluations = responses
    .filter((response): response is DctResponse => Boolean(
      response?.evaluation
      && response.evaluation.available !== false
      && isMeaningfulDraft(response.first, mission.targetLanguage.label, mission.activityMode === "interpreting" ? "통역" : "번역"),
    ))
    .map((response) => response.evaluation as DctEvaluation);
  if (evaluations.length === 0) return null;
  const primaryCriteria = evaluations.map((evaluation) => primaryFeedbackCriterion(evaluation.criteria));
  const primary = primaryCriteria.find((criterion) => criterion.level !== "very_good") ?? primaryCriteria[0];
  if (!primary) return null;
  return (
    <section className={`${panel} p-5 sm:p-6`}>
      <h2 className="text-base font-black">이번 미션의 원포인트 피드백</h2>
      <p className="mt-1 break-keep text-xs leading-5 text-[#6A7485]">세 기준은 내부 기록에 보존하고, 학습 화면에는 우선순위가 가장 높은 한 항목만 제시합니다.</p>
      <article className="mt-4 rounded-xl bg-[#F7F6F1] p-4">
        <p className="text-xs font-black text-[#596579]">{primary.label}</p>
        <p className="mt-2 break-keep text-sm font-black">{primary.body}</p>
      </article>
    </section>
  );
}

function DevPreviewToolbar({
  sceneIntroConfig,
  preset,
  onPresetChange,
  onJump,
  onFill,
  onReset,
}: {
  sceneIntroConfig: SceneIntroConfig;
  preset: DevPreviewPreset;
  onPresetChange: (preset: DevPreviewPreset) => void;
  onJump: (step: string) => void;
  onFill: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    // 좁은 화면에서는 학습 액션 바 위로 올려 제출 버튼을 가리지 않게 한다(QA 도구는 학습 화면보다 뒤).
    <div className="fixed bottom-36 right-3 z-[70] text-xs sm:bottom-4 sm:right-4">
      {open && (
        <div className="mb-2 w-72 rounded-2xl border border-[#334155] bg-[#15202B] p-4 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black tracking-[0.12em] text-[#F3D248]">DEV PREVIEW</p>
              <p className="mt-0.5 text-[10px] text-white/45">localhost 전용 · 저장 안 됨</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="개발자 메뉴 닫기" className="rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <label className="mt-4 block font-bold text-white/70" htmlFor="dev-preview-preset">답안 유형</label>
          <select
            id="dev-preview-preset"
            value={preset}
            onChange={(event) => onPresetChange(event.target.value as DevPreviewPreset)}
            className="mt-1 h-9 w-full rounded-lg border border-white/20 bg-white px-3 font-bold text-[#15202B]"
          >
            {Object.entries(DEV_PREVIEW_COPY).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
          </select>
          <label className="mt-3 block font-bold text-white/70" htmlFor="dev-preview-step">바로 이동</label>
          <select
            id="dev-preview-step"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) onJump(event.target.value);
              event.target.value = "";
            }}
            className="mt-1 h-9 w-full rounded-lg border border-white/20 bg-white px-3 font-bold text-[#15202B]"
          >
            <option value="" disabled>화면 선택</option>
            {sceneIntroConfig.slides.map((slide, index) => <option key={slide.eyebrow} value={SCENE_INTRO_STEP_IDS[index]}>장면 {index + 1}. {slide.eyebrow.replace(/^\d+ · /, "")}</option>)}
            {CANONICAL_MISSION_PREVIEW.quests.map((quest, index) => <option key={quest.id} value={quest.id}>{index + 1}. {progressLabel(quest)}</option>)}
            <option value="recap">MJT5 뒤 5 POINT LESSON</option>
            <option value="summary">최종 summary</option>
          </select>
          <button type="button" onClick={onFill} className="mt-3 w-full rounded-lg bg-[#F3D248] px-3 py-2.5 font-black text-[#15202B] hover:bg-[#F7DD62]">현재 답안 채우기</button>
          <button type="button" onClick={onReset} className="mt-2 w-full rounded-lg border border-white/20 px-3 py-2 font-bold text-white/80 hover:bg-white/10">첫 단계로 초기화</button>
          <p className="mt-3 leading-5 text-white/50">단계 직접 이동 · 글자수/중문 검증 우회</p>
        </div>
      )}
      <button type="button" onClick={() => setOpen((current) => !current)} className="rounded-full border border-[#F3D248]/60 bg-[#15202B]/85 px-3 py-2 text-[11px] font-black tracking-[0.08em] text-[#F3D248] opacity-60 shadow-lg transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F3D248] sm:px-4 sm:py-2.5 sm:text-xs">DEV PREVIEW</button>
    </div>
  );
}

function selectedIndex(value: unknown, prefix: string): number | undefined {
  if (typeof value !== "string" || !value.startsWith(prefix)) return undefined;
  const index = Number(value.slice(prefix.length));
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}

export function buildRuntimeMpjTraces(
  runtime: RunnableMission,
  responses: Record<string, QuestResponse | DctResponse>,
): MpjResponseTrace[] {
  const completedAt = new Date().toISOString();
  const items = runtime.mission.mpj_items as unknown as Array<{
    id?: number;
    type: string;
    reasons?: Array<{ id: string; kind?: "primary" | "pragmatic_misconception" | "meaning_grammar_context" }>;
  }>;
  const response = (id: string) => responses[id] as QuestResponse | undefined;
  const corrections = (id: string) => ((response(id)?.correctionIds as string[] | undefined) ?? [])
    .map((value) => selectedIndex(value, `${id}-`))
    .filter((value): value is number => value !== undefined);
  const bestWorst = (id: string) => ({
    best_candidate_index: selectedIndex(response(id)?.best, `${id}-`),
    worst_candidate_index: selectedIndex(response(id)?.worst, `${id}-`),
  });
  const reasonTrace = (itemIndex: number, responseId: string) => {
    const reasonId = response(responseId)?.reasonId as string | undefined;
    return {
      initial_judgment: response(responseId)?.initialJudgment as "appropriate" | "inappropriate" | undefined,
      reason_id: reasonId,
      reason_kind: items[itemIndex]?.reasons?.find((item) => item.id === reasonId)?.kind,
    };
  };
  const trace = (
    itemIndex: number,
    values: Omit<MpjResponseTrace, "item_id" | "item_type" | "completed_at">,
  ): MpjResponseTrace => ({
    item_id: items[itemIndex]?.id ?? itemIndex + 1,
    item_type: items[itemIndex]?.type ?? "unknown",
    completed_at: completedAt,
    ...values,
  });

  if (runtime.mission.schema_version === "mission_v2") {
    return [
      trace(0, { scale_code: response("A1")?.pick as string | undefined }),
      trace(1, { band_code: response("A2")?.pick as string | undefined }),
      trace(2, {
        band_code: response("A3")?.judgment as string | undefined,
        correction_indexes: corrections("A3"),
      }),
      trace(3, {
        initial_judgment: response("A4")?.initialJudgment as "appropriate" | "inappropriate" | undefined,
        reason_ids: [response("A4")?.reasonId as string].filter(Boolean),
      }),
      trace(4, bestWorst("A5")),
    ];
  }

  if (runtime.mission.schema_version === "mission_v5" && items.length === 5) {
    return [
      trace(0, { scale_code: response("A1")?.pick as string | undefined }),
      trace(1, { band_code: response("A2")?.pick as string | undefined }),
      trace(2, {
        band_code: response("A3")?.judgment as string | undefined,
        correction_indexes: corrections("A3"),
      }),
      trace(3, {
        ...reasonTrace(3, "A4"),
      }),
      trace(4, bestWorst("A5")),
    ];
  }

  return [
    trace(0, { scale_code: response("A1")?.pick as string | undefined }),
    trace(1, {
      band_code: response("A2")?.pick as string | undefined,
      correction_indexes: corrections("A3"),
    }),
    trace(2, {
      ...reasonTrace(2, "A4"),
    }),
    trace(3, bestWorst("A5")),
  ];
}

export function shouldPersistMissionAttempt(
  runtime: RunnableMission | undefined,
  questKind: MissionQuest["kind"],
  demoMode: boolean,
): boolean {
  return Boolean(runtime) && questKind === "dct_feedback" && !demoMode;
}

export function CanonicalMissionRunner({ mission, runtime, isDevPreview, demoMode = false, courseContext }: {
  mission: CanonicalMissionViewModel;
  runtime?: RunnableMission;
  isDevPreview: boolean;
  /** 디펜스 시연은 실제 미션·피드백을 쓰되 학습자 수행 로그는 만들지 않는다. */
  demoMode?: boolean;
  courseContext?: MissionCourseLocation | null;
}) {
  const requestedMission = new URLSearchParams(window.location.search).get("mission")?.toUpperCase();
  const sceneIntroConfig = isDevPreview && requestedMission === "B"
    ? MISSION_B_SCENE_INTRO
    : buildSceneIntroConfig(mission);
  const startAtDct = Boolean(runtime)
    && mission.activityMode === "interpreting"
    && new URLSearchParams(window.location.search).get("start") === "dct";
  const dctQuestIndex = Math.max(0, mission.quests.findIndex((item) => item.kind === "dct"));
  const [sceneIntroStep, setSceneIntroStep] = useState<number | null>(startAtDct ? null : 0);
  const [questIndex, setQuestIndex] = useState(startAtDct ? dctQuestIndex : 0);
  const [completed, setCompleted] = useState(false);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<string, QuestResponse | DctResponse>>({});
  const [devPreset, setDevPreset] = useState<DevPreviewPreset>(readDevPreviewPreset);
  const [devAutofillQuestId, setDevAutofillQuestId] = useState<string | null>(null);
  const [feedbackRevisionOpen, setFeedbackRevisionOpen] = useState(false);
  const [mpjRecapOpen, setMpjRecapOpen] = useState(false);
  const [renderNonce, setRenderNonce] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const pendingSaveRef = useRef<{ input: SaveAttemptInput; logId: string } | null>(null);
  const savingRef = useRef(false);
  const startedAtRef = useRef(new Date().toISOString());
  const attemptStorageKey = runtime
    ? `pragma:mission-attempt:${runtime.scenario_id}:${courseContext?.assignmentId ?? "direct"}`
    : "pragma:mission-attempt:preview";
  const [attemptId, setAttemptId] = useState(() => getOrCreateMissionAttemptId(attemptStorageKey));
  const quest = mission.quests[questIndex];

  const emitMissionEvent = (eventType: MissionEventType, payload: Record<string, unknown> = {}) => {
    if (!runtime || demoMode) return;
    void appendMissionEvent({
      attemptId,
      scenarioId: runtime.scenario_id,
      missionId: runtime.scenario_id,
      eventType,
      contentVersion: runtime.mission.unit.target_feature_version ?? null,
      contentHash: runtime.mission.provenance?.mission_content_hash ?? null,
      policyVersion: POLICY_VERSION,
      consentVersion: CONSENT_VERSION,
      featureId: runtime.mission.unit.target_feature,
      speechAct: runtime.speech_act,
      direction: runtime.direction,
      taskMode: runtime.mission.production_task.mode === "interpreting" ? "interpreting" : "translation",
      payload,
      courseContext: courseContext ?? undefined,
    });
  };

  useEffect(() => {
    if (!runtime || demoMode) return;
    void appendMissionEvent({
      attemptId,
      scenarioId: runtime.scenario_id,
      missionId: runtime.scenario_id,
      eventType: "mission_session_opened",
      contentVersion: runtime.mission.unit.target_feature_version ?? null,
      contentHash: runtime.mission.provenance?.mission_content_hash ?? null,
      policyVersion: POLICY_VERSION,
      consentVersion: CONSENT_VERSION,
      featureId: runtime.mission.unit.target_feature,
      speechAct: runtime.speech_act,
      direction: runtime.direction,
      taskMode: runtime.mission.production_task.mode === "interpreting" ? "interpreting" : "translation",
      payload: { entry_mode: startAtDct ? "dct_shortcut" : "full_mission" },
      courseContext: courseContext ?? undefined,
    });
  }, [attemptId, courseContext, demoMode, runtime]);

  const updateDevPreviewUrl = (step?: string, preset = devPreset) => {
    const url = new URL(window.location.href);
    if (step) url.searchParams.set("step", step);
    else url.searchParams.delete("step");
    url.searchParams.set("preset", preset);
    window.history.replaceState({}, "", url);
  };

  const jumpToDevPreview = (step: string, preset = devPreset) => {
    const sceneStepIndex = SCENE_INTRO_STEP_IDS.indexOf(step as typeof SCENE_INTRO_STEP_IDS[number]);
    if (sceneStepIndex >= 0) {
      setSceneIntroStep(sceneStepIndex);
      setMpjRecapOpen(false);
      setResponses({});
      setReviewIndex(null);
      setCompleted(false);
      setQuestIndex(0);
      setDevAutofillQuestId(null);
      setFeedbackRevisionOpen(false);
      setRenderNonce((current) => current + 1);
      updateDevPreviewUrl(step, preset);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (step === "recap") {
      setSceneIntroStep(null);
      setMpjRecapOpen(true);
      setResponses(buildDevPreviewResponses(preset, false));
      setReviewIndex(null);
      setCompleted(false);
      setQuestIndex(4);
      setDevAutofillQuestId(null);
      setFeedbackRevisionOpen(false);
      setRenderNonce((current) => current + 1);
      updateDevPreviewUrl(step, preset);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const targetIndex = mission.quests.findIndex((item) => item.id === step);
    if (step !== "summary" && targetIndex < 0) return;
    setSceneIntroStep(null);
    setMpjRecapOpen(false);
    setResponses(buildDevPreviewResponses(preset, step === "summary"));
    setReviewIndex(null);
    setCompleted(step === "summary");
    setQuestIndex(step === "summary" ? mission.quests.length - 1 : targetIndex);
    setDevAutofillQuestId(null);
    setFeedbackRevisionOpen(false);
    setRenderNonce((current) => current + 1);
    updateDevPreviewUrl(step, preset);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!isDevPreview) return;
    const params = new URLSearchParams(window.location.search);
    const step = params.get("step");
    const preset = readDevPreviewPreset();
    if (step) jumpToDevPreview(step, preset);
  }, []);

  const advanceSceneIntro = () => {
    if (sceneIntroStep === null) return;
    const hasExplicitSceneStep = new URLSearchParams(window.location.search).has("step");
    if (sceneIntroStep < sceneIntroConfig.slides.length - 1) {
      const nextStep = sceneIntroStep + 1;
      setSceneIntroStep(nextStep);
      if (isDevPreview && hasExplicitSceneStep) updateDevPreviewUrl(SCENE_INTRO_STEP_IDS[nextStep]);
    } else if (sceneIntroConfig.previewOnly) {
      setSceneIntroStep(0);
      if (isDevPreview && hasExplicitSceneStep) updateDevPreviewUrl(SCENE_INTRO_STEP_IDS[0]);
    } else {
      setSceneIntroStep(null);
      if (isDevPreview && hasExplicitSceneStep) updateDevPreviewUrl("A1");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectSceneIntro = (nextStep: number) => {
    const boundedStep = Math.max(0, Math.min(sceneIntroConfig.slides.length - 1, nextStep));
    const hasExplicitSceneStep = new URLSearchParams(window.location.search).has("step");
    setSceneIntroStep(boundedStep);
    if (isDevPreview && hasExplicitSceneStep) updateDevPreviewUrl(SCENE_INTRO_STEP_IDS[boundedStep]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const persistPendingAttempt = async () => {
    const pending = pendingSaveRef.current;
    if (!pending || savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    try {
      const result = await saveMissionAttempt(pending.input, pending.logId);
      setSaveState(result.ok ? "saved" : "error");
      if (result.ok) {
        pendingSaveRef.current = null;
        emitMissionEvent("mission_completed", { mission_log_id: result.id });
      }
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  };

  const finishQuest = (response: QuestResponse | DctResponse) => {
    const nextResponses = quest.kind === "dct_feedback"
      ? { ...responses, [quest.id]: response, [quest.dctId]: response }
      : { ...responses, [quest.id]: response };
    setResponses(nextResponses);
    if (questIndex < 5) {
      emitMissionEvent("mpj_response_submitted", { quest_id: quest.id, response });
    } else if (quest.kind === "dct") {
      const dct = response as DctResponse;
      emitMissionEvent("first_response_submitted", { response: dct.first });
    }
    if (questIndex === mission.quests.length - 1) {
      setCompleted(true);
      setFeedbackRevisionOpen(false);
      if (runtime && shouldPersistMissionAttempt(runtime, quest.kind, demoMode)) {
        const finalResponse = response as DctResponse;
        emitMissionEvent("feedback_received", {
          feedback_available: Boolean(finalResponse.runtimeFeedback),
          revision_scope: finalResponse.runtimeFeedback?.revision_scope ?? null,
        });
        if (finalResponse.revised !== finalResponse.first) {
          emitMissionEvent("revision_submitted", { revised_response: finalResponse.revised });
        }
        if (finalResponse.dissent) {
          emitMissionEvent("learner_dissent_submitted", {
            dissent: finalResponse.dissent,
            final_decision: finalResponse.reflected ? "revised_response" : "retained_first_response",
          });
        }
        const saveInput: SaveAttemptInput = {
          mission: runtime.mission,
          scenarioId: runtime.scenario_id,
          speechAct: runtime.speech_act,
          level: runtime.learner_level,
          ...(courseContext
            ? { courseContext: { ...courseContext, attemptId } }
            : {}),
          firstResponse: finalResponse.first,
          revisedResponse: finalResponse.revised,
          ...(finalResponse.runtimeFeedback ? { feedback: finalResponse.runtimeFeedback } : {}),
          startedAtIso: startedAtRef.current,
          mpjResponses: startAtDct ? [] : buildRuntimeMpjTraces(runtime, nextResponses),
          ...(finalResponse.dissent
            ? {
                contextJudgment: {
                  kind: "learner_dissent" as const,
                  at: "feedback" as const,
                  conditions: finalResponse.dissent.conditions,
                  reason_ko: finalResponse.dissent.reason,
                  final_decision: finalResponse.reflected ? "revised_response" as const : "retained_first_response" as const,
                  created_at: new Date().toISOString(),
                },
              }
            : {}),
        };
        pendingSaveRef.current = { input: saveInput, logId: crypto.randomUUID() };
        void persistPendingAttempt();
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (questIndex === 4) {
      setMpjRecapOpen(true);
      const hasExplicitStep = new URLSearchParams(window.location.search).has("step");
      if (isDevPreview && hasExplicitStep) updateDevPreviewUrl("recap");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setQuestIndex((current) => current + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const restart = () => {
    if (savingRef.current) return;
    pendingSaveRef.current = null;
    setSceneIntroStep(startAtDct ? null : 0);
    setMpjRecapOpen(false);
    setQuestIndex(startAtDct ? dctQuestIndex : 0);
    setCompleted(false);
    setReviewIndex(null);
    setResponses({});
    setDevAutofillQuestId(null);
    setFeedbackRevisionOpen(false);
    setSaveState("idle");
    startedAtRef.current = new Date().toISOString();
    setAttemptId(rotateMissionAttemptId(attemptStorageKey));
    setRenderNonce((current) => current + 1);
    if (isDevPreview) updateDevPreviewUrl(undefined);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const continueFromMpjRecap = () => {
    setMpjRecapOpen(false);
    setQuestIndex(5);
    const hasExplicitStep = new URLSearchParams(window.location.search).has("step");
    if (isDevPreview && hasExplicitStep) updateDevPreviewUrl("A-DCT");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const primaryDct = mission.quests.find((item): item is DctQuest => item.kind === "dct");
  const aDct = primaryDct ? responses[primaryDct.id] as DctResponse | undefined : undefined;
  const peerCourseId = new URLSearchParams(window.location.search).get("courseId");
  const peerChoices = useMemo(
    () => runtime ? learnerChoiceMapFromTraces(buildRuntimeMpjTraces(runtime, responses)) : {},
    [runtime, responses],
  );
  const reviewedQuest = reviewIndex === null ? undefined : mission.quests[reviewIndex];
  const reviewedResponse = reviewedQuest ? responses[reviewedQuest.id] : undefined;
  const currentProgressIndex = completed ? mission.quests.length : questIndex;
  const navigateProgress = (index: number) => {
    if (isDevPreview) {
      jumpToDevPreview(mission.quests[index].id);
      return;
    }
    if (index === currentProgressIndex || !responses[mission.quests[index].id]) {
      setReviewIndex(null);
      return;
    }
    setReviewIndex(index);
  };

  return (
    <RuntimeMissionContext.Provider value={runtime ?? null}>
    <CanonicalMissionContext.Provider value={mission}>
    <LearnerJourneyShell missionLayout headerRight={<span className="hidden text-xs font-semibold text-white/75 sm:block">{mission.speechAct} 표현 · {mission.direction}</span>}>
      {isDevPreview && (
        <DevPreviewToolbar
          sceneIntroConfig={sceneIntroConfig}
          preset={devPreset}
          onPresetChange={(preset) => {
            setDevPreset(preset);
            updateDevPreviewUrl(new URLSearchParams(window.location.search).get("step") ?? undefined, preset);
          }}
          onJump={jumpToDevPreview}
          onFill={() => {
            setResponses(buildDevPreviewResponses(devPreset, false));
            setDevAutofillQuestId(quest.id);
            setRenderNonce((current) => current + 1);
          }}
          onReset={restart}
        />
      )}
      <div className="mx-auto max-w-3xl">
        {sceneIntroStep !== null ? (
          <div className="space-y-5">
            <Progress activeIndex={0} sceneIntroStep={sceneIntroStep} sceneIntroConfig={sceneIntroConfig} />
            <SceneIntroFlow
              config={sceneIntroConfig}
              step={sceneIntroStep}
              onNext={advanceSceneIntro}
              onPrevious={() => selectSceneIntro(sceneIntroStep - 1)}
              onSelect={selectSceneIntro}
            />
          </div>
        ) : mpjRecapOpen ? (
          <div className="space-y-5">
            <Progress activeIndex={5} mpjRecapOpen />
            <MpjLessonBridge lessonPoints={mission.lessonPoints} onContinue={continueFromMpjRecap} />
          </div>
        ) : reviewedQuest && reviewedResponse ? (
          <div className="space-y-5">
            <Progress activeIndex={currentProgressIndex} completed={completed} reviewIndex={reviewIndex} revisionOpen={feedbackRevisionOpen} />
            <ReviewModeBanner index={reviewIndex ?? 0} completed={completed} onExit={() => setReviewIndex(null)} />
            <CompletedQuestReview quest={reviewedQuest} response={reviewedResponse} />
          </div>
        ) : completed ? (
          <div className="space-y-5">
            <Progress activeIndex={currentProgressIndex} completed revisionOpen={feedbackRevisionOpen} />
            <section className="rounded-2xl bg-[#15202B] px-6 py-7 text-white sm:px-8">
              <p className="text-xs font-bold text-[#F3D248]">미션 완료</p>
              <h1 className="mt-2 text-2xl font-black">이번 미션에서 완성한 내 {mission.activityMode === "interpreting" ? "통역" : "번역"}</h1>
            </section>
            <div className="space-y-4">
              <CompletionRecord
                label={primaryDct?.title ?? `${mission.activityMode === "interpreting" ? "통역" : "번역"} 실습`}
                response={aDct}
                alternatives={primaryDct?.feedback.alternatives}
              />
            </div>
            <DissentSummary dissent={aDct?.dissent} />
            <SessionPatternSummary responses={[aDct]} />
            {runtime && !demoMode && (
              <PeerResponsesPanel
                courseId={peerCourseId}
                missionId={runtime.scenario_id}
                enabled={saveState === "saved"}
                learnerChoices={peerChoices}
              />
            )}
            <CompletionActions onRestart={restart} onRetrySave={() => void persistPendingAttempt()} runtime={Boolean(runtime) && !demoMode} saveState={saveState} />
          </div>
        ) : (
          <div className="space-y-5">
            <Progress activeIndex={currentProgressIndex} revisionOpen={feedbackRevisionOpen} />
            {startAtDct && quest.kind === "dct" && (
              <div className="rounded-xl border border-[#E3D08F] bg-[#FFF8E1] px-4 py-2.5 text-xs font-semibold text-[#6B5518]" role="status">
                수업용 DCT 바로가기 · 앞의 표현 판단 활동은 수행 기록에 포함되지 않습니다.
              </div>
            )}
            <QuestRenderer
              key={`${quest.id}-${demoMode && quest.kind === "dct_feedback" ? 0 : renderNonce}`}
              quest={quest}
              responses={responses}
              onDone={finishQuest}
              onRevisionStateChange={setFeedbackRevisionOpen}
              devMode={isDevPreview}
              devAutofill={devAutofillQuestId === quest.id}
              devDraft={demoMode && quest.kind === "dct" ? quest.referenceAnswer : DEV_PREVIEW_COPY[devPreset].a}
              demoFillRequest={demoMode && devAutofillQuestId === quest.id ? renderNonce : 0}
            />
          </div>
        )}
        {demoMode && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-[#E3D08F] bg-[#FFF8E1] px-3 py-2 text-xs text-[#6B5518]">
            <p className="flex flex-wrap items-center gap-x-2" role="status">
              <span className="font-black">디펜스 대표 미션 시연</span>
              <span>수행 기록 저장 안 됨</span>
            </p>
            {sceneIntroStep === null && !mpjRecapOpen && !completed && reviewIndex === null && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => {
                  setDevAutofillQuestId(quest.id);
                  setRenderNonce(current => current + 1);
                }}>데모 답안 채워넣기</Button>
                <span>확인·제출은 직접 눌러 주세요.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </LearnerJourneyShell>
    </CanonicalMissionContext.Provider>
    </RuntimeMissionContext.Provider>
  );
}

const CanonicalMissionRun = ({
  scenarioId: scenarioIdOverride,
  demoMode = false,
}: {
  scenarioId?: string;
  demoMode?: boolean;
} = {}) => {
  const { scenarioId: routeScenarioId } = useParams<{ scenarioId: string }>();
  const scenarioId = scenarioIdOverride ?? routeScenarioId;
  const courseLocation = parseMissionCourseLocation(window.location.search);
  const [runtimeMission, setRuntimeMission] = useState<CanonicalMissionViewModel | null>(null);
  const [runtimeRunnable, setRuntimeRunnable] = useState<RunnableMission | null>(null);
  const [fallbackToLegacy, setFallbackToLegacy] = useState(false);
  const [loading, setLoading] = useState(Boolean(scenarioId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!scenarioId) {
      setRuntimeMission(null);
      setRuntimeRunnable(null);
      setFallbackToLegacy(false);
      setLoading(false);
      setError(null);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError(null);
    setFallbackToLegacy(false);
    void fetchMissionByScenario(scenarioId)
      .then((runnable) => {
        if (cancelled) return;
        setRuntimeMission(adaptRunnableMissionToCanonical(runnable));
        setRuntimeRunnable(runnable);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof UnsupportedCanonicalMissionRuntimeError) {
          setFallbackToLegacy(true);
          return;
        }
        setError(reason instanceof Error ? reason.message : "미션을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [scenarioId]);

  if (courseLocation.ok === false) {
    return (
      <LearnerJourneyShell missionLayout>
        <section className="mx-auto max-w-3xl rounded-2xl border border-[#E5C8C2] bg-white px-6 py-8">
          <p className="text-xs font-black text-[#A44736]">교과목 수행 경로를 확인해 주세요</p>
          <p className="mt-2 text-sm leading-6 text-[#5B6678]">{courseLocation.error}</p>
          <Button asChild className="mt-5"><Link to="/learner/course">교과목으로 돌아가기</Link></Button>
        </section>
      </LearnerJourneyShell>
    );
  }

  if (scenarioId && fallbackToLegacy && !demoMode) return <LegacyMissionRun />;

  if (scenarioId && fallbackToLegacy) {
    return (
      <LearnerJourneyShell missionLayout>
        <section className="mx-auto max-w-3xl rounded-2xl border border-[#E5C8C2] bg-white px-6 py-8">
          <p className="text-xs font-black text-[#A44736]">대표 미션을 열지 못했습니다</p>
          <p className="mt-2 text-sm leading-6 text-[#5B6678]">현행 MJT5+DCT1 실행 계약을 지원하는 대표 미션을 다시 지정해 주세요.</p>
          <Button asChild className="mt-5"><Link to="/architecture">통합 구조로 돌아가기</Link></Button>
        </section>
      </LearnerJourneyShell>
    );
  }

  if (loading) {
    return (
      <LearnerJourneyShell missionLayout>
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 rounded-2xl border border-[#DED9CD] bg-white px-6 py-12 text-sm font-bold text-[#5B6678]">
          <LoaderCircle className="h-5 w-5 animate-spin" /> 실제 미션을 불러오고 있습니다.
        </div>
      </LearnerJourneyShell>
    );
  }

  if (error) {
    return (
      <LearnerJourneyShell missionLayout>
        <section className="mx-auto max-w-3xl rounded-2xl border border-[#E5C8C2] bg-white px-6 py-8">
          <p className="text-xs font-black text-[#A44736]">미션을 열지 못했습니다</p>
          <p className="mt-2 text-sm leading-6 text-[#5B6678]">{error}</p>
          <Button asChild className="mt-5"><Link to="/learner">학습 홈으로 돌아가기</Link></Button>
        </section>
      </LearnerJourneyShell>
    );
  }

  const mission = runtimeMission ?? CANONICAL_MISSION_PREVIEW;
  return (
    <CanonicalMissionRunner
      key={mission.scenarioId ?? "preview"}
      mission={mission}
      runtime={runtimeRunnable ?? undefined}
      isDevPreview={import.meta.env.DEV && !scenarioId}
      demoMode={demoMode}
      courseContext={courseLocation.context}
    />
  );
};

export default CanonicalMissionRun;
