/** 현재 승인된 MPJ5 + DCT1 학습 경험의 화면 view model과 로컬 preview. */
export type MissionModule = "A" | "B";

export interface MissionContext {
  situation: string;
  /** 학습자가 상황을 빠르게 파악하도록 자연어 문장 안에서만 강조할 단서 */
  highlights?: string[];
  relation: string;
  channel: "이메일" | "위챗" | "메신저" | "대면" | "전화";
  pdr: {
    p: string;
    d: string;
    r: string;
  };
  precedingTurn?: string;
}

interface QuestBase {
  id: string;
  module: MissionModule;
  shortLabel: string;
  title: string;
  context: MissionContext;
  source: string;
  /** 제출 뒤 목표어에서 직접 짚어 줄 표현 */
  targetHighlights?: string[];
}

export interface MissionLessonPoint {
  questId: string;
  label: string;
  text: string;
  highlights?: string[];
}

export interface ChoiceOption {
  id: string;
  label: string;
  /** 판정 대역을 정답처럼 보이게 하지 않고 경계를 같은 밀도로 설명하는 보조 문구. */
  description?: string;
}

export interface ScaleQuest extends QuestBase {
  kind: "scale";
  prompt: string;
  target: string;
  options: ChoiceOption[];
  referenceAnswer: string;
  /** 제출 뒤 정답 효과를 함께 표시할 수용 대역 */
  acceptedAnswers?: string[];
  feedback: string;
}

export interface FixChoiceQuest extends QuestBase {
  kind: "fix_choice";
  prompt: string;
  target: string;
  judgmentOptions: ChoiceOption[];
  referenceJudgment: string;
  corrections: Array<{
    id: string;
    text: string;
    valid: boolean;
    note: string;
  }>;
  /** 과도기 MPJ4의 판단+교정 복합 문항을 두 학습 활동으로 펼칠 때, 앞 단계의 실제 판단 응답을 이어받는다. */
  judgmentQuestId?: string;
  feedback: string;
}

export interface ReasonQuest extends QuestBase {
  kind: "reason";
  prompt: string;
  target: string;
  referenceJudgment: "inappropriate";
  reasons: Array<{
    id: string;
    text: string;
    kind: "primary" | "pragmatic_misconception" | "meaning_grammar_context";
  }>;
  acceptedReasonId: string;
  /** legacy MPJ5에서 복수 근거를 허용한 경우의 읽기 호환. 최신 설계는 단일 ID를 사용한다. */
  acceptedReasonIds?: string[];
  feedback: string;
}

export interface BestWorstQuest extends QuestBase {
  kind: "best_worst";
  comparisonMode?: "band_pair" | "ranked";
  prompt: string;
  candidates: Array<{
    id: string;
    text: string;
    role: "best" | "middle" | "worst";
    note: string;
  }>;
  bestId: string;
  worstId: string;
  feedback: string;
}

export function comparisonCandidateLabel(quest: BestWorstQuest, role: "best" | "middle" | "worst") {
  if (quest.comparisonMode === "band_pair") {
    return role === "best" ? "상황에 적절한 표현" : role === "worst" ? "조정이 필요한 표현" : "가능한 표현";
  }
  return role === "best" ? "BEST · 가장 적절" : role === "worst" ? "WORST · 가장 덜 적절" : "가능한 표현";
}

export interface DctQuest extends QuestBase {
  kind: "dct";
  prompt: string;
  replayLimit?: number;
  vocabularyHints: Array<{ source: string; target: string }>;
  referenceAnswer: string;
  requestParts: {
    headAct: {
      label: string;
      sourceText: string;
    };
    supportiveMoves: Array<{
      type: "greeting" | "grounder" | "apology" | "option_giver" | "thanks";
      label: string;
      sourceText: string;
      provenance: "source_explicit" | "scenario_licensed" | "target_conventional";
    }>;
  };
  feedback: {
    issue: string;
    action: string;
    success: string;
    mode: "needs_mitigation" | "avoid_over_mitigation";
    alternatives: Array<{
      text: string;
      note: string;
    }>;
  };
}

export interface DctFeedbackQuest extends QuestBase {
  kind: "dct_feedback";
  dctId: string;
  referenceAnswer: string;
  requestParts: DctQuest["requestParts"];
  feedback: DctQuest["feedback"];
}

export type MissionQuest =
  | ScaleQuest
  | FixChoiceQuest
  | ReasonQuest
  | BestWorstQuest
  | DctQuest
  | DctFeedbackQuest;

const APPROPRIATENESS_4: ChoiceOption[] = [
  { id: "very_appropriate", label: "매우 적절" },
  { id: "somewhat_appropriate", label: "다소 적절" },
  { id: "somewhat_inappropriate", label: "다소 부적절" },
  { id: "very_inappropriate", label: "매우 부적절" },
];

const DIRECTNESS_3: ChoiceOption[] = [
  { id: "too_direct", label: "너무 직접적", description: "상황에 비해 단정적" },
  { id: "appropriate", label: "현재 상황에 맞음", description: "관계·거리·부담에 맞는 조절" },
  { id: "too_indirect", label: "지나치게 우회적", description: "요청 의도가 흐려짐" },
];

export interface CanonicalMissionViewModel {
  scenarioId?: string;
  metaLabel?: string;
  weekNo: number;
  speechAct: string;
  level: string;
  supportLevel: "beginner" | "intermediate" | "advanced";
  activityMode: "translation" | "interpreting";
  direction: string;
  sourceLanguage: { code: "ko" | "zh"; label: string; badge: "KO" | "ZH" };
  targetLanguage: { code: "ko" | "zh"; label: string; badge: "KO" | "ZH" };
  contrast: {
    before: string;
    after: string;
    changedDimensions: string[];
    note: string;
  };
  summaryPrinciple: string;
  lessonPoints: MissionLessonPoint[];
  quests: MissionQuest[];
}

export const CANONICAL_MISSION_PREVIEW: CanonicalMissionViewModel = {
  weekNo: 2,
  speechAct: "요청",
  level: "중급 · HSK 5",
  supportLevel: "intermediate",
  activityMode: "translation",
  direction: "한국어 → 중국어",
  sourceLanguage: { code: "ko", label: "한국어", badge: "KO" },
  targetLanguage: { code: "zh", label: "중국어", badge: "ZH" },
  contrast: {
    before: "초면의 인턴십 담당자에게 면접 일정 조정 요청",
    after: "같은 담당자에게 안내 파일 재전송 요청",
    changedDimensions: ["R: 중·상 → 낮음"],
    note: "요청이라는 화행과 상대는 같지만, 이번 부탁은 아까보다 훨씬 가볍습니다.",
  },
  summaryPrinciple: "요청의 핵심 의미는 지키고, 이유·사과·선택권 같은 덧붙임은 관계와 상황에 맞게 선택합니다.",
  lessonPoints: [
    {
      questId: "A1",
      label: "첫인상 판단",
      text: "「请给我写」 → 큰 부탁을 바로 요구해 선택권 부족",
      highlights: ["请给我写"],
    },
    {
      questId: "A2",
      label: "상황 비교",
      text: "「吧」 → 친한 사이·낮은 부담에는 직접형도 자연스러움",
      highlights: ["吧"],
    },
    {
      questId: "A3",
      label: "고쳐 보기",
      text: "「助教您好，请问」 → 첫 연락은 호칭으로 열기",
      highlights: ["助教您好，请问"],
    },
    {
      questId: "A4",
      label: "이유 찾기",
      text: "「一下」 → 완화처럼 보여도 선택권은 아님",
      highlights: ["一下"],
    },
    {
      questId: "A5",
      label: "BEST·WORST",
      text: "적정안 「能帮忙吗」 → 가능 여부를 물어 부담을 낮춤",
      highlights: ["能帮忙吗"],
    },
  ],
  quests: [
    {
      id: "A1",
      module: "A",
      shortLabel: "판단하기",
      title: "적절성 판단하기",
      kind: "scale",
      context: {
        situation: "지도교수님께 대학원 추천서를 부탁하는 이메일을 씁니다.",
        highlights: ["지도교수님", "추천서"],
        relation: "지도교수 · 평소 수업에서만 뵙는 사이",
        channel: "이메일",
        pdr: { p: "상대 높음", d: "거리 있음", r: "부담 높음" },
      },
      source: "교수님, 혹시 대학원 지원에 필요한 추천서를 써주실 수 있을까요? 마감은 다음 달 15일입니다.",
      target: "老师，请给我写一封研究生申请的推荐信，截止日期是下个月15号。",
      targetHighlights: ["请给我写"],
      prompt: "이 번역안은 이 상황에 얼마나 적절한가요?",
      options: APPROPRIATENESS_4,
      referenceAnswer: "somewhat_inappropriate",
      acceptedAnswers: ["somewhat_inappropriate", "very_inappropriate"],
      feedback: "내용은 전달되지만 请给我写는 추천서 작성을 직접 요구합니다. 부담이 큰 부탁인데 가능 여부나 선택할 여지를 충분히 남기지 못했습니다.",
    },
    {
      id: "A2",
      module: "A",
      shortLabel: "상황 비교",
      title: "상황에 맞는지 판단하기",
      kind: "scale",
      context: {
        situation: "같이 사는 룸메이트에게 에어컨 온도를 낮춰 달라고 말합니다.",
        highlights: ["같이 사는 룸메이트", "에어컨 온도"],
        relation: "룸메이트 · 편한 사이",
        channel: "대면",
        pdr: { p: "동등", d: "친밀", r: "부담 낮음" },
      },
      source: "에어컨 좀 약하게 틀어도 될까? 좀 추워서.",
      target: "有点冷，把空调调小一点吧。",
      targetHighlights: ["有点冷", "吧"],
      prompt: "이 번역안은 이 상황에 맞나요?",
      options: DIRECTNESS_3,
      referenceAnswer: "appropriate",
      feedback: "有点冷으로 이유를 먼저 말하고 吧로 직접형의 강도를 낮췄습니다. 친밀하고 부담이 낮은 상황에서는 간결한 직접형도 자연스럽습니다.",
    },
    {
      id: "A3",
      module: "A",
      shortLabel: "고쳐 보기",
      title: "판단하고 고쳐 보기",
      kind: "fix_choice",
      context: {
        situation: "위챗 대화를 처음 시작하며 조교에게 과제 마감일을 확인합니다.",
        highlights: ["처음 시작", "조교", "마감일"],
        relation: "조교 · 몇 번 이야기해 본 사이",
        channel: "위챗",
        pdr: { p: "상대 조금 높음", d: "아는 사이", r: "부담 낮음" },
      },
      source: "조교님, 과제 마감이 이번 주 금요일 맞나요?",
      target: "喂，作业这周五交吗？",
      targetHighlights: ["喂"],
      prompt: "이 상황에서 이 표현은 어떻게 들리나요?",
      judgmentOptions: [
        { id: "rude", label: "무례함", description: "상황에 필요한 대인 배려가 부족함" },
        { id: "appropriate", label: "현재 상황에 맞음", description: "관계·거리·부담에 맞는 조절" },
        { id: "over_polite", label: "지나치게 공손함", description: "상황에 비해 격식이 높음" },
      ],
      referenceJudgment: "rude",
      corrections: [
        { id: "a3-valid-1", text: "助教您好，请问作业是这周五交吗？", valid: true, note: "호칭과 请问으로 메시지를 자연스럽게 엽니다." },
        { id: "a3-under", text: "作业这周五交吗？", valid: false, note: "喂는 뺐지만 대화 첫머리의 호칭과 열기가 여전히 없습니다." },
        { id: "a3-over", text: "助教您好，不知是否方便告知本周作业的截止日期？如蒙确认，不胜感激。", valid: false, note: "가벼운 확인에 지나치게 공식적인 문체를 겹쳤습니다." },
      ],
      feedback: "喂는 전화나 사람을 부를 때 쓰는 말이라 첫 위챗 메시지에서는 거칠게 들릴 수 있습니다. 이 상황에는 호칭과 짧은 확인 표현이면 충분합니다.",
    },
    {
      id: "A4",
      module: "A",
      shortLabel: "이유 찾기",
      title: "부적절한 이유 찾기",
      kind: "reason",
      context: {
        situation: "학술대회 준비위원회에 처음 들어가 초면인 준비위원장에게 지난 회의록을 부탁합니다.",
        highlights: ["처음", "초면인 준비위원장", "회의록"],
        relation: "준비위원장 · 대학원생 선배 · 초면",
        channel: "위챗",
        pdr: { p: "상대 높음", d: "초면", r: "부담 보통" },
      },
      source: "안녕하세요. 지난주 회의록을 좀 보내주실 수 있을까요?",
      target: "把上周的会议记录发我一下。",
      targetHighlights: ["把上周的会议记录发我一下"],
      prompt: "이 표현은 이 상황에 적절한가요?",
      referenceJudgment: "inappropriate",
      reasons: [
        {
          id: "a4-right",
          text: "처음 연락하는 윗사람에게 一下만으로는 선택할 여지를 충분히 남기지 못했다.",
          kind: "primary",
        },
        {
          id: "a4-opposite",
          text: "부담에 비해 지나치게 돌려 말해 요청 내용이 흐려졌다.",
          kind: "pragmatic_misconception",
        },
        {
          id: "a4-meaning",
          text: "회의록을 요청한다는 핵심 내용이 번역에서 빠졌다.",
          kind: "meaning_grammar_context",
        },
      ],
      acceptedReasonId: "a4-right",
      feedback: "`一下`이 강도를 조금 낮추지만 가능 여부를 묻는 형식은 아니어서, 초면의 윗사람에게는 선택할 여지가 부족합니다.",
    },
    {
      id: "A5",
      module: "A",
      shortLabel: "BEST·WORST",
      title: "BEST와 WORST 고르기",
      kind: "best_worst",
      context: {
        situation: "이번 학기에 처음 같은 조가 된 팀 프로젝트 조원에게 자료 정리를 맡아 달라고 부탁합니다.",
        highlights: ["처음 같은 조", "자료 정리"],
        relation: "같은 조 조원 · 이번 학기에 처음 같은 조",
        channel: "위챗",
        pdr: { p: "동등", d: "아는 사이", r: "부담 보통" },
      },
      source: "이번 자료 정리는 네가 맡아줄 수 있어? 내가 발표 준비를 해야 해서.",
      prompt: "이 상황에서 가장 적절한 표현(BEST)과 가장 덜 적절한 표현(WORST)을 하나씩 고르세요.",
      candidates: [
        { id: "a5-under", text: "这次资料你来整理吧，我还要准备报告。", role: "worst", note: "이유와 吧는 있지만 상대가 맡을 수 있는지 묻지 않아 조정이 필요합니다." },
        { id: "a5-best", text: "这次资料整理你能帮忙吗？我还要准备报告。", role: "best", note: "간결하게 가능 여부를 묻고 원문의 이유도 유지한 적정 대역 표현입니다." },
        { id: "a5-best-alt", text: "如果方便的话，这次资料整理能不能请你帮忙？我还要准备报告。", role: "best", note: "상대의 가능 여부를 확인하는 다른 적정 대역 전략입니다." },
        { id: "a5-over", text: "这次资料整理请你务必代为处理，我还要准备报告。", role: "worst", note: "务必와 공식 문체가 부탁을 강제적인 업무 지시처럼 만들어 조정이 필요합니다." },
      ],
      bestId: "a5-best",
      worstId: "a5-over",
      feedback: "",
    },
    {
      id: "A-DCT",
      module: "A",
      shortLabel: "번역하기 1",
      title: "첫 번째 상황 번역하기",
      kind: "dct",
      context: {
        situation: "아직 만난 적 없는 인턴십 담당자에게 면접 일정 조정을 요청하는 이메일을 씁니다.",
        highlights: ["아직 만난 적 없는 인턴십 담당자", "면접 일정 조정"],
        relation: "인턴십 담당자 · 초면",
        channel: "이메일",
        pdr: { p: "상대 높음", d: "초면", r: "부담 중·상" },
      },
      source: "안녕하세요. 다음 주 화요일 면접에 참석하기 어려울 것 같습니다. 같은 주 다른 날로 조정이 가능할지 여쭙고 싶습니다. 불편을 드려 죄송합니다.",
      prompt: "이 말을 중국어로 옮겨 보세요.",
      vocabularyHints: [
        { source: "면접", target: "面试" },
        { source: "일정을 조정하다", target: "调整时间" },
      ],
      referenceAnswer: "您好，下周二的面试我可能无法参加，非常抱歉。请问能否调整到同一周的其他日期？",
      requestParts: {
        headAct: {
          label: "면접 일정을 같은 주의 다른 날로 조정해 달라는 요청",
          sourceText: "같은 주 다른 날로 조정이 가능할지 여쭙고 싶습니다.",
        },
        supportiveMoves: [
          { type: "greeting", label: "인사", sourceText: "안녕하세요.", provenance: "source_explicit" },
          { type: "grounder", label: "이유 설명", sourceText: "다음 주 화요일 면접에 참석하기 어려울 것 같습니다.", provenance: "source_explicit" },
          { type: "apology", label: "사과", sourceText: "불편을 드려 죄송합니다.", provenance: "source_explicit" },
        ],
      },
      feedback: {
        mode: "needs_mitigation",
        issue: "요청 내용은 전달됐지만, 일정 변경을 바로 요구하면 초면인 담당자에게 통보처럼 들릴 수 있습니다.",
        action: "일정 변경 부분을 `能不能……`처럼 가능 여부를 묻는 형식으로 바꿔 보세요.",
        success: "일정 변경의 이유와 가능 여부가 모두 자연스럽게 전달됩니다. 이제 같은 뜻을 더 매끄럽게 다듬어 보세요.",
        alternatives: [
          { text: "不知道能否将面试改到同一周的其他时间？", note: "不知道能否로 결정 가능성을 상대에게 열어 둡니다." },
          { text: "如果方便的话，可以调整到同一周的其他日期吗？", note: "조건절로 상대가 곤란할 수 있음을 함께 고려합니다." },
        ],
      },
    },
    {
      id: "A-FEEDBACK",
      module: "A",
      shortLabel: "피드백·다듬기 1",
      title: "첫 번째 번역 피드백과 다듬기",
      kind: "dct_feedback",
      dctId: "A-DCT",
      context: {
        situation: "아직 만난 적 없는 인턴십 담당자에게 면접 일정 조정을 요청하는 이메일을 씁니다.",
        highlights: ["아직 만난 적 없는 인턴십 담당자", "면접 일정 조정"],
        relation: "인턴십 담당자 · 초면",
        channel: "이메일",
        pdr: { p: "상대 높음", d: "초면", r: "부담 중·상" },
      },
      source: "안녕하세요. 다음 주 화요일 면접에 참석하기 어려울 것 같습니다. 같은 주 다른 날로 조정이 가능할지 여쭙고 싶습니다. 불편을 드려 죄송합니다.",
      referenceAnswer: "您好，下周二的面试我可能无法参加，非常抱歉。请问能否调整到同一周的其他日期？",
      requestParts: {
        headAct: {
          label: "면접 일정을 같은 주의 다른 날로 조정해 달라는 요청",
          sourceText: "같은 주 다른 날로 조정이 가능할지 여쭙고 싶습니다.",
        },
        supportiveMoves: [
          { type: "greeting", label: "인사", sourceText: "안녕하세요.", provenance: "source_explicit" },
          { type: "grounder", label: "이유 설명", sourceText: "다음 주 화요일 면접에 참석하기 어려울 것 같습니다.", provenance: "source_explicit" },
          { type: "apology", label: "사과", sourceText: "불편을 드려 죄송합니다.", provenance: "source_explicit" },
        ],
      },
      feedback: {
        mode: "needs_mitigation",
        issue: "요청 내용은 전달됐지만, 일정 변경을 바로 요구하면 초면인 담당자에게 통보처럼 들릴 수 있습니다.",
        action: "일정 변경 부분을 `能不能……`처럼 가능 여부를 묻는 형식으로 바꿔 보세요.",
        success: "일정 변경의 이유와 가능 여부가 모두 자연스럽게 전달됩니다. 이제 같은 뜻을 더 매끄럽게 다듬어 보세요.",
        alternatives: [
          { text: "不知道能否将面试改到同一周的其他时间？", note: "不知道能否로 결정 가능성을 상대에게 열어 둡니다." },
          { text: "如果方便的话，可以调整到同一周的其他日期吗？", note: "조건절로 상대가 곤란할 수 있음을 함께 고려합니다." },
        ],
      },
    },
  ],
};
