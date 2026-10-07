import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, MapPin, ListChecks, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { setTaskMode, setLanguageDirection } from "@/lib/entryGate";
import { DEFAULT_LEARNING_CONTEXT } from "@/lib/learningContext";
import { useProfile } from "@/lib/auth/useProfile";
import { MPJ_ITEM_COUNT } from "@/lib/curriculum/learnerWorkflow";

/**
 * 학습자의 현재 주차.
 * 임시 고정값(1주차). 진행 추적(decision_traces 기반 "완료한 마지막 주차+1")
 * 도입 시 이 함수만 교체하면 됨.
 */
const getCurrentWeek = (): number => 1;

/**
 * ROADMAP — 15주 화행 기반 커리큘럼
 * 정적 주차표. DB나 주차 배정 로직과 무관하게 표시용으로 사용합니다.
 */
type Stage =
  | "시작"
  | "기초 적용"
  | "관계 조정"
  | "중간점검"
  | "통합 수행"
  | "기말 종합";

type RoadmapItem = {
  week: number;
  stage: Stage;
  topic: string;
};

// 공통 표준 15주 골격(2026-07-25) — mockLearnerCourse.ts(COURSE_WEEKS) ·
// curriculum/template.ts(STANDARD_15WEEK)와 동기화. 단계 = 기초 적용→관계 조정→통합 수행.
const ROADMAP: RoadmapItem[] = [
  { week: 1, stage: "시작", topic: "오리엔테이션 · 출발점 확인" },
  { week: 2, stage: "기초 적용", topic: "요청" },
  { week: 3, stage: "기초 적용", topic: "감사" },
  { week: 4, stage: "기초 적용", topic: "초대 · 공동행동 권유" },
  { week: 5, stage: "기초 적용", topic: "칭찬하기" },
  { week: 6, stage: "관계 조정", topic: "거절" },
  { week: 7, stage: "관계 조정", topic: "사과 · 수리" },
  { week: 8, stage: "중간점검", topic: "중간 통합 점검" },
  { week: 9, stage: "관계 조정", topic: "불만 · 문제 제기" },
  { week: 10, stage: "관계 조정", topic: "제안 · 조언" },
  { week: 11, stage: "관계 조정", topic: "반대 · 이견 제시" },
  { week: 12, stage: "통합 수행", topic: "복합 화용 조정" },
  { week: 13, stage: "통합 수행", topic: "새 맥락에 적용하기" },
  { week: 14, stage: "통합 수행", topic: "통번역 의사결정 정리" },
  { week: 15, stage: "기말 종합", topic: "기말 통합 수행 점검" },
];

const TODAY = {
  intro: `${MPJ_ITEM_COUNT}개 판단 문항에서 표현의 차이를 살핀 뒤, 새로운 상황을 직접 번역·통역하고 AI 피드백을 바탕으로 다듬습니다.`,
  steps: [
    "오늘의 화용 초점 확인",
    `${MPJ_ITEM_COUNT}개 판단 문항으로 표현 감각 익히기`,
    "새 상황의 상대와 부담 확인",
    "직접 번역·통역하기",
    "AI 피드백으로 의미·문법·화용 확인",
    "초안을 다시 다듬기",
    "오늘의 원리와 최초·최종안 확인",
  ],
};

const STAGE_STYLE: Record<Stage, string> = {
  "시작": "bg-muted text-muted-foreground",
  "기초 적용": "bg-muted text-foreground/80",
  "관계 조정": "bg-muted text-foreground/80",
  "중간점검": "bg-destructive/10 text-destructive border border-destructive/30",
  "통합 수행": "bg-muted text-foreground/80",
  "기말 종합": "bg-destructive/10 text-destructive border border-destructive/30",
};

const Roadmap = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const isProfileComplete = !!profile?.profile_completed;
  // 프로필 미완료 시 활성 주차 없음 → 강조/체크/핀 없이 균일 렌더링
  const activeWeek = isProfileComplete ? getCurrentWeek() : -1;
  const [roadmap] = useState<RoadmapItem[]>(ROADMAP);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 1. Header (dark) */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4 px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-1 h-6 w-1.5 rounded-sm bg-accent" aria-hidden />
            <div>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="text-left text-[19px] font-bold tracking-[0.18em] hover:underline sm:text-[20px]"
              >
                PRAGMA
              </button>

              <p className="mt-1 text-[13px] text-primary-foreground/70">
                상황에 맞는 표현을 판단하고 수정하는 화용 의사결정 훈련
              </p>
            </div>
          </div>
          <div className="shrink-0 pt-1">
            <span className="inline-block rounded-lg border border-accent px-3 py-1.5 text-[12px] font-semibold text-accent">
              강의계획 · 15주차 학습 설계
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-5">
        {/* 2. Top card */}
        <section
          className="rounded-2xl bg-accent p-4 text-accent-foreground"
          aria-label="15주 화행 기반 커리큘럼"
        >
          <div className="flex items-center gap-2 text-[15px] font-bold">
            <MapPin className="h-4 w-4" aria-hidden />
            15주 강의 설계
          </div>
          <h2 className="mt-2 text-[22px] font-bold leading-snug sm:text-[24px]">
            화행 기반 커리큘럼
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed">
            이 과정은 15주 동안 주요 화행을 단계적으로 학습하도록 설계되었습니다. 실제 과제의 수준, 언어방향, 산출 방식은 강의 운영 방식에 따라 달라질 수 있습니다.
          </p>
          <p className="mt-2 text-[14px] leading-relaxed opacity-90">
            감사, 칭찬, 요청, 제안, 수락·동의, 거절, 사과, 불만, 반대 표현을 다루고, 후반부에는 입장 조율과 조건 협상으로 확장합니다.
          </p>
        </section>

        {/* 3. Semester flow */}
        <section className="mt-5">
          <div className="flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-destructive" aria-hidden />
            <h3 className="text-[18px] font-bold">주차별 학습 계획</h3>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { items: roadmap.filter((i) => i.week <= 8), label: "1–8주차 · 중간점검까지" },
              { items: roadmap.filter((i) => i.week >= 9), label: "9–15주차 · 기말 종합까지" },
            ].map((col) => (
              <div key={col.label} className="rounded-2xl border border-border bg-card p-2.5">
                <div className="mb-2 inline-block rounded-full bg-muted px-3 py-1 text-[12px] font-semibold text-muted-foreground">
                  {col.label}
                </div>
                <ol className="space-y-1">
                  {col.items.map((item) => {
                    const isDone = item.week < activeWeek;
                    const isCurrent = item.week === activeWeek;
                    const isFuture = item.week > activeWeek || activeWeek < 0;

                    return (
                      <li
                        key={item.week}
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-2 py-1.5",
                          isCurrent && "bg-accent/25"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                            isDone && "bg-primary text-primary-foreground",
                            isCurrent && "bg-primary text-primary-foreground",
                            isFuture &&
                              "border border-border bg-background text-muted-foreground"
                          )}
                          aria-hidden
                        >
                          {isDone ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : isCurrent ? (
                            <MapPin className="h-3.5 w-3.5" />
                          ) : (
                            item.week
                          )}
                        </div>

                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium",
                            STAGE_STYLE[item.stage],
                            isFuture &&
                              item.stage !== "중간점검" &&
                              item.stage !== "기말 종합" &&
                              "opacity-70"
                          )}
                        >
                          {item.stage}
                        </span>

                        <div
                          className={cn(
                            "min-w-0 flex-1 text-[14px]",
                            isCurrent && "font-bold text-foreground",
                            isDone && "font-semibold text-foreground",
                            isFuture && "text-muted-foreground"
                          )}
                        >
                          <span className="font-semibold">{item.week}·</span> {item.topic}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Today's ordered steps */}
        <section className="mt-5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-destructive" aria-hidden />
            <h3 className="text-[18px] font-bold">오늘의 학습 흐름</h3>
          </div>
          <p className="mt-2 text-[14px] text-muted-foreground">{TODAY.intro}</p>

          <ol className="mt-3 space-y-1 rounded-2xl border border-border bg-card p-4">
            {TODAY.steps.map((label, idx) => (
              <li
                key={idx}
                className="flex items-center gap-4 rounded-lg px-2 py-1.5"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-[13px] font-semibold text-foreground">
                  {idx + 1}
                </div>
                <div className="text-[15px] text-foreground">{label}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* 5. Completion note (green left border) */}
        <section className="mt-5">
          <div className="flex items-start gap-3 rounded-xl border border-border border-l-4 border-l-emerald-600 bg-card p-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-[14px] leading-relaxed text-foreground">
              오늘 학습을 마치면 <b>초안 · 최종안 · 수행 맥락</b>이 수행 기록으로 남습니다.
            </p>
          </div>
        </section>

        {/* Workflow preview link — 정적 예시 페이지로 연결 */}
        <section className="mt-5">
          <button
            type="button"
            onClick={() => navigate("/workflow-preview")}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left text-[14px] font-semibold text-foreground hover:bg-muted/50"
          >
            <span>학습 진행 예시 미리보기</span>
            <span aria-hidden>→</span>
          </button>
        </section>

        {/* 6. CTA — 프로필 완료 여부로 분기 */}
        <section className="mt-5">
          {isProfileComplete ? (
            <button
              type="button"
              onClick={() => {
                // TEMP FALLBACK: 통역/번역·언어방향 선택 화면을 우회하고 바로 학습으로 진입.
                // assignments 연결 전까지만 DEFAULT_LEARNING_CONTEXT를 주입한다.
                setTaskMode(DEFAULT_LEARNING_CONTEXT.taskMode);
                setLanguageDirection(DEFAULT_LEARNING_CONTEXT.languageDirection);
                navigate("/scenario");
              }}
              className="w-full rounded-xl bg-accent px-6 py-4 text-[15px] font-bold text-accent-foreground shadow-sm transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              오늘의 학습 시작하기 →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/profile-setup")}
              className="w-full rounded-xl bg-accent px-6 py-4 text-[15px] font-bold text-accent-foreground shadow-sm transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              학습자 프로필 설정하기 →
            </button>
          )}
        </section>
      </main>
    </div>
  );
};

export default Roadmap;
