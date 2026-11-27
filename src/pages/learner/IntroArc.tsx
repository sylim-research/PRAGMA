import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LearnerJourneyShell } from "@/components/learner/LearnerJourneyShell";
import {
  INTRO_STEPS,
  INTRO_FEATURE_ID,
  HOOK_SCENE,
  CONTEXT_CLUES,
  CLUES_REQUIRED,
  REPLAY_CASES,
  PRINCIPLE_TABLE,
  PRINCIPLE_LEAD,
  STRATEGY_MAP_UNLOCK,
  CLASS_LABELS,
  CLASSIFY_PROMPT,
  CLASSIFY_CONTEXT,
  CLASSIFY_ITEMS,
  ARC_CLOSING,
  hasIntroArc,
  type ClassLabel,
  type IntroContextFrame,
} from "@/lib/mission/mockIntroArc";
import { WEEK_REQUEST } from "@/lib/mission/mockWeek";
import { updateFeatureState } from "@/lib/mission/learnerState";
import { useLearnerCourse } from "@/lib/curriculum/useLearnerCourse";
import { IS_DEMO } from "@/lib/auth/useProfile";

// 도입 아크 — 새 목표 특징 최초 도입 시 1회. 입력 먼저(맥락→관찰→명시→수용) 후
// 미션 1개로 합류한다. 미션 사이클(산출 먼저)과 순서가 반대인 상위 루프.
//
// 게이트: ②는 단서 3개 이상, ④는 3문항 분류 완료. ③에 도달하면 전략 지도가 열린다
// (선산출 원칙의 예외 — 같은 산출 문항의 복사 가능한 답안만 최초 수행 전 금지).

const CONTEXT_ROWS: {
  key: keyof IntroContextFrame;
  eyebrow: string;
  title: string;
}[] = [
  {
    key: "physical",
    eyebrow: "언제 · 어디서 · 어떤 방식으로",
    title: "장면 조건",
  },
  {
    key: "social",
    eyebrow: "누가 누구에게 · 어느 정도의 부담으로",
    title: "관계와 부담",
  },
  {
    key: "goal",
    eyebrow: "무엇을 이루려는가",
    title: "상호작용 목표",
  },
];

const ContextFrame = ({ context }: { context: IntroContextFrame }) => (
  <section aria-label="상황 맥락" className="grid gap-2.5 lg:grid-cols-3">
    {CONTEXT_ROWS.map((row) => (
      <div key={row.key} className="rounded-lg border border-[#E4DDCC] bg-[#FAF8F2] p-3">
        <p className="text-[10.5px] font-medium tracking-wide text-[#8A7450]">
          {row.eyebrow}
        </p>
        <h3 className="mt-0.5 text-[13px] font-bold text-foreground">{row.title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#5B5446]">
          {context[row.key]}
        </p>
      </div>
    ))}
  </section>
);

const IntroArc = () => {
  const navigate = useNavigate();
  // 편성 강좌에서 들어오면 :weekNo가 붙는다. 파라미터가 없으면 개발용 2주차 목업이다.
  const { courseId, weekNo: weekNoParam } = useParams();
  const liveWeekNo = weekNoParam ? Number(weekNoParam) : null;
  const { data: course = null, isPending: courseLoading } = useLearnerCourse(courseId);
  const liveWeek =
    liveWeekNo !== null && course
      ? course.weeks.find((w) => w.week_no === liveWeekNo) ?? null
      : null;
  // 아크를 마치면 같은 주차의 실제 미션으로 합류한다(아크 사례 ≠ 산출 문항).
  const arcScenario =
    liveWeek?.scenarios.find((s) => hasIntroArc(s.target_feature) && s.runnable) ??
    null;
  const [stepIdx, setStepIdx] = useState(0);
  const [foundClues, setFoundClues] = useState<number[]>([]);
  const [picks, setPicks] = useState<Record<number, ClassLabel>>({});

  const step = INTRO_STEPS[stepIdx];
  const cluesEnough = foundClues.length >= CLUES_REQUIRED;
  const classifyDone = Object.keys(picks).length >= CLASSIFY_ITEMS.length;
  const allRight = classifyDone && CLASSIFY_ITEMS.every((g, i) => picks[i] === g.truth);

  const canAdvance =
    step === "단서 추리" ? cluesEnough : step === "적용 판단" ? classifyDone : true;

  // 시연용 — 현재 단계의 게이트를 채운다. 이미 고른 값은 덮어쓰지 않는다.
  const fillDemo = () => {
    if (step === "단서 추리") {
      setFoundClues((prev) =>
        prev.length >= CLUES_REQUIRED
          ? prev
          : CONTEXT_CLUES.map((_, i) => i).slice(0, CLUES_REQUIRED),
      );
    }
    if (step === "적용 판단") {
      setPicks((prev) => {
        const next = { ...prev };
        CLASSIFY_ITEMS.forEach((g, i) => {
          if (next[i] === undefined) next[i] = g.truth;
        });
        return next;
      });
    }
  };

  const advance = () => {
    // ③ 원리 이해 도달 = 명시적 설명을 봄 → 전략 지도 개방 조건 충족
    if (INTRO_STEPS[stepIdx + 1] === "원리 연결") {
      updateFeatureState(INTRO_FEATURE_ID, { introExplanationCompleted: true });
    }
    setStepIdx((i) => Math.min(INTRO_STEPS.length - 1, i + 1));
  };

  const finish = () => {
    updateFeatureState(INTRO_FEATURE_ID, { introExplanationCompleted: true });
    const returnQuery = courseId && liveWeekNo !== null
      ? `?courseId=${encodeURIComponent(courseId)}&weekNo=${liveWeekNo}`
      : "";
    navigate(
      arcScenario
        ? `/learner/practice/${arcScenario.scenario_id}${returnQuery}`
        : "/learner/practice",
    );
  };

  // ── 화면들 ──

  const screenHook = () => (
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="text-[12px] font-bold text-[#B8860B]">{HOOK_SCENE.eyebrow}</div>
      <h2 className="mt-1 text-[19px] font-bold">{HOOK_SCENE.title}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
        {HOOK_SCENE.lead}
      </p>

      <div className="mx-auto mt-4 max-w-[470px] overflow-hidden rounded-[22px] border border-[#C9D0D4] bg-[#EDEFF0] shadow-sm">
        <div className="flex items-center justify-between border-b border-[#D5DADD] bg-[#F8F9F9] px-4 py-3">
          <div>
            <p className="text-[13.5px] font-bold text-[#1F2933]">{HOOK_SCENE.threadTitle}</p>
            <p className="mt-0.5 text-[10.5px] text-[#7B858B]">{HOOK_SCENE.threadMeta}</p>
          </div>
          <span className="h-2 w-2 rounded-full bg-[#29A56C]" aria-label="온라인" />
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="flex justify-end">
            <div className="max-w-[84%] rounded-2xl rounded-tr-sm bg-[#95EC69] px-3.5 py-2.5 text-[14.5px] leading-relaxed text-[#162016] shadow-sm">
              {HOOK_SCENE.lines[0].zh}
            </div>
          </div>
          <p className="pr-1 text-right text-[10.5px] text-[#879096]">
            {HOOK_SCENE.lines[1].note}
          </p>

          <div className="mx-auto w-fit rounded-full bg-white/80 px-3 py-1.5 text-[11px] text-[#68757C]">
            <span className="mr-1.5 inline-flex gap-0.5" aria-hidden>
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#68757C]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#68757C] [animation-delay:120ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-[#68757C] [animation-delay:240ms]" />
            </span>
            {HOOK_SCENE.lines[2].note}
          </div>
          <p className="text-center text-[10.5px] text-[#9AA2A7]">
            {HOOK_SCENE.lines[3].note}
          </p>

          <div className="flex items-end gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#556979] text-[11px] font-bold text-white">
              李
            </div>
            <div>
              <p className="mb-1 text-[10.5px] text-[#7B858B]">{HOOK_SCENE.lines[4].note}</p>
              <div className="w-fit rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-[14.5px] text-[#1F2933] shadow-sm">
                {HOOK_SCENE.lines[4].zh}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="flex h-12 w-14 items-center justify-center rounded-md border border-[#D6DBDE] bg-[#F9FAFA] text-[9.5px] text-[#7B858B]"
                  >
                    笔记 {n}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#1B2836] px-4 py-3.5 text-white">
        <p className="text-[12px] leading-relaxed text-[#B8C3CB]">{HOOK_SCENE.outcome}</p>
        <p className="mt-2 text-[16px] font-bold leading-snug">{HOOK_SCENE.question}</p>
      </div>
    </div>
  );

  const screenNotice = () => (
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="text-[12px] font-bold text-[#B8860B]">대화 속에 숨은 네 단서</div>
      <h2 className="mt-1 text-[19px] font-bold">무엇이 말의 인상을 바꾸었을까?</h2>
      <p className="mt-1.5 text-[13.5px] text-muted-foreground">
        첫 화면에서는 감춰 두었던 장면의 조건입니다. 단서를 열어, 각 조건이 어떤 표현
        선택과 연결되는지 추리하십시오.
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {CONTEXT_CLUES.map((clue, i) => {
          const opened = foundClues.includes(i);
          return (
          <button
            key={i}
            type="button"
            onClick={() => setFoundClues((prev) => (prev.includes(i) ? prev : [...prev, i]))}
            aria-pressed={opened}
            className={[
              "min-h-[122px] rounded-lg border p-3 text-left transition-all",
              opened
                ? "border-[#D9B82F] bg-[#FFFBEA] shadow-sm"
                : "border-dashed border-[#C9B98A] bg-[#FAF8F2] hover:border-[#B8860B] hover:bg-[#FFFDF4]",
            ].join(" ")}
          >
            <span className="inline-flex rounded-full bg-[#1B2836] px-2 py-0.5 text-[10.5px] font-bold text-white">
              {clue.tag}
            </span>
            {opened ? (
              <>
                <strong className="mt-2 block text-[13px]">{clue.title}</strong>
                <span className="mt-1 block text-[12px] leading-relaxed text-[#5B5446]">
                  {clue.fact}
                </span>
                <span className="mt-2 block border-t border-[#EAD78A] pt-2 text-[11.5px] font-semibold leading-relaxed text-[#765D00]">
                  표현에 미치는 영향 · {clue.effect}
                </span>
              </>
            ) : (
              <span className="mt-5 block text-center text-[12px] font-semibold text-[#8A7450]">
                이 단서가 왜 중요할까?
              </span>
            )}
          </button>
          );
        })}
      </div>

      <div className="mt-3 inline-block rounded-full bg-[#15202B] px-3 py-1 text-[12px] font-bold text-white">
        단서 {foundClues.length} / {CONTEXT_CLUES.length} 발견 {cluesEnough && "— 비교가 열렸습니다"}
      </div>

      {cluesEnough && (
        <div className="mt-5">
          <p className="text-[13.5px] font-bold text-foreground">
            같은 장면, 두 가지 가능한 전개
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            상대의 반응은 하나로 결정되지 않습니다. 아래는 표현이 대화의 다음 차례에
            어떤 여지를 만들 수 있는지 보여주는 검토된 예시입니다.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {[REPLAY_CASES.first, REPLAY_CASES.alternative].map((c, i) => (
              <div
                key={c.label}
                className={[
                  "rounded-lg border p-3",
                  i === 0 ? "border-[#D8D3C8] bg-[#F7F6F2]" : "border-[#9BD2B8] bg-[#F2FBF6]",
                ].join(" ")}
              >
                <Badge
                  className={
                    i === 0
                      ? "bg-[#E8E5DD] text-[11px] text-[#544F45] hover:bg-[#E8E5DD]"
                      : "bg-[#D8F2E3] text-[11px] text-[#185C3E] hover:bg-[#D8F2E3]"
                  }
                >
                  {c.label}
                </Badge>
                <div className="mt-2.5 rounded-md bg-white px-3 py-2 text-[13px] leading-relaxed">
                  <span className="mr-1.5 text-[10.5px] text-muted-foreground">민준</span>
                  {c.request}
                </div>
                <div className="mt-1.5 rounded-md bg-white px-3 py-2 text-[13px] leading-relaxed">
                  <span className="mr-1.5 text-[10.5px] text-muted-foreground">리웨이</span>
                  {c.response}
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{c.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[12px] text-muted-foreground">
        세 단서 이상을 열면 두 대화의 전개를 비교할 수 있습니다.
      </p>
    </div>
  );

  const screenPrinciple = () => (
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="text-[12px] font-bold text-[#B8860B]">맥락과 표현의 연결</div>
      <h2 className="mt-1 text-[19px] font-bold">방금 장면을 이렇게 읽습니다</h2>

      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
        앞에서 발견한 단서를 장면 조건·관계와 부담·상호작용 목표로 정리합니다.
      </p>
      <div className="mt-4">
        <ContextFrame context={HOOK_SCENE.context} />
      </div>

      <dl className="mt-4 overflow-hidden rounded-lg border border-[#EAE4D2]">
        {PRINCIPLE_TABLE.map((r) => (
          <div key={r.k} className="flex border-b border-[#EAE4D2] last:border-b-0">
            <dt className="w-[110px] shrink-0 bg-[#F5F5F2] px-3 py-2.5 text-[12px] font-medium">
              {r.k}
            </dt>
            <dd
              className={[
                "flex-1 px-3 py-2.5 text-[13.5px]",
                r.hi ? "bg-[#FFFBEA] font-medium" : "",
              ].join(" ")}
            >
              {r.v}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{PRINCIPLE_LEAD}</p>

      <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-[#FAD338] bg-[#FFFBEA] p-3.5 text-[13.5px] font-semibold">
        <span aria-hidden>🔓</span>
        <span>{STRATEGY_MAP_UNLOCK}</span>
      </div>
    </div>
  );

  const screenClassify = () => (
    <div className="rounded-xl border border-[#EAE4D2] bg-white p-4">
      <div className="text-[12px] font-bold text-[#B8860B]">새 장면에 적용</div>
      <h2 className="mt-1 text-[19px] font-bold">세 표현의 적절한 범위를 판단합니다</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
        {CLASSIFY_PROMPT}
      </p>

      <div className="mt-4">
        <ContextFrame context={CLASSIFY_CONTEXT} />
      </div>

      <div className="mt-3.5 space-y-2.5">
        {CLASSIFY_ITEMS.map((g, i) => {
          const sel = picks[i];
          return (
            <div key={i} className="rounded-lg border border-[#EAE4D2] p-3">
              <p className="text-[15px]">{g.zh}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {CLASS_LABELS.map(({ key, label }) => {
                  const on = sel === key;
                  const right = on && key === g.truth;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPicks((p) => ({ ...p, [i]: key }))}
                      className={[
                        "rounded-md border px-3 py-1 text-[12px] transition-colors",
                        on
                          ? right
                            ? "border-emerald-600 font-bold text-emerald-700"
                            : "border-destructive font-bold text-destructive"
                          : "border-[#EAE4D2] hover:bg-muted",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {sel && (
                <p
                  className={[
                    "mt-2 text-[13px] font-semibold",
                    sel === g.truth ? "text-emerald-700" : "text-destructive",
                  ].join(" ")}
                >
                  {sel === g.truth ? "✓ " : "✗ "}
                  {g.fb}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {classifyDone && (
        <p className="mt-3 text-[13.5px] text-muted-foreground">
          {allRight ? ARC_CLOSING.allRight : ARC_CLOSING.partial}
        </p>
      )}
    </div>
  );

  const SCREENS: Record<string, () => JSX.Element> = {
    "결과 보기": screenHook,
    "단서 추리": screenNotice,
    "원리 연결": screenPrinciple,
    "적용 판단": screenClassify,
  };

  const nextLabel = [
    "단서 열기",
    "다음: 원리 연결",
    "다음: 새 장면에 적용",
  ][stepIdx];

  // 편성 강좌에서 들어왔는데 이 주차에 아크 콘텐츠가 없으면 열지 않는다 —
  // 다른 화행 주차에 요청 사례를 보여주는 것이 가장 나쁜 실패다.
  if (liveWeekNo !== null) {
    if (courseLoading) {
      return (
        <LearnerJourneyShell>
          <p className="text-[13px] text-muted-foreground">불러오는 중…</p>
        </LearnerJourneyShell>
      );
    }
    if (!arcScenario) {
      return <Navigate to={courseId ? `/learner/course/${courseId}` : "/learner/course"} replace />;
    }
  }

  const weekLabel =
    liveWeek !== null
      ? `${liveWeek.week_no}주차 · ${liveWeek.title}`
      : `${WEEK_REQUEST.weekNo}주차 · ${WEEK_REQUEST.speechAct}`;

  return (
    <LearnerJourneyShell
      headerRight={<span className="text-[12px] text-[#8899A6]">{weekLabel}</span>}
    >
      <nav aria-label="학습 위치" className="mb-3 text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground">{weekLabel}</span>
        <span aria-hidden className="mx-1.5">›</span>
        처음 배우기
      </nav>

      {/* 아크 진행바 — 4단계 */}
      <ol className="flex gap-1.5">
        {INTRO_STEPS.map((s, i) => (
          <li key={s} className="flex-1 text-center">
            <div
              className={[
                "h-[3px] rounded-full",
                i <= stepIdx ? "bg-[#FAD338]" : "bg-[#D3D1C7]",
              ].join(" ")}
            />
            <div
              className={[
                "mt-1.5 text-[11px]",
                i === stepIdx ? "font-bold text-foreground" : "text-muted-foreground",
              ].join(" ")}
            >
              {s}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6">{SCREENS[step]()}</div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={stepIdx === 0}
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
        >
          ← 이전
        </Button>
        {/* 시연용 — 실증 시작 시 IS_DEMO를 끄면 번들에서 사라진다. */}
        {IS_DEMO && (step === "단서 추리" || step === "적용 판단") && (
          <button
            type="button"
            onClick={fillDemo}
            className="rounded-md border border-dashed border-[#C9B98A] bg-[#FFFBEA] px-3 py-1.5 text-[12px] font-semibold text-[#8A6D00] hover:bg-[#FDF3CE]"
          >
            데모 채우기
          </button>
        )}
        {step !== "적용 판단" ? (
          <Button onClick={advance} disabled={!canAdvance}>
            {nextLabel} →
          </Button>
        ) : (
          <Button onClick={finish} disabled={!classifyDone}>
            {ARC_CLOSING.cta} →
          </Button>
        )}
      </div>
    </LearnerJourneyShell>
  );
};

export default IntroArc;
