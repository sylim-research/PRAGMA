// Two steps for the corrected course cores. Run from the worktree root with the admin process env.
//   check — runs the deployed core semantic review on each edited draft and stores the verdict.
//   save  — stores each passing draft as a NEW draft core row via save_generated_core, then rewrites
//           the run's <key>-core.json so mission promotion targets the corrected row. Originals are
//           left untouched and their previous core file is kept as <key>-core.superseded.json.
// Existing result files are preserved and never overwritten.
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key), clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null, get length() { return memory.size; },
} });
const [{ supabase }, { checkCoreSemanticFit }, { coreContentForHash, normalizeCore }] = await Promise.all([
  import('../../../../../src/integrations/supabase/client'),
  import('../../../../../src/lib/pragma/coreBatchRun'),
  import('../../../../../src/lib/pragma/coreSchema'),
]);
const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(here, '../../../../../.tmp/scene-grounding/scene_grounding_course_20260910');
const RUN_ID = 'scene_grounding_course_20260910';
const KEYS = ['w6-1']; // 2026-09-11 w6-1 content blocker only
const mode = process.argv[2];
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');
function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>).call(supabase, fn, args);
const db = supabase as unknown as { from: (table: string) => any };

const { error: authError } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (authError) throw new Error(authError.message);
try {
  for (const key of KEYS) {
    const draftFile = `${key}-draft.json`;
    const raw = readFileSync(resolve(here, draftFile), 'utf8');
    const draft = JSON.parse(raw.replace(/^﻿/, ''));
    const digest = sha256(raw);
    const semanticPath = resolve(here, `${key}-semantic.json`);

    if (mode === 'check') {
      if (existsSync(semanticPath)) {
        const previous = readJson(semanticPath);
        if (previous.draft_sha256 !== digest) throw new Error(`${key}: stored result belongs to a different draft; preserve it first`);
        console.log(JSON.stringify({ key, preserved: true, verdict: previous.result?.result?.verdict }));
        continue;
      }
      const result = await checkCoreSemanticFit(draft.plan.cell, draft.coreContent, RUN_ID, `corrected:${key}`);
      writeFileSync(semanticPath, JSON.stringify({
        at: new Date().toISOString(), run_id: RUN_ID, draft_file: draftFile, draft_sha256: digest,
        scope: 'Automated core semantic review only; not instructor approval or whole-mission validation', result,
      }, null, 2) + '\n');
      console.log(JSON.stringify({ key, ok: result.ok, verdict: result.ok ? result.result.verdict : undefined,
        issues: result.ok ? result.result.issues : undefined, error: result.ok ? undefined : result.error }));
      continue;
    }

    if (mode !== 'save') throw new Error('Choose check or save');
    const savedPath = resolve(here, `${key}-saved.json`);
    if (existsSync(savedPath)) { console.log(JSON.stringify({ key, preserved: true, new_scenario_id: readJson(savedPath).new_scenario_id })); continue; }
    const semantic = readJson(semanticPath);
    if (semantic.draft_sha256 !== digest) throw new Error(`${key}: semantic result belongs to a different draft`);
    if (!semantic.result?.ok || semantic.result.result?.verdict !== 'pass') throw new Error(`${key}: semantic verdict is not pass`);

    const { data: row, error: rowError } = await db.from('scenarios')
      .select('scenario_id, generation_provider, generator_model, generation_prompt_version, prompt_snapshot_hash, business_function')
      .eq('scenario_id', draft.original_scenario_id).single();
    if (rowError) throw new Error(`${key}: original row lookup failed: ${rowError.message}`);
    const originalCore = readJson(resolve(runDir, `${key}-core.json`)).result.coreContent;
    const cell = draft.plan.cell;
    const core: Record<string, unknown> = {
      ...draft.coreContent,
      generation: {
        ...(originalCore.generation ?? {}),
        semantic_check: semantic.result.result.check,
        local_revision: {
          revision_of_scenario_id: draft.original_scenario_id,
          draft_file: draftFile, draft_sha256: digest, author: draft.author,
          edited_at: semantic.at, reason: draft.revision_reason,
          note: 'Human-corrected core text; the generation prompt data above describes the origin row, not this text.',
        },
      },
    };
    const normalized = normalizeCore(core);
    if (!normalized.ok) throw new Error(`${key}: corrected core fails schema`);
    const payload = {
      title: core.brief_note_ko || String(core.situation_ko ?? '').slice(0, 40),
      speech_act: cell.speech_act_ui, learner_level: cell.level, domain: cell.domain,
      industry_sector: cell.industry, business_function: cell.business_function ?? row.business_function ?? null,
      mode: cell.mode, source_modality: core.source_modality, theme_code: cell.theme_code, topic_code: cell.topic_code,
      language_direction: cell.direction, core_content: core, auto_check_result: 'pass',
      meta: { provider: row.generation_provider, model: row.generator_model, prompt_version: row.generation_prompt_version },
      generation_run_id: RUN_ID, generation_item_key: `corrected:${key}`,
      content_hash: hashString(JSON.stringify(coreContentForHash(core))),
      prompt_snapshot_hash: row.prompt_snapshot_hash ?? null,
    };
    const { data: savedId, error: saveError } = await rpc('save_generated_core', { p_payload: payload });
    if (saveError) throw new Error(`${key}: save_generated_core failed: ${saveError.message}`);
    writeFileSync(savedPath, JSON.stringify({
      at: new Date().toISOString(), key, draft_file: draftFile, draft_sha256: digest,
      original_scenario_id: draft.original_scenario_id, new_scenario_id: savedId,
      scope: 'New draft core row (needs_review, archived_only). Not approved, not a mission, not assigned.', payload,
    }, null, 2) + '\n');
    // Point the run at the corrected row so `run.ts mission` promotes it, keeping the old file.
    const runCorePath = resolve(runDir, `${key}-core.json`);
    renameSync(runCorePath, resolve(runDir, `${key}-core.superseded.json`));
    writeFileSync(runCorePath, JSON.stringify({
      at: new Date().toISOString(), plan: draft.plan,
      result: { ok: true, cell, scenarioId: savedId, coreContent: core, ruleResult: 'pass', ruleFindings: [], terminalStage: 'core_eligible' },
      note: 'Corrected core; supersedes the generated one kept alongside as *-core.superseded.json.',
    }, null, 2) + '\n');
    console.log(JSON.stringify({ key, saved: true, original_scenario_id: draft.original_scenario_id, new_scenario_id: savedId }));
  }
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
