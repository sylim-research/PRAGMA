// Official content-review (focused_v1) for the frozen 20 course missions, through the SAME client code
// the admin screen uses: prepareContentReview → contentReviewRequest → content-review Edge function.
// Modes (argv[2]):
//   prepare <keys|all>      rules → reuse of the stored generation quality (same content_hash) → finalization
//                           → "professor" (ready). Each missing stage runs at most once; nothing is approved.
//   independent <keys>      request_independent on the run, then prepare again so Claude runs, and OpenAI
//                           adjudication runs only when Claude produced findings.
//   status <keys|all>       read-only dump of content_review_runs for the current content hash of each key.
// Never approves, never edits content, never calls generate-scenario directly. Results: <key>-official-<mode>.json
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k), clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null, get length() { return memory.size; },
} });
const [{ supabase }, { contentReviewRequest }, { prepareContentReview }, { nextReviewStage, effectiveReviewSteps }] = await Promise.all([
  import('../../../../src/integrations/supabase/client'),
  import('../../../../src/lib/pragma/contentReviewApi'),
  import('../../../../src/lib/pragma/reviewPreparation'),
  import('../../../../supabase/functions/_shared/contentReview'),
]);
const here = dirname(fileURLToPath(import.meta.url));
const status = JSON.parse(readFileSync(resolve(here, 'status-20cells-20260911-frozen.json'), 'utf8'));
const runDir = resolve(here, '../../../../.tmp/scene-grounding/scene_grounding_course_20260910');
const earlier = resolve(here, '../2026-09-10-local-core-revisions');
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const idFor = (key: string) => key === 'w2-0' || key === 'w9-1'
  ? readJson(resolve(earlier, `${key}-saved.json`)).new_scenario_id as string
  : readJson(resolve(runDir, `${key}-core.json`)).result.scenarioId as string;
const KEYS: string[] = status.rows.map((r: any) => r.key);
const mode = process.argv[2];
const selected = !process.argv[3] || process.argv[3] === 'all' ? KEYS : process.argv[3].split(',');
const db = supabase as unknown as { from: (t: string) => any };

const summarize = (run: any) => run ? ({
  id: run.id, content_hash: run.content_hash, criteria_version: run.criteria_version, approval_policy: run.approval_policy,
  rules_verdict: run.rules?.verdict ?? null, generation_quality: Boolean(run.generation_quality),
  generation_quality_verdict: run.generation_quality?.quality_check?.verdict ?? null,
  openai_review: run.openai_review ? { verdict: run.openai_review.result?.verdict, findings: run.openai_review.result?.findings?.length ?? 0, model: run.openai_review.model } : null,
  independent_review_requested: Boolean(run.independent_review_requested),
  claude_review: run.claude_review ? { verdict: run.claude_review.result?.verdict, findings: run.claude_review.result?.findings?.length ?? 0, model: run.claude_review.model } : null,
  adjudication: run.adjudication ? { decisions: run.adjudication.result?.decisions?.length ?? 0, model: run.adjudication.model } : null,
  prepared_finalization: Boolean(run.prepared_finalization), running_stage: run.running_stage, last_error: run.last_error,
  approved_at: run.approved_at, next_stage: nextReviewStage(run), steps: effectiveReviewSteps(run).map((s: any) => s.key),
}) : null;

const { error: authError } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!, password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (authError) throw new Error(authError.message);
try {
  for (const key of selected) {
    const target = { kind: 'mission' as const, targetId: idFor(key) };
    const out = resolve(here, `${key}-official-${mode}.json`);
    if (mode === 'status') {
      const state = await contentReviewRequest(target, 'inspect');
      const row = { at: new Date().toISOString(), key, scenario_id: target.targetId, contentHash: state.contentHash, sourceHash: state.sourceHash, run: summarize(state.run), history: state.history?.length ?? 0 };
      writeFileSync(out, JSON.stringify(row, null, 2) + '\n');
      console.log(JSON.stringify({ key, hash: state.contentHash.slice(0, 8), next: row.run?.next_stage ?? 'rules', rules: row.run?.rules_verdict, gq: row.run?.generation_quality_verdict, claude: row.run?.claude_review?.findings ?? null, adj: row.run?.adjudication?.decisions ?? null, fin: row.run?.prepared_finalization ?? false, err: row.run?.last_error ?? null }));
      continue;
    }
    if (mode === 'independent') {
      let state = await contentReviewRequest(target, 'inspect');
      if (!state.run) { console.log(JSON.stringify({ key, skipped: 'no run — prepare first' })); continue; }
      if (!state.run.independent_review_requested) state = await contentReviewRequest(target, 'request_independent', state);
    }
    if (mode !== 'prepare' && mode !== 'independent') throw new Error('Choose prepare, independent or status');
    const stages: string[] = [];
    const result = await prepareContentReview(target, {
      request: contentReviewRequest, stopped: () => false,
      onStage: (stage) => { stages.push(stage); console.log(JSON.stringify({ key, stage })); },
    });
    const row = { at: new Date().toISOString(), key, scenario_id: target.targetId, mode, status: result.status, message: result.message, stages_run: stages,
      contentHash: result.inspection?.contentHash ?? null, run: summarize(result.inspection?.run ?? null),
      scope: 'Official content-review through the existing client workflow; no approval, no content change.' };
    writeFileSync(out, JSON.stringify(row, null, 2) + '\n');
    console.log(JSON.stringify({ key, status: result.status, message: result.message, stages_run: stages, next: row.run?.next_stage ?? null, claude: row.run?.claude_review?.findings ?? null, adj: row.run?.adjudication?.decisions ?? null, err: row.run?.last_error ?? null }));
  }
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
