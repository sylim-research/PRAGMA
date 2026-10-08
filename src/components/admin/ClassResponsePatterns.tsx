// 학급 응답 분포 뷰 — 문항별 선택지 분포 막대와 이견 건수.
// 익명 집계만 표시한다. 학생 이름·개별 응답·이견 원문은 여기서 다루지 않는다.

import {
  learnerChoiceMapKey,
  type LearnerChoiceMap,
  type MissionPattern,
} from "@/lib/mission/classResponsePatterns";

const percent = (count: number, total: number) =>
  total > 0 ? Math.round((count / total) * 100) : 0;

/** projector=true면 교실 투사용으로 글자·막대를 키운다. */
export const ClassResponsePatterns = ({
  patterns,
  projector = false,
  learnerChoices,
}: {
  patterns: MissionPattern[];
  projector?: boolean;
  learnerChoices?: LearnerChoiceMap;
}) => {
  const withData = patterns.filter((pattern) => pattern.learners > 0);
  if (withData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        아직 이 주차 미션의 수행 기록이 없습니다. 학습자가 미션을 완료하면 분포가 여기에 쌓입니다.
      </p>
    );
  }
  return (
    <div className={projector ? "space-y-8" : "space-y-6"}>
      {withData.map((pattern, missionIndex) => (
        <section key={pattern.missionId} aria-label={`미션 ${missionIndex + 1} 응답 분포`}>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className={projector ? "text-2xl font-bold" : "text-sm font-semibold"}>
              미션 {missionIndex + 1}
            </h3>
            <span className={projector ? "text-lg text-muted-foreground" : "text-xs text-muted-foreground"}>
              응답 {pattern.learners}명
              {pattern.dissents > 0 && ` · 이견 제기 ${pattern.dissents}건`}
            </span>
          </div>
          <div className={projector ? "mt-4 space-y-6" : "mt-3 space-y-4"}>
            {pattern.items.map((item) => (
              <div key={item.itemId} className="rounded-lg border bg-white p-3">
                <p className={projector ? "text-xl font-semibold" : "text-[13px] font-semibold"}>
                  {item.title}
                </p>
                {item.targetPreview && (
                  <p className={projector ? "mt-1 text-lg text-muted-foreground" : "mt-0.5 text-xs text-muted-foreground"}>
                    {item.targetPreview}
                  </p>
                )}
                {item.groups.map((group) => (
                  <div key={group.heading} className={projector ? "mt-4" : "mt-3"}>
                    <p className={projector ? "text-base font-medium text-muted-foreground" : "text-[12px] font-medium text-muted-foreground"}>
                      {group.heading}
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {group.choices.map((choice) => {
                        const share = percent(choice.count, group.total);
                        const isLearnerChoice = learnerChoices?.[learnerChoiceMapKey(item.itemId, group.heading)]?.includes(choice.key) ?? false;
                        return (
                          <li key={choice.key} className={`flex items-center gap-2 rounded-md ${isLearnerChoice ? "bg-[#FFF7D6] py-1 pr-2" : ""}`}>
                            <span className={projector ? "w-16 shrink-0 text-right text-lg font-semibold tabular-nums" : "w-12 shrink-0 text-right text-xs font-semibold tabular-nums"}>
                              {share}%
                            </span>
                            <span
                              className={`${projector ? "h-5" : "h-3"} shrink-0 rounded-sm bg-[#15202B]/80`}
                              style={{ width: `${Math.max(share, 2) * (projector ? 4 : 2)}px` }}
                              aria-hidden="true"
                            />
                            <span className={projector ? "min-w-0 truncate text-lg" : "min-w-0 truncate text-xs"} title={choice.label}>
                              {choice.label}
                              <span className="ml-1 text-muted-foreground">({choice.count}명)</span>
                              {isLearnerChoice && <span className="ml-2 rounded-full bg-[#F3D248] px-2 py-0.5 text-[12px] font-black text-[#15202B]">내 선택</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default ClassResponsePatterns;
