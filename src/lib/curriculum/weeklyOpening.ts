import type { LearnerCourse, LearnerCourseWeek } from "./learnerCourse";
import { expectedCoreModeForWeek, isCourseModePolicyValid, type CourseMode } from "./courseModePolicy";
import { buildWeeklyLearnerNote } from "./learnerNote";
import { CHANNEL_TO_MODE, CHANNEL_UI, DIRECTION_LABEL, DOMAIN, LEVEL, SPEECH_ACT_UI, type Domain, type LearnerLevel, type SpeechActUI } from "@/lib/pragma/enums";
import { courseDisplayTitle } from "@/lib/pragma/scenarioTopics";

export interface WeeklyOpening {
  version: "weekly-opening-v1";
  courseId: string;
  weekNo: number;
  courseTitle: string;
  weekTitle: string;
  contextLabel: string;
  goals: string[];
  status: "draft" | "planning" | "unavailable";
  notice: string;
  question: string;
  scene: string;
  role: string;
  source: { language: "ko" | "zh"; text: string } | null;
  rendering: { language: "ko" | "zh"; text: string } | null;
  support: string;
  firstPrompt: string;
  clues: Array<{ title: string; fact: string; question: string }>;
  connections: Array<{ observation: string; choice: string }>;
  transfer: string;
}

type Pair = { ko: string; zh: string };
type Seed = { question: string; situation: string; pairs: Record<LearnerLevel, Pair>; focus: string; consequence: string };

/** Authored teaching examples, never sampled from assigned MJT/DCT answers.
 * The selected week supplies domain, relationship, burden, channel and goals.
 * These are reviewable drafts, not empirical evidence of a listener's reaction.
 */
function examples(domain: Domain): Record<SpeechActUI, Seed> {
  const event = { daily: ["모임", "聚会"], school: ["세미나", "研讨会"], work: ["설명회", "说明会"] }[domain];
  const [ko, zh] = event;
  const pairs = (a: Pair, b: Pair, c: Pair) => ({ beginner_intermediate: a, intermediate: b, advanced: c });
  return {
    request: {
      question: "이대로 부탁해도 될까요?", situation: `${ko}의 안내 시간을 바꿔야 해 상대에게 연락합니다.`,
      pairs: pairs({ ko: "안내 시간을 내일로 바꿔 주세요.", zh: "请把通知时间改到明天。" }, { ko: `${ko} 안내를 내일 보내 주실 수 있나요?`, zh: `能明天再发${zh}通知吗？` }, { ko: `${ko} 안내 발송을 내일로 조정해 주시면 좋겠습니다.`, zh: `希望您能将${zh}通知的发送时间调整到明天。` }),
      focus: "요청하는 일을 분명히 유지하면서 상대가 응답하거나 조정할 여지를 어디에 둘지 설명합니다.", consequence: "안내 발송 일정을 조정하는 일",
    },
    refusal: {
      question: "이 말로 거절이 전달될까요?", situation: `${ko} 준비를 함께 해 달라는 부탁을 받았지만 참여할 수 없습니다.`,
      pairs: pairs({ ko: "그날은 시간이 없어요.", zh: "那天我没有时间。" }, { ko: `그날은 다른 약속이 있어서 ${ko} 준비를 돕기 어려워요.`, zh: `那天我有别的安排，恐怕没法帮忙准备${zh}。` }, { ko: "이미 정해진 일정 때문에 이번 준비에는 참여하기 어렵겠습니다.", zh: "由于已有安排，这次的筹备工作恐怕无法参与。" }),
      focus: "참여할 수 없다는 뜻과 상대의 부탁을 받아들이는 태도가 각각 어디에서 드러나는지 짚습니다.", consequence: "함께 준비할 사람을 다시 찾는 일",
    },
    apology: {
      question: "사과는 어디까지 전해졌나요?", situation: `${ko} 시간을 잘못 알려 상대가 다른 시간에 도착했습니다.`,
      pairs: pairs({ ko: "시간을 잘못 알려 드려서 미안해요.", zh: "对不起，我把时间告诉错了。" }, { ko: "제가 시간을 잘못 알려 드렸네요. 기다리게 해서 죄송합니다.", zh: "是我把时间告诉错了，让您等了，真不好意思。" }, { ko: "제가 안내 시간을 잘못 전달해 기다리시게 했습니다. 죄송합니다.", zh: "我把时间传达错了，耽误了您的时间，非常抱歉。" }),
      focus: "잘못과 영향을 인정하는 표현을 찾아보고, 원문에 없는 약속을 추가하지 않으면서 책임을 어떻게 전달할지 설명합니다.", consequence: "잘못된 시간 안내로 생긴 기다림과 일정 조정",
    },
    thanks: {
      question: "이 고마움의 크기는 어떤가요?", situation: `상대가 ${ko} 안내문의 오류를 찾아 수정해 주었습니다.`,
      pairs: pairs({ ko: "안내문 고쳐 줘서 고마워요.", zh: "谢谢你帮我修改通知。" }, { ko: "안내문을 꼼꼼히 확인해 주셔서 큰 도움이 됐어요. 감사합니다.", zh: "谢谢您仔细检查通知，帮了我很大的忙。" }, { ko: "바쁜 중에도 안내문을 검토해 주셔서 감사합니다. 덕분에 오류를 바로잡았습니다.", zh: "感谢您在百忙之中审阅通知，多亏您的帮助才纠正了错误。" }),
      focus: "도움을 구체적으로 인정하는 부분과 감사의 강도를 나누어 보고, 실제 도움의 크기에 비추어 선택을 설명합니다.", consequence: "안내문을 확인하고 고치는 데 상대가 들인 시간과 수고",
    },
    proposal: {
      question: "함께 정할 여지가 있나요?", situation: `${ko}의 진행 순서를 상의하고 있습니다.`,
      pairs: pairs({ ko: "질문을 먼저 받으면 어때요?", zh: "先听听大家的问题，怎么样？" }, { ko: "설명 전에 질문부터 받아 보는 건 어떨까요?", zh: "要不要在说明之前先听听大家的问题？" }, { ko: "참석자들의 질문을 먼저 확인한 뒤 설명을 진행하는 방안을 제안합니다.", zh: "建议先了解参加者的问题，再进行说明。" }),
      focus: "제안 내용의 명료성과 함께 결정할 여지가 각각 어떻게 드러나는지 설명합니다.", consequence: "이미 정한 진행 순서를 변경하는 일",
    },
    agreement: {
      question: "초대를 받으면 무엇을 알 수 있나요?", situation: `${ko}가 끝난 뒤 상대와 식사를 함께하고 싶습니다.`,
      pairs: pairs({ ko: "끝나고 같이 밥 먹을래요?", zh: "结束后一起吃饭吗？" }, { ko: `${ko}가 끝난 뒤 시간 괜찮으면 같이 식사하실래요?`, zh: `${zh}结束后，如果有时间，要不要一起吃个饭？` }, { ko: "일정이 괜찮으시면 행사가 끝난 뒤 함께 식사할 수 있으면 좋겠습니다.", zh: "如果您的时间方便，希望活动结束后能一起用餐。" }),
      focus: "함께하려는 뜻, 구체적인 약속의 범위, 상대가 응답할 여지를 구분해 설명합니다.", consequence: "식사에 참여하기 위해 상대가 조정해야 하는 일정",
    },
    opposition: {
      question: "다른 의견이 충분히 들리나요?", situation: `${ko} 준비 시간을 줄이자는 의견에 동의하기 어렵습니다.`,
      pairs: pairs({ ko: "저는 시간이 더 필요하다고 생각해요.", zh: "我觉得还需要更多时间。" }, { ko: "말씀하신 취지는 이해하지만 준비 시간을 줄이는 데는 동의하기 어려워요.", zh: "我理解您的想法，不过不太赞成缩短准备时间。" }, { ko: "효율을 높이자는 취지에는 공감합니다만, 현재 준비 시간을 더 줄이는 것은 어렵다고 봅니다.", zh: "我赞同提高效率的初衷，但认为目前难以进一步压缩准备时间。" }),
      focus: "동의하는 범위와 반대하는 지점을 구분하고, 상대를 대하는 태도와 입장의 명료성을 함께 설명합니다.", consequence: "진행 계획을 다시 논의하고 조정하는 일",
    },
    compliment: {
      question: "무엇을 칭찬하는 말인가요?", situation: `상대가 만든 ${ko} 안내문을 보고 좋은 점을 전하려고 합니다.`,
      pairs: pairs({ ko: "안내문이 정말 보기 좋아요.", zh: "这份通知看着真舒服。" }, { ko: "안내문을 읽기 쉽게 정리하셨네요. 필요한 정보가 잘 보여요.", zh: "通知整理得很清楚，需要的信息一目了然。" }, { ko: "안내문의 구성이 명료해서 참석자가 필요한 정보를 바로 찾을 수 있겠습니다.", zh: "通知结构清晰，参加者能够迅速找到所需信息。" }),
      focus: "평가하는 대상과 구체적인 근거를 확인하고, 이 관계에서 그 평가를 어떻게 전할지 설명합니다.", consequence: "안내문을 작성하면서 상대가 들인 시간과 수고",
    },
    complaint: {
      question: "문제와 바라는 조치가 들리나요?", situation: `${ko} 장소가 바뀌었는데 사전에 안내를 받지 못했습니다.`,
      pairs: pairs({ ko: "장소가 바뀐 줄 몰랐어요. 미리 알려 주세요.", zh: "我不知道地点变了，请提前告诉我。" }, { ko: "장소 변경 안내를 못 받아서 찾는 데 시간이 걸렸어요. 다음에는 미리 알려 주세요.", zh: "没有收到地点变更通知，我找了好一会儿。下次请提前告知。" }, { ko: "장소 변경이 사전에 전달되지 않아 이동에 차질이 있었습니다. 다음부터는 미리 안내해 주시기 바랍니다.", zh: "由于未提前收到地点变更通知，我的行程受到了影响。希望今后能事先告知。" }),
      focus: "관찰한 문제, 그 영향, 바라는 조치를 구분하고 확인되지 않은 상대의 의도를 덧붙이지 않습니다.", consequence: "장소를 다시 찾아 이동하느라 발생한 시간과 일정 조정",
    },
  };
}

export function buildWeeklyOpening(outline: LearnerCourse["outline"], week: LearnerCourseWeek): WeeklyOpening {
  const direction = outline.language_direction;
  const level = outline.level as LearnerLevel;
  const domain = (week.domain ?? outline.domain) as Domain;
  const policy = { courseMode: outline.course_mode as CourseMode, interpretingWeekCount: outline.target_interpreting_week_count };
  const mode = expectedCoreModeForWeek(policy, week.week_no);
  const goals = [...(week.competency_focus?.trim() ? [week.competency_focus.trim()] : []), ...week.can_do.filter((goal) => goal.trim())];
  const base: WeeklyOpening = {
    version: "weekly-opening-v1", courseId: outline.id, weekNo: week.week_no,
    courseTitle: courseDisplayTitle(outline), weekTitle: week.title,
    contextLabel: [LEVEL[level], DIRECTION_LABEL[direction], mode === "stt_interpreting" ? "통역" : mode === "translation" ? "번역" : "수업 활동", DOMAIN[domain], week.speech_act ? SPEECH_ACT_UI[week.speech_act] : null].filter(Boolean).join(" · "),
    goals, status: "draft", notice: "교수자 검토용 수업 예시 · 주차 목표와 예문의 적합성을 확인하세요.",
    question: "판단을 바꾼 단서는 무엇인가요?", scene: "이번 주 학습목표를 보고, 함께 이야기할 장면 하나를 떠올려 보세요.",
    role: "한 사람이 장면과 발화를 소개하고, 나머지는 먼저 자신의 판단을 말합니다.",
    source: null, rendering: null, support: "문장에 직접 드러난 사실과 우리가 추측한 것을 구분해 봅시다.",
    firstPrompt: "지금 판단하려면 어떤 정보가 더 필요한가요?",
    clues: [
      { title: "누가 누구에게", fact: "장면을 소개한 사람이 두 사람의 관계와 이전 접촉을 설명합니다.", question: "처음 생각했던 관계와 같았나요?" },
      { title: "어떤 일이 있었나", fact: "장면을 소개한 사람이 발화 전의 사건과 실제 부담을 설명합니다.", question: "어떤 단서 때문에 판단이 달라졌나요?" },
    ],
    connections: [{ observation: "내가 근거로 삼은 사실", choice: "그 사실을 바탕으로 표현의 무엇을 유지하거나 조정할지 말해 봅시다." }],
    transfer: "이번 주 활동에서도 판단의 근거가 된 상황 단서와 표현 선택을 함께 설명해 봅시다.",
  };
  const unavailable = (notice: string): WeeklyOpening => ({ ...base, status: "unavailable", notice });
  if (!LEVEL[level] || !DIRECTION_LABEL[direction] || !DOMAIN[domain] || !isCourseModePolicyValid(policy)) return unavailable("교과목의 수준·언어 방향·영역·수행모드 설정을 확인한 뒤 도입 자료를 구성하세요.");
  if (!goals.length) return unavailable("이번 주 학습목표를 먼저 입력해 주세요. 목표가 없는 도입 예시는 구성하지 않습니다.");
  if (!week.speech_act) {
    if (week.type === "orientation") {
      const sourceKo = direction === "ko_zh";
      return { ...base, question: "짧은 한마디, 뜻도 하나일까요?", scene: "한 사람이 상대에게 짧은 답을 전하려고 합니다. 아직 앞의 대화는 모릅니다.",
        role: "원문만 보고 옮긴 초안입니다. 앞의 대화를 알게 되면 선택이 달라질지 함께 살펴봅니다.",
        source: { language: sourceKo ? "ko" : "zh", text: sourceKo ? "괜찮아요." : "不用了。" },
        rendering: { language: sourceKo ? "zh" : "ko", text: sourceKo ? "没关系。" : "필요 없어요." },
        firstPrompt: "이 초안을 그대로 전달할까요? 어떤 장면을 떠올렸나요?",
        clues: [
          { title: "누가 누구에게", fact: `${DOMAIN[domain]} 장면에서 처음 만난 사람과 이야기하고 있습니다. 상대가 먼저 도움을 제안했습니다.`, question: "처음 떠올렸던 장면과 같은가요?" },
          { title: "바로 앞의 말", fact: "상대가 “짐을 들어 드릴까요?”라고 물었습니다. 말하는 사람은 스스로 들 수 있어서 도움을 사양하려 합니다.", question: "도움을 사양하는 뜻과 상대를 대하는 태도가 초안에도 전달되나요?" },
        ],
        connections: [{ observation: "앞선 발화는 도움의 제안이고, 원발화자는 그 도움을 사양하려 합니다.", choice: "단어 뜻만 대조하지 않고, 이 대화에서 원문이 하는 일을 먼저 확인합니다. 사양의 뜻과 원문의 태도를 함께 전달할 표현을 이야기해 봅시다." }],
        transfer: "이 교과목에서는 원문이 이 상황에서 하는 일을 읽고, 통번역 표현을 선택한 이유를 설명합니다.",
      };
    }
    return { ...base, status: "planning", notice: "이 주차는 개별 화행이 지정되지 않았습니다. 주차 목표에 따라 교수자가 장면을 제시하는 토론 진행안입니다." };
  }
  if (!mode || !week.channel || CHANNEL_TO_MODE[week.channel] !== mode) return unavailable("주차의 전달 채널과 번역·통역 편성 조건을 맞춰 주세요.");
  if (!week.pdr_power || !week.pdr_distance || !week.pdr_imposition) return unavailable("주차의 관계·거리·부담을 먼저 지정해 주세요. 임의의 맥락으로 대체하지 않습니다.");
  if (week.scenarios.some((scenario) => (scenario.speech_act && scenario.speech_act !== week.speech_act) || scenario.mode !== mode)) return unavailable("편성 미션의 화행·수행모드가 주차 계획과 다릅니다. 편성을 확인해 주세요.");
  const seed = examples(domain)[week.speech_act];
  if (!seed) return unavailable("이 화행의 도입 예시가 아직 준비되지 않았습니다.");
  const note = buildWeeklyLearnerNote(week, direction === "zh_ko" ? "zh_ko" : "ko_zh");
  const pair = seed.pairs[level];
  const source = { language: direction === "zh_ko" ? "zh" as const : "ko" as const, text: direction === "zh_ko" ? pair.zh : pair.ko };
  const rendering = { language: direction === "zh_ko" ? "ko" as const : "zh" as const, text: direction === "zh_ko" ? pair.ko : pair.zh };
  // A separate source is necessary, including when course assignments are replaced.
  const normalize = (text: string) => text.replace(/[\s\p{P}]/gu, "");
  if (week.scenarios.some((scenario) => scenario.source_text && normalize(scenario.source_text) === normalize(source.text))) return unavailable("도입 원문이 편성 미션의 원문과 겹칩니다. 별도 사례를 준비한 뒤 사용하세요.");
  const relationship = {
    higher: "이 일의 진행 여부는 상대가 최종 결정합니다.", equal: "두 사람은 이 일에서 같은 역할을 맡고 있습니다.", lower: "이 일의 진행 여부는 말하는 사람이 최종 결정합니다.",
  }[week.pdr_power];
  const distance = {
    close: "두 사람은 평소 사적인 이야기도 자주 나눕니다.", acquaintance: "이전에 함께 일한 적은 있지만 사적으로 연락하지는 않습니다.", formal: "두 사람은 오늘 처음 연락을 주고받습니다.",
  }[week.pdr_distance];
  const burden = {
    low: "몇 분이면 처리할 수 있고, 다른 일정을 바꾸지는 않습니다.", mid: "한동안 시간을 내야 하고, 예정한 일 하나를 조정해야 합니다.", high: "여러 사람의 일정을 다시 맞춰야 하고, 이미 잡힌 다른 약속에도 영향이 있습니다.",
  }[week.pdr_imposition];
  return {
    ...base, question: seed.question, scene: seed.situation,
    role: mode === "stt_interpreting" ? `원발화자 A → 청자 B · 여러분은 통역사 C입니다. 교수자가 ${source.language === "ko" ? "한국어" : "중국어"} 원문을 읽고, 아래 통역 초안을 함께 검토합니다.` : `여러분이 보내려는 ${CHANNEL_UI[week.channel]}의 원문과 번역 초안입니다.`,
    source, rendering,
    support: level === "beginner_intermediate" ? "핵심 뜻을 먼저 확인하고, 눈에 띄는 표현 한 곳을 근거로 말해 봅시다." : level === "advanced" ? "원문의 태도와 강도를 보존하는 범위에서, 다른 해석이 가능한 조건까지 설명해 봅시다." : "원문의 뜻과 태도가 초안에서 어떻게 전달되는지 근거를 들어 말해 봅시다.",
    firstPrompt: "이 초안을 그대로 전달할까요? 바꾼다면 어느 부분인가요?",
    clues: [
      { title: "두 사람의 관계", fact: `${distance} ${relationship}`, question: "이 관계를 알고도 같은 표현을 선택하겠어요?" },
      { title: "말 뒤에 있는 일", fact: `${seed.consequence}입니다. ${burden}`, question: "지금 알게 된 사실 중 판단에 가장 영향을 준 것은 무엇인가요?" },
    ],
    connections: [
      { observation: `${distance} ${relationship}`, choice: "관계가 표현을 해석하는 데 어떤 근거가 되었는지, 선택한 어구와 연결해 말합니다." },
      { observation: `${seed.consequence} · ${burden}`, choice: seed.focus },
      ...note.features.map((feature) => ({ observation: feature.label, choice: feature.principle })),
    ],
    transfer: `이제 다른 장면의 ${SPEECH_ACT_UI[week.speech_act]} 미션에서, 원문의 뜻과 태도를 유지하며 상황에 맞는 ${mode === "stt_interpreting" ? "통역" : "번역"}을 해 봅시다.`,
  };
}
