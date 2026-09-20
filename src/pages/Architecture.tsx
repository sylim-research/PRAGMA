import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, PlayCircle, RotateCcw } from "lucide-react";
import { MPJ_ITEM_COUNT } from "@/lib/curriculum/learnerWorkflow";
import { IS_DEMO } from "@/lib/auth/useProfile";
import { REPRESENTATIVE_MISSION_PATH } from "@/lib/demo/representativeMission";

// 심사 설명용 read-only 화면. 온라인 시연에서 한 화면으로 보여 주는 그림이다.
//
// 세 레인은 3.7절이 확정한 세 워크플로우 그대로다 — 콘텐츠 제작 / 학습자 수행 / 수업 운영.
// 카드는 관리자 앱의 실제 메뉴(생성 기준 → 미션 재료 → 제작·품질 관리 → 수업 운영)와
// 학습자 화면의 실제 단계를 그대로 옮긴 것이며, 3.5·3.6의 항과 1:1로 대응한다.
//
// 높이 예산: 헤더 66 + 전체가 ≤ 700px. 시연 화면은 Windows 125% 배율의 1600×830이고
// 노트북 공유는 더 낮다. 카드 설명은 문장이 아니라 「·」로 이은 명사 한 줄로만 쓴다 —
// 한 줄이 곧 그 화면이 실제로 하는 일의 목록이다.
//
// 「검증」·「감수·승인」 세트명·수량 목표는 쓰지 않는다(용어대장 187·188행). AI 검토의
// 모델 이름은 고정 역할로 적지 않는다(그림표 대장 42행) — 층위(1차·독립 교차·재검토)만 적는다.

type Lane = "supply" | "learn" | "class";

const LANE = {
  supply: { num: "bg-[#3A4A5F]", node: "bg-[#EDF0F4] border-[#DCE1E9]" },
  learn: { num: "bg-[#2F6660]", node: "bg-[#E9F1EF] border-[#CFE0DC]" },
  class: { num: "bg-[#8A6A55]", node: "bg-[#F4EDE7] border-[#E3D5C8]" },
} as const;

// 배지 규칙 — 화면 전체에서 이 두 가지만 쓴다. 나머지(배지 없음)는 구현 완료다.
//   초록 실선 = 수업에서 실제로 하고 있다
//   회색 점선 = 아직 하지 않았다 → 라벨은 「준비 중」 하나로 통일한다
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
    className={`rounded-[9px] border px-3 py-2 ${
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
  <div className="mb-2.5">
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
  <div className="grid h-[14px] shrink-0 place-items-center" aria-hidden>
    <ChevronDown size={13} strokeWidth={2.25} className="text-[#8996A3]" />
  </div>
);

// 레인 안의 묶음 상자 — ①의 품질 관문과 ②의 미션 흐름. 같은 골격(라벨 칩 + 번호 붙은
// 세로 단계)으로 만들어 두 레인의 핵심이 서로 대칭으로 읽히게 한다. ①은 남색, ②는 노랑.
const Chain = ({
  tone,
  label,
  steps,
}: {
  tone: "gate" | "core";
  label: string;
  steps: { title: string; detail?: string }[];
}) => {
  const t =
    tone === "gate"
      ? { box: "border-[#3A4A5F] bg-[#F7F8FA]", chip: "bg-[#E1E6EC] text-[#2B3A4A]", num: "bg-[#3A4A5F] text-white", link: "text-[#9AA6B3]" }
      : { box: "border-[#FAD338] bg-[#FFFDF4]", chip: "bg-[#FDF1C4] text-[#8A6D00]", num: "bg-[#FDF1C4] text-[#8A6D00]", link: "text-[#D6B84A]" };
  return (
    <div className={`rounded-[11px] border-[1.5px] px-[10px] pb-[10px] pt-2 ${t.box}`}>
      <span className={`inline-block rounded-[5px] px-[7px] py-0.5 text-[10px] font-bold tracking-[0.07em] ${t.chip}`}>
        {label}
      </span>
      <div className="mt-1.5 grid gap-[2px]">
        {steps.map((step, i) => (
          <span key={step.title} className="contents">
            {i > 0 && <ChevronDown size={11} strokeWidth={2.25} className={`mx-auto shrink-0 ${t.link}`} />}
            <span className="flex items-start gap-1.5 rounded-md border border-[#E5E1D4] bg-white px-2 py-[5px]">
              <span
                aria-hidden
                className={`mt-[1px] grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] text-[9px] font-bold ${t.num}`}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block break-keep text-[11.5px] font-semibold leading-[1.3] text-[#15202B]">{step.title}</span>
                {step.detail && (
                  <span className="block break-keep text-[10.5px] leading-[1.35] text-muted-foreground">{step.detail}</span>
                )}
              </span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

// 레인 사이의 인계는 이 도식에서 가장 중요한 두 지점이다(승인 미션만 넘어간다 /
// 수행 기록만 넘어간다). 레인 높이를 관통하는 세로선 위에 노란 토큰으로 얹는다.
// 데스크톱은 레인이 나란히 서므로 화살표가 오른쪽을 가리켜야 한다. 좁은 화면에서는
// 레인이 위아래로 쌓이므로 아래를 가리킨다. 라벨은 항상 가로쓰기다.
const Handoff = ({ label }: { label: string }) => (
  <div className="relative grid self-stretch content-center justify-items-center py-1 lg:py-0" aria-hidden>
    <span className="absolute inset-y-4 left-1/2 hidden w-px -translate-x-1/2 bg-[#E7E1CF] lg:block" />
    <span className="relative flex items-center gap-1 rounded-full border border-[#E3D08F] bg-[#FFF8E1] px-2.5 py-1 shadow-[0_2px_6px_-3px_rgba(21,32,43,.35)] lg:flex-col lg:gap-0.5 lg:px-[5px] lg:py-2">
      <ChevronDown size={14} strokeWidth={2.5} className="shrink-0 text-[#A9761A] lg:hidden" />
      <ArrowRight size={15} strokeWidth={2.5} className="hidden shrink-0 text-[#A9761A] lg:block" />
      <span className="whitespace-nowrap text-[10.5px] font-bold text-[#6B5518] lg:text-[9.5px]">{label}</span>
    </span>
  </div>
);

// ③에서 확인한 문제가 다음 ①·② 설계로 돌아가는 회귀 경로. 데스크톱에서는
// 오른쪽에서 출발해 아래를 감고 왼쪽 ①로 올라가는 U자형 화살표로 순환을 명시한다.
// 「재승인」을 반드시 남긴다 — 수정한 콘텐츠가 교수자 최종 승인을 다시 받는다는 것이
// 이 환류가 자동 최적화가 아님을 말하는 지점이다(3.7절).
// 🔴 2026-09-20 연구자 지시로 「문제 확인」을 빼고 검토 주체를 「교수자」로 통일했다.
// 3.7절은 「교수자·연구자」로 적혀 있으므로 원고 쪽 표현을 이 화면에 맞춰야 한다.
const CYCLE_LABEL = "교수자 검토 → 수정 → 재승인";

const CycleReturn = () => (
  <div
    className="relative mt-1 h-[38px]"
    aria-label="수업에서 확인한 문제는 교수자의 검토를 거쳐 콘텐츠와 수업 설계를 수정하고 다시 최종 승인을 받는다"
  >
    <svg
      className="absolute inset-0 hidden h-full w-full overflow-visible lg:block"
      viewBox="0 0 1000 38"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <marker id="cycle-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="#A9761A" />
        </marker>
      </defs>
      <path
        d="M 965 1 V 8 C 965 19 954 23 932 23 H 68 C 46 23 35 19 35 8 V 1"
        fill="none"
        stroke="#A9761A"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        markerEnd="url(#cycle-arrowhead)"
      />
    </svg>
    <div className="absolute left-1/2 top-[9px] hidden -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#E3D08F] bg-[#FFF8E1] px-3 py-1 shadow-[0_2px_6px_-3px_rgba(21,32,43,.35)] lg:flex">
      <RotateCcw size={13} strokeWidth={2.5} className="text-[#A9761A]" aria-hidden />
      <span className="text-[10.5px] font-bold text-[#6B5518]">{CYCLE_LABEL}</span>
    </div>
    <div className="flex items-center justify-center gap-1.5 rounded-full border border-[#E3D08F] bg-[#FFF8E1] px-3 py-2 shadow-[0_2px_6px_-3px_rgba(21,32,43,.35)] lg:hidden">
      <RotateCcw size={14} strokeWidth={2.5} className="shrink-0 text-[#A9761A]" aria-hidden />
      <span className="break-keep text-center text-[11px] font-bold text-[#6B5518]">{CYCLE_LABEL}</span>
    </div>
  </div>
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

    {/* 높이는 내용의 자연 높이만 쓴다. 시연 뷰포트(≈830px)보다 짧아야 하므로
        뷰포트를 채우려고 늘리지 않는다 — 늘리면 짧은 화면에서 넘친다.
        실측: 헤더 포함 743px. 1600×830에는 들어가고, 1366×640 노트북 공유에서는
        103px 넘친다. 그 경우에만 도식 전체를 84%로 줄여 한 화면을 지킨다 — 카드를
        더 깎아 맞추면 정상 화면에서 필요 없이 작아진다. */}
    <div className="mx-auto max-w-[1024px] px-6 pb-4 pt-3 lg:[@media(max-height:720px)]:[zoom:.84]">
      {/* 세 레인을 한 문장으로 — 강조한 세 마디가 그대로 ①②③ 제목이다(3.7절 첫 문단). */}
      <p className="mb-2 text-[14px] font-medium leading-relaxed text-[#4A5A66]">
        <Mark>콘텐츠 제작</Mark> · <Mark>학습자 수행</Mark> · <Mark>수업 운영</Mark>을 같은 콘텐츠 버전과
        수행 기록으로 연결합니다.
      </p>

      {/* 3레인. 양옆은 272px 대칭, 중앙 320px — 중앙 폭은 그 안의 가장 긴 한 줄 설명
          (226px)이 한 줄로 들어가는 최소값이다(2026-09-17 실측). 그 이상은 빈 여백이다.
          레인 사이 여백 56px는 인계 라벨을 가로로 쓰기 위한 것이다.
          카드 설명은 한 줄이 원칙이다 — 두 줄이 되면 두 줄을 꽉 채우고, 애매하게
          넘치는 두 줄은 만들지 않는다. */}
      <div className="grid grid-cols-1 items-start lg:grid-cols-[272px_56px_320px_56px_272px] lg:items-stretch">
        {/* ① 콘텐츠 제작 — 관리자 메뉴 1·2·3(생성 기준 → 미션 재료 → 제작·품질 관리) */}
        <section className="rounded-[13px] border border-border bg-card px-3.5 pb-3.5 pt-3.5 lg:flex lg:flex-col lg:justify-between">
          <LaneHeader
            lane="supply"
            num="1"
            title="콘텐츠 제작"
            desc="기준 고정 → 조건 생성 → 관문 통과분만 인계"
          />

          <Node
            lane="supply"
            title="생성 기준"
            desc="생성 계약 · 프롬프트 · HSK 3.0 어휘 · 실제 자료"
          />
          <Down />
          <Node
            lane="supply"
            title="조건 설계 생성"
            desc="화행 × P·D·R × 도메인 · 개별/배치 · 분포 계획"
          />
          <Down />
          <Node
            lane="supply"
            title="학습 미션 조립"
            desc={`MJT ${MPJ_ITEM_COUNT} + DCT형 통번역 산출 1 · 라이브러리`}
          />
          <Down />
          <Chain
            tone="gate"
            label="품질 관문 · 승인분만 통과"
            steps={[
              { title: "자동 품질 점검", detail: "규칙 기반 · 같은 입력에 같은 결과" },
              { title: "AI 검토", detail: "1차 검토 · 필요할 때 교차 검토 · 판정 권한 없음" },
              { title: "교수자 최종 승인", detail: "감수 → 수업 사용·공개 자격 결정" },
            ]}
          />
        </section>

        <Handoff label="승인 미션" />

        {/* ② 학습자 수행 — 3.5.1 ~ 3.5.5 */}
        <section className="rounded-[13px] border border-[#D3D1C7] bg-card px-3.5 pb-3.5 pt-3.5 shadow-[0_8px_20px_-18px_rgba(21,32,43,.55)] lg:flex lg:flex-col lg:justify-between">
          <LaneHeader
            lane="learn"
            num="2"
            title="학습자 수행"
            desc="판단 → 산출 → 피드백 · 최종 결정은 학습자"
          />

          <Node lane="learn" title="교과목 선택 · 주차 학습 진입" desc="이번 주차 미션 · 학습 자료 · 진행 상태" />
          <Down />
          <Node lane="learn" title="미션 도입 안내" desc="장면 · 관계 · 오늘 볼 것 확인" />
          <Down />
          <Chain
            tone="core"
            label="한 미션의 흐름 · 매 미션 반복"
            steps={[
              { title: `화용적 적절성 판단 (MJT ${MPJ_ITEM_COUNT})`, detail: "상황 판단 · 이유 고르기 · 고친 표현 고르기 · 직접 고치기 · 여러 표현 비교" },
              { title: "DCT형 통번역 산출", detail: "번역 · 통역(음성 STT/TTS) · 한→중 / 중→한" },
              { title: "AI 피드백 검토", detail: "의미 · 언어 · 화용 3층 피드백 · 유지/수정은 학습자 결정" },
            ]}
          />
          <Down />
          <Node
            lane="learn"
            title="수행 기록 · 이견 제기"
            desc="판단 · 근거 · 최초안 · 최종 산출을 버전과 저장 · 이견 제기"
            status="수업 운영"
          />
          <Down />
          <Node lane="learn" title="개인별 학습 기록 · 후속 수행" desc="주차·미션별 자기 기록 · 같은 화행의 다른 사건 재수행" />
        </section>

        <Handoff label="수행 기록" />

        {/* ③ 수업 운영 — 관리자 메뉴 4·5 (3.6.1 · 3.6.3 · 3.6.4) */}
        <section className="rounded-[13px] border border-border bg-card px-3.5 pb-3.5 pt-3.5 lg:flex lg:flex-col lg:justify-between">
          <LaneHeader
            lane="class"
            num="3"
            title="수업 운영"
            desc="편성 · 자료 · 기록 관리 → 후속 검토 결정"
          />

          <Node
            lane="class"
            title="15주 편성 · 강의계획서"
            desc="교과목 · 주차 주제 · 승인 미션 배치 · 자동 채우기"
          />
          <Down />
          {/* 「조건 대비」(미션 1 vs 미션 2)는 폐기한 개념이다(연구자 결정 2026-09-17) —
              한 주차 두 미션이지만 조건은 이미 미션 하나 안에 들어 있다. 학급 응답은
              화면만 있고 아직 자료가 쌓이지 않았으므로 점선 배지로 둔다. */}
          <Node
            lane="class"
            title="학습 수행 기록"
            desc="개별 수행 기록 · 학급 응답 분포(익명 집계 · 이견 건수)"
            status="분포 준비 중"
          />
          <Down />
          <Node
            lane="class"
            title="학습자 관리 · 수업 데이터"
            desc="계정 · 학습한 교과목 · 최근 활동 · 백업·복원"
          />
          <Down />
          <Node
            lane="class"
            title="연구 데이터 내보내기"
            desc="동의한 학습자만 · 비식별 · 분석용 내보내기"
          />
          <Down />
          <Node
            lane="class"
            title="후속 콘텐츠 검토"
            desc="확인한 문제 → 콘텐츠 · 편성 · 절차 재검토"
            decision
          />
        </section>
      </div>

      <CycleReturn />
    </div>
  </div>
);

export default Architecture;
