import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ClassDiscussionBoard, INITIAL_BOARD_STATE, type ClassDiscussionBoardState } from "@/components/admin/ClassDiscussionBoard";
import { REPRESENTATIVE_MISSION_ID } from "@/lib/demo/representativeMission";
import { REPRESENTATIVE_MISSION_SNAPSHOT } from "@/lib/demo/representativeMissionSnapshot";
import { buildVirtualClassRows, VIRTUAL_CLASS_NOTICE } from "@/lib/demo/virtualClassRows";
import { buildClassDiscussion } from "@/lib/mission/classDiscussion";

const rows = buildVirtualClassRows(REPRESENTATIVE_MISSION_ID, REPRESENTATIVE_MISSION_SNAPSHOT.mission_content) ?? [];
const discussion = buildClassDiscussion(REPRESENTATIVE_MISSION_ID, rows, REPRESENTATIVE_MISSION_SNAPSHOT.mission_content);

/**
 * 논문 제5장 도판용 — 대표 미션에 가상 학급 20명을 올린 학급 응답 토론 보드(개발 모드 전용, 로그인 불필요).
 * 운영 학급 응답 화면과 같은 집계·표시 코드를 쓰며 DB·AI를 부르지 않는다.
 * ?item=2 로 문항을, ?dct=cases 로 사례 비교를 바로 연다.
 */
const ClassDiscussionDemo = () => {
  const [params] = useSearchParams();
  const [state, setState] = useState<ClassDiscussionBoardState>(() => {
    const item = Number(params.get("item"));
    const dctView = params.get("dct") === "cases" ? "cases" : "class";
    const compare = dctView === "cases" ? discussion.dct.cases.filter((entry) => entry.dissent).slice(0, 2).map((entry) => entry.id) : [];
    return { ...INITIAL_BOARD_STATE, itemId: Number.isFinite(item) && item > 0 ? item : null, dctView, compare };
  });
  return <main className="min-h-screen bg-[#F3F1EA] px-6 py-8 text-[#15202B]">
    <div className="mx-auto w-full max-w-[1120px]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[22px] font-black tracking-tight">학급 응답 분포 · 2주차 · 미션 1</h1>
        <p className="rounded-full bg-[#FAD338] px-3 py-1 text-[12.5px] font-bold">{VIRTUAL_CLASS_NOTICE}</p>
      </div>
      <ClassDiscussionBoard data={discussion} demo state={state} onChange={setState} />
    </div>
  </main>;
};

export default ClassDiscussionDemo;
