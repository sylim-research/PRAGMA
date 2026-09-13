// 도입 아크(lesson_arc) mock — 새 목표 특징을 처음 배울 때 1회. UI 목업 전용.
//
// 미션 사이클(산출 먼저)과 순서가 반대다: 입력 먼저(장면→관찰→명시→수용) 후
// 미션 1개로 합류. 학습자에게는 이론 용어를 노출하지 않는다(4층 UI LOCK 매핑):
//   Orientation=장면 만나기 / Inductive=차이 찾기 /
//   Metapragmatic=원리 이해 / MPJ=감각 확인
//
// ⚠️ 도입 사례와 산출 문항은 다른 자극을 쓴다(intro_example_item ≠ production_item).
// 같은 목표 특징·유사 P·D·R은 허용하되 인물·사건·원문은 겹치지 않게 한다 —
// 여기는 리웨이/노트, 미션은 샤오린/발표자료다.

export const INTRO_STEPS = ["결과 보기", "단서 추리", "원리 연결", "적용 판단"] as const;

/** 이 아크가 도입하는 전략군. 완료 시 LearnerFeatureState에 기록된다. */
export const INTRO_FEATURE_ID = "request_directness_mitigation";

// 학습자에게 아크를 여는 목표 특징. 배선(라우트·주차 진입점·미션 합류)은 끝나 있고,
// 여는 조건은 이 목록 하나다. 콘텐츠가 준비되면 여기에 특징 코드를 넣으면 된다.
//
// 지금은 비어 있다 — 아래 mock 콘텐츠가 검수를 통과하지 못했다(2026-07-31):
//   ① Hook의 인과 불성립 — 필기 요청은 용건이 끝나면 대화도 끝나는 것이 자연스러워서,
//      "대화가 멈췄다"가 화용 실패의 증거가 되지 못한다.
//   ② REPLAY_CASES의 대안이 호칭·사과·이유·의문형·시점 선택권을 동시에 바꾼다.
//      무엇이 차이를 만들었는지 분리할 수 없어 귀납 관찰의 목적이 훼손된다
//      (생성계약의 excluded_confounds 정신과 어긋남).
//   ③ CLASSIFY_ITEMS의 대역이 길이와 완전히 공변한다(8·20·35자) — R5의 길이 단서 문제.
//   ④ 과잉 예시가 동급생 상황에 비현실적으로 과장돼 중간 정도의 과잉을 다루지 못한다.
//   ⑤ CLASS_LABELS가 미션 band 라벨과 다른 용어를 쓴다.
//
// 결정: 아크 콘텐츠는 손으로 9개를 쓰지 않고 생성 계약에 얹는다. 코어에서 파생시키고
// 변인 분리·길이 등가·밴드 라벨 일치를 규칙으로 강제한 뒤 검수한다.
export const ARC_READY_FEATURES = [] as const;

export function hasIntroArc(featureCode: string | null | undefined): boolean {
  return (
    typeof featureCode === "string" &&
    (ARC_READY_FEATURES as readonly string[]).includes(featureCode)
  );
}

export interface IntroContextFrame {
  physical: string;
  social: string;
  goal: string;
}

/** ① 결과 보기 — 맥락 설명보다 결과적 효과(perlocutionary effect)를 먼저 경험한다. */
export const HOOK_SCENE = {
  eyebrow: "요청 · 대화는 끝났지만 무언가 남았습니다",
  title: "부탁은 성공했다. 그런데 대화는 왜 멈췄을까?",
  lead: "설명은 잠시 뒤로 미룹니다. 먼저 민준과 리웨이 사이에 남은 장면을 봅니다.",
  context: {
    physical:
      "평일 밤 9시, 민준과 리웨이는 각자 기숙사에 있습니다. 민준은 위챗 메시지를 보내며 즉시 답을 받기로 한 상황은 아닙니다.",
    social:
      "두 사람은 이번 학기 처음 같은 조가 된 동급생입니다. 인사만 몇 차례 나눴고 개인적으로 연락한 적은 없습니다. 필기를 찾아 사진으로 보내는 데 몇 분은 들지만, 리웨이의 일정을 바꿀 정도는 아닙니다.",
    goal:
      "민준은 지난 수업의 필기를 끝까지 하지 못해, 다음 날 수업 전에 빠진 부분을 확인할 수 있도록 리웨이의 필기 사진을 요청합니다.",
  } satisfies IntroContextFrame,
  threadTitle: "微信 · 李伟",
  threadMeta: "21:07 · 각자의 기숙사",
  lines: [
    { who: "민준", zh: "把上节课的笔记拍给我看一下。", note: null },
    { who: null, zh: null, note: "읽음" },
    { who: null, zh: null, note: "상대방이 입력 중입니다…" },
    { who: null, zh: null, note: "입력 표시가 사라졌습니다." },
    { who: "리웨이", zh: "哦，好。", note: "3분 뒤" },
  ],
  attachment: "필기 사진 3장",
  outcome: "필기는 도착했습니다. 필요한 일도 해결됐습니다. 그러나 대화는 여기서 끝났습니다.",
  question: "문법은 맞았는데, 왜 부탁만 남고 관계는 이어지지 않았을까?",
};

/** ② 단서 추리 — 장면에 이미 있었지만 첫 화면에서 감춘 맥락을 하나씩 공개한다. */
export const CONTEXT_CLUES = [
  {
    tag: "21:07",
    title: "늦은 시간의 비동기 메시지",
    fact: "평일 밤 9시, 각자의 기숙사에서 보낸 위챗 메시지입니다. 즉시 답하기로 한 약속은 없습니다.",
    effect: "지금 바로 행동하라는 인상을 줄이지 않는 표현이 필요합니다.",
  },
  {
    tag: "개인 연락 처음",
    title: "동등하지만 아직 가까운 사이는 아님",
    fact: "이번 학기 처음 같은 조가 된 동급생이며, 인사만 몇 차례 나눴습니다.",
    effect: "높은 존칭은 필요 없지만, 맥락 없이 요구부터 꺼내면 갑작스럽게 들릴 수 있습니다.",
  },
  {
    tag: "몇 분의 수고",
    title: "작지만 분명한 부탁의 비용",
    fact: "리웨이는 필기를 찾아 사진을 찍고 전송해야 합니다. 일정을 바꿀 정도는 아니지만 수고가 듭니다.",
    effect: "부탁의 이유를 밝히고 상대가 응답 시점을 고를 수 있게 하는 것이 자연스럽습니다.",
  },
  {
    tag: "내일 수업 전",
    title: "분명한 상호작용 목표",
    fact: "민준은 지난 수업에서 빠진 필기를 다음 날 수업 전에 확인하려고 합니다.",
    effect: "완화하더라도 무엇을 부탁하는지는 분명히 남겨야 합니다.",
  },
];
export const CLUES_REQUIRED = 3;

/** 동일한 맥락에서 가능한 두 전개. 반응은 인과를 보장하는 정답이 아니라 검수된 예시다. */
export const REPLAY_CASES = {
  first: {
    label: "처음 보낸 말",
    request: "把上节课的笔记拍给我看一下。",
    response: "哦，好。",
    note: "필기 사진은 도착했지만 대화는 더 이어지지 않았습니다.",
  },
  alternative: {
    label: "같은 장면의 다른 가능성",
    request:
      "李伟，不好意思这么晚打扰。我上节课的笔记没记全，你方便的时候能拍给我看一下吗？",
    response: "没事，我一会儿拍给你。你哪一部分没记全？",
    note: "상대의 시간과 이유가 보이자, 대화가 다음 차례로 이어질 여지가 생겼습니다.",
  },
};

/** ③ 원리 연결 — 맥락 사실과 언어 선택의 연결을 학습자 언어로 설명한다. */
export const PRINCIPLE_TABLE = [
  {
    k: "전달 조건",
    v: "밤 9시의 위챗 메시지 → 즉시 답하거나 행동하라고 재촉하지 않기",
    hi: true,
  },
  {
    k: "관계",
    v: "동등하지만 아직 친하지 않은 조원 → 과도한 존칭보다 부드러운 부탁형",
    hi: true,
  },
  {
    k: "부담",
    v: "필기를 찾아 사진으로 보내는 몇 분의 수고 → 이유를 밝히고 상대의 편의를 남기기",
    hi: true,
  },
  {
    k: "목표",
    v: "빠진 필기를 확인하는 것이 핵심 → 완화하더라도 요청 내용은 분명하게 유지",
    hi: false,
  },
];
export const PRINCIPLE_LEAD =
  "완화 표현은 많을수록 좋은 것이 아닙니다. 전달 조건·관계·부담·목표를 함께 읽고, 이 장면에 필요한 만큼만 선택해야 합니다. 같은 동급생이라도 친밀도와 부탁의 비용이 달라지면 알맞은 표현도 달라집니다.";
export const STRATEGY_MAP_UNLOCK =
  "요청 전략 지도가 열렸습니다. 방금 관찰한 단서가 상황에 맞는 표현을 고르는 도구가 됩니다.";

/** ④ 적용 판단 — 새롭고 완결된 맥락에서 과소/적정/과잉 대역을 판정한다. */
export type ClassLabel = "under" | "ok" | "over";
export const CLASS_LABELS: { key: ClassLabel; label: string }[] = [
  { key: "under", label: "직접성이 큼" },
  { key: "ok", label: "상황에 맞음" },
  { key: "over", label: "완화가 많음" },
];
export const CLASSIFY_CONTEXT = {
  physical:
    "오후 2시 수업 시작 직전, 강의실에서 옆자리 학생에게 직접 말합니다. 바로 답을 듣는 대면 상황입니다.",
  social:
    "두 사람은 같은 수업을 듣는 동등한 학생이지만 오늘 처음 말을 겁니다. 상대의 책상에는 여분의 펜이 여러 자루 있어 하나를 잠시 빌려주는 부담은 낮습니다.",
  goal:
    "내 펜이 나오지 않아, 이번 수업 동안 사용할 펜 한 자루를 빌리려고 합니다.",
} satisfies IntroContextFrame;
export const CLASSIFY_PROMPT =
  "아래 세 표현이 이 장면에 얼마나 맞는지 분류합니다. 하나의 모범 문장을 고르는 문제가 아니라 표현의 적절한 범위를 판단하는 활동입니다.";
export const CLASSIFY_ITEMS: { zh: string; truth: ClassLabel; fb: string }[] = [
  {
    zh: "同学，笔借我用一下。",
    truth: "under",
    fb: "처음 말을 거는 사이인데 부탁을 바로 명령형으로 꺼내 직접성이 크게 느껴집니다.",
  },
  {
    zh: "同学，不好意思，我的笔没水了，能借我一支吗？",
    truth: "ok",
    fb: "짧은 이유와 의문형이 관계와 낮은 부담에 맞습니다.",
  },
  {
    zh: "同学，冒昧打扰，请问您是否方便把笔借给我使用一下？给您添麻烦了。",
    truth: "over",
    fb: "사회적 거리는 있지만 부담이 매우 낮은 부탁이라, 이 정도의 격식과 사과는 필요 이상으로 무겁습니다.",
  },
];

export const ARC_CLOSING = {
  allRight: "맥락과 표현의 연결을 정확히 짚었습니다.",
  partial: "각 표현이 전달 조건·관계·부담과 어떻게 연결되는지 다시 살펴보십시오.",
  cta: "직접 적용하기",
};
