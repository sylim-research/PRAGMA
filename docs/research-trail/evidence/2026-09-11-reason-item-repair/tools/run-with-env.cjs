// Load KEY=VALUE pairs from the main repo .env into process.env (never printed), then run vite-node.
// Usage: node run-with-env.cjs <script.ts> [args...]   (cwd must be the worktree root)
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const envPath = path.resolve(process.cwd(), '../../.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'PRAGMA_BATCH_ADMIN_EMAIL', 'PRAGMA_BATCH_ADMIN_PASSWORD'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) { console.error('missing env keys: ' + missing.join(',')); process.exit(2); }
const r = spawnSync('npx.cmd', ['vite-node', ...process.argv.slice(2)], { stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
