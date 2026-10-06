import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Network, Play, SlidersHorizontal } from "lucide-react";
import { HomeBrand } from "@/components/HomeBrand";
import { ensureSession } from "@/lib/tracking";
import { IS_DEMO } from "@/lib/auth/useProfile";
import { REPRESENTATIVE_MISSION_PATH } from "@/lib/demo/representativeMission";

// 진입 링크에 마우스를 올리면 화살표가 진행 방향으로 살짝 이동한다.
const arrow = "transition-transform duration-150 group-hover:translate-x-0.5";
// 보조 이동은 두 역할 카드보다 한 단계 아래로 읽혀야 한다 — 테두리를 카드와 같은
// 선을 한 단계 낮추고 글자색을 눌러 두되, 옅은 그림자와 반각 큰 글자는 남긴다 —
// 카드 CTA보다 아래로 읽히면서도 버튼으로서의 존재감은 잃지 않는 중간 강도다.
const secondaryLink =
  "group inline-flex min-w-[163px] items-center justify-center gap-1.5 rounded-full border border-[#D6CFBD] bg-white/70 px-4 py-[9px] text-[13.5px] font-semibold text-[#15202B] transition-colors hover:border-[#A9A08A] hover:bg-[#FBF9F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2";

const Landing = () => {
  useEffect(() => {
    ensureSession();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* 브랜드는 앱 전체와 같은 고정 헤더로만 세운다 — hero 중앙에 다시 두면 같은
          문구가 두 번 나오고, 랜딩만 헤더가 없어 다른 화면과 골격이 어긋난다. */}
      {/* 헤더는 본문과 같은 칼럼을 쓴다 — 워드마크 왼쪽 끝이 카드·푸터의 왼쪽 선과 맞는다(2026-09-19 전 화면 기준). */}
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-[804px] items-center px-6 py-4">
          <HomeBrand largerText />
        </div>
      </header>

      {/* 랜딩은 '읽는 페이지'가 아니라 '갈라지는 문'이다 — 스크롤 없이 한 화면에
          후크 → 설명 → 흐름 → 두 갈래가 모두 들어와야 한다. */}
      <main className="mx-auto flex w-full max-w-[804px] flex-1 flex-col items-center justify-center px-6 py-6 sm:pb-6 sm:pt-[clamp(8px,calc(100vh_-_643px),72px)]">
        <section className="text-center">
          {/* 후크 — 문구는 즉시 표시하고 핵심어에만 형광펜이 그어진다. 메시지
              ("같은 뜻인데 다르게 표현한다")를 활자로 시연하는 장치라 장식이 아니다.
              모션을 끈 환경에서는 최종 상태로 즉시 표시된다. */}
          <h1 className="relative top-[4px] text-[27.667px] font-bold leading-[1.35] tracking-tight text-[#15202B] sm:text-[33.667px] lg:text-[36.667px]">
            <span className="block">
              같은 뜻도,{" "}
              <span className="relative inline-block">
                <span
                  aria-hidden
                  className="absolute inset-x-[-3px] bottom-[3px] h-[32%] origin-left animate-marker-sweep rounded-[2px] bg-[#FAD338] [animation-delay:200ms] motion-reduce:animate-none"
                />
                {/* 형광펜 위에 얹히도록 텍스트도 위치를 잡아 준다(-z-10은 페이지
                    배경 뒤로 숨어 버린다). */}
                <span className="relative">상황과 관계</span>
              </span>
              에 따라
            </span>
            <span className="block">
              다르게 표현합니다.
            </span>
          </h1>

          {/* break-keep — 없으면 낱말 중간에서 줄이 끊긴다.
              글자색은 muted-foreground(#5C6A7A, 배경 #FAF7F0 대비 5.1:1)에서 같은 남색
              계열 한 단계 위(#4E5F6C, 6.3:1)로 올린다 — 논문 도판으로 축소·인쇄될 때
              본문이 흐려지지 않게 하려는 것이다. 글자 크기에 맞춰 문단 폭도 확보한다. */}
          <p className="mx-auto mt-4 max-w-[620px] break-keep text-[15.333px] leading-relaxed text-[#4E5F6C] sm:text-[16.333px]">
            {/* 데스크톱에서는 의미 단위 두 행을 유지하고, 좁은 화면에서는 자연스럽게 줄바꿈한다. */}
            <span className="block">
              PRAGMA는 한·중 통번역에서 원문의 의미와 화행목적을 유지하면서,
            </span>
            <span className="block">
              상황·관계에 맞는 표현을 판단하고 직접 통번역하는 학습 플랫폼입니다.
            </span>
          </p>
        </section>

        {/* 두 갈래 — 이 페이지의 유일한 주 행동. 「선택하세요」 안내문은 카드가 이미
            같은 말을 하므로 두지 않는다.
            두 영역은 주·부가 아니라 대등한 두 입구다. 그래서 테두리·그림자·크기는
            똑같이 두고, 왼쪽 띠와 버튼의 색으로만 갈라진다 — 학습자는 노랑, 교수자는
            남색. 카드를 통째로 칠하지 않는 것은 후크의 형광펜과 색이 부딪히기 때문이다. */}
        {/* 헤더·본문·푸터는 같은 804px 칼럼을 사용한다. */}
        <section className="mx-auto mt-[30px] grid w-full max-w-[744px] grid-cols-1 gap-5 sm:grid-cols-2">
          <article
            className="flex flex-col items-start rounded-2xl border border-[#E6E1D2] border-l-[5px] border-l-[#FAD338] bg-white px-6 py-5 text-left shadow-[0_1px_2px_rgba(21,32,43,0.04),0_10px_28px_-16px_rgba(21,32,43,0.18)]"
          >
            {/* 이모지는 기기마다 다르게 그려지고 색이 튄다 — 앱이 이미 쓰는 lucide
                라인 아이콘으로 바꿔 글자와 같은 무게로 맞춘다. */}
            <span className="flex items-center gap-2.5 text-[19.167px] font-bold tracking-[-0.01em] text-[#15202B]">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-[#FDF3C4]">
                <GraduationCap size={18} strokeWidth={1.75} className="text-[#7A6418]" />
              </span>
              학습자 영역
            </span>
            <span className="mt-2.5 break-keep text-[13.833px] leading-relaxed tracking-[-0.01em] text-[#56636D] lg:whitespace-nowrap">
              상황과 관계에 맞는 표현을 판단하고 직접 통번역합니다.<br />
              AI 피드백을 참고해 표현을 검토한 뒤, 확정안을 결정합니다.
            </span>
            {/* hover에서 어둡게 눌리면 '비활성'처럼 보인다 — 같은 색상을 한 단계
                밝혀서 떠오르는 쪽으로 반응하게 한다. */}
            <span className="mt-auto pt-3.5">
              <Link to="/student-login" className="group inline-flex min-w-[148px] items-center justify-center gap-1.5 rounded-lg border border-[#15202B] bg-[#FAD338] px-5 py-2.5 text-[13.833px] font-bold text-[#15202B] transition-colors hover:bg-[#FCE07A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2">
                학습 시작하기
                <ArrowRight aria-hidden size={14} strokeWidth={2} className={arrow} />
              </Link>
            </span>
          </article>

          <article
            className="flex flex-col items-start rounded-2xl border border-[#E6E1D2] border-l-[5px] border-l-[#3E4C57] bg-white px-6 py-5 text-left shadow-[0_1px_2px_rgba(21,32,43,0.04),0_10px_28px_-16px_rgba(21,32,43,0.18)]"
          >
            <span className="flex items-center gap-2.5 text-[19.167px] font-bold tracking-[-0.01em] text-[#15202B]">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-[#EDF0F2]">
                <SlidersHorizontal size={18} strokeWidth={1.75} className="text-[#3E4C57]" />
              </span>
              교수자 영역
            </span>
            <span className="mt-2.5 break-keep text-[13.833px] leading-relaxed tracking-[-0.01em] text-[#56636D] lg:whitespace-nowrap">
              AI 콘텐츠를 생성하고, 자동 품질 점검과 AI 검토를 거칩니다.<br />
              교수자가 감수하고 최종 승인한 콘텐츠를 수업에 활용합니다.
            </span>
            {/* 카드 제목이 이미 '교수자 영역'이라 버튼까지 같은 말이면 한 번 더 읽게 된다.
                버튼은 무엇을 하러 가는지만 말한다 — 학습 시작하기 / 제작·승인하기.
                채움색은 헤더의 #15202B보다 한 단계 연한 남색이다. 순검정-흰색 대비는
                노랑 버튼보다 훨씬 세서, 같은 크기여도 교수자 쪽이 앞으로 튀어나온다. */}
            <span className="mt-auto pt-3.5">
              <Link to="/admin-login" className="group inline-flex min-w-[148px] items-center justify-center gap-1.5 rounded-lg border border-[#15202B] bg-[#15202B] px-5 py-2.5 text-[13.833px] font-bold text-white transition-colors hover:bg-[#2A3B48] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2">
                제작·승인하기
                <ArrowRight aria-hidden size={14} strokeWidth={2} className={arrow} />
              </Link>
            </span>
          </article>
        </section>

        {/* 보조 이동. 설명(/architecture)과 실제 실행(/demo/mission)을 나란히 두되
            학습자·교수자 두 주 경로보다 작게 유지한다. 실증 시작 전에는 감춘다. */}
        {IS_DEMO && (
          <section className="mt-[28px] flex flex-wrap items-center justify-center gap-3" aria-label="구조·대표 미션 살펴보기">
            <Link
              to={REPRESENTATIVE_MISSION_PATH}
              className={secondaryLink}
            >
              <Play aria-hidden size={16} strokeWidth={1.6} className="fill-[#3E4C57] text-[#3E4C57]" />
              학습 데모 보기
              <ArrowRight aria-hidden size={14} strokeWidth={2} className={`text-[#5C6A7A] ${arrow}`} />
            </Link>
            <Link
              to="/architecture"
              className={secondaryLink}
            >
              <Network aria-hidden size={17} strokeWidth={1.9} className="text-[#5C6A7A]" />
              전체 구조 보기
              <ArrowRight aria-hidden size={14} strokeWidth={2} className={`text-[#5C6A7A] ${arrow}`} />
            </Link>
          </section>
        )}
      </main>

      <footer className="mx-auto w-full max-w-[804px] px-6 pb-6">
        <p className="break-keep border-t border-[#E6E1D2] pt-3 text-center text-[12.833px] leading-relaxed text-[#5C6A7A]">
          한국외국어대학교 중어중문학과 · © 2026 임소영. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Landing;
