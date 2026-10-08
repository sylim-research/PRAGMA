// 「내 기록」 데모 — 학급 응답 데모(가상 학습자 20명)의 「응답 1」을 데모 학습자 「나」로 삼는다.
// 그 사람은 공개 시연 미션(/demo/mission)의 시연 답안과 글자까지 같은 수행이다(virtualClassRows.DEMO_LEARNER_ROW).
// 학급 화면과 개인 화면이 같은 20행에서 나오므로, 두 화면을 묶음 도판으로 쓸 수 있다.
// 실제 학습자 자료가 아니며 DB에 저장하지 않는다.

import { buildClassDiscussion } from "@/lib/mission/classDiscussion";
import { classPositionsFromPattern, myChoices, type ClassPosition } from "@/lib/learner/recordFlow";
import { REPRESENTATIVE_MISSION_ID } from "./representativeMission";
import { REPRESENTATIVE_MISSION_SNAPSHOT } from "./representativeMissionSnapshot";
import { buildVirtualClassRows, DEMO_LEARNER_ROW, VIRTUAL_CLASS_SIZE } from "./virtualClassRows";

export const LEARNER_DEMO_NOTICE = `데모 · 가상 학습자 ${VIRTUAL_CLASS_SIZE}명 · 실제 학습자 자료가 아닙니다`;
/** 학급 보드의 「응답 1」과 같은 사람. */
export const LEARNER_DEMO_INDEX = DEMO_LEARNER_ROW;
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
    content_hash: content.provenance.mission_content_hash,
    started_at: row.completed_at,
    completed_at: row.completed_at,
    created_at: row.completed_at ?? new Date(0).toISOString(),
  };
}

/** 데모 미션 본문 — 기준 판단·핵심 정리를 읽는다. */
export const learnerDemoMission = () => content;

/**
 * 데모 학급 분포(공개된 것으로 본다)와 「나」의 선택. 학습자 공개 집계와 같은 모양(MissionPattern)으로 옮겨
 * 실제 화면과 같은 변환(classPositionsFromPattern)을 거친다.
 */
export function learnerDemoClassPositions(): ClassPosition[] {
  const discussion = buildClassDiscussion(REPRESENTATIVE_MISSION_ID, rows, content);
  const items = discussion.items.flatMap((item) => {
    if (item.kind === "scale") {
      return [{ itemId: item.itemId, groups: [{ heading: "적절성 판단", total: item.total, choices: item.slices.map((slice) => ({ key: slice.key, label: slice.label, count: slice.count })) }] }];
    }
    if (item.kind === "corrections") {
      return [{ itemId: item.itemId, groups: [{ heading: "고른 수정안", total: item.total, choices: item.corrections.map((correction) => ({ key: String(correction.index), label: `수정안 ${correction.index + 1}`, count: correction.count })) }] }];
    }
    return [];
  });
  const pattern = { missionId: REPRESENTATIVE_MISSION_ID, learners: discussion.learners, dissents: discussion.dissents, items: items.map((item) => ({ ...item, title: "", targetPreview: null })) };
  return classPositionsFromPattern(pattern, myChoices(rows[LEARNER_DEMO_INDEX].context_judgment));
}
