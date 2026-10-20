// /admin/handout?ids=<scenario_id,...>&title=<주차 제목>
// 주차별 학습 미션 배치에서 연다. 교수자 최종 승인을 마친 미션만 읽힌다(fetchMissionByScenario가 승인 상태를 확인).
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MissionHandoutPage } from "@/components/admin/MissionHandoutPage";
import type { CanonicalMissionViewModel } from "@/lib/mission/canonicalMissionPreview";
import { adaptRunnableMissionToCanonical } from "@/lib/mission/canonicalMissionRuntime";
import { fetchMissionByScenario } from "@/lib/mission/missionDb";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; missions: CanonicalMissionViewModel[]; skipped: string[] }
  | { status: "error"; message: string };

const AdminMissionHandout = () => {
  const [params] = useSearchParams();
  const ids = (params.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const heading = params.get("title")?.trim() || "주차 미션 자료";
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const idsKey = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (ids.length === 0) {
        setState({ status: "error", message: "자료를 만들 미션이 지정되지 않았습니다." });
        return;
      }
      const missions: CanonicalMissionViewModel[] = [];
      const skipped: string[] = [];
      for (const id of ids) {
        try {
          const runnable = await fetchMissionByScenario(id, { includeV6: true });
          missions.push({ ...adaptRunnableMissionToCanonical(runnable), scenarioId: id });
        } catch (error) {
          skipped.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (!cancelled) setState({ status: "ready", missions, skipped });
    })();
    return () => {
      cancelled = true;
    };
    // idsKey가 바뀔 때만 다시 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  if (state.status === "loading") {
    return <p className="p-8 text-[14px] text-[#46515A]">미션 자료를 불러오는 중입니다…</p>;
  }
  if (state.status === "error") {
    return <p className="p-8 text-[14px] text-red-800">{state.message}</p>;
  }
  return (
    <>
      {state.skipped.length > 0 && (
        <p role="alert" className="mx-auto max-w-[760px] px-8 pt-6 text-[13px] text-[#9A3F1C] print:hidden">
          일부 미션은 자료에 넣지 못했습니다: {state.skipped.join(" / ")}
        </p>
      )}
      <MissionHandoutPage missions={state.missions} heading={heading} />
    </>
  );
};

export default AdminMissionHandout;
