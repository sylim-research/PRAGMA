import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const admin = '00000000-0000-4000-8000-000000000001';
const learner = '00000000-0000-4000-8000-000000000002';
before(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES ('${admin}'), ('${learner}');
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.sub',true) = '${admin}' $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;`);
  await db.exec(await readFile(new URL('../supabase/migrations/20260907180000_background_generation_jobs.sql', import.meta.url), 'utf8'));
});
after(() => db.close());
async function as(role, user, sql) {
  await db.exec(`SET ROLE ${role}; SET request.jwt.claim.sub = '${user}';`);
  try { return await db.query(sql); } finally { await db.exec('RESET ROLE'); }
}
test('admin reads jobs; learner and anonymous cannot read or dispatch them', async () => {
  await db.exec(`INSERT INTO generation_jobs(owner_id,request_key,request_body,release_id,model)
    VALUES ('${admin}','key','{}','release','gpt-6-astra')`);
  assert.equal((await as('authenticated', admin, 'SELECT id FROM generation_jobs')).rows.length, 1);
  assert.equal((await as('authenticated', learner, 'SELECT id FROM generation_jobs')).rows.length, 0);
  await assert.rejects(as('anon', '', 'SELECT id FROM generation_jobs'), /permission denied/);
  await assert.rejects(as('authenticated', learner, 'SELECT * FROM claim_generation_job()'), /permission denied/);
  await assert.rejects(as('authenticated', admin, `SELECT authorize_generation_worker('x')`), /permission denied/);
  await assert.rejects(as('authenticated', admin, 'SELECT * FROM pragma_private.generation_worker_config'), /permission denied/);
});
test('only the worker writes; one lease excludes a second worker; completed jobs cannot be claimed', async () => {
  await assert.rejects(as('authenticated', admin, `UPDATE generation_jobs SET status='completed'`), /permission denied/);
  const first = await as('service_role', '', 'SELECT * FROM claim_generation_job()');
  assert.equal(first.rows.length, 1);
  assert.equal((await as('service_role', '', 'SELECT * FROM claim_generation_job()')).rows.length, 0);
  await db.exec(`UPDATE generation_jobs SET lease_until=now()-interval '1 second'`);
  const second = await as('service_role', '', 'SELECT * FROM claim_generation_job()');
  assert.notEqual(second.rows[0].lease_token, first.rows[0].lease_token);
  await db.exec(`UPDATE generation_jobs SET status='completed',lease_until=NULL`);
  assert.equal((await as('service_role', '', 'SELECT * FROM claim_generation_job()')).rows.length, 0);
});
test('the same owner and request key cannot create duplicate work', async () => {
  await assert.rejects(db.exec(`INSERT INTO generation_jobs(owner_id,request_key,request_body,release_id,model)
    VALUES ('${admin}','key','{}','release','gpt-6-astra')`), /duplicate key/);
});
