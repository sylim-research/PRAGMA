// v5 native 저장본 → v6 초안 변환. 옮길 수 있는 것만 옮기고, 사람이 써야 하는
// 자리는 빈 채로 남기며 그 목록을 함께 돌려준다.
//
// v5 native와 v6는 문항 다섯 개와 DCT라는 골격은 같지만 2·4번 문항이 다르다.
// v5는 judge3(3대역 판단) + reason(주원인 고르기)이고, v6는 scale4+이유 선택 +
// 자유 교정이다. 따라서 v5의 reason 선택지는 v6 2번 문항으로 옮겨 붙고,
// **4번 자유 교정 문항 전체와 문항별 핵심 다섯 줄은 대응하는 v5 자료가 없다.**
//
// 이 파일은 내용을 지어내지 않는다. 판정·교정안·해설·대역은 저장본 값을 그대로
// 복사하고, 없는 것은 gap으로 보고한다. 변환 결과가 스키마를 통과한다는 것이
// 학습 자료로 타당하다는 뜻은 아니며 검수·승인은 기존 경로를 그대로 따른다.

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

/** v6 문항이 화면에 쓰지만 v5에는 없는 표시용 필드. */
const DISPLAY_FIELDS = ["short_label", "title", "prompt"] as const;

type AnyItem = Record<string, any>;

/** v5 문항에서 v6가 그대로 쓰는 장면 필드만 남긴다. */
function scene(item: AnyItem) {
  return {
    situation_ko: item.situation_ko,
    relation_ko: item.relation_ko,
    channel: item.channel,
    pdr: item.pdr,
    // v6 장면은 self-contained이므로 앞선 발화는 옮기지 않는다(R8).
    learner_context_ko: "",
  };
}

function displayGaps(index: number, gaps: V6AuthoringGap[]) {
  for (const field of DISPLAY_FIELDS) {
    gaps.push({ path: `mpj_items[${index}].${field}`, why: "v6 화면 문구 — v5에 대응 필드 없음" });
  }
  return Object.fromEntries(DISPLAY_FIELDS.map(field => [field, ""]));
}

/** v6가 쓰는 세 필드만 남긴다 — v5 저장본은 판정에 쓰지 않는 필드를 더 갖기도 한다. */
const correctionOf = (c: AnyItem) => ({ text: c.text, is_valid: c.is_valid, note_ko: c.note_ko });
const candidateOf = (c: AnyItem) => ({ text: c.text, accepted_band_codes: c.accepted_band_codes, note_ko: c.note_ko });

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
  const mpj_items = [
    { ...scene(first), ...displayGaps(0, gaps), id: 1, type: "scale4",
      source: first.source, target: first.target,
      accepted_scale_codes: first.accepted_scale_codes,
      reference_scale_code: first.reference_scale_code,
      explanation_ko: first.explanation_ko },
    // judge3의 장면·대상·해설에 reason의 선택지를 붙인다. 척도는 대역과 자가
    // 달라 옮길 수 없다 — judge3의 대역을 근거로 사람이 정한다.
    { ...scene(contrast), ...displayGaps(1, gaps), id: 2, type: "scale4",
      source: contrast.source, target: contrast.target,
      accepted_scale_codes: [], reference_scale_code: "",
      explanation_ko: contrast.explanation_ko,
      reason_choice: {
        prompt: "",
        options: (reason.reasons as AnyItem[]).map(option => ({ id: option.id, text: option.text_ko })),
      } },
    { ...scene(fixChoice), ...displayGaps(2, gaps), id: 3, type: "fix_choice",
      source: fixChoice.source, target: fixChoice.target,
      corrections: (fixChoice.corrections as AnyItem[]).map(correctionOf), explanation_ko: fixChoice.explanation_ko },
    // v5에는 자유 교정 문항이 없다. 장면부터 전부 새로 쓴다.
    { situation_ko: "", relation_ko: "", channel: contrast.channel, pdr: contrast.pdr, learner_context_ko: "",
      ...displayGaps(3, gaps), id: 4, type: "free_correction",
      source: "", target: "", reference_alternatives: [], explanation_ko: "" },
    { ...scene(multiJudge), ...displayGaps(4, gaps), id: 5, type: "multi_judge",
      source: multiJudge.source, candidates: (multiJudge.candidates as AnyItem[]).map(candidateOf) },
  ];

  gaps.push(
    { path: "mpj_items[1].accepted_scale_codes", why: `judge3 대역(${(contrast.accepted_band_codes ?? []).join("·")})은 4점 척도와 자가 달라 사람이 정한다` },
    { path: "mpj_items[1].reference_scale_code", why: "위와 같음" },
    { path: "mpj_items[1].reason_choice.prompt", why: "v5 reason에는 질문 문구가 없음" },
    ...["situation_ko", "relation_ko", "source", "target", "reference_alternatives", "explanation_ko"]
      .map(field => ({ path: `mpj_items[3].${field}`, why: "v5에 자유 교정 문항이 없어 장면부터 새로 쓴다" })),
    ...[1, 2, 3, 4, 5].map(id => ({ path: `lesson_points[${id - 1}]`, why: "v5에 문항별 핵심 줄이 없음" })),
  );

  const { preceding_turn, ...task } = mission.production_task as AnyItem;
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
