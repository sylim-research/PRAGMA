// 프롬프트 스냅샷 생성기 — 배포되는 edge 소스에서 "모델에 실제로 가는 문장"을 뽑아
// src/lib/pragma/promptSnapshot.generated.ts 로 굳힌다. 관리자 화면은 이 파일만 읽는다.
//
// 왜 손으로 옮겨 적지 않는가:
//   손으로 복사한 문서는 코드가 바뀌는 순간 조용히 거짓이 된다(question-designer 전례).
//   그래서 npm run build 때마다(prebuild) 원본에서 자동 재생성한다 — 화면이 낡을 수 없다.
//
// 왜 값 자리에 센티넬을 쓰는가:
//   화행·수준·P/D/R는 호출마다 달라지는 입력이고, 이미 scenarios 행 컬럼에 저장된다.
//   여기서 보여줘야 하는 것은 '고정된 지시문'이므로 값 자리는 PROBE_* 로 표시한다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EDGE = "supabase/functions/generate-scenario/index.ts";
const OUT = resolve(ROOT, "src/lib/pragma/promptSnapshot.generated.ts");
const PACK_SOURCE = "src/lib/pragma/realizationPack.ts";
const PACK_OUT = resolve(ROOT, "src/lib/pragma/packReleaseManifest.generated.ts");
const MANIFEST_SCRIPT = "scripts/snapshot-prompts.mjs";
const MANIFEST_HELPER = "src/lib/pragma/packReleaseManifest.ts";

const src = readFileSync(resolve(ROOT, EDGE), "utf8");
const canonicalText = (text) => text.replace(/\r\n?/g, "\n");

// edge 소스를 그대로 실행해 빌더 함수를 얻는다(복사본이 아니라 원본이어야 의미가 있다).
globalThis.Deno = { serve: () => {}, env: { get: () => "SNAPSHOT" } };
const EXPOSE = `
;globalThis.__S = {
  buildSystemPrompt, buildOutlineSystemPrompt,
  buildCoreSystemPrompt, buildCoreUserPrompt, corePromptSnapshotHash, CORE_PROBE_BASE,
  buildCoreSourceRepairPrompt, buildCoreOutputRepairPrompt,
  buildMissionSystemPrompt, buildMissionUserPrompt, buildItemLineageSystemPrompt, buildFeedbackSystemPrompt, buildQualitySystemPrompt,
  buildCoreQualitySystemPrompt, CORE_SCENE_PREFLIGHT_PROMPT,
  buildAuthenticSystemPrompt,
  PRIMARY_MODEL, FALLBACK_MODEL, CORE_TEMPERATURE, CORE_RESPONSE_FORMAT,
  CORE_LENGTH_POLICY_VERSION, CORE_LENGTH_RANGES,
  PROVIDER,
  MISSION_PRIMARY: MISSION_PRIMARY_MODEL,
  MISSION_DEFAULT_TEMPERATURE: 0.3,
  MISSION_RETRY_TEMPERATURE: 0.5,
  MISSION_PROMPT_VERSION: CURRENT_MISSION_PROMPT_VERSIONS.join("|"),
  ITEM_LINEAGE_PROMPT_VERSION: CURRENT_ITEM_LINEAGE_PROMPT_VERSION,
};`;
// Edge가 _shared 모듈을 import해도 실행 가능하도록 로컬 의존성까지 한 번에 묶는다.
// EXPOSE를 진입 소스 안에 붙여야 번들 IIFE 내부 심볼을 안전하게 꺼낼 수 있다.
const executable = buildSync({
  stdin: {
    contents: src + EXPOSE,
    resolveDir: dirname(resolve(ROOT, EDGE)),
    sourcefile: "index.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  define: { "import.meta.main": "false" },
  format: "iife",
  target: "es2022",
}).outputFiles[0].text;
new Function("require", executable)(createRequire(import.meta.url));
const S = globalThis.__S;

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const git = (cmd, fallback) => {
  try { return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return fallback; }
};

// 미션 프롬프트는 화용 초점 카탈로그를 입력으로 받는다 — 지시문만 보이도록 센티넬을 넣는다.
const PROBE_FEATURE = {
  code: "PROBE_FEATURE", version: "PROBE_VER", learner_label: "PROBE_LABEL",
  operational_definition: "PROBE_DEFINITION",
  band_schema: [{ code: "PROBE_BAND_LOW", label_ko: "PROBE_BAND_LOW_KO" },
                { code: "within_band", label_ko: "PROBE_BAND_OK_KO" },
                { code: "PROBE_BAND_HIGH", label_ko: "PROBE_BAND_HIGH_KO" }],
  within_band_code: "within_band",
  relevant_resources: ["PROBE_RESOURCE"], excluded_confounds: ["PROBE_CONFOUND"],
  closing_principle_ko: "PROBE_CLOSING", counter_rule_note: "PROBE_COUNTER_RULE",
  lineage_scope: {
    coverage_status: "covered",
    realization_pack_id: "PROBE_PACK",
    realization_pack_version: "PROBE_PACK_VER",
    rules: [{ rule_id: "PROBE_RULE", label_ko: "PROBE_RULE_LABEL", evidence_ids: ["PROBE_EVIDENCE"] }],
    risks: [{ risk_id: "PROBE_RISK", description_ko: "PROBE_RISK_DESCRIPTION", evidence_ids: ["PROBE_EVIDENCE"] }],
    evidence: [{ evidence_id: "PROBE_EVIDENCE", claim_scope_ko: "PROBE_EVIDENCE_SCOPE" }],
  },
};
const PROBE_CONTRAST_PLAN = {
  version: "contrast_plan_v1",
  speech_act: "request",
  mission_goal: "integrated_speech_act",
  item_slots: ["scale4", "judge3", "fix_choice", "reason", "multi_judge"].map((item_type, index) => ({
    item_id: index + 1,
    item_type,
    item_focus: "PROBE_FEATURE",
    intended_band_profile: "PROBE_BAND_PROFILE",
  })),
};
const probeMissionBody = (direction, sourceModality, isResponseAct) => ({
  direction,
  speech_act: "request",
  speech_act_ko: "PROBE_SPEECH_ACT",
  level_ko: "PROBE_LEVEL",
  level_policy_ko: "PROBE_LEVEL_POLICY",
  feature: PROBE_FEATURE,
  core: {
    situation_ko: "PROBE_SITUATION",
    relation_ko: "PROBE_RELATION",
    source_text_ko: "PROBE_SOURCE_TEXT",
    preceding_turn_zh: isResponseAct ? "PROBE_PRECEDING_TURN" : null,
    pdr: { p: "equal", d: "acquaintance", r: "mid" },
    source_modality: sourceModality,
    focal_segments: [{ text: "PROBE_SOURCE_TEXT", role: "head" }],
  },
  error_pattern_hints_ko: ["PROBE_ERROR_HINT"],
  is_response_act: isResponseAct,
  contrast_plan: PROBE_CONTRAST_PLAN,
});

const entry = (key, label, group, note, text) => ({ key, label, group, note, sha256: sha(text), text });

const prompts = [
  entry("core.scene_preflight.system", "상황 시나리오 생성 · 장면 사전 검토", "core",
    "원문을 쓰기 전에 사건과 관계 조건(P·D·R)이 한 장면 안에서 함께 성립하는지 먼저 확인합니다.", S.CORE_SCENE_PREFLIGHT_PROMPT),
  entry("legacy.individual.system.zh_ko", "개별 생성 · 지시문 (중→한 번역)", "legacy",
    "기존 개별 생성 경로도 요청 언어방향과 자기 발신 번역 역할을 따른다.",
    S.buildSystemPrompt(3, "work", "zh_ko")),
  entry("legacy.individual.system.zh_ko.spoken", "개별 생성 · 지시문 (중→한 통역)", "legacy",
    "legacy 경로의 중국어 원발화와 한국어 통역안을 방향에 맞게 고정한다.",
    S.buildSystemPrompt(3, "work", "zh_ko", true)),
  entry("legacy.outline.system.zh_ko", "개요 생성 · 지시문 (중→한 번역)", "legacy",
    "개요 생성 단계에서 중→한 방향과 자기 발신 장면을 먼저 고정한다.",
    S.buildOutlineSystemPrompt(3, "work", "zh_ko")),
  entry("core.system.ko_zh", "상황 시나리오 생성 · 지시문 (한→중)", "core",
    "상황 설명과 원문만 생성합니다. 학습 문항은 다음 단계에서 따로 조립합니다.", S.buildCoreSystemPrompt("ko_zh")),
  entry("core.system.zh_ko", "상황 시나리오 생성 · 지시문 (중→한)", "core",
    "한→중과 같은 구조를 유지하고 원문 언어와 산출 언어만 바꿉니다.", S.buildCoreSystemPrompt("zh_ko")),
  entry("core.user.written", "상황 시나리오 생성 · 요청서 (번역)", "core",
    "화행·관계 조건·분야 등 편성 조건을 전달하는 요청서입니다. 조건값은 생성할 때마다 채워집니다.",
    S.buildCoreUserPrompt({
      ...S.CORE_PROBE_BASE,
      direction: "ko_zh",
      source_modality: "written",
      is_response_act: false,
      industry: "PROBE_INDUSTRY",
      func: "PROBE_FUNCTION",
    })),
  entry("core.user.written.zh_ko", "상황 시나리오 생성 · 요청서 (중→한 번역)", "core",
    "화자 본인이 말하는 중국어 원문과 목표 화행을 시나리오 단계에서 고정합니다.",
    S.buildCoreUserPrompt({
      ...S.CORE_PROBE_BASE,
      direction: "zh_ko",
      source_modality: "written",
      is_response_act: false,
    })),
  entry("core.user.spoken", "상황 시나리오 생성 · 요청서 (통역)", "core",
    "통역 장면에 맞게 입말 문체 조건을 더합니다.",
    S.buildCoreUserPrompt({ ...S.CORE_PROBE_BASE, direction: "ko_zh", source_modality: "spoken", is_response_act: false })),
  entry("core.user.spoken.zh_ko", "상황 시나리오 생성 · 요청서 (중→한 통역)", "core",
    "중국어 화자·한국어 청자·통역하는 학습자의 역할을 고정합니다.",
    S.buildCoreUserPrompt({ ...S.CORE_PROBE_BASE, direction: "zh_ko", source_modality: "spoken", is_response_act: false })),
  entry("core.user.spoken.zh_ko.response_act", "상황 시나리오 생성 · 요청서 (중→한 응답 통역)", "core",
    "중국어 화자와 한국어 화자가 주고받는 대화, 그리고 통역이 개입하는 지점을 고정합니다.",
    S.buildCoreUserPrompt({ ...S.CORE_PROBE_BASE, direction: "zh_ko", source_modality: "spoken", is_response_act: true })),
  entry("core.user.response_act", "상황 시나리오 생성 · 요청서 (응답 화행: 거절·반대 등)", "core",
    "응답 화행이 성립하도록 상대의 선행 발화를 반드시 함께 생성하게 합니다.",
    S.buildCoreUserPrompt({ ...S.CORE_PROBE_BASE, direction: "ko_zh", source_modality: "written", is_response_act: true })),
  entry("core.user.source_repair", "상황 시나리오 생성 · 원문 분량 자동 보정", "core",
    "원문 길이나 문장 수가 기준을 벗어나면 내용은 유지한 채 한 차례만 보정합니다.",
    S.buildCoreSourceRepairPrompt({
      originalUserPrompt: "PROBE_USER_PROMPT",
      previousOutput: { source_text: "PROBE_SOURCE_TEXT", focal_segments: [] },
      sourceLanguage: "zh",
      lengthHintKo: "유효 글자 30~45자",
      measuredSentenceCount: 1,
      measuredEffectiveCharCount: 999,
      effectiveCharRange: { min: 30, max: 45 },
    })),
  entry("core.user.preceding_turn_repair", "상황 시나리오 생성 · 선행 발화 언어 자동 보정", "core",
    "선행 발화가 지정한 언어로 작성되지 않았으면 내용과 역할은 유지한 채 한 차례만 보정합니다.",
    S.buildCoreOutputRepairPrompt({
      originalUserPrompt: "PROBE_USER_PROMPT",
      previousOutput: { source_text: "PROBE_SOURCE_TEXT", preceding_turn: "PROBE_PRECEDING_TURN", focal_segments: [] },
      sourceLanguage: "zh",
      lengthHintKo: "유효 글자 PROBE_MIN~PROBE_MAX자",
      effectiveCharRange: { min: 30, max: 45 },
      sourceIssue: null,
      precedingTurnIssue: { code: "wrong_language", expectedLanguage: "ko", message: "PROBE_PRECEDING_TURN_LANGUAGE_ERROR" },
    })),
  entry("core.user.bilingual_scene_repair", "상황 시나리오 생성 · 통역 장면 역할 자동 보정", "core",
    "통역 장면에서 화자·통역자·청자 역할이 겹치면 한 차례만 바로잡습니다.",
    S.buildCoreOutputRepairPrompt({
      originalUserPrompt: "PROBE_USER_PROMPT",
      previousOutput: { situation_ko: "PROBE_SITUATION", source_text: "PROBE_SOURCE_TEXT", preceding_turn: null, focal_segments: [] },
      sourceLanguage: "zh",
      lengthHintKo: "유효 글자 PROBE_MIN~PROBE_MAX자",
      effectiveCharRange: { min: 30, max: 45 },
      sourceIssue: null,
      precedingTurnIssue: null,
      bilingualSceneIssue: { sourceLanguage: "zh", targetLanguage: "ko", missing: ["source_speaker", "target_speaker", "interpreting"], message: "PROBE_BILINGUAL_SCENE_ERROR" },
    })),
  entry("mission.system", "학습 미션 조립 · 지시문 (번역)", "mission",
    "검수된 상황 시나리오 하나를 MJT 5문항과 DCT 1문항으로 이루어진 학습 미션으로 조립합니다.",
    S.buildMissionSystemPrompt(PROBE_FEATURE, false, false, "ko_zh")),
  entry("mission.system.zh_ko", "학습 미션 조립 · 지시문 (중→한 번역)", "mission",
    "중국어 원문의 조건을 지키면서 자연스러운 한국어 관계 표현을 판단하도록 문항을 구성합니다.",
    S.buildMissionSystemPrompt(PROBE_FEATURE, false, false, "zh_ko")),
  entry("mission.system.zh_ko.spoken", "학습 미션 조립 · 지시문 (중→한 통역)", "mission",
    "중국어 발화가 한국어 통역에서도 같은 화용 기능을 하도록 화자·청자·통역자 역할을 고정합니다.",
    S.buildMissionSystemPrompt(PROBE_FEATURE, false, true, "zh_ko")),
  entry("mission.system.proposal", "학습 미션 조립 · 제안 화행 판단 기준", "mission",
    "상대에게 남기는 선택의 여지와 방안의 구체성을 기준으로 적정·부족·과함의 경계를 정합니다.",
    S.buildMissionSystemPrompt({ ...PROBE_FEATURE, code: "proposal_optionality_clarity" }, false, false, "ko_zh")),
  entry("mission.system.spoken", "학습 미션 조립 · 지시문 (통역)", "mission",
    "말로 산출하는 통역 미션에 맞게 문항을 구성합니다.", S.buildMissionSystemPrompt(PROBE_FEATURE, false, true, "ko_zh")),
  entry("mission.system.legacy_v4", "학습 미션 조립 · 4문항 MJT 지시문 (초기 형식)", "mission",
    "초기 4문항 형식으로 만든 미션을 계속 열람하고 보완할 수 있도록 유지하는 지시문입니다.",
    S.buildMissionSystemPrompt(PROBE_FEATURE, false, false, "ko_zh", false)),
  entry("mission.user.contrast_plan", "학습 미션 조립 · 문항 설계 계획 요청서", "mission",
    "문항을 쓰기 전에 화행 목표와 다섯 문항이 각각 판단할 초점을 먼저 정합니다.",
    S.buildMissionUserPrompt(probeMissionBody("ko_zh", "spoken", false))),
  entry("mission.item_lineage.system", "학습 미션 조립 · 문항별 근거 연결", "review",
    "완성된 문항을 관련 규칙·위험 항목과 연결해 근거를 남깁니다. 승인 여부에는 관여하지 않습니다.",
    S.buildItemLineageSystemPrompt(PROBE_FEATURE.lineage_scope)),
  entry("core.user.learner_scene_repair", "상황 시나리오 생성 · 정답 단서 제거", "core",
    "상황 사실은 유지하고, 정중성·완화 표지처럼 답의 방향을 미리 알려 주는 단서만 지웁니다.",
    S.buildCoreOutputRepairPrompt({
      originalUserPrompt: "PROBE_USER_PROMPT",
      previousOutput: { situation_ko: "PROBE_SITUATION_WITH_EVALUATION_CUE", source_text: "PROBE_SOURCE_TEXT", preceding_turn: null, focal_segments: [] },
      sourceLanguage: "zh",
      lengthHintKo: "유효 글자 PROBE_MIN~PROBE_MAX자",
      effectiveCharRange: { min: 30, max: 45 },
      sourceIssue: null,
      precedingTurnIssue: null,
      bilingualSceneIssue: null,
      learnerSceneIssue: { code: "evaluation_criteria", message: "PROBE_LEARNER_SCENE_EVALUATION_ERROR" },
    })),
  entry("quality.system", "AI 검토 · 지시문", "review",
    "생성 모델과 분리된 검토 모델이 완성된 학습 미션을 검토합니다.",
    S.buildQualitySystemPrompt("ko_zh", "PROBE_ACT")),
  entry("quality.system.zh_ko", "AI 검토 · 지시문 (중→한 번역)", "review",
    "중→한 번역 미션의 화행·등가·한국어 자연성을 정해진 기준 코드에 따라 검토합니다.",
    S.buildQualitySystemPrompt("zh_ko", "PROBE_ACT", true, false)),
  entry("quality.system.zh_ko.spoken", "AI 검토 · 지시문 (중→한 통역)", "review",
    "중→한 통역 미션의 화자·청자·통역자 역할과 한국어 등가 표현을 검토합니다.",
    S.buildQualitySystemPrompt("zh_ko", "PROBE_ACT", true, true)),
  entry("quality.system.legacy_v4", "AI 검토 · 4문항 MJT 지시문 (초기 형식)", "review",
    "초기 4문항 형식 미션을 문항 구성은 그대로 둔 채 검토합니다.",
    S.buildQualitySystemPrompt("ko_zh", "PROBE_ACT", false)),
  entry("core_quality.system", "상황 시나리오 조건 검토 · 지시문", "review",
    "화행·관계 조건·분야·번역/통역 구분·역할이 요청대로 생성되었는지 생성과 분리된 모델이 확인합니다.",
    S.buildCoreQualitySystemPrompt("ko_zh")),
  entry("core_quality.system.zh_ko", "상황 시나리오 조건 검토 · 지시문 (중→한 번역)", "review",
    "중→한 번역 시나리오의 원문이 화자 본인의 말인지, 목표 화행과 일치하는지 확인합니다.",
    S.buildCoreQualitySystemPrompt("zh_ko")),
  entry("feedback.system", "학습자 피드백 · 지시문 (번역)", "runtime",
    "학습자 답안 하나를 의미·문법·화용 세 층위로 진단합니다. 점수는 매기지 않습니다.",
    S.buildFeedbackSystemPrompt("ko_zh", false)),
  entry("feedback.system.zh_ko", "학습자 피드백 · 지시문 (중→한 번역)", "runtime",
    "중국어 원문의 의미를 지켰는지와 한국어 관계 표현이 자연스러운지를 나누어 진단합니다.",
    S.buildFeedbackSystemPrompt("zh_ko", false)),
  entry("feedback.system.zh_ko.spoken", "학습자 피드백 · 지시문 (중→한 통역)", "runtime",
    "중→한 통역 답안을 의미·화용 기준으로 진단합니다.",
    S.buildFeedbackSystemPrompt("zh_ko", true)),
  entry("feedback.system.spoken", "학습자 피드백 · 지시문 (통역)", "runtime",
    "말로 산출한 통역 답안을 진단합니다.", S.buildFeedbackSystemPrompt("ko_zh", true)),
  entry("authentic.system", "실제 자료 분석 · 지시문", "authoring",
    "관리자가 입력한 실제 중국어·한국어 자료에서 화용 학습에 활용할 후보를 제안합니다.",
    S.buildAuthenticSystemPrompt()),
];

const coreSurfaceHash = await S.corePromptSnapshotHash();
const snapshot = {
  // tracked snapshot은 같은 commit에서 재생성해도 byte-identical해야 한다.
  // 벽시계가 아니라 source commit 시각을 사용한다.
  generated_at: git("git show -s --format=%cI HEAD", new Date(0).toISOString()),
  git_commit: git("git rev-parse --short HEAD", "unknown"),
  git_dirty: git("git status --porcelain -- " + EDGE, "") !== "",
  edge_source: EDGE,
  edge_source_sha256: sha(canonicalText(src)),
  core_surface_hash: coreSurfaceHash,
  generation_config: {
    model: S.PRIMARY_MODEL, model_fallback: S.FALLBACK_MODEL,
    temperature: S.CORE_TEMPERATURE, response_format: S.CORE_RESPONSE_FORMAT,
  },
  source_length_policy: {
    version: S.CORE_LENGTH_POLICY_VERSION,
    unit: "effective_chars",
    ranges: S.CORE_LENGTH_RANGES,
  },
  prompts,
};

// Realization Pack은 DB manifest에 사람이 임의 해시를 입력하지 않도록 별도 release
// draft를 생성한다. 해시 표면·정규화 규약은 브라우저 검증 코드와 같은 모듈을 실행한다.
const packSrc = readFileSync(resolve(ROOT, PACK_SOURCE), "utf8");
const packExecutable = buildSync({
  stdin: {
    contents: `
      import { KO_ZH_CORE_REALIZATION_PACK } from "../src/lib/pragma/realizationPack.ts";
      import {
        PACK_CANONICALIZATION_VERSION,
        buildPackArtifactSurface,
        buildPackEvidenceSurface,
        canonicalJson,
      } from "../src/lib/pragma/packReleaseManifest.ts";
      globalThis.__PRAGMA_PACK_HELPERS = {
        pack: KO_ZH_CORE_REALIZATION_PACK,
        PACK_CANONICALIZATION_VERSION,
        buildPackArtifactSurface,
        buildPackEvidenceSurface,
        canonicalJson,
      };
    `,
    resolveDir: dirname(resolve(ROOT, MANIFEST_SCRIPT)),
    sourcefile: "pack-manifest-entry.ts",
    loader: "ts",
  },
  absWorkingDir: ROOT,
  bundle: true,
  write: false,
  platform: "neutral",
  format: "iife",
  target: "es2022",
}).outputFiles[0].text;
(0, eval)(packExecutable);
const H = globalThis.__PRAGMA_PACK_HELPERS;
const pack = H.pack;

// pack 자체는 별도 artifact/evidence hash가 포착한다. 이 표면은 pack을 실제로
// 소비하는 mission prompt template와 실행 계약만 고정한다.
const missionSystemVariants = [];
const missionUserVariants = [];
for (const direction of ["ko_zh", "zh_ko"]) {
  for (const isResponseAct of [false, true]) {
    for (const isSpoken of [false, true]) {
      const variant = `${direction}:${isResponseAct ? "response" : "initiative"}:${isSpoken ? "spoken" : "written"}`;
      missionSystemVariants.push({
        variant,
        prompt: S.buildMissionSystemPrompt(PROBE_FEATURE, isResponseAct, isSpoken, direction),
      });
      missionUserVariants.push({
        variant,
        prompt: S.buildMissionUserPrompt(probeMissionBody(direction, isSpoken ? "spoken" : "written", isResponseAct)),
      });
    }
  }
}
const packPromptSurface = {
  canonicalization_version: H.PACK_CANONICALIZATION_VERSION,
  surface_schema_version: "pragma_pack_prompt_surface_v2",
  mission: {
    provider: S.PROVIDER,
    primary_model: S.MISSION_PRIMARY,
    fallback_model: S.PRIMARY_MODEL,
    prompt_version: S.MISSION_PROMPT_VERSION,
    default_temperature: S.MISSION_DEFAULT_TEMPERATURE,
    retry_temperature: S.MISSION_RETRY_TEMPERATURE,
    response_format: { type: "json_object" },
    system_variants: missionSystemVariants,
    user_variants: missionUserVariants,
  },
  item_lineage: {
    provider: S.PROVIDER,
    primary_model: S.PRIMARY_MODEL,
    fallback_model: S.FALLBACK_MODEL,
    prompt_version: S.ITEM_LINEAGE_PROMPT_VERSION,
    temperature: 0,
    maximum_batch_size: 5,
    system_prompt: S.buildItemLineageSystemPrompt(PROBE_FEATURE.lineage_scope),
  },
};
const packPromptSurfaceHash = sha(H.canonicalJson(packPromptSurface));
snapshot.pack_prompt_surface_hash = packPromptSurfaceHash;
const packTrackedDirty = git(
  `git status --porcelain -- "${PACK_SOURCE}" "${EDGE}" "${MANIFEST_SCRIPT}" "${MANIFEST_HELPER}"`,
  "",
) !== "";
const packManifest = {
  schema_version: "pragma_pack_release_manifest_draft_v1",
  canonicalization_version: H.PACK_CANONICALIZATION_VERSION,
  pack_id: pack.pack_id,
  pack_version: pack.version,
  scope_speech_acts: pack.scope.speech_acts,
  artifact_hash: sha(H.canonicalJson(H.buildPackArtifactSurface(pack))),
  prompt_snapshot_hash: packPromptSurfaceHash,
  evidence_snapshot_hash: sha(H.canonicalJson(H.buildPackEvidenceSurface(pack))),
  source_commit_ref: git("git rev-parse HEAD", "unknown"),
  git_dirty: packTrackedDirty,
  source_paths: [PACK_SOURCE, EDGE, MANIFEST_SCRIPT, MANIFEST_HELPER],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `// 자동 생성 파일 — 직접 수정하지 마세요.
// 생성: npm run prompts:snapshot (build 시 자동 실행)
// 출처: ${EDGE}
//
// 이 파일은 '저장소 정본'이다. 배포본과 같은지는 core_surface_hash를
// 배포 응답 meta.prompt_snapshot_hash / DB scenarios.prompt_snapshot_hash와
// 대조해서 확인한다(관리자 화면이 자동으로 대조한다).
export type PromptSnapshotEntry = {
  key: string; label: string; group: string; note: string; sha256: string; text: string;
};
export type PromptSnapshot = {
  generated_at: string; git_commit: string; git_dirty: boolean;
  edge_source: string; edge_source_sha256: string; core_surface_hash: string; pack_prompt_surface_hash: string;
  generation_config: { model: string; model_fallback: string; temperature: number; response_format: string };
  source_length_policy: { version: string; unit: "effective_chars"; ranges: Record<string, Record<string, { min: number; max: number }>> };
  prompts: PromptSnapshotEntry[];
};
export const PROMPT_SNAPSHOT: PromptSnapshot = ${JSON.stringify(snapshot, null, 2)} as const;
`, "utf8");

writeFileSync(PACK_OUT, `// 자동 생성 파일 — 직접 수정하지 마세요.
// 생성: npm run prompts:snapshot (build 시 자동 실행)
// 정본: ${PACK_SOURCE} + ${EDGE}
export type PackReleaseManifestDraft = {
  schema_version: "pragma_pack_release_manifest_draft_v1";
  canonicalization_version: "pragma_canonical_json_v1";
  pack_id: string;
  pack_version: string;
  scope_speech_acts: string[];
  artifact_hash: string;
  prompt_snapshot_hash: string;
  evidence_snapshot_hash: string;
  source_commit_ref: string;
  git_dirty: boolean;
  source_paths: string[];
};
export const PACK_RELEASE_MANIFEST_DRAFT: PackReleaseManifestDraft = ${JSON.stringify(packManifest, null, 2)} as const;
`, "utf8");

console.log(`prompt snapshot: ${prompts.length}종 · core_surface_hash=${coreSurfaceHash.slice(0, 12)}… · pack=${pack.pack_id}@${pack.version} ${packManifest.artifact_hash.slice(0, 12)}… · commit=${snapshot.git_commit}${snapshot.git_dirty || packTrackedDirty ? " (미커밋 변경 있음)" : ""}`);
