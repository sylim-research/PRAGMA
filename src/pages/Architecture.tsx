import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, PlayCircle, RotateCcw } from "lucide-react";
import { MPJ_ITEM_COUNT } from "@/lib/curriculum/learnerWorkflow";
import { IS_DEMO } from "@/lib/auth/useProfile";
import { REPRESENTATIVE_MISSION_PATH } from "@/lib/demo/representativeMission";

// 심사 설명용 read-only 화면. 현재 런타임 흐름과 수행 기록의 연구 활용 경계를 요약한다.
//
// 세 레인은 3.7절이 확정한 세 워크플로우 그대로다 — 콘텐츠 제작 / 학습자 수행 / 수업 운영.
// 수행 기록의 연구 활용은 네 번째 워크플로우가 아니라 세 레인 밖의 별도 절차이므로
// 레인으로 세우지 않고 하단 띠에 경계만 적는다. 각 카드는 3.5·3.6의 항과 1:1로 맞춘다.
//   ① 근거 자료·생성 계약 → 생성 → 자동 품질 점검 → AI 검토 → 교수자 최종 승인
//   ② 3.5.1 진입 · 도입 활동 · [미션] · 3.5.4 기록·이견 · 3.5.5 기록·후속 수행
//   ③ 3.6.1 편성 · 3.6.3 자료 · 3.6.2 조건 대비 · 3.6.4 기록 확인 · 후속 콘텐츠 검토
//
// 「검증」·「감수·승인」 세트명·수량 목표는 쓰지 않는다(용어대장 187·188행). 자동 품질
// 점검과 AI 검토는 층위가 다르므로 한 카드로 합치지 않는다(정본형 네 단계, 176행).

type Lane = "supply" | "learn" | "class";

const LANE = {
  supply: { num: "bg-[#3A4A5F]", node: "bg-[#EDF0F4] border-[#DCE1E9]" },
  learn: { num: "bg-[#2F6660]", node: "bg-[#E9F1EF] border-[#CFE0DC]" },
  class: { num: "bg-[#8A6A55]", node: "bg-[#F4EDE7] border-[#E3D5C8]" },
} as const;

// 배지 규칙 — 화면 전체에서 이 두 가지만 쓴다. 나머지(배지 없음)는 구현 완료다.
//   초록 실선 = 수업에서 실제로 하고 있다
//   회색 점선 = 아직 하지 않았다 → 라벨은 「준비 중」 하나로 통일한다
// 미실행 항목을 「연구 예정」·「구현 예정」처럼 여러 이름으로 부르면 심사에서
// 그 차이가 무슨 뜻이냐는 질문만 늘어난다. 아직 안 한 것은 다 「준비 중」이다.
// 점선은 미실행의 시각 관례라 색맹 조건에서도 형태만으로 갈린다.
const STATUS_TONE: Record<string, string> = {
  "수업 운영": "border-[#B6D3C0] bg-[#EAF5EE] text-[#2C5F4F]",
  "준비 중": "border-dashed border-[#C3CAD3] bg-white text-[#6B7785]",
};

const Node = ({
  lane,
  title,
  desc,
  status,
  decision,
}: {
  lane: Lane;
  title: string;
  desc: React.ReactNode;
  status?: string;
  /** 사람이 결정하는 노드 — AI 점검 노드와 성격이 다르다는 것을 테두리로 보인다. */
  decision?: boolean;
}) => (
  <div
    className={`rounded-[9px] border px-3 py-2.5 ${
      decision ? "border-[1.5px] border-[#3A4A5F] bg-white" : LANE[lane].node
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="break-keep text-[13px] font-bold leading-[1.3] text-[#15202B]">{title}</div>
      {status && (
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9.5px] font-semibold leading-none ${
            STATUS_TONE[status] ?? "border-[#D5C6B8] bg-white/70 text-[#765D4C]"
          }`}
        >
          {status}
        </span>
      )}
    </div>
    <div className="mt-0.5 break-keep text-[11px] leading-[1.35] text-muted-foreground">{desc}</div>
  </div>
);

const LaneHeader = ({
  lane,
  num,
  title,
  desc,
}: {
  lane: Lane;
  num: string;
  title: string;
  desc: React.ReactNode;
}) => (
  <div className="mb-3">
    <div className="flex items-center gap-2">
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white ${LANE[lane].num}`}>
        {num}
      </span>
      <h2 className="text-[15.5px] font-extrabold leading-tight tracking-[-0.025em] text-[#15202B]">{title}</h2>
    </div>
    <p className="mt-1 break-keep pl-7 text-[11px] leading-[1.35] text-muted-foreground">{desc}</p>
  </div>
);

// 강조는 밑줄이 아니라 글자 아래를 덮는 반투명 형광펜으로 — 랜딩 후크와 같은 어법이다.
const Mark = ({ children }: { children: React.ReactNode }) => (
  <b className="bg-[linear-gradient(to_top,rgba(250,211,56,.5)_40%,transparent_40%)] px-[1px] font-bold text-[#15202B]">
    {children}
  </b>
);

// 연결자는 타이핑한 글리프(↓·→)가 아니라 아이콘으로 둔다 — 글리프는 폰트마다
// 굵기·baseline이 달라 도식 안에서 혼자 손글씨처럼 보인다.
const Down = () => (
  <div className="grid h-4 shrink-0 place-items-center" aria-hidden>
    <ChevronDown size={13} strokeWidth={2.25} className="text-[#8996A3]" />
  </div>
);

// 레인 사이의 인계는 이 도식에서 가장 중요한 두 지점이다(승인 미션만 넘어간다 /
// 수행 기록만 넘어간다). 옅은 화살표 하나로는 그 관문이 보이지 않아, 레인 높이를
// 관통하는 세로선 위에 노란 토큰으로 얹는다.
// 라벨은 가로쓰기다. 세로쓰기(writing-mode)는 한글에서 글자마다 시선이 끊겨
// 읽기 어렵고 도식의 격을 떨어뜨린다 — 그래서 레인 사이 여백을 56px로 넓혀
// 네 글자 라벨이 한 줄로 들어가게 했다.
const Handoff = ({ label }: { label: string }) => (
  <div className="relative grid self-stretch content-center justify-items-center py-1 lg:py-0" aria-hidden>
    <span className="absolute inset-y-4 left-1/2 hidden w-px -translate-x-1/2 bg-[#E7E1CF] lg:block" />
    <span className="relative flex items-center gap-1 rounded-full border border-[#E3D08F] bg-[#FFF8E1] px-2.5 py-1 shadow-[0_2px_6px_-3px_rgba(21,32,43,.35)] lg:flex-col lg:gap-0.5 lg:px-[5px] lg:py-2">
      <ArrowRight size={14} strokeWidth={2.5} className="shrink-0 text-[#A9761A] lg:hidden" />
      <ChevronDown size={14} strokeWidth={2.5} className="hidden shrink-0 text-[#A9761A] lg:block" />
      <span className="whitespace-nowrap text-[10.5px] font-bold text-[#6B5518] lg:text-[9.5px]">{label}</span>
    </span>
  </div>
);

// ③에서 확인한 문제가 다음 ①·② 설계로 돌아가는 회귀 경로. 데스크톱에서는
// 오른쪽에서 출발해 아래를 감고 왼쪽 ①로 올라가는 U자형 화살표로 순환을 명시한다.
// 라벨에 「재승인」을 반드시 남긴다 — 수정한 콘텐츠가 교수자 최종 승인을 다시
// 받는다는 것이 이 환류가 자동 최적화가 아님을 말하는 지점이다(3.7절).
// 검토 주체는 3.7절 표현 그대로 「교수자·연구자」로 적는다. 「권한자」처럼 대장에
// 없는 조어를 만들지 않는다.
const CYCLE_LABEL = "문제 확인 → 교수자·연구자 검토 → 수정 → 재승인";

const CycleReturn = () => (
  <div
    className="relative mt-1 h-[40px]"
    aria-label="수업에서 확인한 문제는 권한을 가진 교수자·연구자의 검토를 거쳐 콘텐츠와 수업 설계를 수정하고 다시 최종 승인을 받는다"
  >
    <svg
      className="absolute inset-0 hidden h-full w-full overflow-visible lg:block"
      viewBox="0 0 1000 40"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <marker id="cycle-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="#A9761A" />
        </marker>
      </defs>
      <path
        d="M 965 1 V 8 C 965 20 954 24 932 24 H 68 C 46 24 35 20 35 8 V 1"
        fill="none"
        stroke="#A9761A"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        markerEnd="url(#cycle-arrowhead)"
      />
    </svg>
    <div className="absolute left-1/2 top-[10px] hidden -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#E3D08F] bg-[#FFF8E1] px-3 py-1 shadow-[0_2px_6px_-3px_rgba(21,32,43,.35)] lg:flex">
      <RotateCcw size={13} strokeWidth={2.5} className="text-[#A9761A]" aria-hidden />
      <span className="text-[10.5px] font-bold text-[#6B5518]">{CYCLE_LABEL}</span>
    </div>
    <div className="flex items-center justify-center gap-1.5 rounded-full border border-[#E3D08F] bg-[#FFF8E1] px-3 py-2 shadow-[0_2px_6px_-3px_rgba(21,32,43,.35)] lg:hidden">
      <RotateCcw size={14} strokeWidth={2.5} className="shrink-0 text-[#A9761A]" aria-hidden />
      <span className="break-keep text-center text-[11px] font-bold text-[#6B5518]">{CYCLE_LABEL}</span>
    </div>
  </div>
);

// 수행 기록의 연구 활용은 세 워크플로우와 나란한 네 번째 흐름이 아니다. 레인으로
// 세우면 학습 기록이 자동으로 연구 자료가 되는 것처럼 읽힌다 — 그래서 레인 밖
// 얇은 띠에 경계만 적는다. 적는 조건은 정본에 있는 세 가지뿐이다(1.4.3 · 3.1.4).
const ResearchBoundary = () => (
  <section className="mt-2.5 rounded-[11px] border border-dashed border-[#C9C2B2] bg-white/70 px-3.5 py-2.5">
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <h2 className="text-[12.5px] font-extrabold tracking-[-0.01em] text-[#15202B]">
        학습 수행 기록의 연구 활용
      </h2>
      <p className="break-keep text-[11px] leading-[1.45] text-muted-foreground">
        저장된 수행 기록은 <b className="font-semibold text-[#4A5A66]">자동으로 연구 자료가 되지 않습니다.</b>{" "}
        기관 연구윤리 절차 · 참여 동의 · 가명처리를 별도로 적용한 자료만 연구에 사용합니다.
      </p>
    </div>
  </section>
);

const Architecture = () => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 bg-[#15202B]">
      {/* 아래 도식과 같은 1024 격자를 쓴다 — 헤더만 1120이면 CTA가 3열 우측
          테두리보다 49px 바깥에 떠서 액자가 그림보다 커 보인다(실측). */}
      <div className="mx-auto flex max-w-[1024px] flex-wrap items-center justify-between gap-4 px-6 py-[11px]">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-[34px] w-[5px] rounded-sm bg-[#FAD338]" />
          <div>
            <h1 className="text-[16.5px] font-bold leading-tight tracking-tight text-white">
              PRAGMA · 통합 워크플로우
            </h1>
            {/* 관리자·심사 화면에서는 제품 설명어 대신 논문 가제를 그대로 쓴다. */}
            <p className="mt-0.5 text-[13px] text-[#95A2B0]">
              「AI 기반 한·중 통번역 학습 워크플로우 개발 연구」
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {IS_DEMO && (
            <Link
              to={REPRESENTATIVE_MISSION_PATH}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#FAD338] bg-[#FAD338] px-3 py-1.5 text-[12px] font-semibold text-[#15202B] transition-colors hover:bg-[#F5C400]"
            >
              <PlayCircle aria-hidden size={14} strokeWidth={2} />
              대표 미션 시연
            </Link>
          )}
          <Link
            to="/"
            className="rounded-lg border border-white/35 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-white/10"
          >
            ← 처음으로
          </Link>
        </div>
      </div>
    </header>

    {/* 뷰포트는 최소 높이만 정한다. 짧은 화면에서도 레인과 환류 경로가
        내용의 자연 높이 아래로 이어져 카드 밖 넘침과 화살표 겹침을 막는다. */}
    <div className="mx-auto max-w-[1024px] px-6 pb-5 pt-3 lg:flex lg:min-h-[calc(100dvh-66px)] lg:flex-col lg:pt-4">
      {/* 세 레인을 한 문장으로 — 강조한 세 마디가 그대로 ①②③ 제목이다.
          문장은 3.7절 첫 문단의 결론을 그대로 옮긴 것이다: 세 워크플로우를
          같은 콘텐츠 버전과 수행 기록으로 연결한 하나의 구조. */}
      <p className="mb-2 text-[14.5px] font-medium leading-relaxed text-[#4A5A66]">
        <Mark>콘텐츠 제작</Mark> · <Mark>학습자 수행</Mark> · <Mark>수업 운영</Mark>을 같은 콘텐츠 버전과
        수행 기록으로 연결합니다.
      </p>

      {/* 3레인. 중앙을 넓게 두는 비대칭은 유지한다 — ②가 핵심 개입이므로
          균등 폭이 오히려 부정확하다. 레인 사이 여백은 라벨 가로쓰기를 위해
          44 → 56px로 넓혔고, 그만큼을 좌우 레인에서 덜어냈다. */}
      <div className="grid grid-cols-1 items-start lg:flex-1 lg:grid-cols-[228px_56px_388px_56px_244px] lg:items-stretch">
        {/* ① 콘텐츠 제작 */}
        <section className="rounded-[13px] border border-border bg-card px-3.5 pb-4 pt-4 lg:flex lg:flex-col lg:justify-between">
          <LaneHeader
            lane="supply"
            num="1"
            title="콘텐츠 제작"
            desc="목표 화행·상황 조건에서 교수자 최종 승인까지"
          />

          <Node
            lane="supply"
            title="근거 자료·생성 계약 설정"
            desc="목표 화행과 상황 조건, 판단 기준을 계약으로 고정"
          />
          <Down />
          <Node lane="supply" title="시나리오·학습 미션 생성" desc="확정한 계약으로 콘텐츠 후보를 생성" />
          <Down />
          <Node
            lane="supply"
            title="자동 품질 점검"
            desc="필수 항목·허용값·구조를 규칙으로 검사 · 같은 입력과 규칙에 같은 결과"
          />
          <Down />
          <Node
            lane="supply"
            title="AI 검토"
            desc="복수 모델이 문제 가능성·근거·수정 제안을 제시 · 판정 권한 없음"
          />
          <Down />
          <Node
            lane="supply"
            title="교수자 최종 승인"
            desc="① 교수자 감수 → ② 수업 사용·공개 자격 최종 결정 · 이력 저장"
            decision
          />
        </section>

        <Handoff label="승인 미션" />

        {/* ② 학습자 수행 */}
        <section className="rounded-[13px] border border-[#D3D1C7] bg-card px-3.5 pb-4 pt-4 shadow-[0_8px_20px_-18px_rgba(21,32,43,.55)] lg:flex lg:flex-col lg:justify-between">
          <LaneHeader
            lane="learn"
            num="2"
            title="학습자 수행"
            desc="승인·편성된 미션에서 판단 · 산출 · 피드백 · 유지/수정을 연결"
          />

          <Node
            lane="learn"
            title="교과목 선택·주차 학습 진입"
            desc="수강 중인 교과목에서 이번 주차 미션으로 진입"
          />
          <Down />
          <Node lane="learn" title="주차 도입 활동" desc="장면 제시 → 차이 인식 → 원리 이해" />
          <Down />

          {/* 핵심 엔진. 네 칩이 이 연구의 핵심 기여다 — 화용적 판단을 직접 통번역
              산출과 연결하고, AI 피드백 뒤의 최종 결정을 학습자에게 남긴다.
              대외 용어는 MJT / DCT형 통번역 산출 과제다(용어대장 36·70행) —
              수식 없는 `DCT`로 이 과제를 지칭하지 않는다. */}
          <div className="rounded-[11px] border-[1.5px] border-[#FAD338] bg-[#FFFDF4] px-[11px] pb-[11px] pt-2.5">
            <span className="inline-block rounded-[5px] bg-[#FDF1C4] px-[7px] py-0.5 text-[10px] font-bold tracking-[0.07em] text-[#8A6D00]">
              한 미션의 흐름 · 매 미션 반복
            </span>
            {/* 네 단계는 세로 연쇄다. 가로 한 줄로는 들어가지 않는다 — 이 레인의
                안쪽 폭이 338px인데 네 칩과 연결자가 372px를 쓴다(2026-09-17 실측).
                줄여 쓴 약칭으로 맞추는 대신 정본 용어를 온전히 두고 방향을 돌렸다.
                도식의 다른 흐름도 모두 세로라 어법도 어긋나지 않는다. */}
            <div className="mt-2 grid gap-[3px]">
              {[
                `화용적 적절성 판단(MJT ${MPJ_ITEM_COUNT})`,
                "DCT형 통번역 산출",
                "AI 피드백 검토",
                "유지·수정 결정",
              ].map((step, i) => (
                <span key={step} className="contents">
                  {i > 0 && (
                    <ChevronDown size={11} strokeWidth={2.25} className="mx-auto shrink-0 text-[#D6B84A]" />
                  )}
                  <span className="flex items-center gap-1.5 rounded-md border border-[#EADFAF] bg-white px-2 py-[5px] text-[11px] font-semibold">
                    <span
                      aria-hidden
                      className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] bg-[#FDF1C4] text-[9px] font-bold text-[#8A6D00]"
                    >
                      {i + 1}
                    </span>
                    <span className="break-keep">{step}</span>
                  </span>
                </span>
              ))}
            </div>
            <p className="mt-2 break-keep text-[11px] leading-[1.4] text-muted-foreground">
              최초 산출에 대한 의미·언어·화용 피드백을 검토하고 최종 표현을 유지하거나 수정합니다.
            </p>
          </div>

          <Down />
          <Node
            lane="learn"
            title="수행 기록·이견 제기"
            desc="판단·선택·근거·최초안·최종 산출을 맥락·버전과 함께 저장 · 학습자가 이견을 남김"
            status="수업 운영"
          />
          <Down />
          <Node
            lane="learn"
            title="개인별 학습 기록·후속 수행"
            desc="주차·미션에 걸친 자기 기록 확인 · 같은 목표 화행의 다른 사건에서 다시 수행"
          />
        </section>

        <Handoff label="수행 기록" />

        {/* ③ 수업 운영 */}
        <section className="rounded-[13px] border border-border bg-card px-3.5 pb-4 pt-4 lg:flex lg:flex-col lg:justify-between">
          <LaneHeader
            lane="class"
            num="3"
            title="수업 운영"
            desc="교수자가 편성·자료·기록을 관리하고 후속 검토를 결정"
          />

          <Node
            lane="class"
            title="교과목·주차별 미션 편성"
            desc="승인된 미션을 수업 목표와 주차 조건에 맞게 배치"
          />
          <Down />
          <Node
            lane="class"
            title="수업 자료 제시 관리"
            desc="주차별 수업 자료·토론 자료와 교수자 진행 메모를 구분해 준비"
          />
          <Down />
          <Node
            lane="class"
            title="조건 대비와 수업 토론"
            desc="같은 목표 화행의 두 사건에서 조건과 표현 선택을 비교"
          />
          <Down />
          <Node
            lane="class"
            title="학급 응답·개인 수행 기록 확인"
            desc="익명 학급 집계와 개인 기록의 열람 범위를 구분"
          />
          <Down />
          <Node
            lane="class"
            title="후속 콘텐츠 검토"
            desc="수업에서 확인한 문제를 콘텐츠·편성·절차의 재검토로 연결"
            decision
          />
        </section>
      </div>

      <CycleReturn />
      <ResearchBoundary />
    </div>
  </div>
);

export default Architecture;
