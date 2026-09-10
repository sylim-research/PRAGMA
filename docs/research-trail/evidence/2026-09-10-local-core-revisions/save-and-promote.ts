// Run manually with the existing Supabase admin process environment (never prints secrets).
//   save    — stores the three semantically checked local revisions as NEW draft scenario rows via
//             the existing save_generated_core RPC (needs_review / archived_only). Original rows are
//             not modified; each new row carries generation.local_revision pointing at its origin.
//   mission — promotes the four review cores (three new rows + the untouched complaint core) to full
//             MJT5+DCT1 missions with the existing promoteCore path (astra job). Nothing is approved,
//             released, or assigned to a course.
// Existing *-saved.json / *-mission.json results are preserved and never re-run.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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
const [{ supabase }, { promoteCore }, { coreContentForHash, normalizeCore }] = await Promise.all([
  import('../../../../src/integrations/supabase/client'),
  import('../../../../src/lib/pragma/promoteMission'),
  import('../../../../src/lib/pragma/coreSchema'),
]);
const here = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2];
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');
// Same deterministic content hash the batch runner uses for save_generated_core (coreBatchRun.hashString).
function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>).call(supabase, fn, args);
const db = supabase as unknown as { from: (table: string) => any };

const REVISED = [
  { key: 'w9-1', draft: 'w9-1-draft.json' },
  { key: 'w2-0', draft: 'w2-0-draft.json' },
  { key: 'pilot-reverse-opposition-v2', draft: 'pilot-reverse-opposition-draft-v2.json' },
];
const UNCHANGED = [
  { key: 'pilot-reverse-complaint', scenario_id: 'e4f36052-88a8-45cd-a33b-1a96f9d2ed5c' },
];

const { error: authError } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (authError) throw new Error(authError.message);
try {
  if (mode === 'save') {
    for (const item of REVISED) {
      const out = resolve(here, `${item.key}-saved.json`);
      if (existsSync(out)) { console.log(JSON.stringify({ key: item.key, preserved: true, new_scenario_id: readJson(out).new_scenario_id })); continue; }
      const draftRaw = readFileSync(resolve(here, item.draft), 'utf8');
      const draft = JSON.parse(draftRaw.replace(/^﻿/, ''));
      const semantic = readJson(resolve(here, `${item.key}-semantic.json`));
      if (semantic.draft_sha256 !== sha256(draftRaw)) throw new Error(`${item.key}: semantic result belongs to a different draft`);
      if (!semantic.result?.ok || semantic.result.result?.verdict !== 'pass') throw new Error(`${item.key}: semantic verdict is not pass`);
      const original = readJson(resolve(here, draft.original_artifact));
      const originalGeneration = original.result.coreContent.generation ?? {};
      const { data: row, error: rowError } = await db.from('scenarios')
        .select('scenario_id, generation_provider, generator_model, generation_prompt_version, prompt_snapshot_hash, generation_run_id, generation_item_key, business_function')
        .eq('scenario_id', draft.original_scenario_id).single();
      if (rowError) throw new Error(`${item.key}: original row lookup failed: ${rowError.message}`);
      const cell = draft.plan.cell;
      const core: Record<string, unknown> = {
        ...draft.coreContent,
        generation: {
          ...originalGeneration,
          semantic_check: semantic.result.result.check,
          local_revision: {
            revision_of_scenario_id: draft.original_scenario_id,
            draft_file: item.draft, draft_sha256: semantic.draft_sha256,
            author: draft.author, edited_at: semantic.at, semantic_run_id: semantic.run_id,
            note: 'Human-edited core content; the original generation prompt/scene_plan above describe the origin row, not this text.',
          },
        },
      };
      const normalized = normalizeCore(core);
      if (!normalized.ok) throw new Error(`${item.key}: revised core fails schema: ${JSON.stringify(normalized.error?.issues)}`);
      const payload = {
        title: core.brief_note_ko || String(core.situation_ko ?? '').slice(0, 40),
        speech_act: cell.speech_act_ui, learner_level: cell.level, domain: cell.domain,
        industry_sector: cell.industry, business_function: cell.business_function ?? row.business_function ?? null,
        mode: cell.mode, source_modality: core.source_modality, theme_code: cell.theme_code, topic_code: cell.topic_code,
        language_direction: cell.direction, core_content: core, auto_check_result: 'pass',
        meta: { provider: row.generation_provider, model: row.generator_model, prompt_version: row.generation_prompt_version },
        generation_run_id: row.generation_run_id, generation_item_key: `edited:${item.key}`,
        content_hash: hashString(JSON.stringify(coreContentForHash(core))),
        prompt_snapshot_hash: row.prompt_snapshot_hash ?? originalGeneration.prompt_snapshot_hash ?? null,
      };
      const { data: savedId, error: saveError } = await rpc('save_generated_core', { p_payload: payload });
      if (saveError) throw new Error(`${item.key}: save_generated_core failed: ${saveError.message}`);
      writeFileSync(out, JSON.stringify({
        at: new Date().toISOString(), key: item.key, draft_file: item.draft, draft_sha256: semantic.draft_sha256,
        original_scenario_id: draft.original_scenario_id, new_scenario_id: savedId,
        scope: 'New draft core row (needs_review, archived_only). Not approved, not a mission, not assigned.', payload,
      }, null, 2) + '\n');
      console.log(JSON.stringify({ key: item.key, saved: true, original_scenario_id: draft.original_scenario_id, new_scenario_id: savedId }));
    }
  } else if (mode === 'mission') {
    const targets = [
      ...REVISED.map(item => ({ key: item.key, scenario_id: readJson(resolve(here, `${item.key}-saved.json`)).new_scenario_id as string })),
      ...UNCHANGED,
    ];
    const selected = process.argv[3] ? process.argv[3].split(',') : targets.map(t => t.key);
    for (const target of targets.filter(t => selected.includes(t.key))) {
      const out = resolve(here, `${target.key}-mission.json`);
      if (existsSync(out)) { console.log(JSON.stringify({ key: target.key, preserved: true })); continue; }
      const { data: row, error: rowError } = await db.from('scenarios')
        .select('scenario_id, speech_act, learner_level, domain, industry_sector, mode, source_modality, theme_code, topic_code, language_direction, generation_run_id, generation_item_key, mission_status, core_content')
        .eq('scenario_id', target.scenario_id).single();
      if (rowError) throw new Error(`${target.key}: row lookup failed: ${rowError.message}`);
      if (row.mission_status) {
        const { data: stored } = await db.from('scenarios').select('mission_content,mission_status').eq('scenario_id', row.scenario_id).single();
        writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), key: target.key, reused: true, scenarioId: row.scenario_id, stored }, null, 2) + '\n');
        console.log(JSON.stringify({ key: target.key, reused: true, status: row.mission_status }));
        continue;
      }
      let priorStage = ''; let priorJob = '';
      // A previous interrupted run leaves `${key}-job.json`; resume that server-side job instead of paying again.
      const jobFile = resolve(here, `${target.key}-job.json`);
      const resumeJobId = existsSync(jobFile) ? (readJson(jobFile).id as string | undefined) : undefined;
      if (resumeJobId) console.log(`${target.key}: resuming job ${resumeJobId}`);
      const result = await promoteCore(row, {
        generationModel: 'astra',
        generationJobId: resumeJobId,
        onProgress: p => { if (p.phase !== priorStage) { console.log(`${target.key}: ${p.phase}`); priorStage = p.phase; } },
        onGenerationJob: job => {
          const state = `${job.id}:${job.status}:${job.completed_steps}`;
          if (state !== priorJob) { console.log(`${target.key}: job ${state}`); priorJob = state; writeFileSync(resolve(here, `${target.key}-job.json`), JSON.stringify(job, null, 2) + '\n'); }
        },
      });
      const { data: stored } = await db.from('scenarios').select('mission_content,mission_status').eq('scenario_id', row.scenario_id).single();
      writeFileSync(out, JSON.stringify({
        at: new Date().toISOString(), key: target.key, scenarioId: row.scenario_id, result, stored,
        scope: 'Automated promotion only; not instructor approval, not released, not assigned.',
      }, null, 2) + '\n');
      console.log(JSON.stringify({ key: target.key, ok: result.ok, quality: result.quality?.verdict, error: result.error, repairError: (result as { repairError?: unknown }).repairError, status: stored?.mission_status }));
      if (!result.ok || result.quality?.verdict === 'fail') { process.exitCode = 1; break; }
    }
  } else {
    throw new Error('Choose save or mission');
  }
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
