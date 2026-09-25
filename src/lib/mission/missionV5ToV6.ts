// v5 native 저장본 → v6 초안 변환. 옮길 수 있는 것만 옮기고, 사람이 써야 하는
// 자리는 빈 채로 남기며 그 목록을 함께 돌려준다.
//
// v5 native와 v6는 문항 다섯 개와 DCT라는 골격은 같지만 2·4번 문항이 다르다.
// v5는 judge3(3대역 판단) + reason(주원인 고르기)이고, v6는 scale4+이유 선택 +
// 자유 교정이다. 따라서 v5의 reason 선택지는 v6 2번 문항으로 옮겨 붙고,
// **3·4번 문항 전체와 문항별 핵심 다섯 줄은 대응하는 v5 자료가 없다.**
//
// 3번이 없는 이유(2026-09-18): v5는 judge3와 fix_choice가 같은 자극문을 쓴다.
// 그대로 옮기면 v6 3번이 2번의 장면·PDR·원문을 되풀이한다. 승인된 v6 여섯 건은
// 1·2·3이 모두 다른 장면·PDR·원문이므로, 3번은 교정안까지 새로 쓰도록 gap으로 넘긴다.
//
// 이 파일은 내용을 지어내지 않는다. 판정·교정안·해설·대역은 저장본 값을 그대로
// 복사하고, 없는 것은 gap으로 보고한다. 변환 결과가 스키마를 통과한다는 것이
// 학습 자료로 타당하다는 뜻은 아니며 검수·승인은 기존 경로를 그대로 따른다.
//
// 승인된 v6 여섯 건에서 상수로 굳은 것은 규칙으로 채운다(2026-09-17 실측):
// 문항 짧은이름·지시문, 이유 질문, 그리고 2번 문항의 4점 척도. 2번은 v5 topology
// X→A→A→A→Y에서 항상 within 밖(anchor_non_within)이라 여섯 건 모두
// 기준 somewhat_inappropriate · 허용 +very_inappropriate 로 같았다.

import type { MissionV5Native } from "@/lib/pragma/missionSchema";

/** 저장본에 대응하는 값이 없어 사람이 써야 하는 자리. */
export interface V6AuthoringGap {
  /** 미션 JSON 안의 경로. 예: "mpj_items[3].target" */
  path: string;
  /** 왜 기계적으로 채울 수 없는지 */
  why: string;
}

export interface V5ToV6Conversion {
  /** v6 모양의 초안. gap 자리는 빈 문자열·빈 배열로 둔다. */
  draft: Record<string, unknown>;
  gaps: V6AuthoringGap[];
}

/** 승인본 여섯 건에서 문항 위치별로 고정된 화면 문구. */
const SHORT_LABELS = ["첫인상 판단", "맥락 판단", "선택교정", "직접 고쳐 보기", "네 표현 비교"] as const;
// 판단 문항의 지시문은 산출물 이름만 수행모드를 따른다(화면의 원문·산출 배지와 같은 규칙).
const PROMPTS = {
  scale: "이 번역안은 이 상황에 얼마나 잘 맞나요?",
  scale_interpreting: "이 통역안은 이 상황에 얼마나 잘 맞나요?",
  fix_choice: "원문의 핵심 의미와 화행 목적을 지키면서 이 상황에 맞게 고친 표현을 골라보세요.",
  free_correction: "원문의 핵심 의미와 화행 목적을 지키면서 필요한 부분을 직접 고쳐 보세요.",
  multi_judge: "각 표현을 읽고, 이 상황에서 어떻게 들리는지 판단해 보세요.",
  reason: "그렇게 판단한 이유는 무엇인가요?",
} as const;
/** 2번 문항: v5 judge3가 within 밖 대역이면 승인본과 같은 척도, within이면 1번과 같은 척도. */
const SCALE_FOR_NON_WITHIN = { accepted: ["somewhat_inappropriate", "very_inappropriate"], reference: "somewhat_inappropriate" };
const SCALE_FOR_WITHIN = { accepted: ["very_appropriate", "somewhat_appropriate"], reference: "very_appropriate" };

type AnyItem = Record<string, any>;

// 2026-09-07 이전 통역 저장본은 장면을 「학습자 통역사 C인 당신은 … 통역을 맡았습니다.」로
// 열고 인물을 A·B로 부른다. 그 서술 방식은 DEC-20260907-02로 폐지됐고 새 콘텐츠는 1인칭이나
// 역할명으로 쓴다. 여는 문장은 정확히 그 형태일 때만 떼어 내고(조사 손대지 않음), A·B가
// 남은 장면은 사람이 다시 쓰도록 gap으로 보고한다. 편성된 60슬롯 실측: 통역 30/30이 이 형태.
const INTERPRETER_INTRO = /^학습자\s*통역사\s*C인\s*당신은\s*[^.]*?통역을\s*맡았습니다\.\s*/u;
const ROLE_LETTER = /(^|[^A-Za-z])[AB](?=[는가와을를에의도]|에게|\s|$)/u;

export function stripInterpreterIntro(text: string): string {
  return text.replace(INTERPRETER_INTRO, "").trim();
}
function namesRoleLetters(text: string): boolean {
  return ROLE_LETTER.test(text);
}

/** v5 문항에서 v6가 그대로 쓰는 장면 필드만 남긴다. */
function scene(item: AnyItem) {
  return {
    situation_ko: stripInterpreterIntro(String(item.situation_ko ?? "")),
    relation_ko: stripInterpreterIntro(String(item.relation_ko ?? "")),
    channel: item.channel,
    pdr: item.pdr,
    // v6 장면은 self-contained이므로 앞선 발화는 옮기지 않는다(R8).
    learner_context_ko: "",
  };
}

/** v6가 쓰는 세 필드만 남긴다 — v5 저장본은 판정에 쓰지 않는 필드를 더 갖기도 한다. */
const candidateOf = (c: AnyItem) => ({ text: c.text, accepted_band_codes: c.accepted_band_codes, note_ko: c.note_ko });

/** v5의 권장 예시가 target과 다르면 v6의 수정 예시로 쓴다. */
function revisionExamples(item: AnyItem): { revision_examples: string[] } | Record<string, never> {
  const example = typeof item.recommended_example === "string" ? item.recommended_example.trim() : "";
  return example && example !== String(item.target ?? "").trim() ? { revision_examples: [example] } : {};
}

export function convertMissionV5ToV6(
  mission: MissionV5Native,
  /** learning_goal이 없는 옛 저장본을 위해서만 쓴다. */
  options: { speechAct?: string } = {},
): V5ToV6Conversion {
  const items = mission.mpj_items as unknown as AnyItem[];
  const byType = (type: string) => items.find(item => item.type === type);
  const first = byType("scale4");
  const contrast = byType("judge3");
  const fixChoice = byType("fix_choice");
  const reason = byType("reason");
  const multiJudge = byType("multi_judge");
  if (!first || !contrast || !fixChoice || !reason || !multiJudge) {
    throw new Error("native v5의 다섯 문항(scale4·judge3·fix_choice·reason·multi_judge)이 모두 필요합니다.");
  }

  const gaps: V6AuthoringGap[] = [];
  const scalePrompt = (mission.production_task as AnyItem).mode === "interpreting" ? PROMPTS.scale_interpreting : PROMPTS.scale;
  const title = (index: number) => {
    gaps.push({ path: `mpj_items[${index}].title`, why: "문항 제목(한 줄 질문) — v5에 대응 필드 없음" });
    return "";
  };
  const withinBand = String(mission.unit.target_feature ? "within_band" : "within_band");
  const contrastIsWithin = (contrast.accepted_band_codes as string[] | undefined)?.includes(withinBand) ?? false;
  const secondScale = contrastIsWithin ? SCALE_FOR_WITHIN : SCALE_FOR_NON_WITHIN;
  // judge3의 해설 뒤에 reason의 해설을 붙인다 — v6 2번은 판단과 이유를 한 화면에서 확인한다.
  const secondExplanation = [contrast.explanation_ko, reason.explanation_ko]
    .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
    .join("\n\n");

  const mpj_items = [
    { ...scene(first), short_label: SHORT_LABELS[0], title: title(0), prompt: scalePrompt, id: 1, type: "scale4",
      source: first.source, target: first.target,
      accepted_scale_codes: first.accepted_scale_codes,
      reference_scale_code: first.reference_scale_code,
      explanation_ko: first.explanation_ko, ...revisionExamples(first) },
    { ...scene(contrast), short_label: SHORT_LABELS[1], title: title(1), prompt: PROMPTS.scale, id: 2, type: "scale4",
      source: contrast.source, target: contrast.target,
      accepted_scale_codes: secondScale.accepted, reference_scale_code: secondScale.reference,
      explanation_ko: secondExplanation, ...revisionExamples(contrast),
      reason_choice: {
        prompt: PROMPTS.reason,
        options: (reason.reasons as AnyItem[]).map(option => ({ id: option.id, text: option.text_ko })),
      } },
    // v5 fix_choice는 judge3와 같은 자극문을 쓴다 — 옮기면 2번의 되풀이가 된다. 장면부터 새로 쓴다.
    { situation_ko: "", relation_ko: "", channel: fixChoice.channel, pdr: fixChoice.pdr, learner_context_ko: "",
      short_label: SHORT_LABELS[2], title: title(2), prompt: PROMPTS.fix_choice, id: 3, type: "fix_choice",
      source: "", target: "", corrections: [], explanation_ko: "" },
    // v5에는 자유 교정 문항이 없다. 장면부터 전부 새로 쓴다.
    { situation_ko: "", relation_ko: "", channel: contrast.channel, pdr: contrast.pdr, learner_context_ko: "",
      short_label: SHORT_LABELS[3], title: title(3), prompt: PROMPTS.free_correction, id: 4, type: "free_correction",
      source: "", target: "", reference_alternatives: [], explanation_ko: "" },
    { ...scene(multiJudge), short_label: SHORT_LABELS[4], title: title(4), prompt: PROMPTS.multi_judge, id: 5, type: "multi_judge",
      source: multiJudge.source, candidates: (multiJudge.candidates as AnyItem[]).map(candidateOf) },
  ];

  gaps.push(
    ...["situation_ko", "relation_ko", "pdr", "source", "target", "corrections", "explanation_ko"]
      .map(field => ({ path: `mpj_items[2].${field}`, why: "v5는 2번 문항과 같은 자극문을 써서 옮기면 되풀이가 된다 — 장면부터 새로 쓴다" })),
    ...["situation_ko", "relation_ko", "pdr", "source", "target", "reference_alternatives", "explanation_ko"]
      .map(field => ({ path: `mpj_items[3].${field}`, why: "v5에 자유 교정 문항이 없어 장면부터 새로 쓴다" })),
    ...[1, 2, 3, 4, 5].map(id => ({ path: `lesson_points[${id - 1}]`, why: "v5에 문항별 핵심 줄이 없음" })),
  );

  const { preceding_turn, ...task } = mission.production_task as AnyItem;
  task.situation_ko = stripInterpreterIntro(String(task.situation_ko ?? ""));
  task.relation_ko = stripInterpreterIntro(String(task.relation_ko ?? ""));
  // 여는 문장을 뗀 뒤에도 A·B로 인물을 부르는 장면은 옮길 수 없다 — 1인칭·역할명으로 다시 쓴다.
  for (const [index, entry] of [...mpj_items, task].entries()) {
    for (const field of ["situation_ko", "relation_ko"] as const) {
      if (namesRoleLetters(String((entry as AnyItem)[field] ?? ""))) {
        gaps.push({ path: index < 5 ? `mpj_items[${index}].${field}` : `production_task.${field}`, why: "인물을 A·B로 부르는 옛 통역 장면 — 1인칭·역할명으로 다시 쓴다" });
      }
    }
  }
  const learning_goal = (mission as AnyItem).learning_goal
    ?? (options.speechAct ? { kind: "speech_act", speech_act: options.speechAct } : undefined);
  if (!learning_goal) {
    gaps.push({ path: "learning_goal", why: "저장본에 learning_goal이 없고 화행도 주어지지 않음" });
  }
  return {
    draft: {
      schema_version: "mission_v6",
      direction: mission.direction,
      ...(learning_goal ? { learning_goal } : {}),
      unit: mission.unit,
      mpj_items,
      lesson_points: [1, 2, 3, 4, 5].map(item_id => ({ item_id, label: "", text: "" })),
      production_task: { ...task, preceding_turn: null, learner_context_ko: "" },
      provenance: mission.provenance,
    },
    gaps,
  };
}
