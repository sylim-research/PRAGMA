import { Link } from "react-router-dom";
import { ArrowRight, ArrowUp } from "lucide-react";
import { HomeBrand } from "@/components/HomeBrand";
import { MPJ_ITEM_COUNT } from "@/lib/curriculum/learnerWorkflow";
import { IS_DEMO } from "@/lib/auth/useProfile";
import { REPRESENTATIVE_MISSION_PATH } from "@/lib/demo/representativeMission";

// 심사 설명용 read-only 화면. README의 Fig. 1(docs/figures/fig1-pragma-workflow.png)과
// 같은 구조·같은 용어로 그린다 — GitHub·웹·논문이 하나의 그림을 공유한다.
// 단계는 번호 원과 세로선 하나로만 잇는다 — 테두리 상자를 쓰지 않아 선이 적고, 칸 안의 모든 단계가 같은 무게다.

type Step = readonly [title: string, desc?: string];

const Steps = ({ steps, dot }: { steps: readonly Step[]; dot: string }) => (
  <ol>
    {steps.map(([title, desc], index) => (
      <li key={title} className="relative flex gap-4 pb-6 last:pb-0">
        {index < steps.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-[2px] bg-[#E2DED2]" />}
        <span aria-hidden className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${dot}`}>{index + 1}</span>
        <div className="pt-[3px]">
          <p className="break-keep text-[15.5px] font-bold leading-snug text-[#15202B]">{title}</p>
          {desc && <p className="mt-0.5 whitespace-nowrap text-[13.5px] leading-snug text-[#4E5F6C]">{desc}</p>}
        </div>
      </li>
    ))}
  </ol>
);

// 세 칸은 같은 크기·같은 왼쪽 정렬 제목을 쓰고, 칸마다 머리띠를 둔다(2026-10-08).
// 주인공인 두 워크플로우는 브랜드 색으로 채운 머리(제작 = 남색, 학습 = 옐로우), 둘을 잇는 수업 운영은 한 단계 옅은 남회색 머리로 둔다.
const Lane = ({ title, head, children }: { title: string; head: string; children: React.ReactNode }) => (
  <section className="flex flex-col overflow-hidden rounded-xl border border-[#E2DED2] bg-white">
    <h2 className={`px-6 py-3 text-left text-[17px] font-bold ${head}`}>{title}</h2>
    <div className="flex-1 px-6 pb-6 pt-5">{children}</div>
  </section>
);

// 칸(상자)과 칸을 세로 가운데에서 잇는다 — 선과 화살표가 상자 사이를 건너고, 문구는 그 아래에 둔다.
const Connector = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center gap-2 py-1 lg:flex-col lg:gap-1 lg:py-0" aria-hidden>
    <span className="flex w-full items-center lg:px-2">
      <span className="hidden h-[2px] flex-1 bg-[#15202B] lg:block" />
      <ArrowRight size={22} strokeWidth={2} className="-ml-1.5 shrink-0 rotate-90 text-[#15202B] lg:rotate-0" />
    </span>
    <span className="whitespace-nowrap text-center text-[12.5px] font-semibold leading-snug text-[#15202B]">{label}</span>
  </div>
);

// 되먹임 고리 — 학습 기록이 수업 운영(학급 응답 집계)을 거쳐 콘텐츠 제작(후속 검토·재승인)으로 돌아간다.
// 세 칸 아래 가운데에서 내려온 선이 한 줄로 이어져, 세 칸이 하나의 순환으로 묶인다. 칸 폭은 (전체 − 연결 칸 200px) ÷ 3.
const FeedbackLoop = () => (
  <div className="relative mt-0 hidden h-[52px] lg:block" aria-label="되먹임: 학습 기록 → 학급 응답 집계 → 후속 콘텐츠 검토·재승인">
    {/* 가로선: 제작 칸 가운데 ~ 학습 칸 가운데 */}
    <span aria-hidden className="absolute bottom-[14px] left-[calc((100%-200px)/6)] right-[calc((100%-200px)/6)] border-b-2 border-dashed border-[#4A5764]" />
    {/* 세 칸 가운데에서 내려오는 선 */}
    <span aria-hidden className="absolute bottom-[14px] left-[calc((100%-200px)/6)] top-0 -translate-x-px border-l-2 border-dashed border-[#4A5764]" />
    <span aria-hidden className="absolute bottom-[14px] left-1/2 top-0 -translate-x-px border-l-2 border-dashed border-[#4A5764]" />
    <span aria-hidden className="absolute bottom-[14px] right-[calc((100%-200px)/6)] top-0 translate-x-px border-r-2 border-dashed border-[#4A5764]" />
    {/* 제작 칸으로 돌아가는 화살촉 */}
    <ArrowUp aria-hidden size={18} strokeWidth={2.25} className="absolute -top-[3px] left-[calc((100%-200px)/6)] -translate-x-1/2 bg-background text-[#4A5764]" />
    {/* 구간 문구 — 오른쪽(학습 → 운영), 왼쪽(운영 → 제작) */}
    <span className="absolute bottom-[5px] left-[calc(75%-(100%-200px)/12)] -translate-x-1/2 whitespace-nowrap bg-background px-2 text-[12.5px] font-semibold text-[#4A5764]">← 학습 기록 · 학급 응답</span>
    <span className="absolute bottom-[5px] left-[calc(25%+(100%-200px)/12)] -translate-x-1/2 whitespace-nowrap bg-background px-2 text-[12.5px] font-semibold text-[#4A5764]">← 후속 콘텐츠 검토 · 재승인</span>
  </div>
);

const CONTENT_STEPS: readonly Step[] = [
  ["시나리오·학습 미션 생성", "화행 × P·D·R × 도메인"],
  ["자동 품질 점검", "규칙 기반 · 형식·정합성 확인"],
  ["AI 검토", "1차 검토 · 필요 시 교차 검토"],
  ["교수자 감수", "단계별 확인 · 수정 필요 표시"],
  ["교수자 최종 승인", "수업 사용·공개 결정"],
];
const CLASS_STEPS: readonly Step[] = [
  ["15주 교과목 편성", "주차별 학습 미션 배치"],
  ["학습자 관리", "계정 · 교과목 · 최근 활동"],
  ["주차별 운영", "교과목 공개와 접근 조건"],
  ["학급 응답 집계·조회", "익명 분포와 서로 다른 판단"],
  ["후속 콘텐츠 검토", "필요 시 수정 · 재승인"],
];
const LEARNING_STEPS: readonly Step[] = [
  ["MJT 판단 문항", `판단·이유·비교·수정 ${MPJ_ITEM_COUNT}문항`],
  ["DCT형 통번역 과제", "번역·통역 · 한→중 / 중→한"],
  ["AI 피드백", "의미·문법·화용 기준"],
  ["학습자의 재검토", "유지 또는 수정은 학습자가 결정"],
  ["학습자 최종 결정", "학습 기록 저장"],
];

// 단계별 기록은 그 기록이 남는 관리자 화면으로 연결한다(관리자 로그인 필요).
// 이름은 연결되는 화면의 메뉴명과 같게 둔다 — 누른 뒤 도착한 화면 제목이 태그와 같아야 한다(2026-10-08).
const TRACE = [
  { label: "자동 품질 검토", to: "/admin/ai-review" },
  { label: "교수자 감수·최종 승인", to: "/admin/review" },
  { label: "학습 수행 기록", to: "/admin/decision-traces" },
  { label: "운영 프롬프트", to: "/admin/prompt-harness" },
] as const;

const Architecture = () => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <header className="sticky top-0 z-40 bg-[#15202B]">
      <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-4 px-6 py-[11px]">
        {/* 다른 화면과 같은 브랜드 헤더 — 화면 이름은 아래 Fig. 1 제목이 맡는다. */}
        <HomeBrand largerText />
        <div className="flex items-center gap-2">
          {IS_DEMO && (
            <Link to={REPRESENTATIVE_MISSION_PATH}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/35 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/10">
              학습 미션 체험
            </Link>
          )}
          <Link to="/" className="rounded-lg border border-white/35 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/10">
            ← 처음으로
          </Link>
        </div>
      </div>
    </header>

    <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col justify-center px-6 py-4">
      <h1 className="mb-4 flex items-center gap-3 text-[15.5px] font-bold text-[#15202B]">
        <span className="tracking-[0.06em] text-[#8A949E]">Fig. 1</span>
        PRAGMA 워크플로우
        <span aria-hidden className="h-px flex-1 bg-[#E2DED2]" />
      </h1>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_100px_1fr_100px_1fr] lg:gap-0">
        <Lane title="콘텐츠 제작 워크플로우" head="bg-[#15202B] text-white">
          <Steps steps={CONTENT_STEPS} dot="bg-[#15202B] text-white" />
        </Lane>

        <Connector label="승인 후 편성" />

        <Lane title="수업 운영" head="bg-[#4A5764] text-white">
          <Steps steps={CLASS_STEPS} dot="bg-[#4A5764] text-white" />
        </Lane>

        <Connector label="학습자에게 공개" />

        <Lane title="통번역 학습 워크플로우" head="bg-[#FAD338] text-[#15202B]">
          <Steps steps={LEARNING_STEPS} dot="bg-[#FAD338] text-[#15202B]" />
        </Lane>
      </div>

      <FeedbackLoop />

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[#E2DED2] px-1 pt-3">
        <span className="mr-1 text-[14px] font-bold text-[#15202B]">단계별 기록</span>
        {TRACE.map(({ label, to }) => (
          <Link key={label} to={to}
            className="inline-flex items-center gap-1 rounded-md border border-[#E2DED2] bg-white px-2.5 py-1 text-[13px] font-medium text-[#3F4E59] transition-colors hover:border-[#15202B] hover:text-[#15202B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B]">
            {label}<ArrowRight aria-hidden size={12} strokeWidth={2} />
          </Link>
        ))}
      </div>
    </main>
  </div>
);

export default Architecture;
