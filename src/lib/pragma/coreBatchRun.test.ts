import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BatchCell } from "@/lib/pragma/batchPlan";
import { CORE_SEMANTIC_AXES, coreSemanticContent } from '../../../supabase/functions/_shared/sceneGrounding';
import { CURRENT_CORE_QUALITY_PROMPT_VERSION } from '../../../supabase/functions/_shared/contentRelease';
import {
  coreGenerationItemKey,
  runCoreBatch,
  runCoreCell,
  checkCoreSemanticFit,
} from "@/lib/pragma/coreBatchRun";

const supabaseMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: supabaseMocks.invoke },
    rpc: supabaseMocks.rpc,
  },
}));

const cell = (overrides: Partial<BatchCell> = {}): BatchCell => ({
  speech_act_ui: "request",
  level: "intermediate",
  domain: "work",
  mode: "translation",
  industry: "trade_distribution",
  business_function: "overseas_sales",
  pdr_power: "equal",
  pdr_distance: "acquaintance",
  pdr_burden: "mid",
  theme_code: "career_workplace",
  topic_code: "work_request",
  situation_seed_ko: "직장 관계에서 생기는 요청 상황",
  direction: "ko_zh",
  count: 1,
  ...overrides,
});

describe("core batch resume", () => {
  beforeEach(() => {
    supabaseMocks.invoke.mockReset();
    supabaseMocks.rpc.mockReset();
  });
  it("모든 연구 축과 반복 index로 안정적인 item key를 만든다", () => {
    const base = cell();
    expect(coreGenerationItemKey(base, 0)).toBe(coreGenerationItemKey(cell(), 0));
    expect(coreGenerationItemKey(base, 0)).not.toBe(
      coreGenerationItemKey(cell({ direction: "zh_ko" }), 0),
    );
    expect(coreGenerationItemKey(base, 0)).not.toBe(
      coreGenerationItemKey(cell({ mode: "stt_interpreting" }), 0),
    );
    expect(coreGenerationItemKey(base, 0)).not.toBe(
      coreGenerationItemKey(cell({ pdr_power: "higher" }), 0),
    );
    expect(coreGenerationItemKey(base, 0)).not.toBe(
      coreGenerationItemKey(cell({ business_function: "marketing_pr" }), 0),
    );
    expect(coreGenerationItemKey(base, 0)).not.toBe(
      coreGenerationItemKey(base, 1),
    );
  });

  it("같은 run ID의 저장 완료 항목은 AI 호출 없이 완료로 처리한다", async () => {
    const cells = [
      cell(),
      cell({ mode: "stt_interpreting", topic_code: "work_request_spoken" }),
    ];
    const existingItems = new Map(
      cells.map((item, index) => [
        coreGenerationItemKey(item, index),
        {
          scenarioId: `scenario-${index}`,
          coreContent: { situation_ko: `기존 상황 ${index}` },
        },
      ]),
    );
    const progress: number[] = [];

    const result = await runCoreBatch(cells, {
      runId: "core_test",
      existingItems,
      onProgress: (done) => progress.push(done),
    });

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.ok && item.reused)).toBe(true);
    expect(result.map((item) => item.scenarioId)).toEqual([
      "scenario-0",
      "scenario-1",
    ]);
    expect(result.map((item) => item.coreContent?.situation_ko)).toEqual([
      "기존 상황 0",
      "기존 상황 1",
    ]);
    expect(progress).toEqual([1, 2]);
  });

  it("부분 재생성에서도 원래 계획 index로 item key와 결과 번호를 유지한다", async () => {
    const cells = [
      cell({ speech_act_ui: "opposition", topic_code: "daily_opposition" }),
      cell({ speech_act_ui: "complaint", topic_code: "work_complaint" }),
    ];
    const itemIndexes = [12, 16];
    const existingItems = new Map(
      cells.map((item, index) => [
        coreGenerationItemKey(item, itemIndexes[index]),
        { scenarioId: `scenario-${itemIndexes[index]}` },
      ]),
    );

    const result = await runCoreBatch(cells, {
      runId: "core_selected_test",
      itemIndexes,
      existingItems,
    });

    expect(result.map((item) => item.index)).toEqual(itemIndexes);
    expect(result.map((item) => item.scenarioId)).toEqual([
      "scenario-12",
      "scenario-16",
    ]);
  });
});

describe("full core semantic gate", () => {
  const fullCheck = (overrides: Record<string, unknown> = {}) => ({
    verdict: 'pass', model: 'critic', prompt_version: CURRENT_CORE_QUALITY_PROMPT_VERSION,
    axes: { ...Object.fromEntries(CORE_SEMANTIC_AXES.map(axis => [axis, { verdict: 'pass', reason_ko: '실제 사실에 근거함' }])), ...overrides },
  });
  const genericCore = {
    schema_version: "scenario_core_v1",
    situation_ko: "팀원이 회사 일정 변경을 담당자에게 메신저 글로 요청한다.",
    relation_ko: "같은 조직의 팀원과 담당자 관계",
    source_modality: "written",
    source_text_ko: "검토 일정을 하루 늦출 수 있을까요?",
    preceding_turn_zh: null,
    pdr: { p: "equal", d: "acquaintance", r: "mid" },
    channel: "messenger",
    context_spec: {
      standard_situation_code: "work.schedule_change.request",
      role_pair: { speaker_ko: "팀원", addressee_ko: "담당자" },
      speaker_entitlement: "일정 변경을 요청할 수 있다.",
      addressee_obligation: "요청을 검토할 수 있다.",
      decision_authority: "담당자가 일정을 결정한다.",
    },
  };
  const r26Cell = cell({ topic_code: "schedule_change" });

  beforeEach(() => {
    supabaseMocks.invoke.mockReset();
    supabaseMocks.rpc.mockReset();
  });

  it("industry 이외 P 의미 실패도 저장하지 않는다", async () => {
    supabaseMocks.invoke
      .mockResolvedValueOnce({ data: { core_content: genericCore, meta: {} }, error: null })
      .mockResolvedValueOnce({
        data: {
          core_quality_check: fullCheck({ power: { verdict: 'fail', reason_ko: '직함 외에 권한 근거가 없다.' } }),
        },
        error: null,
      });

    const result = await runCoreCell(r26Cell, 290, { runId: "run-11" });

    expect(supabaseMocks.invoke).toHaveBeenCalledTimes(2);
    expect(supabaseMocks.rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      terminalStage: "core_semantic_critic",
      semanticFailureCodes: ["power"],
      stopCode: "CORE_SEMANTIC_HOLD",
      industryCritic: { verdict: "warning" },
    });
  });

  it("전체 의미 pass이면 lexical warning을 보존하고 저장한다", async () => {
    supabaseMocks.invoke
      .mockResolvedValueOnce({ data: { core_content: genericCore, meta: {} }, error: null })
      .mockResolvedValueOnce({
        data: {
          core_quality_check: fullCheck(),
        },
        error: null,
      });
    supabaseMocks.rpc.mockResolvedValue({ data: "scenario-290", error: null });

    const result = await runCoreCell(r26Cell, 290, { runId: "run-11" });

    expect(supabaseMocks.rpc).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.ruleFindings).toContainEqual(expect.objectContaining({ id: "R26", level: "warning" }));
    expect(result.industryCritic?.verdict).toBe("pass");
  });
});


describe('semantic review reuse', () => {
  it('reuses matching evidence but rechecks changed content, act and expected PDR', async () => {
    supabaseMocks.invoke.mockReset();
    const c = cell();
    const material = { direction: c.direction, situation_ko: '검토한 장면', source_text: '검토한 원문',
      pdr: { p: 'equal', d: 'acquaintance', r: 'mid' } };
    const scope = { direction: c.direction, speech_act: c.speech_act_ui, level: c.level, domain: c.domain,
      industry: c.industry, mode: c.mode, topic_code: c.topic_code, pdr: material.pdr };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(coreSemanticContent(material, scope)));
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    const check = { verdict: 'pass', prompt_version: CURRENT_CORE_QUALITY_PROMPT_VERSION,
      axes: Object.fromEntries(CORE_SEMANTIC_AXES.map(axis => [axis, { verdict: 'pass', reason_ko: '명시된 사실' }])),
      core_content_hash: hash };
    const reviewed = { ...material, generation: { semantic_check: check } };
    expect((await checkCoreSemanticFit(c, reviewed, 'run', 'item')).ok).toBe(true);
    expect(supabaseMocks.invoke).not.toHaveBeenCalled();
    supabaseMocks.invoke.mockResolvedValue({ error: null, data: { core_quality_check: check } });
    await checkCoreSemanticFit(c, { ...reviewed, source_text: '바뀐 원문' }, 'run', 'item');
    await checkCoreSemanticFit({ ...c, speech_act_ui: 'apology' }, reviewed, 'run', 'item');
    await checkCoreSemanticFit({ ...c, pdr_power: 'higher' }, reviewed, 'run', 'item');
    await checkCoreSemanticFit({ ...c, direction: 'zh_ko' }, reviewed, 'run', 'item');
    expect(supabaseMocks.invoke).toHaveBeenCalledTimes(4);
  });
});
