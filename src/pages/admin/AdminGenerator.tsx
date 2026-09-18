import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { type AuthenticApply } from "./AuthenticImportPanel";
import { getStoredCandidate, storedCandidateToApply } from "@/lib/admin/authenticStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SPEECH_ACT_UI,
  SPEECH_ACT_UI_EN,
  LEVEL,
  HSK_REFERENCE_CEILING,
  CHANNEL_TO_MODE,
  PDR_POWER,
  PDR_DISTANCE,
  PDR_BURDEN,
  PDR_POWER_SHORT,
  PDR_DISTANCE_SHORT,
  PDR_BURDEN_SHORT,
  DIRECTION_LABEL,
  DOMAIN,
  INDUSTRY,
  BUSINESS_FUNCTION,
  BUSINESS_FUNCTION_PRIMARY,
  CHANNEL_UI,
  CHANNEL_TO_GENRE,
  MODE_LABEL,
  COMPLEX_TASK_TO_CONTEXT,
} from "@/lib/pragma/enums";
import { checkCore, coreLengthHintKo, type CheckContext } from "@/lib/pragma/missionRules";
import { createCoreGenerationRunId } from "@/lib/pragma/coreGenerationRun";
import { checkCoreSemanticFit } from "@/lib/pragma/coreBatchRun";
import {
  PDR_POWER_ENUM_TO_JSON,
  PDR_DISTANCE_ENUM_TO_JSON,
  coreContentForHash,
} from "@/lib/pragma/coreSchema";
import type { CoreProvenance } from "@/lib/pragma/coreSchema";
import {
  THEME_CODES,
  THEME_LABEL,
  THEME_ALLOWED_DOMAINS,
  topicsForTheme,
  type ThemeCode,
} from "@/lib/pragma/scenarioTopics";
import type {
  SpeechActUI,
  LearnerLevel,
  LanguageDirection,
  ChannelUI,
  GenMode,
  PdrPower,
  PdrDistance,
  PdrBurden,
  Domain,
  IndustrySector,
  BusinessFunction,
  ComplexTaskUI,
} from "@/lib/pragma/enums";
import {
  parseGeneratorPrefill,
  type GeneratorPrefill,
} from "@/lib/pragma/adminGeneratorPrefill";

interface AiCandidate {
  candidate_text: string;
  directness_level: number;
  appropriateness_label:
    | "appropriate"
    | "too_direct"
    | "too_indirect"
    | "mismatched"
    | "meaning_shift";
  failed_challenge: string[];
  rationale: string;
}
interface AiScenario {
  title: string;
  source_text: string;
  situation: string;
  candidates: AiCandidate[];
  feedback: { teacher: string; native: string; field_expert: string };
}
interface AiMeta {
  provider: string;
  model: string;
  prompt_version: string;
  generated_at: string;
}

const APPROPRIATENESS_KO: Record<AiCandidate["appropriateness_label"], string> = {
  appropriate: "적정",
  too_direct: "지나치게 직접적",
  too_indirect: "지나치게 완곡",
  mismatched: "격식·기능 불일치",
  meaning_shift: "의미 왜곡",
};
const APPROPRIATENESS_TONE: Record<AiCandidate["appropriateness_label"], string> = {
  appropriate: "border-[#6EE7B7] bg-[#D1FAE5] text-[#065F46]",
  too_direct: "border-[#FBBF24] bg-[#FEF3C7] text-[#7A5A0A]",
  too_indirect: "border-[#FBBF24] bg-[#FEF3C7] text-[#7A5A0A]",
  mismatched: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]",
  meaning_shift: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]",
};
const CHALLENGE_KO: Record<string, string> = {
  directness: "직접성",
  formality: "격식",
  imposition: "부담도",
};

// Speech-act pragmatic burden weight (0=low, 1=mid, 2=high). Reference only.
const SPEECH_ACT_WEIGHT: Record<SpeechActUI, number> = {
  request: 1, refusal: 2, apology: 1, thanks: 0,
  proposal: 1, agreement: 1, opposition: 2, compliment: 0, complaint: 2,
};

// Derived pragmatic burden (참고용). Combines speech act weight + P/D/R.
type BurdenLevel = "low" | "medium" | "high";
function computePragmaticBurden(
  sa: SpeechActUI, p: PdrPower, d: PdrDistance, r: PdrBurden
): { level: BurdenLevel; label: string; reasons: string[] } {
  const pw = p === "equal" ? 0 : 1;
  const dw = d === "formal" ? 1 : d === "acquaintance" ? 0.5 : 0;
  const rw = r === "high" ? 1 : r === "mid" ? 0.5 : 0;
  const score = SPEECH_ACT_WEIGHT[sa] + pw + dw + rw;
  const level: BurdenLevel = score <= 1 ? "low" : score <= 3 ? "medium" : "high";
  const label = level === "low" ? "낮음" : level === "medium" ? "보통" : "높음";
  const reasons: string[] = [`${SPEECH_ACT_UI[sa]} 화행`];
  if (pw) reasons.push("지위 차 있음");
  if (d === "formal") reasons.push("초면 관계");
  else if (d === "acquaintance") reasons.push("지인 수준 관계");
  if (r === "high") reasons.push("부담 높음");
  else if (r === "mid") reasons.push("부담 중간");
  return { level, label, reasons };
}


// CHANNEL_UI · CHANNEL_TO_GENRE · MODE_LABEL · COMPLEX_TASK_TO_CONTEXT는
// enums.ts로 이동했다 (배치 러너와 공유 — 복제하면 조용히 갈라진다).

// UI-only language direction (not persisted unless scenarios has column).
const LANGUAGE_DIRECTION: Record<LanguageDirection, string> = {
  ko_zh: "한→중",
  zh_ko: "중→한",
};

// UI-only complex-task taxonomy. 표시 라벨은 이 화면의 드롭다운 전용.
const COMPLEX_TASK_UI: Record<ComplexTaskUI, string> = {
  none: "없음",
  persuade: "설득",
  coordinate: "조율",
  negotiate: "협상",
};


interface FormState {
  mode: "single" | "batch";
  batchSize: "5" | "10" | "20";
  // UI-level fields (drive display; mapped to internal enums at submit time)
  speech_act_ui: SpeechActUI;
  channel: ChannelUI;
  complex_task: ComplexTaskUI;
  // Internal enum fields (kept for DB compatibility)
  level: LearnerLevel;
  industry: IndustrySector;
  func: BusinessFunction;
  multi: boolean;
  reasons: "1" | "2" | "3";
  coordination: boolean;
  pdr_power: PdrPower;
  pdr_distance: PdrDistance;
  pdr_burden: PdrBurden;
  domain: Domain;
  language_direction: LanguageDirection;
}

const DEFAULT_FORM: FormState = {
  mode: "single",
  batchSize: "10",
  speech_act_ui: "refusal",
  channel: "email",
  complex_task: "negotiate",
  level: "intermediate",
  industry: "culture_content_media",
  func: "marketing_pr",
  multi: false,
  reasons: "2",
  coordination: true,
  pdr_power: "higher",
  pdr_distance: "formal",
  pdr_burden: "low",
  domain: "work",
  language_direction: "ko_zh",


};

function formWithGridPrefill(prefill: GeneratorPrefill | null): FormState {
  if (!prefill) return DEFAULT_FORM;
  const channel: ChannelUI =
    prefill.mode === "stt_interpreting"
      ? "facetoface"
      : prefill.mode === "translation"
        ? "email"
        : DEFAULT_FORM.channel;
  return {
    ...DEFAULT_FORM,
    speech_act_ui: prefill.speechAct,
    level: prefill.level,
    channel,
    domain: prefill.domain ?? DEFAULT_FORM.domain,
    language_direction:
      prefill.direction ?? DEFAULT_FORM.language_direction,
  };
}


interface BatchItem {
  title: string;
  auto_check: "pass" | "warning";
}

const formField = "h-9 text-[13px] bg-[#FAF7EE] border-[#EAE4D2]";

const AdminGenerator = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const gridPrefill = parseGeneratorPrefill(searchParams);
  const initialForm = formWithGridPrefill(gridPrefill);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiScenario | null>(null);
  const [aiMeta, setAiMeta] = useState<AiMeta | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedScenarioId, setSavedScenarioId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[] | null>(null);

  // v8 UI-only state — task mode drives channel options; outline count replaces
  // the single/batch radio + size dropdown (payload unchanged).
  const [taskMode, setTaskMode] = useState<GenMode>(
    gridPrefill?.mode ?? CHANNEL_TO_MODE[initialForm.channel],
  );
  const [outlineCount, setOutlineCount] = useState<1 | 3 | 5>(1);

  // v8 two-step outline → select → final flow.
  const [outlines, setOutlines] = useState<{ title: string; situation: string }[] | null>(null);
  const [selectedOutlines, setSelectedOutlines] = useState<Set<number>>(new Set());
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  // Single-shot save: surfaces a non-fatal partial failure (row saved but the
  // follow-up mode/language_direction update failed).
  const [metaWarning, setMetaWarning] = useState<string | null>(null);

  // ── scenario_core_v1 단건 생성 (레거시 candidates/feedback 폐기, 2026-07-25) ──
  // 개요(situation)를 seed로 action:'core' → checkCore → save_generated_core(draft).
  // ⚠️ 무조건 THEME_CODES[0](campus_study=school 전용)으로 시작하면 안 된다 — 폼 기본
  // domain이 "work"라(위 DEFAULT_FORM), 화면을 열자마자 theme/domain이 어긋난 채로
  // 시작해 첫 생성이 곧바로 R1c 실패로 떨어졌다(지도교수 리포트 재현). 기본 domain을
  // 허용하는 첫 theme으로 시작한다.
  const [themeCode, setThemeCode] = useState<ThemeCode>(
    () =>
      gridPrefill?.theme ??
      THEME_CODES.find((t) =>
        THEME_ALLOWED_DOMAINS[t].includes(initialForm.domain),
      ) ??
      THEME_CODES[0],
  );
  type CoreResult = {
    title: string;
    ok: boolean;
    core?: Record<string, unknown>;
    rule?: "pass" | "warning" | "fail";
    scenarioId?: string;
    error?: string;
  };
  const [coreResults, setCoreResults] = useState<CoreResult[] | null>(null);

  // v9 UI-only — source acquisition mode. "ai" keeps current flow.
  // "manual" swaps the LLM-generated source_text with the user's own text
  // after the Edge Function returns (payload/columns unchanged).
  // "bank" 모드는 미구현 상태로 남아 있던 죽은 값이라 제거했다(2026-08-05).
  // 선택 UI 자체는 2026-07-25에 이미 없어졌고, 여기에 union 멤버만 남아 있었다.
  type SourceMode = "ai" | "manual";
  const [sourceMode, setSourceMode] = useState<SourceMode>("ai");
  // 실제 자료 유래 코어의 출처(0-q·98). applyAuthentic에서만 채워지고,
  // 저장 시 manualSourceText가 실제로 쓰였을 때만 core_content에 붙는다.
  const [authenticProv, setAuthenticProv] = useState<CoreProvenance | null>(null);
  const [manualSourceText, setManualSourceText] = useState("");

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // Channels filtered by task mode.
  // phone hidden per media-3 LOCK (대면구어·위챗·이메일). Enum key kept for stored data.
  const channelsForMode: ChannelUI[] =
    taskMode === "translation" ? ["email", "messenger"] : ["facetoface"];

  // Clear any stale outline candidates when generation conditions change.
  const resetOutlines = () => {
    setOutlines(null);
    setSelectedOutlines(new Set());
    setOutlineError(null);
  };

  const setTaskModeSafe = (m: GenMode) => {
    setTaskMode(m);
    const allowed: ChannelUI[] =
      m === "translation" ? ["email", "messenger"] : ["facetoface"];
    if (!allowed.includes(form.channel)) update("channel", allowed[0]);
    resetOutlines();
  };

  const setOutlineCountSafe = (n: 1 | 3 | 5) => {
    setOutlineCount(n);
    // Keep legacy form.mode / batchSize in sync for payload compatibility.
    setForm((p) => ({
      ...p,
      mode: n === 1 ? "single" : "batch",
      batchSize: (n === 1 ? "10" : String(n)) as FormState["batchSize"],
    }));
    resetOutlines();
  };

  // 「실제 자료에서 생성」 후보를 생성기 폼에 채운다. 이후는 기존 생성 경로 그대로.
  // channel/taskMode 정합을 맞추고(전화 등 미노출 채널은 가시 채널로 보정),
  // 원자료 유래 원문은 '직접 입력' 모드로 주입해 기존 manual 경로를 재사용한다.
  const applyAuthentic = (a: AuthenticApply) => {
    const mode = CHANNEL_TO_MODE[a.channel];
    const allowed: ChannelUI[] =
      mode === "translation" ? ["email", "messenger"] : ["facetoface"];
    const channel = allowed.includes(a.channel) ? a.channel : allowed[0];
    setForm((p) => ({
      ...p,
      speech_act_ui: a.speech_act_ui,
      language_direction: a.language_direction,
      domain: a.domain,
      industry: a.industry ?? p.industry,
      channel,
      complex_task: a.complex_task,
      level: a.level,
      pdr_power: a.pdr_power,
      pdr_distance: a.pdr_distance,
      pdr_burden: a.pdr_burden,
    }));
    setTaskMode(mode);
    setSourceMode("manual");
    setManualSourceText(a.source_text);
    setAuthenticProv(a.provenance); // 0-q·98 — 이전에는 여기서 출처가 버려졌다.
    resetOutlines();
    // 이전 미리보기/저장 상태 초기화.
    setAiResult(null);
    setSaved(false);
    setSavedScenarioId(null);
    setSaveError(null);
  };

  // 「실제 자료 활용 분석」에서 넘어온 후보를 받는다. 보관된 후보는 id로 읽고(새로고침
  // 해도 살아 있다), 보관 전 후보는 라우터 state로 온다. 옛 sessionStorage 왕복은
  // 되살리지 않는다 — 저장되지 않는 경로가 다시 생기기 때문이다.
  const candidateId = searchParams.get("candidateId");
  const handedOver = (location.state as { authenticApply?: AuthenticApply } | null)?.authenticApply;
  useEffect(() => {
    if (handedOver) {
      applyAuthentic(handedOver);
      return;
    }
    if (!candidateId) return;
    let alive = true;
    void getStoredCandidate(candidateId).then((found) => {
      if (alive && found) applyAuthentic(storedCandidateToApply(found.candidate, found.analysis));
    });
    return () => {
      alive = false;
    };
    // applyAuthentic은 매 렌더 새로 만들어지므로 의존성에 넣지 않는다(1회 주입).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId, handedOver]);

  // Shared request body for single-shot / outline / final calls.
  const baseGenBody = () => ({
    // True 9-value act (2026-07-19 fix): DB enum extended to 9; the old 9→2
    // collapse (SPEECH_ACT_UI_TO_INTERNAL) is no longer applied at write time.
    speech_act: form.speech_act_ui,
    genre: CHANNEL_TO_GENRE[form.channel],
    level: form.level,
    context: COMPLEX_TASK_TO_CONTEXT[form.complex_task],
    domain: form.domain,
    industry: form.domain === "work" ? form.industry : null,
    func: form.domain === "work" ? form.func : null,
    pdr_power: form.pdr_power,
    pdr_distance: form.pdr_distance,
    pdr_burden: form.pdr_burden,
    multi: form.multi,
    reasons: form.reasons,
    coordination: form.coordination,
    language_direction: form.language_direction,
    mode: CHANNEL_TO_MODE[form.channel],
    speech_act_ui: form.speech_act_ui,
    channel_ui: form.channel,
    complex_task_ui: form.complex_task,
  });

  // Follow-up (non-atomic) write of columns the save RPC does not populate.
  // ⚠️ domain 추가 (2026-07-22): RPC가 domain을 INSERT하지 않아 지금까지 생성된
  // 시나리오는 전부 domain이 NULL이었다. 교강사 편성의 '주제별' 필터가 이 컬럼을
  // 쓰므로 여기서 반드시 함께 기록한다.
  const persistExtraColumns = async (scenarioId: string): Promise<"ok" | "failed"> => {
    const { error } = await supabase
      .from("scenarios")
      .update({
        domain: form.domain,
        mode: CHANNEL_TO_MODE[form.channel],
        language_direction: form.language_direction,
      })
      .eq("scenario_id", scenarioId);
    if (error) console.error("persistExtraColumns (domain/mode/language_direction) failed", error);
    return error ? "failed" : "ok";
  };

  // Step 1: generate N lightweight outlines in a single call.
  const generateOutlines = async () => {
    setOutlineLoading(true);
    resetOutlines();
    try {
      const { data, error } = await supabase.functions.invoke("generate-scenario", {
        body: { ...baseGenBody(), action: "outline", outline_count: outlineCount },
      });
      if (error) throw error;
      const list = (data?.outlines ?? []) as { title: string; situation: string }[];
      if (!Array.isArray(list) || list.length === 0) throw new Error(data?.error ?? "개요가 비어 있습니다.");
      setOutlines(list);
      setSelectedOutlines(new Set(list.map((_, i) => i))); // default: all selected (v8)
    } catch (e) {
      setOutlineError((e as Error).message ?? "개요 생성에 실패했습니다.");
    } finally {
      setOutlineLoading(false);
    }
  };

  const toggleOutline = (i: number) => {
    setSelectedOutlines((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // theme → topic 파생 (편성 메타 · 코어 CHECK 필수). theme이 domain 2개를 허용해도
  // (예: digital_content = daily+work) 개별 topic은 그중 하나만 허용할 수 있으므로
  // (예: collab_dm_request = work만), theme의 무조건 첫 항목이 아니라 **현재 도메인을
  // 허용하는 첫 topic**을 고른다 — 안 그러면 theme은 유효한데 topic 불일치로 실패한다.
  const topicCode =
    topicsForTheme(themeCode).find((t) => t.allowedDomains.includes(form.domain))?.code ??
    topicsForTheme(themeCode)[0]?.code ??
    topicsForTheme(THEME_CODES[0])[0]?.code ??
    "";

  const modalityOf = (m: GenMode) => (m === "stt_interpreting" ? "spoken" : "written");
  const legacyChannelOf = (m: GenMode) => (m === "stt_interpreting" ? "facetoface" : "messenger");
  const RESPONSE_ACTS = new Set(["refusal", "opposition"]);
  const coreHash = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  };

  // Step 2 (2026-07-25 전환): 선택 개요를 scenario_core_v1로 생성·저장.
  //   개요 situation = situation_seed → action:'core' → checkCore → save_generated_core(draft).
  // 구 candidates/directness/3관점 + save_generated_scenario 경로 폐기(현행 코어 모델 정합).
  const generateCores = async () => {
    if (!outlines || selectedOutlines.size === 0 || finalizing) return;
    setFinalizing(true);
    setCoreResults(null);
    const indices = [...selectedOutlines].sort((a, b) => a - b);
    const results: CoreResult[] = [];
    // 같은 조건을 다시 생성하는 것은 이전 실행 재개가 아니라 새 실행이다. 내용 기반
    // runId를 재사용하면 과거 행과 (generation_run_id, item_key)가 충돌한다.
    const runId = createCoreGenerationRunId();
    const mode = taskMode;
    const isResponse = RESPONSE_ACTS.has(form.speech_act_ui);
    for (const i of indices) {
      const outline = outlines[i];
      const label = outline.title || `개요 #${i + 1}`;
      try {
        const seed =
          sourceMode === "manual" && manualSourceText.trim()
            ? `${outline.situation}\n(실제 자료 원문 활용: ${manualSourceText.trim()})`
            : outline.situation;
        const { data, error } = await supabase.functions.invoke("generate-scenario", {
          body: {
            action: "core",
            core: {
              direction: form.language_direction,
              speech_act: form.speech_act_ui,
              speech_act_ko: SPEECH_ACT_UI[form.speech_act_ui],
              level: form.level,
              level_ko: LEVEL[form.level],
              domain: form.domain,
              domain_ko: DOMAIN[form.domain],
              industry: form.domain === "work" ? form.industry : null,
              func: form.domain === "work" ? form.func : null,
              topic_code: topicCode,
              mode,
              channel: legacyChannelOf(mode),
              channel_ko: mode === "stt_interpreting" ? "구두(통역)" : "서면(번역)",
              pdr: {
                p: PDR_POWER_ENUM_TO_JSON[form.pdr_power],
                d: PDR_DISTANCE_ENUM_TO_JSON[form.pdr_distance],
                r: form.pdr_burden,
              },
              source_modality: modalityOf(mode),
              situation_seed_ko: seed,
              is_response_act: isResponse,
              length_hint_ko: coreLengthHintKo(form.level, mode),
            },
          },
        });
        if (error) throw error;
        if (!data?.core_content) throw new Error(data?.error ?? "빈 응답");
        const core = data.core_content as Record<string, unknown> & { channel?: string; situation_ko?: string; brief_note_ko?: string };
        const meta = data.meta;

        const ctx: CheckContext = {
          speech_act: form.speech_act_ui,
          level: form.level,
          domain: form.domain,
          theme_code: themeCode,
          topic_code: topicCode,
          industry: form.domain === "work" ? form.industry : null,
          mode,
          source_modality: modalityOf(mode),
          direction: form.language_direction,
          require_context_spec: true,
        };
        const ruleResult = checkCore(core, ctx);
        if (ruleResult.result === "fail") {
          results.push({
            title: label,
            ok: false,
            core,
            rule: "fail",
            error: ruleResult.violations.find((v) => v.level === "fail")?.message ?? "규칙검사 실패(저장 안 함)",
          });
          setCoreResults([...results]);
          continue;
        }
        const itemKey = `${form.speech_act_ui}|${form.level}|${form.domain}|${topicCode}|${i}`;

        // Reuse the server's matching full semantic review; an old Edge response must not bypass it.
        {
          const checked = await checkCoreSemanticFit(
            {
              direction: form.language_direction,
              speech_act_ui: form.speech_act_ui,
              level: form.level,
              domain: form.domain,
              industry: form.domain === "work" ? form.industry : null,
              mode,
              pdr_power: form.pdr_power,
              pdr_distance: form.pdr_distance,
              pdr_burden: form.pdr_burden,
              topic_code: topicCode,
              situation_seed_ko: seed,
            },
            core,
            runId,
            itemKey,
          );
          if ("error" in checked) {
            results.push({ title: label, ok: false, core, rule: "warning", error: `코어 의미 검토 실패: ${checked.error}` });
            setCoreResults([...results]);
            continue;
          }
          if (checked.result.verdict !== "pass") {
            results.push({ title: label, ok: false, core, rule: "warning", error: `코어 의미 검토 보류: ${checked.result.reason}` });
            setCoreResults([...results]);
            continue;
          }
        }

        core.channel = legacyChannelOf(mode);
        // content_hash는 provenance를 **포함하지 않는다** — 내용이 같은 코어는 출처가
        // 달라도 같은 해시여야 중복 탐지가 작동한다(미션 provenance와 같은 취급).
        const contentHash = coreHash(JSON.stringify(coreContentForHash(core)));
        // 실제 자료 원문이 이 생성에 실제로 쓰였을 때만 출처를 남긴다(seed 조건과 동일).
        if (authenticProv && sourceMode === "manual" && manualSourceText.trim()) {
          core.provenance = authenticProv;
        }
        const payload = {
          title: core.brief_note_ko || core.situation_ko?.slice(0, 40) || label,
          speech_act: form.speech_act_ui,
          learner_level: form.level,
          domain: form.domain,
          industry_sector: form.domain === "work" ? form.industry : null,
          business_function: form.domain === "work" ? form.func : null,
          mode,
          source_modality: modalityOf(mode),
          theme_code: themeCode,
          topic_code: topicCode,
          language_direction: form.language_direction,
          core_content: core,
          auto_check_result: ruleResult.result === "warning" ? "warning" : "pass",
          meta,
          generation_run_id: runId,
          generation_item_key: itemKey,
          content_hash: contentHash,
          // 배치와 같은 규칙 — 엣지가 계산한 프롬프트 지문을 그대로 저장(재계산 금지).
          prompt_snapshot_hash: (meta as { prompt_snapshot_hash?: string } | null)?.prompt_snapshot_hash ?? null,
        };
        const { data: savedId, error: saveErr } = await supabase.rpc("save_generated_core", {
          p_payload: payload as unknown as Json,
        });
        if (saveErr) throw saveErr;
        results.push({
          title: label,
          ok: true,
          core,
          rule: ruleResult.result === "warning" ? "warning" : "pass",
          scenarioId: savedId as string,
        });
      } catch (e) {
        results.push({ title: label, ok: false, error: (e as Error).message ?? "실패" });
      }
      setCoreResults([...results]);
    }
    setFinalizing(false);
  };

  const burden = computePragmaticBurden(
    form.speech_act_ui, form.pdr_power, form.pdr_distance, form.pdr_burden,
  );


  const generate = async () => {
    setLoading(true);
    setAiResult(null);
    setAiMeta(null);
    setAiError(null);
    setSaved(false);
    setSavedScenarioId(null);
    setSaveError(null);
    setMetaWarning(null);
    setBatchItems(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-scenario", {
        body: {
          speech_act: form.speech_act_ui,
          genre: CHANNEL_TO_GENRE[form.channel],
          level: form.level,
          context: COMPLEX_TASK_TO_CONTEXT[form.complex_task],
          domain: form.domain,
          industry: form.domain === "work" ? form.industry : null,
          func: form.domain === "work" ? form.func : null,
          pdr_power: form.pdr_power,
          pdr_distance: form.pdr_distance,
          pdr_burden: form.pdr_burden,
          multi: form.multi,
          reasons: form.reasons,
          coordination: form.coordination,
          language_direction: form.language_direction,
          mode: CHANNEL_TO_MODE[form.channel],
          speech_act_ui: form.speech_act_ui,
          channel_ui: form.channel,
          complex_task_ui: form.complex_task,

        },
      });
      if (error) throw error;
      if (!data?.scenario) throw new Error(data?.error ?? "빈 응답을 받았습니다.");
      const scenario = data.scenario as AiScenario;
      // 직접 입력 모드: 사용자가 입력한 원문으로 source_text만 교체 (payload/컬럼 변경 없음).
      if (sourceMode === "manual" && manualSourceText.trim()) {
        scenario.source_text = manualSourceText.trim();
      }
      setAiResult(scenario);
      setAiMeta(data.meta as AiMeta);
      if (outlineCount > 1) {
        const n = outlineCount;
        const items: BatchItem[] = Array.from({ length: n }, (_, i) => ({
          title:
            i === 0
              ? scenario.title
              : `${scenario.title} — 사례 #${i + 1} (동일 설정)`,
          auto_check: "pass",
        }));
        setBatchItems(items);

      }
    } catch (e) {
      console.error("generate-scenario invoke failed", e);
      setAiError((e as Error).message ?? "생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 1b-②: 실제 저장. RPC save_generated_scenario가 scenarios/scenario_candidates/scenario_feedback를
  // 하나의 트랜잭션으로 INSERT. 실패 시 전체 롤백.
  const saveToArchive = async () => {
    if (!aiResult || !aiMeta || saving || saved) return;
    setSaving(true);
    setSaveError(null);
    setMetaWarning(null);
    try {
      const { data, error } = await supabase.rpc("save_generated_scenario", {
        p_payload: {
          scenario: aiResult,
          meta: aiMeta,
          form: {
            speech_act: form.speech_act_ui,
            genre: CHANNEL_TO_GENRE[form.channel],
            level: form.level,
            context: COMPLEX_TASK_TO_CONTEXT[form.complex_task],
            industry: form.domain === "work" ? form.industry : null,
            func: form.domain === "work" ? form.func : null,
            pdr_power: form.pdr_power,
            pdr_distance: form.pdr_distance,
            pdr_burden: form.pdr_burden,
          },
        } as unknown as Json,
      });
      if (error) throw error;
      setSavedScenarioId(data as string);
      const metaUpdate = await persistExtraColumns(data as string);
      setMetaWarning(
        metaUpdate === "failed"
          ? "시나리오는 저장됐으나 mode·language_direction 후속 업데이트에 실패했습니다 (부분 실패). 아카이브에서 수동 보정이 필요합니다."
          : null,
      );
      setSaved(true);
    } catch (e) {
      console.error("save_generated_scenario failed", e);
      setSaveError((e as Error).message ?? "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const tags = aiResult
    ? [
        SPEECH_ACT_UI[form.speech_act_ui],
        CHANNEL_UI[form.channel],
        LEVEL[form.level],
        DOMAIN[form.domain],
        ...(form.domain === "work"
          ? [INDUSTRY[form.industry], BUSINESS_FUNCTION[form.func]]
          : []),
        COMPLEX_TASK_UI[form.complex_task],
        `${PDR_POWER_SHORT[form.pdr_power]} / ${PDR_DISTANCE_SHORT[form.pdr_distance]} / ${PDR_BURDEN_SHORT[form.pdr_burden]}`,
      ]
    : [];


  return (
    <AdminShell
      title="시나리오 개별 생성"
      description="한 건씩 조건을 정해 AI 생성 학습 콘텐츠의 상황과 원문을 만들고 내부 확인 대기 상태로 저장합니다."
    >
      {gridPrefill && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <b>미션 조립 Grid 조건을 불러왔습니다.</b>
              <span className="ml-2">
                {SPEECH_ACT_UI[gridPrefill.speechAct]} · {LEVEL[gridPrefill.level]}
                {gridPrefill.mode ? ` · ${MODE_LABEL[gridPrefill.mode]}` : ""}
                {gridPrefill.domain ? ` · ${DOMAIN[gridPrefill.domain]}` : ""}
                {gridPrefill.direction
                  ? ` · ${DIRECTION_LABEL[gridPrefill.direction]}`
                  : ""}
                {gridPrefill.theme ? ` · ${THEME_LABEL[gridPrefill.theme]}` : ""}
              </span>
            </div>
            <Link className="font-semibold underline underline-offset-2" to="/admin/library">
              라이브러리로 돌아가기
            </Link>
          </div>
          <p className="mt-1">
            조건만 자동 입력되었습니다. 개요를 확인하고 생성 버튼을 눌러야 API 호출이 시작됩니다.
          </p>
        </div>
      )}

      {/* 실제 자료에서 시작하는 일은 「실제 자료 활용 분석」이 한다. 여기에 접이식으로
          두었던 적이 있으나(2026-09-09 오전), 분석 결과가 저장되지 않고 사라지는 문제가
          화면 위치와는 무관해 다시 분리했다. 이 화면은 넘어온 후보를 받기만 한다. */}
      <p className="mt-5 rounded-lg border border-[#BA7517]/50 bg-[#FFF6E2] px-4 py-2.5 text-[12.5px] text-[#7A4A0A]">
        실제 자료(쇼츠 캡처·소설 구절·메신저 문구)에서 시작하려면{" "}
        <Link to="/admin/authentic" className="font-semibold underline">
          실제 자료 활용 분석
        </Link>
        에서 분석하고 후보를 이 화면으로 넘기세요.
      </p>
      {/* 적용된 원문이 보이지 않으면 무엇이 반영됐는지 알 수 없다 —
          manualSourceText는 입력 UI가 없는 내부 상태라 여기서 확인시킨다. */}
      {authenticProv && manualSourceText.trim() && (
        <p className="mt-2 rounded-md border border-[#6EE7B7] bg-[#ECFDF5] px-3 py-2 text-[12px] leading-relaxed text-[#065F46]">
          ✓ 실제 자료 후보가 적용되었습니다 · 원문 「{manualSourceText.slice(0, 60)}
          {manualSourceText.length > 60 ? "…" : ""}」 — 생성 시 이 원문과 출처(
          {authenticProv.source_ref ?? "출처 미입력"})가 함께 저장됩니다.
        </p>
      )}

      {/* 2-col layout */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* LEFT — settings */}
        <section className="lg:col-span-2 space-y-5 rounded-lg border border-border bg-card p-5">
          {/* 1. 과제 모드 */}
          <div>
            <SectionTitle n={1} label="과제 모드" accent="정본" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["translation", "stt_interpreting"] as const).map((m) => {
                const on = taskMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTaskModeSafe(m)}
                    className={[
                      "h-10 rounded-md text-[13px] font-medium transition-colors",
                      on
                        ? "border-2 border-[#BA7517] bg-[#FBEFD9] text-[#7A4A0A]"
                        : "border border-[#EAE4D2] bg-transparent text-muted-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {m === "translation" ? "번역 · Translation" : "통역 · Interpreting"}
                  </button>
                );
              })}
            </div>
            {taskMode === "stt_interpreting" && (
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                순차통역 · 2인 상호작용 과제로 생성됩니다.
              </p>
            )}
          </div>

          {/* 원문 확보 방식(AI/Bank/직접입력) 제거(2026-07-25) — 실제 자료는 위 「실제 자료에서 생성」 패널이,
              AI 생성은 이 폼(개요→코어)이 담당. Bank는 미구현, 직접입력은 Authentic 패널 텍스트 입력으로 흡수. */}

          {/* 3. 목표 화행 — 3x3 카드 */}
          <div>
            <SectionTitle n={2} label="목표 화행 · Speech Act" accent="핵심 변수" />
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(Object.keys(SPEECH_ACT_UI) as SpeechActUI[]).map((sa) => {
                const on = form.speech_act_ui === sa;
                return (
                  <button
                    key={sa}
                    type="button"
                    onClick={() => {
                      update("speech_act_ui", sa);
                      resetOutlines();
                    }}
                    className={[
                      "rounded-md py-2 px-1.5 text-center transition-colors leading-tight",
                      on
                        ? "border-2 border-[#BA7517] bg-[#FBEFD9]"
                        : "border border-[#EAE4D2] bg-transparent hover:bg-muted",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "text-[13.5px] font-medium",
                        on ? "text-[#7A4A0A]" : "text-foreground",
                      ].join(" ")}
                    >
                      {SPEECH_ACT_UI[sa]}
                    </div>
                    <div
                      className={[
                        "text-[10px] mt-0.5",
                        on ? "text-[#7A4A0A]" : "text-muted-foreground",
                      ].join(" ")}
                    >
                      {SPEECH_ACT_UI_EN[sa]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. P-D-R 관계 조건 + 5. 예상 화용 부담도 */}
          <div className="rounded-md bg-[#FBEFD9]/40 border border-[#EAE4D2] p-3.5">
            <SectionTitle n={3} label="P · D · R 관계 조건" accent="핵심 변수" tone="accent" />
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Field label="Power (P) · 지위" tone="accent">
                <Select
                  value={form.pdr_power}
                  onValueChange={(v) => update("pdr_power", v as PdrPower)}
                >
                  <SelectTrigger className={formField}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PDR_POWER).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Distance (D) · 거리" tone="accent">
                <Select
                  value={form.pdr_distance}
                  onValueChange={(v) => update("pdr_distance", v as PdrDistance)}
                >
                  <SelectTrigger className={formField}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PDR_DISTANCE).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Imposition (R) · 부담" tone="accent">
                <Select
                  value={form.pdr_burden}
                  onValueChange={(v) => update("pdr_burden", v as PdrBurden)}
                >
                  <SelectTrigger className={formField}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PDR_BURDEN).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* 5. 예상 화용 부담도 (파생 배지) */}
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-[#EAE4D2] bg-background px-3 py-2">
              <span className="text-[11.5px] text-muted-foreground">↘ 참고</span>
              <span className="text-[11.5px] text-muted-foreground">
                <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#FBEFD9] text-[10px] font-medium text-[#7A4A0A]">5</span>
                예상 화용 부담도
              </span>
              <span
                className={[
                  "rounded-full px-3 py-0.5 text-[11.5px] font-medium",
                  burden.level === "low" && "bg-[#EAF3DE] text-[#3B6D11]",
                  burden.level === "medium" && "bg-[#FAEEDA] text-[#854F0B]",
                  burden.level === "high" && "bg-[#FCEBEB] text-[#A32D2D]",
                ].filter(Boolean).join(" ")}
              >
                {burden.label}
              </span>
              <span className="ml-auto text-right text-[10.5px] leading-tight text-muted-foreground">
                근거: {burden.reasons.join(" · ")}
              </span>
            </div>
          </div>

          {/* 6. 언어 · 학습 · 상황 조건 */}
          <div>
            <SectionTitle n={4} label="언어 · 학습 · 상황 조건" />
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Field label="언어 방향">
                <Select
                  value={form.language_direction}
                  onValueChange={(v) => update("language_direction", v as LanguageDirection)}
                >
                  <SelectTrigger className={formField}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LANGUAGE_DIRECTION).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="학습자 수준">
                <Select value={form.level} onValueChange={(v) => update("level", v as LearnerLevel)}>
                  <SelectTrigger className={formField}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEVEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="채널 · 파생">
                <Select
                  value={form.channel}
                  onValueChange={(v) => update("channel", v as ChannelUI)}
                >
                  <SelectTrigger className={formField}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {channelsForMode.map((c) => (
                      <SelectItem key={c} value={c}>{CHANNEL_UI[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* HSK는 숙달도 등가가 아니라 중국어 생성물의 누적 어휘 참고 상한이다. */}
            <div className="mt-3 rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-3 py-2 text-[11.5px] leading-relaxed text-[#5B5446]">
              <span className="font-medium text-foreground">
                중국어 어휘 참고 상한 · HSK 1–{HSK_REFERENCE_CEILING[form.level]}급 누적
              </span>
            </div>
          </div>

          {/* 7. 도메인 · 산업 · 직무 */}
          <div>
            <SectionTitle n={5} label="도메인 · 산업 · 직무" />
            <div className="mt-2 grid items-start gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-[12px] text-muted-foreground">도메인</label>
                <div className="mt-1.5 flex h-9 items-center gap-3">
                  {(Object.keys(DOMAIN) as Domain[]).map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-[13px] cursor-pointer">
                      <input
                        type="radio"
                        name="domain"
                        value={d}
                        checked={form.domain === d}
                        onChange={() => {
                          update("domain", d);
                          if (d !== "work") {
                            update("industry", "culture_content_media" as IndustrySector);
                          }
                          // theme↔domain 허용 매핑(R1c) — 도메인을 바꿔 지금 고른 주제가
                          // 더 이상 허용되지 않으면(예: 학교주제 유지한 채 직장으로 전환)
                          // 조용히 실패하는 대신 유효한 첫 주제로 즉시 맞춘다.
                          if (!THEME_ALLOWED_DOMAINS[themeCode].includes(d)) {
                            const next = THEME_CODES.find((t) => THEME_ALLOWED_DOMAINS[t].includes(d));
                            if (next) setThemeCode(next);
                          }
                        }}
                        className="accent-[#BA7517]"
                      />
                      {DOMAIN[d]}
                    </label>
                  ))}
                </div>
              </div>
              {form.domain === "work" && (
                <div>
                  <label className="text-[12px] text-muted-foreground">
                    산업 분야 <span className="text-muted-foreground/70">· 직장만</span>
                  </label>
                  <Select
                    value={form.industry}
                    onValueChange={(v) => update("industry", v as IndustrySector)}
                  >
                    <SelectTrigger className={`mt-1.5 ${formField}`}><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto z-50">
                      {Object.entries(INDUSTRY).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.domain === "work" && (
                <div>
                  <label className="text-[12px] text-muted-foreground">
                    직무 기능 <span className="text-muted-foreground/70">· 직장만</span>
                  </label>
                  <Select
                    value={form.func}
                    onValueChange={(v) => update("func", v as BusinessFunction)}
                  >
                    <SelectTrigger className={`mt-1.5 ${formField}`}><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto z-50">
                      {BUSINESS_FUNCTION_PRIMARY.map((code) => (
                        <SelectItem key={code} value={code}>{BUSINESS_FUNCTION[code]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    산업 배경 안에서 학습자가 수행할 실제 업무를 구체화합니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 7b. 주제(theme) — 편성 메타(코어 CHECK 필수) */}
          <div>
            <div className="text-[12px] font-medium text-muted-foreground">주제 · theme (편성 필터 축)</div>
            {/* 도메인이 허용하지 않는 주제는 아예 목록에서 뺀다 — 고른 뒤 생성이 실패하는
                (theme/domain 불일치, R1c) 조합을 화면에서부터 막는다. */}
            <Select value={themeCode} onValueChange={(v) => setThemeCode(v as ThemeCode)}>
              <SelectTrigger className="mt-1.5 h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_CODES.filter((t) => THEME_ALLOWED_DOMAINS[t].includes(form.domain)).map((t) => (
                  <SelectItem key={t} value={t}>{THEME_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10.5px] text-muted-foreground">
              현재 도메인({DOMAIN[form.domain]})에서 고를 수 있는 주제만 표시됩니다.
            </p>
          </div>

          {/* 8. 개요 후보 수 */}
          <div>
            <SectionTitle n={6} label="개요 후보 수" />
            <div className="mt-2 flex gap-2">
              {([1, 3, 5] as const).map((n) => {
                const on = outlineCount === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setOutlineCountSafe(n)}
                    className={[
                      "flex-1 h-9 rounded-md text-[13px] font-medium transition-colors",
                      on
                        ? "border-2 border-[#BA7517] bg-[#FBEFD9] text-[#7A4A0A]"
                        : "border border-[#EAE4D2] bg-transparent text-muted-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {n}개
                  </button>
                );
              })}
            </div>

            {/* 개요 생성 (action:"outline" — 1회 호출로 N개 개요) */}
            <button
              type="button"
              onClick={generateOutlines}
              disabled={outlineLoading || finalizing}
              className="mt-2.5 w-full h-10 rounded-md border border-[#EAE4D2] bg-transparent text-[13px] text-[#1d2336] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              🔎 {outlineLoading ? "개요 생성 중..." : `상황 개요 ${outlineCount}개 생성`}
            </button>
            <p className="mt-1.5 text-center text-[10.5px] text-muted-foreground">
              개요를 먼저 확인하고, 선택한 것만 전체 시나리오로 생성됩니다
            </p>

            {outlineError && (
              <div className="mt-2 rounded-md border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-[11.5px] text-[#991B1B]">
                개요 생성 실패: {outlineError}
              </div>
            )}

            {outlines && outlines.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                <div className="text-[11px] text-muted-foreground">
                  목표 화행 <b className="text-[#7A4A0A]">{SPEECH_ACT_UI[form.speech_act_ui]}</b> · 개요 {outlines.length}개 · 체크한 것만 생성
                </div>
                {outlines.map((o, i) => {
                  const on = selectedOutlines.has(i);
                  return (
                    <label
                      key={i}
                      className={[
                        "flex items-start gap-2 rounded-md border px-3 py-2 text-[12.5px] cursor-pointer",
                        on ? "border-[#BA7517] bg-[#FBEFD9]" : "border-[#EAE4D2] bg-transparent",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleOutline(i)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium text-[#1d2336]">{o.title || "(제목 없음)"}</span>
                        {o.situation && (
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                            {o.situation}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
                <Button
                  onClick={generateCores}
                  disabled={finalizing || selectedOutlines.size === 0}
                  className="w-full bg-[#1d2336] text-white hover:bg-[#1d2336]/90 disabled:opacity-60"
                >
                  ✨ {finalizing ? "시나리오 생성·저장 중..." : `선택한 ${selectedOutlines.size}개 개요로 시나리오 생성`}
                </Button>
              </div>
            )}

            {coreResults && (
              <div className="mt-2.5 space-y-1">
                {coreResults.map((r, i) => (
                  <div
                    key={i}
                    className={[
                      "rounded-md border px-3 py-2 text-[11.5px]",
                      r.ok
                        ? "border-[#6EE7B7] bg-[#D1FAE5] text-[#065F46]"
                        : "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]",
                    ].join(" ")}
                  >
                    <span className="font-medium">
                      {r.ok ? "✓" : "✗"} {r.title}
                      {r.ok && r.rule === "warning" && <span className="ml-1 text-[10px] text-[#92400E]">(경고)</span>}
                    </span>
                    {!r.ok && r.error && <span className="mt-0.5 block text-[10.5px]">{r.error}</span>}
                    {r.ok && r.scenarioId && (
                      <span className="mt-0.5 block font-mono text-[10px] opacity-80">{r.scenarioId}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>


        {/* RIGHT — preview */}
        <section className="lg:col-span-3 rounded-lg border border-border bg-card p-5">
          <h2 className="text-[14px] font-medium text-[#1d2336]">생성 결과 미리보기</h2>
          {saved && savedScenarioId && (
            <div className="mt-3 rounded-lg border border-[#6EE7B7] bg-[#D1FAE5] p-3">
              <p className="text-[12.5px] font-medium text-[#065F46]">
                ✓ 시나리오가 교수자 감수 대기 상태로 저장되었습니다.
              </p>
              <p className="mt-1 text-[11.5px] text-[#065F46]/85">
                scenario_id: <code className="font-mono">{savedScenarioId}</code>
                &nbsp;/&nbsp; 승인 상태: needs_review &nbsp;/&nbsp; 용도: archived_only
              </p>
            </div>
          )}
          {saveError && (
            <div className="mt-3 rounded-md border border-[#FCA5A5] bg-[#FEE2E2] p-3 text-[12.5px] text-[#991B1B]">
              저장 실패: {saveError}
            </div>
          )}
          {metaWarning && (
            <div className="mt-2 rounded-md border border-[#FCD34D] bg-[#FEF3C7] p-2.5 text-[11.5px] text-[#92400E]">
              ⚠ {metaWarning}
            </div>
          )}
          <div className="mt-2.5">
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#EAE4D2] border-t-[#1d2336]" />
                <p className="mt-3 text-[12px] text-muted-foreground">생성 중...</p>
              </div>
            )}

            {finalizing && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#EAE4D2] border-t-[#1d2336]" />
                <p className="mt-3 text-[12px] text-muted-foreground">시나리오 생성 중...</p>
              </div>
            )}

            {!finalizing && coreResults && (
              <div className="space-y-4">
                {coreResults.map((r, i) => (
                  <div key={i} className="space-y-2.5 rounded-lg border border-border bg-background p-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={[
                          "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
                          r.ok ? "border-[#6EE7B7] bg-[#D1FAE5] text-[#065F46]" : "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]",
                        ].join(" ")}
                      >
                        {r.ok ? "✓ 저장됨(draft)" : "✗ 실패"}
                      </span>
                      {r.rule && (
                        <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                          규칙검사 {r.rule}
                        </span>
                      )}
                      <span className="text-[12.5px] font-medium text-foreground">{r.title}</span>
                    </div>
                    {r.error && (
                      <div className="rounded-md border border-[#FCA5A5] bg-[#FEE2E2] px-2.5 py-1.5 text-[11.5px] text-[#991B1B]">{r.error}</div>
                    )}
                    {r.core && typeof r.core.situation_ko === "string" && (
                      <div>
                        <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-[#8a857c]">상황</div>
                        <div className="rounded-md border border-[#FAD338] bg-[#FAD338]/15 p-2.5 text-[12.5px] leading-relaxed">{r.core.situation_ko as string}</div>
                      </div>
                    )}
                    {r.core && typeof r.core.source_text === "string" && (
                      <div>
                        <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-[#8a857c]">원문 · source_text</div>
                        <div className="rounded-md border border-[#EAE4D2] bg-[#FAF7EE] p-2.5 text-[12.5px] leading-relaxed">{r.core.source_text as string}</div>
                      </div>
                    )}
                    {r.core && typeof r.core.preceding_turn === "string" && r.core.preceding_turn && (
                      <div>
                        <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-[#8a857c]">선행 발화</div>
                        <div className="rounded-md border border-[#DBEAFE] bg-[#EFF6FF] p-2.5 text-[12px] leading-relaxed text-[#1E40AF]">{r.core.preceding_turn as string}</div>
                      </div>
                    )}
                    {r.ok && r.scenarioId && (
                      <div className="font-mono text-[10px] text-muted-foreground">scenario_id: {r.scenarioId}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!loading && aiError && (
              <div className="rounded-md border border-[#FCA5A5] bg-[#FEE2E2] p-3 text-[12.5px] text-[#991B1B]">
                생성 실패: {aiError}
              </div>
            )}

            {!loading && aiResult && (
              <div className="space-y-5">
                {outlineCount > 1 && batchItems && (
                  <div className="rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-3 py-2">
                    <p className="text-[12.5px] font-medium text-[#5B5446]">
                      총 {batchItems.length}개의 시나리오가 생성 예정입니다.
                    </p>
                  </div>
                )}

                <h3 className="text-[15px] font-medium text-foreground leading-snug">
                  {aiResult.title}
                </h3>

                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a857c] uppercase tracking-wide">
                    상황 카드
                  </div>
                  <div className="rounded-md border border-[#FAD338] bg-[#FAD338]/15 p-3 text-[13px] leading-relaxed text-foreground">
                    {aiResult.situation}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a857c] uppercase tracking-wide">
                    한국어 원문 (source_text)
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-md border border-[#EAE4D2] bg-[#FAF7EE] p-3 text-[13px] leading-relaxed text-foreground">
                    {aiResult.source_text}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <div className="text-[11px] font-medium text-[#8a857c] uppercase tracking-wide">
                      중국어 후보 번역안 · 총 {aiResult.candidates.length}개
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                      directness 1(완곡) ~ 5(직접)
                    </div>
                  </div>
                  <div className="space-y-2">
                    {aiResult.candidates.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-border bg-background p-3 space-y-1.5"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                            #{i + 1}
                          </span>
                          <span
                            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] ${APPROPRIATENESS_TONE[c.appropriateness_label]}`}
                          >
                            {APPROPRIATENESS_KO[c.appropriateness_label]}
                          </span>
                          <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            directness {c.directness_level}
                          </span>
                          {c.failed_challenge.map((f) => (
                            <span
                              key={f}
                              className="inline-flex items-center rounded bg-[#FEE2E2] px-1.5 py-0.5 text-[10.5px] text-[#991B1B]"
                            >
                              실패: {CHALLENGE_KO[f] ?? f}
                            </span>
                          ))}
                        </div>
                        <div className="text-[13px] leading-relaxed text-foreground">
                          {c.candidate_text}
                        </div>
                        <div className="text-[11.5px] leading-relaxed text-muted-foreground">
                          <span className="text-[#8a857c]">근거 · </span>
                          {c.rationale}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-[#8a857c] uppercase tracking-wide">
                    3관점 피드백
                  </div>
                  <div className="space-y-2">
                    {([
                      ["teacher", "🎓 통번역 교수자", aiResult.feedback.teacher],
                      ["native", "🀄 중국어 네이티브", aiResult.feedback.native],
                      ["field", "💼 현장 실무자", aiResult.feedback.field_expert],
                    ] as const).map(([k, label, text]) => (
                      <div
                        key={k}
                        className="rounded-md border border-border bg-background p-3"
                      >
                        <div className="text-[12px] font-medium text-[#1d2336]">{label}</div>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                          {text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {aiMeta && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5">
                      provider: {aiMeta.provider}
                    </span>
                    <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5">
                      model: {aiMeta.model}
                    </span>
                    <span className="inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5">
                      prompt_version: {aiMeta.prompt_version}
                    </span>
                    <span className="ml-auto">
                      생성 시각: {new Date(aiMeta.generated_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={generate}
                    disabled={saving}
                    className="border-border bg-transparent text-[13px]"
                  >
                    ↻ 다시 생성
                  </Button>
                  <Button
                    onClick={saveToArchive}
                    disabled={saving || saved}
                    className="bg-[#1d2336] text-[13px] text-white hover:bg-[#1d2336]/90 disabled:opacity-60"
                  >
                    {saved ? "✓ 저장됨" : saving ? "저장 중..." : "💾 아카이브에 저장"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
};

const Field = ({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "accent";
  children: React.ReactNode;
}) => (
  <div>
    <label
      className={[
        "text-[12px] font-medium",
        tone === "accent" ? "text-[#7A4A0A]" : "text-muted-foreground",
      ].join(" ")}
    >
      {label}
    </label>
    <div className="mt-1.5">{children}</div>
  </div>
);

const SectionTitle = ({
  n,
  label,
  accent,
  tone,
}: {
  n: number;
  label: string;
  accent?: string;
  tone?: "accent";
}) => (
  <h3
    className={[
      "flex items-center gap-1.5 text-[12px] font-medium",
      tone === "accent" ? "text-[#7A4A0A]" : "text-muted-foreground",
    ].join(" ")}
  >
    <span
      className={[
        "inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10.5px] font-semibold",
        tone === "accent"
          ? "bg-background text-[#7A4A0A]"
          : "bg-[#FBEFD9] text-[#7A4A0A]",
      ].join(" ")}
    >
      {n}
    </span>
    <span>{label}</span>
    {accent && <span className="text-[#7A4A0A] font-normal">· {accent}</span>}
  </h3>
);


export default AdminGenerator;
