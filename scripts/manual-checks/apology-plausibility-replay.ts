// Offline replay only. Reads a redacted live snapshot; no DB writes or model calls.
import { readFileSync, writeFileSync } from "node:fs";
import { checkCore, checkMission, type CheckContext } from "../../src/lib/pragma/missionRules";
import { getScenarioTopic, topicSupportsContext } from "../../src/lib/pragma/scenarioTopics";

const snapshot = JSON.parse(readFileSync(process.argv[2], "utf8"));
const results = snapshot.scenarios.map((row: any) => {
  const ctx: CheckContext = {
    speech_act: row.speech_act, level: row.learner_level, domain: row.domain,
    theme_code: row.theme_code, topic_code: row.topic_code, mode: row.mode,
    source_modality: row.core_content.source_modality, direction: row.core_content.direction,
  };
  const topic = getScenarioTopic(row.topic_code);
  return {
    scenarioId: row.scenario_id,
    core: checkCore(row.core_content, ctx),
    mission: checkMission(row.mission_content, ctx, row.core_content),
    topicAllowsContext: topic ? topicSupportsContext(topic, {
      speechAct: row.speech_act, domain: row.domain, power: row.scenario_p,
      distance: row.scenario_d, mode: row.mode,
    }) : null,
    sourceExactlyInherited: row.core_content.source_text === row.mission_content.production_task.source_text,
    situationExactlyInherited: row.core_content.situation_ko === row.mission_content.production_task.situation_ko,
  };
});
const output = { at: new Date().toISOString(), scope: "Two reported apology missions; structural replay is not semantic approval", results };
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify(output));
