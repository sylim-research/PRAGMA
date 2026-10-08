import { useQuery } from "@tanstack/react-query";

import { ClassResponsePatterns } from "@/components/admin/ClassResponsePatterns";
import { getLearnerPeerResponses } from "@/lib/mission/classResponseRelease";
import type { LearnerChoiceMap } from "@/lib/mission/classResponsePatterns";

const panel = "rounded-2xl border border-[#E3DFD4] bg-white";

export function PeerResponsesPanel({
  courseId,
  missionId,
  enabled,
  learnerChoices,
}: {
  courseId: string | null;
  missionId: string;
  enabled: boolean;
  learnerChoices: LearnerChoiceMap;
}) {
  const peerQuery = useQuery({
    queryKey: ["learner-peer-responses", courseId, missionId],
    enabled: enabled && Boolean(courseId) && Boolean(missionId),
    queryFn: () => getLearnerPeerResponses(courseId as string, missionId),
    refetchInterval: 5000,
  });
  const state = peerQuery.data;

  return (
    <section className={`${panel} p-5 sm:p-6`} aria-labelledby="peer-responses-title">
      <p className="text-xs font-black text-[#6B5518]">익명 동료 응답 비교</p>
      <h2 id="peer-responses-title" className="mt-1 text-lg font-black">동료 학습자 응답</h2>

      {!courseId ? (
        <p className="mt-3 break-keep text-sm leading-6 text-[#667085]">교과목 학습 경로에서 완료하면 동료 응답을 확인할 수 있습니다.</p>
      ) : !enabled ? (
        <p role="status" className="mt-3 break-keep text-sm leading-6 text-[#667085]">학습 기록을 저장한 뒤 공개 상태를 확인합니다.</p>
      ) : peerQuery.isPending ? (
        <p role="status" className="mt-3 text-sm text-[#667085]">동료 응답 공개 상태를 확인하는 중…</p>
      ) : peerQuery.isError ? (
        <p role="alert" className="mt-3 text-sm text-[#A33A32]">동료 응답을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>
      ) : state?.state === "minimum_not_met" ? (
        <div className="mt-3 rounded-xl bg-[#F7F6F1] p-4">
          <p className="text-sm font-black">아직 집계 중입니다.</p>
          <p className="mt-1 break-keep text-xs leading-5 text-[#667085]">익명 비교에 필요한 응답이 5명 이상 모이면 확인할 수 있습니다.</p>
        </div>
      ) : state?.state === "released" ? (
        <div className="mt-4">
          <p className="mb-4 break-keep text-sm leading-6 text-[#596579]">내 선택이 동료들의 다양한 판단 속에서 어디에 있었는지 비교해 보세요.</p>
          <ClassResponsePatterns patterns={[state.pattern]} learnerChoices={learnerChoices} />
          <p className="mt-4 border-t border-[#E8E5DC] pt-3 break-keep text-xs font-semibold leading-5 text-[#6B5518]">
            가장 많이 선택된 응답이 정답을 의미하지는 않습니다. 판단이 달라진 맥락과 이유를 돌아보세요.
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-[#F7F6F1] p-4">
          <p className="text-sm font-black">교수자 공개를 기다리고 있습니다.</p>
          <p className="mt-1 break-keep text-xs leading-5 text-[#667085]">응답이 마감되고 교수자가 공개하면 익명 동료 응답 분포를 확인할 수 있습니다.</p>
        </div>
      )}
    </section>
  );
}

export default PeerResponsesPanel;
