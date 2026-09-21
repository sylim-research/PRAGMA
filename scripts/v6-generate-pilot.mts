// v6 생성기 파일럿 — 저장된 행(tmp/rep_<prefix>.json)의 코어로 mission_v6 초안을 로컬에서 만든다.
// DB에 쓰지 않는다. 같은 행의 사람 집필판과 나란히 비교할 md를 함께 쓴다.
//
//   npx vite-node scripts/v6-generate-pilot.mts <rep.json> [--dry] [--model gpt-4o] [--out tmp/v6-pilot]
//
// --dry = 프롬프트만 파일로 쓰고 모델을 부르지 않는다(키 불필요).
// 키 = 환경변수 OPENAI_API_KEY, 없으면 저장소 루트의 .env.openai(OPENAI_API_KEY=...; .gitignore의 .env.* 대상).
// 프롬프트 문자열은 Edge와 같은 supabase/functions/_shared/missionV6Generation.ts에서 만든다.
// 호출 예산 = 초안 1 + 수리 최대 1(설계안 v2 §5).

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  buildMissionV6RepairUserPrompt,
  buildMissionV6SystemPrompt,
  buildMissionV6UserPrompt,
  type V6CoreForPrompt,
  type V6RowContext,
} from "../supabase/functions/_shared/missionV6Generation.ts";
import { buildOpenAIChatRequest } from "../supabase/functions/_shared/openaiRequestContract.ts";
import { assembleMissionV6Draft, featureForV6Prompt, toV6GenerationExemplar, type V6AuthoringIssue } from "@/lib/pragma/missionV6Assemble";
import { MissionV6Schema } from "@/lib/pragma/missionV6";
import { checkMission, type CheckContext } from "@/lib/pragma/missionRules";

const args = process.argv.slice(2);
const rowFile = args.find(arg => arg.endsWith(".json"));
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dry = args.includes("--dry");
const model = flag("--model") ?? "gpt-4o";
const outDir = flag("--out") ?? "tmp/v6-pilot";
// --exemplar <rep.json> = 같은 화행의 승인된 사람판(비교 대상 슬롯이 아닌 것).
const exemplarFile = flag("--exemplar");
if (!rowFile) throw new Error("사용법: vite-node scripts/v6-generate-pilot.mts <rep.json> [--dry] [--model gpt-4o]");

const row = JSON.parse(readFileSync(rowFile, "utf8"));
const coreContent = row.core_content;
if (!coreContent?.source_text || !Array.isArray(coreContent.focal_segments)) throw new Error("core_content 없음");
const act = row.speech_act;
const direction = row.language_direction ?? coreContent.direction;
// 행의 mode는 `stt_interpreting`으로도 저장된다 → 미션 DCT는 `interpreting`.
const mode = row.mode === "interpreting" || row.mode === "stt_interpreting" ? "interpreting" : "translation";
if ((mode === "interpreting") !== (coreContent.source_modality === "spoken")) throw new Error(`행 mode(${row.mode})와 코어 source_modality(${coreContent.source_modality}) 불일치 — 생성 전 차단`);
const featureCode = row.target_feature;
const prefix = basename(rowFile).replace(/^rep_/, "").replace(/\.json$/, "");

const core: V6CoreForPrompt & { source_modality?: string } = {
  source_text: coreContent.source_text,
  focal_segments: coreContent.focal_segments,
  situation_ko: coreContent.situation_ko,
  relation_ko: coreContent.relation_ko,
  pdr: coreContent.pdr,
  channel: coreContent.channel,
  usable_facts: coreContent.usable_facts,
  context_spec: coreContent.context_spec,
  source_modality: coreContent.source_modality,
};
const rowCtx: V6RowContext = {
  learner_level: row.learner_level ?? "intermediate",
  domain: row.domain ?? "daily",
  theme_code: row.theme_code, topic_code: row.topic_code, industry: row.industry_sector ?? null,
};
const exemplarRow = exemplarFile ? JSON.parse(readFileSync(exemplarFile, "utf8")) : null;
if (exemplarRow && (exemplarRow.scenario_id === row.scenario_id || exemplarRow.speech_act !== act)) throw new Error("본보기는 같은 화행의 다른 슬롯이어야 함");
const system = buildMissionV6SystemPrompt({ act, direction, mode, feature: featureForV6Prompt(featureCode, direction),
  exemplar: exemplarRow ? toV6GenerationExemplar(exemplarRow.mission_content) : undefined });
const user = buildMissionV6UserPrompt({ core, row: rowCtx });
mkdirSync(outDir, { recursive: true });
const promptHash = createHash("sha256").update(system).digest("hex");
writeFileSync(join(outDir, `${prefix}.prompt.md`), `# system (${promptHash.slice(0, 12)})\n\n${system}\n\n# user\n\n${user}\n`);
console.log(`[${prefix}] ${act} · ${direction} · ${mode} · ${featureCode} — 프롬프트 ${system.length + user.length}자`);
if (dry) process.exit(0);

function apiKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  for (const file of [".env.openai", "../../.env.openai"]) {
    if (existsSync(file)) {
      const match = readFileSync(file, "utf8").match(/^OPENAI_API_KEY=(.+)$/m);
      if (match) return match[1].trim();
    }
  }
  throw new Error("OPENAI_API_KEY 없음 — 환경변수 또는 .env.openai");
}

// 추론 모델(gpt-5·o 계열)은 temperature를 받지 않고, 추론 토큰까지 출력 한도에 들어간다.
const reasoningModel = /^(gpt-5|o\d)/.test(model);
function requestBody(userPrompt: string) {
  const body: Record<string, unknown> = buildOpenAIChatRequest({ model, system, user: userPrompt, temperature: 0.4, maxCompletionTokens: reasoningModel ? 40000 : 12000 });
  if (reasoningModel) delete body.temperature;
  return body;
}

async function callModel(userPrompt: string) {
  const startedAt = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody(userPrompt)),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  const choice = body.choices?.[0];
  return { content: String(choice?.message?.content ?? ""), finish: choice?.finish_reason, usage: body.usage, ms: Date.now() - startedAt };
}

const ctx: CheckContext = {
  speech_act: act, level: rowCtx.learner_level as CheckContext["level"], domain: rowCtx.domain as CheckContext["domain"],
  theme_code: row.theme_code, topic_code: row.topic_code, industry: rowCtx.industry,
  // 규칙 검사의 셀 비교(R16)는 행에 저장된 값(stt_interpreting 포함)으로 한다.
  mode: row.mode, source_modality: row.source_modality ?? coreContent.source_modality,
  planned_target_feature: featureCode, direction,
};

type Finding = { source: "schema" | "rules" | "authoring"; level: string; path: string; message: string };
async function evaluate(raw: unknown, attempt: number, repaired: boolean) {
  const { draft, issues } = await assembleMissionV6Draft({
    raw, core, act, direction, mode, featureCode, model, generationAttempt: attempt, repaired,
    sha256Hex: text => createHash("sha256").update(text).digest("hex"),
  });
  const findings: Finding[] = issues.map((issue: V6AuthoringIssue) => ({ source: "authoring", ...issue }));
  const parsed = MissionV6Schema.safeParse(draft);
  if (!parsed.success) {
    findings.push(...parsed.error.issues.map(issue => ({ source: "schema" as const, level: "fail", path: issue.path.join("."), message: issue.message })));
  } else {
    const check = checkMission(draft, ctx, coreContent);
    findings.push(...check.violations.map(v => ({ source: "rules" as const, level: v.level, path: v.id, message: v.message })));
  }
  return { draft, findings, fails: findings.filter(f => f.level === "fail") };
}

const calls: unknown[] = [];
const first = await callModel(user);
calls.push({ kind: "draft", finish: first.finish, usage: first.usage, ms: first.ms });
if (first.finish === "length") throw new Error("출력 절단(finish_reason=length) — 저장하지 않음");
const firstRaw = JSON.parse(first.content);
let result = await evaluate(firstRaw, 1, false);
const firstResult = result;
let finalRaw = firstRaw;
if (result.fails.length) {
  console.log(`[${prefix}] 초안 fail ${result.fails.length}건 → 수리 1회`);
  const repair = await callModel(buildMissionV6RepairUserPrompt({ core, row: rowCtx, previousDraft: firstRaw, violations: result.fails }));
  calls.push({ kind: "repair", finish: repair.finish, usage: repair.usage, ms: repair.ms });
  if (repair.finish !== "length") {
    finalRaw = JSON.parse(repair.content);
    result = await evaluate(finalRaw, 2, true);
  }
}

const verdict = result.fails.length ? "fail" : "pass";
writeFileSync(join(outDir, `${prefix}.generated.json`), JSON.stringify({
  source_scenario_id: row.scenario_id, verdict, model, prompt_hash: promptHash, calls,
  first_findings: firstResult.findings, findings: result.findings,
  raw_first: firstRaw, raw_final: finalRaw, mission_content: result.draft,
}, null, 2));

// 사람판과 나란히 읽는 비교표
const human = row.mission_content;
const gen = result.draft;
const line = (label: string, a: unknown, b: unknown) => `| ${label} | ${fmt(a)} | ${fmt(b)} |`;
const fmt = (v: unknown) => String(typeof v === "string" ? v : JSON.stringify(v ?? "")).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
const md: string[] = [`# ${prefix} — ${act} · ${direction} · ${mode} (생성 ${verdict})`, "",
  `코어 원문: ${core.source_text}`, "", "## 검사 결과(최종)", "",
  ...(result.findings.length ? result.findings.map(f => `- [${f.level}] ${f.source} ${f.path}: ${f.message}`) : ["- 없음"]), ""];
for (let i = 0; i < 5; i++) {
  const h = human.mpj_items[i] ?? {}, g = gen.mpj_items[i] ?? {};
  md.push(`## 문항 ${i + 1}`, "", "| | 사람판 | 생성판 |", "|---|---|---|",
    line("제목", h.title, g.title), line("상황", h.situation_ko, g.situation_ko), line("관계", h.relation_ko, g.relation_ko),
    line("채널·PDR", `${h.channel} ${JSON.stringify(h.pdr)}`, `${g.channel} ${JSON.stringify(g.pdr)}`),
    line("원문", h.source, g.source));
  if (h.target || g.target) md.push(line("목표문", h.target, g.target));
  if (h.accepted_scale_codes) md.push(line("척도", h.reference_scale_code, g.reference_scale_code));
  if (i === 1) {
    const opts = (item: any) => (item.reason_choice?.options ?? []).map((o: any) => `${o.id === item.reason_choice?.accepted_id ? "✅" : "·"} ${o.text}`).join("<br>");
    md.push(line("이유", opts(h), opts(g)));
  }
  if (i === 2) {
    const cs = (item: any) => (item.corrections ?? []).map((c: any) => `${c.is_valid ? "✅" : "❌"} ${c.text}<br>　└ ${c.note_ko}`).join("<br>");
    md.push(line("교정안", cs(h), cs(g)));
  }
  if (i === 3) {
    md.push(line("참고안", (h.reference_alternatives ?? []).join("<br>"), (g.reference_alternatives ?? []).join("<br>")));
    md.push(line("대비", h.contrast ? `${h.contrast.context_ko}: ${h.contrast.target}` : "(없음)", g.contrast ? `${g.contrast.context_ko}: ${g.contrast.target}` : "(없음)"));
  }
  if (i === 4) {
    const cands = (item: any) => (item.candidates ?? []).map((c: any) => `[${c.accepted_band_codes.join("/")}] ${c.text}<br>　└ ${c.note_ko}`).join("<br>");
    md.push(line("후보", cands(h), cands(g)));
  }
  md.push(line("해설", h.explanation_ko, g.explanation_ko), "");
}
const ht = human.production_task, gt = gen.production_task;
md.push("## DCT", "", "| | 사람판 | 생성판 |", "|---|---|---|",
  line("상황", ht.situation_ko, gt.situation_ko), line("관계", ht.relation_ko, gt.relation_ko), line("안내", ht.learner_context_ko, gt.learner_context_ko),
  line("참고안", ht.reference_alternatives.map((a: any) => a.text).join("<br>"), (gt.reference_alternatives ?? []).map((a: any) => a.text).join("<br>")), "",
  "## 핵심 다섯 줄", "", "| | 사람판 | 생성판 |", "|---|---|---|",
  ...[0, 1, 2, 3, 4].map(i => line(String(i + 1), `${human.lesson_points[i]?.label} — ${human.lesson_points[i]?.text}`, `${gen.lesson_points[i]?.label} — ${gen.lesson_points[i]?.text}`)));
writeFileSync(join(outDir, `${prefix}.compare.md`), md.join("\n"));
const tokens = (calls as any[]).reduce((sum, c) => sum + (c.usage?.total_tokens ?? 0), 0);
console.log(`[${prefix}] ${verdict} · 호출 ${calls.length}회 · 토큰 ${tokens} · fail ${result.fails.length} · warning ${result.findings.length - result.fails.length}`);
