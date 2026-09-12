// Read-only: run the shipped changedContrastDimensions() over the 20 live missions' stored P/D/R
// and print the sentence the learner sees after submitting MJT2. No DB write, no model call.
const { readFileSync, writeFileSync } = await import('node:fs');
const { changedContrastDimensions } = await import('../../../../../src/lib/mission/canonicalMissionRuntime');
const dir = 'docs/research-trail/evidence/2026-09-12-gate-provenance-rebind';
const data = JSON.parse(readFileSync(`${dir}/r19-r5-findings.json`, 'utf8'));

const rows = data.missions.map((mission: any) => {
  const [first, second] = mission.items;
  const dimensions = changedContrastDimensions(first.pdr, second.pdr);
  return {
    key: mission.key,
    speech_act: mission.speech_act,
    mjt1_pdr: first.pdr,
    mjt2_pdr: second.pdr,
    dimensions,
    reveal: dimensions.map((d: any) => `${d.axisLabel} · ${d.before} → ${d.after}`),
  };
}).sort((a: any, b: any) => a.key.localeCompare(b.key, undefined, { numeric: true }));

for (const row of rows) {
  console.log(`${row.key.padEnd(6)} ${row.speech_act.padEnd(11)} ${row.reveal.join(' / ') || '(조건 차이 없음 — 축 목록 비표시)'}`);
}
const axes: Record<string, number> = {};
for (const row of rows) for (const d of row.dimensions) axes[d.axisLabel] = (axes[d.axisLabel] ?? 0) + 1;
console.log(`\n축별 건수: ${JSON.stringify(axes)} · 축 0개인 미션 ${rows.filter((r: any) => r.dimensions.length === 0).length}건`);
writeFileSync(`${dir}/contrast-dimensions-sample.json`, `${JSON.stringify({ at: new Date().toISOString(), rows }, null, 2)}\n`);
console.log(`wrote ${dir}/contrast-dimensions-sample.json`);
