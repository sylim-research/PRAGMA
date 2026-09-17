// 뽑아 둔 .v5.json 전부를 변환기에 통과시켜 집필 전 실측표를 만든다. 읽기 전용·DB 접근 없음.
//
//   npx vite-node scripts/v6-conversion-report.mts [폴더]      기본 tmp/v6-conversion
//
// 보는 것: ① 변환 자체가 막히는 건(문항 구성이 native v5가 아닌 경우)
//          ② 미션마다 사람이 써야 하는 자리 수와 종류
//          ③ 통역 저장본에 옛 「학습자 통역사 C」 장면이 남아 장면 재집필이 필요한 건
// 집필은 이 표를 보고 한 건씩 한다. 이 스크립트는 후보 파일을 만들지 않는다.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { convertMissionV5ToV6 } from "@/lib/mission/missionV5ToV6";

const dir = process.argv[2] ?? "tmp/v6-conversion";
const files = readdirSync(dir).filter(name => name.endsWith(".v5.json")).sort();

type Row = {
  prefix: string; course: string; act: string; mode: string;
  gaps: number; scene_gaps: number; status: string; note: string;
};
const rows: Row[] = [];
const detail: Record<string, string[]> = {};

for (const name of files) {
  const prefix = name.replace(".v5.json", "");
  const source = JSON.parse(readFileSync(`${dir}/${name}`, "utf8"));
  const act = source.content?.learning_goal?.speech_act ?? "(없음)";
  const base = { prefix, course: source.course ?? "", act, mode: source.row?.mode ?? "" };
  try {
    const { gaps } = convertMissionV5ToV6(source.content, { speechAct: act });
    const sceneGaps = gaps.filter(gap => gap.why.includes("A·B"));
    const authored = files.includes(`${prefix}.authored.json`) ? "집필분 있음" : "";
    rows.push({ ...base, gaps: gaps.length, scene_gaps: sceneGaps.length, status: "변환 가능", note: authored });
    detail[prefix] = gaps.map(gap => `${gap.path} — ${gap.why}`);
  } catch (error) {
    rows.push({ ...base, gaps: -1, scene_gaps: -1, status: "변환 막힘", note: (error as Error).message });
  }
}

writeFileSync(`${dir}/_report.json`, `${JSON.stringify({ rows, detail }, null, 1)}\n`, "utf8");
console.table(rows);
const blocked = rows.filter(row => row.status === "변환 막힘");
const scenes = rows.filter(row => row.scene_gaps > 0);
console.log(`\n전체 ${rows.length}건 · 변환 막힘 ${blocked.length}건 · 장면 재집필 필요 ${scenes.length}건`);
if (blocked.length) console.log("막힘:", blocked.map(row => `${row.prefix}(${row.note})`).join(", "));
if (scenes.length) console.log("장면 재집필:", scenes.map(row => `${row.prefix}:${row.scene_gaps}자리`).join(", "));
const spread = new Map<number, number>();
for (const row of rows) if (row.gaps >= 0) spread.set(row.gaps, (spread.get(row.gaps) ?? 0) + 1);
console.log("집필 자리 수 분포:", [...spread].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}자리 ${c}건`).join(" · "));
