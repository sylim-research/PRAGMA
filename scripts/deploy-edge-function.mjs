#!/usr/bin/env node
// Minimal guard for Supabase Edge deploys: production must follow main's lineage, like Railway.
// Refuses to deploy from a dirty tree or from a commit that is not contained in origin/main.
//   node scripts/deploy-edge-function.mjs <function> [<function> ...]
//   node scripts/deploy-edge-function.mjs <function> --allow-unmerged "<reason>"
// The escape hatch prints a loud warning and requires a written reason; record it in the dev-log.
import { execFileSync, spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flagIndex = args.indexOf('--allow-unmerged');
const allowReason = flagIndex >= 0 ? args[flagIndex + 1] : null;
// Only drop the flag and its reason when the flag is present; with no flag, index 0 is a function name.
const functions = flagIndex >= 0 ? args.filter((value, index) => index !== flagIndex && index !== flagIndex + 1) : args;
if (functions.length === 0) { console.error('usage: deploy-edge-function.mjs <function> [--allow-unmerged "<reason>"]'); process.exit(2); }
const git = (...argv) => execFileSync('git', argv, { encoding: 'utf8' }).trim();

const dirty = git('status', '--porcelain', '--', 'supabase', 'src').length > 0;
if (dirty) { console.error('refused: working tree has uncommitted changes under supabase/ or src/. Commit first so the deployed source is traceable.'); process.exit(1); }
git('fetch', '-q', 'origin', 'main');
const head = git('rev-parse', 'HEAD');
const onMain = spawnSync('git', ['merge-base', '--is-ancestor', head, 'origin/main']).status === 0;
if (!onMain) {
  if (!allowReason || allowReason.trim().length < 10) {
    console.error(`refused: HEAD ${head.slice(0, 8)} is not contained in origin/main. Merge first, or pass --allow-unmerged "<reason of 10+ chars>" and record it in the dev-log.`);
    process.exit(1);
  }
  console.warn(`WARNING: deploying edge function(s) from a commit not in origin/main (${head.slice(0, 8)}). Reason: ${allowReason}`);
}
for (const fn of functions) {
  const result = spawnSync('npx', ['supabase', 'functions', 'deploy', fn, '--use-api'], { stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`deployed ${functions.join(', ')} from ${head.slice(0, 8)}${onMain ? ' (on main lineage)' : ' (UNMERGED, reason recorded above)'}`);
