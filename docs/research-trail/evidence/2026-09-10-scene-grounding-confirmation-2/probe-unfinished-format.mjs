// Run against implementation e6892dc6 + unfinished-scene-format.patch only.
// This is a diagnostic of a proposed guard, not a production test suite.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneDescriptionIssue } from '../../../../supabase/functions/_shared/sceneGrounding.ts';

const here = dirname(fileURLToPath(import.meta.url));
const inspect = (scene) => ({ scene, issue: sceneDescriptionIssue(scene) });
const readCores = (dir) => readdirSync(dir).filter(name => name.endsWith('-core.json')).map(name => {
  const record = JSON.parse(readFileSync(resolve(dir, name), 'utf8').replace(/^\uFEFF/, ''));
  return { file: name, ...inspect(record.result.coreContent.situation_ko) };
});
const probes = [
  { expected: 'allow', note: '상황 설명의 해요체만으로 대사라고 단정할 수 없다', scene: '저는 약속 시간을 착각해 카페에 십 분 늦게 도착했어요. 기다리던 동호회 회원에게 그 일에 대해 사과하려 해요.' },
  { expected: 'allow', note: '내부 인용의 물음표를 문장 경계로 잘못 자름', scene: '저는 이웃에게서 “언제 도착하나요?”라는 메시지를 받았습니다. 도착 시간을 알려 주려 합니다.' },
  { expected: 'block', note: '평서형 직접 대사도 통과', scene: '이 모임에는 꼭 참석해 주셔야 합니다. 거절은 받지 않겠습니다.' },
  { expected: 'block', note: '정답 방향 힌트는 평서형이어도 부적합', scene: '저는 이웃에게 부탁하려 합니다. 정중하고 공손하게 표현해야 합니다.' },
].map(probe => ({ ...probe, issue: sceneDescriptionIssue(probe.scene) }));
const result = {
  generated_at: new Date().toISOString(),
  implementation: 'e6892dc6 + archived unfinished-scene-format.patch',
  old_cores: readCores(resolve(here, '../2026-09-10-scene-grounding-pilot-1')),
  new_cores: readCores(here),
  probes,
  scope: 'Deterministic local diagnostic; no model calls or quality approval.',
};
writeFileSync(resolve(here, 'unfinished-format-probe.json'), JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
