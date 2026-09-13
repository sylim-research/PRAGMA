// mission_v5 9화행 대표 표본 하네스 — 인간 검수용. 수동 실행 전용.
//   RUN_V5_SAMPLES=1 npx vitest run src/lib/pragma/missionV5Samples.gen.test.ts
//
// ACTIVE_HANDOFF 크리티컬 패스 2단계: 9화행 대표 mission_v5 표본을 소량 생성해
// 자연스러움·MPJ 변별력·P·D·R 일치·의미→문법→화용 층 분리를 사람이 검수한다.
//
// 셀 조합은 임의로 짜지 않고 500 배치 플래너(buildBatchPlan)에서 뽑는다 —
// 표본이 본 배치와 다른 조합 규칙을 쓰면 검수 결과를 본 배치에 적용할 수 없다.
// 요청 본문은 promoteMission·coreBatchRun과 같은 헬퍼를 쓴다.
//
// DB 저장 없음(save_generated_* RPC는 is_admin 가드). 실제 OpenAI 호출이라 비용이 든다.

import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildBatchPlan, type BatchCell } from "@/lib/pragma/batchPlan";
import {
  buildContentCanaryPlan,
  buildInterpreterRoleCanaryPlan,
} from "@/lib/pragma/contentCanaryPlan";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";
import { TARGET_FEATURES, DEFAULT_FEATURE_BY_ACT } from "@/lib/pragma/targetFeatures";
import { errorPatternsForAct } from "@/lib/pragma/errorPatterns";
import { LEVEL_POLICY, featureForGen } from "@/lib/pragma/promoteMission";
import { normalizeCore } from "@/lib/pragma/coreSchema";
import {
  PDR_POWER_ENUM_TO_JSON,
  PDR_DISTANCE_ENUM_TO_JSON,
} from "@/lib/pragma/coreSchema";
import {
  checkCore,
  checkMission,
  coreLengthHintKo,
  type CheckContext,
} from "@/lib/pragma/missionRules";
import { DOMAIN, LEVEL, SPEECH_ACT_UI, type GenMode } from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";

const RUN = process.env.RUN_V5_SAMPLES === "1";
/** 저장된 표본으로 R규칙만 재검사 — 생성 호출 0회. 규칙 수정의 회귀 확인용. */
const RECHECK = process.env.RUN_V5_RECHECK === "1";
/**
 * 보충 표본 — 기존 v5-samples.json을 갱신한다.
 * ① fail이었던 초대·불만을 같은 셀로 재생성(개별 콘텐츠 문제인지 확인)
 * ② 고P 셀(상대가 위) 표본 추가 — 기존 9건이 전부 첫 구인 셀(대등·지인·중부담)이라
 *    고P 편향(계약 0-t, Yu 1999)을 검수할 수 없었다. 셀은 같은 플래너의 두 번째
 *    구인 셀(higher·acquaintance·high)에서 뽑는다.
 */
const SUPPLEMENT = process.env.RUN_V5_SUPPLEMENT === "1";
/** refresh 전 두 방향·두 모드 대표 6셀을 생성하는 릴리스 canary. DB 저장 없음. */
const CANARY = process.env.RUN_CONTENT_CANARY === "1";
/** 역할 계약 배포 뒤 9화행×양방향 통역 코어 18건. DB 콘텐츠 저장 없음. */
const INTERPRETER_ROLE_CANARY = process.env.RUN_INTERPRETER_ROLE_CANARY === "1";
/** 코어 안정성 게이트만 측정한다. 미션 호출을 섞지 않아 실패 층과 비용을 분리한다. */
const CANARY_CORE_ONLY = process.env.CONTENT_CANARY_CORE_ONLY === "1";
/** 이전 카나리의 통과 코어를 고정해 미션 프롬프트 변경만 비교할 때 사용한다. */
const CANARY_CORE_FIXTURE = process.env.CONTENT_CANARY_CORE_FIXTURE?.trim();

const OUT_DIR = process.env.V5_SAMPLE_OUT ?? "tmp/v5-samples";

function readEnv(): { url: string; key: string } {
  const raw = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  const get = (k: string) => raw.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? "";
  return { url: get("VITE_SUPABASE_URL"), key: get("VITE_SUPABASE_PUBLISHABLE_KEY") };
}

const modalityOf = (mode: GenMode) => (mode === "stt_interpreting" ? "spoken" : "written");
const legacyChannelOf = (mode: GenMode) => (mode === "stt_interpreting" ? "facetoface" : "messenger");
const isResponseAct = (act: string) => act === "refusal" || act === "opposition";

interface SampleResult {
  act: string;
  actKo: string;
  cell: BatchCell;
  featureCode: string;
  core?: unknown;
  coreMeta?: unknown;
  coreResult?: string;
  coreViolations: { id: string; level: string; message: string }[];
  mission?: unknown;
  missionResult?: string;
  missionViolations: { id: string; level: string; message: string }[];
  attempts: number;
  error?: string;
  /** 보충 표본 구분 — "high_p" = 고P 셀 추가분, "regen" = fail 셀 재생성분. */
  variant?: "high_p" | "regen";
}

/** 코어→미션 생성 러너 — RUN·SUPPLEMENT 블록이 공유한다. 요청 본문은 실제 경로와 동일. */
function createRunner(url: string, key: string, options: { coreOnly?: boolean } = {}) {
  const fnUrl = `${url}/functions/v1/generate-scenario`;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // OpenAI 조직 TPM 상한(gpt-4o 30k)에 걸리면 엣지가 502로 되돌린다.
  // 표본 생성은 소량이므로 순차 실행 + 지수 대기로 흡수한다.
  async function invoke(body: unknown, label = ""): Promise<Record<string, unknown>> {
    let lastErr = "";
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (res.ok) {
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error(`edge 응답이 객체가 아닙니다: ${text.slice(0, 300)}`);
        }
        return parsed as Record<string, unknown>;
      }
      lastErr = `edge ${res.status}: ${text.slice(0, 300)}`;
      if (!/rate limit/i.test(text)) throw new Error(lastErr);
      const waitMs = 15_000 * attempt;
      console.log(`  ${label} rate limit — ${waitMs / 1000}s 대기 후 재시도 ${attempt}/5`);
      await sleep(waitMs);
    }
    throw new Error(`rate limit 재시도 소진 — ${lastErr}`);
  }

  return async function runCell(
    cell: BatchCell,
    variant?: SampleResult["variant"],
    coreFixture?: unknown,
  ): Promise<SampleResult> {
    const act = cell.speech_act_ui;
    const featureCode = DEFAULT_FEATURE_BY_ACT[act];
    const feature = TARGET_FEATURES[featureCode];
    const mode = cell.mode;
    const out: SampleResult = {
      act,
      actKo: variant === "high_p" ? `${SPEECH_ACT_UI[act]}·고P` : SPEECH_ACT_UI[act],
      cell,
      featureCode,
      coreViolations: [],
      missionViolations: [],
      attempts: 0,
      ...(variant ? { variant } : {}),
    };

    const ctx: CheckContext = {
      speech_act: act,
      level: cell.level,
      domain: cell.domain,
      theme_code: cell.theme_code as ThemeCode,
      topic_code: cell.topic_code,
      industry: cell.industry,
      mode,
      source_modality: modalityOf(mode),
      direction: cell.direction,
      require_context_spec: true,
    };

    try {
      // ── 1. 코어 생성 (coreBatchRun과 같은 본문) ──
      const coreResponse = coreFixture ? undefined : await invoke({
          action: "core",
          core: {
            direction: cell.direction,
            speech_act: act,
            speech_act_ko: SPEECH_ACT_UI[act],
            level_ko: LEVEL[cell.level],
            domain: cell.domain,
            domain_ko: DOMAIN[cell.domain],
            industry: cell.industry,
            topic_code: cell.topic_code,
            mode,
            channel: legacyChannelOf(mode),
            channel_ko: mode === "stt_interpreting" ? "구두(통역)" : "서면(번역)",
            pdr: {
              p: PDR_POWER_ENUM_TO_JSON[cell.pdr_power],
              d: PDR_DISTANCE_ENUM_TO_JSON[cell.pdr_distance],
              r: cell.pdr_burden,
            },
            source_modality: modalityOf(mode),
            situation_seed_ko: cell.situation_seed_ko,
            is_response_act: isResponseAct(act),
            length_hint_ko: coreLengthHintKo(cell.level, mode),
          },
        }, `[${out.actKo} core]`);
      const core = coreFixture ?? coreResponse?.core_content;
      if (coreResponse?.meta) out.coreMeta = coreResponse.meta;
      out.core = core;
      const coreCheck = checkCore(core, ctx);
      out.coreResult = coreCheck.result;
      out.coreViolations = coreCheck.violations.map((v) => ({
        id: v.id,
        level: v.level,
        message: v.message,
      }));

      // 실제 배치(coreBatchRun)는 fail 코어를 저장하지 않으므로 미션 승격도 없다.
      // fail 코어 위에 미션을 만들면 본 배치에 존재할 수 없는 모집단이 검수에 섞인다.
      if (coreCheck.result === "fail") {
        out.error = "코어 R검사 fail — 본 배치 경로대로 미션 승격 생략(코어 재생성 필요)";
        return out;
      }
      if (options.coreOnly ?? CANARY_CORE_ONLY) return out;

      // ── 2. 미션 승격 (promoteMission과 같은 본문·재시도 정책) ──
      const nc = normalizeCore(core ?? {});
      const normCore = nc.ok ? nc.data : undefined;
      const missionCore = {
        situation_ko: normCore?.situation_ko,
        relation_ko: normCore?.relation_ko,
        source_text_ko: normCore?.source_text,
        preceding_turn_zh: normCore?.preceding_turn ?? null,
        pdr: normCore?.pdr,
        channel: normCore?.channel,
        source_modality: modalityOf(mode),
        usable_facts: normCore?.usable_facts ?? [],
        ...(normCore?.focal_segments?.length
          ? { focal_segments: normCore.focal_segments }
          : {}),
      };

      let failureNotes: string | undefined;
      let previousMission: unknown;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        out.attempts = attempt;
        const mRes = await invoke({
          action: "mission",
          mission: {
            direction: cell.direction,
            speech_act_ko: SPEECH_ACT_UI[act],
            level_ko: LEVEL[cell.level],
            level_policy_ko: LEVEL_POLICY[cell.level],
            feature: featureForGen(feature, cell.direction),
            core: missionCore,
            error_pattern_hints_ko: errorPatternsForAct(act, cell.direction).map(
              (p) => `${p.description} (예: ${p.approvedExample})`,
            ),
            is_response_act: isResponseAct(act),
            failure_notes: failureNotes,
            previous_mission: failureNotes ? previousMission : undefined,
          },
        }, `[${out.actKo} mission ${attempt}]`);
        const mission = mRes.mission_content;
        out.mission = mission;
        const missionCheck = checkMission(mission, { ...ctx, planned_target_feature: feature.code }, core);
        out.missionResult = missionCheck.result;
        out.missionViolations = missionCheck.violations.map((v) => ({
          id: v.id,
          level: v.level,
          message: v.message,
        }));
        if (missionCheck.result !== "fail") break;
        previousMission = mission;
        failureNotes = missionCheck.violations
          .filter((v) => v.level === "fail")
          .map((v) => `- ${v.id}: ${v.message}`)
          .join("\n");
      }
    } catch (e) {
      out.error = e instanceof Error ? e.message : String(e);
    }
    console.log(
      `[${out.actKo}] 코어 ${out.coreResult ?? "-"} / 미션 ${out.missionResult ?? "-"} ` +
        `(시도 ${out.attempts})${out.error ? " ERROR: " + out.error : ""}`,
    );
    return out;
  };
}

describe.skipIf(!RECHECK)("저장된 v5 표본 R규칙 재검사", () => {
  it("생성 호출 없이 checkCore·checkMission만 다시 돌린다", () => {
    const rows: SampleResult[] = JSON.parse(
      readFileSync(resolve(OUT_DIR, "v5-samples.json"), "utf8"),
    );
    for (const r of rows) {
      if (!r.mission) {
        console.log(`[${r.actKo}] 미션 응답 없음(생성 실패) — 재검사 불가`);
        continue;
      }
      const cell = r.cell;
      const feature = TARGET_FEATURES[r.featureCode];
      const ctx: CheckContext = {
        speech_act: cell.speech_act_ui,
        level: cell.level,
        domain: cell.domain,
        theme_code: cell.theme_code as ThemeCode,
        topic_code: cell.topic_code,
        industry: cell.industry,
        mode: cell.mode,
        source_modality: modalityOf(cell.mode),
        direction: cell.direction,
        planned_target_feature: feature.code,
      };
      const check = checkMission(r.mission, ctx, r.core);
      const fails = check.violations.filter((x) => x.level === "fail");
      const warns = check.violations.filter((x) => x.level === "warning");
      console.log(
        `[${r.actKo}] ${check.result} — fail ${fails.length} / warning ${warns.length}` +
          (fails.length ? "\n" + fails.map((x) => `    FAIL ${x.id}: ${x.message}`).join("\n") : "") +
          (warns.length ? "\n" + warns.map((x) => `    warn ${x.id}: ${x.message}`).join("\n") : ""),
      );
    }
  });
});

describe.skipIf(!RUN)("mission_v5 9화행 대표 표본", () => {
  it(
    "9화행 × 중급 × 번역 표본 생성 → R규칙 검사 → 검수 파일",
    async () => {
      const { url, key } = readEnv();
      const runCell = createRunner(url, key);

      // 화행당 번역 1건. interpretingCount의 바닥(≥1) 때문에 통역 셀도 생기므로 걸러낸다.
      const cells = buildBatchPlan(
        {
          perLevel: { beginner_intermediate: 0, intermediate: 1, advanced: 0 },
          interpretingRatio: 0,
        },
        "ko_zh",
      ).filter((c) => c.mode === "translation");

      const results: SampleResult[] = [];

      // 순차 실행 — 조직 TPM 상한(gpt-4o 30k) 때문에 병렬로 돌리면 미션 호출이 502로 죽는다.
      for (const cell of cells) {
        results.push(await runCell(cell));
      }

      results.sort((a, b) => a.act.localeCompare(b.act));

      mkdirSync(OUT_DIR, { recursive: true });
      const jsonPath = resolve(OUT_DIR, "v5-samples.json");
      writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");
      console.log(`\n표본 JSON: ${jsonPath}`);
      console.log(
        "요약: " +
          results
            .map((r) => `${r.actKo} 코어 ${r.coreResult ?? "ERR"}/미션 ${r.missionResult ?? "ERR"}`)
            .join(" · "),
      );
    },
    1_800_000,
  );
});

describe.skipIf(!SUPPLEMENT)("v5 보충 표본 — fail 셀 재생성 + 고P 추가", () => {
  it(
    "초대·불만 같은 셀 재생성, 요청·거절 고P 셀 추가 → v5-samples.json 갱신",
    async () => {
      const { url, key } = readEnv();
      const runCell = createRunner(url, key);
      const jsonPath = resolve(OUT_DIR, "v5-samples.json");
      const existing: SampleResult[] = JSON.parse(readFileSync(jsonPath, "utf8"));

      // ① fail이었던 화행의 "원래 셀"을 파일에서 그대로 가져와 재생성한다.
      //    플래너를 다시 돌리면 쿼터가 달라질 때 seq 커서가 밀려 topic이 바뀔 수 있다.
      const regenActs = ["agreement", "complaint"] as const;
      const regenCells = regenActs.map((a) => {
        const row = existing.find((r) => r.act === a && !r.variant);
        if (!row) throw new Error(`기존 표본에 ${a}가 없습니다`);
        return row.cell;
      });

      // ② 고P 셀 — 같은 플래너에서 화행당 2셀을 뽑으면 두 번째가 구인 셀 #2
      //    (higher·acquaintance·high)다. 요청·거절만 취한다(고P 편향 우려가
      //    직접성 축에 집중되는 두 화행 — 계약 0-t, Yu 1999).
      const highPCells = buildBatchPlan(
        {
          perLevel: { beginner_intermediate: 0, intermediate: 2, advanced: 0 },
          interpretingRatio: 0,
        },
        "ko_zh",
      ).filter(
        (c) =>
          c.mode === "translation" &&
          c.pdr_power === "higher" &&
          (c.speech_act_ui === "request" || c.speech_act_ui === "refusal"),
      );

      const fresh: SampleResult[] = [];
      for (const cell of regenCells) fresh.push(await runCell(cell, "regen"));
      for (const cell of highPCells) fresh.push(await runCell(cell, "high_p"));

      // 병합: 재생성분은 같은 화행의 기존 행을 교체, 고P분은 뒤에 추가.
      const merged = existing
        .filter((r) => !(regenActs as readonly string[]).includes(r.act) || r.variant === "high_p")
        .concat(fresh.filter((r) => r.variant === "regen"))
        .concat(fresh.filter((r) => r.variant === "high_p"));
      merged.sort((a, b) =>
        (a.variant === "high_p" ? 1 : 0) - (b.variant === "high_p" ? 1 : 0) ||
        a.act.localeCompare(b.act),
      );

      writeFileSync(jsonPath, JSON.stringify(merged, null, 2), "utf8");
      console.log(`\n갱신된 표본 JSON: ${jsonPath} (총 ${merged.length}건)`);
      console.log(
        "보충 요약: " +
          fresh
            .map((r) => `${r.actKo} 코어 ${r.coreResult ?? "ERR"}/미션 ${r.missionResult ?? "ERR"}`)
            .join(" · "),
      );
    },
    1_800_000,
  );
});

describe.skipIf(!CANARY)("콘텐츠 후보 refresh canary", () => {
  it(
    "본 배치 플래너의 대표 6셀을 생성하고 버전 표식·R규칙 결과를 남긴다",
    async () => {
      const { url, key } = readEnv();
      const runCell = createRunner(url, key);
      const results: SampleResult[] = [];
      const fixtureRows = CANARY_CORE_FIXTURE
        ? JSON.parse(
            readFileSync(resolve(process.cwd(), CANARY_CORE_FIXTURE), "utf8"),
          ) as SampleResult[]
        : [];
      const fixtureByCell = new Map(
        fixtureRows.map((row) => [
          `${row.act}|${row.cell.direction}|${row.cell.mode}`,
          row.core,
        ]),
      );

      // 순차 실행 — 조직 TPM 상한을 넘기지 않으면서 실패 셀도 끝까지 기록한다.
      for (const cell of buildContentCanaryPlan()) {
        const fixtureKey = `${cell.speech_act_ui}|${cell.direction}|${cell.mode}`;
        const coreFixture = CANARY_CORE_FIXTURE ? fixtureByCell.get(fixtureKey) : undefined;
        if (CANARY_CORE_FIXTURE && !coreFixture) {
          throw new Error(`고정 코어 fixture에 ${fixtureKey} 셀이 없습니다.`);
        }
        results.push(await runCell(cell, undefined, coreFixture));
      }

      const outDir =
        process.env.CONTENT_CANARY_OUT ?? resolve(process.cwd(), ".tmp", "content-canary");
      mkdirSync(outDir, { recursive: true });
      const suffix = CANARY_CORE_FIXTURE
        ? ".mission-replay"
        : CANARY_CORE_ONLY
          ? ".core-only"
          : "";
      const jsonPath = resolve(outDir, `${CURRENT_CONTENT_RELEASE_ID}${suffix}.json`);
      writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");

      const summary = results.map((result) => ({
        act: result.act,
        direction: result.cell.direction,
        mode: result.cell.mode,
        core: result.coreResult ?? "error",
        mission: result.missionResult ?? "error",
        coreRelease:
          (result.core as { generation?: { content_release_id?: string } } | undefined)
            ?.generation?.content_release_id ?? null,
        missionRelease:
          (result.mission as { provenance?: { content_release_id?: string } } | undefined)
            ?.provenance?.content_release_id ?? null,
      }));
      console.log(`\ncanary JSON: ${jsonPath}`);
      console.log(JSON.stringify(summary, null, 2));

      for (const result of results) {
        expect(result.error, `${result.actKo} 생성 오류`).toBeUndefined();
        expect(result.coreResult, `${result.actKo} 코어 R검사`).not.toBe("fail");
        if (!CANARY_CORE_ONLY) {
          expect(result.missionResult, `${result.actKo} 미션 R검사`).not.toBe("fail");
        }
        if (!CANARY_CORE_FIXTURE) {
          expect(
            (result.core as { generation?: { content_release_id?: string } } | undefined)
              ?.generation?.content_release_id,
            `${result.actKo} 코어 후보 ID`,
          ).toBe(CURRENT_CONTENT_RELEASE_ID);
        }
        if (!CANARY_CORE_ONLY) {
          expect(
            (result.mission as { provenance?: { content_release_id?: string } } | undefined)
              ?.provenance?.content_release_id,
            `${result.actKo} 미션 후보 ID`,
          ).toBe(CURRENT_CONTENT_RELEASE_ID);
        }
      }
    },
    1_800_000,
  );
});

describe.skipIf(!INTERPRETER_ROLE_CANARY)("통역 역할 계약 운영 canary", () => {
  it(
    "9화행×양방향 통역 코어 18건을 DB 미저장으로 생성하고 버전·R규칙을 확인한다",
    async () => {
      const { url, key } = readEnv();
      const runCell = createRunner(url, key, { coreOnly: true });
      const results: SampleResult[] = [];

      for (const cell of buildInterpreterRoleCanaryPlan()) {
        results.push(await runCell(cell));
      }

      const outDir =
        process.env.CONTENT_CANARY_OUT ?? resolve(process.cwd(), ".tmp", "content-canary");
      mkdirSync(outDir, { recursive: true });
      const jsonPath = resolve(
        outDir,
        `${CURRENT_CONTENT_RELEASE_ID}.interpreter-role.core-only.json`,
      );
      writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");

      const summary = results.map((result) => ({
        act: result.act,
        direction: result.cell.direction,
        pdr: [
          result.cell.pdr_power,
          result.cell.pdr_distance,
          result.cell.pdr_burden,
        ].join("/"),
        core: result.coreResult ?? "error",
        coreRelease:
          (result.core as { generation?: { content_release_id?: string } } | undefined)
            ?.generation?.content_release_id ?? null,
      }));
      console.log(`\ninterpreter role canary JSON: ${jsonPath}`);
      console.log(JSON.stringify(summary, null, 2));

      expect(results).toHaveLength(18);
      for (const result of results) {
        expect(result.cell.mode).toBe("stt_interpreting");
        expect(result.error, `${result.cell.direction} ${result.actKo} 생성 오류`).toBeUndefined();
        expect(result.coreResult, `${result.cell.direction} ${result.actKo} 코어 R검사`).not.toBe(
          "fail",
        );
        expect(result.mission).toBeUndefined();
        expect(
          (result.core as { generation?: { content_release_id?: string } } | undefined)
            ?.generation?.content_release_id,
          `${result.cell.direction} ${result.actKo} 코어 후보 ID`,
        ).toBe(CURRENT_CONTENT_RELEASE_ID);
      }
    },
    1_800_000,
  );
});
