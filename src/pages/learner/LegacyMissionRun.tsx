/**
 * @deprecated 과거 스키마·방향·통역 호환 전용 실행기.
 * 새 학습 경험은 CanonicalMissionRun을 사용하고, 이 파일을 새 라우트에 연결하지 않는다.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleAlert, Mail, MessageCircle, Mic, Send, Sparkles, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import {
  SPEECH_ACT_UI,
  SPEECH_ACT_VERB_KO,
  LEVEL,
  DIRECTION_LANGS,
  type LanguageDirection,
  type LearnerLevel,
} from "@/lib/pragma/enums";
import { getTargetFeature } from "@/lib/pragma/targetFeatures";
import { SCALE4_CODES, SCALE4_LABELS, type Scale4Code } from "@/lib/pragma/targetFeatures";
import {
  normalizeMission,
  type MissionRuntime,
  type MpjItemRuntime,
  type VocabularyHint,
} from "@/lib/pragma/missionSchema";
import { SAMPLE_MISSION_V1 } from "@/lib/mission/missionV1Sample";
import { SAMPLE_MISSION_V4, SAMPLE_MISSION_V5 } from "@/lib/mission/missionV4Sample";
import { fetchMissionByScenario, type RunnableMission } from "@/lib/mission/missionDb";
import {
  saveMissionAttempt,
  type LearnerDissent,
  type MpjResponseTrace,
} from "@/lib/mission/missionLog";
import { buildMpjSummaryRows } from "@/lib/mission/mpjSummary";
import {
  ChatScene,
  ChatBubble,
  ChatCaption,
  SituationText,
  learnerCounterpartLabel,
  highlightZh,
  MISSION_SCENE_PANEL_DENSITY,
  MISSION_SCENE_TEXT_DENSITY,
  MISSION_SCENE_RELATION_GAP,
} from "@/components/mission/ChatScene";
import { requestFeedback } from "@/lib/mission/missionFeedback";
import { requestSttTranscript } from "@/lib/mission/missionStt";
import { requestTtsAudio } from "@/lib/tts";
import {
  classifyColdOpen,
  mpjPresentationChannel,
  responseHasSubstantiveRevision,
  responseWasRevised,
  sceneHeadline,
  shouldShowCorrectionNotesLink,
  translationWritingSkin,
  type MissionSaveState,
  type MissionPresentationMode,
} from "@/lib/mission/missionPresentation";
import { DiffLegend, DiffLine } from "@/components/mission/DiffLine";
import { diffText } from "@/lib/mission/textDiff";
import { type RuntimeFeedback } from "@/lib/pragma/feedbackSchema";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";
import { IS_DEMO } from "@/lib/auth/useProfile";
import {
  learnerWorkflowSteps,
  type LearnerWorkflowStepKey,
} from "@/lib/curriculum/learnerWorkflow";

// 샘플은 v1 → 정규화해 v2로 구동(러너는 정규화 형태만 본다, 0-l·84).
const SAMPLE_MISSION_V2 = normalizeMission(SAMPLE_MISSION_V1).data as MissionRuntime;

// mission_v5 미리보기의 실패 피드백 확인용 답안.
// 핵심 의미는 보존하되 문법 1곳과 요청 강도 1곳을 의도적으로 어긋나게 해,
// 데모에서 두 실패 카드가 항상 재현되도록 한다. 실제 학습·저장·생성 계약에는 쓰지 않는다.
const DEMO_REVISION_DRAFT =
  "上次的订单已经收到了，谢谢。不过我们这周开始要搬办公室。你必须把这次订单的收货地址改我们的新办公室。麻烦您了，实在不好意思。";

const DEMO_REVISION_FEEDBACK: RuntimeFeedback = {
  schema_version: "feedback_v1",
  rubric_version: "request_mitigation_optionality@1.0",
  revision_scope: "feature",
  verdicts: {
    semantic_fidelity: "preserved",
    grammatical_accuracy: "impeding_errors",
    pragmatic_appropriateness: {
      feature_code: "request_mitigation_optionality",
      band_code: "too_direct",
    },
  },
  blocks: {
    meaning_ko: "이전 주문 수령, 사무실 이전, 배송지 변경 요청과 사과까지 핵심 내용은 모두 전달했습니다.",
    grammar: [
      {
        error_type: "missing_component",
        anchor_text: "改我们的新办公室",
        suggested_correction: "改到我们的新办公室",
        explanation_ko: "변경될 도착점을 잇는 ‘到’가 빠져 문장 구조가 끊깁니다.",
      },
    ],
    feature_ko:
      "‘你必须’는 요청 내용을 분명히 하지만, 업무상 아는 거래처 담당자에게 선택의 여지를 거의 남기지 않아 이 상황에서는 명령처럼 들릴 수 있습니다.",
    alternatives: [
      {
        text: "上次的订单已经收到了，谢谢。不过我们这周开始要搬办公室。如果方便的话，这次订单的收货地址能改到我们的新办公室吗？麻烦您了，实在不好意思。",
        note_ko: "문법을 바로잡고, 가능 여부를 물어 상대가 답할 여지를 남긴 최소대조안입니다.",
      },
    ],
    discourse_ko: "앞뒤 내용은 이어지지만, 중심 요청문의 문법과 강도가 메시지 흐름을 끊습니다.",
    offfocus_warnings: [],
  },
  uncertainty_flags: [],
  provenance: {
    model: "demo-fixture",
    prompt_version: "mission_v5_revision_preview",
    content_release_id: CURRENT_CONTENT_RELEASE_ID,
    generated_at: "2026-07-30T00:00:00.000Z",
  },
};

// 방향별 언어 이름 라벨(0-l·85).
const LANG_NAME: Record<"ko" | "zh", string> = { ko: "한국어", zh: "중국어" };
const srcLangName = (dir: LanguageDirection) => LANG_NAME[DIRECTION_LANGS[dir].source];
const tgtLangName = (dir: LanguageDirection) => LANG_NAME[DIRECTION_LANGS[dir].target];
const RESPONSE_INPUT_ROWS: Record<LearnerLevel, 2 | 3 | 4> = {
  beginner_intermediate: 2,
  intermediate: 3,
  advanced: 4,
};
const responseInputRows = (level: LearnerLevel | null): 2 | 3 | 4 =>
  RESPONSE_INPUT_ROWS[level ?? "intermediate"];

// 학습자 미션 실행 — mission_v1~v4를 정규화해 구동한다.
//   표현 감각 익히기(MPJ → 인계) → 직접 번역/통역하기 → 피드백 확인하기(필요 시 다듬기 → 완료)
//   ※ 3단계는 표시 서사이고, 실제 문항 수·판정·저장은 mission schema version을 따른다.
// 판정은 초점별 band 카탈로그(targetFeatures) 기준. 자유 산출 뒤에는 feedback-lite가
// 의미·문법·화용을 진단하며, 실패 시 참고 표현·핵심 원칙으로 안전하게 폴백한다.

// v1~v3 읽기 호환 전용. 신규 mission_v4에는 확신도 응답이 없다.
const CONFIDENCE = ["매우 확신", "꽤 확신", "확신 없음"] as const;

// 사이트 헤더(LearnerJourneyShell) 높이 — 문항 맥락 바가 붙는 기준선.
const HEADER_H = 60;
// 화행·학습 초점 + 워크플로우 고정 영역. 첫 화면에서는 전체 레일을 보여 주고,
// 스크롤 뒤에는 현재 단계만 남겨 본문을 가리는 높이를 줄인다.
const WORKFLOW_EXPANDED_H = 92;
const WORKFLOW_COMPACT_H = 52;
const WORKFLOW_COMPACT_SCROLL_Y = 160;
// 접힘·펼침 임계값을 벌려 둔다(히스테리시스). 단일 임계값이면 진동한다 —
// 이 레일은 sticky지만 흐름에서 자리를 차지하므로 92→52px로 접히면 문서 높이가
// 40px 줄고, 브라우저가 scrollY를 그만큼 끌어내려 임계값을 다시 넘나든다.
// 두 임계값의 간격(60px)이 높이 변화(40px)보다 커야 그 되먹임이 끊긴다.
const WORKFLOW_EXPAND_SCROLL_Y = 100;
const SCROLL_TARGET_GAP = 12;

const card = "rounded-xl border border-[#EAE4D2] bg-white p-4";
// 데모/검증 전용 버튼(프로토타입 v2 "데모 채우기") — IS_DEMO(개발·데모 배포)에서만 노출.
// 실제 학습 세션(VITE_ENABLE_DEMO 미설정)에는 나오지 않아 수행 데이터 오염 없음.
const demoBtn =
  "block w-full rounded-lg border border-dashed border-[#D8D0BC] bg-[#F5F5F2] px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:bg-[#EFEEE9]";

// ── 진행 단계 ────────────────────────────────────────────────────────────
type Phase = "intro" | "mpj" | "handoff" | "produce" | "feedback" | "revise" | "done";

// 미션의 각 국면이 학습자 여정의 어느 단계인가. 이름·순서는 learnerWorkflow 정본을
// 따르고, 여기서는 국면 → 단계 대응만 둔다.
const STEP_OF: Record<Phase, LearnerWorkflowStepKey> = {
  intro: "scenario",
  mpj: "judge",
  handoff: "judge",
  produce: "produce",
  feedback: "feedback",
  revise: "revise",
  done: "revise",
};
// 레일에서 단계를 눌렀을 때(데모 전용) 착지할 국면.
const PHASE_OF_STEP: Record<LearnerWorkflowStepKey, Phase> = {
  scenario: "intro",
  judge: "mpj",
  produce: "produce",
  feedback: "feedback",
  revise: "revise",
};

// 정본 target feature 이름은 생성·저장 계약에 그대로 보존한다. 학습자 화면에서는
// 같은 구성개념을 행동 문장으로 풀어, 무엇을 연습하는지 즉시 읽히게 한다.
const LEARNER_FOCUS_COPY: Record<string, string> = {
  request_mitigation_optionality: "상대가 거절할 여지를 남기며 부탁하기",
  refusal_softening: "거절은 분명하게, 관계는 부드럽게 전하기",
  gratitude_calibration: "상황에 맞는 정도로 고마움을 표현하기",
  apology_accountability_repair: "잘못을 인정하고 해결 방법까지 전하기",
  proposal_optionality_clarity: "상대의 선택을 열어 두고 방안을 분명히 제안하기",
  invitation_choice_commitment: "참여 여부는 열어 두고 약속 내용을 분명히 전하기",
  opposition_stance_mitigation: "다른 의견을 분명히 말하면서 관계를 조절하기",
  compliment_grounding_sensitivity: "상황에 맞는 강도로 구체적으로 칭찬하기",
  compliment_response_uptake: "칭찬을 자연스럽게 받아들이고 대화를 이어가기",
  complaint_problem_accountability: "문제를 분명히 말하되 책임을 과하게 단정하지 않기",
  politeness: "상대와 상황에 맞는 공손한 표현 고르기",
};
// ── band 라벨 헬퍼 ──────────────────────────────────────────────────────
function bandLabel(featureCode: string, code: string): string {
  const feat = getTargetFeature(featureCode);
  return feat?.band_schema.find((b) => b.code === code)?.label_ko ?? code;
}
/** 초점의 band 선택지(카탈로그 우선, 없으면 문항에 등장한 코드로 폴백). */
function bandOptions(featureCode: string, fallback: string[]): { code: string; label: string }[] {
  const feat = getTargetFeature(featureCode);
  if (feat) return feat.band_schema.map((b) => ({ code: b.code, label: b.label_ko }));
  return [...new Set(fallback)].map((c) => ({ code: c, label: c }));
}

function learnerBandLabel(featureCode: string, code: string, fallback: string): string {
  if (featureCode !== "request_mitigation_optionality") return fallback;
  if (code === "too_direct") return "너무 직접적 — 명령처럼 들릴 수 있음";
  if (code === "within_band") return "알맞음 — 관계와 부담에 맞음";
  if (code === "too_indirect") return "너무 우회적 — 요청이 흐려질 수 있음";
  return fallback;
}

// ── 페이지: 라우트 파라미터로 DB 조회, 없으면 샘플 ──────────────────────
const LegacyMissionRun = () => {
  const { scenarioId } = useParams();
  const [searchParams] = useSearchParams();
  // 원격 migration·Edge 배포 전에도 승인된 v4 흐름을 눈으로 확인할 수 있는 DEV 전용 샘플.
  // production build에서는 query를 붙여도 legacy 기본 샘플을 유지한다.
  const previewParam = import.meta.env.DEV && !scenarioId ? searchParams.get("preview") : null;
  const previewV5 = previewParam === "v5";
  const previewV4 = previewParam === "v4" || previewV5;
  // 데모/검증 토글 — 샘플 경로에서만 통역 흐름을 켠다(실제 DB 미션에는 영향 없음).
  const forceInterp = !scenarioId && searchParams.get("mode") === "interpreting";
  // 수행 방식 전환(번역 ↔ 통역)으로 넘어온 경우 1부를 건너뛰고 2부부터 시작한다.
  // 같은 미션의 1부(판단 연습)를 방금 마쳤는데 또 시키면 중복이다.
  // ⚠️ 샘플 + 데모에서만 허용 — 실제 학습 세션에서 1부를 건너뛰면 "판단 → 적용"이라는
  //    미션 구인 자체가 깨진다(완료 조건 = 판단 N문항 → 산출 → 피드백 → 필요 시 다듬기).
  const startAtPart2 = IS_DEMO && !scenarioId && searchParams.get("part") === "2";
  const [loaded, setLoaded] = useState<RunnableMission | null>(null);
  const [loading, setLoading] = useState<boolean>(!!scenarioId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetchMissionByScenario(scenarioId);
        if (!cancelled) setLoaded(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "미션을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  if (scenarioId && loading) {
    return (
      <LearnerJourneyShell>
        <p className="py-10 text-center text-[13px] text-muted-foreground">미션을 불러오는 중…</p>
      </LearnerJourneyShell>
    );
  }
  if (scenarioId && error) {
    return (
      <LearnerJourneyShell>
        <div className="my-6 rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-900">{error}</div>
      </LearnerJourneyShell>
    );
  }

  const baseMission =
    loaded?.mission ??
    (previewV5 ? SAMPLE_MISSION_V5 : previewV4 ? SAMPLE_MISSION_V4 : SAMPLE_MISSION_V2);
  const mission =
    forceInterp
      ? { ...baseMission, production_task: { ...baseMission.production_task, mode: "interpreting" as const } }
      : baseMission;
  const isSample = !loaded;
  // 방향·수행 방식은 학습자가 지금 무엇을 산출하는지 말해 준다 — 급수 표기보다 유용하다.
  const directionModeLabel = `${mission.direction === "zh_ko" ? "중→한" : "한→중"} ${
    mission.production_task.mode === "interpreting" ? "통역" : "번역"
  }`;
  const headerRight = loaded
    ? [
        loaded.speech_act ? SPEECH_ACT_UI[loaded.speech_act] : "",
        loaded.learner_level ? LEVEL[loaded.learner_level] : "",
        directionModeLabel,
      ]
        .filter(Boolean)
        .join(" · ")
    // 큰 배너를 걷어내는 대신 헤더가 지위를 말한다 — "원어민 검토 전"은 헤더에 없던 정보다.
    : previewV4
      ? `${previewV5 ? "mission_v5(미니 담화형 DCT)" : "mission_v4"} 미리보기 · 예문 검토 전`
      : "샘플 · 예문 검토 전";

  return (
    <MissionRunner
      key={`${loaded?.scenario_id ?? (previewV5 ? "sample-v5" : previewV4 ? "sample-v4" : "sample")}:${mission.production_task.mode}`}
      mission={mission}
      isSample={isSample}
      startAtPart2={startAtPart2}
      headerRight={headerRight}
      status={loaded?.mission_status ?? null}
      scenarioId={loaded?.scenario_id ?? null}
      speechAct={loaded?.speech_act ?? null}
      level={loaded?.learner_level ?? null}
    />
  );
};

// ── 러너 본체 ───────────────────────────────────────────────────────────
/** ko_zh 번역 산출을 막는 비화용적 내용 어휘 두 개만 한 줄로 제공한다. */
function ProductionGuide({
  hints,
  onOpen,
}: {
  hints: VocabularyHint[];
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-3 flex flex-col items-start">
      <button
        type="button"
        onClick={() => {
          if (!expanded) onOpen();
          setExpanded((value) => !value);
        }}
        className="rounded-full border border-[#E5DDAF] bg-[#FFFDF4] px-3 py-1.5 text-[12px] font-bold text-[#4A5560] transition-colors hover:bg-[#FFF9DD]"
        aria-expanded={expanded}
      >
        막히면 어휘 힌트 {expanded ? "닫기 ▴" : "2개 보기 ▾"}
      </button>
      {expanded && (
        <div className="mt-1.5 flex w-fit max-w-full flex-wrap justify-start gap-x-4 gap-y-1 rounded-lg border border-[#E5DDAF] bg-[#FFFDF4] px-3 py-2 text-[12.5px]">
          {hints.slice(0, 2).map((hint) => (
            <span key={`${hint.source}:${hint.target}`}>
              <span className="text-muted-foreground">{hint.source}</span>
              <span className="mx-1 text-[#B4A36A]">→</span>
              <strong className="font-semibold text-[#1F4F37]">{hint.target}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function revisionActionLine(
  fb: RuntimeFeedback | null,
  featureCode: string,
  learnerLabel: string,
): string {
  if (!fb) {
    return featureCode === "request_mitigation_optionality"
      ? "상대와 부담을 다시 확인하고, 요청의 직접성을 한 단계 조절하세요."
      : `「${learnerLabel}」에 맞춰 표현 한 곳만 고쳐 보세요.`;
  }
  if (fb.revision_scope === "meaning") {
    return "빠지거나 달라진 핵심 의미부터 복원하세요.";
  }
  if (fb.revision_scope === "grammar") {
    return "문법 피드백에서 표시된 부분 하나만 고쳐 문장을 다시 완성하세요.";
  }
  if (fb.revision_scope === "feature") {
    const bandCode = fb.verdicts.pragmatic_appropriateness.band_code;
    if (bandCode === "too_direct") {
      return featureCode === "request_mitigation_optionality"
        ? "명령처럼 들리는 부분을 줄이고, 가능한지 물어 거절할 여지를 남기세요."
        : "상대에게 너무 강하게 들리는 부분을 줄이고 표현의 강도를 낮추세요.";
    }
    if (bandCode === "too_indirect") {
      return featureCode === "request_mitigation_optionality"
        ? "완화 표현을 덜어내고 요청 의도를 더 분명하게 만드세요."
        : "우회 표현을 덜어내고 핵심 의도를 더 분명하게 만드세요.";
    }
    return `이 상대와 부담에 맞게 「${learnerLabel}」의 정도를 조절하세요.`;
  }
  return "현재 의미를 유지하면서 다른 자연스러운 표현을 시도해 보세요.";
}

function completionAdviceLine({
  fb,
  featureCode,
  revisedChanged,
}: {
  fb: RuntimeFeedback | null;
  featureCode: string;
  revisedChanged: boolean;
}): string {
  if (!fb) {
    if (revisedChanged) {
      return "처음 답안을 한 번 더 다듬었습니다. 다음에도 상대와 부담을 먼저 확인해 보세요.";
    }
    return featureCode === "request_mitigation_optionality"
      ? "거리 있음 · 부담 큼 → 가능한지 묻고 거절할 여지를 남기되, 공손 표현은 필요한 만큼만."
      : "상황과 상대를 먼저 확인하고, 필요한 만큼만 표현을 조절하세요.";
  }
  if (fb.revision_scope === "meaning") {
    return featureCode === "request_mitigation_optionality"
      ? "다음에는 공손함을 조절하기 전에 누가 무엇을 요청하는지 핵심 의미부터 지켜 보세요."
      : "다음에는 표현을 조절하기 전에 원문의 핵심 의미와 의도부터 지켜 보세요.";
  }
  if (fb.revision_scope === "grammar") {
    return "핵심 의도는 유지했습니다. 다음에는 표시된 문법 부분 하나만 먼저 점검해 보세요.";
  }
  if (fb.revision_scope === "feature") {
    const bandCode = fb.verdicts.pragmatic_appropriateness.band_code;
    if (bandCode === "too_direct") {
      return featureCode === "request_mitigation_optionality"
        ? "요청 의도는 분명했습니다. 다음에는 가능한지 물어 거절할 여지를 조금 더 남겨 보세요."
        : "핵심 의도는 분명했습니다. 다음에는 상대에게 들리는 강도를 조금 낮춰 보세요.";
    }
    if (bandCode === "too_indirect") {
      return featureCode === "request_mitigation_optionality"
        ? "상대를 배려했습니다. 다음에는 완화 표현을 덜어 요청 의도를 더 선명하게 해 보세요."
        : "상대를 배려했습니다. 다음에는 우회 표현을 덜어 핵심 의도를 더 선명하게 해 보세요.";
    }
    return "의미는 잘 전달했습니다. 다음에는 상대와 부담에 맞는 표현의 정도를 한 번 더 확인해 보세요.";
  }
  return "의미·문법·상황 적절성이 안정적이었습니다. 다음에는 같은 뜻을 더 간결하게 표현해 보세요.";
}

/** all-pass에서는 긴 판정문 대신 실제 답안 표현에 근거한 칭찬 한 줄만 보여 준다. */
function specificPraiseLine(fb: RuntimeFeedback, learnerLabel: string): string {
  const quoted = Array.from(
    fb.blocks.feature_ko.matchAll(/[‘'“"]([^’'”"]{1,32})[’'”"]/g),
    (match) => match[1].trim(),
  ).filter(Boolean);
  const expressions = [...new Set(quoted)].slice(0, 2);

  if (expressions.length === 2) {
    return `‘${expressions[0]}’와 ‘${expressions[1]}’처럼 핵심 표현을 관계와 상황에 맞게 조절한 점이 좋았습니다.`;
  }
  if (expressions.length === 1) {
    return `‘${expressions[0]}’처럼 핵심 표현을 관계와 상황에 맞게 조절한 점이 좋았습니다.`;
  }
  return `이번 초점인 「${learnerLabel}」를 관계와 상황에 맞게 실현했습니다.`;
}

/**
 * feedback-lite 3층 진단 화면.
 * 통과한 층은 구체적으로 칭찬하고, 수정이 필요한 층만 어디·왜·이렇게 구조로
 * 펼쳐 보여 준다. 필수 피드백을 뒤집기나 접기 뒤에 숨기지 않는다.
 */
function FeedbackPanel({
  fb,
  featureCode,
}: {
  fb: RuntimeFeedback;
  featureCode: string;
}) {
  const v = fb.verdicts;
  const g = fb.blocks.grammar?.[0];
  const targetFeature = getTargetFeature(featureCode);
  const withinBandCode = targetFeature?.within_band_code ?? "within_band";
  const minimalContrast = fb.blocks.alternatives?.[0];

  const layers = [
    {
      key: "meaning",
      label: "의미 전달",
      passed: v.semantic_fidelity === "preserved",
      short:
        v.semantic_fidelity === "preserved"
          ? "핵심 의미를 정확히 살렸습니다"
          : v.semantic_fidelity === "minor_loss"
            ? "일부 의미와 뉘앙스를 더 살려 보세요"
            : "원문의 핵심 의미와 다른 부분을 확인해 보세요",
      detail: {
        where: "원문의 핵심 의미",
        why: fb.blocks.meaning_ko,
        how: "",
        howNote: "",
      },
    },
    {
      key: "grammar",
      label: "문법 정확성",
      passed: v.grammatical_accuracy === "clean",
      short:
        v.grammatical_accuracy === "clean"
          ? "문법도 안정적으로 처리했습니다"
          : "문법적으로 다듬을 부분이 있습니다",
      detail: {
        where: g?.anchor_text ? `“${g.anchor_text}”` : "문법적으로 다듬을 부분",
        why: g?.explanation_ko ?? "이해를 방해하는 문법 부분을 확인해 보세요.",
        how: g?.suggested_correction ?? "",
        howNote: "",
      },
    },
    {
      key: "feature",
      label: "상황 적절성",
      passed: v.pragmatic_appropriateness.band_code === withinBandCode,
      short:
        v.pragmatic_appropriateness.band_code === withinBandCode
          ? "이 관계와 상황에 잘 맞췄습니다"
          : learnerBandLabel(
              featureCode,
              v.pragmatic_appropriateness.band_code,
              bandLabel(featureCode, v.pragmatic_appropriateness.band_code),
            ),
      detail: {
        where: targetFeature?.learner_label ?? "상대에게 주는 인상",
        why: fb.blocks.feature_ko,
        how: minimalContrast?.text ?? "",
        howNote: minimalContrast?.note_ko ?? "",
      },
    },
  ];
  const passedCount = layers.filter((layer) => layer.passed).length;
  const allPassed = passedCount === layers.length;
  const issueLayers = layers.filter((layer) => !layer.passed);
  const specificPraise = specificPraiseLine(
    fb,
    targetFeature?.learner_label ?? "상황에 맞는 표현 선택",
  );
  const progressCopy =
    passedCount === 2
      ? "좋은 출발입니다. 표시된 한 부분만 다듬으면 됩니다."
      : passedCount === 1
        ? "잘 잡은 부분이 있습니다. 표시된 부분을 차례로 살펴봅시다."
        : "먼저 핵심 의미부터 차례로 정리해 봅시다.";
  // 미니 담화형 DCT의 집중 구간 밖 심각 부조화만 예외적으로 알린다.
  // 일반 담화 총평은 세 판정과 겹치고 다음 행동으로 이어지지 않아 학습자 화면에서 숨긴다.
  const offFocus = fb.blocks.offfocus_warnings ?? [];

  return (
    <div className="space-y-3">
      <div
        className={[
          "overflow-hidden rounded-xl border bg-white",
          allPassed ? "border-[#AFCFBB]" : "border-[#DDE5DF]",
        ].join(" ")}
      >
        <div
          className={[
            "flex flex-wrap items-start justify-between gap-3 border-b px-3.5 py-3",
            allPassed
              ? "border-[#D7E9DD] bg-[linear-gradient(135deg,#F2FAF5_0%,#FFFBEA_100%)]"
              : "border-[#E5EBE7] bg-[#F7FAF8]",
          ].join(" ")}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {allPassed ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FAD338] text-[#15202B] shadow-[0_2px_7px_rgba(250,211,56,0.28)] motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-500">
                  <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
              ) : null}
              <div>
                <div className="text-[11px] font-bold text-[#52645A]">답안 피드백</div>
                <div className="mt-0.5 text-[14px] font-extrabold text-[#15202B]">
                  {allPassed ? "아주 좋습니다. 이 표현으로 충분합니다." : progressCopy}
                </div>
              </div>
            </div>
            {allPassed && (
              <p className="mt-2 max-w-[44rem] text-[13px] font-medium leading-relaxed text-[#355044]">
                {specificPraise}
              </p>
            )}
          </div>
          <span
            className={[
              "rounded-full px-2.5 py-1 text-[11px] font-extrabold",
              allPassed ? "bg-[#DFF4E7] text-[#176640]" : "bg-[#FFF1C7] text-[#755A0B]",
            ].join(" ")}
          >
            {allPassed
              ? `${passedCount}개 안정`
              : `${passedCount}개 안정 · ${layers.length - passedCount}개 점검`}
          </span>
        </div>

        <div className="grid gap-2 p-2.5 md:grid-cols-3">
          {layers.map((layer) => {
            const StatusIcon = layer.passed ? CheckCircle2 : CircleAlert;
            return (
              <div
                key={layer.key}
                className={[
                  "flex min-h-[88px] min-w-0 flex-col rounded-xl border px-3 py-2.5",
                  layer.passed
                    ? "border-[#BBDCC8] bg-[#F2FAF5]"
                    : "border-[#F0D786] bg-[#FFFAE9]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-bold text-[#52645A]">{layer.label}</span>
                  <span
                    className={[
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold",
                      layer.passed
                        ? "bg-[#DFF4E7] text-[#176640]"
                        : "bg-[#FBE8AE] text-[#755A0B]",
                    ].join(" ")}
                  >
                    <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {layer.passed ? "통과" : "수정 필요"}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-center px-1 pt-1.5 text-center text-[12.5px] font-bold leading-snug text-[#15202B]">
                  {layer.short}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!allPassed && (
        <div className="space-y-2.5">
          {issueLayers.map((layer) => (
            <div
              key={`issue-${layer.key}`}
              className="overflow-hidden rounded-xl border border-[#E8CF78] bg-white shadow-[0_3px_12px_rgba(21,32,43,0.04)]"
            >
              <div className="flex items-center gap-2 border-b border-[#F1E4B8] bg-[#FFFAE9] px-3.5 py-2.5">
                <CircleAlert className="h-4 w-4 text-[#9A7411]" aria-hidden="true" />
                <span className="text-[12px] font-extrabold text-[#6B5518]">
                  {layer.label} · 수정할 부분
                </span>
              </div>
              <dl className="divide-y divide-[#ECE8DE] px-3.5">
                <div className="grid gap-1 py-2.5 sm:grid-cols-[3.25rem_1fr] sm:gap-3">
                  <dt className="text-[11px] font-extrabold text-[#687781]">어디</dt>
                  <dd className="min-w-0 break-words text-[13.5px] font-semibold leading-relaxed text-[#15202B]">
                    {layer.detail.where}
                  </dd>
                </div>
                <div className="grid gap-1 py-2.5 sm:grid-cols-[3.25rem_1fr] sm:gap-3">
                  <dt className="text-[11px] font-extrabold text-[#687781]">왜</dt>
                  <dd className="min-w-0 break-words text-[13.5px] leading-relaxed text-[#263643]">
                    {layer.detail.why}
                  </dd>
                </div>
                {layer.detail.how && (
                  <div className="grid gap-1 py-2.5 sm:grid-cols-[3.25rem_1fr] sm:gap-3">
                    <dt className="text-[11px] font-extrabold text-[#315F8E]">이렇게</dt>
                    <dd className="min-w-0">
                      <div className="break-words rounded-lg bg-[#F2F6FA] px-3 py-2 text-[13.5px] font-semibold leading-relaxed text-[#17344F]">
                        {layer.detail.how}
                      </div>
                      {layer.detail.howNote && (
                        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#657681]">
                          {layer.detail.howNote}
                        </p>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}

      {offFocus.length > 0 && (
        <div className="rounded-xl border border-[#E7D28B] bg-[#FFFCF0] px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#755A0B]">
            <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
            추가로 확인할 부분
          </div>
          {offFocus.map((w, i) => (
            <div key={i} className="mt-2 rounded-lg bg-[#FFFAE9] px-3 py-2 text-[12.5px] leading-relaxed">
              <span className="font-semibold text-[#755A0B]">“{w.text}”</span>
              {w.note_ko ? <span className="text-[#15202B]"> — {w.note_ko}</span> : null}
            </div>
          ))}
        </div>
      )}

      <p className="px-0.5 text-[11.5px] text-muted-foreground">
        AI가 생성한 참고 피드백입니다. 상황에 따라 다른 판단도 가능합니다.
      </p>
    </div>
  );
}

const FEEDBACK_REVIEW_STEPS = [
  {
    label: "의미 전달",
    detail: "원문의 핵심 의미와 의도가 유지됐는지",
  },
  {
    label: "문법 정확성",
    detail: "이해를 방해하는 문법 문제가 있는지",
  },
  {
    label: "상황 적절성",
    detail: "이 상대·부담에 맞는 표현인지",
  },
] as const;

/**
 * 실제 feedback-lite의 세 진단층을 기다리는 동안 보여 주는 상태 카드.
 * 가짜 퍼센트·인위적 지연은 쓰지 않고, API가 확인하는 기준만 정직하게 안내한다.
 */
function FeedbackLoadingPanel() {
  const [activeStep, setActiveStep] = useState(0);
  const [takingLonger, setTakingLonger] = useState(false);

  useEffect(() => {
    const grammarTimer = window.setTimeout(() => setActiveStep(1), 1_600);
    const contextTimer = window.setTimeout(() => setActiveStep(2), 3_200);
    const longerTimer = window.setTimeout(() => setTakingLonger(true), 4_800);
    return () => {
      window.clearTimeout(grammarTimer);
      window.clearTimeout(contextTimer);
      window.clearTimeout(longerTimer);
    };
  }, []);

  const current = FEEDBACK_REVIEW_STEPS[activeStep];

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5D9B8] bg-white" role="status" aria-live="polite">
      <div className="border-b border-[#EEE6D4] bg-[#FFF9E8] px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold text-[#6B5518]">피드백 준비 중</div>
            <div className="mt-0.5 text-[14px] font-semibold text-[#15202B]">
              답안을 세 기준으로 살펴보고 있습니다
            </div>
          </div>
          <div className="flex shrink-0 gap-1" aria-hidden="true">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#D9A400]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#D9A400] [animation-delay:180ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#D9A400] [animation-delay:360ms]" />
          </div>
        </div>
      </div>

      <div className="px-4 py-3.5">
        <ol className="grid gap-2 sm:grid-cols-3" aria-label="피드백 확인 기준">
          {FEEDBACK_REVIEW_STEPS.map((step, index) => {
            const active = index === activeStep;
            return (
              <li
                key={step.label}
                className={[
                  "rounded-lg border px-3 py-2 transition-colors",
                  active
                    ? "border-[#E3C54B] bg-[#FFF9E8]"
                    : "border-[#E8E5DC] bg-[#FAFAF7] text-muted-foreground",
                ].join(" ")}
              >
                <div className="flex items-center gap-1.5 text-[11.5px] font-bold">
                  <span
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                      active ? "bg-[#FAD338] text-[#15202B]" : "bg-[#E8E5DC] text-[#6E777E]",
                    ].join(" ")}
                  >
                    {index + 1}
                  </span>
                  {step.label}
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed">{step.detail}</p>
              </li>
            );
          })}
        </ol>

        <p className="mt-3 text-[12.5px] text-[#3E4C57]">
          지금 확인하는 기준 · <strong>{current.detail}</strong>
        </p>
        {takingLonger && (
          <p className="mt-1.5 rounded-md bg-[#F7F9FA] px-2.5 py-1.5 text-[11.5px] text-muted-foreground">
            복합적인 답안은 몇 초 더 걸릴 수 있습니다. 작성한 답은 이 화면에 그대로 보존됩니다.
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          결과는 확정 채점이 아니며, AI가 생성한 참고 피드백입니다.
        </p>
      </div>
    </div>
  );
}

function MissionRunner({
  mission,
  isSample,
  startAtPart2 = false,
  headerRight,
  status,
  scenarioId,
  speechAct,
  level,
}: {
  mission: MissionRuntime;
  isSample: boolean;
  /** 수행 방식 전환으로 넘어온 경우 1부(판단 연습)를 건너뛴다 — 샘플·데모 전용 */
  startAtPart2?: boolean;
  headerRight: string;
  status: string | null;
  scenarioId: string | null;
  speechAct: string | null;
  level: LearnerLevel | null;
}) {
  const [phase, setPhase] = useState<Phase>(startAtPart2 ? "produce" : "intro");
  const [mpjIdx, setMpjIdx] = useState(0);
  const [mpjResponses, setMpjResponses] = useState<MpjResponseTrace[]>([]);
  // 목표 화용 축(초점)은 첫 판단을 제출한 뒤에만 공개한다. 첫 판단 전에 초점을 보이면
  // Scale4가 재는 것이 첫인상이 아니라 '알려준 방향에 맞추기'가 된다.
  const [focusRevealed, setFocusRevealed] = useState(false);
  const [workflowCompact, setWorkflowCompact] = useState(false);
  const [vocabularyHintOpenedAt, setVocabularyHintOpenedAt] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [revised, setRevised] = useState("");
  const [savedLater, setSavedLater] = useState(false);
  const [resume, setResume] = useState<{
    phase: Phase;
    draft: string;
    revised: string;
    vocabularyHintOpenedAt?: string | null;
  } | null>(null);
  const [saveState, setSaveState] = useState<MissionSaveState>("idle");
  // feedback-lite(계약 §4) — 제출 후 3층 진단. 실패하면 기존 정직 표기로 되돌아간다.
  const [fb, setFb] = useState<RuntimeFeedback | null>(null);
  const [fbState, setFbState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [fbRetryNonce, setFbRetryNonce] = useState(0);
  const fbReqRef = useRef<string | null>(null); // 진행 중인 피드백 요청의 답안 키
  // 이견 채널(0-r·104) — 완료 시 수행 로그의 context_judgment로 함께 저장한다.
  const [dissent, setDissent] = useState<LearnerDissent | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());

  const items = mission.mpj_items;
  const item = items[mpjIdx];
  const dir = mission.direction;
  const langs = DIRECTION_LANGS[dir];
  const tgtName = tgtLangName(dir);
  const srcName = srcLangName(dir);
  const pt = mission.production_task;
  const isInterp = pt.mode === "interpreting";
  const responseRows = responseInputRows(level);
  const part = phase === "intro" || phase === "mpj" || phase === "handoff" ? 1 : 2;
  // 여정 단계 — 이름·순서는 learnerWorkflow 정본, 문항 수는 실제 미션에서 온다.
  const journeySteps = learnerWorkflowSteps({
    interpreting: isInterp,
    mpjCount: items.length,
  });
  const currentStepKey = STEP_OF[phase];
  const currentStepIndex = journeySteps.findIndex((s) => s.key === currentStepKey);
  const workflowHeight = workflowCompact ? WORKFLOW_COMPACT_H : WORKFLOW_EXPANDED_H;
  const stickyContentTop = HEADER_H + workflowHeight;
  // v5 미리보기에서는 문법·화용 실패 화면을 재현하고, 그 외 샘플은 기존 참고 표현을 쓴다.
  const hasRevisionDemo =
    IS_DEMO &&
    isSample &&
    mission.schema_version === "mission_v5" &&
    mission.direction === "ko_zh" &&
    mission.unit.target_feature === "request_mitigation_optionality";
  const demoDraft = hasRevisionDemo ? DEMO_REVISION_DRAFT : pt.reference_alternatives[0]?.text ?? "";
  const demoRevised = pt.reference_alternatives[1]?.text ?? pt.reference_alternatives[0]?.text ?? "";

  const feat = getTargetFeature(mission.unit.target_feature);
  const learnerActLabel = feat?.speech_act ? SPEECH_ACT_UI[feat.speech_act] : "화행";
  const learnerFocusCopy =
    LEARNER_FOCUS_COPY[mission.unit.target_feature] ?? mission.unit.learner_label;

  const feedbackClear = fbState === "ready" && fb?.revision_scope === "clear";
  const revisionReady = responseHasSubstantiveRevision(draft, revised);
  const finalResponse = revisionReady ? revised : draft;
  const revisedChanged = responseWasRevised(draft, finalResponse);
  const reviseAction = revisionActionLine(
    fb,
    mission.unit.target_feature,
    mission.unit.learner_label,
  );
  const completionAdvice = completionAdviceLine({
    fb,
    featureCode: mission.unit.target_feature,
    revisedChanged,
  });

  // 번역 힌트는 수업·MPJ에서 다룬 화용 전략이 아니라 내용 어휘 두 개만 사용한다.
  const vocabularyHints = pt.vocabulary_hints ?? [];
  // 피드백 단계 진입 시 1회 호출. 실패해도 미션을 막지 않는다(정직 표기로 폴백).
  // ⚠️ cleanup으로 취소하지 않는다 — 이 이펙트가 setFbState를 부르므로 의존성이 바뀌어
  //    첫 요청이 곧바로 cleanup되고 결과가 버려진다(로딩에서 멈춤). 대신 ref에 요청 키
  //    (= 제출한 답안)를 두고, 응답이 최신 요청의 것일 때만 반영한다.
  useEffect(() => {
    if (phase !== "feedback" || !draft.trim()) return;
    const key = `${mission.unit.target_feature}\u0000${draft}\u0000${fbRetryNonce}`;
    if (fbReqRef.current === key) return; // 같은 답안은 다시 묻지 않는다
    fbReqRef.current = key;
    setFb(null);
    setFbState("loading");
    if (hasRevisionDemo && draft.trim() === DEMO_REVISION_DRAFT) {
      setFb(DEMO_REVISION_FEEDBACK);
      setFbState("ready");
      return;
    }
    requestFeedback(mission, draft).then((r) => {
      if (fbReqRef.current !== key) return; // 더 최신 제출이 있으면 폐기
      if (r.ok && r.feedback) {
        setFb(r.feedback);
        setFbState("ready");
        if (r.issues?.length) console.warn("[feedback] 정리된 모순:", r.issues);
      } else {
        console.warn("[feedback] 실패:", r.error);
        setFbState("error");
      }
    });
  }, [phase, draft, mission, fbRetryNonce, hasRevisionDemo]);

  // 진행 레일은 첫 화면에서만 전체를 보여 준다. 수행 중에는 현재 단계 한 줄로 줄여
  // 긴 문항의 상단을 덮지 않게 하고, 브라우저의 anchor/scrollIntoView 착지도 같은
  // 고정 영역 아래로 맞춘다.
  useEffect(() => {
    const update = () =>
      setWorkflowCompact((prev) =>
        prev
          ? window.scrollY > WORKFLOW_EXPAND_SCROLL_Y // 접힌 뒤에는 더 올라와야 펼친다
          : window.scrollY > WORKFLOW_COMPACT_SCROLL_Y,
      );
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollPaddingTop;
    root.style.scrollPaddingTop = `${stickyContentTop + SCROLL_TARGET_GAP}px`;
    return () => {
      root.style.scrollPaddingTop = previous;
    };
  }, [stickyContentTop]);

  // 중단 후 재개(프로토타입 v2 ②) — 2부 진행분만 미션별 localStorage에 보존. 실패해도 흐름 무해.
  const storageKey = `pragma:mrun:${scenarioId ?? "sample"}`;
  useEffect(() => {
    // 수행 방식 전환으로 들어온 경우엔 재개 대상이 아니다 — 방금 끝낸 다른 방식의
    // 진행분(같은 sample 키를 쓴다)이 새어 들어와 착지 지점이 달라지면 안 된다.
    if (startAtPart2) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            phase: "produce",
            draft: "",
            revised: "",
            vocabularyHintOpenedAt: null,
          }),
        );
      } catch {
        /* 무시 */
      }
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        const normalizedPhase = s?.phase === "ctx" ? "produce" : s?.phase;
        // 실제로 이어서 할 내용이 있을 때만 재개로 본다. 빈 초안까지 재개로 치면
        // 처음 들어온 학습자에게도 "이전에 진행하던 미션" 배너가 뜬다.
        const hasProgress = Boolean(s?.draft?.trim() || s?.revised?.trim());
        if (
          ["produce", "feedback", "revise", "done"].includes(normalizedPhase) &&
          typeof s?.draft === "string" &&
          typeof s?.revised === "string" &&
          hasProgress
        ) {
          setResume({
            phase: normalizedPhase as Phase,
            draft: s.draft,
            revised: s.revised,
            vocabularyHintOpenedAt:
              typeof s.vocabularyHintOpenedAt === "string" ? s.vocabularyHintOpenedAt : null,
          });
        }
      }
    } catch {
      /* localStorage 미지원 — 재개 없이 정상 진행 */
    }
  }, [storageKey, startAtPart2]);
  useEffect(() => {
    if (part !== 2) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ phase, draft, revised, vocabularyHintOpenedAt }),
      );
    } catch {
      /* 무시 */
    }
  }, [part, phase, draft, revised, vocabularyHintOpenedAt, storageKey]);
  const clearSaved = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* 무시 */
    }
  };
  const applyResume = () => {
    if (!resume) return;
    setDraft(resume.draft || "");
    setRevised(resume.revised || "");
    setVocabularyHintOpenedAt(resume.vocabularyHintOpenedAt ?? null);
    setPhase(resume.phase);
    setResume(null);
    window.scrollTo(0, 0);
  };

  // 미션 완료 = 수행 로그 저장(루프 마지막 노드). 데모 스텁은 저장 불가 → 안내만.
  const finish = async () => {
    setPhase("done");
    if (saveState === "saving" || saveState === "saved") return;
    setSaveState("saving");
    const res = await saveMissionAttempt({
      mission,
      scenarioId,
      speechAct,
      level,
      firstResponse: draft,
      revisedResponse: finalResponse,
      ...(fb ? { feedback: fb } : {}),
      startedAtIso: startedAtRef.current,
      ...(mpjResponses.length > 0 ? { mpjResponses } : {}),
      ...(!isInterp && dir === "ko_zh"
        ? {
            productionSupport: {
              kind: "translation_vocabulary_hints" as const,
              available: vocabularyHints.length === 2,
              opened: vocabularyHintOpenedAt !== null,
              opened_at: vocabularyHintOpenedAt,
            },
          }
        : {}),
      ...(dissent ? { contextJudgment: dissent } : {}),
    });
    if (res.ok) {
      setSaveState("saved");
      clearSaved();
    } else {
      setSaveState((res as { reason?: string }).reason === "no_auth" ? "demo" : "error");
      clearSaved();
    }
  };

  const nextMpj = (response: MpjResponseTrace) => {
    setMpjResponses((prev) => [
      ...prev.filter((saved) => saved.item_id !== response.item_id),
      response,
    ]);
    if (mpjIdx < items.length - 1) {
      setMpjIdx((i) => i + 1);
      // 문항 전환도 단계 전환과 같게 최상단으로 — 없으면 이전 문항의 스크롤 위치가
      // 남아 새 문항이 상황 카드 중간부터 보인다.
      window.scrollTo(0, 0);
    } else {
      setPhase("handoff");
      window.scrollTo(0, 0);
    }
  };

  const goto = (p: Phase) => {
    setPhase(p);
    window.scrollTo(0, 0);
  };

  const beginRevision = () => {
    setRevised(feedbackClear ? "" : draft);
    goto("revise");
  };

  const finishRevision = () => {
    if (!revisionReady) return;
    void finish();
  };

  const resetAll = () => {
    clearSaved();
    setPhase("intro");
    setMpjIdx(0);
    setMpjResponses([]);
    setVocabularyHintOpenedAt(null);
    setDraft("");
    setRevised("");
    setSavedLater(false);
    setResume(null);
    setSaveState("idle");
    startedAtRef.current = new Date().toISOString();
    window.scrollTo(0, 0);
  };

  return (
    <LearnerJourneyShell headerRight={<span className="text-[12px] text-[#8899A6]">{headerRight}</span>}>
      <div>
        {/* 샘플 배너는 헤더 라벨(「샘플 · 예문 검토 전」)로 옮겼다 — 첫 화면 자리를
            문항에 내준다. 미검수(generated) 경고는 성격이 달라 배너로 남긴다. */}
        {status === "generated" && (
          <div className="mb-3 rounded-lg border border-dashed border-[#C9A227] bg-[#FFFBEA] px-3.5 py-2.5 text-[12px] text-[#6B5518]">
            <b>검토 전(generated)</b> 미션입니다 · 개발 확인용. 학습자 배포는 검토 완료본만 됩니다.
          </div>
        )}

        {/* 중단 후 재개 배너 — 2부 진행분이 남아 있을 때만 */}
        {resume && (phase === "intro" || phase === "mpj") && mpjIdx === 0 && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-[#FAD338] bg-[#FFF8DE] px-3.5 py-2.5 text-[12.5px] text-[#6B5518]">
            <span>이전에 진행하던 <b>미션</b>이 있습니다.</span>
            <button
              type="button"
              onClick={applyResume}
              className="shrink-0 rounded-md bg-[#15202B] px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              이어서 하기 →
            </button>
          </div>
        )}

            {/* ── 화행·학습 초점 + 3단계 워크플로우 ──
                헤더 아래에 고정해 긴 문항에서도 현재 화행·초점·단계를 잃지 않는다.
                feature 정본명은 바꾸지 않고, 이 표면에서만 행동 문장으로 풀어 쓴다. */}
            <div
              className={[
                // height 트랜지션을 두지 않는다 — 150ms 동안 높이가 매 프레임 변하면
                // 그때마다 문서 높이·scrollY가 흔들려 임계값 판정이 계속 뒤집힌다.
                // 안쪽 레일은 어차피 hidden으로 즉시 사라지므로 애니메이션 이득도 없다.
                "sticky z-30 -mx-6 mb-2 border-b border-[#E6E0CE] bg-background/95 px-6 shadow-[0_6px_16px_rgba(21,32,43,0.05)] backdrop-blur",
                workflowCompact ? "h-[52px] py-2" : "h-[92px] pb-2.5 pt-2",
              ].join(" ")}
              style={{ top: `${HEADER_H}px` }}
            >
              <div className={`${workflowCompact ? "h-full" : "mb-2 h-[17px]"} flex min-w-0 items-center gap-2 whitespace-nowrap`}>
                <span className="shrink-0 rounded-full border border-[#E5C84A] bg-[#FFF3B5] px-2 py-0.5 text-[10.5px] font-extrabold text-[#5F4A00]">
                  {learnerActLabel}
                </span>
                {/* 첫 판단 전에는 과제명만 — 초점 문구는 판정 방향을 알려주므로 숨긴다.
                    공개는 첫 판단 제출 이후(focusRevealed)에만 일어난다. */}
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#3E4C57]">
                  {focusRevealed ? `이번 미션의 초점 · ${learnerFocusCopy}` : "상황에 맞는 표현 판단하기"}
                </span>
                {workflowCompact && (
                  <span className="ml-auto shrink-0 rounded-full bg-[#F2EEE0] px-2 py-1 text-[10.5px] font-bold text-[#3E4C57]">
                    {currentStepIndex + 1}/{journeySteps.length} · {journeySteps[currentStepIndex]?.label}
                  </span>
                )}
              </div>

              {/* 진행 레일 — 완료는 노란 원+체크, 현재는 노란 링, 예정은 회색 테두리.
                  연결선은 지나온 구간만 노랑이다. 단계 이름은 레일 아래에 둔다. */}
              <div className={workflowCompact ? "hidden" : "flex items-start"} aria-label="미션 진행 단계">
                {journeySteps.map((step, i) => {
                  const done = i < currentStepIndex;
                  const active = i === currentStepIndex;
                  const circle = [
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none",
                    done
                      ? "bg-[#FAD338] text-[#15202B]"
                      : active
                        ? "border-[3.5px] border-[#FAD338] bg-white"
                        : "border border-[#D7D2C4] bg-white",
                  ].join(" ");
                  const line = (filled: boolean, hidden: boolean) => (
                    <span
                      aria-hidden
                      className={`h-[2px] flex-1 ${
                        hidden ? "bg-transparent" : filled ? "bg-[#FAD338]" : "bg-[#E3DFD2]"
                      }`}
                    />
                  );
                  const inner = (
                    <>
                      <span className="flex w-full items-center">
                        {line(done || active, i === 0)}
                        <span className={circle}>{done ? "✓" : ""}</span>
                        {line(done, i === journeySteps.length - 1)}
                      </span>
                      {/* 콜드 오픈에서는 라벨을 숨긴다 — 5단계 이름이 다 펼쳐지면 장면이
                          아니라 과제량 고지로 읽힌다. 자리는 남겨 단계 전환 시 높이가
                          흔들리지 않게 하고, 화면 낭독기에는 그대로 남는다. */}
                      <span
                        className={`mt-1 block px-0.5 text-center text-[9.5px] leading-tight ${
                          phase === "intro"
                            ? active
                              ? "font-semibold text-[#737B83]"
                              : "text-[#B2B7BC]"
                            : active
                              ? "font-bold text-[#15202B]"
                              : done
                                ? "text-[#5B6670]"
                                : "text-[#A9B0BA]"
                        }`}
                      >
                        {step.label}
                      </span>
                    </>
                  );
                  return IS_DEMO ? (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => {
                        const target = PHASE_OF_STEP[step.key];
                        if (target === "mpj") setMpjIdx(0);
                        goto(target);
                      }}
                      className="flex min-w-0 flex-1 flex-col items-center"
                    >
                      {inner}
                    </button>
                  ) : (
                    <div key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 현재 단계의 잔걸음. 연구 표기(MPJ·DCT)는 여기 보조 라벨로만 남긴다. */}
            <div className={phase === "intro" ? "hidden" : "mb-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#A9B0BA]"}>
              <span className="rounded bg-[#F2EEE0] px-1.5 py-0.5 text-[10px] font-semibold text-[#8A8272]">
                {journeySteps[currentStepIndex]?.aside}
              </span>
              {phase === "mpj" && (
                <>
                  <span>예시 {mpjIdx + 1} / {items.length}</span>
                  <span className="text-[#D3CEC0]">·</span>
                  <span className="font-bold text-[#15202B]">
                    {mpjTaskTitle(item, mission.unit.target_feature, pt.mode)}
                  </span>
                </>
              )}
              {phase === "handoff" && (
                <span className="font-bold text-foreground">예시 {items.length}개 정리</span>
              )}
              {phase === "done" && <span className="font-bold text-foreground">완료</span>}
            </div>

        {/* ── 0부: 최종 DCT 장면 콜드 오픈 ──
            절차 설명보다 먼저 실제 수행 장면을 보여 준다. production_task를 읽기만 하며
            판정·저장에는 관여하지 않는다. */}
        {phase === "intro" && (
          <MissionColdOpen
            productionTask={pt}
            speechAct={speechAct ?? feat?.speech_act ?? null}
            direction={mission.direction}
            mpjCount={items.length}
            onStart={() => goto("mpj")}
          />
        )}

        {/* ── 1부: 판단 연습(MPJ) ── */}
        {phase === "mpj" && (
          <div className="space-y-3">
            {/* 문항이 첫 화면을 차지한다 — 학생이 처음 봐야 할 것은 상황이지 완료 조건이 아니다.
                초점 라벨·문항 수는 위쪽 맥락 띠와 진행바가 이미 말한다(삼중 노출 제거). */}
            <MpjStage
              key={item.id}
              item={item}
              mode={pt.mode}
              sequentialFix={
                mission.schema_version === "mission_v4" || mission.schema_version === "mission_v5"
              }
              isLastItem={mpjIdx === items.length - 1}
              stickyContentTop={stickyContentTop}
              onDone={nextMpj}
              onFirstAnswer={() => setFocusRevealed(true)}
            />
            {mpjIdx === 0 && <MissionBriefDrawer mission={mission} focusRevealed={focusRevealed} />}
          </div>
        )}

        {/* ── 1부 → 2부 인계 ── */}
        {phase === "handoff" && (
          <Handoff
            mission={mission}
            isInterp={isInterp}
            responses={mpjResponses}
            saved={savedLater}
            onContinue={() => goto("produce")}
            onSaveLater={() => {
              try {
                localStorage.setItem(storageKey, JSON.stringify({ phase: "produce", draft: "", revised: "" }));
              } catch {
                /* 무시 */
              }
              setSavedLater(true);
            }}
          />
        )}

        {/* ── 2단계: 판단을 반복하지 않고 곧바로 번역/통역 산출 ── */}
        {phase === "produce" && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[#66727C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F5C842]" aria-hidden="true" />
              처음 그 장면으로 돌아왔습니다.
            </p>
            {isInterp ? (
              <AudioFrame
                sourceText={pt.source_text}
                srcName={srcName}
                tgtName={tgtName}
                ttsLang={langs.tts}
                sttLang={langs.stt}
                situation={pt.situation_ko}
                relation={pt.relation_ko}
                demoText={demoDraft}
                onSubmit={(t) => {
                  setDraft(t);
                  goto("feedback");
                }}
              />
            ) : (
              <>
                <TranslationComposer
                  situation={pt.situation_ko}
                  relation={pt.relation_ko}
                  precedingTurn={pt.preceding_turn}
                  sourceText={pt.source_text}
                  srcName={srcName}
                  tgtName={tgtName}
                  rows={responseRows}
                  draft={draft}
                  onDraftChange={setDraft}
                >
                  {dir === "ko_zh" && vocabularyHints.length === 2 && (
                    <ProductionGuide
                      hints={vocabularyHints}
                      onOpen={() =>
                        setVocabularyHintOpenedAt((openedAt) => openedAt ?? new Date().toISOString())
                      }
                    />
                  )}
                </TranslationComposer>
                <Button className="w-full bg-[#FAD338] text-[#15202B] hover:bg-[#F0C800]" disabled={!draft.trim()} onClick={() => goto("feedback")}>번역 제출 →</Button>
                {IS_DEMO && (
                  <button type="button" className={demoBtn} onClick={() => setDraft(demoDraft)}>
                    {hasRevisionDemo
                      ? "데모 채우기 — 문법·상황 조절 예시"
                      : "데모 채우기 — 예시 답안 입력"}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ── 2부 ③: 피드백 ── */}
        {phase === "feedback" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#15202B] p-4 text-white shadow-sm">
              <div className="text-[11.5px] font-bold text-[#FAD338]">{isInterp ? "내 통역 · 확인한 전사" : "내 번역"}</div>
              <p className="mt-2 whitespace-pre-wrap break-words text-[16px] font-medium leading-relaxed">{draft}</p>
            </div>

            {fbState === "loading" && (
              <FeedbackLoadingPanel />
            )}

            {fbState === "ready" && fb && (
              <FeedbackPanel fb={fb} featureCode={mission.unit.target_feature} />
            )}

            {/* 진단 실패 시 폴백 — 기존 정직 표기로 되돌아간다(미션은 계속 진행). */}
            {fbState === "error" && (
              <div className="rounded-lg border border-dashed border-[#B9C4CE] bg-[#F7F9FA] p-3 text-[11.5px] text-[#5B6B76]">
                <p>답변별 자동 진단을 불러오지 못했습니다. 다시 시도하거나, 참고 표현과 이번 초점을 바탕으로 계속 다듬을 수 있습니다.</p>
                <button
                  type="button"
                  className="mt-2 rounded-md border border-[#9EADB8] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#365B72] hover:bg-[#EEF3F7]"
                  onClick={() => setFbRetryNonce((n) => n + 1)}
                >
                  진단 다시 불러오기
                </button>
              </div>
            )}

            {fbState !== "loading" && (
              <>
                {(fbState === "error" || feedbackClear) && (
                  <details className={card}>
                    <summary className="cursor-pointer text-[13px] font-semibold">
                      {feedbackClear ? "다른 표현도 보고 싶다면" : "참고 표현 보기"}
                    </summary>
                    <p className="mt-1 text-[12px] text-muted-foreground">정답이 아니라 비교용입니다. 상황에 따라 어울리는 범위가 달라집니다.</p>
                    <ul className="mt-2.5 space-y-2">
                      {mission.production_task.reference_alternatives.map((a) => (
                        <li key={a.text} className="rounded-lg bg-[#FAF8F2] px-3.5 py-2.5">
                          <div className="text-[15px] font-medium leading-relaxed">{a.text}</div>
                          <div className="mt-0.5 text-[12px] text-muted-foreground">{a.note_ko}</div>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* 이견 채널 — 판정이 나온 뒤에만 여는 별도 통로(0-r·104) */}
                {fbState === "ready" && (
                  <DissentPanel
                    onSubmit={(d) =>
                      setDissent({
                        kind: "learner_dissent",
                        at: "feedback",
                        conditions: d.conditions,
                        reason_ko: d.reason,
                        created_at: new Date().toISOString(),
                      })
                    }
                  />
                )}
              </>
            )}

            {feedbackClear ? (
              <div className="space-y-2">
                <Button className="w-full" onClick={() => void finish()}>
                  이 표현으로 완료 →
                </Button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-[#D7DDE5] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#3E4C57] transition-colors hover:bg-[#F7F9FA]"
                  onClick={beginRevision}
                >
                  다른 표현도 시도해보기
                </button>
              </div>
            ) : (
              <Button className="w-full" disabled={fbState === "loading"} onClick={beginRevision}>
                한 번 다듬어보기 →
              </Button>
            )}
          </div>
        )}

        {/* ── 2부 ④: 다듬기 ── */}
        {phase === "revise" && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#26384A] p-4 text-white shadow-[0_7px_18px_rgba(21,32,43,0.1)]">
              <div className="text-[11.5px] font-bold text-[#FAD338]">
                {feedbackClear ? "지금 할 일" : "이번에 고칠 한 가지"}
              </div>
              <p className="mt-1.5 text-[15.5px] font-semibold leading-relaxed">
                {feedbackClear
                  ? "같은 뜻을 유지하면서, 표현 방식만 바꿔 한 번 더 작성하세요."
                  : reviseAction}
              </p>
              {feedbackClear && (
                <p className="mt-1 text-[12px] leading-relaxed text-[#B9C6CF]">
                  문장 구성이나 표현을 다르게 써 보면 됩니다.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[#D7DDE5] bg-[#F5F7F9] p-4">
              <div className="text-[11.5px] font-bold text-[#5B6B76]">
                {isInterp ? "통역 초안" : "번역 초안"}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] font-medium leading-relaxed text-[#15202B]">{draft}</p>
            </div>
            <div className="rounded-xl border border-[#E1DED5] bg-[#F2F1ED] p-4">
              <label htmlFor="revised-response" className="text-[12px] font-bold text-[#53616B]">
                {isInterp ? "통역 수정" : "번역 수정"}
              </label>
              <Textarea
                id="revised-response"
                className="mt-2 min-h-0 resize-y rounded-xl border-2 border-[#15202B] bg-white px-4 py-3 text-[15px] font-medium leading-relaxed text-[#15202B] shadow-[4px_4px_0_rgba(21,32,43,0.1)] placeholder:text-[#8A8F94] focus-visible:ring-2 focus-visible:ring-[#FAD338]/55 focus-visible:ring-offset-2"
                rows={responseRows}
                value={revised}
                onChange={(e) => setRevised(e.target.value)}
                placeholder={
                  feedbackClear
                    ? "같은 뜻을 다른 표현으로 작성하세요…"
                    : "위 피드백을 반영해 표현을 고쳐 쓰세요…"
                }
              />
              {!revisionReady && (
                <p className="mt-2 text-[12px] font-medium text-[#755A0B]">
                  원문과 다른 수정안을 입력해야 완료할 수 있습니다.
                </p>
              )}
            </div>
            <Button
              className="w-full bg-[#FAD338] text-[#15202B] hover:bg-[#F0C800]"
              disabled={!revisionReady}
              onClick={finishRevision}
            >
              {feedbackClear ? "새 표현으로 완료 →" : "수정 완료 →"}
            </Button>
            {IS_DEMO && (
              <button type="button" className={demoBtn} onClick={() => setRevised(demoRevised)}>데모 채우기 — 다듬은 안 적용</button>
            )}
          </div>
        )}

        {/* ── 완료 ── */}
        {phase === "done" && (
          <div className="space-y-3">
            <RevisionMap
              first={draft}
              final={finalResponse}
              featureLabel={learnerFocusCopy}
              interp={isInterp}
              strategy={revisedChanged ? reviseAction : "첫 표현을 그대로 최종안으로 확정했습니다."}
              advice={completionAdvice}
            />

            {shouldShowCorrectionNotesLink(saveState, draft, finalResponse) && (
              <Link
                to="/learner/records#correction-notes"
                className="flex items-center justify-between rounded-xl border border-[#CFE4D8] bg-[#F2FAF6] px-4 py-3 text-[13px] font-semibold text-[#236847] transition-colors hover:bg-[#E8F5ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D5B] focus-visible:ring-offset-2"
              >
                <span>나의 수정 노트에 저장됨</span>
                <span>모아보기 →</span>
              </Link>
            )}

            <div
              className={[
                "rounded-lg px-3.5 py-2.5 text-[12.5px]",
                saveState === "saved" ? "bg-[#F2FAF6] text-[#2E7D5B]" : "bg-[#F7F9FA] text-[#5B6B76]",
              ].join(" ")}
            >
              {saveState === "saving" && "수행 기록 저장 중…"}
              {saveState === "saved" &&
                (revisedChanged
                  ? "✓ 이번 수행과 수정 결과가 저장되었습니다."
                  : "✓ 이번 수행 결과가 저장되었습니다.")}
              {saveState === "demo" && "데모 모드입니다 — 실제 로그인 시 수행 기록이 저장됩니다."}
              {saveState === "error" && "수행 기록 저장에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도하십시오."}
              {saveState === "idle" && "수행 기록을 준비 중입니다."}
            </div>

            {/* 완료 화면의 마지막 행동 — 데모/샘플에서는 「처음부터 다시 보기」 자리를
                수행 방식 전환이 대신한다. "이어서"라는 말대로 번역을 끝까지 훑어본
                다음이 통역 차례이고, 위쪽에 두면 노란 카드가 뭉쳐 부담스럽다.
                실제 미션의 mode는 승격 시 정해지므로(계약 0-o) 여기서 바뀌는 것은
                **샘플 미리보기**뿐이고, 실 학습 세션(IS_DEMO 꺼짐)엔 노출되지 않는다.
                재개 상태가 남아 있으면 곧바로 완료 화면이 복원되므로 먼저 지운다. */}
            {IS_DEMO && isSample ? (
              <button
                type="button"
                onClick={() => {
                  // 방금 끝낸 방식의 진행분을 2부 시작 상태로 덮어쓴다. 단순 삭제만 하면
                  // 이동 직전 저장 이펙트가 현재 상태를 되써서 다음 화면이 산출 단계로
                  // 튈 수 있다(같은 sample 키를 공유).
                  try {
                    localStorage.setItem(
                      storageKey,
                      JSON.stringify({ phase: "produce", draft: "", revised: "" }),
                    );
                  } catch { /* ignore */ }
                  // part=2 — 1부(판단 연습)는 방금 마쳤으므로 건너뛰고 바로 2부로.
                  // v4 검토에서는 preview 쿼리를 보존해야 같은 미션과 DEV 인증 우회를
                  // 유지한다. 빠지면 구 샘플로 바뀌고 새 탭에서는 로그인 화면으로 튄다.
                  const nextParams = new URLSearchParams();
                  if (mission.schema_version === "mission_v5") nextParams.set("preview", "v5");
                  else if (mission.schema_version === "mission_v4") nextParams.set("preview", "v4");
                  if (!isInterp) nextParams.set("mode", "interpreting");
                  nextParams.set("part", "2");
                  window.location.href = `/learner/practice?${nextParams.toString()}`;
                }}
                className="w-full rounded-xl bg-[#FAD338] px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#F5C81F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] focus-visible:ring-offset-2"
              >
                <div className="text-[11.5px] font-bold text-[#6B5518]">
                  수행 방식 2가지 중 1가지 완료 · 다음
                </div>
                <div className="mt-1 flex items-center gap-2 text-[16px] font-bold text-[#15202B]">
                  <span>{isInterp ? "✍️" : "🎙️"}</span>
                  <span>이어서 {isInterp ? "번역" : "통역"}으로 해보기 →</span>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5B4A1E]">
                  {isInterp
                    ? "표현 감각 익히기는 건너뛰고 곧바로 번역 산출부터 이어집니다."
                    : "표현 감각 익히기는 건너뛰고 곧바로 통역 산출부터 이어집니다 — 원문 듣기 → 녹음 → 전사 확인."}
                </p>
              </button>
            ) : (
              <Button variant="outline" className="w-full" onClick={resetAll}>처음부터 다시 보기 ↺</Button>
            )}
          </div>
        )}
      </div>
    </LearnerJourneyShell>
  );
}

// ── 통역 오디오 프레임 — 듣기(≤2회) → 녹음 → STT 초안 → 전사 확인 → 제출 ──
// 실동작: 서버 TTS(고정 음원)·MediaRecorder(서버 STT 전송)·SpeechRecognition(실패 폴백).
// 음성 파일은 서버·DB에 저장하지 않는다. 전사 확인 중에만 브라우저 메모리에 두고,
// 재녹음·단계 이탈 시 폐기한다. 학습자가 확인한 전사만 제출·저장한다.
type BrowserSpeechRecognitionResultList = {
  length: number;
  [index: number]: {
    [index: number]: { transcript: string };
  };
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: BrowserSpeechRecognitionResultList }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & {
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

/**
 * 최종 DCT 장면 콜드 오픈 — 생성 데이터 한 건을 **3장 카드뉴스**로 편집해 보여 준다.
 * 새 설명이나 평가 기준을 보태지 않고 situation_ko를 장면/단서로 나눈 뒤, 마지막 장에서
 * 목표언어 질문을 건넨다. 번역의 실제 선행 발화는 사건을 시작시키는 말로 미리 보여 주고
 * DCT에서 다시 회수한다. 통역은 수행 화면과 정렬되기 전까지 선행 발화를 여기서 추가 노출하지
 * 않는다. 미션 내부 문항을 여러 장으로 쪼개는 것이 아니라 진입부에서만 짧은 서사를 만든다.
 *
 * 🔴 대역(band) 축은 이 화면에서 절대 노출하지 않는다. MPJ는 Scale4(첫인상) → FixChoice →
 * Reason → MultiJudge로 축을 단계적으로 공개하도록 설계돼 있고, 여기서 "밀어붙이면/돌려
 * 말하면" 같은 양극단을 미리 말하면 Scale4가 재는 것이 첫인상이 아니게 된다. 또한
 * '간접적이면 모호하다'는 소박한 규칙을 설치해 카탈로그 counter_rule과 충돌한다.
 * 학습자에게는 **판단에 필요한 상황 사실**만 준다.
 */
function MissionColdOpen({
  productionTask,
  speechAct,
  direction,
  mpjCount,
  onStart,
}: {
  productionTask: MissionRuntime["production_task"];
  speechAct: string | null;
  direction: MissionRuntime["direction"];
  mpjCount: number;
  onStart: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [cardIndex, setCardIndex] = useState(0);
  // 화면에는 안 쓰지만 분류는 유지한다 — QA·감사용 data 속성과 결측 경고의 근거다.
  const coldOpen = classifyColdOpen(speechAct, productionTask.preceding_turn);
  const isResponseFallback = coldOpen.kind === "response-fallback";
  const situationBeats =
    productionTask.situation_ko
      .match(/[^.!?。！？]+[.!?。！？]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [productionTask.situation_ko];
  const sceneGoal = sceneHeadline(situationBeats[0]);
  const sceneContext = situationBeats.slice(1).join(" ").trim();
  // 제목은 콘텐츠 길이에 따라 단계적으로 줄인다. 생성물의 첫 문장이 길면 23px에서
  // 다섯 줄이 되어 장면이 아니라 안내문으로 읽힌다. 근본 해결은 생성 쪽이지만,
  // 화면이 먼저 깨지지는 않게 한다.
  const sceneGoalSize =
    sceneGoal.length <= 40
      ? "text-[23px] sm:text-[25px]"
      : sceneGoal.length <= 70
        ? "text-[19px] sm:text-[21px]"
        : "text-[17px] sm:text-[18px]";

  // 화행별 동사형이 없으면 문장을 깨뜨리는 대신 중립형으로 떨어뜨린다.
  const actVerb = (speechAct && (SPEECH_ACT_VERB_KO as Record<string, string>)[speechAct]) || "말하면";
  const targetLangKo = direction === "zh_ko" ? "한국어" : "중국어";
  const clue =
    sceneContext || "말뜻뿐 아니라 이 장면의 관계와 상황도 함께 살펴보세요.";
  const closingQuestion =
    productionTask.mode === "interpreting"
      ? `${targetLangKo}로 어떻게 통역하면 좋을까?`
      : `${targetLangKo}로는 어떻게 ${actVerb} 좋을까?`;
  const closingLead = "먼저 네 장면을 살펴보고, 이 장면으로 돌아옵니다.";
  const arrivingTurn = productionTask.mode === "translation" ? coldOpen.precedingTurn : null;
  const isLastCard = cardIndex === 2;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isResponseFallback || !import.meta.env.DEV) return;
    console.warn(
      `[mission cold open] ${speechAct ?? "unknown"} 응답 화행에 preceding_turn이 없습니다(콘텐츠 결측).`,
    );
  }, [isResponseFallback, speechAct]);

  // 생성 계약은 situation_ko에 매체 속성·상대의 권리·평가 기준을 풀어 쓰지 말라고
  // 명시한다("기록으로 남기는 목적", "즉각적인 반응을 요구하지 않는다" 등). 화면에서
  // 가리면 위반이 은폐되므로, 표시는 그대로 두고 개발 중에만 결함으로 드러낸다.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (sceneGoal.length > 70) {
      console.warn(
        `[mission cold open] situation_ko 첫 문장이 ${sceneGoal.length}자입니다. 장면 제목으로 너무 깁니다.`,
      );
    }
    const banned = ["기록으로", "즉시 반응", "즉각적인 반응", "추가 승인", "내부 보고", "권한이 없", "선택권"];
    // 첫 문장이 표제(sceneGoal)로 분리되더라도 계약 검사는 situation_ko 전체를 본다.
    // 첫 문장에 금지 서술이 들어온 경우를 놓치면 화면 분리 방식이 검사 공백을 만든다.
    const hit = banned.filter((w) => productionTask.situation_ko.includes(w));
    if (hit.length) {
      console.warn(
        `[mission cold open] situation_ko에 계약이 금지한 매체·권리 서술이 있습니다: ${hit.join(", ")}`,
      );
    }
  }, [productionTask.situation_ko, sceneGoal]);

  return (
    <div className="mx-auto w-full max-w-[720px] pt-1" data-cold-open-kind={coldOpen.kind}>
      <section
        className="mission-message-in rounded-[28px] border border-[#DED8C8] bg-[#F9F6EC] p-2.5 shadow-[0_18px_48px_rgba(21,32,43,0.13)] sm:p-3"
        aria-label="오늘 수행할 장면"
      >
        <div
          key={cardIndex}
          className={`mission-card-in relative flex min-h-[320px] flex-col overflow-hidden rounded-[21px] px-6 py-6 sm:min-h-[350px] sm:px-9 sm:py-8 ${
            cardIndex === 0
              ? "bg-[#1B2733] text-[#F7F3E8]"
              : cardIndex === 1
                ? "bg-[#F5C842] text-[#15202B]"
                : "bg-[#E8EFE7] text-[#15202B]"
          }`}
          aria-live="polite"
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -right-2 -top-10 select-none text-[136px] font-black leading-none tracking-[-0.08em] sm:text-[170px] ${
              cardIndex === 0
                ? "text-white/[0.045]"
                : cardIndex === 1
                  ? "text-[#15202B]/[0.055]"
                  : "text-[#2E6C58]/[0.06]"
            }`}
          >
            0{cardIndex + 1}
          </span>

          <div className="relative z-10 flex h-full flex-1 flex-col">
            <p
              className={`text-[11px] font-bold tracking-[0.16em] ${
                cardIndex === 0 ? "text-[#F5C842]" : cardIndex === 1 ? "text-[#6B5500]" : "text-[#2E6C58]"
              }`}
            >
              {cardIndex === 0 ? "01 · 오늘의 장면" : cardIndex === 1 ? "02 · 장면 속 단서" : "03 · 당신의 선택"}
            </p>

            {cardIndex === 0 && (
              <>
                {/* 진입 시 낭독기가 장면부터 읽도록 포커스만 옮긴다. 표시용 링은 두지 않는다.
                    keep-all + balance로 한국어 조사가 줄 시작에서 떨어지지 않게 한다. */}
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  style={{ textWrap: "balance" }}
                  className={`mt-auto break-keep pb-1 ${sceneGoalSize} max-w-[580px] font-semibold leading-[1.42] tracking-[-0.03em] text-[#F7F3E8] outline-none`}
                >
                  {sceneGoal}
                </h2>
              </>
            )}

            {cardIndex === 1 && (
              <div className="my-auto max-w-[590px]">
                <h2
                  style={{ textWrap: "balance" }}
                  className="break-keep text-[22px] font-bold leading-[1.35] tracking-[-0.03em] text-[#15202B] sm:text-[27px]"
                >
                  그런데, 이런 사정이 있습니다
                </h2>
                <p className="mt-5 break-keep text-[15px] font-medium leading-[1.75] tracking-[-0.012em] text-[#3E3A2D] sm:text-[16px]">
                  {clue}
                </p>
              </div>
            )}

            {cardIndex === 2 && (
              <div className="my-auto max-w-[590px]">
                <h2
                  style={{ textWrap: "balance" }}
                  className="break-keep text-[25px] font-bold leading-[1.35] tracking-[-0.035em] text-[#15202B] sm:text-[31px]"
                >
                  {closingQuestion}
                </h2>
                {arrivingTurn && (
                  <div className="mt-5 max-w-[520px]">
                    <p className="mb-2 text-[10.5px] font-bold tracking-[0.08em] text-[#607069]">
                      도착한 메시지
                    </p>
                    <ChatBubble side="them">{arrivingTurn}</ChatBubble>
                  </div>
                )}
                <p className="mt-5 break-keep text-[14px] leading-[1.7] tracking-[-0.01em] text-[#53615A] sm:text-[15px]">
                  {closingLead}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-[58px] items-center justify-between gap-3 px-2 pt-2.5 sm:px-3">
          <div className="flex items-center gap-2" aria-label={`카드 ${cardIndex + 1} / 3`}>
            {[0, 1, 2].map((index) => (
              <button
                key={index}
                type="button"
                aria-label={`${index + 1}번 카드 보기`}
                aria-current={cardIndex === index ? "step" : undefined}
                onClick={() => setCardIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  cardIndex === index ? "w-7 bg-[#15202B]" : "w-2 bg-[#C9C1AD] hover:bg-[#8F8776]"
                }`}
              />
            ))}
            <span className="ml-1 hidden text-[11px] font-semibold tabular-nums text-[#777063] sm:inline">
              {cardIndex + 1} / 3
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {cardIndex > 0 && (
              <button
                type="button"
                aria-label="이전 카드"
                onClick={() => setCardIndex((current) => Math.max(0, current - 1))}
                className="whitespace-nowrap rounded-full px-2.5 py-2 text-[12px] font-semibold text-[#6D675C] hover:bg-[#EEE9DC] hover:text-[#15202B] sm:px-3 sm:text-[12.5px]"
              >
                <span aria-hidden="true" className="sm:hidden">←</span>
                <span className="hidden sm:inline">이전</span>
              </button>
            )}
            {!isLastCard && (
              <button
                type="button"
                onClick={onStart}
                className="whitespace-nowrap rounded-full px-2 py-2 text-[12px] font-semibold text-[#8A8272] hover:bg-[#EEE9DC] hover:text-[#15202B] sm:px-3 sm:text-[12.5px]"
              >
                바로 시작
              </button>
            )}
            {isLastCard ? (
              <Button
                className="h-auto whitespace-nowrap rounded-full bg-[#15202B] px-4 py-2.5 text-[13px] font-semibold tracking-[-0.015em] text-white shadow-none transition-transform hover:-translate-y-0.5 hover:bg-[#273849] active:translate-y-0 motion-reduce:transform-none sm:px-6 sm:text-[13.5px]"
                onClick={onStart}
              >
                {mpjCount}개 장면으로 감 잡기 <span aria-hidden="true">→</span>
              </Button>
            ) : (
              <Button
                className="h-auto whitespace-nowrap rounded-full bg-[#F5C842] px-4 py-2.5 text-[13px] font-semibold tracking-[-0.015em] text-[#15202B] shadow-none transition-transform hover:-translate-y-0.5 hover:bg-[#FCE07A] active:translate-y-0 motion-reduce:transform-none sm:px-6 sm:text-[13.5px]"
                onClick={() => setCardIndex((current) => Math.min(2, current + 1))}
              >
                다음 카드 <span aria-hidden="true">→</span>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function TranslationComposer({
  situation,
  relation,
  precedingTurn,
  sourceText,
  srcName,
  tgtName,
  rows,
  draft,
  onDraftChange,
  children,
}: {
  situation: string;
  relation: string;
  precedingTurn: string | null;
  sourceText: string;
  srcName: string;
  tgtName: string;
  rows: number;
  draft: string;
  onDraftChange: (value: string) => void;
  children?: ReactNode;
}) {
  const skin = translationWritingSkin(situation);
  const counterpart = learnerCounterpartLabel(relation);
  const previousTurn = precedingTurn?.trim() || null;

  return (
    <div className="space-y-3" data-scene-skin={skin}>
      <DctScenePanel
        mode="translation"
        situation={situation}
        relation={relation}
        formatLabel="작성 · 번역"
      />

      <div className="rounded-2xl border border-[#E1DED5] bg-[#F2F1ED] p-4 shadow-[0_7px_20px_rgba(21,32,43,0.04)]">
        <div className="text-[11.5px] font-bold text-[#53616B]">① 번역할 내용 ({srcName})</div>
        <div className="mt-2 rounded-xl border border-[#D8D4CA] bg-white px-4 py-3.5">
          <p className="whitespace-pre-line text-[15px] font-medium leading-[1.68] text-[#15202B]">
            {sourceText}
          </p>
        </div>
      </div>

      {skin === "email" ? (
        <div className="overflow-hidden rounded-2xl border border-[#CBD4DC] bg-white shadow-[0_8px_22px_rgba(21,32,43,0.07)]">
          <div className="flex items-center justify-between border-b border-[#E1E6EA] bg-[#F7F9FA] px-4 py-2.5">
            <div className="flex items-center gap-2 text-[12px] font-bold text-[#40515F]">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {previousTurn ? "답장 작성" : "새 번역 작성"}
            </div>
            <span className="text-[10.5px] text-[#81909B]">제출 전 초안</span>
          </div>
          <div className="border-b border-[#E7EAED] px-4 py-2.5 text-[12.5px] text-[#5B6B76]">
            받는 사람 <span className="ml-2 font-semibold text-[#273642]">{counterpart}</span>
          </div>
          {previousTurn && (
            <div className="mx-4 mt-3 rounded-lg bg-[#F4F6F7] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#667681]">
              <div className="mb-1 text-[10.5px] font-bold text-[#7A8892]">이전 메시지</div>
              {previousTurn}
            </div>
          )}
          {!previousTurn && (
            <div className="mx-4 mt-3 text-[11.5px] font-semibold text-[#71808B]">
              내가 먼저 번역을 작성하는 장면
            </div>
          )}
          <label className="sr-only" htmlFor="translation-draft">② 내 번역 ({tgtName})</label>
          <Textarea
            id="translation-draft"
            className="min-h-0 resize-y rounded-none border-0 bg-white px-4 py-4 text-[15.5px] font-medium leading-[1.58] text-[#15202B] shadow-none placeholder:text-[#8A8F94] focus-visible:ring-0"
            rows={rows}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={`${tgtName} 번역을 작성하세요…`}
          />
          <div className="flex items-center justify-between border-t border-[#E7EAED] bg-[#FBFCFC] px-4 py-2.5">
            <span className="text-[11px] text-[#82909A]">② 내 번역 ({tgtName})</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#D9E0E5] px-3 py-1.5 text-[11.5px] font-bold text-[#5F6E79]">
              <Send className="h-3.5 w-3.5" aria-hidden="true" /> 제출 전
            </span>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#CBD5DD] bg-[#E8EDF2] shadow-[0_8px_22px_rgba(21,32,43,0.07)]">
          <div className="flex items-center justify-between border-b border-[#D5DDE4] bg-white/95 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-[12px] font-bold text-[#40515F]">
              <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{counterpart}</span>
            </div>
            <span className="text-[10.5px] text-[#81909B]">메시지 작성 중</span>
          </div>
          <div className="px-3.5 pb-3.5 pt-3">
            {previousTurn && <ChatBubble side="them">{previousTurn}</ChatBubble>}
            {!previousTurn && (
              <div className="mb-2 text-center text-[11.5px] font-semibold text-[#71808B]">
                내가 먼저 메시지를 보내는 장면
              </div>
            )}
            <label className="mb-1.5 block text-right text-[11px] font-semibold text-[#52697E]" htmlFor="translation-draft">
              ② 내 번역 ({tgtName}) · 아직 안 보냄
            </label>
            <div className="rounded-[22px] border-2 border-[#6F8291] bg-white shadow-[0_2px_5px_rgba(21,32,43,0.08)]">
              <Textarea
                id="translation-draft"
                className="min-h-0 resize-y rounded-[20px] border-0 bg-transparent px-4 py-3 text-[15.5px] font-medium leading-[1.58] text-[#15202B] shadow-none placeholder:text-[#8A8F94] focus-visible:ring-2 focus-visible:ring-[#FAD338]/55"
                rows={rows}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder={`${tgtName} 메시지를 입력하세요…`}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#9DABB5] text-white" aria-label="제출 전에는 메시지가 전송되지 않습니다">
                <Send className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

function DctScenePanel({
  mode,
  situation,
  relation,
  formatLabel,
}: {
  mode: "translation" | "interpreting";
  situation: string;
  relation: string;
  formatLabel?: string;
}) {
  const isInterpreting = mode === "interpreting";
  return (
    <div
      className={[
        "rounded-xl border border-[#E4E0D6] border-l-4 border-l-[#FAD338] bg-[#FFFDF7]",
        MISSION_SCENE_PANEL_DENSITY,
      ].join(" ")}
    >
      <div className="text-[11px] font-bold tracking-wide text-[#6B5A2A]">
        지금, 직접 {isInterpreting ? "통역" : "번역"}할 장면
      </div>
      <SituationText
        text={situation}
        emphasizeFirst
        spacious
        className={MISSION_SCENE_TEXT_DENSITY}
      />
      <div className={`${MISSION_SCENE_RELATION_GAP} flex flex-wrap gap-1.5`}>
        <Badge variant="secondary" className="font-normal">
          상대 · {learnerCounterpartLabel(relation)}
        </Badge>
        <Badge variant="secondary" className="font-normal">
          {formatLabel ?? (isInterpreting ? "음성 · 순차 통역" : "문자 · 번역")}
        </Badge>
      </div>
    </div>
  );
}

function AudioFrame({
  sourceText,
  srcName,
  tgtName,
  ttsLang,
  sttLang,
  situation,
  relation,
  demoText,
  onSubmit,
}: {
  sourceText: string;
  srcName: string;
  tgtName: string;
  ttsLang: string;
  sttLang: string;
  situation: string;
  relation: string;
  demoText: string;
  onSubmit: (transcript: string) => void;
}) {
  const MAX_PLAYS = 2;
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [recordingAudioUrl, setRecordingAudioUrl] = useState<string | null>(null);
  const recRef = useRef<BrowserSpeechRecognition | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const recordingAudioUrlRef = useRef<string | null>(null);

  const sttSupported = useMemo(
    () => {
      if (typeof window === "undefined") return false;
      const speechWindow = window as SpeechRecognitionWindow;
      return Boolean(speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition);
    },
    [],
  );
  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* 무시 */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (recordingAudioUrlRef.current) URL.revokeObjectURL(recordingAudioUrlRef.current);
    };
  }, []);

  const play = async () => {
    if (plays >= MAX_PLAYS || playing || ttsLoading) return;
    setNotice(null);

    try {
      let audio = audioRef.current;
      if (!audio) {
        setTtsLoading(true);
        const result = await requestTtsAudio({
          text: sourceText,
          lang: ttsLang.toLowerCase().startsWith("zh") ? "zh" : "ko",
          logPrefix: "[mission-tts]",
        });
        setTtsLoading(false);

        if (result.ok === false) {
          setNotice(`고품질 음성을 준비하지 못했습니다 — ${result.message}`);
          return;
        }

        const url = URL.createObjectURL(result.blob);
        audioUrlRef.current = url;
        audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.onerror = () => {
          setPlaying(false);
          setNotice("음성 재생에 실패했습니다. 다시 시도해 주세요.");
        };
      }

      audio.currentTime = 0;
      setPlaying(true);
      await audio.play();
      setPlays((count) => count + 1);
    } catch {
      setPlaying(false);
      setTtsLoading(false);
      setNotice("고품질 음성 재생에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const startRec = async () => {
    setNotice(null);
    setRecorded(false);
    setConfirmed(false);
    setTranscript("");
    setTranscribing(false);
    recordingAudioRef.current?.pause();
    if (recordingAudioUrlRef.current) {
      URL.revokeObjectURL(recordingAudioUrlRef.current);
      recordingAudioUrlRef.current = null;
    }
    setRecordingAudioUrl(null);
    // ① STT 초안(가능하면)
    if (sttSupported) {
      try {
        const speechWindow = window as SpeechRecognitionWindow;
        const SR = speechWindow.webkitSpeechRecognition || speechWindow.SpeechRecognition;
        if (!SR) throw new Error("SpeechRecognition unavailable");
        const rec = new SR();
        rec.lang = sttLang;
        rec.interimResults = true;
        rec.continuous = true;
        rec.onresult = (event) => {
          let out = "";
          for (let i = 0; i < event.results.length; i++) {
            out += event.results[i][0].transcript;
          }
          setTranscript(out.trim());
        };
        rec.onerror = () => {};
        recRef.current = rec;
        rec.start();
      } catch {
        /* STT 실패 — 녹음/수동 입력으로 계속 */
      }
    }
    // ② 서버 전사용 임시 녹음 — 전사 확인 중에만 같은 Blob을 로컬 재생에 쓴다.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        const audio = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        mediaRef.current = null;
        setRecorded(true);

        if (!audio.size) {
          setNotice("녹음된 음성이 없습니다 — 통역 내용을 직접 입력해 주세요.");
          return;
        }

        const localAudioUrl = URL.createObjectURL(audio);
        recordingAudioUrlRef.current = localAudioUrl;
        setRecordingAudioUrl(localAudioUrl);

        setTranscribing(true);
        const result = await requestSttTranscript(
          audio,
          sttLang.toLowerCase().startsWith("ko") ? "ko" : "zh",
        );
        setTranscribing(false);

        if (result.ok === true) {
          setTranscript(result.text);
          setConfirmed(false);
          setNotice(null);
        } else {
          setNotice(`${result.message} 브라우저 전사 초안을 확인하거나 직접 입력해 주세요.`);
        }
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      if (!sttSupported) {
        setNotice("브라우저 실시간 전사는 지원되지 않지만, 녹음을 마치면 서버에서 자동 전사합니다.");
      }
    } catch {
      // 마이크 거부/미지원 — 수동 전사 경로로 진행(구인 유지)
      setRecording(true);
      setNotice("마이크를 사용할 수 없습니다 — 통역한 내용을 아래에 직접 입력해 확인·제출할 수 있습니다.");
    }
  };

  const stopRec = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* 무시 */
    }
    try {
      if (mediaRef.current?.state === "recording") {
        mediaRef.current.stop();
      } else {
        setRecorded(true);
      }
    } catch {
      /* 무시 */
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
  };

  const canSubmit = !transcribing && confirmed && transcript.trim().length > 0;

  return (
    <div className="space-y-3" data-scene-skin="oral-console">
      <DctScenePanel mode="interpreting" situation={situation} relation={relation} />

      {/* 밝은 장비 프레임 안에서 실제 재생·녹음 조작부만 암실 모듈로 구분한다. */}
      <div className="overflow-hidden rounded-2xl border border-[#CBD4DC] bg-white shadow-[0_8px_22px_rgba(21,32,43,0.07)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#E1E6EA] bg-[#F7F9FA] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-[12px] font-bold text-[#40515F]">
            <Mic className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>통역 수행 콘솔</span>
          </div>
          <span className="shrink-0 text-[10.5px] text-[#7B8994]">듣기 → 녹음</span>
        </div>

        <div className="p-3.5">
          {/* ① 원문 듣기 */}
          <section aria-labelledby="interpreting-listen-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 id="interpreting-listen-heading" className="text-[12px] font-bold text-[#273642]">
                ① 원문 듣기 ({srcName})
              </h3>
              <span className="text-[10.5px] text-[#7B8994]">최대 {MAX_PLAYS}회</span>
            </div>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#263746] bg-[#101922] p-3 shadow-[0_5px_14px_rgba(16,25,34,0.12)]">
              <button
                type="button"
                onClick={play}
                disabled={plays >= MAX_PLAYS || playing || ttsLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#FAD338] bg-[#FAD338] text-[#15202B] shadow-sm transition-colors hover:bg-[#FFE06B] disabled:opacity-40"
                aria-label={playing || ttsLoading ? "원발화 재생 중" : "원발화 재생"}
              >
                <Volume2 className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
              <div>
                <div className="text-[13.5px] font-semibold text-white">
                  {ttsLoading ? "고품질 음성 준비 중…" : playing ? "재생 중…" : "원발화 재생"}
                </div>
                <div className="text-[11.5px] text-[#A5B5C1]">
                  남은 재생 {Math.max(0, MAX_PLAYS - plays)}회 · 재생 {plays}회
                </div>
              </div>
            </div>
          </section>

          {/* ② 통역 녹음 */}
          <section className="mt-3" aria-labelledby="interpreting-record-heading">
            <h3 id="interpreting-record-heading" className="text-[12px] font-bold text-[#273642]">
              ② 통역 녹음 ({tgtName})
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-[#263746] bg-[#101922] p-3 shadow-[0_5px_14px_rgba(16,25,34,0.12)]">
              <button
                type="button"
                onClick={recording ? stopRec : startRec}
                disabled={transcribing}
                className={[
                  "rounded-lg border px-4 py-2 text-[13px] font-bold transition-colors disabled:cursor-wait disabled:opacity-60",
                  recording
                    ? "border-[#B44647] bg-[#B44647] text-white"
                    : "border-[#C4494A] bg-transparent text-[#F0A3A4] hover:bg-[#C4494A] hover:text-white",
                ].join(" ")}
              >
                {recording ? "■ 녹음 정지" : transcribing ? "전사 중…" : recorded ? "● 다시 녹음" : "● 녹음 시작"}
              </button>
              <span className="text-[11.5px] text-[#A5B5C1]">
                {recording
                  ? "녹음 중…"
                  : transcribing
                    ? "고품질 자동 전사 중…"
                    : recorded
                      ? "전사 완료 · 아래에서 확인"
                      : "버튼을 누른 뒤 통역 시작"}
              </span>
            </div>
            <p className="mt-2.5 border-t border-[#E7EAED] pt-2.5 text-[10.5px] leading-relaxed text-[#7B8994]">
              마이크 음성은 자동 전사를 위해 OpenAI 음성 인식 API로 전송됩니다.
              PRAGMA는 음성 파일을 저장하지 않으며, 확인한 전사만 제출·저장합니다.
            </p>
          </section>

          {notice && (
            <div className="mt-3 rounded-lg border border-[#E1E6EA] bg-[#F7F9FA] px-3 py-2 text-[12px] leading-relaxed text-[#536572]">
              {notice}
            </div>
          )}
          </div>
      </div>

      {/* ③ 전사 확인 — 같은 모노크롬 페이퍼 톤의 편집 작업대 */}
      {(recorded || notice || transcribing) && (
        <div className="rounded-2xl border border-[#E1DED5] bg-[#F7F6F2] p-4 shadow-[0_7px_20px_rgba(21,32,43,0.04)]">
          <div className="flex items-start gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FAD338] text-[11px] font-extrabold text-[#15202B]">
              ③
            </span>
            <div className="pt-0.5 text-[13px] font-bold text-[#15202B]">내가 말한 내용 확인</div>
          </div>

          {recordingAudioUrl && (
            <div className="mt-3 rounded-lg border border-[#E2DED0] bg-white p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <div className="text-[12px] font-semibold text-[#273642]">내 음성 다시 듣기</div>
                <div className="text-[10.5px] text-[#7A858D]">전사 확인용 · 발음 점수와 무관</div>
              </div>
              <audio
                ref={recordingAudioRef}
                src={recordingAudioUrl}
                controls
                preload="metadata"
                onError={() => setNotice("내 녹음 재생에 실패했습니다. 전사를 직접 확인해 주세요.")}
                className="mt-2 h-9 w-full"
                aria-label="내가 녹음한 통역 음성"
              />
            </div>
          )}

          <label className="mt-3 block text-[11.5px] font-bold text-[#53616B]" htmlFor="interpreting-transcript">
            내가 말한 내용
          </label>
          <textarea
            id="interpreting-transcript"
            rows={2}
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setConfirmed(false);
            }}
            placeholder={`통역한 ${tgtName} 문장`}
            disabled={transcribing}
            className="mt-1.5 w-full rounded-xl border-2 border-[#15202B] bg-white p-3 text-[15.5px] font-medium leading-relaxed text-[#15202B] shadow-[4px_4px_0_rgba(21,32,43,0.1)] outline-none placeholder:text-[#8A8F94] focus:ring-2 focus:ring-[#FAD338]/55"
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => transcript.trim() && setConfirmed(true)}
              disabled={transcribing}
              className={[
                "rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                confirmed
                  ? "border-[#2E7D5B] bg-[#E7F5EC] text-[#256548]"
                  : "border-[#B8B3A2] bg-white text-[#3D4B55] hover:border-[#7E7762]",
              ].join(" ")}
            >
              {transcribing ? "전사 중…" : confirmed ? "✓ 확인 완료" : "말한 내용과 같아요"}
            </button>
            <span className="text-[11px] text-[#7A858D]">다른 부분이 있다면 문장을 먼저 고쳐 주세요.</span>
          </div>
        </div>
      )}

      <Button
        className="w-full bg-[#FAD338] text-[#15202B] hover:bg-[#F5C81F]"
        disabled={!canSubmit}
        onClick={() => onSubmit(transcript.trim())}
      >
        확인한 전사로 제출 →
      </Button>
      {IS_DEMO && (
        <button
          type="button"
          className={demoBtn}
          onClick={() => {
            setPlays(MAX_PLAYS);
            setRecorded(true);
            setRecording(false);
            setTranscript(demoText);
            setConfirmed(true);
          }}
        >
          데모 채우기 — 듣기·녹음·전사 자동
        </button>
      )}
    </div>
  );
}

// ── 1부 → 2부 인계: 네 판단을 짧게 정리한 뒤 새 장면에 적용한다. ─────────
function Handoff({
  mission,
  isInterp,
  responses,
  saved,
  onContinue,
  onSaveLater,
}: {
  mission: MissionRuntime;
  isInterp: boolean;
  responses: MpjResponseTrace[];
  saved: boolean;
  onContinue: () => void;
  onSaveLater: () => void;
}) {
  const summaryRows = buildMpjSummaryRows(mission, responses);
  return (
    <div className="rounded-xl border border-[#FAD338] bg-white p-4 sm:p-5">
      <div className="text-[11px] font-bold text-[#2E7D5B]">표현 감각 익히기 완료</div>
      <h2 className="mt-0.5 text-[16px] font-bold">방금 익힌 판단 흐름</h2>
      <ol className="mt-3 overflow-hidden rounded-xl border border-[#E5E0D2] bg-[#FCFBF7]">
        {summaryRows.map((row, index) => (
          <li
            key={`${row.label}-${index}`}
            className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-0.5 border-b border-[#ECE8DD] px-3 py-2.5 last:border-b-0 sm:grid-cols-[24px_170px_minmax(0,1fr)]"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FAD338] text-[10.5px] font-extrabold text-[#15202B]">
              {index + 1}
            </span>
            <span className="text-[12.5px] font-bold text-[#273642]">{row.label}</span>
            <span className="col-start-2 text-[12.5px] leading-snug text-[#5B6872] sm:col-start-3">
              {row.comment}
            </span>
          </li>
        ))}
      </ol>
      {saved ? (
        <div className="mt-3.5 rounded-lg bg-[#F2FAF6] px-3.5 py-2.5 text-[12.5px] text-[#2E7D5B]">
          저장했습니다 — 다음에 들어오면 2부부터 이어집니다.
          <button type="button" onClick={onContinue} className="ml-2 underline">지금 계속하기 →</button>
        </div>
      ) : (
        <div className="mt-3.5 flex gap-2.5">
          <Button className="flex-1 bg-[#FAD338] text-[#15202B] hover:bg-[#F0C800]" onClick={onContinue}>
            직접 {isInterp ? "통역" : "번역"}하러 가기 →
          </Button>
          <Button variant="outline" className="flex-1" onClick={onSaveLater}>저장하고 나중에</Button>
        </div>
      )}
      {/* 「1부 완료 ≠ 미션 완료」 경고는 걷어냈다 — 남은 분량을 강조해 피로만 키웠다.
          남은 단계는 위 진행 3단계가 이미 보여 준다. */}
    </div>
  );
}

// 학습자가 실제로 읽을 수 있도록 참고 판정의 지위와 확인 범위만 두 문장으로 남긴다.
// Scale4 일반 앵커 — 목표 축을 드러내지 않고 '얼마나 적절한가'의 기준만 준다.
// 축별 문구를 쓰면 첫 판단 전에 판정 방향이 새므로, 장면 무관 일반 서술로 고정한다.
const SCALE4_ANCHORS: { label: string; note: string }[] = [
  { label: "매우 적절", note: "이 장면에서 대표적으로 자연스러움" },
  { label: "다소 적절", note: "가능하지만 더 자연스러운 대안이 있음" },
  { label: "다소 부적절", note: "의도는 전달되지만 관계·부담 조절이 어색함" },
  { label: "매우 부적절", note: "관계·부담 또는 의도에 명백히 어긋남" },
];

function MissionBriefDrawer({
  mission,
  focusRevealed,
}: {
  mission: MissionRuntime;
  focusRevealed: boolean;
}) {
  return (
    <details className="rounded-xl border border-[#EAE4D2] bg-[#FAF7EE] px-4 py-2.5 text-[12.5px]">
      <summary className="cursor-pointer text-[#6B5518]">
        판정 기준 보기 · <b>정답은 하나가 아니에요</b>
      </summary>
      <div className="mt-2 space-y-2 text-muted-foreground">
        <p>현재 강의안과 AI 제안을 바탕으로 한 참고 판정입니다. 상황에 따라 다른 표현도 적절할 수 있어요.</p>
        <p>
          {/* 첫 판단 전에는 초점명(「완화와 선택권」 등)을 쓰지 않는다 — 그 자체가 판정 방향이다. */}
          뜻 전달 · 이해를 막는 문법 ·{" "}
          {focusRevealed ? `이 상황에 맞는 「${mission.unit.learner_label}」` : "이 상황에 맞는 표현"}을 봅니다.
          <b className="text-foreground"> 참고 표현은 제출 뒤에 공개됩니다.</b>
        </p>
        <ul className="space-y-0.5">
          {SCALE4_ANCHORS.map((a) => (
            <li key={a.label}>
              <b className="text-foreground">{a.label}</b> · {a.note}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

// ── 이견 채널(0-r·104 / 0-i·66) — 선택형 이견 기록 ────────────────────────
// 판정을 바꾸지 않는다. 목적 = ①공정성 통로 ②결함 문항 발견 ③채점키 캘리브레이션
// 보조 자료. 정규 MPJ 문항으로 만들지 않는다(구인 변경 금지) — 선택 입력이고,
// 이유 한 줄도 필수가 아니다(피로 원칙).
const DISSENT_CONDITIONS: { code: string; label: string }[] = [
  { code: "relationship", label: "관계·친밀도에 대한 다른 판단" },
  { code: "burden", label: "부탁의 부담 크기에 대한 다른 판단" },
  { code: "preceding", label: "앞선 대화 흐름을 더 고려함" },
  { code: "experience", label: "실제 사용 경험과 차이가 있음" },
];

function DissentPanel({ onSubmit }: { onSubmit: (d: { conditions: string[]; reason: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-lg bg-[#F2FAF6] px-3.5 py-2.5 text-[12.5px] text-[#2E7D5B]">
        ✓ 남겼습니다. 판정은 그대로지만, 이 기록은 문항을 다듬는 데 쓰입니다.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-[#B9C4CE] bg-white px-3.5 py-2.5 text-left text-[12.5px] text-[#3B4A57] hover:bg-[#F7F9FA]"
      >
        판정과 다르게 본 부분이 있다면 <b>의견 남기기 →</b>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[#B9C4CE] bg-white px-3.5 py-3">
      <div className="text-[12.5px] font-semibold">판정과 다르게 본 부분</div>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
        해당하는 항목만 선택합니다. 판정은 바뀌지 않으며, 담당 교수자가 문항을 다듬는 데 참고합니다.
      </p>
      <ul className="mt-2 space-y-1">
        {DISSENT_CONDITIONS.map((c) => {
          const on = picked.includes(c.code);
          return (
            <li key={c.code}>
              <button
                type="button"
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.code) : [...p, c.code]))}
                aria-pressed={on}
                className={[
                  "w-full rounded-md border px-3 py-1.5 text-left text-[12.5px]",
                  on ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#EAE4D2] bg-white text-[#3B4A57]",
                ].join(" ")}
              >
                {c.label}
              </button>
            </li>
          );
        })}
      </ul>
      <Textarea
        className="mt-2 text-[12.5px]"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="한 줄 이유 (선택)"
      />
      <div className="mt-2 flex gap-2">
        <Button
          className="flex-1"
          disabled={picked.length === 0 && !reason.trim()}
          onClick={() => {
            onSubmit({ conditions: picked, reason: reason.trim() });
            setSent(true);
          }}
        >
          남기기
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
          닫기
        </Button>
      </div>
    </div>
  );
}

// ── 수정 지도(0-i) — 최초↔최종 + 수정 성격. 클라이언트만(AI·DB 0회) ──
// 표기 자체는 학습 기록과 공유한다(components/mission/DiffLine).

function RevisionMap({
  first,
  final,
  featureLabel,
  interp,
  strategy,
  advice,
}: {
  first: string;
  final: string;
  featureLabel: string;
  interp: boolean;
  strategy: string;
  advice: string;
}) {
  const changed = responseWasRevised(first, final);
  const parts = useMemo(() => diffText(first, final), [first, final]);
  return (
    <article className="overflow-hidden rounded-2xl border border-[#D9D4C7] bg-white shadow-[0_10px_28px_rgba(21,32,43,0.08)]">
      <header className="bg-[#15202B] px-5 py-4 text-white">
        <div className="flex items-center gap-2 text-[11.5px] font-bold text-[#FAD338]">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          미션 완료
        </div>
        <h2 className="mt-1.5 text-[19px] font-extrabold tracking-[-0.02em]">
          내가 완성한 {interp ? "통역" : "번역"}
        </h2>
        <p className="mt-1 text-[12px] text-[#BAC5CD]">처음 만든 표현과 최종 선택을 한 장에 남겼습니다.</p>
      </header>

      <div className="space-y-3 p-4">
        <div className="rounded-xl bg-[#F5F5F2] px-3.5 py-3">
          <div className="text-[11.5px] font-bold text-[#66717A]">Take 1 · 최초 작성</div>
          <p className="mt-0.5 text-[10.5px] text-[#8A9197]">피드백을 보기 전 내가 만든 최초 산출</p>
          <DiffLine parts={parts} view="first" />
        </div>

        <div className="rounded-xl border-2 border-[#FAD338] bg-[#FFF8DE] px-3.5 py-3 shadow-[3px_3px_0_rgba(250,211,56,0.22)]">
          <div className="text-[11.5px] font-bold text-[#6B5518]">
            {changed ? "Take 2 · 피드백 후 수정" : "Take 2 · 최종 확정 — 변경 없음"}
          </div>
          <p className="mt-0.5 text-[10.5px] text-[#8A7345]">
            {changed ? "피드백을 반영해 내가 확정한 최종 산출" : "최초 산출을 그대로 최종안으로 선택"}
          </p>
          <DiffLine parts={parts} view="final" />
        </div>

        {changed && <DiffLegend />}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-[#E4E0D7] bg-[#FBFAF7] p-3">
            <div className="text-[10.5px] font-bold text-[#7A6A4C]">이번에 다듬은 초점</div>
            <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[#27323C]">{featureLabel}</p>
          </div>
          <div className="rounded-xl border border-[#E4E0D7] bg-[#FBFAF7] p-3">
            <div className="text-[10.5px] font-bold text-[#7A6A4C]">이번 수정 전략</div>
            <p className="mt-1 text-[12.5px] font-semibold leading-relaxed text-[#27323C]">{strategy}</p>
          </div>
        </div>

        <div className="rounded-xl bg-[#EEF3F6] px-3.5 py-3">
          <div className="text-[10.5px] font-bold text-[#557087]">다음에도 기억할 한 가지</div>
          <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#273642]">{advice}</p>
        </div>

        <p className="text-[11px] leading-relaxed text-[#7C858C]">
          {changed
            ? "표시는 텍스트의 추가·삭제만 보여 줍니다. 변화 자체가 더 알맞다는 점수는 아닙니다."
            : `이번에는 최초 ${interp ? "통역" : "번역"}을 그대로 최종안으로 확정했습니다.`}
        </p>
      </div>
    </article>
  );
}

const MPJ_TASK_TITLE: Record<string, string> = {
  scale4: "이 번역, 상황에 맞을까?",
  fix_choice: "어떻게 바꾸면 더 자연스러울까?",
  reason_conf: "이 표현이 상황에 맞지 않는 이유가 무엇인지 고르세요",
  reason: "이 표현이 상황에 맞지 않는 이유가 무엇인지 고르세요",
};

const JUDGE3_TASK_TITLE: Record<string, string> = {
  request_mitigation_optionality: "부탁이 너무 직접적이거나 우회적일까?",
  refusal_softening: "거절이 너무 단호하거나 장황할까?",
  gratitude_calibration: "고마움의 정도가 상황에 맞을까?",
  apology_accountability_repair: "사과가 책임과 해결을 충분히 담았을까?",
  proposal_optionality_clarity: "제안이 선택지를 남기고 방안을 분명히 했을까?",
  invitation_choice_commitment: "초대가 선택권과 약속을 분명히 했을까?",
  opposition_stance_mitigation: "이견이 너무 강하거나 흐리지 않을까?",
  compliment_grounding_sensitivity: "칭찬의 강도와 내용이 상황에 맞을까?",
  compliment_response_uptake: "칭찬에 대한 반응이 자연스러울까?",
  complaint_problem_accountability: "불만이 문제와 책임을 적절히 짚었을까?",
  politeness: "공손함의 정도가 상황에 맞을까?",
};

function mpjTaskTitle(
  item: MpjItemRuntime,
  featureCode: string,
  mode: MissionPresentationMode,
): string {
  const outputName = mode === "interpreting" ? "통역" : "번역";
  if (item.type === "judge3") {
    return JUDGE3_TASK_TITLE[featureCode] ?? "이 표현의 정도가 상황에 맞을까?";
  }
  if (item.type === "multi_judge") {
    return `${outputName}안 ${item.candidates.length}개, 각각 상황에 맞을까?`;
  }
  const title = MPJ_TASK_TITLE[item.type] ?? "이 표현을 어떻게 볼까?";
  return mode === "interpreting" ? title.replace("번역", "통역") : title;
}

function MpjContextSurface({
  item,
  answered,
  mode,
  collapsed = false,
}: {
  item: MpjItemRuntime;
  answered: boolean;
  mode: MissionPresentationMode;
  /** 다음 과업으로 넘어간 뒤 — 끝난 장면·대화는 접어 한 번에 한 판단만 남긴다. */
  collapsed?: boolean;
}) {
  const hasTarget = item.type !== "multi_judge";
  const channel = mpjPresentationChannel(mode, item.channel);
  // 문항이 바뀌면 key로 다시 마운트되므로 새 장면은 항상 전체 메신저로 시작한다.
  const [sceneExpanded, setSceneExpanded] = useState(false);
  // relation_ko = "거래처 일정 담당자 · 몇 차례 연락한 사이" 형태다. 상대와 관계를 갈라
  // 쓰되, 화살표 legacy 형식이면 기존 헬퍼가 상대만 뽑아 주므로 그 결과를 쓴다.
  const relationParts = item.relation_ko.split("·").map((x) => x.trim()).filter(Boolean);
  const counterpartLabel =
    relationParts.length > 1 ? relationParts[0] : learnerCounterpartLabel(item.relation_ko);
  const relationTail = relationParts.length > 1 ? relationParts.slice(1).join(" · ") : "";

  // 접어도 **메신저 장면 그대로** 남긴다. PRAGMA의 학습 경험은 대화 장면 안에서
  // 화용 판단을 하는 것이라, 평문 목록으로 납작하게 만들면 은유가 깨진다.
  // 줄이는 것은 반복 설명(상황문·캡션)이지 말풍선이 아니다.
  if (collapsed && !sceneExpanded) {
    return (
      <div
        className="rounded-2xl border border-[#E3E1D8] bg-[#F2F1ED] px-3.5 py-3"
        data-mpj-skin={channel}
        data-scene-compact="true"
      >
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
          <span>
            상대 · <span className="text-foreground">{counterpartLabel}</span>
          </span>
          {relationTail && (
            <span>
              관계 · <span className="text-foreground">{relationTail}</span>
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {item.preceding_turn && <ChatBubble side="them">{item.preceding_turn}</ChatBubble>}
          {hasTarget && (
            <ChatBubble side="me" variant="draft">
              {answered ? highlightZh(item.target, item.highlights) : item.target}
            </ChatBubble>
          )}
          {!hasTarget && <ChatCaption placement="below">내가 전할 말: {item.source}</ChatCaption>}
        </div>
        {/* 조작은 하나만 — chevron과 '장면 다시 보기'를 겹쳐 두지 않는다. */}
        <button
          type="button"
          onClick={() => setSceneExpanded(true)}
          className="mt-2 text-[11.5px] font-semibold text-[#3E4C57] underline underline-offset-2"
        >
          전체 대화 보기
        </button>
      </div>
    );
  }

  return (
    <div data-mpj-skin={channel}>
      <ChatScene
        situation={item.situation_ko}
        relation={item.relation_ko}
        separatePanels
        threadEyebrow="표현 비교"
      >
        {item.preceding_turn && <ChatBubble side="them">{item.preceding_turn}</ChatBubble>}
        {item.type === "multi_judge" ? (
          <ChatCaption placement="below">내가 전할 말: {item.source}</ChatCaption>
        ) : (
          <>
            <ChatCaption tone="draft">
              AI {mode === "interpreting" ? "통역" : "번역"} 초안
            </ChatCaption>
            <ChatBubble side="me" variant="draft">
              {answered ? highlightZh(item.target, item.highlights) : item.target}
            </ChatBubble>
            <ChatCaption placement="below">내가 전할 말: {item.source}</ChatCaption>
          </>
        )}
      </ChatScene>
      {collapsed && (
        <button
          type="button"
          onClick={() => setSceneExpanded(false)}
          className="mt-1.5 text-[11.5px] font-semibold text-[#3E4C57] underline underline-offset-2"
        >
          간단히 보기
        </button>
      )}
    </div>
  );
}

// ── MPJ 한 문항 ─────────────────────────────────────────────────────────
export function MpjStage({
  item,
  mode,
  sequentialFix,
  isLastItem,
  stickyContentTop,
  onDone,
  onFirstAnswer,
}: {
  item: MpjItemRuntime;
  mode: MissionPresentationMode;
  sequentialFix: boolean;
  /** 마지막 문항이면 CTA를 다음 단계로 바꾼다. */
  isLastItem: boolean;
  /** 사이트 헤더와 현재(전체/축약) 진행바를 합친 실제 고정 높이. */
  stickyContentTop: number;
  onDone: (response: MpjResponseTrace) => void;
  /** 첫 판단이 제출된 시점 — 목표 화용 축은 이 시점 이후에만 공개된다. */
  onFirstAnswer?: () => void;
}) {
  const [answered, setAnswered] = useState(false);
  // 판정 공개는 반드시 이 함수를 거친다. setAnswered를 직접 부르면 초점 공개 시점이
  // 어긋나 첫 판단 전에 정답 방향이 새어 나간다.
  const reveal = () => {
    setAnswered(true);
    onFirstAnswer?.();
  };
  const [fixJudgeSubmitted, setFixJudgeSubmitted] = useState(false);
  const [reasonJudgeSubmitted, setReasonJudgeSubmitted] = useState(false);
  const [scalePick, setScalePick] = useState<string | null>(null);
  const [bandPick, setBandPick] = useState<string | null>(null);
  const [reasonPicks, setReasonPicks] = useState<Set<string>>(new Set());
  const [reasonPick, setReasonPick] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [fixPicks, setFixPicks] = useState<Set<number>>(new Set());
  const [multiBestPick, setMultiBestPick] = useState<number | null>(null);
  const [multiWorstPick, setMultiWorstPick] = useState<number | null>(null);
  const fixChoicesRef = useRef<HTMLDivElement>(null);
  const reasonChoicesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fixJudgeSubmitted) return;
    const frame = window.requestAnimationFrame(() => {
      fixChoicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fixJudgeSubmitted]);

  useEffect(() => {
    if (!reasonJudgeSubmitted) return;
    const frame = window.requestAnimationFrame(() => {
      reasonChoicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reasonJudgeSubmitted]);

  // 대화창 끝 지점이 헤더 위로 올라갔는지 — 올라갔을 때만 맥락 바를 띄운다.
  // IntersectionObserver 대신 스크롤 리스너를 쓴다: 같은 값이면 React가 리렌더를
  // 건너뛰므로 비용이 사실상 없고, 렌더 루프에 의존하지 않아 동작 확인이 쉽다.
  const sceneEndRef = useRef<HTMLDivElement>(null);
  const [showCtxBar, setShowCtxBar] = useState(false);
  useEffect(() => {
    const update = () => {
      const el = sceneEndRef.current;
      if (el) setShowCtxBar(el.getBoundingClientRect().top < stickyContentTop);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [stickyContentTop]);

  const feature = item.axis_feature;
  const bands =
    item.type === "multi_judge"
      ? bandOptions(feature, item.candidates.flatMap((c) => c.accepted_band_codes))
      : bandOptions(
          feature,
          item.type === "judge3" || item.type === "fix_choice" || item.type === "reason_conf"
            ? item.accepted_band_codes
            : item.type === "reason"
              ? [item.problem_band_code]
              : [],
        );

  const canReveal = (() => {
    switch (item.type) {
      case "scale4":
        return !!scalePick;
      case "judge3":
        return !!bandPick;
      case "fix_choice":
        return !!bandPick && fixPicks.size > 0;
      case "reason_conf":
        return !!bandPick && reasonPicks.size > 0 && !!confidence;
      case "reason":
        return reasonJudgeSubmitted && !!reasonPick;
      case "multi_judge":
        return (
          multiBestPick !== null &&
          multiWorstPick !== null &&
          multiBestPick !== multiWorstPick
        );
      default:
        return false;
    }
  })();

  const toggleReason = (id: string) =>
    setReasonPicks((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // 데모 채우기(프로토타입 v2) — 이 문항의 기준 정답으로 자동 응답 후 판정 공개.
  const demoFill = () => {
    switch (item.type) {
      case "scale4":
        setScalePick(item.accepted_scale_codes[0]);
        break;
      case "judge3":
        setBandPick(item.accepted_band_codes[0]);
        break;
      case "fix_choice":
        setBandPick(item.accepted_band_codes[0]);
        setFixJudgeSubmitted(true);
        setFixPicks(new Set(item.corrections.map((c, i) => (c.is_valid ? i : -1)).filter((i) => i >= 0)));
        break;
      case "reason_conf":
        setBandPick(item.accepted_band_codes[0]);
        setReasonPicks(new Set(item.accepted_reason_ids));
        setConfidence("꽤 확신");
        break;
      case "reason":
        setBandPick(item.problem_band_code);
        setReasonJudgeSubmitted(true);
        setReasonPick(item.accepted_reason_id);
        break;
      case "multi_judge":
        {
          const withinBand = getTargetFeature(feature)?.within_band_code;
          const bestIndex = item.candidates.findIndex((candidate) =>
            withinBand ? candidate.accepted_band_codes.includes(withinBand) : false,
          );
          const selectedBest = bestIndex >= 0 ? bestIndex : 0;
          const worstIndex = item.candidates.findIndex((candidate, index) =>
            index !== selectedBest &&
            (withinBand ? !candidate.accepted_band_codes.includes(withinBand) : true),
          );
          setMultiBestPick(selectedBest);
          setMultiWorstPick(worstIndex >= 0 ? worstIndex : selectedBest === 0 ? 1 : 0);
        }
        break;
    }
    reveal();
  };

  const responseTrace = (): MpjResponseTrace => {
    const base = {
      item_id: item.id,
      item_type: item.type,
      completed_at: new Date().toISOString(),
    };
    switch (item.type) {
      case "scale4":
        return { ...base, ...(scalePick ? { scale_code: scalePick } : {}) };
      case "judge3":
        return { ...base, ...(bandPick ? { band_code: bandPick } : {}) };
      case "fix_choice":
        return {
          ...base,
          ...(bandPick ? { band_code: bandPick } : {}),
          correction_indexes: [...fixPicks].sort((a, b) => a - b),
        };
      case "reason_conf":
        return {
          ...base,
          ...(bandPick ? { band_code: bandPick } : {}),
          reason_ids: [...reasonPicks],
          ...(confidence ? { confidence } : {}),
        };
      case "reason":
        return {
          ...base,
          ...(bandPick ? { band_code: bandPick } : {}),
          ...(reasonPick ? { reason_id: reasonPick } : {}),
          ...(reasonPick
            ? { reason_kind: item.reasons.find((reason) => reason.id === reasonPick)?.kind }
            : {}),
        };
      case "multi_judge":
        return {
          ...base,
          ...(multiBestPick !== null ? { best_candidate_index: multiBestPick } : {}),
          ...(multiWorstPick !== null ? { worst_candidate_index: multiWorstPick } : {}),
        };
    }
  };
  const scaleDirectionMatched =
    item.type === "scale4" &&
    !!scalePick &&
    item.accepted_scale_codes.includes(scalePick as Scale4Code);

  // relation_ko는 "거래처 일정 담당자 · 몇 차례 연락한 사이"처럼 상대와 관계가 붙어 있다.
  // 앞부분(상대)은 이미 따로 쓰므로 뒷부분만 관계로 떼어 쓴다.
  const relationContextLabel = item.relation_ko.split("·").slice(1).join("·").trim();

  // 답변 후에만 쓰는 "이번 선택에서 사용한 조절 방식" 한 줄.
  // 기존 판정 근거(note_ko)에서만 도출한다 — 새 필드·분류체계를 만들지 않고,
  // 학습자가 실제로 고른 안에 구현된 전략만 말한다(성향 단정 금지).
  const answeredStrategyLine = (() => {
    if (!answered) return "";
    const clean = (s: string) => s.replace(/[.。]\s*$/, "").trim();
    if (item.type === "fix_choice") {
      return [...fixPicks]
        .map((i) => item.corrections[i])
        .filter((c) => c?.is_valid)
        .map((c) => clean(c.note_ko))
        .join(" · ");
    }
    if (item.type === "multi_judge" && multiBestPick !== null) {
      const best = item.candidates[multiBestPick];
      const within = getTargetFeature(feature)?.within_band_code;
      if (best && within && best.accepted_band_codes.includes(within)) return clean(best.note_ko);
    }
    return "";
  })();

  return (
    <div className="space-y-3">
      {/* 한 번에 한 판단만 — 다음 과업(수정안 고르기·피드백 읽기)으로 넘어가면
          끝난 장면·대화를 요약으로 접는다. 세로 누적을 줄이는 것이 목적이고,
          접힌 요약을 펼치면 원래 장면을 그대로 다시 볼 수 있다. */}
      <MpjContextSurface
        item={item}
        answered={answered}
        mode={mode}
        collapsed={answered || (item.type === "fix_choice" && sequentialFix && fixJudgeSubmitted)}
      />

      {/* 문항 맥락 고정 바 — 긴 문항(특히 multi_judge 후보 비교)에서
          스크롤하면 상대·원문이 화면 밖으로 나가 "무엇을 옮기는 중이었지"를 잊는다.
          ⚠️ sticky가 아니라 **대화창이 화면에서 사라졌을 때만** 뜨는 fixed 바다.
             sticky면 대화창 바로 아래에서 같은 내용을 반복해 자리만 먹는다.
          ⚠️ 관계는 화용 판단의 축이라 좁은 화면에서도 숨기지 않고 2줄로 접는다.
          ⚠️ multi_judge에도 대화창에서 원문을 먼저 보여 주며, 긴 후보 목록을 읽는 동안에는
             이 바가 같은 맥락을 유지한다. 후보(판단 대상)가 아니라 무엇을 옮기는 요청인지이므로
             정답 노출이 아니다. */}
      <div ref={sceneEndRef} aria-hidden className="h-px" />
      {showCtxBar && (
        <div
          className="fixed inset-x-0 z-30 border-b border-[#EAE4D2] bg-white/95 backdrop-blur"
          style={{ top: `${stickyContentTop}px` }}
        >
          <div className="mx-auto flex max-w-3xl flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-6 py-1.5 text-[12px]">
            {/* 객관적 맥락만 — 판정 방향(완화·직접성·거절 여지)은 넣지 않는다. */}
            <span className="text-muted-foreground">
              상대 · <span className="text-foreground">{learnerCounterpartLabel(item.relation_ko)}</span>
            </span>
            {relationContextLabel && (
              <>
                <span className="hidden text-[#E3E1D8] md:inline">|</span>
                <span className="text-muted-foreground">
                  관계 · <span className="text-foreground">{relationContextLabel}</span>
                </span>
              </>
            )}
            <span className="hidden text-[#E3E1D8] md:inline">|</span>
            <span className="text-muted-foreground">
              전하려는 뜻 · <span className="text-foreground">{item.source}</span>
            </span>
          </div>
        </div>
      )}

      {/* 단일 발화 문항 — 위 맥락의 AI 초안에 대한 판단·교정·근거화 */}
      {item.type !== "multi_judge" && (
        <div className="rounded-xl border border-[#EAE4D2] border-t-[3px] border-t-[#15202B] bg-white px-4 pb-4 pt-3">
          {/* scale4 */}
          {item.type === "scale4" && (
            <>
              <div className="text-[13px] font-semibold">
                이 {mode === "interpreting" ? "통역안" : "번역안"}은 이 상황에 얼마나 적절한가요?
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {SCALE4_CODES.map((code) => (
                  <Choice key={code} label={SCALE4_LABELS[code as Scale4Code]} selected={scalePick === code} disabled={answered} onClick={() => setScalePick(code)} />
                ))}
              </div>
            </>
          )}

          {/* 현행 reason은 최초 대역 판단을 잠근 뒤 이유 3개를 공개한다. */}
          {(item.type === "judge3" || item.type === "fix_choice" || item.type === "reason_conf" || item.type === "reason") && (
            <>
              <div className="text-[13px] font-semibold">이 표현의 조절 정도는 어떤가요?</div>
              <div className="mt-2 flex flex-col gap-1.5">
                {bands.map((b) => (
                  <Choice
                    key={b.code}
                    label={learnerBandLabel(feature, b.code, b.label)}
                    selected={bandPick === b.code}
                    disabled={
                      answered ||
                      (item.type === "fix_choice" && sequentialFix && fixJudgeSubmitted) ||
                      (item.type === "reason" && reasonJudgeSubmitted)
                    }
                    onClick={() => setBandPick(b.code)}
                  />
                ))}
              </div>
            </>
          )}

          {/* fix_choice: 교정 복수 선택 */}
          {item.type === "fix_choice" && (!sequentialFix || fixJudgeSubmitted) && (
            <div
              ref={fixChoicesRef}
              style={{ scrollMarginTop: `${stickyContentTop + SCROLL_TARGET_GAP}px` }}
            >
              <div className="mt-4 border-t border-[#EAE4D2] pt-4 text-[13px] font-semibold">
                이 상황에 알맞은 수정안을 모두 선택하세요.{" "}
                <span className="font-normal text-muted-foreground">
                  · 여러 개를 선택할 수 있습니다
                  {fixPicks.size > 0 && ` · ${fixPicks.size}개 선택됨`}
                </span>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {item.corrections.map((o, i) => (
                  <button
                    key={o.text}
                    type="button"
                    disabled={answered}
                    onClick={() =>
                      setFixPicks((prev) => {
                        const n = new Set(prev);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                    className={[
                      "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px]",
                      fixPicks.has(i) ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7]" : "border-[#EAE4D2] bg-white",
                      answered && o.is_valid ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                    ].join(" ")}
                  >
                    <div className="text-[15px] font-medium leading-relaxed">{o.text}</div>
                    {answered && <div className="mt-1 text-[12px] text-muted-foreground">{o.note_ko}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* v4/v5 reason: 최초 판단을 확정한 뒤 가장 큰 이유 하나만 고른다. */}
          {item.type === "reason" && reasonJudgeSubmitted && (
            <div
              ref={reasonChoicesRef}
              role="radiogroup"
              aria-label="왜 그렇게 판단했나요? 가장 큰 이유 하나를 골라보세요."
              className="mt-4 flex flex-col gap-1.5 border-t border-[#EAE4D2] pt-4"
              style={{ scrollMarginTop: `${stickyContentTop + SCROLL_TARGET_GAP}px` }}
            >
              <div className="mb-1 text-[13px] font-semibold">왜 그렇게 판단했나요? 가장 큰 이유 하나를 골라보세요.</div>
                {item.reasons.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={reasonPick === r.id}
                    disabled={answered}
                    onClick={() => setReasonPick(r.id)}
                    className={[
                      "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px]",
                      reasonPick === r.id ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7]" : "border-[#EAE4D2] bg-white",
                      answered && item.accepted_reason_id === r.id ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                    ].join(" ")}
                  >
                    {r.text_ko}
                  </button>
                ))}
            </div>
          )}

          {/* reason_conf: 이유 + 확신도 */}
          {item.type === "reason_conf" && bandPick && (
            <>
              <div className="mt-4 text-[13px] font-semibold">판단 근거 선택 <span className="font-normal">· 맞는 것을 모두 선택</span></div>
              <div className="mt-2 flex flex-col gap-1.5">
                {item.reasons.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={answered}
                    onClick={() => toggleReason(r.id)}
                    className={[
                      "rounded-[10px] border px-3.5 py-2.5 text-left text-[14px]",
                      reasonPicks.has(r.id) ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7]" : "border-[#EAE4D2] bg-white",
                      answered && item.accepted_reason_ids.includes(r.id) ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                    ].join(" ")}
                  >
                    {r.text_ko}
                  </button>
                ))}
              </div>
              <div className="mt-4 text-[13px] font-semibold">판단 확신도</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CONFIDENCE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={answered}
                    onClick={() => setConfidence(c)}
                    className={["rounded-md border px-3 py-1.5 text-[12.5px]", confidence === c ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold" : "border-[#EAE4D2] bg-white"].join(" ")}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 정보 위계: "상대에게 어떻게 들릴 수 있는가"(explanation_ko — 상황 결부형 어조 해설)를
              먼저 보이고, "기준 판정" 라벨은 그 아래 보조 표기로 내린다. explanation_ko 재배치만
              — 새 필드·판정 로직·저장 로그는 그대로다. */}
          {answered && (
            <div
              className={[
                "mt-4 rounded-lg px-3.5 py-3",
                item.type === "scale4" && !scaleDirectionMatched
                  ? "bg-[#FFF8DE]"
                  : "bg-[#F2FAF6]",
              ].join(" ")}
            >
              <p className="text-[13px] leading-relaxed">{item.explanation_ko}</p>
              {item.type === "scale4" ? (
                <div className="mt-2 space-y-1 text-[11.5px]">
                  {/* 내부 판정 언어(참고 판정·참고 정도)를 학습자용 이유로 바꾼다.
                      맞았다/틀렸다가 아니라, 이 관계·부담에서 왜 그렇게 읽히는지를 말한다. */}
                  <div className={scaleDirectionMatched ? "text-[#2E7D5B]" : "text-[#7A5C12]"}>
                    {scaleDirectionMatched
                      ? "이 장면을 읽은 방향이 참고 해설과 같습니다."
                      : "참고 해설은 다르게 봅니다. 위 설명에서 관계와 부담을 다시 견주어 보세요."}
                  </div>
                  {scalePick && "reference_scale_code" in item && scalePick !== item.reference_scale_code && (
                    <div className="text-[#496B5B]">
                      ‘매우/다소’의 차이는 오답이 아니며 수업에서 비교할 수 있습니다.
                    </div>
                  )}
                </div>
              ) : item.type === "reason" ? (
                <div className="mt-2 text-[11.5px] font-semibold text-[#2E7D5B]">
                  {`핵심 원인 · ${item.reasons.find((r) => r.id === item.accepted_reason_id)?.text_ko ?? ""}`}
                </div>
              ) : null}
              {/* 이번 선택에서 실제로 쓰인 조절 방식만 적는다. 한 문항으로 학습자의
                  성향을 단정하지 않고, 특정 표현을 모든 상황의 정답으로 가르치지 않는다. */}
              {answeredStrategyLine && (
                <div className="mt-2 border-t border-black/5 pt-2 text-[11.5px] text-[#3E4C57]">
                  <span className="font-semibold">이번 선택에서 사용한 조절 방식</span> ·{" "}
                  {answeredStrategyLine}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* multi_judge: 한 상황 다중 발화 */}
      {item.type === "multi_judge" && (
        <div className="rounded-xl border border-[#EAE4D2] border-t-[3px] border-t-[#15202B] bg-white px-4 pb-4 pt-3">
          <div className="text-[13px] font-semibold">
            AI가 만든 {mode === "interpreting" ? "통역" : "번역"} 초안 5개 비교하기
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">BEST 1, WORST 1을 각각 고르세요.</p>
          <ul className="mt-3 space-y-2.5">
            {item.candidates.map((c, i) => (
              <li
                key={c.text}
                className={[
                  "flex items-start gap-3 rounded-lg border px-3.5 py-3",
                  multiBestPick === i ? "border-[#2E7D5B] bg-[#F2FAF6]" : "",
                  multiWorstPick === i ? "border-[#C94B3B] bg-[#FFF1EE]" : "",
                  multiBestPick !== i && multiWorstPick !== i ? "border-[#EAE4D2]" : "",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium leading-relaxed">{c.text}</div>
                  {answered && (
                    <div className="mt-1.5 text-[12.5px] text-muted-foreground">
                      참고 판정 ·{" "}
                      {c.accepted_band_codes
                        .map((code) => learnerBandLabel(feature, code, bandLabel(feature, code)))
                        .join(" / ")}
                      {" · "}
                      {c.note_ko}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={answered || multiWorstPick === i}
                    aria-pressed={multiBestPick === i}
                    onClick={() => setMultiBestPick((picked) => (picked === i ? null : i))}
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors",
                      multiBestPick === i
                        ? "border-[#2E7D5B] bg-[#2E7D5B] text-white"
                        : "border-[#B9D8C8] bg-white text-[#2E7D5B]",
                      multiWorstPick === i ? "cursor-not-allowed opacity-35" : "",
                    ].join(" ")}
                  >
                    BEST
                  </button>
                  <button
                    type="button"
                    disabled={answered || multiBestPick === i}
                    aria-pressed={multiWorstPick === i}
                    onClick={() => setMultiWorstPick((picked) => (picked === i ? null : i))}
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors",
                      multiWorstPick === i
                        ? "border-[#C94B3B] bg-[#C94B3B] text-white"
                        : "border-[#E1B8B1] bg-white text-[#A33E31]",
                      multiBestPick === i ? "cursor-not-allowed opacity-35" : "",
                    ].join(" ")}
                  >
                    WORST
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {answered && (
            <div className="mt-3 rounded-lg bg-[#F2FAF6] px-3.5 py-3">
              <p className="text-[13px] leading-relaxed">{item.explanation_ko}</p>
            </div>
          )}
        </div>
      )}

      {!answered ? (
        <>
          {item.type === "fix_choice" && sequentialFix && !fixJudgeSubmitted ? (
            <Button
              className="w-full"
              disabled={!bandPick}
              onClick={() => {
                setFixJudgeSubmitted(true);
              }}
            >
              판단 제출 · 이어서 고쳐보기 →
            </Button>
          ) : item.type === "reason" && !reasonJudgeSubmitted ? (
            <Button
              className="w-full"
              disabled={!bandPick}
              onClick={() => setReasonJudgeSubmitted(true)}
            >
              이 판단으로 정하기
            </Button>
          ) : (
            <Button className="w-full" disabled={!canReveal} onClick={reveal}>
              {item.type === "reason" ? "이유 확인하기" : "확인하기"}
            </Button>
          )}
          {IS_DEMO && (
            <button type="button" className={demoBtn} onClick={demoFill}>데모 채우기 — 이 문항 자동 응답</button>
          )}
        </>
      ) : (
        <Button className="w-full" onClick={() => onDone(responseTrace())}>{isLastItem ? "정리 화면으로 →" : "다음 예시로 →"}</Button>
      )}
    </div>
  );
}

// 선택 상태를 색·테두리로만 표시하면 색을 못 보는 환경에서 구별되지 않는다.
// 제출 전은 `선택됨`, 제출 후(disabled)는 `내 선택`으로 글자를 함께 붙인다.
const Choice = ({ label, selected, disabled, onClick }: { label: string; selected: boolean; disabled: boolean; onClick: () => void }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    aria-pressed={selected}
    className={[
      "flex items-start justify-between gap-2 rounded-[10px] border px-3.5 py-2.5 text-left text-[14px] transition-colors",
      selected ? "border-[1.5px] border-[#15202B] bg-[#FAFAF7] font-semibold" : "border-[#EAE4D2] bg-white hover:bg-[#FAFAF7]",
    ].join(" ")}
  >
    <span>{label}</span>
    {selected && (
      <span className="mt-0.5 shrink-0 rounded-full border border-[#15202B] px-1.5 py-0.5 text-[10.5px] font-semibold">
        {disabled ? "내 선택" : "선택됨"}
      </span>
    )}
  </button>
);

export default LegacyMissionRun;
