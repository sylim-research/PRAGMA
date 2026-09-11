// Production gate re-run for the course missions after the quality_v23 critic (reason_branch severity) deploy.
// Content is NOT edited: each mission goes through reviseMissionDraft with no edits, which re-runs the rule check
// and the production critic and saves an append-only revision whose instructional content (and therefore the
// content-review source/content hash) is unchanged — only quality_check/authoring/provenance hash fields move.
// Keys already re-gated by c9-fix/content-fix.ts are skipped. Result: gate-rerun-v23.json (one entry per key).
//   node run-with-env.cjs .../c9-fix/gate-rerun.ts <manifest.json> [skipKeys]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k), clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null, get length() { return memory.size; },
} });
const [{ supabase }, promote, { CURRENT_MISSION_QUALITY_PROMPT_VERSION }] = await Promise.all([
  import('../../../../../src/integrations/supabase/client'),
  import('../../../../../src/lib/pragma/promoteMission'),
  import('../../../../../supabase/functions/_shared/contentRelease'),
]);
const here = dirname(fileURLToPath(import.meta.url));
const db = supabase as unknown as { from: (t: string) => any };
const manifest = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8').replace(/^﻿/, ''));
const skip = new Set((process.argv[3] ?? '').split(',').filter(Boolean));
// One result file per critic version: a v23 run (superseded by v24 after it regressed) must not make v24 skip keys.
const out = resolve(here, `gate-rerun-${CURRENT_MISSION_QUALITY_PROMPT_VERSION}.json`);
const results: Record<string, unknown> = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')).results : {};

const { error: authError } = await supabase.auth.signInWithPassword({ email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD! });
if (authError) throw new Error(authError.message);
try {
  for (const entry of manifest.rows as Array<{ key: string; scenario_id: string }>) {
    if (skip.has(entry.key) || results[entry.key]) { console.log(JSON.stringify({ key: entry.key, skipped: true })); continue; }
    const { data: row, error } = await db.from('scenarios').select('*').eq('scenario_id', entry.scenario_id).single();
    if (error) throw new Error(`${entry.key}: ${error.message}`);
    if (row.mission_status !== 'generated') throw new Error(`${entry.key}: mission_status=${row.mission_status}`);
    const before = row.mission_content?.quality_check ?? null;
    // Same client path as the admin revision; a failed call holds this item and the batch moves on (no retry).
    const result = await promote.reviseMissionDraft(row, { itemBlocks: [] }, 'ai').catch((cause: unknown) => ({ ok: false, error: String(cause) } as any));
    const quality = result.quality as any;
    if (quality && quality.prompt_version !== CURRENT_MISSION_QUALITY_PROMPT_VERSION) throw new Error(`${entry.key}: gate ran with ${quality.prompt_version}`);
    results[entry.key] = { at: new Date().toISOString(), scenario_id: entry.scenario_id, ok: result.ok, error: result.error ?? null, rule: result.ruleResult ?? null,
      before: before ? { verdict: before.verdict, prompt_version: before.prompt_version, findings: (before.findings ?? []).map((f: any) => ({ code: f.code, severity: f.severity, where: f.where })) } : null,
      after: quality ? { verdict: quality.verdict, prompt_version: quality.prompt_version, findings: quality.findings } : null };
    writeFileSync(out, JSON.stringify({ scope: 'Production gate re-run after the quality_v23 critic deploy; content unchanged (empty-edit revision); not instructor approval.', results }, null, 2) + '\n');
    console.log(JSON.stringify({ key: entry.key, ok: result.ok, before: before?.verdict ?? null, after: quality?.verdict ?? null,
      findings: (quality?.findings ?? []).map((f: any) => `${f.severity}:${f.code}@${f.where}${/^\[critic_/.test(f.note_ko ?? '') ? '(calibrated)' : ''}`), error: result.error ?? null }));
  }
} finally { await supabase.auth.signOut({ scope: 'local' }); }
