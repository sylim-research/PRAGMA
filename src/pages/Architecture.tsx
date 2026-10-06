import { Link } from "react-router-dom";
import { ArrowRight, RotateCcw } from "lucide-react";
import { HomeBrand } from "@/components/HomeBrand";
import { IS_DEMO } from "@/lib/auth/useProfile";
import { REPRESENTATIVE_MISSION_PATH } from "@/lib/demo/representativeMission";

// 심사 설명용 read-only 화면. README의 Fig. 1(docs/figures/fig1-pragma-workflow.png)과
// 같은 구조·같은 용어로 그린다 — GitHub·웹·논문이 하나의 그림을 공유한다.
// 단계는 번호 원과 세로선 하나로만 잇는다 — 테두리 상자를 쓰지 않아 선이 적고, 칸 안의 모든 단계가 같은 무게다.

type Step = readonly [title: string, desc?: string];

const Steps = ({ steps, dot }: { steps: readonly Step[]; dot: string }) => (
  <ol>
    {steps.map(([title, desc], index) => (
      <li key={title} className="relative flex gap-4 pb-5 last:pb-0">
        {index < steps.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-[2px] bg-[#C9D0DA]" />}
        <span aria-hidden className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-black ${dot}`}>{index + 1}</span>
        <div className="pt-[3px]">
          <p className="break-keep text-[15.5px] font-bold leading-snug text-[#15202B]">{title}</p>
          {desc && <p className="mt-0.5 whitespace-nowrap text-[13.5px] leading-snug text-[#4E5F6C]">{desc}</p>}
        </div>
      </li>
    ))}
  </ol>
);

// 칸 머리는 README Fig. 1처럼 연한 바탕 + 위쪽 진한 띠로 그 워크플로우의 색을 보인다.
// 두 워크플로우(제작·학습)가 주인공이라 머리를 한 단계 진하고 크게, 수업 운영은 연결 기능이라 그대로 둔다.
const Lane = ({ title, head, hero = false, children }: { title: string; head: string; hero?: boolean; children: React.ReactNode }) => (
  <section className={`flex flex-col overflow-hidden rounded-2xl border bg-white ${hero ? "border-[#D3D9E2] shadow-[0_8px_24px_-18px_rgba(21,32,43,0.45)]" : "border-[#E1E5EB]"}`}>
    <h2 className={`border-b border-b-[#E1E5EB] text-center font-black text-[#15202B] ${hero ? "border-t-[7px] py-[18px] text-[19px]" : "border-t-[5px] py-4 text-[17.5px]"} ${head}`}>{title}</h2>
    <div className="flex-1 px-6 pb-7 pt-6">{children}</div>
  </section>
);

const Connector = ({ label }: { label: string }) => (
  <div className="flex items-center justify-center py-1 lg:flex-col lg:py-0" aria-hidden>
    <span className="whitespace-pre-line text-center text-[13.5px] font-bold leading-snug text-[#15202B] lg:mb-2">{label}</span>
    <ArrowRight size={30} strokeWidth={2.4} className="ml-2 rotate-90 text-[#15202B] lg:ml-0 lg:rotate-0" />
  </div>
);

const CONTENT_STEPS: readonly Step[] = [
  ["시나리오·학습 미션 생성", "화행 × P·D·R × 도메인"],
  ["자동 품질 점검", "규칙 기반 · 형식·정합성 확인"],
  ["AI 교차 검토", "1차 · 독립 교차 · 재검토"],
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
  ["MJT 판단 문항", "판단·이유·비교·수정 5문항"],
  ["DCT형 통번역 과제", "번역·통역 · 한→중 / 중→한"],
  ["AI 피드백", "의미·문법·화용 기준"],
  ["학습자의 재검토", "유지 또는 수정은 학습자가 결정"],
  ["학습자 최종 결정", "학습 기록 저장"],
];

const TRACE = ["학습 수행 기록", "AI 검토 의견", "운영 프롬프트 지문", "교수자 승인 이력"];

const Architecture = () => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <header className="sticky top-0 z-40 bg-[#15202B]">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-[11px]">
        {/* 다른 화면과 같은 브랜드 헤더 — 화면 이름은 아래 Fig. 1 제목이 맡는다. */}
        <HomeBrand largerText />
        <div className="flex items-center gap-2">
          {IS_DEMO && (
            <Link to={REPRESENTATIVE_MISSION_PATH}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/35 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/10">
              학습 미션 체험
            </Link>
          )}
          <Link to="/" className="rounded-lg border border-[#FAD338] bg-[#FAD338] px-3 py-1.5 text-[12.5px] font-semibold text-[#15202B]">
            ← 처음으로
          </Link>
        </div>
      </div>
    </header>

    <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col justify-center px-6 py-6">
      <h1 className="mb-6 flex items-center gap-3 text-[15.5px] font-bold text-[#15202B]">
        <span className="tracking-[0.12em] text-[#5C6A7A]">Fig. 1</span>
        PRAGMA 워크플로우
        <span aria-hidden className="h-px flex-1 bg-[#D9DEE6]" />
      </h1>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_80px_1fr_80px_1fr] lg:gap-0">
        <Lane hero title="콘텐츠 제작 워크플로우" head="border-t-[#1F2A44] bg-[#DCE3EE]">
          <Steps steps={CONTENT_STEPS} dot="bg-[#1F2A44] text-white" />
        </Lane>

        <Connector label={"승인 후\n편성"} />

        <Lane title="수업 운영" head="border-t-[#9AA6B8] bg-[#F1F3F6]">
          <Steps steps={CLASS_STEPS} dot="bg-[#5F6F82] text-white" />
        </Lane>

        <Connector label={"학습자에게\n공개"} />

        <Lane hero title="통번역 학습 워크플로우" head="border-t-[#F2C94C] bg-[#F9E7A8]">
          <Steps steps={LEARNING_STEPS} dot="bg-[#F2C94C] text-[#15202B]" />
        </Lane>
      </div>

      <div className="mt-7 flex flex-col gap-3 border-t border-[#E1E5EB] px-1 pt-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="flex items-center gap-2 text-[14px] text-[#4E5F6C]">
          <RotateCcw aria-hidden size={16} strokeWidth={2} className="shrink-0 text-[#5C6A7A]" />
          제작 → 운영 → 학습, 학습자 의견은 콘텐츠 재검토로
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[14px] font-black text-[#15202B]">추적 기록</span>
          {TRACE.map(item => (
            <span key={item} className="rounded-md bg-[#EEF1F5] px-2.5 py-1 text-[13.5px] font-semibold text-[#15202B]">{item}</span>
          ))}
        </div>
      </div>
    </main>
  </div>
);

export default Architecture;
