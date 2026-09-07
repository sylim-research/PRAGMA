// Read-only provider usage check. Uses an existing PRAGMA admin login, never the ElevenLabs key.
// node scripts/check-tts-credits.mjs --env-file PATH --state-file PATH
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { assessTtsCredits } from './lib/tts-credits.mjs';

const option = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const envFile = option('--env-file');
if (envFile) process.loadEnvFile(envFile);
const stateFile = resolve(option('--state-file') || 'tmp/elevenlabs-usage-history.json');
let db;
try {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.PRAGMA_ADMIN_EMAIL || process.env.PRAGMA_BATCH_ADMIN_EMAIL;
  const password = process.env.PRAGMA_ADMIN_PASSWORD || process.env.PRAGMA_BATCH_ADMIN_PASSWORD;
  if (!url || !key || !email || !password) throw new Error('PRAGMA 관리자 로그인 설정이 필요합니다.');
  db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error('PRAGMA 관리자 로그인에 실패했습니다.');
  const response = await fetch(`${url}/functions/v1/tts?action=usage`, {
    headers: { apikey: key, Authorization: `Bearer ${data.session.access_token}` },
    signal: AbortSignal.timeout(25_000),
  });
  const usage = await response.json();
  if (!response.ok) throw new Error(usage.error || '잔량 조회 실패');
  if (![usage.used, usage.limit, usage.remaining].every(Number.isFinite) ||
    usage.limit <= 0 || !Number.isFinite(Date.parse(usage.checkedAt))) throw new Error('잔량 응답 형식 오류');
  const history = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : [];
  if (!Array.isArray(history)) throw new Error('이전 잔량 기록 형식 오류');
  const result = assessTtsCredits(usage, history);
  const recent = history.filter(sample => Date.parse(sample.checkedAt) > Date.parse(usage.checkedAt) - 8 * 86_400_000);
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify([...recent, usage].slice(-100), null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log(JSON.stringify({ flag: 'monitor_unavailable', error: error.message }));
  process.exitCode = 1;
} finally {
  if (db) await db.auth.signOut({ scope: 'local' });
}
