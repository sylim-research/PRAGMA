// Run manually with the existing Supabase admin process environment.
// Calls the deployed semantic reviewer only; does not save/approve/promote scenarios.
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
const [{ supabase }, { checkCoreSemanticFit }] = await Promise.all([
  import('../../../../src/integrations/supabase/client'),
  import('../../../../src/lib/pragma/coreBatchRun'),
]);
const here = dirname(fileURLToPath(import.meta.url));
const runId = 'scene_grounding_local_revision_review_20260910';
const { error } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (error) throw new Error(error.message);
try {
  for (const key of ['w9-1', 'w2-0', 'pilot-reverse-opposition']) {
    const draftFile = `${key}-draft.json`;
    const raw = readFileSync(resolve(here, draftFile), 'utf8');
    const digest = createHash('sha256').update(raw).digest('hex');
    const out = resolve(here, `${key}-semantic.json`);
    if (existsSync(out)) {
      const previous = JSON.parse(readFileSync(out, 'utf8'));
      if (previous.draft_sha256 !== digest) throw new Error(`${key}: result belongs to a different draft; preserve it before starting a new review`);
      console.log(JSON.stringify({ key, preserved: true, verdict: previous.result?.result?.verdict }));
      continue;
    }
    const draft = JSON.parse(raw);
    const result = await checkCoreSemanticFit(draft.plan.cell, draft.coreContent, runId, `edited:${key}`);
    writeFileSync(out, JSON.stringify({
      at: new Date().toISOString(), run_id: runId, draft_file: draftFile,
      draft_sha256: digest, scope: 'Automated core semantic review only; not instructor approval or whole-mission validation', result,
    }, null, 2) + '\n');
    console.log(JSON.stringify({ key, ok: result.ok, verdict: result.ok ? result.result.verdict : undefined,
      issues: result.ok ? result.result.issues : undefined, error: result.ok ? undefined : result.error }));
    if (!result.ok) { process.exitCode = 1; break; }
  }
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
