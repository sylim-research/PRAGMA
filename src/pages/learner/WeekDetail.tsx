import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import { WEEK_REQUEST, getWeekProgress } from "@/lib/mission/mockWeek";
import { getProgress, getFeatureState } from "@/lib/mission/learnerState";
import { hasPracticeSession } from "@/lib/mission/practiceSession";

// 주차 상세 — 이중 루프를 학습자 언어의 4단계로 보여주는 화면.
// weekType: "speech_act" 요청 주차 1개만 구현 (콘텐츠 구성은 추후 지시 예정).
// ④실력 점검 엔진(AnchorMission)은 후보 단계 — 별도 감사 후 연결, 여기선 잠금 표시만.

const StageCard = ({
  no,
  label,
  desc,
  status,
  children,
}: {
  no: string;
  label: string;
  desc?: string;
  status: string;
  children?: React.ReactNode;
}) => (
  <section className="rounded-xl border border-[#EAE4D2] bg-white p-4">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[14.5px] font-semibold">
        {no} {label}
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
        {status}
      </span>
    </div>
    {desc && <p className="mt-1 text-[12.5px] text-muted-foreground">{desc}</p>}
    {children}
  </section>
);

const WeekDetail = () => {
  const navigate = useNavigate();
  const w = WEEK_REQUEST;
  const progress = useMemo(() => getProgress(), []);
  const weekProg = useMemo(() => getWeekProgress(), []);
  const feature = useMemo(() => getFeatureState(w.featureId), [w.featureId]);

  const quickDoneCount = w.stages.practice.items.filter((i) =>
    progress.completedMissionIds.includes(i.missionId),
  ).length;
  const transferDone = progress.completedMissionIds.includes(w.stages.transfer.item.missionId);

  return (
    <LearnerJourneyShell nav
      headerRight={<span className="text-[12px] text-[#8899A6]">{w.weekNo}주차 · {w.title}</span>}
    >
      <div className="space-y-3 pb-20">
        {/* 주차 헤더 */}
        <section className="rounded-xl bg-[#FAD338] px-5 py-4 text-[#15202B]">
          <div className="text-[12px] font-bold">{w.weekNo}주차 · {w.speechAct}</div>
          <h2 className="mt-1 text-[18px] font-bold leading-snug">이번 주 핵심: {w.keyIdea}</h2>
          <p className="mt-1.5 text-[12.5px]">
            진행률 {weekProg.done} / {weekProg.total}
            {feature.strategyMapUnlocked && (
              <>
                {" · "}
                {/* 열렸다고 알리기만 하고 갈 곳이 없으면 안 된다 — 실제로 연결한다. */}
                <Link to="/learner/demo/strategy" className="font-bold underline underline-offset-2">
                  전략 지도 열림 🔓
                </Link>
              </>
            )}
          </p>
        </section>

        <Link
          to={`/learner/demo/course/week/${w.weekNo}/note`}
          className="flex items-center justify-between rounded-xl border border-[#15202B] bg-white px-4 py-3 text-[#15202B]"
        >
          <span>
            <span className="block text-[14px] font-semibold">이번 주 학습 노트</span>
            <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
              목표·상황·표현 선택 원리를 1~2장으로 정리했습니다
            </span>
          </span>
          <span className="shrink-0 text-[13px] font-bold">보기 →</span>
        </Link>

        {/* ① 처음 배우기 (도입 아크) — 이수 여부는 featureState로 판정 */}
        <StageCard
          no="①"
          label={w.stages.intro.label}
          desc={w.stages.intro.desc}
          status={feature.introExplanationCompleted ? "완료" : "시작 전"}
        >
          <button
            type="button"
            onClick={() => navigate(`/learner/demo/course/week/${w.weekNo}/intro`)}
            className="mt-3 w-full rounded-md bg-[#15202B] px-3 py-2.5 text-[13px] font-medium text-white"
          >
            {feature.introExplanationCompleted ? "다시 보기" : "시작"}
          </button>
        </StageCard>

        {/* ② 직접 연습 */}
        <StageCard
          no="②"
          label={w.stages.practice.label}
          status={`${quickDoneCount} / ${w.stages.practice.items.length}`}
        >
          <ul className="mt-3 space-y-2">
            {w.stages.practice.items.map((item) => {
              const done = progress.completedMissionIds.includes(item.missionId);
              const resuming = !done && item.available && hasPracticeSession(item.missionId, item.mode);
              return (
                <li
                  key={item.missionId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#EAE4D2] px-3 py-2.5"
                >
                  <span className="text-[13.5px]">
                    {done ? "✓ " : ""}
                    {item.label}
                  </span>
                  {item.available ? (
                    <button
                      type="button"
                      onClick={() => navigate("/learner/practice")}
                      className="shrink-0 rounded-md bg-[#15202B] px-3 py-1.5 text-[12px] font-medium text-white"
                    >
                      {done ? "다시 하기" : resuming ? "이어하기" : "시작"}
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                      준비 중
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </StageCard>

        {/* ③ 상황 바꿔보기 (전이) */}
        <StageCard
          no="③"
          label={w.stages.transfer.label}
          desc={w.stages.transfer.desc}
          status={transferDone ? "완료" : quickDoneCount > 0 ? "가능" : "직접 연습 후"}
        >
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-[#EAE4D2] px-3 py-2.5">
            <span className="text-[13.5px]">
              {transferDone ? "✓ " : ""}
              {w.stages.transfer.item.label}
            </span>
            {quickDoneCount > 0 ? (
              <button
                type="button"
                onClick={() => navigate("/learner/practice")}
                className="shrink-0 rounded-md bg-[#15202B] px-3 py-1.5 text-[12px] font-medium text-white"
              >
                {transferDone ? "다시 하기" : "시작"}
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                잠김
              </span>
            )}
          </div>
        </StageCard>

        {/* ④ 실력 점검 (앵커 — 후보 엔진 감사 전, 잠금) */}
        <StageCard
          no="④"
          label={w.stages.anchor.label}
          desc={w.stages.anchor.desc}
          status={w.stages.anchor.lockedNote}
        />
      </div>
    </LearnerJourneyShell>
  );
};

export default WeekDetail;
