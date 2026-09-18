// v5 저장본 → authored.json 뼈대. 로컬에서만 돈다(DB 없음). 기존 authored는 덮지 않는다.
//
//   npx vite-node scripts/v6-skeleton-authored.mts tmp/v6-conversion/<prefix> [...]
//
// 생산라인 ②단계(2026-09-18 생산라인 문서 §2). 규칙으로 채울 수 있는 것만 채우고,
// 사람이 써야 하는 자리는 「⟪TODO …⟫」 표시로 남긴다. 조립기는 ⟪TODO가 남은 집필분을 거부한다.
// 집필 순서(§5): 원문·장면 먼저 → 그 원문에서 실제로 생기는 결함 확인 → 유형 이름표.
// 그래서 이 뼈대는 결함 유형·대역 분포를 미리 정하지 않는다.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { convertMissionV5ToV6, stripInterpreterIntro } from "@/lib/mission/missionV5ToV6";

const ACT_KO: Record<string, { noun: string; verb: string }> = {
  thanks: { noun: "감사", verb: "감사를 전합니다" },
  apology: { noun: "사과", verb: "사과합니다" },
  refusal: { noun: "거절", verb: "거절합니다" },
  request: { noun: "요청", verb: "부탁합니다" },
  opposition: { noun: "반대", verb: "반대 의견을 전합니다" },
  complaint: { noun: "불만", verb: "불만을 전합니다" },
  compliment: { noun: "칭찬", verb: "칭찬합니다" },
  invitation: { noun: "초대", verb: "초대합니다" },
  suggestion: { noun: "제안", verb: "제안합니다" },
};
const CHANNEL_KO: Record<string, string> = { messenger: "메신저로", email: "이메일로", facetoface: "직접 만나", phone: "전화로", video: "화상회의에서", sns: "SNS로" };
// 생산라인 문서 §5 핵심 정리 5칸 역할.
const LP_ROLES = [
  "① 원문의 구성 요소를 그대로(1번 문항)",
  "② 말은 다 있어도 태도가 바뀔 수 있다(2번)",
  "③ 화행 고유 키 — 주체·조건·결론·근거 중 3번 문항이 다룬 것",
  "④ 원문 크기만큼, 없는 것 보태지 않기(4번)",
  "⑤ 부족도 과함도 대역 밖(5번)",
];
const TODO = (what: string) => `⟪TODO ${what}⟫`;
const ROLE_A_B = /(^|[^A-Za-z])([AB])(?=[는가와을를에의도]|에게|\s|$)/gu;
const INTERPRETER_SENTENCE = /^통역사\s*C[는가]\s*[^.]*?사이에서\s*통역한다\.\s*/u;

for (const prefix of process.argv.slice(2)) {
  const out = `${prefix}.authored.json`;
  if (existsSync(out)) { console.log(`건너뜀(이미 있음): ${out}`); continue; }
  const source = JSON.parse(readFileSync(`${prefix}.v5.json`, "utf8"));
  const content = source.content;
  const { gaps } = convertMissionV5ToV6(content);
  const act = content.learning_goal?.speech_act as string;
  const actKo = ACT_KO[act] ?? { noun: act, verb: TODO("화행 동사") };
  const items = content.mpj_items as Record<string, any>[];
  const byType = (type: string) => items.find(item => item.type === type)!;
  const v6Order = [byType("scale4"), byType("judge3"), byType("fix_choice"), null, byType("multi_judge")];
  const task = content.production_task;
  const interpreting = String(task.mode).includes("interpreting");

  // 장면 뼈대: 옛 「통역사 C는 … 통역한다.」 문장을 떼고 A·B를 역할 표시로 바꾼 초안. 역할명은 사람이 정한다.
  const sceneDraft = (text: string) => TODO("역할명·1인칭으로 다시 쓰기") + " "
    + stripInterpreterIntro(String(text ?? "")).replace(INTERPRETER_SENTENCE, "").replace(ROLE_A_B, (_m, lead, letter) => `${lead}[${letter === "A" ? "중국어 화자" : "한국어 청자"}]`);
  const needsScene = (index: number | "dct", field: string) =>
    gaps.some(gap => gap.path === (index === "dct" ? `production_task.${field}` : `mpj_items[${index}].${field}`) && gap.why.includes("A·B"));

  const learnerContext = (item: Record<string, any> | null) =>
    TODO(`한두 문장 요약 — 끝: 「${CHANNEL_KO[item?.channel] ?? TODO("채널")} ${actKo.verb}.」`);

  const skeleton: Record<string, unknown> = {
    _about: `${prefix} ${actKo.noun}·${content.direction === "zh_ko" ? "중→한" : "한→중"}·${source.row?.learner_level ?? ""}·${interpreting ? "통역" : "번역"} v6 변환 집필분. 판정 분류 = ${TODO("형식 전환만 / 국소 수정 / 전면 재집필")}. 근거 1줄: ${TODO("triage")}`,
    _source: { title: source.title, course: source.course, row: source.row, core_pdr: source.core_content?.pdr },
    _review3: { source_scene: TODO("원문–장면 정합"), key_band: TODO("키·대역 근거"), translationese: TODO("번역투 여부") },
    _lp_roles: LP_ROLES,
    ...(interpreting ? {
      scenes: v6Order.map((item, index) => {
        if (!item || index === 2 || index === 3) return null;
        const needs = needsScene(index, "situation_ko") || needsScene(index, "relation_ko");
        return needs ? { situation_ko: sceneDraft(item.situation_ko), relation_ko: sceneDraft(item.relation_ko) } : null;
      }),
      ...(needsScene("dct", "situation_ko") || needsScene("dct", "relation_ko")
        ? { dct_scene: { situation_ko: sceneDraft(task.situation_ko), relation_ko: sceneDraft(task.relation_ko) } } : {}),
    } : {}),
    titles: [TODO("1번 제목"), TODO("2번 제목"), TODO("3번 제목"), TODO("4번 제목"), `네 ${actKo.noun}, 원문과 견주면 어디에 놓일까요?`],
    learner_contexts: v6Order.map(learnerContext),
    dct_learner_context: learnerContext({ channel: task.channel ?? byType("multi_judge").channel }),
    mjt3: {
      situation_ko: TODO("2번과 다른 장면"), relation_ko: TODO("관계"),
      pdr: { ...byType("fix_choice").pdr, _todo: "2번과 다른 PDR로 조정" }, channel: byType("fix_choice").channel,
      source: TODO("원문(출발어) — 먼저 쓴다"), target: TODO("결함 있는 번역안 — 원문에서 실제로 생기는 결함"),
      corrections: [
        { text: TODO("정답: 원문 내용·기능 보존"), is_valid: true, note_ko: TODO("근거") },
        { text: TODO("오답 1"), is_valid: false, note_ko: TODO("결함 유형 이름표 + 근거(원문 구절 인용)") },
        { text: TODO("오답 2"), is_valid: false, note_ko: TODO("결함 유형 이름표 + 근거(원문 구절 인용)") },
      ],
      explanation_ko: TODO("원문 구성 → 번역안이 바꾼 것 → 고칠 방향"),
    },
    mjt4: {
      situation_ko: TODO("장면"), relation_ko: TODO("관계"),
      pdr: { ...byType("judge3").pdr, _todo: "1·2·3번과 다른 PDR로 조정" }, channel: byType("judge3").channel,
      source: TODO("원문"), target: TODO("결함 1개 있는 번역안(과잉/흐림/지시화 — 원문 보고 판정)"),
      reference_alternatives: [TODO("참고안 1"), TODO("참고안 2: 같은 내용, 격만 다름")],
      explanation_ko: TODO("원문: … / 번역안의 문제: … / 고칠 방향: …"),
      contrast: { context_ko: TODO("관계 축 하나만 바꾼 조건"), target: TODO("대조문"), explanation_ko: TODO("무엇이 그대로이고 무엇이 달라지나") },
    },
    lesson_points: LP_ROLES.map(role => ({ label: TODO(`라벨 — ${role}`), text: TODO("그 미션의 원문 구절을 인용해 한두 문장") })),
    provenance: {
      model: "Claude",
      prompt_version: "v5_to_v6_retained_items_claude_20260917",
      source_scenario_id: source.scenario_id,
      source_mission_content_hash: content.provenance?.mission_content_hash,
      content_release_id: content.provenance?.content_release_id,
    },
    overrides: {},
    _note_for_review: "",
  };
  // pdr의 _todo 표시는 조립 전에 지운다(스키마 위반으로도 잡힌다).
  writeFileSync(out, JSON.stringify(skeleton, null, 2));
  console.log(`뼈대 저장: ${out} (gap ${gaps.length} · ${interpreting ? "통역" : "번역"})`);
}
