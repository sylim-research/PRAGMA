// 주차 미션 자료 화면의 겉틀. 문항지·해설지 전환과 인쇄 단추는 화면에만 보이고 인쇄물에는 나오지 않는다.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CanonicalMissionViewModel } from "@/lib/mission/canonicalMissionPreview";
import { MissionHandout, type HandoutKind } from "./MissionHandout";

export function MissionHandoutPage({
  missions,
  heading,
  initialKind = "student",
}: {
  missions: CanonicalMissionViewModel[];
  heading: string;
  initialKind?: HandoutKind;
}) {
  const [kind, setKind] = useState<HandoutKind>(initialKind);
  return (
    <main className="mx-auto max-w-[760px] bg-white px-8 py-8 text-[#15202B] print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-[#E2DED2] bg-[#FAF8F2] px-4 py-3 print:hidden">
        <div role="radiogroup" aria-label="자료 종류" className="flex gap-1">
          {(["student", "teacher"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={`rounded-md px-3 py-1.5 text-[14px] font-semibold ${kind === value ? "bg-[#1F3A5F] text-white" : "bg-white text-[#1F3A5F] ring-1 ring-[#C9C3B4]"}`}
            >
              {value === "student" ? "문항지" : "해설지"}
            </button>
          ))}
        </div>
        <p className="min-w-0 flex-1 text-[13px] text-[#46515A]">
          {kind === "student" ? "학습자에게 나눠 줄 문항만 담았습니다." : "기준 판단·해설·참고 표현을 함께 담은 교수자용입니다."} 플랫폼을 쓸 수 없는 수업에 대비해 미리 인쇄하거나 PDF로 저장해 두세요.
        </p>
        <Button size="sm" onClick={() => window.print()}>인쇄·PDF 저장</Button>
      </div>

      <header className="mb-5">
        <p className="text-[12.5px] font-semibold text-[#66727A]">PRAGMA 수업 자료 · {kind === "student" ? "문항지" : "해설지"}</p>
        <h1 className="text-[20px] font-bold">{heading}</h1>
        {kind === "student" && (
          <p className="mt-2 text-[13px] text-[#46515A]">이름 ____________________ 　학번 ______________</p>
        )}
      </header>

      {missions.length === 0 ? (
        <p className="text-[14px] text-[#46515A]">이 주차에 인쇄할 수 있는 승인된 미션이 없습니다.</p>
      ) : (
        <div className="space-y-10">
          {missions.map((mission, index) => (
            <MissionHandout key={mission.scenarioId ?? index} mission={mission} index={index} kind={kind} />
          ))}
        </div>
      )}
    </main>
  );
}

export default MissionHandoutPage;
