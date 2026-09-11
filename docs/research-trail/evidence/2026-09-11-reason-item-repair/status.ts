// Read-only snapshot of the 20 course cells: mission status, current critic verdict, Reason findings, lineage depth.
// Run from the worktree root with the admin process env. No DB write.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key), clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null, get length() { return memory.size; },
} });
const { supabase } = await import('../../../../src/integrations/supabase/client');
const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(here, '../../../../.tmp/scene-grounding/scene_grounding_course_20260910');
const earlier = resolve(here, '../2026-09-10-local-core-revisions');
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''));
const db = supabase as unknown as { from: (table: string) => any };
const KEYS = ['w2-0', 'w2-1', 'w3-0', 'w3-1', 'w4-0', 'w4-1', 'w5-0', 'w5-1', 'w6-0', 'w6-1',
  'w9-0', 'w9-1', 'w10-0', 'w10-1', 'w11-0', 'w11-1', 'w12-0', 'w12-1', 'w13-0', 'w13-1'];
const idFor = (key: string) => key === 'w2-0' || key === 'w9-1'
  ? readJson(resolve(earlier, `${key}-saved.json`)).new_scenario_id as string
  : readJson(resolve(runDir, `${key}-core.json`)).result.scenarioId as string;

const { error: authError } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (authError) throw new Error(authError.message);
try {
  const rows: any[] = [];
  for (const key of KEYS) {
    const scenarioId = idFor(key);
    const { data, error } = await db.from('scenarios').select('scenario_id, mission_status, archived_at, mission_content').eq('scenario_id', scenarioId).single();
    if (error) throw new Error(`${key}: ${error.message}`);
    const { count } = await db.from('mission_lineage_versions').select('id', { count: 'exact', head: true }).eq('scenario_id', scenarioId);
    const q = data.mission_content?.quality_check ?? null;
    const reasonFindings = (q?.findings ?? []).filter((f: any) => /^mpj_items\[\d+\]\.reasons/.test(f.where ?? ''));
    rows.push({ key, scenario_id: scenarioId.slice(0, 8), mission_status: data.mission_status, archived: Boolean(data.archived_at),
      verdict: q?.verdict ?? null, reason_fail: reasonFindings.filter((f: any) => f.severity === 'fail').length,
      other_fail: (q?.findings ?? []).filter((f: any) => f.severity === 'fail').length - reasonFindings.filter((f: any) => f.severity === 'fail').length,
      lineage_versions: count ?? 0, stage: data.mission_content?.authoring?.stage ?? null });
  }
  console.table(rows);
  console.log(JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
