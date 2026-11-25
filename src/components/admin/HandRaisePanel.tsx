import { Hand } from "lucide-react";
import { PRESENTATION_ORDER } from "@/lib/mission/classDiscussion";
import { handRaiseTargetLabel, type HandRaiseView } from "@/lib/mission/handRaise";

/**
 * 교수자 토론 화면의 손들기 모음(2026-11-25 승인 UI 브리프).
 * 손이 많이 올라온 문항을 먼저 보이고, 이유는 이름 없이 그대로 보인다.
 */
export function HandRaisePanel({ raises, loading, failed }: { raises: HandRaiseView[]; loading?: boolean; failed?: boolean }) {
  const groups = [...raises.reduce((map, raise) => {
    const list = map.get(raise.target) ?? [];
    list.push(raise);
    map.set(raise.target, list);
    return map;
  }, new Map<HandRaiseView["target"], HandRaiseView[]>())]
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <section aria-label="손든 학생" className="mt-4 rounded-xl border border-[#E6D49A] bg-[#FFFCEB] px-4 py-3">
      <p className="flex items-center gap-1.5 text-[14.5px] font-bold text-[#15202B]">
        <Hand aria-hidden className="h-4 w-4" />손들기 <span className="font-normal text-[#6D7788]">{raises.length}건 · 익명</span>
      </p>
      {loading ? <p role="status" className="mt-2 text-[13.5px] text-[#5D6970]">손들기를 불러오는 중…</p>
        : failed ? <p role="alert" className="mt-2 text-[13.5px] text-destructive">손들기를 불러오지 못했습니다.</p>
          : groups.length === 0 ? <p className="mt-2 text-[13.5px] text-[#5D6970]">아직 손든 학생이 없어요.</p>
            : <div className="mt-2 space-y-3">
              {groups.map(([target, list]) => (
                <div key={target}>
                  <p className="text-[13.5px] font-bold text-[#5F4A12]">{handRaiseTargetLabel(target, PRESENTATION_ORDER)} <span className="font-normal">· {list.length}명</span></p>
                  <ul className="mt-1 space-y-1">
                    {list.map((raise, index) => (
                      <li key={`${target}-${index}`} className="break-keep rounded-lg bg-white px-3 py-1.5 text-[14px] leading-6 text-[#26323D]">“{raise.reason}”</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>}
    </section>
  );
}
