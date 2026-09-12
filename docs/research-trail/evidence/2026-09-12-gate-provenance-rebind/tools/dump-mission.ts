// Read-only: print one mission's full learner-facing content for a paper blueprint.
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => memory.set(k, v),
    removeItem: (k: string) => memory.delete(k),
    clear: () => memory.clear(),
    key: (i: number) => [...memory.keys()][i] ?? null,
    get length() { return memory.size; },
  },
});
const { supabase } = await import('../../../../../src/integrations/supabase/client');
const { writeFileSync } = await import('node:fs');
const id = process.argv[2];
const out = process.argv[3];
const { error } = await supabase.auth.signInWithPassword({
  email: process.env.PRAGMA_BATCH_ADMIN_EMAIL!,
  password: process.env.PRAGMA_BATCH_ADMIN_PASSWORD!,
});
if (error) throw new Error(error.message);
try {
  const db = supabase as unknown as { from: (t: string) => any };
  const res = await db.from('scenarios').select('scenario_id, speech_act, mode, learner_level, domain, core_content, mission_content').eq('scenario_id', id).single();
  if (res.error) throw new Error(res.error.message);
  const m = res.data.mission_content;
  const strip = { ...m };
  for (const k of ['provenance', 'quality_check', 'hsk_lexical_audit', 'authoring', 'item_lineage']) delete (strip as any)[k];
  const doc = { scenario_id: res.data.scenario_id, speech_act: res.data.speech_act, mode: res.data.mode, level: res.data.learner_level, domain: res.data.domain,
    core: { situation_ko: res.data.core_content?.situation_ko, relation_ko: res.data.core_content?.relation_ko, pdr: res.data.core_content?.pdr, source_text: res.data.core_content?.source_text, preceding_turn: res.data.core_content?.preceding_turn ?? null, context_spec: res.data.core_content?.context_spec ?? null },
    mission: strip };
  writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`wrote ${out} (${JSON.stringify(doc).length} chars)`);
} finally {
  await supabase.auth.signOut({ scope: 'local' });
}
