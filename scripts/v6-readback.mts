// 배치 readback diff 문서 — 박사님이 읽는 단위(생산라인 문서 §4). 코드·DB 쓰기 없음.
//
//   npx vite-node scripts/v6-readback.mts --out <file.md> [--zh <file.txt>] <prefix>[=<scenario_id>] ...
//
// <prefix> = tmp/v6-conversion/<앞 8자리>. v5 변환 초안(승계 기준)과 후보(candidate)를 자리별로 비교해
// 「승계 그대로 / 변경(전→후) / 신규」로 나눈다. =<scenario_id>를 주면 DB 행을 읽어 hash·품질점검·검수 상태를 대조한다.
// --zh 는 DeepSeek 검토용 신규·변경 중국어 문장 목록(코드 붙임)을 쓴다 — 승계 문자열은 9/18 전수 검토 완료라 뺀다.

import { readFileSync, writeFileSync } from "node:fs";
import { convertMissionV5ToV6 } from "@/lib/mission/missionV5ToV6";

const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const outPath = opt("--out");
const zhPath = opt("--zh");
if (!outPath || !args.length) throw new Error("사용법: --out <md> [--zh <txt>] <prefix>[=<scenario_id>] ...");

type Any = Record<string, any>;
const HAN = /[一-鿿]/u;
const HANGUL = /[가-힣]/u;
const isZh = (text: unknown) => typeof text === "string" && HAN.test(text) && !HANGUL.test(text);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const empty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
const short = (text: unknown, n = 90) => { const s = typeof text === "string" ? text : JSON.stringify(text); return s.length > n ? `${s.slice(0, n)}…` : s; };

let db: any = null;
async function dbRow(id: string) {
  if (!db) {
    const { createClient } = await import("@supabase/supabase-js");
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
    db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await db.auth.signInWithPassword({ email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD! });
  }
  const { data, error } = await db.from("scenarios").select("scenario_id,mission_status,review_status,mission_content").eq("scenario_id", id).single();
  if (error) throw new Error(`DB 행 ${id}: ${error.message}`);
  return data;
}

const ITEM_FIELDS = ["title", "situation_ko", "relation_ko", "pdr", "channel", "source", "target", "accepted_scale_codes", "reference_scale_code",
  "reason_choice", "revision_examples", "corrections", "reference_alternatives", "candidates", "contrast", "explanation_ko"];
const KEY_FIELDS = new Set(["accepted_scale_codes", "reference_scale_code", "reason_choice", "corrections", "candidates"]);
const TASK_FIELDS = ["situation_ko", "relation_ko", "pdr", "source_text", "reference_alternatives"];

const md: string[] = [`# v6 readback — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, ""];
const zhLines: string[] = [];

for (const spec of args) {
  const [prefix, rowId] = spec.split("=");
  const code = prefix.split("/").pop()!;
  const source = JSON.parse(readFileSync(`${prefix}.v5.json`, "utf8"));
  const authored = JSON.parse(readFileSync(`${prefix}.authored.json`, "utf8"));
  const candidate = JSON.parse(readFileSync(`${prefix}.v6.candidate.json`, "utf8"));
  const base = convertMissionV5ToV6(source.content).draft as Any;
  const v6 = candidate.mission_content as Any;
  const hash = String(v6.provenance?.mission_content_hash ?? "");
  const rules = candidate.validation_result;
  const act = v6.learning_goal?.speech_act;
  const mode = String(v6.production_task?.mode ?? "").includes("interpreting") ? "통역" : "번역";

  let dbLine = "DB 미등록";
  if (rowId) {
    const row = await dbRow(rowId);
    const dbHash = String(row.mission_content?.provenance?.mission_content_hash ?? "");
    const qc = row.mission_content?.quality_check;
    const warnings = (qc?.issues ?? qc?.warnings ?? []) as Any[];
    dbLine = `DB \`${rowId.slice(0, 8)}\` ${row.mission_status}/${row.review_status ?? "-"} · hash ${dbHash === hash ? "일치" : `**불일치 ${dbHash.slice(0, 8)}**`} · 품질 ${qc?.verdict ?? "없음"}${warnings.length ? ` ${warnings.length}(${warnings.map(w => w.code ?? w.id ?? "?").join(",")})` : ""}`;
  }
  const grade = /판정 분류 = ([^.]+)/.exec(authored._about ?? "")?.[1] ?? "?";
  md.push(`## ${code} · ${act}·${mode} · ${source.course}`, "",
    `[${grade}] hash \`${hash.slice(0, 8)}\` · 규칙 ${rules.result}${rules.violations.length ? ` (${rules.violations.map((v: Any) => `${v.level[0]}:${v.id}`).join(", ")})` : ""} · ${dbLine}`, "");

  const inherited: string[] = [];
  const changed: string[] = [];
  const added: string[] = [];
  const zhHere: string[] = [];
  const collectZh = (label: string, value: unknown) => {
    const walk = (v: unknown, path: string) => {
      if (isZh(v)) zhHere.push(`${label}${path}\t${v}`);
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k === "text" || k === "zh" || k === "target") walk(x, path ? `${path}.${k}` : k);
    };
    walk(value, "");
  };
  const describe = (field: string, value: any): string => {
    if (field === "corrections") return (value as Any[]).map(c => `\n    - ${c.is_valid ? "O" : "X"} 「${c.text}」 — ${c.note_ko}`).join("");
    if (field === "candidates") return (value as Any[]).map(c => `\n    - ${c.accepted_band_codes.join("+")} 「${c.text}」 — ${short(c.note_ko, 70)}`).join("");
    if (field === "reference_alternatives") return (value as Any[]).map(a => `\n    - 「${typeof a === "string" ? a : a.text ?? a.zh}」`).join("");
    if (field === "reason_choice") return `${value.options.map((o: Any) => `${o.id}${value.accepted_id === o.id ? "✓" : ""} ${o.text}`).join(" / ")}`;
    if (field === "pdr") return `P ${value.p} · D ${value.d} · R ${value.r}`;
    if (field === "source" || field === "target" || field === "source_text") return `「${value}」`;
    return short(value, field === "explanation_ko" ? 140 : 110);
  };
  const compare = (label: string, fields: string[], before: Any, after: Any) => {
    const inh: string[] = [];
    for (const field of fields) {
      const a = before?.[field]; const b = after?.[field];
      if (empty(b) && empty(a)) continue;
      if (same(a, b)) { inh.push(field); continue; }
      const line = `- **${label} ${field}**${KEY_FIELDS.has(field) ? " 🔑" : ""}: `;
      if (empty(a)) added.push(line + describe(field, b));
      else changed.push(line + `${describe(field, a)} → ${describe(field, b)}`);
      if (["source", "target", "source_text", "corrections", "candidates", "reference_alternatives", "revision_examples", "contrast"].includes(field)) collectZh(`${label}.${field}`, b);
    }
    const shown = inh.filter(f => !["channel", "title"].includes(f));
    if (shown.length) inherited.push(`${label}(${shown.join("·")})`);
  };
  v6.mpj_items.forEach((item: Any, index: number) => compare(`MJT${index + 1}`, ITEM_FIELDS, base.mpj_items[index], item));
  compare("DCT", TASK_FIELDS, base.production_task, v6.production_task);
  const lessons = (v6.lesson_points as Any[]).map(lp => `${lp.item_id}「${lp.label}」`).join(" · ");

  // 자동 flag — 규칙검사가 못 보는 것만.
  const flags: string[] = [];
  const sources = v6.mpj_items.map((item: Any) => String(item.source ?? "").trim());
  const dupSources = sources.filter((s: string, i: number) => s && sources.indexOf(s) !== i);
  if (dupSources.length) flags.push(`문항 원문 중복 ${dupSources.length}`);
  const pdrs = v6.mpj_items.slice(0, 3).map((item: Any) => JSON.stringify(item.pdr));
  if (new Set(pdrs).size < 3) flags.push("1·2·3번 PDR 겹침");
  const candTexts = (v6.mpj_items[4].candidates as Any[]).map(c => c.text);
  if (new Set(candTexts).size < candTexts.length) flags.push("5번 후보 중복");
  const bandDist = (v6.mpj_items[4].candidates as Any[]).map(c => c.accepted_band_codes.join("+")).join(" / ");
  const review3 = authored._review3 ?? {};
  const review3Open = Object.entries(review3).filter(([, v]) => String(v).includes("⟪TODO"));

  md.push(`**승계 그대로**: ${inherited.join(" · ") || "없음"}`, "");
  md.push(`**변경** (${changed.length})`, ...(changed.length ? changed : ["- 없음"]), "");
  md.push(`**신규** (${added.length})`, ...(added.length ? added : ["- 없음"]), "");
  md.push(`**핵심 정리**: ${lessons}`, `**5번 대역 분포**: ${bandDist}`, "");
  md.push(`**flag**: ${flags.join(" · ") || "자동 신호 없음"} · DeepSeek 대상 신규·변경 중국어 ${zhHere.length}문장`);
  md.push(`**사람 3항목**: ${review3Open.length ? `미확인 ${review3Open.map(([k]) => k).join("·")}` : Object.entries(review3).map(([k, v]) => `${k}=${v}`).join(" · ")}`);
  if (authored._note_for_review) md.push(`**검수 메모**: ${authored._note_for_review}`);
  md.push("", "---", "");
  zhHere.forEach((line, i) => zhLines.push(`${code}-${String(i + 1).padStart(2, "0")}\t${line}`));
}

writeFileSync(outPath, md.join("\n"));
console.log(`readback 저장: ${outPath}`);
if (zhPath) { writeFileSync(zhPath, zhLines.join("\n")); console.log(`DeepSeek 목록 ${zhLines.length}문장: ${zhPath}`); }
