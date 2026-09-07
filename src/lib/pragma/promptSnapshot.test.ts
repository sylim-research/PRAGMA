import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { PROMPT_SNAPSHOT } from "@/lib/pragma/promptSnapshot.generated";
import { SCENE_PLAUSIBILITY_RULE } from "../../../supabase/functions/_shared/learnerScene";
import {
  MISSION_DIAGNOSTIC_DIMENSIONS,
  MISSION_DIAGNOSTIC_EVIDENCE_REFS,
} from "@/lib/pragma/diagnosticDimensions";
import {
  CURRENT_CONTENT_RELEASE_ID,
  CURRENT_CORE_PROMPT_VERSIONS,
  CURRENT_CORE_QUALITY_PROMPT_VERSION,
  CURRENT_FEEDBACK_PROMPT_VERSIONS,
  CURRENT_ITEM_LINEAGE_PROMPT_VERSION,
  CURRENT_MISSION_QUALITY_PROMPT_VERSION,
  CURRENT_MISSION_PROMPT_VERSIONS,
} from "../../../supabase/functions/_shared/contentRelease";

function prompt(key: string) {
  const entry = PROMPT_SNAPSHOT.prompts.find((item) => item.key === key);
  if (!entry) throw new Error(`프롬프트 스냅샷에 ${key}가 없습니다.`);
  return entry;
}

describe("prompt snapshot integrity", () => {
  it("shares plausibility across translation and interpreting generation and review in both directions", () => {
    const shared = PROMPT_SNAPSHOT.prompts.filter(({ key }) =>
      /^(core\.system\.|mission\.system|quality\.system|core_quality\.system|legacy\.(individual|outline)\.system)/.test(key));
    expect(shared.length).toBeGreaterThanOrEqual(12);
    for (const entry of shared) {
      expect(entry.text, entry.key).toContain(SCENE_PLAUSIBILITY_RULE);
      expect(entry.text, entry.key).toContain("요청·거절·사과·감사·제안·초대·반대·칭찬·불만의 모든 미션");
    }
  });
  it("captures the separate mission_v5 item-lineage attribution contract", () => {
    const lineage = prompt("mission.item_lineage.system");
    expect(lineage.text).toContain("provenance 분류자");
    expect(lineage.text).toContain("검증 완료가 아니라 모델의 pending claim");
    expect(lineage.text).toContain("evidence ID, pack/version, 검토 상태, claim_id는 생성하지 않습니다");
    expect(CURRENT_ITEM_LINEAGE_PROMPT_VERSION).toBe("item_lineage_attribution_v4_mission_v5_mpj5");
  });

  it("records the versioned effective-character pilot policy", () => {
    expect(PROMPT_SNAPSHOT.source_length_policy.version).toBe("effective_chars_v2_min_warning");
    expect(PROMPT_SNAPSHOT.source_length_policy.ranges.stt_interpreting.intermediate).toEqual({
      min: 40,
      max: 60,
    });
  });

  it("uses natural interpreting scenes and checks real-world plausibility", () => {
    for (const key of ["core.system.zh_ko", "core.user.spoken.zh_ko.response_act", "mission.system.spoken"]) {
      const text = prompt(key).text;
      expect(text).toContain("나/저는의 훈련 시점");
      expect(text).toContain("주어진 원문의 의미·의도·화용적 힘은 유지");
      expect(text).not.toContain('로 정확히 시작');
      expect(text).toContain("장면의 현실성·개연성");
    }
    expect(prompt("quality.system").text).toContain("implausible_scene");
    expect(prompt("core_quality.system.zh_ko").text).toContain("scene_plausibility");
    const repair = prompt("core.user.preceding_turn_repair").text;
    expect(repair).toContain("자연스러운 한국어 발화");
    expect(repair).toContain("중국어로 쓰지 마세요");
  });

  it("locks zh_ko translation across individual, outline, core, mission, quality, and feedback prompts", () => {
    const individual = prompt("legacy.individual.system.zh_ko").text;
    const outline = prompt("legacy.outline.system.zh_ko").text;
    const coreSystem = prompt("core.system.zh_ko").text;
    const coreUser = prompt("core.user.written.zh_ko").text;
    const mission = prompt("mission.system.zh_ko").text;
    const quality = prompt("quality.system.zh_ko").text;
    const coreQuality = prompt("core_quality.system.zh_ko").text;
    const feedback = prompt("feedback.system.zh_ko").text;
    const spokenLegacy = prompt("legacy.individual.system.zh_ko.spoken").text;
    const spokenCore = prompt("core.user.spoken.zh_ko").text;
    const spokenMission = prompt("mission.system.zh_ko.spoken").text;
    const spokenQuality = prompt("quality.system.zh_ko.spoken").text;
    const spokenFeedback = prompt("feedback.system.zh_ko.spoken").text;

    expect(individual).toContain("중→한 비즈니스 번역 교육용 시나리오");
    expect(individual).toContain("중국어(source) → 한국어(target)");
    expect(individual).toContain("자기 발신 상황의 화자");
    expect(individual).toContain("명제·화행·태도·화용적 힘을 보존");
    expect(individual).toContain("번역투");
    expect(individual).toContain("중국어 원문 형식의 간섭과 중→한 학습자의 전형적 오류");
    expect(individual).not.toContain("한국어(source) → 중국어(target)");

    expect(outline).toContain("중→한 비즈니스 번역 교육용 시나리오");
    expect(outline).toContain("지정 화행의 원문을 상대에게 보내려는 1인칭 발신 장면");

    expect(coreSystem).toContain("[중→한 방향 역할·원문 계약]");
    expect(coreSystem).toContain("주어진 중국어 발화를 한국어로 옮기는 훈련");
    expect(coreUser).toContain("중→한 원문 계약");
    expect(coreUser).toContain("다른 화행 사건이나 목적을 대신 만들지 마세요");

    expect(mission).toContain("[중→한 번역 정식 계약]");
    expect(mission).toContain("MPJ1~5와 DCT의 모든 source는 사용자 요청서의 지정 화행");
    expect(mission).toContain("중국어 원문의 **명제·화행 목적·태도·화용적 힘**을 보존");
    expect(mission).toContain("중국어 어순·주어 반복·명사화·직역 결합");
    expect(mission).toContain("더 길거나 더 격식적이거나 더 공손한 번역을 자동으로 상위 대역에 두지");
    expect(mission).toContain("scale4 → judge3 → fix_choice → reason → multi_judge");
    expect(mission).toContain("MJT1 X → MJT2 A → MJT3 A → MJT4 A → MJT5 Y → DCT C");

    expect(quality).toContain("중→한 번역 역할·등가 원칙");
    expect(quality).toContain("기존 gate1_violation·unnatural_language·internal_inconsistency·band_mismatch");
    expect(quality).toContain("중국어 어순·불필요한 주어 반복·명사화·직역 결합");
    expect(quality).toContain("존댓말 종결형·감사·사과·호칭·완화어");
    expect(quality).toContain("note_ko 문장을 한국어 correction 자체로 오인하지 마라");
    expect(coreQuality).toContain("자기 발신 상황의 화자");
    expect(coreQuality).toContain("다른 화행 사건으로 바뀌거나 보조 화행이 중심 목적을 대체");

    expect(feedback).toContain("[중→한 번역 피드백 경계]");
    expect(feedback).toContain("중국어 원문의 명제·참여자·화행 목적·명시된 태도");
    expect(feedback).toContain("불필요한 주어 반복, 명사화·직역 결합");
    expect(feedback).toContain("존댓말·감사·사과·완화 표현이 많거나 답이 길다는 이유만으로");
    expect(feedback).not.toContain("[통역 전사 경계]");

    expect(spokenLegacy).toContain("중→한 비즈니스 통역 교육용 시나리오");
    expect(spokenLegacy).toContain("중국어(source) → 한국어(target)");
    expect(spokenLegacy).toContain("나/저는의 훈련 시점");
    expect(spokenLegacy).toContain("한국어 후보 통역문");
    expect(spokenLegacy).not.toContain("자기 발신 상황의 화자");
    expect(spokenCore).toContain("나/저는의 훈련 시점");
    expect(spokenCore).toContain("주어진 원문의 의미·의도·화용적 힘은 유지");
    expect(spokenMission).toContain("나/저는의 훈련 시점");
    expect(spokenMission).not.toContain("[중→한 번역 정식 계약]");
    expect(spokenQuality).toContain("1인칭 훈련 시점이나 통역사 역할 설명의 생략은 결함이 아니다");
    expect(spokenQuality).not.toContain("중→한 번역 역할·등가 원칙");
    expect(spokenFeedback).toContain("[통역 전사 경계]");
    expect(spokenFeedback).not.toContain("[중→한 번역 피드백 경계]");
  });

  it("locks the R27 anchor topology and injects the fixed contrast plan", () => {
    expect(prompt("mission.system").text).toContain(
      "MJT2·3·4의 situation_ko는 Anchor A로 정확히 같아야",
    );
    const planned = prompt("mission.user.contrast_plan").text;
    expect(planned).toContain("[고정 contrast plan — 그대로 구현]");
    expect(planned).toContain('"mission_goal": "integrated_speech_act"');
    expect(planned).not.toContain("[직전 실패 출력");
    const edgeSource = readFileSync(resolve(process.cwd(), "supabase/functions/generate-scenario/index.ts"), "utf8");
    expect(edgeSource).toContain("targets.situationTargets.length === 0");
    expect(edgeSource).toContain("buildNativeMpj5SituationRepairPacket");
    expect(edgeSource).toContain("acceptedSituationReplacements");
  });

  it("records topology generation under the existing mission ledger operation", () => {
    const edgeSource = readFileSync(resolve(process.cwd(), "supabase/functions/generate-scenario/index.ts"), "utf8");
    const ledgerMigration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260825033000_mission_authoring_pipeline.sql"),
      "utf8",
    );

    expect(edgeSource).toContain("telemetryFor('mission_generate', true, {");
    expect(edgeSource).toContain("promptVersion: MISSION_TOPOLOGY_PROMPT_VERSION");
    expect(edgeSource).not.toContain("telemetryFor('mission_topology', true, {");
    expect(ledgerMigration).toContain("'mission_generate'");
  });

  it("locks the streamlined learner-facing MPJ contract", () => {
    const system = prompt("mission.system").text;
    expect(system).toContain("별도의 대역 판단이나 확신도는 묻지 않습니다");
    expect(system).toContain("정확히 4후보이며 **적정 대역 2개 + 조정 필요 대역 2개**");
    expect(system).toContain("comparison_role은 만들지 마세요");
    expect(system).toContain('"preceding_turn"은 null');
    expect(system).toContain("Scenario must be self-contained");
    expect(system).toContain("summarize that information naturally in the scenario instead of generating a separate preceding_turn");
    expect(system).toContain("거절은 무엇을 요청·제안받았는지");
    expect(system).toContain("정확히 2개의 짧은 문장");
    expect(system).toContain("수정안은 정확히 3개");
    expect(system).toContain("is_valid=true는 정확히 1개");
    expect(system).toContain("[MJT3·MJT5 서버 고정 candidate blueprint]");
    expect(system).toContain('"candidate_role": "recommended_repair"');
    expect(system).toContain('"candidate_role": "upper_boundary_adjustment"');
    expect(system).toContain("비현실적 극단화");
    expect(prompt("quality.system").text).toContain("situation_ko 안에 자연스럽게 요약되어 있고, preceding_turn은 null인지");
    expect(prompt("quality.system").text).toContain("대역 경계의 불확실성");
    expect(prompt("quality.system").text).toContain("학습자 통역사 C의 지위를");
  });

  it("matches the current Edge source", () => {
    const source = readFileSync(
      resolve(process.cwd(), PROMPT_SNAPSHOT.edge_source),
      "utf8",
    );
    const releaseSource = readFileSync(
      resolve(process.cwd(), "supabase/functions/_shared/contentRelease.ts"),
      "utf8",
    ).replace(/\r\n?/g, "\n");
    const canonicalSource = source.replace(/\r\n?/g, "\n");
    const sourceHash = createHash("sha256").update(canonicalSource).digest("hex");

    expect(PROMPT_SNAPSHOT.edge_source_sha256).toBe(sourceHash);
    expect(canonicalSource).toContain(
      "'scene_underspecified', 'implausible_scene', 'primary_reason_ambiguity', 'context_plan_mismatch'",
    );
    expect(canonicalSource).toContain("'diagnostic_coverage_mismatch'");
    for (const code of MISSION_DIAGNOSTIC_DIMENSIONS) {
      expect(canonicalSource).toContain(`'${code}'`);
    }
    expect(canonicalSource).toContain("CURRENT_MISSION_QUALITY_PROMPT_VERSION");
    expect(canonicalSource).toContain("corePrecedingTurnIssue(");
    expect(canonicalSource).toContain("preceding_turn_repair_applied: precedingTurnRepairApplied");
    expect(canonicalSource).toContain("learner_scene_repair_applied: learnerSceneRepairApplied");
    expect(canonicalSource).toContain("DIR_LANGS[coreDir].tgt");

    // 생성·안전 후보 판정이 공유하는 릴리스 매니페스트가 Edge 소스와 끊어지면
    // 서로 다른 세대의 코어·미션·피드백이 한 묶음으로 섞일 수 있다.
    expect(canonicalSource).toContain("CURRENT_CONTENT_RELEASE_ID");
    expect(canonicalSource).toContain("CURRENT_CORE_PROMPT_VERSIONS");
    expect(canonicalSource).toContain("CURRENT_MISSION_PROMPT_VERSIONS");
    expect(canonicalSource).toContain("CURRENT_FEEDBACK_PROMPT_VERSIONS");
    expect(releaseSource).toContain(`id: "${CURRENT_CONTENT_RELEASE_ID}"`);
    expect(releaseSource).toContain(`core: "${CURRENT_CORE_QUALITY_PROMPT_VERSION}"`);
    expect(releaseSource).toContain(`mission: "${CURRENT_MISSION_QUALITY_PROMPT_VERSION}"`);
    for (const version of [
      ...CURRENT_CORE_PROMPT_VERSIONS,
      ...CURRENT_MISSION_PROMPT_VERSIONS,
      ...CURRENT_FEEDBACK_PROMPT_VERSIONS,
    ]) {
      expect(releaseSource).toContain(`"${version}"`);
    }
    expect(canonicalSource).toContain("content_release_id: CURRENT_CONTENT_RELEASE_ID");
    expect(canonicalSource).toContain("mission_item_repair_v12_zhko_bidirectional");
    expect(canonicalSource).toContain("mission_candidate_band_v4_zhko_bidirectional");
    expect(canonicalSource).toContain("quality_candidate_band_v3_zhko_bidirectional");
    expect(canonicalSource).toContain("operations를 빈 배열로");
    expect(canonicalSource).toContain("replace_fix_choice_candidate");
    expect(canonicalSource).toContain("replace_multi_judge_candidate");
    expect(canonicalSource).toContain("blueprint-판정 일치");
    expect(canonicalSource).toContain("0-based 경로의 intended_band 정본");
    expect(canonicalSource).toContain("actionableRepairFindings");
    expect(canonicalSource).toContain("실패 후보별 최소 수리 packet");
    expect(canonicalSource).toContain("normalizedReplacement === normalizedOriginal");
    expect(canonicalSource).toContain("candidateRepairBoundaryRule");
    expect(canonicalSource).toContain("verified_within_anchor");
    expect(canonicalSource).toContain("critic_self_contradiction_calibrated");
    expect(canonicalSource).toContain("normalizedPeers.has(normalizedReplacement)");
    expect(canonicalSource).toContain("quality_relational_feedback_v3_directional_target");
    expect(canonicalSource).toContain("선택권 존중/의견 존중");
    expect(canonicalSource).toContain("MPJ5=mpj_items[4]");
    expect(canonicalSource).toContain("canRepairSituation");
    expect(canonicalSource).toContain('{"operation":"replace_item_block","item_index":4');
    expect(canonicalSource).toContain("SPEECH_ACT_R_MEANING_KO");
    expect(canonicalSource).toContain("상대에게 요구되는 노력·시간·자원과 요청 수행의 부담");
    expect(canonicalSource).toContain("잘못이 초래한 침해·피해의 심각도");
    expect(canonicalSource).toContain("제안 수용의 난이도와 사안의 중대성");
  });

  it("keeps written and spoken feedback on the same diagnostic rubric", () => {
    const written = prompt("feedback.system");
    const spoken = prompt("feedback.system.spoken");

    for (const entry of [written, spoken]) {
      expect(entry.text).toContain("목표 화용 자원의 변화 자체는 의미 손실이 아니다");
      expect(entry.text).toContain("이런 차이는 ③ 화용 층에서만 판정한다");
      expect(entry.text).toContain("특정 화행의 고정 정답이 아니라 경계 설명용");
      expect(entry.text).toContain("달라진 감사 강도는 ③ 화용에서 판정한다");
      expect(entry.text).not.toContain("격식을 무조건 올리라고 하지 마라");
      expect(entry.text).toContain("① 의미:");
      expect(entry.text).toContain("② 이해 가능성(문법):");
      expect(entry.text).toContain("③ 화용 인상:");
    }
    expect(written.text).toContain("학습자가 제출한 중국어 번역문");
    expect(written.text).not.toContain("[통역 전사 경계]");
    expect(spoken.text).toContain("학습자가 확인·수정한 중국어 통역 전사");
    expect(spoken.text).toContain("[통역 전사 경계]");
    expect(spoken.text).toContain("발음·성조·속도·휴지·유창성·음질을 추측하거나 평가하지 마라");
    expect(spoken.text).toContain("통역이라고 의미 판정 기준을 더 엄격하게 바꾸지 마라");
    for (const prompt of [written, spoken]) {
      expect(prompt.text).toContain("층 분리 교정 예시");
      expect(prompt.text).toContain('의미="preserved", 문법="clean"');
      expect(prompt.text).toContain('문법="impeding_errors"');
    }
  });

  it("binds the five hardened quality checks into generator and critic prompts", () => {
    const system = prompt("core.system.ko_zh");
    const written = prompt("core.user.written");
    const critic = prompt("core_quality.system");

    expect(system.text).toContain("[context_spec]의 역할 쌍·권리·의무·결정 권한");
    expect(system.text).toContain("화자 A와 상대 B");
    expect(system.text).toContain("주어진 원문의 의미·의도·화용적 힘은 유지");
    expect(system.text).toContain("서로 다른 종류의 구체적 단서");
    expect(system.text).toContain("장면 시드와 topic_code");
    expect(system.text).toContain("host_family, hotel, neighbor");
    expect(system.text).toContain("B의 preceding_turn에 명시된 하나의 명제 P");
    expect(system.text).toContain("즉시 늘리기");
    expect(system.text).toContain("거절은 A가 자신의 수락 여부를 결정");
    expect(written.text).toContain("산업 배경");
    expect(written.text).toContain("직무 기능: PROBE_FUNCTION");
    expect(written.text).toContain("직무 실현:");
    expect(written.text).toContain("[context_spec — 서버 고정 조건]");
    expect(written.text).toContain("행위자 고정: A=화자");
    expect(critic.text).toContain("industry");
    expect(critic.text).toContain("context_spec");
    expect(critic.text).toContain("situation_ko는 학습자에게 보이는 장면");
    expect(critic.text).toContain("평가 기준처럼 설명");
    expect(critic.text).toContain("referents");
    expect(critic.text).toContain("decision_authority");
    expect(critic.text).toContain("[축 — 16개 모두 빠짐없이 판정]");
    expect(critic.text).toContain("participant_roles");
    expect(critic.text).toContain("scene_source_alignment");
    expect(critic.text).toContain("learner_scene");
    expect(critic.text).toContain("산업 라벨 없이도 해당 분야를 추론");
    expect(critic.text).toContain("하나의 명제 P");
    expect(critic.text).toContain("즉시 확장하기");
    expect(written.text).toContain('"글로 남기지 않고 직접 말한다"');
    expect(prompt("core.user.spoken").text).toContain("이메일·메신저·글을 작성해 보내는");
    expect(prompt("core.system.zh_ko").text).toContain("중국어 종결부호(。！？)");
    expect(prompt("core.user.spoken").text).toContain("문장 경계:");
    expect(prompt("core.user.source_repair").text).toContain("직전 출력의 구조 오류");
    expect(prompt("core.user.source_repair").text).toContain("유효 글자 수를 반드시");
    expect(prompt("core.user.source_repair").text).toContain("인물·관계·상황·사실·화행 목적은 그대로 보존");
    expect(critic.text).toContain("국소적 두 턴만 본다");
    expect(CURRENT_CORE_PROMPT_VERSIONS).toContain("core_v16_natural_scene_plausibility");
  });
  it("locks propositional supportive moves to server-authorized facts", () => {
    const mission = prompt("mission.system");
    const feedback = prompt("feedback.system");
    const quality = prompt("quality.system");

    expect(mission.text).toContain("[사용 가능한 추가 사실]");
    expect(mission.text).toContain("사실 유무를 정답 단서로 만들지 마세요");
    expect(feedback.text).toContain("[허용된 추가 사실]");
    expect(quality.text).toContain("production_task.usable_facts");
  });

  it("locks new Full Missions to Scale4 → Judge3 → Fix → Reason → MultiJudge → DCT", () => {
    const mission = prompt("mission.system");
    const spoken = prompt("mission.system.spoken");
    const quality = prompt("quality.system");

    for (const entry of [mission, spoken]) {
      expect(entry.text).toContain("MPJ 5문항");
      expect(entry.text).toContain("첫인상 판단 → 맥락 대비 판단 → 판단하고 고쳐보기 → 이유 찾기 → 여러 초안 비교");
      expect(entry.text).toContain("scale4 → judge3 → fix_choice → reason → multi_judge");
      expect(entry.text).toContain("Judge3가 Anchor A를 만들고 FixChoice·Reason은 같은 상황을 공유");
      expect(entry.text).toContain("MJT1 X → MJT2 A → MJT3 A → MJT4 A → MJT5 Y → DCT C");
      expect(entry.text).toContain("MJT2·3·4의 situation_ko는 Anchor A로 정확히 같아야");
      expect(entry.text).not.toContain(`[장면 고유성] 5개 situation_ko는 서로 다른`);
      expect(entry.text).toContain("reason에는 accepted_band_codes·confidence를 만들지 마세요");
      expect(entry.text).toContain("정확히 4후보이며 **적정 대역 2개 + 조정 필요 대역 2개**");
      expect(entry.text).toContain("두 적정안은 같은 답의 재서술이 아니어야 합니다");
      expect(entry.text).toContain("구별되는 관계적 효과");
      expect(entry.text).toContain("[학습 피드백 4층]");
      expect(entry.text).toContain("현재 상황 단서 → 실제 표현 자원과 그 기능 → 관계적 효과 → 유지하거나 조정할 방향 하나");
      expect(entry.text).toContain("primary pragmatic delta 하나만");
      expect(entry.text).toContain("적정 전략 2와 다른 화용 자원·관계효과");
      expect(entry.text).toContain("실제 자원 1·기능 → 관계적 효과 1");
      expect(entry.text).toContain("현재 상황 단서 → 원래 target과 수정안의 핵심 표현 차이·기능");
      expect(entry.text).toContain("유일한 BEST/WORST나 엄밀한 선형 서열을 만들지 마세요");
      expect(entry.text).toContain("화용 판단 없이 즉시 소거되는");
      expect(entry.text).toContain("더 간접적·길거나 강한 표현을 자동으로 더 좋은 답으로 판정하지 마세요");
      expect(entry.text).toContain("primary의 위치와 id를 고정하지 말고");
      expect(entry.text).toContain("잠시 고민할 만큼 그럴듯해야 합니다");
      expect(entry.text).toContain("황당한 문법 금지 주장");
      expect(entry.text).toContain('위에 주입된 "깨야 할 소박한 규칙"');
      expect(entry.text).toContain("target feature의 정의와 관계·부담(P·D·R)에 상대적");
      expect(entry.text).not.toContain("직접형·간결형·강한 표현은 항상 나쁘다");
      expect(entry.text).not.toContain("감사의 경우 호의가 클수록");
      expect(entry.text).toContain('"type": "scale4"');
      expect(entry.text).toContain('"type": "judge3"');
      expect(entry.text).toContain('"reference_scale_code"');
      expect(entry.text).toContain('"diagnostic_dimensions"');
      expect(entry.text).toContain("미션 전체의 학습목표는 특정 feature 하나가 아니라");
      for (const code of MISSION_DIAGNOSTIC_DIMENSIONS) expect(entry.text).toContain(code);
      for (const ref of MISSION_DIAGNOSTIC_EVIDENCE_REFS) expect(entry.text).toContain(ref);
      expect(entry.text).not.toContain('"type": "reason_conf"');
    }
    expect(quality.text).toContain("공손표지 비가산 원칙");
    expect(quality.text).toContain("공손표지가 많다는 이유만으로 within_band");
    expect(prompt("mission.system.proposal").text).toContain(
      "구체적인 대안 둘을 명시하고 어느 쪽이 좋은지 묻는다면",
    );
    expect(prompt("mission.system.proposal").text).toContain("실제 too_directive 경계");
    expect(quality.text).toContain("MPJ 5문항");
    expect(quality.text).toContain("primary_reason_ambiguity");
    expect(quality.text).toContain("context_plan_mismatch");
    expect(quality.text).toContain("comparison_quality_mismatch");
    expect(quality.text).toContain("feedback_quality_mismatch");
    expect(quality.text).toContain("현재 상황 단서 →");
    expect(quality.text).toContain("자원과 관계적 효과를 note_ko에서 구별");
    expect(quality.text).toContain("심한 fail 하나를 찾았어도 나머지 검사를 중단하지 말고");
    expect(quality.text).toContain("적정 대역 2개·조정 필요 대역");
    expect(quality.text).toContain("유일한 BEST/WORST나 엄밀한 선형 서열도 요구하지 않는다");
    expect(quality.text).toContain("diagnostic_coverage_mismatch");
    expect(quality.text).toContain("결정론적 hard gate는 이미 통과했다");
    expect(quality.text).toContain("후보 길이 구간이 나뉘어도 그 사실만으로 fail하지 말고");
    expect(quality.text).toContain("fix_choice의 is_valid 의미");
    expect(quality.text).toContain("제안 초점 경계 감사");
    expect(quality.text).toContain("false는 \"문법적으로 틀림\"이나 \"완전히 부적절함\"이라는 뜻이 아니다");
    expect(quality.text).toContain("note_ko 문장을 중국어 correction 자체로 오인하지 마라");
    expect(quality.text).toContain("판단에 필요한 장면이");
    expect(quality.text).toContain("관찰 가능한 사실로 그려지는가");
    expect(quality.text).toContain("관계·접촉 이력");
    expect(quality.text).toContain("문장이 짧다는");
    expect(quality.text).toContain("이유만으로 보고하지 마라");
    expect(quality.text).not.toContain("①말하는 자리인지 적어 보내는 것인지");
    expect(quality.text).not.toContain("①~⑤ 중 **셋 이상이 불명확**");
  });

  it("keeps focal-less legacy core promotion on the four-item compatibility prompt", () => {
    const legacy = prompt("mission.system.legacy_v4");
    const legacyQuality = prompt("quality.system.legacy_v4");

    expect(legacy.text).toContain("MPJ 4문항");
    expect(legacy.text).toContain("scale4 → fix_choice → reason → multi_judge");
    expect(legacy.text).not.toContain('"type": "judge3"');
    expect(legacy.text).not.toContain('"diagnostic_dimensions"');
    expect(legacy.text).toContain("4문항 전부");
    expect(legacyQuality.text).toContain("legacy MPJ 4문항");
    expect(legacyQuality.text).toContain("fix_choice·reason은 DCT와 같은 앵커 PDR");
    expect(legacyQuality.text).not.toContain("diagnostic_coverage_mismatch");
    expect(legacyQuality.text).not.toContain("judge3·fix_choice·reason");
  });

  it("treats speech act as the learning goal and item_focus as an internal judgment tag", () => {
    const planned = prompt("mission.user.contrast_plan");

    expect(planned.text).toContain("[통합 화행 목표]");
    expect(planned.text).toContain("item_focus는 각 MPJ 판정의 내부 초점 태그");
    expect(planned.text).toContain('"item_type": "multi_judge"');
    expect(planned.text).toContain('"item_focus": "PROBE_FEATURE"');
  });

  it("uses first-person training scenes without changing source fidelity", () => {
    const written = prompt("mission.system");
    const spoken = prompt("mission.system.spoken");

    expect(written.text).toContain("학습자 1인칭의 정확히 2개의 짧은 문장");
    expect(written.text).toContain("학습자가 마주한 상대의 역할·관계만 한 줄");
    expect(written.text).toContain('화자(나)의 역할, "A → B" 구조');
    expect(spoken.text).toContain("나/저는의 훈련 시점");
    expect(spoken.text).not.toContain("학습자 통역사 C의 현재 장면");
    expect(spoken.text).toContain("내부 A/B 표기는 원문을 말한 사람과 그 말의 상대");
    expect(spoken.text).toContain("훈련 시점이 1인칭이어도 자유 발화 과제로 바꾸지 않는다");

    for (const entry of [prompt("core.system.ko_zh"), prompt("core.system.zh_ko")]) {
      expect(entry.text).toContain("학생용 장면 정보");
      expect(entry.text).toContain("매체 속성을 연구 설명처럼 풀어 쓰지 않는다");
      expect(entry.text).toContain("평가 기준을 설명하지");
      expect(entry.text).toContain("별도 '상대'·'관계' 태그로 나누지 않고 한 칩에 표시된다");
      expect(entry.text).not.toContain("발신자와 수신자의 관계 한 줄");
    }
  });
});
