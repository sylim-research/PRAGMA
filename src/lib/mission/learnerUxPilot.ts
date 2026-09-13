import type { CanonicalMissionViewModel, ChoiceOption, DctQuest, MissionContext } from "./canonicalMissionPreview";

// Hand-authored, unapproved UX fixture. No production schema, lineage or evaluator claims.
export const LEARNER_UX_PILOT_ID = "school-request-free-correction-v1";
export const LEARNER_UX_PILOT_STORAGE_KEY = `pragma:local-ux:${LEARNER_UX_PILOT_ID}`;

const judgment: ChoiceOption[] = [
  { id: "appropriate", label: "상황에 잘 맞음" },
  { id: "adjust", label: "조정이 필요함" },
];
const spectrum: ChoiceOption[] = [
  { id: "too_direct", label: "너무 직접적" },
  { id: "appropriate", label: "상황에 맞음" },
  { id: "too_indirect", label: "지나치게 우회적" },
];
const context = (situation: string, relation: string, p: string, d: string, r: string, channel: MissionContext["channel"] = "메신저"): MissionContext => ({
  situation, relation, channel, pdr: { p, d, r },
});

const dct: DctQuest = {
  id: "A-DCT", module: "A", kind: "dct", shortLabel: "직접 옮기기", title: "새로운 상황에서 직접 번역하기",
  context: context("동아리 신입 부원들과 첫 모임을 준비하며 학생회관 담당 직원에게 연락합니다. 세미나실 예약 가능 여부는 아직 확인하지 않았습니다.", "학생회관 담당 직원 · 처음 연락하는 사이", "상대 높음", "처음 연락", "부담 보통", "이메일"),
  source: "안녕하세요. 다음 주 수요일 오후 세 시부터 네 시까지 세미나실을 빌릴 수 있을까요? 동아리 신입 부원들과 첫 모임을 하려고 합니다.",
  prompt: "상황에 맞게 중국어로 옮겨 보세요.",
  vocabularyHints: [{ source: "세미나실", target: "研讨室" }, { source: "신입 부원", target: "新成员" }],
  referenceAnswer: "您好，请问下周三下午三点到四点可以借用研讨室吗？我们想和社团的新成员举行第一次见面会。",
  requestParts: {
    headAct: { label: "예약 가능 여부 묻기", sourceText: "다음 주 수요일 오후 세 시부터 네 시까지 세미나실을 빌릴 수 있을까요?" },
    supportiveMoves: [{ type: "grounder", label: "이용 목적", sourceText: "동아리 신입 부원들과 첫 모임을 하려고 합니다.", provenance: "source_explicit" }],
  },
  feedback: {
    issue: "예약 가능한지 묻는 원문을 예약이 확정된 통보로 바꾸지 않습니다.",
    action: "요일·시간·모임 목적을 유지했는지, 예약 가능 여부를 묻고 있는지 살펴보세요.",
    success: "원문의 내용과 아직 확인되지 않은 예약 상태를 함께 보존합니다.",
    mode: "needs_mitigation",
    alternatives: [
      { text: "您好，请问下周三下午三点到四点可以借用研讨室吗？我们想和社团的新成员举行第一次见面会。", note: "시간과 목적을 밝히고 이용 가능 여부를 묻는 표현입니다." },
      { text: "您好，我们想在下周三下午三点到四点借用研讨室，和社团新成员开第一次见面会。请问可以吗？", note: "용건을 먼저 밝힌 뒤 가능 여부를 물을 수도 있습니다." },
    ],
  },
};

export const LEARNER_UX_PILOT: CanonicalMissionViewModel = {
  metaLabel: "학교생활 · 부탁 전하기", weekNo: 2, speechAct: "요청", level: "중급 · HSK 5",
  supportLevel: "intermediate", activityMode: "translation", direction: "한국어 → 중국어",
  sourceLanguage: { code: "ko", label: "한국어", badge: "KO" }, targetLanguage: { code: "zh", label: "중국어", badge: "ZH" },
  contrast: { before: "합의한 일을 친한 조원에게 상기", after: "아직 수락하지 않은 큰 부탁을 교수님께 요청", changedDimensions: [], note: "서로 다른 장면에서 부탁의 방식이 어떻게 들리는지 살펴봅니다." },
  summaryPrinciple: "원문의 뜻과 확정성을 지키고, 상대가 아직 수락하지 않은 부탁은 선택할 여지를 남깁니다.",
  lessonPoints: [
    { questId: "A1", label: "짧아도 자연스러운 부탁", text: "「发到群里吧」 · 이미 합의한 일을 편하게 상기할 때는 간결한 표현도 가능합니다." },
    { questId: "A2", label: "공손 표지와 수락은 별개", text: "「麻烦您」를 넣어도 추천서 작성을 이미 맡긴 듯한 흐름은 남을 수 있습니다." },
    { questId: "A3", label: "확인과 변경 구별", text: "출석을 확인해 달라는 부탁을 출석으로 고쳐 달라는 요구로 바꾸지 않습니다." },
    { questId: "A4", label: "직접 고쳐 보기", text: "시간·이유는 유지하면서, 일정 변경에 대한 조원들의 동의를 묻습니다." },
    { questId: "A5", label: "적절한 표현은 여러 가지", text: "필요한 배려의 정도를 살펴보되, 길이나 특정 단어 하나로 판정하지 않습니다." },
  ],
  quests: [
    {
      id: "A1", module: "A", kind: "scale", shortLabel: "첫인상 판단", title: "이 정도로 짧아도 괜찮을까요?",
      context: context("친한 팀플 조원이 최종 발표 파일을 단톡방에 올리기로 했습니다. 발표 전날, 약속한 파일을 아직 못 받아 가볍게 말을 건넵니다.", "친한 팀플 조원", "동등", "친한 사이", "부담 낮음"),
      source: "최종 PPT 단톡방에 올려줘.", target: "把最终版PPT发到群里吧。",
      prompt: "이 번역안은 이 상황에 얼마나 잘 맞나요?",
      options: [{ id: "very_appropriate", label: "매우 적절" }, { id: "somewhat_appropriate", label: "다소 적절" }, { id: "somewhat_inappropriate", label: "다소 부적절" }, { id: "very_inappropriate", label: "매우 부적절" }],
      referenceAnswer: "very_appropriate", acceptedAnswers: ["very_appropriate", "somewhat_appropriate"],
      feedback: "이미 올리기로 한 파일을 친한 조원에게 상기하는 장면입니다. 새 일을 일방적으로 맡기는 상황이 아니므로, 짧은 부탁도 자연스럽습니다.",
    },
    {
      id: "A2", module: "A", kind: "scale", shortLabel: "맥락 판단", title: "공손한 단어를 넣었는데도?",
      context: context("수업에서만 뵌 교수님께 교환학생 지원용 추천서를 처음 부탁합니다. 제출 마감은 다음 주 금요일이며, 교수님은 작성 여부를 아직 답하지 않았습니다.", "수업 담당 교수님", "상대 높음", "거리 있음", "부담 높음", "이메일"),
      source: "교수님, 교환학생 지원에 필요한 추천서를 써주실 수 있을까요? 다음 주 금요일까지 필요합니다.",
      target: "老师，麻烦您帮我写一封交换生申请的推荐信，下周五之前发给我，谢谢。",
      prompt: "이 번역안은 이 상황에 잘 맞나요?", options: judgment,
      referenceAnswer: "adjust",
      feedback: "麻烦您·谢谢는 공손한 표지지만, 전체 발화는 작성과 전달을 이미 맡긴 듯 들립니다. 원문은 작성 가능 여부를 묻고 있는데, 번역은 수락을 전제하는 요구로 바뀌었습니다.",
    },
    {
      id: "A3", module: "A", kind: "fix_choice", shortLabel: "선택교정", title: "어디까지 고쳐 달라고 했나요?", nextLabel: "다음: 직접 고쳐 보기",
      context: context("출석 앱에서 지난주 수업이 결석으로 표시된 것을 보고 조교에게 연락합니다. 표시가 잘못된 것인지는 아직 확인되지 않았습니다.", "담당 조교 · 몇 번 이야기한 사이", "상대 조금 높음", "아는 사이", "부담 보통"),
      source: "조교님, 지난주 출석이 결석으로 되어 있는데 확인해 주실 수 있나요?",
      target: "助教您好，请把我上周的缺勤记录改成出勤。",
      prompt: "이 번역안은 원문과 상황에 잘 맞나요?", judgmentOptions: judgment, referenceJudgment: "adjust",
      corrections: [
        { id: "honorific", text: "助教您好，麻烦您把我上周的缺勤记录改成出勤，谢谢您。", valid: false, note: "존칭과 감사를 보탰지만, 확인 요청을 출석 기록 변경 요구로 바꾼 문제는 남습니다." },
        { id: "check", text: "助教您好，系统显示我上周缺勤，能帮我核实一下吗？", valid: true, note: "표시된 상태를 설명하고 사실 확인을 요청합니다. 출석 인정이나 기록 변경을 미리 요구하지 않습니다." },
        { id: "apology", text: "助教您好，实在万分抱歉打扰您，系统显示我上周缺勤，不知能否劳烦您帮我核实一下，给您添麻烦了，真是过意不去。", valid: false, note: "확인 요청은 유지하지만, 통상적인 출석 문의에 사과와 의례 표현을 거듭 쌓아 용건이 무거워졌습니다." },
      ],
      feedback: "먼저 ‘확인’이 ‘변경’으로 바뀌지 않았는지 보세요. 말투만 공손하게 다듬어도 원문의 요청 범위가 달라지면 해결되지 않습니다.",
    },
    {
      id: "A4", module: "A", kind: "free_correction", shortLabel: "직접 고쳐 보기", title: "시간은 그대로, 부탁하는 방식은?",
      context: context("팀플 조원들과 내일 저녁 7시에 발표 리허설을 하기로 했습니다. 수업이 늦게 끝나 30분 늦추고 싶지만, 다른 조원들의 동의는 아직 구하지 않았습니다.", "같은 수업의 팀플 조원들", "동등", "아는 사이", "부담 보통"),
      source: "내일 발표 리허설을 7시에서 7시 반으로 늦춰도 될까? 수업이 늦게 끝나서.",
      target: "我下课晚，明天的汇报彩排就从七点改到七点半吧。",
      prompt: "이 번역안은 원문과 상황에 잘 맞나요?", judgmentOptions: judgment,
      references: ["我下课晚，明天的汇报彩排能从七点推迟到七点半吗？", "明天我下课晚，彩排从七点改到七点半，可以吗？"],
      feedback: "원문은 변경 허락을 묻지만, 就……改到……吧는 이미 정한 변경을 알리는 듯 들릴 수 있습니다. 시간과 이유를 유지하면서 동의를 묻도록 고쳐 보세요. 아래 표현은 가능한 예시이며, 다른 방식으로도 옮길 수 있습니다.",
    },
    {
      id: "A5", module: "A", kind: "spectrum", shortLabel: "네 표현 비교", title: "각 표현은 어디쯤에 놓일까요?",
      context: context("동아리 홍보 포스터의 날짜를 바꾸려고 지난해 담당 선배에게 원본 파일을 부탁합니다. 선배와는 활동 중 몇 번 이야기했고, 파일은 선배가 보관하고 있습니다.", "한 학년 위 여자 선배", "상대 조금 높음", "아는 사이", "부담 낮음"),
      source: "선배, 동아리 홍보 포스터 원본 파일을 보내주실 수 있나요? 날짜만 바꾸려고요.",
      prompt: "네 번역안을 각각 스펙트럼 위에 놓아 보세요. 같은 위치에 여러 표현을 놓아도 됩니다.", options: spectrum,
      candidates: [
        { id: "a", text: "学姐，能把社团宣传海报的原文件发给我吗？我只改一下日期。", acceptedAnswers: ["appropriate"], note: "용건과 이유를 간결하게 밝히고 전달 가능 여부를 묻습니다." },
        { id: "b", text: "学姐，实在不好意思，又来麻烦您了。不知能否请您把社团宣传海报的原文件发给我？我只改一下日期，给您添麻烦了，真是过意不去。", acceptedAnswers: ["too_indirect"], note: "작은 파일 전달 부탁에 사과와 의례 표현이 누적돼 지나치게 무거워집니다. 您나 사과 자체가 문제인 것은 아닙니다." },
        { id: "c", text: "学姐，我想改一下社团宣传海报上的日期，方便把原文件发给我吗？", acceptedAnswers: ["appropriate"], note: "목적을 먼저 밝히고 상대가 전달할 수 있는지 묻는 또 다른 적절한 표현입니다." },
        { id: "d", text: "学姐，社团宣传海报的原文件发我，我要改一下日期。", acceptedAnswers: ["too_direct"], note: "전달 가능 여부를 묻는 원문을 짧은 전달 지시로 바꿨습니다. 단순히 짧아서가 아니라 수락을 전제하는 요청 방식이 문제입니다." },
      ],
    },
    dct,
    { ...dct, id: "A-FEEDBACK", kind: "dct_feedback", dctId: dct.id, shortLabel: "참고 표현 확인", title: "참고 표현과 내 번역을 비교해 보세요" },
  ],
};
