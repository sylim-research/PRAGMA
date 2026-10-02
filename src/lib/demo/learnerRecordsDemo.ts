// 「내 기록」 데모 — 학급 응답 데모(가상 학급 20명)의 「응답 5」를 데모 학습자 「나」로 삼는다.
// 학급 화면과 개인 화면이 같은 20행에서 나오므로, 두 화면을 묶음 도판으로 쓸 수 있다.
// 실제 학습자 자료가 아니며 DB에 저장하지 않는다.

import { buildClassDiscussion } from "@/lib/mission/classDiscussion";
import type { ClassPosition } from "@/lib/learner/recordFlow";
import { REPRESENTATIVE_MISSION_ID } from "./representativeMission";
import { REPRESENTATIVE_MISSION_SNAPSHOT } from "./representativeMissionSnapshot";
import { buildVirtualClassRows, VIRTUAL_CLASS_SIZE } from "./virtualClassRows";

export const LEARNER_DEMO_NOTICE = `데모 · 가상 학급 ${VIRTUAL_CLASS_SIZE}명 중 한 명 · 실제 학습자 자료 아님`;
/** 학급 보드의 「응답 5」와 같은 사람. */
export const LEARNER_DEMO_INDEX = 4;
/** 대표 교과목(AI 한중 화용 통번역) — 대표 미션이 2주차 첫 슬롯이다. */
const DEMO_COURSE_ID = "a10c5b2e-7c5a-4f0c-9f4a-6d61cf6b8e21";

const content = REPRESENTATIVE_MISSION_SNAPSHOT.mission_content;
const rows = buildVirtualClassRows(REPRESENTATIVE_MISSION_ID, content) ?? [];

/** learner_mission_logs 한 행과 같은 모양. */
export function learnerDemoLog() {
  const row = rows[LEARNER_DEMO_INDEX];
  const task = content.production_task;
  return {
    id: `demo-${row.profile_id}`,
    mission_id: REPRESENTATIVE_MISSION_ID,
    speech_act: "request",
    task_type: "translation",
    course_id: DEMO_COURSE_ID,
    week_no: 2,
    feature_id: content.unit.target_feature,
    source_lang: "ko",
    target_lang: "zh",
    source_text: task.source_text,
    first_response: row.first_response ?? null,
    revised_response: row.revised_response ?? null,
    target_feature_observed: row.target_feature_observed ?? null,
    context_judgment: row.context_judgment,
    content_ver: content.unit.target_feature_version,
    started_at: row.completed_at,
    completed_at: row.completed_at,
    created_at: row.completed_at ?? new Date(0).toISOString(),
  };
}

/** 데모 학급 분포(공개된 것으로 본다)와 「나」의 척도 선택. */
export function learnerDemoClassPositions(): ClassPosition[] {
  const discussion = buildClassDiscussion(REPRESENTATIVE_MISSION_ID, rows, content);
  const mine = (rows[LEARNER_DEMO_INDEX].context_judgment as { responses: Array<{ item_id: number; scale_code?: string }> }).responses;
  return discussion.items.flatMap((item) => (item.kind === "scale" && (item.itemId === 1 || item.itemId === 2)
    ? [{
        itemId: item.itemId,
        activity: item.activity,
        slices: item.slices,
        total: item.total,
        mine: mine.find((trace) => trace.item_id === item.itemId)?.scale_code ?? null,
      }]
    : []));
}
