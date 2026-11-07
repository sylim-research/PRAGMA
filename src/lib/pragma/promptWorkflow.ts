// 관리자 「운영 프롬프트」 화면의 제작 흐름 지도(2026-11-07).
// 프롬프트 원문은 promptSnapshot.generated.ts(코드에서 자동 추출)가 정본이다. 이 파일은 그 원문이
// 「어느 단계에서, 몇 번째로, 어떤 조건에서, 어떤 모델로」 도는지만 적는다.
// 모델 이름은 edge 라우팅 상수에서 직접 읽어 화면이 라우팅과 어긋나지 않게 한다.
// 흐름이 바뀌면(generate-scenario의 action 순서·조건) 이 파일도 함께 고친다 — promptWorkflow.test.ts가
// 화면에 보이는 프롬프트가 흐름에서 빠지거나 없는 키를 가리키면 실패한다.
import {
  GEMINI_PRIMARY_MODEL,
  OPENAI_MODEL_ROUTES,
  REVIEW_PRIMARY_MODEL,
} from "../../../supabase/functions/_shared/openaiRequestContract";

export type WorkflowDirection = "ko_zh" | "zh_ko";
export type WorkflowMode = "translation" | "interpreting";
export type StepKind = "always" | "conditional" | "optional" | "code" | "human";

export interface WorkflowStep {
  id: string;
  title: string;
  does: string;
  kind: StepKind;
  when: string;
  /** 방향별 모델. 없으면 AI를 부르지 않는 단계다. */
  model?: (dir: WorkflowDirection) => string;
  fallback?: string;
  stop?: string;
  prompts: (dir: WorkflowDirection, mode: WorkflowMode) => string[];
  /** 같은 프롬프트를 다시 쓰는 단계의 안내(예: 같은 지시문 + 재요청 메모). */
  reuseNote?: string;
}

export interface WorkflowStage {
  id: string;
  title: string;
  screen: string;
  route?: string;
  steps: WorkflowStep[];
  result: string;
}

const MODEL_LABEL: Record<string, string> = {
  [GEMINI_PRIMARY_MODEL]: "Gemini 3.1 Pro",
  [REVIEW_PRIMARY_MODEL]: "GPT-6 Astra",
  "gpt-5.5": "GPT-5.5",
};
export const modelLabel = (id: string | null | undefined) => (id ? MODEL_LABEL[id] ?? id : "");

const R = OPENAI_MODEL_ROUTES;
const byDir = (koZh: string, zhKo: string) => (dir: WorkflowDirection) => modelLabel(dir === "ko_zh" ? koZh : zhKo);
const fixed = (id: string) => () => modelLabel(id);
const dirKey = (base: string, dir: WorkflowDirection) => (dir === "zh_ko" ? `${base}.zh_ko` : base);
const spokenKey = (base: string, mode: WorkflowMode) => (mode === "interpreting" ? `${base}.spoken` : base);

export const PROMPT_WORKFLOW: WorkflowStage[] = [
  {
    id: "scenario",
    title: "시나리오와 원문",
    screen: "시나리오 생성",
    route: "/admin/generator",
    result: "시나리오 초안으로 저장",
    steps: [
      {
        id: "outline", title: "개요 제안", kind: "optional", when: "「개요 먼저」를 누를 때",
        does: "상황 후보 여러 개를 한 번에 제안합니다. 고른 개요가 다음 단계의 장면 씨앗이 됩니다.",
        model: fixed(R.default.primary),
        prompts: (dir) => [dir === "ko_zh" ? "core.outline.system" : "legacy.outline.system.zh_ko"],
      },
      {
        id: "preflight", title: "장면 사전 검토", kind: "always", when: "원문을 쓰기 전 매번",
        does: "관계 조건(P·D·R)이 그 장면에서 성립하는지 확인하고 장면을 구체화합니다.",
        model: fixed(R.critic.primary),
        stop: "성립하지 않으면 보류하고 원문을 쓰지 않습니다.",
        prompts: () => ["core.scene_preflight.system"],
      },
      {
        id: "core", title: "상황·원문 작성", kind: "always", when: "사전 검토를 통과하면",
        does: "학습자가 읽을 상황·관계와 원문을 씁니다. 문항은 아직 만들지 않습니다.",
        model: byDir(R.default.primary, REVIEW_PRIMARY_MODEL),
        prompts: (dir, mode) => [
          `core.system.${dir}`,
          mode === "interpreting"
            ? (dir === "ko_zh" ? "core.user.spoken" : "core.user.spoken.zh_ko")
            : (dir === "ko_zh" ? "core.user.written" : "core.user.written.zh_ko"),
        ],
      },
      {
        id: "core_repair", title: "보정 1회", kind: "conditional", when: "분량·통역 역할·답 방향 단서 규칙을 어길 때",
        does: "내용은 두고 걸린 곳만 고칩니다.",
        model: fixed(R.critic.primary),
        prompts: (_dir, mode) => [
          "core.user.source_repair",
          ...(mode === "interpreting" ? ["core.user.bilingual_scene_repair"] : []),
          "core.user.learner_scene_repair",
        ],
      },
      {
        id: "core_gate", title: "저장 전 의미 검토", kind: "always", when: "저장하기 직전",
        does: "화행·관계·분야·역할이 요청대로인지 확인합니다. 원문을 쓴 모델이 아닌 다른 AI가 맡습니다.",
        model: byDir(R.critic.primary, GEMINI_PRIMARY_MODEL),
        stop: "통과하지 못하면 경고와 함께 남겨 교수자가 확인합니다.",
        prompts: (dir) => [dirKey("core_quality.system", dir)],
      },
    ],
  },
  {
    id: "mission",
    title: "학습 미션 MJT1~5 + DCT",
    screen: "학습 미션 조립 → v6 초안 만들기",
    route: "/admin/assembly",
    result: "검수 대기로 저장 (DCT 원문은 ①의 원문을 그대로 씀)",
    steps: [
      {
        id: "mission_generate", title: "미션 전체 작성", kind: "always", when: "「v6 초안 만들기」를 누를 때",
        does: "MJT 5문항, 문항별 해설·참고 표현·교정 선택지, DCT 안내·참고 표현·어휘 힌트를 한 번에 씁니다.",
        model: fixed(R.mission_v6.primary),
        prompts: (dir, mode) => [spokenKey(dirKey("mission_v6.system", dir), mode), "mission_v6.user"],
      },
      {
        id: "mission_rules", title: "규칙 검사", kind: "code", when: "작성 직후 매번",
        does: "형식·문항 수·언어 방향·원문 계승을 코드가 셉니다. AI를 부르지 않습니다.",
        prompts: () => [],
      },
      {
        id: "mission_repair", title: "수리 1회", kind: "conditional", when: "규칙 검사에서 실패할 때",
        does: "걸린 곳만 고쳐 다시 내게 합니다. 지시문은 「미션 전체 작성」과 같고 수리 요청만 붙습니다.",
        model: fixed(R.mission_v6.primary),
        stop: "수리 후에도 실패하면 저장하지 않습니다.",
        prompts: () => ["mission_v6.repair.user"],
      },
      {
        id: "mission_quality", title: "AI 점검", kind: "always", when: "규칙 검사를 통과하면",
        does: "원문 의미·화행 목적 보존과 문항·해설 정합을 검토합니다.",
        model: fixed(R.critic.primary),
        stop: "점검을 못 끝내면 「교수자 확인 필요」로 표시해 저장합니다.",
        prompts: (dir, mode) => [spokenKey(dirKey("mission_v6_quality.system", dir), mode)],
      },
    ],
  },
  {
    id: "review",
    title: "검수와 승인",
    screen: "학습 미션 품질 검수 → 교수자 최종 승인",
    route: "/admin/ai-review",
    result: "승인된 미션만 편성·공개",
    steps: [
      {
        id: "review_reuse", title: "AI 점검 결과 재사용", kind: "code", when: "내용이 ②와 같을 때",
        does: "②의 AI 점검 결과를 그대로 씁니다. 교수자가 내용을 고쳤으면 다시 점검합니다.",
        prompts: () => [],
      },
      {
        id: "review_zh", title: "중국어 표현 검수", kind: "always", when: "검수 화면에서 실행할 때",
        does: "중국어 표현의 자연성·격식·호칭·화행 실현을 검토합니다. 판단 범주를 바꾸지는 않습니다.",
        model: fixed(REVIEW_PRIMARY_MODEL),
        prompts: () => ["content_review.zh_expression"],
      },
      {
        id: "review_professor", title: "교수자 최종 승인", kind: "human", when: "AI 의견이 모인 뒤",
        does: "각 단계의 의견과 실제 콘텐츠를 대조해 수정·보류·사용을 결정합니다.",
        prompts: () => [],
      },
    ],
  },
  {
    id: "feedback",
    title: "학습자 피드백",
    screen: "학습자가 DCT를 제출할 때만 (MJT1~5는 ②의 해설을 보여 줌)",
    result: "확인된 판정만 학습자에게 보여 줌",
    steps: [
      {
        id: "feedback_generate", title: "피드백 작성", kind: "always", when: "DCT 답안을 제출할 때",
        does: "답안을 의미·문법·화용 층위로 나눠 진단합니다(점수 없음).",
        model: fixed(R.feedback.primary),
        fallback: modelLabel(R.feedback.fallback),
        prompts: (dir, mode) => [spokenKey(dirKey("feedback.system.focal", dir), mode)],
      },
      {
        id: "feedback_concrete", title: "구체성 재생성", kind: "conditional", when: "설명이 막연할 때",
        does: "같은 지시문에 「구체적으로」 메모를 붙여 한 번 더 씁니다.",
        model: fixed(R.feedback.primary),
        prompts: () => [],
        reuseNote: "「피드백 작성」과 같은 지시문",
      },
      {
        id: "feedback_review", title: "재검토", kind: "always", when: "피드백이 나온 뒤",
        does: "다른 AI가 축마다 판정·설명을 다시 확인합니다.",
        model: fixed(REVIEW_PRIMARY_MODEL),
        stop: "55초 안에 끝나지 않으면 판정을 확정해 보여 주지 않고 보류합니다.",
        prompts: (dir) => [dirKey("feedback.review.system", dir)],
      },
    ],
  },
];

/** 제작 흐름 밖의 별도 기능. */
export const SIDE_FEATURE_PROMPTS = ["authentic.system", "authentic.user"];

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  always: "항상",
  conditional: "조건부",
  optional: "선택",
  code: "코드 검사",
  human: "사람",
};

// 화면 조작으로 호출될 수 없는 지시문. 스냅숏(감사 기록)에는 남기고 화면에서만 뺀다.
// 집중 구간 없는 피드백은 편성된 4문항 미션이 학습자에게 열리지 않아 호출 경로가 없다.
export const HIDDEN_PROMPT_KEYS = new Set([
  // 2026-10-27부터 Claude 교차 검토와 그 의견 재판정은 쓰지 않는다(migration review_without_claude).
  "content_review.claude",
  "content_review.adjudication",
  "feedback.system",
  "feedback.system.zh_ko",
  "feedback.system.zh_ko.spoken",
  "feedback.system.spoken",
  // 2026-11-07: 미션 조립 화면은 v6만 만든다. v5 생성·검토 경로와 옛 개별 생성 경로는 화면 버튼과 연결돼 있지 않다.
  // (legacy.outline.system.zh_ko는 이름과 달리 현행 중→한 개요 생성이라 남긴다.)
  "legacy.individual.system.zh_ko",
  "legacy.individual.system.zh_ko.spoken",
  "mission.topology.system",
  "mission.system",
  "mission.system.zh_ko",
  "mission.system.zh_ko.spoken",
  "mission.system.proposal",
  "mission.system.spoken",
  "mission.system.legacy_v4",
  "mission.user.contrast_plan",
  "mission.candidate.generate.system",
  "mission.candidate.check.system",
  "mission.candidate.feedback.system",
  "mission.repair.system",
  "mission.consistency.system",
  "mission.item_lineage.system",
  "quality.system",
  "quality.system.zh_ko",
  "quality.system.zh_ko.spoken",
  "quality.system.legacy_v4",
  // 2026-10-25부터 선행 발화를 만들지 않으므로(서버가 is_response_act를 false로 고정) 응답 화행 판은 호출되지 않는다.
  "core.user.response_act",
  "core.user.spoken.zh_ko.response_act",
]);
// 호출은 되지만 화면에서는 생략하는 지시문(2026-10-09). 선행발화의 언어 표기만 1회 고치는 기술 보정이라
// 연구 서술과 관련이 가장 적다. 스냅숏(감사 기록)에는 그대로 남는다. 카드를 2열로 짝 맞추기 위해 뺐다.
export const OMITTED_PROMPT_KEYS = new Set(["core.user.preceding_turn_repair"]);
