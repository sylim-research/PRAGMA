// Actual PostgreSQL CHECK behavior in memory; no production connection.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('v6 CHECK preserves old rows and all status/feature constraints', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE scenarios (
      id serial PRIMARY KEY, mission_content jsonb, mission_status text,
      target_feature text, target_feature_version text,
      CONSTRAINT scenarios_mission_ck CHECK (
        (mission_content IS NULL AND mission_status IS NULL) OR
        (mission_content IS NOT NULL AND mission_status IN ('generated','reviewed','released')
         AND mission_content->>'schema_version' IN ('mission_v1','mission_v2','mission_v3','mission_v4','mission_v5')
         AND target_feature IS NOT NULL AND target_feature_version IS NOT NULL))
    )`);
    const insert = (version, status = 'generated', feature = 'request', featureVersion = '1') =>
      db.query('INSERT INTO scenarios(mission_content,mission_status,target_feature,target_feature_version) VALUES ($1,$2,$3,$4)',
        [version === null ? null : { schema_version: version, preserved: ['old', 1] }, status, feature, featureVersion]);
    for (let i = 1; i <= 5; i++) await insert(`mission_v${i}`);
    const before = (await db.query('SELECT * FROM scenarios ORDER BY id')).rows;
    await assert.rejects(insert('mission_v6'), /scenarios_mission_ck/);
    await db.exec(await readFile(new URL('../supabase/migrations/20260914100000_allow_mission_v6.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await db.query('SELECT * FROM scenarios ORDER BY id')).rows, before);
    for (const state of ['generated', 'reviewed', 'released']) await insert('mission_v6', state);
    await insert(null, null, null, null);
    for (const args of [['mission_v7'], ['mission_v6','draft'], ['mission_v6','generated',null],
      ['mission_v6','generated','request',null], [null,'reviewed']]) {
      await assert.rejects(insert(...args), /scenarios_mission_ck/);
    }
  } finally { await db.close(); }
});

