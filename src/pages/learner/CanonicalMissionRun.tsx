import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeftRight,
  BookOpenText,
  Check,
  ChevronDown,
  ClipboardList,
  ChevronRight,
  Eye,
  LoaderCircle,
  ArrowDown,
  Lightbulb,
  ListChecks,
  Mic,
  MoveRight,
  PenLine,
  Quote,
  RotateCcw,
  X,
} from "lucide-react";

/** 절 제목 앞의 작은 아이콘 칩 — 이모지 대신 단색 선 아이콘으로 초점을 만든다. 색은 절의 바탕색 계열을 따른다. */
function SectionIcon({ icon: Icon, tone = "amber", iconClassName = "" }: { icon: typeof Quote; tone?: "amber" | "slate" | "navy"; iconClassName?: string }) {
  const tones = { amber: "bg-[#F6E6A4] text-[#6B5518]", slate: "bg-[#E6EBF1] text-[#2B3647]", navy: "bg-[#15202B] text-[#F7CE3E]" };
  return <span aria-hidden className={`mr-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}><Icon className={`h-3.5 w-3.5 ${iconClassName}`} strokeWidth={2.25} /></span>;
}

/** 해설 상자 제목 — 문항 해설 상자의 머리말. 꼬리표(NoteTag)와 같은 아이콘을 쓴다. */
function NoteHeading() {
  return <span className="flex items-center"><SectionIcon icon={BookOpenText} />해설</span>;
}

/** 답 확정 뒤 형제 패널(해설·참고 표현)의 제목 규격 — 24px 아이콘 칩 + 16px 굵은 제목. */
const panelHeading = "text-[16px] font-black leading-6 text-[#15202B]";

/** 해설 꼬리표 — 후보 문장·참고 표현 아래의 해설 줄이 모두 같은 표식을 쓴다. */
function NoteTag() {
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-[#FFF3C4] px-1.5 py-px text-[12px] font-black leading-5 text-[#6B5518]"><BookOpenText aria-hidden className="h-3 w-3" strokeWidth={2.5} />해설</span>;
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  type FreeCorrectionQuest,
  type SpectrumQuest,
  type MissionContext,
  type MissionLessonPoint,
  type MissionQuest,
  type CanonicalMissionViewModel,
  type ReasonQuest,
  type ScaleQuest,
} from "@/lib/mission/canonicalMissionPreview";
import { fetchMissionByScenario, type CanonicalRunnableMission as RunnableMission } from "@/lib/mission/missionDb";
import { buildMissionV6Responses } from "@/lib/mission/missionV6Responses";
import {
  adaptRunnableMissionToCanonical,
  UnsupportedCanonicalMissionRuntimeError,
} from "@/lib/mission/canonicalMissionRuntime";
import { createDctFeedbackSession, type DctFeedbackSession, type DctFeedbackSnapshot } from "@/lib/mission/dctFeedbackSession";
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
import { LEARNER_UX_PILOT, LEARNER_UX_PILOT_STORAGE_KEY } from "@/lib/mission/learnerUxPilot";
import { SAMPLE_MISSION_V6_REASON_CONTRAST, REASON_CONTRAST_PILOT_STORAGE_KEY } from "@/lib/mission/missionV6Sample";
import { REPRESENTATIVE_MISSION_ID, publicRepresentativeMission } from "@/lib/demo/representativeMission";
import { DEMO_FIRST_DRAFT, DEMO_MJT_ANSWERS, DEMO_REVISED_DRAFT, requestDemoFeedback } from "@/lib/demo/representativeDemoFeedback";

/** 현재 승인된 MPJ5 + DCT1 학습 경험의 유일한 정본 실행기. */
const CanonicalMissionContext = createContext<CanonicalMissionViewModel>(CANONICAL_MISSION_PREVIEW);
const useCanonicalMission = () => useContext(CanonicalMissionContext);
const RuntimeMissionContext = createContext<RunnableMission | null>(null);
const useRuntimeMission = () => useContext(RuntimeMissionContext);
const LocalPilotContext = createContext(false);
const DctFeedbackSessionContext = createContext<DctFeedbackSession | null>(null);
/** 대표 미션 시연(모델 하우스) — AI·DB를 쓰지 않고 준비된 예시 답안과 피드백을 보여 준다. */
const DemoModeContext = createContext(false);
/** 시연에서 지금 문항을 예시 답안으로 채우는 함수. 시연이 아니거나 문항 화면이 아니면 null. */
const DemoFillContext = createContext<(() => void) | null>(null);

/** 대표 미션 시연에서 이 문항에 미리 정한 시연 답안(의도적 오답 포함). 없으면 기준 답안을 쓴다. */
function useDemoAnswer(questId: string) {
  return useContext(DemoModeContext) ? DEMO_MJT_ANSWERS[questId] : undefined;
}

/** 채워질 자리 바로 옆(질문 줄 오른쪽)에 두는 시연용 자동 채우기 버튼. */
function DemoFillButton() {
  const fill = useContext(DemoFillContext);
  if (!fill) return null;
  return (
    <button type="button" onClick={fill}
      className="order-last inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 self-center sm:order-none sm:ml-auto sm:w-auto whitespace-nowrap rounded-full bg-[#FAD338] px-4 text-[13.5px] font-extrabold text-[#15202B] shadow-[0_1px_4px_rgba(201,166,46,0.25)] transition-colors hover:bg-[#FCE27A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2">
      <PenLine aria-hidden className="h-4 w-4" />답안 자동 채우기
    </button>
  );
}
/** 교수자 감수 화면(CanonicalReviewStage)에서 학습자 화면을 그릴 때 true. 학습자 화면에는 영향이 없다. */
const ReviewHostContext = createContext(false);

type QuestResponse = Record<string, unknown>;
// deferred = 의미 충실성이 무너져 뒤 층을 아직 보지 않음(DEC-20260918-04). 판정 원자료(verdicts)는 그대로 저장된다.
type FeedbackLevel = "very_good" | "recommend" | "required" | "deferred";
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
  /** A/B의 입력·피드백을 기존 수행 이벤트 JSON에 보존한다. 최종안은 revised다. */
  feedbackRounds?: DctFeedbackSnapshot[];
  dissent?: DissentResponse;
};
type DevPreviewPreset = "all_good" | "direct" | "over_mitigated" | "mixed";

/** 학급 응답 열람은 학습자 완료 화면에서 내려 둔다(2026-09-17). 기능과 관리자 공개는 그대로, 진입만 끈다. */
const SHOW_PEER_RESPONSES = false;

const panel = "rounded-2xl border border-[#DDD8CB] bg-white";
const taskPanel = "rounded-2xl border border-[#E2DCCB] bg-white";
const taskPanelBody = `${taskPanel} px-4 py-3 sm:px-5`;
const optionGrid = "mt-3 grid gap-1.5";
// break-keep — 없으면 한국어 낱말 중간에서 줄이 끊긴다(좁은 화면에서 특히).
// 비활성 상태를 옅게 — 기본 disabled 회색이 활성 버튼만큼 무거워 「지금 눌러야 할 것」이 흐려진다.
const actionButton = "w-full sm:w-auto sm:min-w-[240px] disabled:bg-[#E9E7E0] disabled:text-[#98A0AC] disabled:opacity-100";
const optionBase = "w-full rounded-xl border px-4 py-2 text-left text-[15px] break-keep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-1";

type SceneIntroConfig = {
  missionLabel: string;
  previewOnly?: boolean;
  context: MissionContext;
  outputName: string;
  practiceDescription?: string;
  /** v6 MJTs use separate scenes, so the intro briefs the flow without showing one scenario as the mission's anchor. */
  briefingOnly?: boolean;
};

function buildSceneIntroConfig(mission: CanonicalMissionViewModel): SceneIntroConfig {
  const production = mission.quests.find((quest): quest is DctQuest => quest.kind === "dct");
  return {
    missionLabel: mission.metaLabel ?? "이번 미션",
    context: production?.context ?? mission.quests[0].context,
    outputName: mission.activityMode === "interpreting" ? "통역" : "번역",
    practiceDescription: mission.quests.some(item => item.kind === "free_correction")
      ? "매번 다른 상황에서 표현을 판단하고, 고르고, 직접 고쳐 봅니다." : undefined,
    briefingOnly: mission.missionFormat === "mission_v6",
  };
}

const MISSION_A_SCENE_INTRO = buildSceneIntroConfig(CANONICAL_MISSION_PREVIEW);
const MISSION_B_SCENE_INTRO: SceneIntroConfig = {
  ...MISSION_A_SCENE_INTRO,
  missionLabel: "미션 2",
  previewOnly: true,
  context: {
    ...MISSION_A_SCENE_INTRO.context,
    situation: "같이 프로젝트를 하는 친한 동급생에게 오늘 저녁 온라인 회의를 30분 늦춰 달라고 요청합니다.",
    relation: "같이 프로젝트를 하는 친한 동급생",
    channel: "위챗",
    pdr: { p: "동등", d: "친한 사이", r: "부담 낮음" },
  },
};

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
  A4: "다음: 복수 표현 비교",
};

function nextActionLabel(quest: MissionQuest) {
  return quest.nextLabel ?? NEXT_ACTION_LABEL[quest.id] ?? "다음 문항으로";
}

function ActionBar({ hint, children }: { hint?: string; children: React.ReactNode }) {
  return (
    // 일반 문서 흐름에 둔다 — 하단에 고정하면 첫 화면부터 뷰포트 바닥을 가려, 자료를 읽기 전에 판단을 요구하게 된다.
    // 버튼을 상자에 담지 않는다 — 오른쪽 끝, 글자에 맞는 폭(폰에서는 꽉 찬 폭).
    <div className="mt-4 flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
      {hint && <p className="basis-full break-keep px-1 text-[13px] font-bold text-[#647084] sm:mr-auto sm:basis-auto" aria-live="polite">{hint}</p>}
      {children}
    </div>
  );
}

/**
 * v6 미션 시작 전 안내 — 학습 미션의 설계도. 두 국면(적절성 판단 MJT · 직접 산출 DCT형 통번역 과제)을
 * 같은 급의 카드로 나란히 두고, 각 단계 이름은 진행 막대·핵심 정리와 같은 한 벌을 쓴다.
 */
function v6IntroSteps(outputName: string) {
  return {
    judgment: [
      // 보조 설명은 학습자가 할 일을 「~하기」로 — 처음 보는 사람도 무엇을 하는 항목인지 바로 읽힌다. 12자 이내라 한 줄에 고정된다.
      { title: "단일 표현 판단", desc: "상황에 맞는지 판단하기" },
      // 보조 설명은 제목의 낱말을 그대로 받는다(판단·이유·비교·선택·수정) — 학생이 두 낱말을 따로 해석하지 않게.
      { title: "판단과 이유", desc: "판단의 이유 고르기" },
      { title: "복수 표현 비교", desc: "여러 표현을 비교해 보기" },
      { title: "수정안 선택", desc: "더 나은 수정안 선택하기" },
      { title: "직접 수정", desc: `${outputName}안을 직접 수정하기` },
    ],
    // 핵심 정리는 독립 과제가 아니라 직접 산출로 넘어가는 전환이라 따로 세지 않는다.
    production: [
      // 오른쪽 열은 행이 셋뿐이라 높이 여유가 있다 — 피드백 기준은 정본 명칭·순서대로 적고 두 줄을 허용한다.
      { title: `${outputName}하기`, desc: `상황에 맞게 ${outputName}하기` },
      { title: "AI 피드백", desc: "의미·문법·화용 기준" },
      // 수락/거부의 이분법이 아니라 결정 주체를 말한다 — 고치더라도 어떻게 고칠지는 학습자가 정한다(학습자의 최종 결정).
      { title: "최종 결정", desc: `최종 ${outputName}을 내가 결정하기` },
    ],
  };
}

/** 국면별 색 — 판단은 회청색, 산출은 호박색. 선 대신 알약의 바탕색으로 두 국면을 가른다. */
const INTRO_PHASE_TONE = {
  judgment: { pill: "bg-[#EEF2F6]", ring: "ring-[#C9D2DD] text-[#15202B]", band: "bg-[#15202B] text-white", caption: "text-white/70", mode: "bg-white/15 text-white ring-white/25" },
  production: { pill: "bg-[#FFFBEA] ring-1 ring-inset ring-[#F0DE8C]", ring: "ring-[#E4CB50] text-[#6B5518]", band: "bg-[#F7CE3E] text-[#15202B]", caption: "text-[#15202B]/70", mode: "bg-white/50 text-[#15202B] ring-white/60" },
} as const;

function IntroPhaseColumn({ tone, title, caption, mode, steps }: {
  tone: keyof typeof INTRO_PHASE_TONE;
  title: string;
  caption: string;
  /** 응답 방식 표지 — 선택형(고른다) / 산출형(직접 번역·통역한다). 처음 보는 사람에게 두 국면의 모드 차이를 먼저 알린다. */
  mode: { label: string; icon: typeof ListChecks };
  steps: { title: string; desc: string }[];
}) {
  const t = INTRO_PHASE_TONE[tone];
  const ModeIcon = mode.icon;
  return (
    <section aria-label={`${title} 단계`}>
      {/* 두 국면의 제목 띠 — 같은 높이, 잉크색/노랑으로 상위 구조를 먼저 보인다(2026-10-01 Codex 안). 아래 알약 목록은 그대로. */}
      <div className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3.5 ${t.band}`}>
        <div className="min-w-0">
          <h2 className="text-[17px] font-black leading-6">{title}</h2>
          <p className={`mt-0.5 text-[12px] font-bold ${t.caption}`}>{caption}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-black ring-1 ${t.mode}`}><ModeIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />{mode.label}</span>
      </div>
      {/* 배포본의 알약 언어 그대로 — 테두리·구분선 없이 바탕색 하나. 이름 열 폭을 고정해 설명이 한 선에서 시작한다. */}
      <ol className="mt-2.5 space-y-1.5" aria-label={`${title} 활동`}>
        {steps.map((step, index) => (
          <li key={step.title} className={`grid grid-cols-[22px_5.75rem_minmax(0,1fr)] items-center gap-x-2.5 rounded-lg px-3 py-2.5 ${t.pill}`}>
            <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white text-[11px] font-black ring-1 ${t.ring}`}>{index + 1}</span>
            <span className="break-keep text-[15.5px] font-semibold leading-6 text-[#15202B]">{step.title}</span>
            <span className="break-keep text-[14px] font-medium leading-5 text-[#3F4A57]">{step.desc}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function V6IntroOutline({ outputName }: { outputName: string }) {
  const steps = v6IntroSteps(outputName);
  // 두 국면을 같은 폭으로 나란히 — 가운데 화살표 하나가 판단에서 산출로의 전환을 표시한다. 오른쪽이 짧게 끝나도 늘리지 않는다.
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start sm:gap-2.5">
      <IntroPhaseColumn tone="judgment" title="적절성 판단" caption="MJT · 메타화용적 판단 과제" mode={{ label: "선택형", icon: ListChecks }} steps={steps.judgment} />
      {/* 두 띠를 잇는 연결선 — 띠 높이 중앙에서 Ⅰ→Ⅱ로 흐른다. 글자 크기 화살표 하나로는 장식으로 읽힌다. */}
      <div className="flex items-center justify-center sm:items-start sm:pt-[25px]" aria-hidden>
        <MoveRight className="hidden h-6 w-7 text-[#15202B] sm:block" strokeWidth={1.75} />
        <ArrowDown className="h-5 w-5 text-[#15202B] sm:hidden" strokeWidth={2.25} />
      </div>
      <IntroPhaseColumn tone="production" title={`직접 ${outputName}`} caption="DCT형 통번역 과제" mode={{ label: "산출형", icon: outputName === "통역" ? Mic : PenLine }} steps={steps.production} />
    </div>
  );
}
function SceneIntroFlow({ config, onNext }: { config: SceneIntroConfig; onNext: () => void }) {
  return (
    <section className={`${panel} overflow-hidden`} aria-label={`${config.missionLabel} 미션 안내`}>
      {/* 히어로는 채우지 않는다 — 남색 블록은 상단바와 「적절성 판단」 띠에만 두어 두 국면 띠가 페이지의 유일한 색 블록 쌍이 되게 한다. */}
      <div className="border-b-2 border-[#DDD8CB] bg-[#FBFAF6] px-5 pb-4 pt-5 sm:px-6">
        <p className="text-[11px] font-black tracking-[0.1em] text-[#8A6A14]">{config.missionLabel}</p>
        <h1 className="mt-1 break-keep text-[21px] font-black leading-8 tracking-[-0.01em] text-[#15202B] sm:text-[23px]">
          표현을 판단하고, 직접 {config.outputName}해 봅니다
        </h1>
        {/* 설계 원리 한 줄은 제목의 부제로 — 본문에 두면 채움말처럼 읽힌다. 「관계와 상황」 어순은 정본. */}
        <p className="mt-1.5 break-keep text-[14.5px] leading-6 text-[#635E52]">단어를 그대로 옮기기보다, 원문의 뜻과 의도를 살려 관계와 상황에 맞게 표현해 보세요.</p>
      </div>
      <div className="space-y-4 p-5">
        {config.briefingOnly ? (
          // v6: 각 활동이 무엇을 하는지만 알린다. 문항 내용·정답·DCT 장면은 보여 주지 않는다.
          <V6IntroOutline outputName={config.outputName} />
        ) : (
          <ol className="grid gap-3 sm:grid-cols-2">
            <li className="rounded-xl bg-[#F8F6EE] p-4">
              <h2 className="font-bold">1. 표현 판단 연습</h2>
              <p className="mt-1 text-sm leading-6 text-[#635E52]">{config.practiceDescription ?? "여러 상황의 표현을 살펴보며 다섯 문항에 답합니다. 같은 상황을 이어서 살펴보는 문항도 있습니다."}</p>
            </li>
            <li className="rounded-xl bg-[#F8F6EE] p-4">
              <h2 className="font-bold">2. 새로운 상황에서 직접 {config.outputName}</h2>
              <p className="mt-1 text-sm leading-6 text-[#635E52]">아래 상황의 원문을 직접 옮긴 뒤, AI 피드백을 검토하고 최종 {config.outputName}을 결정합니다.</p>
            </li>
          </ol>
        )}
        {!config.briefingOnly && <>
          <ContextCard context={config.context} title={`직접 ${config.outputName}할 상황`} />
          <dl className="grid gap-3 text-sm sm:grid-cols-[1fr_auto]">
            <div><dt className="text-xs font-bold text-[#7A7466]">상대·관계</dt><dd className="mt-1 leading-6">{config.context.relation}</dd></div>
            <div><dt className="text-xs font-bold text-[#7A7466]">전달 방식</dt><dd className="mt-1 leading-6">{config.context.channel}</dd></div>
          </dl>
        </>}
        <Button className={`text-[15px] font-extrabold ${config.previewOnly ? "h-12 w-full" : "mx-auto flex h-11 w-full gap-1.5 bg-[#FADB6A] px-8 text-[#15202B] hover:bg-[#FCE38A] sm:w-auto sm:min-w-[240px]"}`} onClick={onNext}>{config.previewOnly ? "도입 다시 보기" : "학습 미션 시작하기"} <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    </section>
  );
}

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\function RichLine(");
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
        <span key={index} className="font-zh rounded bg-white/75 px-1.5 py-0.5 text-[16.5px] font-semibold text-[#183E2E]">
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

/**
 * 상황문에서 「내가 지금 할 말」을 적은 문장의 위치. 말을 건네는 동사가 현재형으로 끝나는 마지막 문장을 고르고
 * (「…에게 연락합니다」「…사과하려고 합니다」), 없으면 마지막 문장이다. 「아직 …하지 않았습니다」 같은
 * 과거·완료형 조건 문장은 행동이 아니라 단서라 고르지 않는다.
 */
export function actionLineIndex(lines: string[]) {
  const speechVerb = /려고|연락|문의|부탁|요청|보냅|보내|건넵|전하|전합|알리|알립|사과|말하|말씀|답하|답합|여쭙|제기|물어|묻습|건의/;
  const completed = /[았었였]습니다[.!?]?$|않았|없었/;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (speechVerb.test(lines[index]) && !completed.test(lines[index].trim())) return index;
  }
  return lines.length - 1;
}

function ContextCard({ context, headerRight, title = "상황" }: {
  context: MissionContext;
  headerRight?: React.ReactNode;
  title?: string;
}) {
  const mission = useCanonicalMission();
  // v6: 화행 알약 + 상황문 두 요소만 남긴다. P·D·R과 상대·전달 방식은 상황문에서 학습자가 읽어내야 할
  // 단서이지 미리 요약해 줄 값이 아니다(관리자·검수 화면에는 그대로 있다).
  const compact = mission.missionFormat === "mission_v6";
  // 문장 단위로 줄을 나눠 화행 태그 오른쪽 열에 세운다 — 둘째 문장이 태그 아래로 흘러 들어가지 않는다.
  const situationLines = context.situation.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  const actionIndex = actionLineIndex(situationLines);
  return (
    <section className={compact
      ? "scene-in rounded-md border-l-4 border-[#15202B] bg-[#F2EEE3] px-5 py-3 sm:px-6 sm:py-3.5"
      : "rounded-xl border border-[#EDE4C8] bg-[#FBF7EA] px-4 py-3.5 sm:px-5"}>
      {!compact && (
        <div className="flex min-h-6 items-center justify-between gap-3">
          <p className="text-xs font-bold text-[#6B665C]">{title}</p>
          {headerRight}
        </div>
      )}
      {compact && <p className="mb-1 text-[12px] font-black tracking-[0.08em] text-[#15202B]">{title}</p>}
      {compact ? (
        // 화행은 상단 바에 이미 있다. 이 카드는 장면만 전한다.
        // 배경 문장은 한 단 낮추고, 내가 할 말(화행)을 적은 문장을 대시와 함께 세운다.
        <h2 className="break-keep">
          {situationLines.map((line, index) => {
            const action = index === actionIndex;
            return (
              <span key={line} className={action
                ? `${index > 0 ? "mt-1 " : ""}block text-[16px] font-medium leading-7 tracking-[-0.01em] text-[#2B2A26]`
                : `${index > 0 ? "mt-1 " : ""}block text-[15px] font-normal leading-6 text-[#4A4538]`}>
                {action && <span aria-hidden className="mr-2 inline-block h-px w-4 align-middle bg-[#C9A62E]" />}
                {line}
              </span>
            );
          })}
        </h2>
      ) : (
        <h2 className="mt-1.5 break-keep text-[17px] font-bold leading-8 text-[#101B2B]">{context.situation}</h2>
      )}      {context.precedingTurn && (
        <div className="mt-3 rounded-xl border-l-4 border-[#F0D34F] bg-[#F7F5EF] px-4 py-2.5">
          <p className="text-[12px] font-bold text-[#7A7466]">상대의 말</p>
          <p className="mt-1 break-keep text-[15px] leading-6">{context.precedingTurn}</p>
        </div>
      )}
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            ["상대적 권력", context.pdr.p],
            ["사회적 거리", context.pdr.d],
            ["행위 부담도", context.pdr.r.replace(/^부담\s*/, "")],
          ].map(([label, value]) => (
            <span key={label} className="rounded-full border border-[#E2DCCB] bg-white px-2.5 py-1 text-xs font-bold text-[#5C574C]">
              {label} · {value}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
/** 원문·번역안 배지는 같은 한 세트 — 모양·크기는 같고 농도만 다르다. */
const languageBadge = "inline-flex h-8 min-w-11 shrink-0 items-center justify-center rounded-lg border px-2.5 text-[12.5px] font-black";

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
    <section className="overflow-hidden rounded-2xl border border-[#E2DCCB] bg-white shadow-sm">
      <div className="flex items-start gap-3.5 bg-[#FBFAF4] px-4 py-2.5 sm:px-5">
        <span className={`mt-0.5 ${languageBadge} border-[#E2DCCB] bg-white text-[#4A4538]`}>{mission.sourceLanguage.badge}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold text-[#7A7466]">{mission.activityMode === "interpreting" ? "원문 발화" : "원문"}</p>
          <p className={`${sourceFont} break-keep text-[16px] font-semibold leading-7 text-[#101B2B]`}>{source}</p>
        </div>
      </div>
      {target && (
        <div className="flex items-start gap-4 border-t border-dashed border-[#E3DDCF] px-4 py-3 sm:px-5">
          <span className={`mt-0.5 ${languageBadge} border-[#15202B] bg-[#15202B] text-white`}>{mission.targetLanguage.badge}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-[#7A7466]">검토할 {outputName}</p>
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
      ? "border-[#15202B] bg-[#F8F7F2] font-bold text-[#15202B] ring-[0.6px] ring-[#15202B]"
      : "border-[#E3DDCF] bg-white hover:bg-[#FAF8F2]";
  }
  // 선택·정답·오답 테두리는 모두 1.6px(border 1px + ring 0.6px)로 일원화 — 가늘면 판정이 분간되지 않고, 1.75px 이상은 무겁다(2026-10-01).
  if (correct) return "border-[#4D8568] bg-white text-[#245E44] ring-[0.6px] ring-[#4D8568]";
  // 색은 선과 배지에만 — 정답과 같은 구조(흰 면 + 색 테두리)로 대칭을 맞춘다(2026-10-01).
  if (picked) return "border-[#C86E68] bg-white font-bold text-[#8B3531] ring-[0.6px] ring-[#C86E68]";
  return "border-[#E0DDD5] bg-[#FAF9F6] text-[#8A92A0]";
}

// 문항의 질문 표지(2026-09-25). 회색 「지금 할 일」 대신 노란 원형 「Q」로 「이게 질문」임을 먼저 보인다.
// 네이비는 바로 위 원문·번역안 배지(KO·ZH)와 겹쳐 쓰지 않는다. 질문이 둘인 MJT2는 「Q1」「Q2」.
const questionTitle = "flex flex-wrap items-start gap-2.5 [&>span:nth-child(2)]:min-w-0 [&>span:nth-child(2)]:flex-1 [&>span:nth-child(2)]:basis-0 break-keep text-[17px] font-bold leading-snug text-[#15202B]";
function QuestionChip({ n }: { n?: number }) {
  return (
    <span aria-hidden className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#FAD338] text-[13px] font-extrabold leading-none text-[#15202B]">
      {n ? `Q${n}` : "Q"}
    </span>
  );
}
// MJT2 이유 질문은 미션마다 같은 문장이라 화면 문구로 고정한다. 저장된 reason_choice.prompt는
// 콘텐츠 지문·승인 기록과 묶여 있어 고치지 않는다.
const REASON_PROMPT = "그렇게 판단한 이유는 무엇인가요?";

// 판정은 선택지 위에서 끝낸다(DEC-20260918-03). 내가 고른 선택지에 ✓/✕ 「내 선택」, 키 쪽 선택지에 배지 하나.
// 배지 낱말은 문항 성격을 따른다 — 적절성 판단 = 「기준 판단」+인접 허용 「허용 판단」, 키가 있는 선택형 = 「정답」.
function OptionButton({ option, value, disabled, answered = false, acceptedIds = [], radio = false, acceptedLabel = "정답", referenceId, onSelect }: {
  option: ChoiceOption;
  value: string | null;
  disabled?: boolean;
  answered?: boolean;
  acceptedIds?: string[];
  radio?: boolean;
  /** 키 쪽 선택지 배지. 적절성 판단은 「기준 판단」. */
  acceptedLabel?: string;
  /** 주면 이 선택지만 acceptedLabel이고, 나머지 허용 선택지는 「허용 판단」이다. */
  referenceId?: string;
  onSelect: (id: string) => void;
}) {
  const picked = value === option.id;
  const accepted = acceptedIds.includes(option.id);
  const badge = referenceId && option.id !== referenceId ? "허용 판단" : acceptedLabel;
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
            {picked && <span className={`inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[11px] font-black ${accepted ? "border-[#15202B] text-[#15202B]" : "border-[#C86E68] text-[#8B3531]"}`}>{accepted ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}내 선택</span>}
            {accepted && <span className="inline-flex items-center gap-1 rounded-full border border-[#80AB94] bg-white px-2 py-0.5 text-[11px] font-black text-[#245E44]"><Check className="h-3 w-3" />{badge}</span>}
          </span>
        )}
      </span>
    </button>
  );
}

// 문항별 해설 상자는 모두 이 모양 하나다(「해설」 머리말 + NoteHeading 아이콘).
const feedbackBox = "break-keep rounded-xl border border-[#DDD8CB] border-l-4 border-l-[#E0C43C] bg-[#FAF9F5] px-4 py-3.5 text-[15.5px] leading-7 text-[#15202B]";

function FeedbackBox({ verdict, feedback, action, highlights = [], asList = false }: {
  verdict?: string;
  feedback: string;
  action?: string;
  highlights?: string[];
  asList?: boolean;
}) {
  return (
    <div className={feedbackBox}>
      {verdict && <p className={`mb-2 ${verdict === "해설" ? panelHeading : "font-black text-[#15202B]"}`}>{verdict === "해설" ? <NoteHeading /> : verdict}</p>}
      {/* 일반 어휘·문법 설명(「표현 메모」)은 화면에 보이지 않는다 — 판단 근거인 화용 해설만 남긴다. 저장된 콘텐츠는 그대로다. */}
      {asList ? <ul className="list-disc space-y-1 pl-5">
        {withoutExpressionMemo(feedback).split(/\n|(?<=[.!?。！？])\s+/).filter(Boolean).map((line, index) =>
          <li key={index}><RichLine text={line} highlights={highlights} /></li>)}
      </ul> : <SentenceLines text={withoutExpressionMemo(feedback)} highlights={highlights} />}
      {action && (
        <div className="mt-3 rounded-lg border border-[#E5E1D8] bg-white px-3 py-2.5 font-semibold text-[#3F4A59]">
          <RichLine text={action} highlights={highlights} />
        </div>
      )}
    </div>
  );
}

/**
 * 확인 직후 맨 위에 두는 O/X 한 줄. 허용 범위 안의 판단이면 O다(대표 답과 한 칸 다른 인접 판단 포함).
 * partial은 여러 표현을 한꺼번에 판단하는 문항에서 일부만 맞았을 때 쓴다.
 */
function VerdictBanner({ tone, title, children }: { tone: "ok" | "miss" | "partial"; title: string; children?: React.ReactNode }) {
  const palette = tone === "ok"
    ? { box: "border-[#BFD9CC] bg-white text-[#245E44]", mark: "bg-[#245E44] text-white" }
    : tone === "miss"
      ? { box: "border-[#E2AAA5] bg-white text-[#713E3A]", mark: "bg-[#B5504A] text-white" }
      : { box: "border-[#E6D49A] bg-white text-[#6B5414]", mark: "bg-[#C9A62E] text-white" };
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-sm leading-6 ${palette.box}`}>
      <p className="flex items-center gap-2.5 text-[16px] font-black">
        <span aria-hidden className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${palette.mark}`}>
          {tone === "miss" ? <X className="h-5 w-5" strokeWidth={3.5} /> : <Check className="h-5 w-5" strokeWidth={3.5} />}
        </span>
        <span><span className="sr-only">{tone === "ok" ? "O " : tone === "miss" ? "X " : "일부 "}</span>{title}</span>
      </p>
      {children && <div className="mt-2 pl-[42px]">{children}</div>}
    </div>
  );
}

/** 후보 문장 아래에 붙는 해설 — 문제집처럼 꼬리표·작은 글씨·구분선으로 문장과 층을 나눈다. */
/** 문항 뒤 참고 답안 상자 — 「가능한 수정 예시」와 「참고 표현」이 같은 모양을 쓴다. */
function ReferenceExamples({ title, items, font }: { title: string; items: string[]; font: string }) {
  return (
    <section className="mt-4 rounded-xl border-l-4 border-l-transparent bg-[#F8F7F2] px-4 py-3.5" aria-label={title}>
      <h4 className={`flex items-center ${panelHeading}`}><SectionIcon icon={Quote} iconClassName="rotate-180" />{title}</h4>
      <ol className="mt-2 space-y-1.5">{items.map((text, index) => <li key={text} className="flex items-baseline gap-2.5 rounded-lg bg-white px-3 py-2">
        <span className="shrink-0 rounded-md bg-[#FAD338] px-1.5 py-px text-[11.5px] font-black text-[#15202B]">예시 {index + 1}</span>
        <span className={`${font} text-[16.5px] leading-7`}>{text}</span>
      </li>)}</ol>
    </section>
  );
}

function NoteLine({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2 border-t border-dashed border-[#DDD8CB] pt-2.5 text-[15.5px] font-normal leading-7 text-[#15202B]">
      <NoteTag />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

const DISSENT_CONDITIONS = [
  { code: "relationship", label: "관계에 대한 다른 판단" },
  { code: "burden", label: "행위의 부담 크기에 대한 다른 판단" },
  { code: "preceding", label: "앞선 대화 흐름을 더 고려함" },
  { code: "experience", label: "실제 사용 경험과 차이가 있음" },
] as const;

export function MissionDissentPanel({ onSubmit }: { onSubmit: (dissent: DissentResponse) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-xl border border-[#CFE4D8] bg-[#F2FAF6] px-4 py-3 text-[13px] leading-5 text-[#2E7D5B]">
        내 판단을 기록했습니다.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-[#B9C4CE] bg-white px-4 py-3 text-left text-[13px] text-[#3B4A57] transition hover:bg-[#F7F9FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
      >
        AI 피드백과 내 생각이 다르다면 <b>내 판단 남기기 →</b>
      </button>
    );
  }

  // 조건 선택지는 두지 않는다 — 한 줄 서술만 받고, 저장 구조의 조건 목록은 비워 둔다.
  return (
    <section className="rounded-xl border border-[#B9C4CE] bg-white px-4 py-4" aria-labelledby="mission-dissent-heading">
      <h3 id="mission-dissent-heading" className="text-sm font-black">AI 피드백과 내 생각이 다르다면</h3>
      <Textarea className="mt-3 text-[15px] leading-7" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="어떤 점에서 다르게 봤는지 한 줄로 적어 주세요." />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          disabled={!reason.trim()}
          onClick={() => {
            onSubmit({ conditions: [], reason: reason.trim() });
            setSent(true);
          }}
        >
          내 판단 남기기
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>닫기</Button>
      </div>
    </section>
  );
}
function ScaleView({ quest, onDone, devAutofill = false, revealAnswers = false }: { quest: ScaleQuest; onDone: (response: QuestResponse) => void; devAutofill?: boolean; revealAnswers?: boolean }) {
  const demoAnswer = useDemoAnswer(quest.id);
  const [pick, setPick] = useState<string | null>(() => revealAnswers ? quest.referenceAnswer : devAutofill ? demoAnswer?.pick ?? quest.referenceAnswer : null);
  const [answered, setAnswered] = useState(revealAnswers);
  // 이유를 묻는 문항(MJT2): 판단 확정 → 이유 선택·확정 → 판단과 이유의 결과·해설 공개(2026-09-19).
  // 판단을 확정하면 네 선택지와 내 선택은 그대로 두고 변경만 잠근다. 이유를 확정하기 전에는
  // 정답 배지·색상·스크린리더 안내 어디에도 판단 결과를 드러내지 않는다.
  const [judgmentCommitted, setJudgmentCommitted] = useState(revealAnswers);
  const [reasonId, setReasonId] = useState<string | null>(() => revealAnswers ? quest.reasonChoice?.acceptedId ?? null : devAutofill ? demoAnswer?.reasonId ?? quest.reasonChoice?.acceptedId ?? null : null);
  const acceptedIds = quest.acceptedAnswers ?? [quest.referenceAnswer];
  const judgmentLocked = answered || (Boolean(quest.reasonChoice) && judgmentCommitted);
  const judgmentShown = answered;
  const judgmentOk = pick !== null && acceptedIds.includes(pick);
  // 대표 판정은 하나다. 같은 방향의 인접 응답도 허용 범위라는 사실은 **답한 뒤에만** 알린다
  // (답하기 전에 알리면 4점 판단 자체를 무력화한다).
  const referenceLabel = quest.options.find((option) => option.id === quest.referenceAnswer)?.label ?? "";
  const pickLabel = quest.options.find((option) => option.id === pick)?.label ?? "";
  const alsoAcceptedLabels = quest.options
    .filter((option) => acceptedIds.includes(option.id) && option.id !== quest.referenceAnswer)
    .map((option) => option.label);
  const reasonAcceptedId = quest.reasonChoice?.acceptedId;
  const reasonOk = reasonId !== null && reasonId === reasonAcceptedId;
  const reasonLabel = (id: string | null | undefined) => quest.reasonChoice?.options.find(option => option.id === id)?.label;
  return (
    <QuestScaffold quest={quest} target={quest.target} targetHighlights={answered ? quest.targetHighlights : undefined}>
      <section className={taskPanelBody}>
        <h3 className={questionTitle}><QuestionChip n={quest.reasonChoice ? 1 : undefined} /><span className="pt-[3px]">{quest.prompt}</span>{!answered && !judgmentCommitted && <DemoFillButton />}</h3>
        <div className={optionGrid}>
          {quest.options.map((option) => (
            <OptionButton key={option.id} option={option} value={pick} disabled={judgmentLocked} answered={judgmentShown} acceptedIds={acceptedIds}
              acceptedLabel="기준 판단" referenceId={quest.referenceAnswer} onSelect={setPick} />
          ))}
        </div>
        {/* 눈으로는 배지가 판정을 전한다. 키보드·스크린리더에는 같은 내용을 문장으로 알린다. */}
        <p className="sr-only" aria-live="polite">
          {judgmentShown
            ? `${pick === quest.referenceAnswer ? "기준 판단과 같습니다" : judgmentOk ? "기준 판단과 다르지만 허용 판단에 해당합니다" : "기준 판단과 다릅니다"}. 내 선택 ${pickLabel}. 기준 판단 ${referenceLabel}.${alsoAcceptedLabels.length ? ` 허용 판단 ${alsoAcceptedLabels.join(", ")}.` : ""}`
            : judgmentLocked ? `판단을 확정했습니다. 내 선택 ${pickLabel}. 이제 판단한 이유를 골라 확정하면 판단과 이유의 결과가 함께 공개됩니다.` : ""}
        </p>
        {quest.reasonChoice && judgmentCommitted && <fieldset className="mt-5 border-t border-[#DDD8CB] pt-4">
          <legend className={`pt-4 ${questionTitle}`}><QuestionChip n={2} /><span className="pt-[3px]">{REASON_PROMPT}</span></legend>
          <div className="mt-3 space-y-2" role="radiogroup" aria-label="판단 이유">
            {quest.reasonChoice.options.map(option => <OptionButton key={option.id} option={option} value={reasonId} radio disabled={answered}
              answered={answered && Boolean(reasonAcceptedId)} acceptedIds={reasonAcceptedId ? [reasonAcceptedId] : []} acceptedLabel="기준 이유" onSelect={setReasonId} />)}
          </div>
          <p className="sr-only" aria-live="polite">
            {answered && reasonAcceptedId ? `${reasonOk ? "기준 이유와 같습니다" : "기준 이유와 다릅니다"}. 기준 이유 ${String(reasonLabel(reasonAcceptedId) ?? "").replace(/[.。]$/, "")}.` : ""}
          </p>
          {answered && !reasonAcceptedId && reasonId && <p className="mt-3 text-sm leading-6 text-[#635E52]">내 판단 이유 · {reasonLabel(reasonId)}</p>}
        </fieldset>}
        {answered && <div className="mt-4"><FeedbackBox verdict="해설" feedback={quest.feedback} highlights={quest.targetHighlights} asList={Boolean(quest.reasonChoice)} /></div>}
        {answered && quest.revisionExamples && <ReferenceExamples title="참고 표현" items={quest.revisionExamples} font="font-zh" />}
      </section>
      <ActionBar hint={!answered && !pick ? "가장 알맞은 답을 하나 선택해 주세요." : !answered && judgmentCommitted && !reasonId ? "판단한 이유를 하나 선택해 주세요." : undefined}>
        {!answered && quest.reasonChoice ? (
          <Button className={`h-11 ${actionButton}`} disabled={!pick || (judgmentCommitted && !reasonId)} onClick={() => {
            if (!judgmentCommitted) setJudgmentCommitted(true);
            else setAnswered(true);
          }}>{judgmentCommitted ? "이유 확정하기" : pick ? "판단 확정하기" : "답을 선택해 주세요"}</Button>
        ) : !answered ? (
          <Button className={`h-11 ${actionButton}`} disabled={!pick} onClick={() => setAnswered(true)}>{pick ? "판단 확정하기" : "답을 선택해 주세요"}</Button>
        ) : (
          <Button className={`h-11 ${actionButton}`} onClick={() => onDone({ pick, ...(reasonId ? { reasonId } : {}) })}>{nextActionLabel(quest)} <ChevronRight className="ml-1 h-4 w-4" /></Button>
        )}
      </ActionBar>
    </QuestScaffold>
  );
}

function FixChoiceView({ quest, responses, onDone, devAutofill = false, revealAnswers = false, correctionOnly = false }: {
  quest: FixChoiceQuest;
  responses: Record<string, QuestResponse | DctResponse>;
  onDone: (response: QuestResponse) => void;
  devAutofill?: boolean;
  revealAnswers?: boolean;
  correctionOnly?: boolean;
}) {
  const mission = useCanonicalMission();
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  const linkedJudgment = quest.judgmentQuestId
    ? (responses[quest.judgmentQuestId] as QuestResponse | undefined)?.pick as string | undefined
    : undefined;
  const [judgment, setJudgment] = useState<string | null>(() => revealAnswers ? quest.referenceJudgment : linkedJudgment ?? (devAutofill ? quest.referenceJudgment : null));
  const [locked, setLocked] = useState(correctionOnly || Boolean(linkedJudgment) || devAutofill || revealAnswers);
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
        <h3 className={questionTitle}><QuestionChip /><span className="pt-[3px]">{quest.prompt}</span>{!answered && <DemoFillButton />}</h3>
        {!correctionOnly && <div className={optionGrid}>
          {quest.judgmentOptions.map((option) => (
            <OptionButton key={option.id} option={option} value={judgment} disabled={locked} answered={locked} acceptedIds={[quest.referenceJudgment]} acceptedLabel="기준 판단" onSelect={setJudgment} />
          ))}
        </div>}
        {locked && (
          <div className={correctionOnly ? "mt-3" : "mt-5 border-t border-[#E4E0D5] pt-4"}>
            {!correctionOnly && <div className={`rounded-xl border px-4 py-3 text-sm leading-6 ${judgmentMatched ? "border-[#BFD9CC] bg-white text-[#245E44]" : "border-[#E2AAA5] bg-white text-[#713E3A]"}`}>
              <p className="flex items-center gap-2 font-black">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${judgmentMatched ? "bg-[#DCEFE4] text-[#245E44]" : "bg-[#F4D8D5] text-[#8B3531]"}`}>
                  {judgmentMatched ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
                </span>
                {judgmentMatched ? "기준 판단과 같아요" : "기준 판단과 달라요"}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                <span className="mt-2 rounded-full border border-current bg-white px-2 py-0.5">내 답안 · {judgmentLabel}</span>
                <span className="mt-2 rounded-full border border-[#80AB94] bg-white px-2 py-0.5 text-[#245E44]">기준 판단 · {referenceLabel}</span>
              </div>
              <p className="mt-2 break-keep">
                {judgmentMatched
                  ? "이 장면을 읽은 방향이 같습니다. 이제 같은 뜻을 더 자연스럽게 옮긴 안을 찾아보세요."
                  : "관계와 채널 단서를 다시 보고 수정안을 골라보세요."}
              </p>
            </div>}
            <div className={correctionOnly ? "" : "mt-5"}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                {!correctionOnly && <h4 className="font-bold">가장 알맞게 고친 표현은 무엇일까요?</h4>}
              </div>
              <div className={optionGrid}>
                {order.map((correction) => {
                  const picked = correctionId === correction.id;
                  const state = answered
                    ? correction.valid
                      ? "border-[#4D8568] bg-white text-[#263444] ring-[0.6px] ring-[#4D8568]"
                      : picked
                        ? "border-[#C86E68] bg-white text-[#263444] ring-[0.6px] ring-[#C86E68]"
                        : "border-[#E0DDD5] bg-white text-[#263444]"
                    : picked
                      ? "border-[#15202B] bg-[#F8F7F2] text-[#15202B] ring-[0.6px] ring-[#15202B]"
                      : "border-[#E3DDCF] bg-white";
                  return (
                    <button key={correction.id} type="button" disabled={answered} aria-pressed={picked} onClick={() => setCorrectionId(correction.id)} className={`${optionBase} min-w-0 [overflow-wrap:anywhere] ${state} disabled:cursor-default`}>
                      <span className="flex flex-col items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-3">
                        <span className={`${targetFont} min-w-0 max-w-full break-normal text-[16.5px] font-normal leading-7`}>{correction.text}</span>
                        {answered && (
                          <span className="flex max-w-full flex-wrap gap-1.5 sm:shrink-0 sm:justify-end">
                            {picked && <span className={`inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[11px] font-black ${correction.valid ? "border-[#15202B] text-[#15202B]" : "border-[#C86E68] text-[#8B3531]"}`}>{correction.valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}내 선택</span>}
                            {correction.valid && <span className="inline-flex items-center gap-1 rounded-full border border-[#80AB94] bg-white px-2 py-0.5 text-[11px] font-black text-[#245E44]"><Check className="h-3 w-3" />기준 선택</span>}
                          </span>
                        )}
                      </span>
                      {answered && <NoteLine><RichLine text={correction.note} /></NoteLine>}
                    </button>
                  );
                })}
              </div>
              <p className="sr-only" aria-live="polite">
                {answered && correctionId ? (quest.corrections.find(item => item.id === correctionId)?.valid ? "기준 선택에 해당합니다." : "기준 선택을 다시 살펴보세요. 해당 후보에 기준 선택 표시가 있습니다.") : ""}
              </p>
            </div>
          </div>
        )}
        {/* v6(correctionOnly): 후보별 해설이 본 해설이므로 공통 해설 문단은 감춘다. 저장된 콘텐츠는 그대로다. */}
        {answered && !correctionOnly && <div className="mt-4"><FeedbackBox verdict={`기준 판단 · 이 상황에서는 ${referenceLabel}`} feedback={quest.feedback} highlights={quest.targetHighlights} /></div>}
      </section>
      <ActionBar hint={!locked && !judgment ? "이 상황에서의 적절성을 먼저 판단해 주세요." : locked && !answered && !correctionId ? correctionOnly ? "상황에 맞게 고친 표현 하나를 선택해 주세요." : "가장 알맞은 교정안 하나를 선택해 주세요." : undefined}>
        {!locked ? (
          <Button className={`h-11 ${actionButton}`} disabled={!judgment} onClick={() => setLocked(true)}>{judgment ? "판단 확정하기" : "답을 선택해 주세요"}</Button>
        ) : !answered ? (
          <Button className={`h-11 ${actionButton}`} disabled={!correctionId} onClick={() => setAnswered(true)}>수정안 확정하기</Button>
        ) : (
          <Button className={`h-11 ${actionButton}`} onClick={() => onDone({ ...(!correctionOnly ? { judgment } : {}), correctionIds: correctionId ? [correctionId] : [] })}>{nextActionLabel(quest)} <ChevronRight className="ml-1 h-4 w-4" /></Button>
        )}
      </ActionBar>
    </QuestScaffold>
  );
}

/**
 * v6 자유교정은 결함안에서 출발하는 편집 과제다(DEC-20260918-05). 지시문은 할 일 하나만 말하고,
 * 의미 보존(Gate B)은 바로 아래 한 줄로 따로 둔다. 연구 용어(핵심 의미·화행 목적)는 화면에 쓰지 않는다.
 */
const freeCorrectionInstruction = (output: string) => `원문이 전달하려는 내용과 의도를 살려, ${output}을 관계와 상황에 맞게 고쳐 보세요.`;
const FREE_CORRECTION_FIDELITY = "원문에 없는 사실·이유·약속·합의는 새로 만들지 마세요.";

function FreeCorrectionView({ quest, onDone, devAutofill = false }: { quest: FreeCorrectionQuest; onDone: (response: QuestResponse) => void; devAutofill?: boolean }) {
  const mission = useCanonicalMission();
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  const output = mission.activityMode === "interpreting" ? "통역안" : "번역안";
  // 결함안을 미리 넣어 두고 고칠 곳만 바꾸게 한다. 그대로 제출은 아래 관문이 막는다.
  // 비교 기준(결함안)은 저장되는 수행 기록의 mission_content_hash가 가리키는 콘텐츠 버전의 이 문항 target이다.
  const demoAnswer = useDemoAnswer(quest.id);
  const [draft, setDraft] = useState(() => devAutofill ? demoAnswer?.text ?? quest.references[0] ?? quest.target : quest.target);
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const unchanged = draft.trim().length > 0 && normalize(draft) === normalize(quest.target);
  // 해설과 표현 메모는 한 문자열로 저장된다(콘텐츠 계약). 화면에서만 갈라 읽기 순서를 만든다:
  // 내가 고친 표현 → 화용 해설 → 참고 표현 → 다른 맥락. 표현 메모는 보이지 않는다.
  const { paragraphs } = useMemo(() => splitExpressionMemo(quest.feedback), [quest.feedback]);
  return <QuestScaffold quest={quest} target={quest.target}>
    <section className={taskPanelBody}>
      <h3 className={questionTitle}><QuestionChip /><span className="pt-[3px]">{freeCorrectionInstruction(output)}</span>{!submitted && <DemoFillButton />}</h3>
      <p className="mt-1 pl-10 text-[13.5px] font-bold text-[#8B3531]">{FREE_CORRECTION_FIDELITY}</p>
      {/* 답 영역은 MJT1~4의 선택지 버튼처럼 카드 여백선에 맞춘다 — 해설·참고 표현과 같은 선. Q 줄과 주의문만 들여쓴다. */}
      <div className="mt-4">
        <Textarea id="free-correction-draft" aria-label="내가 고친 표현" className={`${targetFont} text-[16.5px] leading-7`} rows={sourceAlignedRows(quest.target)} value={draft} readOnly={submitted} onChange={event => { setDraft(event.target.value); setTouched(true); }} />
        {!submitted && <p className="mt-2 text-xs leading-5 text-[#7A7466]">위 {output}을 미리 넣어 두었습니다. 필요한 부분만 고쳐 주세요.</p>}
      </div>
      {/* 해설은 문제집처럼 핵심만 한 줄씩 — 저장된 문단을 문장 단위로 끊어 불릿으로 보인다. */}
      {submitted && <section className={`mt-4 ${feedbackBox}`} aria-label="화용 해설">
        <h4 className={`mb-2 ${panelHeading}`}><NoteHeading /></h4>
        <ul className="list-disc space-y-1 pl-5">
          {paragraphs.flatMap(line => line.split(/(?<=[.!?。！？])\s+/)).filter(Boolean).map((line, index) => <li key={`${line}-${index}`} className="break-keep"><RichLine text={line} /></li>)}
        </ul>
      </section>}
      {submitted && <ReferenceExamples title="참고 표현" items={quest.references} font={targetFont} />}
      {submitted && quest.contrast && <section className="mt-5 rounded-xl border border-dashed border-[#DDD8CB] px-4 py-3" aria-label="다른 맥락에서는?">
        <h4 className="flex items-center text-[14px] font-black text-[#15202B]"><SectionIcon icon={ArrowLeftRight} tone="slate" />다른 맥락에서는?</h4>
        <p className="mt-0.5 text-[14.5px] leading-6 text-[#15202B]">{quest.contrast.context}</p>
        {/* 메신저의 「내가 보낸 말」 — 단색 블루·흰 글자로 메시지의 생동감을 살리되, 블루는 말풍선 한 곳에만 쓴다(2026-10-01). */}
        <div className="mt-2">
          <div className="flex justify-end">
            <p className={`${targetFont} max-w-[75%] rounded-[18px] rounded-br-md bg-[#326BD6] px-3.5 py-2 text-[15px] leading-7 text-white`}>{quest.contrast.target}</p>
          </div>
        {/* 관계 단서와 대비 표현만 제시하며 저장된 contrast 해설은 보존한다. */}
        </div>
      </section>}
    </section>
    <ActionBar hint={!submitted && unchanged && touched ? "원래 표현을 그대로 제출할 수 없습니다. 한 곳 이상 고쳐 주세요." : undefined}>
      {!submitted ? <Button className={`h-11 ${actionButton}`} disabled={!draft.trim() || unchanged} onClick={() => setSubmitted(true)}>수정안 확정하기</Button>
        : <Button className={`h-11 ${actionButton}`} onClick={() => onDone({ revisedText: draft.trim() })}>{nextActionLabel(quest)} <ChevronRight className="ml-1 h-4 w-4" /></Button>}
    </ActionBar>
  </QuestScaffold>;
}

function SpectrumView({ quest, onDone, devAutofill = false }: { quest: SpectrumQuest; onDone: (response: QuestResponse) => void; devAutofill?: boolean }) {
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  const demoAnswer = useDemoAnswer(quest.id);
  const [picks, setPicks] = useState<Record<string, string>>(() => devAutofill
    ? Object.fromEntries(quest.candidates.flatMap(candidate => {
      const pick = demoAnswer?.candidatePicks?.[candidate.id] ?? candidate.acceptedAnswers[0];
      return pick ? [[candidate.id, pick]] : [];
    }))
    : {});
  const [submitted, setSubmitted] = useState(false);
  const allPicked = quest.candidates.every(candidate => Boolean(picks[candidate.id]));
  const matched = quest.candidates.filter(candidate => candidate.acceptedAnswers.includes(picks[candidate.id] ?? "")).length;
  const total = quest.candidates.length;
  return <QuestScaffold quest={quest}>
    <section className={taskPanelBody}>
      <h3 className={questionTitle}><QuestionChip /><span className="pt-[3px]">{quest.prompt}</span>{!submitted && <DemoFillButton />}</h3>
      <div className="mt-4 space-y-4">{quest.candidates.map((candidate, index) => <fieldset key={candidate.id} className="min-w-0 rounded-xl border border-[#DDD8CB] p-3 sm:p-4">
        <legend className="px-1 text-sm font-bold">표현 {index + 1}</legend>
        <p className={`${targetFont} text-[16.5px] leading-7`}>{candidate.text}</p>
        <div className="relative mt-4 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={`표현 ${index + 1}의 판단`}>
          {quest.options.map(option => {
            const picked = picks[candidate.id] === option.id;
            const accepted = candidate.acceptedAnswers.includes(option.id);
            // MJT1·2와 같은 색 규칙: 답한 뒤 참고 답안은 초록 테두리, 내가 고른 오답은 연한 빨강.
            return <button key={option.id} type="button" role="radio" aria-checked={picked} disabled={submitted}
              onClick={() => setPicks(current => ({ ...current, [candidate.id]: option.id }))}
              className={`min-h-[42px] rounded-lg border px-1.5 py-2 text-xs font-semibold transition-colors sm:text-sm ${submitted ? optionState(true, picked, accepted) : optionState(false, picked, false)}`}>
              {submitted && picked && (accepted ? <Check className="mr-1 inline h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : <X className="mr-1 inline h-3.5 w-3.5" strokeWidth={3} aria-hidden />)}{option.label}
              {submitted && accepted && <span className="ml-1.5 inline-flex items-center rounded-full border border-[#80AB94] bg-white px-1.5 py-px align-[1px] text-[10.5px] font-black text-[#245E44]">기준 판단</span>}
            </button>;
          })}
        </div>
        {submitted && (() => {
          const ok = candidate.acceptedAnswers.includes(picks[candidate.id] ?? "");
          // 판정은 선택지 위에서 끝낸다(DEC-20260918-03) — 내 칩의 ✓/✕와 허용 칩의 꼬리표. 아래 줄은 해설만.
          return <div className="mt-1">
            <p className="sr-only">{ok ? "내 선택이 기준 판단에 해당합니다." : "내 선택이 기준 판단과 다릅니다."}</p>
            <p className="sr-only">기준 판단 · {quest.options.filter(option => candidate.acceptedAnswers.includes(option.id)).map(option => option.label).join(" / ")}</p>
            <NoteLine><RichLine text={candidate.note} /></NoteLine>
          </div>;
        })()}
      </fieldset>)}</div>
    </section>
    <ActionBar hint={!submitted ? `${Object.keys(picks).length}/${total}개 표현을 판단했습니다.` : undefined}>
      {!submitted ? <Button className={`h-11 ${actionButton}`} disabled={!allPicked} onClick={() => setSubmitted(true)}>판단 확정하기</Button>
        : <Button className={`h-11 ${actionButton}`} onClick={() => onDone({ candidateJudgments: picks })}>{quest.nextLabel ?? `다음: ${outputName}하기`} <ChevronRight className="ml-1 h-4 w-4" /></Button>}
    </ActionBar>
  </QuestScaffold>;
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
        verdict: "기준 이유를 찾았어요",
        intro: "이 상황에서 표현이 어색해지는 핵심 원인을 찾았습니다.",
        action: "다음 문항에서도 상황 단서와 표현의 기능을 연결해 보세요.",
      }
    : {
        verdict: "기준 이유를 다시 확인해요",
        intro: "선택한 이유보다 이 상황의 관계·거리·부담을 더 직접 설명하는 이유가 있습니다.",
        action: selectedReason ? `내가 고른 이유 · ${selectedReason.text}` : undefined,
      };
  return (
    <QuestScaffold quest={quest} target={quest.target} targetHighlights={answered ? quest.targetHighlights : undefined}>
      <section className={taskPanelBody}>
        <h3 className={questionTitle}><QuestionChip /><span className="pt-[3px]">이 표현이 상황에 맞지 않는 가장 큰 이유는 무엇일까요?</span>{!answered && <DemoFillButton />}</h3>
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
              feedback={`${reasonFeedback.intro} 기준 이유는 “${acceptedReason.text}”입니다. ${quest.feedback}`}
              action={reasonFeedback.action}
              highlights={quest.targetHighlights}
            />
          </div>
        )}
      </section>
      <ActionBar hint={!answered && !reasonId ? "가장 큰 이유 하나를 선택해 주세요." : undefined}>
        {!answered ? (
          <Button className={`h-11 ${actionButton}`} disabled={!reasonId} onClick={() => setAnswered(true)}>이유 확인하기</Button>
        ) : (
          <Button
            className={`h-11 ${actionButton}`}
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
        <h3 className={questionTitle}><QuestionChip /><span className="pt-[3px]">{quest.prompt}</span>{!answered && <DemoFillButton />}</h3>
        <div className="mt-3 flex items-center gap-3">
          <span className="inline-flex h-8 min-w-11 items-center justify-center rounded-lg bg-[#15202B] px-2.5 text-xs font-black text-white">{mission.targetLanguage.badge}</span>
          <span className="text-sm font-bold text-[#6B665C]">비교할 표현</span>
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
                : "border-[#E3DDCF] bg-[#FAF9F6]";
            return (
              <div key={candidate.id} className={`rounded-xl border px-4 py-2 ${answered ? answeredStyle : "border-[#E3DDCF] bg-white"}`}>
                {answered ? (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_max-content] sm:items-start sm:gap-4">
                    <div className="min-w-0">
                      <p className={`${targetFont} text-[16.5px] leading-7`}>{candidate.text}</p>
                      <p className="mt-1 break-keep text-[15px] leading-7 text-[#15202B]"><RichLine text={candidate.note} /></p>
                    </div>
                    <div className="flex flex-nowrap gap-1.5 whitespace-nowrap sm:justify-end">
                      <span className={`rounded px-2 py-1 text-[11px] font-black ${isBestRole ? "bg-[#DCEFE4] text-[#245E44]" : isWorstRole ? "bg-[#F4D8D5] text-[#8B3531]" : "bg-[#EEECE6]"}`}>{role}</span>
                      {bestPicked && <span className="rounded bg-[#15202B] px-2 py-1 text-[11px] font-black text-white">내 선택 · 적절</span>}
                      {worstPicked && <span className="rounded bg-[#15202B] px-2 py-1 text-[11px] font-black text-white">내 선택 · 조정 필요</span>}
                    </div>
                  </div>
                ) : (
                  // 좁은 화면에서는 후보 문장이 3~4자마다 끊기지 않도록 버튼을 아래로 내린다.
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <p className={`${targetFont} min-w-0 text-[16.5px] leading-7`}>{candidate.text}</p>
                    <div className="flex shrink-0 gap-2">
                    <button type="button" disabled={worstPicked} onClick={() => setBest(candidate.id)} className={`h-9 flex-1 rounded-lg border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-1 disabled:opacity-50 sm:flex-none ${bestPicked ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#E3DDCF] hover:bg-[#F8F7F2]"}`}>적절한 표현</button>
                    <button type="button" disabled={bestPicked} onClick={() => setWorst(candidate.id)} className={`h-9 flex-1 rounded-lg border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-1 disabled:opacity-50 sm:flex-none ${worstPicked ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#E3DDCF] hover:bg-[#F8F7F2]"}`}>조정할 표현</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <ActionBar hint={!answered ? (best && worst ? undefined : best ? "적절한 표현 선택 완료 · 조정할 표현을 골라주세요" : worst ? "조정할 표현 선택 완료 · 적절한 표현을 골라주세요" : undefined) : undefined}>
        {!answered ? (
          <Button className={`h-11 ${actionButton}`} disabled={!best || !worst || best === worst} onClick={() => setAnswered(true)}>두 표현 확인하기</Button>
        ) : (
          <Button className={`h-11 ${actionButton}`} onClick={() => onDone({ best, worst })}>다음: 직접 옮겨 보기 <ChevronRight className="ml-1 h-4 w-4" /></Button>
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
  // 코어에 저장된 힌트만 최대 3개. 기본은 접어 두고, 막혔을 때 직접 열어 본다.
  const hints = quest.vocabularyHints.slice(0, 3);
  if (hints.length === 0) return null;
  const sourceFont = mission.sourceLanguage.code === "zh" ? "font-zh" : "";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  return (
    // 토글 오른쪽으로 펼친다 — 입력창 바로 아래 한 줄에 힌트가 붙어 보면서 칠 수 있다. 꺾쇠(오른쪽)와 펼침 방향을 맞춘다.
    <details className="group/vocabulary mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md pr-1 text-[14.5px] font-black text-[#15202B] transition-colors hover:text-[#000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B59A32] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-[#FAD338] text-[#15202B]"><Lightbulb className="h-[18px] w-[18px]" strokeWidth={2.25} /></span>
        단어 힌트 보기<ChevronRight aria-hidden className="h-4 w-4 transition-transform group-open/vocabulary:rotate-180 motion-reduce:transition-none" strokeWidth={2.5} />
      </summary>
      <dl className="flex flex-wrap gap-2" aria-label="단어 힌트">
        {hints.map((hint) => (
          <div key={hint.source} className="inline-flex w-fit max-w-full items-baseline gap-2 rounded-[14px] rounded-bl-md bg-[#326BD6] px-3 py-1.5 text-white">
            <dt lang={mission.sourceLanguage.code} className={`${sourceFont} min-w-0 break-words text-[15px] font-semibold leading-6 text-white`}>{hint.source}</dt>
            <dd lang={mission.targetLanguage.code} className={`${targetFont} flex min-w-0 items-baseline gap-2 break-words text-[17px] font-medium leading-6 text-white`}><span aria-hidden className="text-[13px] font-normal text-white/60">·</span><span className="min-w-0 break-words">{hint.target}</span></dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
/** 학습자에게 보이는 피드백 기준 세 가지. 쓰기 전에도 같은 이름으로 미리 알린다. */
const FEEDBACK_CRITERIA_LABELS = ["의미적 충실성", "문법적 정확성", "화용적 적절성"] as const;

/**
 * 빈칸은 기준 문장보다 딱 한 줄만 크다. 크게 벌어진 칸은 「이만큼 써야 한다」로 읽힌다.
 * 기준 문장은 화면마다 다르다 — 직접 산출은 옮길 원문, 자유교정은 고쳐 쓸 대상 표현.
 */
function sourceAlignedRows(source: string) {
  const estimatedLines = source
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 45)), 0);
  return Math.min(6, Math.max(2, estimatedLines + 1));
}

/** DCT 입력칸 — 원문과 같은 줄 수로 시작한다(한·중 길이가 비슷하고, 작은 칸이 부담을 덜어 준다). */
function dctInputRows(source: string) {
  return Math.min(6, Math.max(2, sourceAlignedRows(source) - 1));
}

function DctDraftCard({ quest, value, onChange }: { quest: DctQuest; value: string; onChange: (value: string) => void }) {
  const mission = useCanonicalMission();
  const sourceFont = mission.sourceLanguage.code === "zh" ? "font-zh" : "";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  // 원문을 읽고 옮기는 한 벌 — 카드 전체에 금색 띠를 둘러 두 칸이 한 과제임을 보인다.
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E2DCCB] border-l-4 border-l-[#F0D34F] bg-white shadow-sm">
      <div className="flex items-start gap-4 bg-[#FBFAF4] px-4 py-3 sm:px-5">
        <span className={`mt-0.5 ${languageBadge} border-[#E2DCCB] bg-white text-[#4A4538]`}>{mission.sourceLanguage.badge}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-[#7A7466]">{mission.sourceLanguage.label} 원문</p>
          <p className={`${sourceFont} mt-0.5 break-keep text-[17px] font-semibold leading-8 text-[#101B2B]`}>{quest.source}</p>
        </div>
      </div>
      <div className="border-t border-dashed border-[#E3DDCF] bg-white px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-4">
          <span className={`${languageBadge} border-[#15202B] bg-[#15202B] text-white`}>{mission.targetLanguage.badge}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><label htmlFor={`${quest.id}-draft`} className="text-base font-bold leading-7">{mission.targetLanguage.label}로 옮겨 보세요.</label><DemoFillButton /></div>
            {/* 콘텐츠와 분리된 공통 안내로 의미 보존과 맥락 조건을 알린다. */}
            <p className="mt-0.5 break-keep text-[13px] leading-5 text-[#7A7466]">원문의 내용과 의도를 유지하면서, 관계와 상황에 맞게 작성해 보세요.</p>
          </div>
        </div>
        <div className="pl-[60px]">
        <Textarea
          id={`${quest.id}-draft`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={dctInputRows(quest.source)}
          className={`${targetFont} mt-3 min-h-0 resize-y border-[#E2DCCB] bg-white text-[16.5px] leading-7 focus-visible:ring-[#C9A62E]`}
        />
        <VocabularyHints quest={quest} />
        {/* 세 기준은 피드백 화면에서 만난다. 여기서는 부담을 더는 한 줄만. */}
        <p className="mt-3 break-keep text-[12.5px] leading-5 text-[#8A939F]">
          제출하면 AI 피드백을 확인하고 다시 검토합니다. 한 번에 완성하지 않아도 됩니다.
        </p>
        </div>
      </div>
    </section>
  );
}

const FEEDBACK_LEVEL_LABEL: Record<FeedbackLevel, string> = {
  very_good: "좋음",
  recommend: "수정 권장",
  required: "수정 필요",
  deferred: "다음 단계",
};

const FEEDBACK_LEVEL_STYLE: Record<FeedbackLevel, string> = {
  very_good: "bg-[#EAF4ED] text-[#286247]",
  // 수정 권장·수정 필요는 MJT 오답과 같은 빨강 계열 — 「고쳐야 한다」는 메시지를 색으로도 전한다(2026-10-01). 호박색은 허용·참고의 색.
  recommend: "bg-[#FCE7E4] text-[#8D3B36]",
  required: "bg-[#FCE7E4] text-[#8D3B36]",
  deferred: "bg-[#EEECE6] text-[#635E52]",
};

const FEEDBACK_LEVEL_CARD_STYLE: Record<FeedbackLevel, string> = {
  // 기준 카드는 흰 면 + 색 테두리, 배지만 색을 채운다 — 카드 셋이 모두 색면이면 「경고 벽지」가 된다.
  very_good: "border-[#C6DDCE] bg-white",
  recommend: "border-[#D79A94] bg-white",
  required: "border-[#D79A94] bg-white",
  deferred: "border-[#E2DED3] bg-[#FAF9F5]",
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
      label: "의미적 충실성",
      question: "뜻이 제대로 전달됐나요?",
      level: meaningOk ? "very_good" : "required",
      body: meaningOk
        ? "원문의 핵심 요청과 조건을 빠뜨리지 않고 옮겼습니다."
        : "누가 무엇을 요청하는지와 핵심 조건을 다시 확인해 주세요.",
    },
    {
      key: "language",
      label: "문법적 정확성",
      question: "중국어 표현에 문법적인 문제가 없나요?",
      level: languageLevel,
      body: languageLevel === "very_good"
        ? "의미를 이해하는 데 방해가 되는 표현 문제는 없습니다."
        : "문장이 너무 짧거나 불완전합니다. 중국어 문장으로 다시 작성해 주세요.",
    },
    {
      key: "pragmatics",
      label: "화용적 적절성",
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

const FIDELITY_FIRST_NOTE = "의미적 충실성을 먼저 보완하면, 재검토 단계에서 문법과 화용을 이어서 검토합니다.";

function feedbackLevel(ok: boolean, warning = false): FeedbackLevel {
  return ok ? "very_good" : warning ? "recommend" : "required";
}

export function evaluationFromRuntimeFeedback(
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
  // 네 층 순서(Gate B 충실성 → 대역 → 자연성): 뜻이 옮겨지지 않았으면 뒤 층 판정을 보여 주지 않고 순서만 알린다.
  const fidelityFirst = meaningLevel === "required";
  const grammarLevel = fidelityFirst ? "deferred" : feedbackLevel(feedback.verdicts.grammatical_accuracy === "clean");
  const pragmaticLevel = fidelityFirst ? "deferred" : feedbackLevel(pragmaticOk, true);
  const grammarNote = feedback.blocks.grammar[0];
  const criteria: FeedbackCriterion[] = [
    {
      key: "meaning",
      label: "의미적 충실성",
      question: "뜻이 제대로 전달됐나요?",
      level: meaningLevel,
      body: feedback.blocks.meaning_ko || (meaningLevel === "very_good"
        ? "원문의 핵심 의미가 유지되었습니다."
        : "원문에서 빠지거나 달라진 의미를 다시 확인해 주세요."),
    },
    {
      key: "language",
      label: "문법적 정확성",
      question: `${targetLanguage} 표현에 문법적인 문제가 없나요?`,
      level: grammarLevel,
      // 지적만 남기지 않고 고쳐 쓴 문장까지 함께 — 「어떻게 고치지」가 바로 보이게.
      body: fidelityFirst ? FIDELITY_FIRST_NOTE : [grammarNote?.explanation_ko, grammarNote?.suggested_correction && `고쳐 쓰면: ${grammarNote.suggested_correction}`]
        .filter(Boolean).join(" ") || (grammarLevel === "very_good"
        ? "의미 이해를 막는 문법 문제는 확인되지 않았습니다."
        : "이해를 방해하는 표현을 다시 확인해 주세요."),
    },
    {
      key: "pragmatics",
      label: "화용적 적절성",
      question: "이 관계와 상황에 잘 맞나요?",
      level: pragmaticLevel,
      body: fidelityFirst ? FIDELITY_FIRST_NOTE : feedback.blocks.feature_ko || (pragmaticOk
        ? "이번 목표 화용요소의 적정 범위에 들어갑니다."
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
    headline: allGood ? `아주 좋습니다. 이 ${outputName}으로 충분합니다.` : fidelityFirst ? "먼저 원문의 뜻을 옮겨 주세요." : "피드백을 확인하고 한 번 다듬어 보세요.",
    body: primary.body,
    highlights: !fidelityFirst && grammarNote?.anchor_text ? [grammarNote.anchor_text] : [],
    feedback: primary.body,
    action: !fidelityFirst && action && action !== primary.body ? action : undefined,
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
  const body = `AI 피드백을 불러오지 못했습니다. 참고 표현과 원문을 비교해 직접 다듬어 주세요. (${message})`;
  return {
    available: false,
    criteria: [
      { key: "meaning", label: "의미적 충실성", question: "뜻이 제대로 전달됐나요?", level: "recommend", body },
      { key: "language", label: "문법적 정확성", question: `${targetLanguage} 표현에 문법적인 문제가 없나요?`, level: "recommend", body },
      { key: "pragmatics", label: "화용적 적절성", question: "이 관계와 상황에 잘 맞나요?", level: "recommend", body },
    ],
    headline: "AI 피드백을 불러오지 못했습니다.",
    body,
    highlights: [],
    feedback: body,
    action: `참고 표현을 복사하지 말고, 내 ${outputName}에서 한 곳을 직접 점검해 보세요.`,
    example: quest.referenceAnswer,
    takeaway: "판정이 불가능했던 수행은 점수로 해석하지 않습니다.",
  };
}

/** Display only: preserve complete diagnostic text in the response and disclosure. */
function feedbackSentences(value: string): string[] {
  return [...new Set((value.match(/[^.!?。！？]+[.!?。！？]?/gu) ?? [value]).map((part) => part.trim()).filter(Boolean))];
}

function conciseFeedback(value: string): string {
  return feedbackSentences(value).slice(0, 2).join(" ");
}

export function feedbackNeedsRevision(
  evaluation: Pick<DctEvaluation, "available" | "criteria">,
): boolean {
  return evaluation.available !== false
    && evaluation.criteria.some((criterion) => criterion.level !== "very_good");
}

const DEV_PREVIEW_COPY: Record<DevPreviewPreset, { label: string; a: string }> = {
  // 개발 미리보기 전용 채우기 문장. /demo/mission이 여는 v6 견본(세미나실 대여 요청)과 같은 원문을 옮긴 것이어야
  // 의미 충실성 판정이 엉뚱하게 나오지 않는다.
  all_good: {
    label: "수정 없이 확정",
    a: "您好，请问下周三下午三点到四点可以借用研讨室吗？我们想和社团的新成员开第一次见面会。",
  },
  direct: {
    label: "화용 보완 · 직접적",
    a: "下周三下午三点到四点我们要用研讨室，请帮我预约一下。社团新成员要开第一次见面会。",
  },
  over_mitigated: {
    label: "수정 없이 확정 · 완화형",
    a: "您好，实在不好意思打扰您。如果方便的话，不知道能不能麻烦您看看下周三下午三点到四点研讨室是否可以借用？我们想和社团的新成员开第一次见面会，给您添麻烦了。",
  },
  mixed: {
    label: "화용 보완 · 기본",
    a: "您好，下周三下午三点到四点我们要借用研讨室，请安排一下。社团新成员要开第一次见面会。",
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
        <div className="flex justify-end"><DemoFillButton /></div>
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
      <ActionBar hint={devMode || !draft.trim() ? undefined : validation.hint}>
        <Button className={`h-11 ${actionButton}`} disabled={!canSubmit} onClick={() => onDone({ first: draft.trim(), revised: draft.trim(), reflected: false })}>{canSubmit ? "번역 제출하기" : "번역안을 작성해 주세요"} <ChevronRight className="ml-1 h-4 w-4" /></Button>
      </ActionBar>
    </QuestScaffold>
  );
}

function FeedbackLoading() {
  return (
    <section className={`${panel} overflow-hidden`} aria-live="polite">
      <div className="flex items-center justify-between bg-[#F8F7F2] px-5 py-4">
        <div>
          <p className="text-xs font-black text-[#635E52]">AI 피드백 준비 중</p>
          <p className="mt-1 text-base font-black">번역안을 세 기준으로 살펴보고 있습니다</p>
        </div>
        <LoaderCircle className="h-6 w-6 animate-spin text-[#C6A521]" />
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-3">
        {FEEDBACK_CRITERIA_LABELS.map((label, index) => (
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

/**
 * 원문과 내 번역을 한 줄에 나란히 둔다 — 화면이 바뀌어도 원문이 곁에 있고,
 * 라벨 줄이 둘 사이를 벌리지 않도록 배지 옆에 바로 문장을 붙인다.
 */
function SourceAnswerCompare({ source, answer, highlights = [] }: {
  source: string;
  answer: string;
  highlights?: string[];
}) {
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const sourceFont = mission.sourceLanguage.code === "zh" ? "font-zh" : "";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E2DCCB] border-l-4 border-l-[#F0D34F] bg-white shadow-sm">
      <div className="flex items-start gap-3.5 bg-[#FBFAF4] px-4 py-2.5 sm:px-5">
        <span className={`mt-0.5 ${languageBadge} border-[#E2DCCB] bg-white text-[#4A4538]`}>{mission.sourceLanguage.badge}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold text-[#7A7466]">원문</p>
          <p className={`${sourceFont} break-keep text-[16px] font-semibold leading-7 text-[#101B2B]`}>{source}</p>
        </div>
      </div>
      <div className="flex items-start gap-3.5 border-t border-dashed border-[#E3DDCF] px-4 py-2.5 sm:px-5">
        <span className={`mt-0.5 ${languageBadge} border-[#15202B] bg-[#15202B] text-white`}>{mission.targetLanguage.badge}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold text-[#7A7466]">내 {outputName}</p>
          <p className={`${targetFont} break-keep text-[16px] leading-7 text-[#101B2B]`}>
            <HighlightedText text={answer} highlights={highlights} target />
          </p>
        </div>
      </div>
    </section>
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
  const localPilot = useContext(LocalPilotContext);
  const demo = useContext(DemoModeContext);
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  const first = response?.first ?? "";
  const sharedSession = useContext(DctFeedbackSessionContext);
  const [localSession] = useState(() => createDctFeedbackSession());
  const feedbackSession = sharedSession ?? localSession;
  const [ready, setReady] = useState(localPilot);
  const previewEvaluation = useMemo<DctEvaluation>(() => localPilot ? {
    // Authored display guidance only. Never inspect the answer or persist this as an evaluation.
    available: false,
    criteria: [{ key: "meaning", label: "의미적 충실성", question: "원문의 내용과 확정성을 유지했나요?", level: "recommend", body: quest.feedback.action }],
    headline: "원문과 비교해 내 번역을 확인해 보세요.",
    body: quest.feedback.action,
    feedback: quest.feedback.action,
    highlights: [],
    example: quest.referenceAnswer,
    takeaway: quest.feedback.action,
  } : evaluateDct(quest, first), [first, localPilot, quest]);
  const [evaluation, setEvaluation] = useState<DctEvaluation>(previewEvaluation);
  const [runtimeFeedback, setRuntimeFeedback] = useState<RuntimeFeedback | undefined>(response?.runtimeFeedback);
  const [revised, setRevised] = useState(() => devAutofill ? quest.referenceAnswer : first);
  const [revisionOpen, setRevisionOpen] = useState(devAutofill);
  const [dissent, setDissent] = useState<DissentResponse | undefined>(response?.dissent);
  const [recheckRequested, setRecheckRequested] = useState(false);
  const [recheck, setRecheck] = useState<DctFeedbackSnapshot>();
  const recheckStarted = useRef(false);
  const revisionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!demoFillRequest) return;
    const example = demo ? DEMO_REVISED_DRAFT : quest.feedback.alternatives.find(item => normalize(item.text) !== normalize(first))?.text
      ?? quest.referenceAnswer;
    setRevised(example);
    setRevisionOpen(true);
  }, [demo, demoFillRequest, first, quest]);
  useEffect(() => {
    let cancelled = false;
    if (localPilot) {
      setEvaluation(previewEvaluation);
      setReady(true);
      return;
    }
    setReady(false);
    if (runtime) {
      void feedbackSession.request(1, runtime.mission, first).then((result) => {
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
        const savedRecheck = feedbackSession.snapshot().find(round => round.round === 2);
        if (savedRecheck && feedbackSession.snapshot()[0]?.answer === first) {
          recheckStarted.current = true;
          setRecheckRequested(true);
          setRecheck(savedRecheck);
          setRevised(savedRecheck.answer);
          setRevisionOpen(true);
          setEvaluation(savedRecheck.result.ok && savedRecheck.result.feedback
            ? evaluationFromRuntimeFeedback(runtime, quest, savedRecheck.result.feedback)
            : unavailableRuntimeEvaluation(quest, savedRecheck.result.error ?? "AI 재확인 실패", mission.targetLanguage.label, outputName));
        }
        setReady(true);
      });
      return () => { cancelled = true; };
    }
    const timer = window.setTimeout(() => setReady(true), 1250);
    return () => window.clearTimeout(timer);
  }, [feedbackSession, first, localPilot, mission.targetLanguage.label, outputName, previewEvaluation, quest, runtime]);
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
  const revisionValidation = validateDraft(revised, mission.targetLanguage.label, outputName);
  const canConfirmRevision = ready && (devMode || (revisionValidation.valid && (recheckRequested || !needsChange || reflected)));
  const canRetainWithDissent = Boolean(dissent);
  const actionHint = devMode ? undefined : revisionValidation.hint ?? (!recheckRequested && needsChange && !reflected && !canRetainWithDissent ? `피드백을 참고해 한 곳 이상 수정하거나, 이전 화면의 「이대로 확정」에서 이유를 적고 최초 ${outputName}을 유지해 주세요.` : undefined);
  const feedbackRounds = runtime ? feedbackSession.snapshot() : undefined;
  const confirmRevision = () => onDone({ first, revised: revised.trim(), reflected,
    evaluation: localPilot ? undefined : evaluation, runtimeFeedback, feedbackRounds, dissent });
  const checkRevision = async () => {
    if (!runtime || !ready || !canConfirmRevision || !reflected || recheckStarted.current) return;
    recheckStarted.current = true;
    const answer = revised.trim();
    setRecheckRequested(true);
    setReady(false);
    const result = await feedbackSession.request(2, runtime.mission, answer);
    setRecheck({ round: 2, answer, result });
    setEvaluation(result.ok && result.feedback
      ? evaluationFromRuntimeFeedback(runtime, quest, result.feedback)
      : unavailableRuntimeEvaluation(quest, result.error ?? "AI 재확인 실패", mission.targetLanguage.label, outputName));
    setReady(true);
  };
  const [keepOpen, setKeepOpen] = useState(false);
  const [keepReason, setKeepReason] = useState("");
  const keepWithReason = () => {
    const reason = { conditions: [], reason: keepReason.trim() };
    setDissent(reason);
    onDone({ first, revised: first.trim(), reflected: false, evaluation, runtimeFeedback, feedbackRounds, dissent: reason });
  };
  const retainFirstResponse = () => onDone({
    first,
    revised: first.trim(),
    reflected: false,
    evaluation: localPilot ? undefined : evaluation,
    runtimeFeedback,
    feedbackRounds,
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
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2 px-1"><h1 className="text-lg font-bold">{recheckRequested ? "수정안 AI 피드백" : "AI 피드백"}</h1>{ready && !revisionOpen && !recheckRequested && <DemoFillButton />}</div>
      <SourceAnswerCompare source={quest.source} answer={recheck?.answer ?? (recheckRequested ? revised : first)} highlights={ready ? evaluation.highlights : []} />
      {!ready ? <FeedbackLoading /> : (
        <>
          {/* 판정 한 줄 요약과 배지는 두지 않는다 — 세 기준 각각이 이미 등급과 이유를 말한다. */}
          {(!revisionOpen || recheckRequested) && <section className={`${panel} overflow-hidden border ${feedbackUnavailable || needsChange ? "border-[#E0CB72]" : "border-[#B8D4C2]"}`}>
            <div className="space-y-1.5 p-3 sm:p-3.5">
              {/* 정상일 때는 세 기준만 남기고, 예외 상태(AI 미실행·판정 실패)만 한 줄로 알린다. */}
              {(localPilot || feedbackUnavailable) && (
                <p className="rounded-lg bg-[#EEECE6] px-3 py-2 text-[12.5px] font-bold text-[#635E52]">
                  {localPilot ? "AI 미실행" : recheckRequested ? "AI 피드백을 불러오지 못했습니다. 현재 번역안을 직접 검토한 뒤 최종 결정할 수 있습니다." : "자동 피드백을 확인하지 못했습니다."}
                </p>
              )}
              {/* 판정이 주인공이다 — 세 기준의 판정을 한 줄에 나란히 두고, 걸린 기준 하나만 아래에서 설명한다. */}
              {localPilot ? evaluation.criteria.map((criterion) => {
                const passed = !localPilot && criterion.level === "very_good";
                const expanded = localPilot || (!passed && criterion.key === primaryCriterion.key);
                return (
                  <article key={criterion.key} className={`rounded-xl border px-4 py-2.5 ${localPilot ? "border-[#E2DED3] bg-[#FAF9F5]" : FEEDBACK_LEVEL_CARD_STYLE[criterion.level]}`}>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-[15px] font-black text-[#2B3647]">{criterion.label}</h3>
                      {!localPilot && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${FEEDBACK_LEVEL_STYLE[criterion.level]}`}>
                          {passed && <Check aria-hidden className="h-3 w-3" strokeWidth={3} />}{FEEDBACK_LEVEL_LABEL[criterion.level]}
                        </span>
                      )}
                    </div>
                    {expanded
                      ? <>
                        <p className="mt-1.5 text-[14.5px] leading-6">{conciseFeedback(criterion.body)}</p>
                      </>
                      : !passed && <p className="mt-1 text-[14.5px] leading-6 text-[#5A6673]">{feedbackSentences(criterion.body)[0]}</p>}
                  </article>
                );
              }) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {evaluation.criteria.map((criterion) => {
                      const passed = criterion.level === "very_good";
                      return (
                        <article key={criterion.key} className={`flex flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3.5 text-center ${FEEDBACK_LEVEL_CARD_STYLE[criterion.level]}`}>
                          <h3 className="text-[13.5px] font-bold text-[#4A5566]">{criterion.label}</h3>
                          <p className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[14px] font-black ${FEEDBACK_LEVEL_STYLE[criterion.level]}`}>
                            {passed ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} /> : <span aria-hidden className="font-black">!</span>}{FEEDBACK_LEVEL_LABEL[criterion.level]}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                  {!evaluation.criteria.every(criterion => criterion.level === "very_good")
                    && <div className="rounded-xl border border-l-4 border-[#EBD3D0] border-l-[#C86E68] bg-[#FFFAF9] px-4 py-3">
                      <p className="text-[12.5px] font-black text-[#8B3531]">{primaryCriterion.label} · {FEEDBACK_LEVEL_LABEL[primaryCriterion.level]}</p>
                      <p className="mt-1 text-[14.5px] leading-6">{conciseFeedback(primaryCriterion.body)}</p>
                    </div>}
                </>
              )}
            </div>

            <p className="border-t border-[#EEEAE1] px-4 py-2 text-[11.5px] leading-5 text-[#6D7788]">{localPilot ? "이번 로컬 체험에서는 AI 피드백을 실행하지 않습니다. 위 내용은 미리 작성한 확인 기준이며, 내 답안을 평가한 결과가 아닙니다." : demo ? "실제 AI가 같은 예시 답안에 준 피드백 기록입니다. 시연에서는 AI를 새로 호출하지 않습니다." : "AI 피드백입니다. 상황에 따라 다른 판단도 가능합니다."}</p>
          </section>}


          {revisionOpen ? (
            <>
              <section ref={revisionRef} className={`${panel} scroll-mt-24 p-5 sm:p-6`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black text-[#776727]">{recheckRequested ? "최종 결정" : "재검토"}</p>
                    <h2 className="mt-1 text-lg font-black">{localPilot ? "원문과 비교하며 다시 써보세요." : recheckRequested ? `최종 ${outputName}을 결정하세요.` : "피드백을 참고해 다시 써보세요."}</h2>
                  </div>
                  {!recheckRequested && <DemoFillButton />}
                </div>
                {!recheckRequested && (needsChange || localPilot) && (
                  <div className={`mt-4 rounded-xl border-l-4 px-4 py-3 ${needsChange ? "border border-[#EBD3D0] border-l-[#C86E68] bg-[#FFFAF9]" : "border-[#E0C247] bg-[#FFFBEC]"}`}>
                    {needsChange && <p className="mb-1.5 text-[12.5px] font-black text-[#8B3531]">{primaryCriterion.label} · {FEEDBACK_LEVEL_LABEL[primaryCriterion.level]}</p>}
                    <p className="text-sm leading-6">{conciseFeedback(primaryCriterion.body)}</p>
                  </div>
                )}
                <Textarea id={`${quest.id}-revise`} aria-label={recheckRequested ? `최종 ${outputName}` : "수정안"} value={revised} onChange={(event) => setRevised(event.target.value)} rows={dctInputRows(quest.source)} className={`${targetFont} mt-4 resize-y bg-white text-[16.5px] leading-8`} />
                {recheckRequested && <p className="mt-2 text-[12.5px] leading-5 text-[#6D7788]">추가 수정에는 AI 피드백을 다시 실행하지 않습니다. 최종 표현은 직접 결정하세요.</p>}
              </section>
              <ActionBar hint={actionHint}>
                <div className="flex w-full flex-wrap justify-end gap-2">
                  <Button className={`h-11 ${actionButton}`} disabled={!canConfirmRevision} onClick={runtime && !localPilot && reflected && !recheckRequested ? checkRevision : confirmRevision}>{recheckRequested ? `이 ${outputName}으로 확정하기` : runtime && !localPilot && reflected ? "수정안 제출하기" : reflected ? `이 ${outputName}으로 확정하기` : needsChange ? "피드백을 참고해 수정해 주세요" : `이 ${outputName}으로 확정하기`} <ChevronRight className="ml-1 h-4 w-4" /></Button>
                  {/* 수정 화면에서도 첫 산출 유지 경로로 되돌아갈 수 있다 — 피드백 화면의 「이대로 확정」(이유 한 줄)을 연 채로 돌아간다. */}
                  {!recheckRequested && (
                    <Button variant="outline" className="h-11 w-full" onClick={() => { setRevisionOpen(false); setKeepOpen(needsChange && !localPilot); }}>수정하지 않고 최초 {outputName} 유지하기</Button>
                  )}
                </div>
              </ActionBar>
            </>
          ) : (
            <ActionBar>
              {/* 양자택일 한 줄. 둘 다 타당한 학습자 결정이므로 같은 무게로 채운다 — 수정하기는 네이비, 이대로 확정은 노랑. */}
              <div className="grid w-full grid-cols-2 gap-2">
                <Button className="h-11 w-full font-bold" onClick={() => { setKeepOpen(false); setRevisionOpen(true); }}>수정하기 <ChevronRight className="ml-1 h-4 w-4" /></Button>
                <Button className="h-11 w-full bg-[#F7CE3E] font-bold text-[#15202B] shadow-[0_2px_8px_rgba(201,166,46,0.3)] hover:bg-[#F9D960]" aria-expanded={needsChange && !localPilot ? keepOpen : undefined}
                  onClick={needsChange && !localPilot ? () => setKeepOpen(open => !open) : retainFirstResponse}><Check aria-hidden className="mr-1.5 h-4 w-4" strokeWidth={3} />이대로 확정</Button>
              </div>
              {/* 수정 권장인데 그대로 두려면 이유 한 줄을 남긴다(이견 기록). */}
              {needsChange && !localPilot && keepOpen && (
                <div className="w-full rounded-xl border border-[#DDD8CB] bg-[#FCFBF8] p-3">
                  <label htmlFor={`${quest.id}-keep-reason`} className="text-[13.5px] font-bold text-[#2B3647]">이대로 두는 이유를 한 줄만 적어 주세요.</label>
                  <div className="mt-2 flex gap-2">
                    <Input id={`${quest.id}-keep-reason`} value={keepReason} onChange={(event) => setKeepReason(event.target.value)} placeholder="예: 이 관계에선 이 말투가 자연스러워요" className="h-11 flex-1 bg-white text-[14.5px]" />
                    <Button className="h-11 shrink-0 bg-[#F7CE3E] px-5 font-bold text-[#15202B] hover:bg-[#F9D960] disabled:bg-[#FBE8A6] disabled:text-[#6B5518] disabled:opacity-100" disabled={!keepReason.trim()} onClick={keepWithReason}>확정</Button>
                  </div>
                </div>
              )}
            </ActionBar>
          )}
        </>
      )}
    </div>
  );
}

// Display-only copy for this one local fixture; its scenario/PDR and all stored missions stay intact.
// An empty string means the source already supplies the context needed for this activity.
const PILOT_CONTEXT_COPY: Partial<Record<string, string>> = {
  A1: "친한 팀플 조원이 하기로 한 일을 메신저로 다시 부탁합니다.",
  A2: "수업에서만 뵌 교수님께 이메일로 처음 부탁하며, 아직 수락을 받지 않았습니다.",
  A3: "",
  A4: "같은 수업의 팀플 조원들과 나누는 메신저 대화입니다.",
  A5: "활동 중 몇 번 이야기한 한 학년 위 여자 선배와의 메신저 대화입니다.",
  "A-DCT": "처음 연락하는 학생회관 담당 직원에게 보내는 이메일입니다.",
  "A-FEEDBACK": "처음 연락하는 학생회관 담당 직원에게 보내는 이메일입니다.",
};

function QuestScaffold({ quest, target, targetHighlights, children }: {
  quest: MissionQuest;
  target?: string;
  targetHighlights?: string[];
  children: React.ReactNode;
}) {
  const mission = useCanonicalMission();
  const pilotContext = mission === LEARNER_UX_PILOT ? PILOT_CONTEXT_COPY[quest.id] : undefined;
  return (
    <div className="space-y-3">
      {pilotContext !== undefined
        ? pilotContext && <p className="px-1 text-[15.5px] font-medium leading-7 text-[#2B3647]">{pilotContext}</p>
        : <ContextCard context={quest.context} />}
      {quest.kind !== "dct" && <LanguagePair source={quest.source} target={target} targetHighlights={targetHighlights} />}
      {children}
    </div>
  );
}
const PROGRESS_LABELS: Record<string, string> = {
  A1: "표현 살펴보기",
  A2: "상황에 맞는지 판단하기",
  A3: "판단하고 고쳐보기",
  A4: "이유 찾기",
  A5: "여러 초안 비교",
  "A-FEEDBACK": "피드백 확인",
};

/** 산출 단계의 이름은 진행 바와 같아야 한다 — 미션 방식에 따라 「번역하기」·「통역하기」. */
function progressLabel(quest: MissionQuest, outputName = "번역") {
  // 진행 막대·핵심 정리·기록에 들어가는 짧은 이름. 미션 안내의 풀어 쓴 활동명과는 따로 둔다.
  if (quest.kind === "scale") return quest.reasonChoice ? "판단과 이유" : "단일 표현 판단";
  if (quest.kind === "fix_choice") return "수정안 선택";
  if (quest.kind === "free_correction") return "직접 수정";
  if (quest.kind === "spectrum") return "복수 표현 비교";
  if (quest.kind === "dct") return `${outputName}하기`;
  return PROGRESS_LABELS[quest.id] ?? quest.shortLabel;
}

const MACRO_PROGRESS = ["미션 안내", "적절성 판단", "직접 옮기기", "AI 피드백", "재검토"] as const;
/** 학습자에게는 「산출」·「옮기기」 대신 미션 방식 그대로 「번역하기」·「통역하기」로 읽힌다. */
function macroStages(outputName: string): string[] {
  return MACRO_PROGRESS.map((label) => label === "직접 옮기기" ? `${outputName}하기` : label);
}

function macroProgressIndex(activeIndex: number, completed: boolean | undefined, revisionOpen: boolean, sceneIntroStep: number | null) {
  if (completed) return MACRO_PROGRESS.length;
  if (sceneIntroStep !== null) return 0;
  if (activeIndex <= 4) return 1;
  if (activeIndex === 5) return 2;
  return revisionOpen ? 4 : 3;
}

function Progress({ activeIndex, completed, reviewIndex = null, revisionOpen = false, sceneIntroStep = null, sceneIntroConfig = MISSION_A_SCENE_INTRO, mpjRecapOpen = false, skipIntro = false, onJumpQuest, freeJump = false, onJumpStage }: {
  activeIndex: number;
  completed?: boolean;
  reviewIndex?: number | null;
  revisionOpen?: boolean;
  sceneIntroStep?: number | null;
  sceneIntroConfig?: SceneIntroConfig;
  mpjRecapOpen?: boolean;
  skipIntro?: boolean;
  /** 마친 판단 문항의 점을 눌러 그 기록으로 간다. 없으면 점은 표시만 한다. */
  onJumpQuest?: (index: number) => void;
  /** 대표 미션 시연 전용(2026-09-25): 아직 풀지 않은 문항 점도 눌러 바로 연다. 학습자 화면에는 켜지 않는다. */
  freeJump?: boolean;
  /** 시연 전용: 「적절성 판단」·「번역하기」 단계 막대를 눌러 MJT1·DCT로 바로 간다. */
  onJumpStage?: (stage: "judge" | "produce") => void;
}) {
  const mission = useCanonicalMission();
  const quests = mission.quests;
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const macroIndex = macroProgressIndex(activeIndex, completed, revisionOpen, sceneIntroStep) - (skipIntro ? 1 : 0);
  const stages = skipIntro ? macroStages(outputName).slice(1) : macroStages(outputName);
  // 다섯 문항 동안 큰 단계가 「적절성 판단」에 머무르므로, 그 안의 진행은 점 다섯 개가 따로 나른다.
  const judging = activeIndex <= 4 && sceneIntroStep === null && !completed && reviewIndex === null && !mpjRecapOpen;
  const detail = completed
    ? { phase: "미션 완료", activity: "미션 완료" }
      : reviewIndex !== null
      ? { phase: "기록 검토", activity: progressLabel(quests[reviewIndex], outputName) }
      : sceneIntroStep !== null
        ? { phase: "미션 안내", activity: sceneIntroConfig.missionLabel }
      : mpjRecapOpen
        ? { phase: `${outputName}하기`, activity: "핵심 정리" }
      : activeIndex <= 4
        ? { phase: `적절성 판단 · ${activeIndex + 1}/5`, activity: progressLabel(quests[activeIndex], outputName) }
        : activeIndex === 5
          ? { phase: `${outputName}하기`, activity: progressLabel(quests[activeIndex], outputName) }
          : revisionOpen
            ? { phase: "재검토", activity: `내 ${outputName} 재검토` }
            : { phase: "AI 피드백", activity: progressLabel(quests[activeIndex], outputName) };
  return (
    <section className="sticky top-16 z-30 border-b border-[#DDD8CC] bg-[#FBFAF6] px-3 py-2.5 sm:px-4" aria-label="미션 학습 흐름">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* 단계를 점과 선으로 따로 그리지 않고 이어진 막대 하나로 — 지난 구간 금색, 현재 구간 남색. */}
        <ol className="flex min-w-0 flex-1 gap-1.5" aria-label={stages.join(", ")}>
          {stages.map((label, index) => {
            const done = Boolean(completed) || index < macroIndex;
            const active = !completed && index === macroIndex;
            const jumpStage = label === "적절성 판단" ? "judge" : label === `${outputName}하기` ? "produce" : null;
            const body = (
              <>
                <span aria-hidden className={`block h-1.5 rounded-full ${done ? "bg-[#F3D248]" : active ? "bg-[#15202B]" : "bg-[#E4E0D5]"}`} />
                <span className={`mt-1.5 hidden truncate text-center text-[11.5px] leading-4 sm:block ${active ? "font-black text-[#15202B]" : done ? "font-bold text-[#96812A]" : "font-bold text-[#A8ADB5]"}`}>
                  {label}
                </span>
              </>
            );
            return (
              <li key={label} className="min-w-0 flex-1">
                {onJumpStage && jumpStage
                  ? <button type="button" aria-label={`${label} 단계로 이동`} onClick={() => onJumpStage(jumpStage)}
                      className="block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 hover:opacity-80">{body}</button>
                  : body}
              </li>
            );
          })}
        </ol>
        <div className="flex shrink-0 items-center gap-2.5 border-l border-[#DDD8CC] pl-3">
          <div className="min-w-0 text-right">
            <p className="truncate text-[13px] font-black text-[#15202B]">{detail.activity}</p>
            {judging && <p className="text-[11px] leading-4 text-[#8A939F]">{activeIndex + 1}/5</p>}
          </div>
          {judging && (
            <span className="flex items-center gap-1.5" role="group" aria-label={`적절성 판단 5개 중 ${activeIndex + 1}번째`}>
              {[0, 1, 2, 3, 4].map((index) => {
                const done = index < activeIndex;
                const dot = `h-2.5 w-2.5 rounded-full border ${done ? "border-[#D3B62D] bg-[#F3D248]" : index === activeIndex ? "border-[#15202B] bg-[#15202B]" : "border-[#CFCBC0] bg-white"}`;
                const clickable = Boolean(onJumpQuest) && (freeJump ? index !== activeIndex : done);
                return clickable && onJumpQuest
                  ? <button key={index} type="button" aria-label={freeJump ? `${index + 1}번째 문항으로 이동` : `${index + 1}번째 문항 기록 보기`} onClick={() => onJumpQuest(index)}
                      className={`${dot} transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-1`} />
                  : <span key={index} className={dot} aria-hidden />;
              })}
            </span>
          )}
        </div>
      </div>
      <span className="sr-only">현재 단계: {detail.phase}, {detail.activity}</span>
    </section>
  );
}
function QuestRenderer({ quest, responses, onDone, onRevisionStateChange, devMode = false, devAutofill = false, devDraft = "", revealAnswers = false, demoFillRequest = 0, localPilot = false }: {
  quest: MissionQuest;
  responses: Record<string, QuestResponse | DctResponse>;
  onDone: (response: QuestResponse | DctResponse) => void;
  onRevisionStateChange?: (open: boolean) => void;
  devMode?: boolean;
  devAutofill?: boolean;
  devDraft?: string;
  revealAnswers?: boolean;
  demoFillRequest?: number;
  localPilot?: boolean;
}) {
  if (quest.kind === "free_correction") return <FreeCorrectionView quest={quest} onDone={onDone} devAutofill={devAutofill} />;
  if (quest.kind === "spectrum") return <SpectrumView quest={quest} onDone={onDone} devAutofill={devAutofill} />;
  if (quest.kind === "scale") return <ScaleView quest={quest} onDone={onDone} devAutofill={devAutofill} revealAnswers={revealAnswers} />;
  if (quest.kind === "fix_choice") return <FixChoiceView quest={quest} responses={responses} onDone={onDone} devAutofill={devAutofill} revealAnswers={revealAnswers} correctionOnly={localPilot} />;
  if (quest.kind === "reason") return <ReasonView quest={quest} onDone={onDone} devAutofill={devAutofill} revealAnswers={revealAnswers} />;
  if (quest.kind === "best_worst") return <BestWorstView quest={quest} onDone={onDone} devAutofill={devAutofill} revealAnswers={revealAnswers} />;
  if (quest.kind === "dct_feedback") return <DctFeedbackView quest={quest} response={responses[quest.dctId] as DctResponse | undefined} onDone={onDone} onRevisionStateChange={onRevisionStateChange} devMode={devMode} devAutofill={devAutofill} demoFillRequest={demoFillRequest} />;
  return <DctDraftView quest={quest} onDone={onDone} devMode={devMode} devAutofill={devAutofill} devDraft={devDraft} />;
}

/** Admin-only host uses the same learner components, without the attempt runner.
 * No learner events, answer storage, or live DCT feedback is produced. After the DCT draft it shows the
 * learner's next stages (feedback → revision → final confirm) with the authored no-AI guidance.
 */
export function CanonicalReviewStage({ mission, section, revealAnswers, onNext }: {
  mission: CanonicalMissionViewModel; section: string; revealAnswers: boolean; onNext: () => void;
}) {
  const [responses, setResponses] = useState<Record<string, QuestResponse | DctResponse>>({});
  const [finalDct, setFinalDct] = useState<DctResponse | null>(null);
  const quest = section === "dct" ? mission.quests.find((item) => item.kind === "dct")
    : section.startsWith("mjt-") ? mission.quests.find(quest => quest.id === `A${Number(section.slice(4)) + 1}`) : undefined;
  const feedbackQuest = mission.quests.find((item): item is DctFeedbackQuest => item.kind === "dct_feedback");
  const draft = quest?.kind === "dct" ? responses[quest.id] as DctResponse | undefined : undefined;
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  return <ReviewHostContext.Provider value={true}><RuntimeMissionContext.Provider value={null}><CanonicalMissionContext.Provider value={mission}>
    <div className="space-y-5">
      {section === "scene" ? <SceneIntroFlow config={buildSceneIntroConfig(mission)} onNext={onNext} />
        : section === "recap" ? <MpjLessonBridge lessonPoints={mission.lessonPoints} onContinue={onNext} />
        : quest && quest.kind !== "dct_feedback" ? <>
          {draft && feedbackQuest ? finalDct ? <section className={`${panel} space-y-3 p-5`} aria-label="최종 확정 미리보기">
            <p className="text-xs font-black text-[#776727]">최종 확정</p>
            <h3 className="font-bold">학습자는 여기서 최종 {outputName}을 확정하고, 학습 기록이 저장됩니다.</h3>
            <p className="text-sm text-muted-foreground">감수 화면에서는 저장하지 않습니다.</p>
            <div><p className="text-xs font-bold text-[#7A7466]">최초 {outputName}</p><p className="mt-1 whitespace-pre-wrap text-lg">{finalDct.first}</p></div>
            <div><p className="text-xs font-bold text-[#7A7466]">확정한 {outputName}</p><p className="mt-1 whitespace-pre-wrap text-lg">{finalDct.revised}</p></div>
          </section> : <>
            <p className="rounded-lg border border-[#E3D08F] bg-[#FFF8E1] px-3 py-2 text-xs leading-5 text-[#6B5518]">실제 학습자 화면에서는 이 단계에서 AI 피드백을 받습니다. 감수 화면은 AI를 호출하지 않고, 미리 작성한 확인 기준으로 같은 피드백·다듬기·확정 순서를 보여 줍니다.</p>
            <LocalPilotContext.Provider value={true}>
              <DctFeedbackView quest={feedbackQuest} response={draft} onDone={setFinalDct} />
            </LocalPilotContext.Provider>
          </> : <QuestRenderer key={`${quest.id}-${revealAnswers}`} quest={quest} responses={responses} revealAnswers={revealAnswers}
            // Same direct-correction flow as the learner runner: v6 MJT3 has no judgment step before its corrections.
            localPilot={mission.missionFormat === "mission_v6"}
            onDone={(response) => {
              setResponses((current) => ({ ...current, [quest.id]: response }));
              if (quest.kind !== "dct") onNext();
            }} />}
          {quest.kind === "dct" && (revealAnswers || responses[quest.id]) && <section className={`${panel} space-y-3 p-5`}>
            <h3 className="font-bold">DCT형 통번역 과제 참고 표현·해설</h3>
            <p className="text-sm text-muted-foreground">정적 콘텐츠 감수입니다. 이 화면의 제출은 학습 기록이나 AI 피드백 요청을 만들지 않습니다.</p>
            {!quest.feedback.alternatives.length && <p className="whitespace-pre-wrap text-lg">{quest.referenceAnswer}</p>}
            {quest.feedback.alternatives.map((alternative, index) => <div key={index} className="border-t pt-3">
              <p className="whitespace-pre-wrap text-lg">{alternative.text}</p><p className="mt-1 text-sm">{alternative.note}</p>
            </div>)}
          </section>}
        </> : <p role="alert">이 문항을 학습자 화면으로 표시할 수 없습니다.</p>}
    </div>
  </CanonicalMissionContext.Provider></RuntimeMissionContext.Provider></ReviewHostContext.Provider>;
}

/**
 * 문항 해설(`explanation_ko`) 끝에 저장된 「표현 메모」 줄을 모은다.
 * 새 필드를 만들지 않고 이미 승인된 콘텐츠를 그대로 읽으므로, 메모가 없는 미션에서는 빈 배열이다.
 */
export type ExpressionNote = { term: string; gloss: string };
export const EXPRESSION_MEMO_LABEL = "표현 메모";

export function collectExpressionNotes(quests: readonly MissionQuest[]): ExpressionNote[] {
  const notes: ExpressionNote[] = [];
  const seen = new Set<string>();
  for (const quest of quests) {
    const feedback = "feedback" in quest && typeof quest.feedback === "string" ? quest.feedback : "";
    const lines = feedback.split(/\r?\n/);
    const start = lines.findIndex((line) => line.trim() === EXPRESSION_MEMO_LABEL);
    if (start < 0) continue;
    for (const line of lines.slice(start + 1)) {
      const body = line.trim();
      // 메모 블록은 해설 맨 끝에 오고 불릿으로만 이어진다 — 다른 줄을 만나면 거기서 끝난다.
      if (!body.startsWith("·")) break;
      const parsed = body.slice(1).trim().match(/^(`[^`]+`|「[^」]+」)\s*—\s*(.+)$/);
      if (!parsed) continue;
      const [, term, explanation] = parsed;
      if (seen.has(term)) continue;
      seen.add(term);
      // 정리 화면에서는 첫 문장까지만 — 상세 설명은 문항 피드백 카드에 그대로 남는다.
      const end = explanation.search(/[.。]/);
      notes.push({ term, gloss: end >= 0 ? explanation.slice(0, end + 1) : explanation });
    }
  }
  return notes;
}

/**
 * 같은 해설 문자열을 문항 화면에서 쓰기 위해 화용 해설 문단과 표현 메모 줄로 가른다.
 * 저장된 콘텐츠는 그대로 두고 표시 순서만 만든다 — 메모가 없으면 두 번째 배열이 비어 있다.
 */
export function splitExpressionMemo(feedback: string): { paragraphs: string[]; memo: string[] } {
  const lines = feedback.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === EXPRESSION_MEMO_LABEL);
  const body = (start < 0 ? lines : lines.slice(0, start)).map((line) => line.trim()).filter(Boolean);
  if (start < 0) return { paragraphs: body, memo: [] };
  const memo: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const text = line.trim();
    if (!text.startsWith("·")) break;
    const entry = text.slice(1).trim();
    if (entry) memo.push(entry);
  }
  return { paragraphs: body, memo };
}

/** 해설 문자열에서 「표현 메모」 줄부터 끝까지를 떼고 화용 해설만 돌려준다(원래 줄바꿈 유지). */
export function withoutExpressionMemo(feedback: string): string {
  const lines = feedback.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === EXPRESSION_MEMO_LABEL);
  return start < 0 ? feedback : lines.slice(0, start).join("\n").trimEnd();
}

function MpjLessonBridge({ lessonPoints, onContinue }: {
  lessonPoints: MissionLessonPoint[];
  onContinue: () => void;
}) {
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  return (
    <section className="rounded-2xl border border-[#DED9CD] bg-[#FCFBF7] px-5 py-4 shadow-[0_10px_28px_rgba(21,32,43,0.05)] sm:px-6" aria-label="문항별 핵심 정리">
      <h1 className="break-keep text-xl font-black text-[#15202B]">핵심 정리 <span className="ml-1 text-[14px] font-bold text-[#8A8375]">문항별 요점</span></h1>
      {/* 다섯 줄을 한 패널의 표처럼 — 이름 칸 폭을 고정해 한 줄 요약이 같은 선에서 시작하고, 스크롤 없이 한 화면에 들어온다. */}
      <ol className="mt-3 divide-y divide-[#EEEAE1] overflow-hidden rounded-xl border border-[#EAE5D8] bg-white">
        {lessonPoints.map((point, index) => (
          <li key={point.questId} style={{ animationDelay: `${index * 90}ms` }}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-baseline gap-x-3.5 gap-y-1.5 px-4 py-2.5 sm:grid-cols-[1.75rem_6.75rem_minmax(0,1fr)] sm:gap-x-4 sm:px-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both">
            <span aria-hidden className="grid h-[26px] w-[26px] place-items-center self-start rounded-full bg-[#FAD338] text-[12.5px] font-black text-[#15202B] sm:mt-[2px]">{index + 1}</span>
            <p className="text-[16px] font-black text-[#15202B]">{mission.missionFormat === "mission_v6"
              ? progressLabel(mission.quests.find(quest => quest.id === point.questId)!, outputName)
              : point.label}</p>
            <p className="col-start-2 min-w-0 break-keep text-[16.5px] font-normal leading-[30px] text-[#263444] [overflow-wrap:anywhere] sm:col-start-3">
              <HighlightedText text={point.text} highlights={point.highlights} target />
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex justify-end">
        <Button type="button" className={`h-11 font-black ${actionButton}`} onClick={onContinue}>
          직접 {outputName}해 보기 <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
function responseLabel(quest: MissionQuest, response: QuestResponse) {
  if (quest.kind === "scale") {
    const judgment = quest.options.find((item) => item.id === (response.revisedPick ?? response.pick))?.label ?? "선택 기록";
    const reason = quest.reasonChoice?.options.find(item => item.id === response.reasonId)?.label;
    return reason ? `${judgment}\n내 판단 이유 · ${reason}` : judgment;
  }
  if (quest.kind === "fix_choice") {
    const judgment = quest.judgmentOptions.find((item) => item.id === response.judgment)?.label;
    const ids = new Set((response.correctionIds as string[] | undefined) ?? []);
    const corrections = quest.corrections.filter((item) => ids.has(item.id)).map((item) => item.text);
    return judgment ? `${judgment} · ${corrections.join(" / ")}` : corrections.join(" / ") || "선택 기록";
  }
  if (quest.kind === "reason") {
    const judgment = response.initialJudgment === "appropriate" ? "적절하다" : response.initialJudgment === "inappropriate" ? "적절하지 않다" : null;
    const reason = quest.reasons.find((item) => item.id === response.reasonId)?.text;
    return [judgment, reason].filter(Boolean).join(" · ") || "이유 기록";
  }
  if (quest.kind === "free_correction") return typeof response.revisedText === "string" ? response.revisedText : "수정안 제출";
  if (quest.kind === "spectrum") {
    const picks = (response.candidateJudgments ?? {}) as Record<string, string>;
    return quest.candidates.map((candidate, index) => `표현 ${index + 1} · ${quest.options.find(option => option.id === picks[candidate.id])?.label ?? "-"}`).join("\n") || "여러 표현의 판단";
  }
  if (quest.kind === "best_worst") {
    const best = quest.candidates.find((item) => item.id === response.best)?.text;
    const worst = quest.candidates.find((item) => item.id === response.worst)?.text;
    return `내 선택 · 적절 · ${best ?? "-"}\n내 선택 · 조정 필요 · ${worst ?? "-"}`;
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
    <section className="flex flex-col gap-3 rounded-xl border border-[#E2DCCB] bg-[#F2F4F7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
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
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#776727]"><Eye className="h-3.5 w-3.5" /> {progressLabel(quest, outputName)} · 학습 기록</p>
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
                  <span className={`mt-2 inline-block rounded-full px-2 py-1 text-[11px] font-black ${FEEDBACK_LEVEL_STYLE[criterion.level]}`}>{FEEDBACK_LEVEL_LABEL[criterion.level]}</span>
                </div>
              );
            })()}
            <div><p className="text-xs font-bold text-[#677287]">최종 {outputName}</p><p className={`${targetFont} mt-1 text-[17px] leading-8`}>{feedbackResponse.revised}</p></div>
          </div>
        ) : dct ? (
          <div><p className="text-xs font-bold text-[#677287]">최초 {outputName}</p><p className={`${targetFont} mt-1 text-[17px] leading-8`}>{dct.first}</p></div>
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

export function CompletionRecord({ source, response, alternatives = [] }: {
  source?: string;
  response?: DctResponse;
  alternatives?: DctQuest["feedback"]["alternatives"];
}) {
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const sourceFont = mission.sourceLanguage.code === "zh" ? "font-zh" : "";
  const targetFont = mission.targetLanguage.code === "zh" ? "font-zh" : "";
  const finalText = response ? (response.reflected ? response.revised : response.first) : "";
  if (!response || !isMeaningfulDraft(response.first, mission.targetLanguage.label, outputName)) return null;
  // 저장된 학습자 결정만 표시한다. AI 평가에서 유지·수정을 추론하지 않는다.
  // 고친 곳을 지우거나 칠하지 않고 굵기도 같게 둔다 — 처음 쓴 것도 고친 것도 학습자가 쓴 것이고,
  // 어느 쪽이 맞다고 판정하지 않는다. 이름은 용어대장의 「최초 산출 → 최종 산출」을 따른다(2026-10-01 연구자 결정).
  // 「최종」은 정답이 아니라 학습자가 마지막에 결정한 표현이라는 뜻이며, 유지한 경우에도 그대로 맞는 이름이다.
  const revised = response.reflected && response.revised !== response.first;
  const row = "grid grid-cols-[88px_minmax(0,1fr)] items-baseline gap-3 py-3 first:pt-0 last:pb-0";
  const rowLabel = "text-[13px] font-black text-[#6B6453]";
  const rowText = "whitespace-pre-wrap break-keep text-[17px] leading-7 text-[#15202B]";
  return (
    <article className="space-y-4">
      <section aria-label={`${mission.targetLanguage.label} ${outputName} 완성본`}
        className="rounded-2xl border border-[#E6E1D4] bg-[#FDFCF8] px-5 py-4 shadow-[0_2px_10px_rgba(21,32,43,0.05)] sm:px-6">
        {/* 원문 → 최초 번역 → 최종 번역을 위아래로 훑어 대조하도록 가는 구분선으로 촘촘히 잇는다. */}
        <div className="divide-y divide-[#ECE7DA]">
          {source && <div className={row}>
            <span className={rowLabel}>{mission.sourceLanguage.label} 원문</span>
            <p className={`${sourceFont} ${rowText}`}>{source}</p>
          </div>}
          {revised && <div className={row}>
            <span className={rowLabel}>최초 {outputName}</span>
            <p className={`${targetFont} ${rowText}`}>{response.first}</p>
          </div>}
          <div className={row}>
            <span className={rowLabel}>최종 {outputName}</span>
            <p className={`${targetFont} ${rowText}`}>{finalText}</p>
          </div>
        </div>
      </section>
      {alternatives.length > 0 && <section className="rounded-2xl border-2 border-[#F0D34F] bg-[#FFFCEB] p-5 sm:p-6" aria-label="참고 표현">
        <h2 className={`flex items-center ${panelHeading}`}><SectionIcon icon={Quote} iconClassName="rotate-180" />참고 표현</h2>
        <ol className="mt-4 space-y-3">{alternatives.map((alternative, index) => <li key={alternative.text} className="rounded-xl border border-[#F3E3A2] bg-white p-4 shadow-[0_1px_4px_rgba(201,166,46,0.15)]">
          <span className="inline-block rounded-md bg-[#FAD338] px-2 py-0.5 text-[12px] font-black text-[#15202B]">예시 {index + 1}</span>
          <p className={`${targetFont} mt-2 text-[17px] font-medium leading-8 text-[#15202B]`}>{alternative.text}</p>
          <p className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2 break-keep border-t border-dashed border-[#F3E3A2] pt-2 text-[15.5px] leading-7 text-[#15202B]"><NoteTag /><span className="min-w-0"><RichLine text={alternative.note} /></span></p>
        </li>)}</ol>
      </section>}
    </article>
  );
}
/** 시연 학습 기록 — 실제 학습자는 「내 기록」에 저장되는 내용을, 시연에서는 저장 없이 이 자리에서 보여 준다. */
function DemoRecord({ quests, responses }: { quests: MissionQuest[]; responses: Record<string, QuestResponse | DctResponse> }) {
  const mission = useCanonicalMission();
  const outputName = mission.activityMode === "interpreting" ? "통역" : "번역";
  const items = quests.filter(quest => quest.kind !== "dct" && quest.kind !== "dct_feedback");
  return (
    <section id="demo-record" className={`${panel} scroll-mt-24 p-5 sm:p-6`} aria-label="데모 학습 기록">
      <h2 className="flex items-center text-[17px] font-black"><SectionIcon icon={ClipboardList} tone="navy" />데모 학습 기록</h2>
      <p className="mt-1 break-keep text-[13px] leading-5 text-[#6A7485]">실제 학습자는 이 기록이 「내 기록」에 저장됩니다. 데모에서는 저장하지 않고 여기에서만 보여 줍니다.</p>
      <ol className="mt-4 space-y-2.5">
        {items.map((quest, index) => {
          const response = responses[quest.id] as QuestResponse | undefined;
          return (
            <li key={quest.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-xl border border-[#EAE5D8] bg-white px-4 py-3">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-[#FAD338] text-[13px] font-extrabold">{index + 1}</span>
              <div className="min-w-0">
                <p className="inline-block rounded-md bg-[#E9EFF8] px-2 py-0.5 text-[12.5px] font-black text-[#2F4F86]">{progressLabel(quest, outputName)}</p>
                <p className="mt-1.5 whitespace-pre-line break-keep text-[15px] leading-7 text-[#263444]">{response ? <RichLine text={responseLabel(quest, response)} /> : "건너뜀"}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[13px] text-[#6A7485]">최초 {outputName}·최종 {outputName}은 위 완성 카드에 있습니다.</p>
    </section>
  );
}

function DissentSummary({ dissent }: { dissent?: DissentResponse }) {
  if (!dissent) return null;
  const labels = dissent.conditions.map((code) => DISSENT_CONDITIONS.find((condition) => condition.code === code)?.label ?? code);
  return (
    <section className="rounded-2xl border border-[#CFE4D8] bg-[#F2FAF6] p-5 sm:p-6">
      <p className="text-xs font-black text-[#2E7D5B]">내가 다르게 본 부분</p>
      <h2 className="mt-1 text-base font-black">내가 남긴 판단</h2>
      {labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {labels.map((label) => <span key={label} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#356B55]">{label}</span>)}
        </div>
      )}
      {dissent.reason && <p className="mt-3 break-keep text-sm leading-6 text-[#4F5B63]">{dissent.reason}</p>}
    </section>
  );
}

export function CompletionActions({ onRestart, onRetrySave, runtime = false, saveState = "idle", onShowDemoRecord }: {
  onRestart: () => void;
  /** 시연: 로그인 없이 이 화면 안에서 시연 학습 기록을 연다. */
  onShowDemoRecord?: () => void;
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
  const failed = runtime && saveState === "error";
  const secondaryNavigation = failed ? "bg-[#F8F7F2] text-[#15202B] hover:bg-[#EEECE6]" : null;
  return (
    <section className={`${panel} p-4 sm:p-5`}>
      {failed && <div role="alert" className="mb-4 rounded-xl border border-[#E2AAA5] bg-[#FFF3F1] p-4">
        <p className="text-sm font-bold text-[#713E3A]">학습 기록을 저장하지 못했습니다.</p>
        <p className="mt-1 text-sm leading-6 text-[#713E3A]">답안은 이 화면에 남아 있으니, 화면을 떠나기 전에 저장을 다시 시도해 주세요.</p>
        {onRetrySave && <Button className="mt-3 min-h-11 w-full sm:w-auto" onClick={onRetrySave}>학습 기록 저장 다시 시도</Button>}
      </div>}
      <div className={`grid gap-2 ${returnPath ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {returnPath && (
          <Link
            to={returnPath}
            aria-disabled={saving || undefined}
            onClick={(event) => { if (saving) event.preventDefault(); }}
            className={`flex h-11 items-center justify-center rounded-md px-4 text-center text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 ${secondaryNavigation ?? "bg-[#F3D248] text-[#15202B] hover:bg-[#F7DF73]"}`}
          >
            이번 주 학습으로 돌아가기
          </Link>
        )}
        {onShowDemoRecord ? <Button className="h-11 w-full" onClick={onShowDemoRecord}>데모 학습 기록 보기</Button> : <Link
          to="/learner/records#correction-notes"
          aria-disabled={saving || undefined}
          onClick={(event) => { if (saving) event.preventDefault(); }}
          className={`flex h-11 items-center justify-center rounded-md px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2 ${secondaryNavigation ?? "bg-[#15202B] text-white hover:bg-[#263547]"}`}
        >
          내 기록 보기
        </Link>}
        <Button variant="outline" className="h-11 w-full" onClick={onRestart} disabled={saving}><RotateCcw className="mr-2 h-4 w-4" />처음부터 다시 보기</Button>
      </div>
      {!failed && <p role="status" className="mt-3 break-keep text-[12px] leading-5 text-[#6A7485]">
        {runtime
          ? saveState === "saving"
            ? "학습 기록을 저장하고 있습니다."
            : saveState === "saved"
              ? "학습 기록에 저장되었습니다."
              : saveState === "error"
                ? "학습 기록을 저장하지 못했습니다. 답안은 이 화면에 남아 있으니, 화면을 떠나기 전에 저장을 다시 시도해 주세요."
                : "학습 기록 저장을 준비하고 있습니다."
          : "데모에서는 답안과 의견을 저장하지 않습니다."}
      </p>}
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
            <option value="scene-1">미션 안내</option>
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
  if (runtime.mission.schema_version === "mission_v6") return buildMissionV6Responses(runtime.mission, responses, completedAt);
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

function readLocalPilotProgress(enabled: boolean, storageKey: string) {
  if (!enabled) return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (!value || !Number.isInteger(value.questIndex) || value.questIndex < 0 || value.questIndex > 6
      || typeof value.completed !== "boolean" || typeof value.mpjRecapOpen !== "boolean"
      || (value.sceneIntroStep !== null && value.sceneIntroStep !== 0)
      || !value.responses || typeof value.responses !== "object" || Array.isArray(value.responses)) return null;
    return value as {
      questIndex: number; completed: boolean; mpjRecapOpen: boolean; sceneIntroStep: number | null;
      responses: Record<string, QuestResponse | DctResponse>;
    };
  } catch { return null; }
}

export function CanonicalMissionRunner({ mission, runtime, isDevPreview, demoMode = false, courseContext, localPilot = false, pilotStorageKey = LEARNER_UX_PILOT_STORAGE_KEY }: {
  mission: CanonicalMissionViewModel;
  runtime?: RunnableMission;
  isDevPreview: boolean;
  /** 디펜스 시연은 실제 미션·피드백을 쓰되 학습자 수행 로그는 만들지 않는다. */
  demoMode?: boolean;
  courseContext?: MissionCourseLocation | null;
  /** DEV-only fixture in the learner route; session progress only, no DB runtime. */
  localPilot?: boolean;
  pilotStorageKey?: string;
}) {
  const directCorrectionFlow = localPilot || mission.missionFormat === "mission_v6";
  const requestedMission = new URLSearchParams(window.location.search).get("mission")?.toUpperCase();
  const sceneIntroConfig = isDevPreview && requestedMission === "B"
    ? MISSION_B_SCENE_INTRO
    : buildSceneIntroConfig(mission);
  const [pilotProgress] = useState(() => readLocalPilotProgress(localPilot, pilotStorageKey));
  const [sceneIntroStep, setSceneIntroStep] = useState<number | null>(localPilot ? null : 0);
  const [questIndex, setQuestIndex] = useState(pilotProgress?.questIndex ?? 0);
  const [completed, setCompleted] = useState(pilotProgress?.completed ?? false);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<string, QuestResponse | DctResponse>>(pilotProgress?.responses ?? {});
  const [devPreset, setDevPreset] = useState<DevPreviewPreset>(readDevPreviewPreset);
  const [devAutofillQuestId, setDevAutofillQuestId] = useState<string | null>(null);
  const [demoRecordOpen, setDemoRecordOpen] = useState(false);
  const [feedbackRevisionOpen, setFeedbackRevisionOpen] = useState(false);
  const [mpjRecapOpen, setMpjRecapOpen] = useState(pilotProgress?.mpjRecapOpen ?? false);
  const [pilotStorageAvailable, setPilotStorageAvailable] = useState(true);
  const [renderNonce, setRenderNonce] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const pendingSaveRef = useRef<{ input: SaveAttemptInput; logId: string } | null>(null);
  const savingRef = useRef(false);
  const startedAtRef = useRef(new Date().toISOString());
  const attemptStorageKey = runtime
    ? `pragma:mission-attempt:${runtime.scenario_id}:${courseContext?.assignmentId ?? "direct"}`
    : "pragma:mission-attempt:preview";
  // Live re-entry starts with empty answers, so it must also start a fresh attempt and feedback session.
  const [attemptId, setAttemptId] = useState(() => runtime
    ? rotateMissionAttemptId(attemptStorageKey)
    : getOrCreateMissionAttemptId(attemptStorageKey));
  // 모델 하우스: 대표 미션 시연에서만 준비된 예시 답안·피드백을 쓴다.
  const modelHouse = demoMode && runtime?.scenario_id === REPRESENTATIVE_MISSION_ID;
  const feedbackSession = useMemo(() => createDctFeedbackSession(runtime
    ? `pragma:dct-feedback:${attemptId}:${runtime.mission.provenance?.mission_content_hash ?? "legacy"}` : undefined,
    modelHouse ? requestDemoFeedback : undefined), [attemptId, modelHouse, runtime?.mission.provenance?.mission_content_hash]);
  const quest = mission.quests[questIndex];

  useEffect(() => {
    if (!localPilot) return;
    try {
      sessionStorage.setItem(pilotStorageKey, JSON.stringify({ sceneIntroStep, questIndex, completed, mpjRecapOpen, responses }));
    } catch { setPilotStorageAvailable(false); }
  }, [localPilot, pilotStorageKey, sceneIntroStep, questIndex, completed, mpjRecapOpen, responses]);

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
      payload: { entry_mode: "full_mission" },
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
      setSceneIntroStep(0);
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
    if (sceneIntroConfig.previewOnly) return;
    setSceneIntroStep(null);
    if (isDevPreview) updateDevPreviewUrl("A1");
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
          // 1차 snapshot은 기존 완료 로그에 유지하고 A/B 원문·결과는 이벤트 JSON에 보존한다.
          feedback_rounds: finalResponse.feedbackRounds ?? [],
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
          mpjResponses: buildRuntimeMpjTraces(runtime, nextResponses),
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
    setSceneIntroStep(localPilot ? null : 0);
    setMpjRecapOpen(false);
    setQuestIndex(0);
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
  const completionOutput = mission.activityMode === "interpreting" ? "통역" : "번역";
  const peerCourseId = new URLSearchParams(window.location.search).get("courseId");
  const peerChoices = useMemo(
    // v6 serializes a complete submission; the initial/partial render has none yet.
    // 시연은 단계를 건너뛸 수 있어 MJT 응답이 비어 있을 수 있고, 학급 응답도 보이지 않으므로 만들지 않는다.
    () => runtime && !demoMode && (runtime.mission.schema_version !== "mission_v6" || completed)
      ? learnerChoiceMapFromTraces(buildRuntimeMpjTraces(runtime, responses)) : {},
    [runtime, demoMode, responses, completed],
  );
  const reviewedQuest = reviewIndex === null ? undefined : mission.quests[reviewIndex];
  const reviewedResponse = reviewedQuest ? responses[reviewedQuest.id] : undefined;
  const currentProgressIndex = completed ? mission.quests.length : questIndex;
  // 대표 미션 시연 전용 자유 이동(2026-09-25). 고른 문항을 새로 연다 — 앞 문항을 풀지 않아도 된다.
  // 학습자 미션에는 켜지 않는다(판단 → 산출 순서가 설계의 핵심). 수행 기록은 시연에서 저장되지 않는다.
  const openDemoQuest = (index: number) => {
    setSceneIntroStep(null);
    setMpjRecapOpen(false);
    setReviewIndex(null);
    setCompleted(false);
    setFeedbackRevisionOpen(false);
    setDevAutofillQuestId(null);
    setQuestIndex(index);
    setRenderNonce((current) => current + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const jumpDemoStage = (stage: "judge" | "produce") => {
    const index = stage === "judge" ? 0 : mission.quests.findIndex((item) => item.kind === "dct");
    if (index >= 0) openDemoQuest(index);
  };
  const demoFill = demoMode && sceneIntroStep === null && !mpjRecapOpen && !completed && reviewIndex === null
    ? () => {
      setDevAutofillQuestId(quest.id);
      setRenderNonce(current => current + 1);
    }
    : null;
  const navigateProgress = (index: number) => {
    if (demoMode) {
      openDemoQuest(index);
      return;
    }
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
    <LocalPilotContext.Provider value={localPilot}>
    <DemoModeContext.Provider value={modelHouse}>
    <DemoFillContext.Provider value={demoFill}>
    <RuntimeMissionContext.Provider value={runtime ?? null}>
    <DctFeedbackSessionContext.Provider value={feedbackSession}>
    <CanonicalMissionContext.Provider value={mission}>
    <LearnerJourneyShell canvas="max-w-3xl" headerRight={<span className="flex items-center gap-3">
      {demoMode && <span className="whitespace-nowrap rounded-full border border-[#F2C744]/70 px-2.5 py-0.5 text-[11px] font-bold text-[#F2C744]">데모 시연</span>}
      <span className="hidden text-xs font-semibold text-white/75 sm:block">{mission.speechAct} 화행 · {mission.direction.replace("한국어", "한").replace("중국어", "중").replace(/\s*→\s*/, "→")}</span>
    </span>}>
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
        {localPilot && <p className="mb-3 text-xs leading-5 text-[#7A7466]">
          로컬 체험 · {pilotStorageAvailable ? "다음 문항으로 넘긴 답안은 이 탭에 임시 보관됩니다. 작성 중 내용은 새로고침하면 사라집니다." : "임시 보관을 사용할 수 없습니다. 새로고침하지 않고 진행해 주세요."}
        </p>}
        {sceneIntroStep !== null ? (
          <div className="space-y-5">
            <Progress activeIndex={0} sceneIntroStep={sceneIntroStep} sceneIntroConfig={sceneIntroConfig} onJumpStage={demoMode ? jumpDemoStage : undefined} />
            <SceneIntroFlow
              config={sceneIntroConfig}
              onNext={advanceSceneIntro}
            />
          </div>
        ) : mpjRecapOpen ? (
          <div className="space-y-5">
            <Progress activeIndex={5} mpjRecapOpen skipIntro={localPilot} onJumpStage={demoMode ? jumpDemoStage : undefined} />
            <MpjLessonBridge lessonPoints={mission.lessonPoints} onContinue={continueFromMpjRecap} />
          </div>
        ) : reviewedQuest && reviewedResponse ? (
          <div className="space-y-5">
            <Progress activeIndex={currentProgressIndex} completed={completed} reviewIndex={reviewIndex} revisionOpen={feedbackRevisionOpen} skipIntro={localPilot} />
            <ReviewModeBanner index={reviewIndex ?? 0} completed={completed} onExit={() => setReviewIndex(null)} />
            <CompletedQuestReview quest={reviewedQuest} response={reviewedResponse} />
          </div>
        ) : completed ? (
          <div className="space-y-5">
            <Progress activeIndex={currentProgressIndex} completed revisionOpen={feedbackRevisionOpen} skipIntro={localPilot} onJumpStage={demoMode ? jumpDemoStage : undefined} />
            <section className="rounded-2xl bg-[#15202B] px-6 py-7 text-white sm:px-8">
              <h1 className="text-2xl font-black">학습 미션 완료</h1>
              <p className="mt-1.5 text-[14.5px] text-white/75">{aDct?.reflected ? `${completionOutput}을 수정한 뒤 최종 ${completionOutput}을 결정했습니다.` : `AI 피드백을 확인하고, 내 판단으로 최초 ${completionOutput}을 그대로 확정했습니다.`}</p>
            </section>
            <div className="space-y-4">
              <CompletionRecord
                source={primaryDct?.source}
                response={aDct}
                alternatives={primaryDct?.feedback.alternatives}
              />
            </div>
            <DissentSummary dissent={aDct?.dissent} />
            {SHOW_PEER_RESPONSES && runtime && !demoMode && (
              <details className={`${panel} p-5`}><summary className="cursor-pointer text-sm font-bold">익명 학급 응답 보기</summary><div className="mt-4">
              <PeerResponsesPanel
                courseId={peerCourseId}
                missionId={runtime.scenario_id}
                enabled={saveState === "saved"}
                learnerChoices={peerChoices}
              /></div></details>
            )}
            {localPilot ? <Button variant="outline" className="h-11 w-full" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />처음부터 다시 보기</Button>
              : <CompletionActions onRestart={restart} onRetrySave={() => void persistPendingAttempt()} runtime={Boolean(runtime) && !demoMode} saveState={saveState}
                onShowDemoRecord={demoMode ? () => { setDemoRecordOpen(true); window.setTimeout(() => document.getElementById("demo-record")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); } : undefined} />}
            {demoMode && demoRecordOpen && <DemoRecord quests={mission.quests} responses={responses} />}
          </div>
        ) : (
          <div className="space-y-4">
            <Progress activeIndex={currentProgressIndex} revisionOpen={feedbackRevisionOpen} skipIntro={localPilot} onJumpQuest={navigateProgress} freeJump={demoMode} onJumpStage={demoMode ? jumpDemoStage : undefined} />
            <QuestRenderer
              key={`${quest.id}-${demoMode && quest.kind === "dct_feedback" ? 0 : renderNonce}`}
              quest={quest}
              responses={responses}
              onDone={finishQuest}
              onRevisionStateChange={setFeedbackRevisionOpen}
              devMode={isDevPreview}
              devAutofill={devAutofillQuestId === quest.id}
              devDraft={demoMode && quest.kind === "dct" ? (modelHouse ? DEMO_FIRST_DRAFT : quest.referenceAnswer) : DEV_PREVIEW_COPY[devPreset].a}
              demoFillRequest={demoMode && devAutofillQuestId === quest.id ? renderNonce : 0}
              localPilot={directCorrectionFlow}
            />
          </div>
        )}
      </div>
    </LearnerJourneyShell>
    </CanonicalMissionContext.Provider>
    </DctFeedbackSessionContext.Provider>
    </RuntimeMissionContext.Provider>
    </DemoFillContext.Provider>
    </DemoModeContext.Provider>
    </LocalPilotContext.Provider>
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
  const scenarioId = scenarioIdOverride ?? routeScenarioId ?? (demoMode ? REPRESENTATIVE_MISSION_ID : undefined);
  const localPilot = import.meta.env.DEV && !scenarioId
    && new URLSearchParams(window.location.search).get("preview") === "v5"
    && new URLSearchParams(window.location.search).get("pilot") === "free-correction";
  const reasonContrastPilot = localPilot && new URLSearchParams(window.location.search).get("variant") === "reason-contrast";
  const reasonContrastPreview = useMemo(() => reasonContrastPilot ? { ...adaptRunnableMissionToCanonical({
    scenario_id: "", speech_act: "request", learner_level: "intermediate",
    mission_status: null, release_gate_mode: null,
    direction: SAMPLE_MISSION_V6_REASON_CONTRAST.direction, mission: SAMPLE_MISSION_V6_REASON_CONTRAST,
  }), metaLabel: "대표 요청 후보" } : null, [reasonContrastPilot]);
  // 시연은 승인본 스냅숏과 준비된 예시 피드백을 쓰고, 저장·이벤트도 막는다.
  const pilotStorageKey = reasonContrastPilot ? REASON_CONTRAST_PILOT_STORAGE_KEY : LEARNER_UX_PILOT_STORAGE_KEY;
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
    // 시연은 로그인 여부와 관계없이 승인본 스냅숏을 쓴다(DB·AI 호출 없음).
    const load = demoMode
      ? Promise.resolve().then(() => publicRepresentativeMission())
      : fetchMissionByScenario(scenarioId, { includeV6: true });
    void load
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
        // 학습자 화면에는 DB·API 원문(권한 오류 문구 등)을 그대로 두지 않는다.
        // 실패를 감추지는 않되, 기술적 원인은 콘솔에만 남긴다.
        console.error("[mission] 미션 로드 실패", reason);
        setError("미션을 불러오지 못했습니다. 잠시 후 다시 시도하거나 담당 교수자에게 알려 주세요.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [demoMode, scenarioId]);

  if (courseLocation.ok === false) {
    return (
      <LearnerJourneyShell canvas="max-w-3xl">
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
      <LearnerJourneyShell canvas="max-w-3xl">
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
      <LearnerJourneyShell canvas="max-w-3xl">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-3 rounded-2xl border border-[#DED9CD] bg-white px-6 py-12 text-sm font-bold text-[#5B6678]">
          <LoaderCircle className="h-5 w-5 animate-spin" /> 실제 미션을 불러오고 있습니다.
        </div>
      </LearnerJourneyShell>
    );
  }

  if (error) {
    return (
      <LearnerJourneyShell canvas="max-w-3xl">
        <section className="mx-auto max-w-3xl rounded-2xl border border-[#E5C8C2] bg-white px-6 py-8">
          <p className="text-xs font-black text-[#A44736]">미션을 열지 못했습니다</p>
          <p className="mt-2 text-sm leading-6 text-[#5B6678]">{error}</p>
          <Button asChild className="mt-5"><Link to="/learner/course">수업 목록으로 돌아가기</Link></Button>
        </section>
      </LearnerJourneyShell>
    );
  }

  const mission = runtimeMission ?? reasonContrastPreview ?? (localPilot ? LEARNER_UX_PILOT : CANONICAL_MISSION_PREVIEW);
  return (
    <CanonicalMissionRunner
      key={localPilot ? pilotStorageKey : mission.scenarioId ?? "preview"}
      mission={mission}
      runtime={runtimeRunnable ?? undefined}
      isDevPreview={import.meta.env.DEV && !scenarioId && !localPilot}
      localPilot={localPilot}
      pilotStorageKey={pilotStorageKey}
      demoMode={demoMode}
      courseContext={courseLocation.context}
    />
  );
};

export default CanonicalMissionRun;
