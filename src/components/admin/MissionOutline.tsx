// v6 미션의 문항 구성을 한눈에 보는 요약. 제작 현황·AI 검토 화면과 라이브러리가 같이 쓴다
// (2026-09-20: 라이브러리가 v6 상세를 열지 못하던 것을 고치면서 AdminAssembly에서 옮겨 왔다).
import type { LearnerMissionRuntime, MissionV6 } from "@/lib/pragma/missionV6";

export const MissionOutline = ({ mission }: { mission: LearnerMissionRuntime }) => {
  const v6 = mission as MissionV6;
  const task = v6.production_task;
  if (!Array.isArray(v6.mpj_items) || !task) return null;
  return (
    <section aria-label="학습 미션 설계" className="rounded-lg border border-[#ECE8DE] px-4 py-3">
      <h3 className="mb-2 text-[13px] font-bold text-[#233542]">학습 미션 설계</h3>
      <ol className="divide-y divide-[#F0EDE4] text-[13px]">
        {v6.mpj_items.map((item, index) => (
          <li key={index} className="flex gap-3 py-1.5">
            <span className="w-[4.5rem] shrink-0 font-semibold tabular-nums text-[#66727A]">MJT 문항 {index + 1}</span>
            <span className="min-w-0 text-[#202B33]">{item.title}</span>
          </li>
        ))}
        <li className="flex gap-3 py-1.5">
          <span className="w-[4.5rem] shrink-0 font-semibold text-[#66727A]">DCT 문항</span>
          <span className="min-w-0 text-[#202B33]">{task.mode === "interpreting" ? "통역" : "번역"} → AI 피드백 → 다듬기</span>
        </li>
      </ol>
    </section>
  );
};

export default MissionOutline;
