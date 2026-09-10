// Offline diagnostic evidence only; does not fix or approve content.
// Node 24 can load the dependency-free TypeScript renderer directly.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { naturalLearnerScene } from '../../supabase/functions/_shared/learnerScene.ts';
import { canonicalizeCoreSituationFromSeed } from '../../supabase/functions/_shared/coreSituationCanonicalization.ts';

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error('Usage: node scene-pdr-pipeline-audit.mjs <snapshot.json> <output.json>');
const bytes = readFileSync(input);
const snapshot = JSON.parse(bytes.toString('utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const probes = [
  'A는 B를 이번 주말 모임에 초대하려 합니다.',
  'A는 조장이고 B는 조원이며, 조별 과제를 진행합니다.',
  'A와 B는 서로 처음 만나는 사이입니다.',
  '조장인 B가 제안한 방법에 반대합니다.',
].map(stored => ({ stored, rendered: naturalLearnerScene(stored) }));
const dctContexts = snapshot.missions.map(mission => {
  const dct = mission.scenes.find(scene => scene.path === 'production_task');
  if (!dct) throw new Error(`Missing DCT: ${mission.id}`);
  return {
    id: mission.id, title: mission.title, speechAct: mission.speechAct, weeks: mission.weeks,
    pdr: dct.pdr,
    situation: { stored: dct.situation, rendered: naturalLearnerScene(dct.situation) },
    relation: { stored: dct.relation, rendered: naturalLearnerScene(dct.relation) },
    source: dct.source,
  };
});
const rCounts = dctContexts.reduce((counts, row) => {
  counts[row.pdr.r] = (counts[row.pdr.r] ?? 0) + 1;
  return counts;
}, {});
const result = {
  at: new Date().toISOString(),
  inputSnapshotAt: snapshot.at,
  inputSha256: sha256(bytes),
  rendererSha256: sha256(readFileSync(fileURLToPath(new URL('../../supabase/functions/_shared/learnerScene.ts', import.meta.url)))),
  scope: 'Existing course DCT situation/relation/source/PDR screening and raw naturalLearnerScene replay. Not full MJT/candidate/feedback review, final clipping, fresh DB evidence, model evaluation, or content approval.',
  courseId: snapshot.courseId,
  count: dctContexts.length,
  dctBurdenDistribution: rCounts,
  syntheticRendererProbes: probes,
  // Demonstrates the format-only inheritance condition, not an observed live overwrite.
  syntheticSeedInheritance: canonicalizeCoreSituationFromSeed(
    '저는 친구를 초대했습니다. 친구가 거절해서 제가 사과합니다.',
    '저는 친구와 약속한 시간을 착각했습니다. 친구가 한 시간 기다려 사과합니다.',
  ),
  dctContexts,
};
writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ count: result.count, inputSha256: result.inputSha256, probes, seedInheritance: result.syntheticSeedInheritance }));
