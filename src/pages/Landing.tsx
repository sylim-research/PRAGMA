import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap, Network, Play, SlidersHorizontal } from "lucide-react";
import { HomeBrand } from "@/components/HomeBrand";
import { ensureSession } from "@/lib/tracking";
import { IS_DEMO } from "@/lib/auth/useProfile";
import { REPRESENTATIVE_MISSION_PATH } from "@/lib/demo/representativeMission";

// 화살표는 hover에서 진행 방향으로 살짝 미끄러진다. 카드가 통째로 떠오르는 동작은
// "이 카드가 반응한다"까지만 말하고, 화살표의 이동이 "누르면 저쪽으로 간다"를 말한다.
const arrow = "transition-transform duration-150 group-hover:translate-x-0.5";
// 보조 이동은 두 역할 카드보다 한 단계 아래로 읽혀야 한다 — 테두리를 카드와 같은
// 연한 선으로 낮추고, 굵기·글자색·그림자를 덜어 낸다. 크기와 배치는 그대로다.
const secondaryLink =
  "group inline-flex min-w-[178px] items-center justify-center gap-2 rounded-lg border border-[#DCD6C6] bg-white px-4 py-2 text-[13px] font-semibold text-[#3E4C57] transition-colors hover:border-[#C7BFA9] hover:bg-[#FBF9F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2";

const Landing = () => {
  useEffect(() => {
    ensureSession();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* 브랜드는 앱 전체와 같은 고정 헤더로만 세운다 — hero 중앙에 다시 두면 같은
          문구가 두 번 나오고, 랜딩만 헤더가 없어 다른 화면과 골격이 어긋난다. */}
      {/* 기준선은 워드마크의 **구분선**이다. 헤더를 본문과 같은 칼럼에 올린 뒤
          구분선까지의 거리(112px)만큼 왼쪽으로 당기면, 「|」가 카드·푸터의 좌측 선에
          정확히 서고 「PRAGMA」만 그 선 밖으로 돌출한다 — 정렬은 지키면서 워드마크만
          눈에 띄게 하는 방법이다.
          당기기는 lg 이상에서만 건다. 좁은 화면에서는 칼럼 여백이 112px보다 작아
          워드마크가 화면 밖으로 밀려난다. */}
      <header className="sticky top-0 z-40 bg-[#15202B]">
        <div className="mx-auto flex max-w-3xl items-center px-6 py-4">
          <span className="lg:-ml-[112px]">
            <HomeBrand />
          </span>
        </div>
      </header>

      {/* 랜딩은 '읽는 페이지'가 아니라 '갈라지는 문'이다 — 스크롤 없이 한 화면에
          후크 → 설명 → 흐름 → 두 갈래가 모두 들어와야 한다. */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-6 sm:py-8">
        <section className="text-center">
          {/* 후크 — 두 줄이 차례로 올라온 뒤 핵심어에 형광펜이 그어진다. 메시지
              ("같은 뜻인데 다르게 전해진다")를 활자로 시연하는 장치라 장식이 아니다.
              모션을 끈 환경에서는 최종 상태로 즉시 표시된다. */}
          <h1 className="text-[27px] font-bold leading-[1.35] tracking-tight text-[#15202B] sm:text-[33px] lg:text-[36px]">
            <span className="block animate-rise-in motion-reduce:animate-none">
              같은 뜻도,{" "}
              <span className="relative inline-block">
                <span
                  aria-hidden
                  className="absolute inset-x-[-3px] bottom-[3px] h-[32%] origin-left animate-marker-sweep rounded-[2px] bg-[#FAD338] [animation-delay:1200ms] motion-reduce:animate-none"
                />
                {/* 형광펜 위에 얹히도록 텍스트도 위치를 잡아 준다(-z-10은 페이지
                    배경 뒤로 숨어 버린다). */}
                <span className="relative">상황과 관계</span>
              </span>
              에 따라
            </span>
            <span className="block animate-rise-in [animation-delay:600ms] motion-reduce:animate-none">
              다르게 전해집니다.
            </span>
          </h1>

          {/* break-keep — 없으면 낱말 중간에서 줄이 끊긴다. */}
          <p className="mx-auto mt-4 max-w-[620px] break-keep text-[15.5px] leading-relaxed text-muted-foreground sm:text-[16.5px]">
            {/* 의미 단위 2행. 각 행이 max-w를 넘지 않아야 짧은 꼬리 줄이 생기지 않는다(2026-08-06 실측). */}
            <span className="block">
              PRAGMA는 한·중 통번역에서 원문의 의미는 유지하면서 상황과 관계에 맞게
            </span>
            <span className="block">
              판단·산출하고 피드백으로 다듬는 수업 연계형 AI 플랫폼입니다.
            </span>
          </p>
        </section>

        {/* 두 갈래 — 이 페이지의 유일한 주 행동. 「선택하세요」 안내문은 카드가 이미
            같은 말을 하므로 두지 않는다.
            두 영역은 주·부가 아니라 대등한 두 입구다. 그래서 테두리·그림자·크기는
            똑같이 두고, 왼쪽 띠와 버튼의 색으로만 갈라진다 — 학습자는 노랑, 교수자는
            남색. 카드를 통째로 칠하지 않는 것은 후크의 형광펜과 색이 부딪히기 때문이다. */}
        <section className="mt-5 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/student-login"
            className="group flex flex-col items-start rounded-xl border border-[#E6E1D2] border-l-[5px] border-l-[#FAD338] bg-white px-6 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#D5CEBB] hover:border-l-[#FAD338] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            {/* 이모지는 기기마다 다르게 그려지고 색이 튄다 — 앱이 이미 쓰는 lucide
                라인 아이콘으로 바꿔 글자와 같은 무게로 맞춘다. */}
            <span className="flex items-center gap-2 text-[19px] font-bold text-[#15202B]">
              <GraduationCap aria-hidden size={19} strokeWidth={1.75} className="text-[#3E4C57]" />
              학습자 영역
            </span>
            <span className="mt-2.5 break-keep text-[14px] leading-relaxed text-muted-foreground">
              표현을 비교해 판단하고 직접 번역·통역한 뒤, 피드백을 보고 다듬습니다.
              그 과정이 학습 기록에 쌓입니다.
            </span>
            {/* hover에서 어둡게 눌리면 '비활성'처럼 보인다 — 같은 색상을 한 단계
                밝혀서 떠오르는 쪽으로 반응하게 한다. */}
            <span className="mt-auto pt-4">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[#15202B] bg-[#FAD338] px-4 py-1.5 text-[14px] font-bold text-[#15202B] transition-colors group-hover:bg-[#FCE07A]">
                학습 시작하기
                <ArrowRight aria-hidden size={14} strokeWidth={2} className={arrow} />
              </span>
            </span>
          </Link>

          <Link
            to="/admin-login"
            className="group flex flex-col items-start rounded-xl border border-[#E6E1D2] border-l-[5px] border-l-[#3E4C57] bg-white px-6 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#D5CEBB] hover:border-l-[#3E4C57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 text-[19px] font-bold text-[#15202B]">
              <SlidersHorizontal aria-hidden size={19} strokeWidth={1.75} className="text-[#3E4C57]" />
              교수자 영역
            </span>
            <span className="mt-2.5 break-keep text-[14px] leading-relaxed text-muted-foreground">
              AI 학습 미션을 생성·검수해 15주 강좌로 편성하고,
              게시한 뒤 학습 수행 기록까지 관리합니다.
            </span>
            {/* 카드 제목이 이미 '교수자 영역'이라 버튼까지 같은 말이면 한 번 더 읽게 된다.
                버튼은 무엇을 하러 가는지만 말한다 — 학습 시작하기 / 수업 운영하기.
                채움색은 헤더의 #15202B보다 한 단계 연한 남색이다. 순검정-흰색 대비는
                노랑 버튼보다 훨씬 세서, 같은 크기여도 교수자 쪽이 앞으로 튀어나온다. */}
            <span className="mt-auto pt-4">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[#3E4C57] bg-[#3E4C57] px-4 py-1.5 text-[14px] font-bold text-white transition-colors group-hover:bg-[#4E5F6C]">
                수업 운영하기
                <ArrowRight aria-hidden size={14} strokeWidth={2} className={arrow} />
              </span>
            </span>
          </Link>
        </section>

        {/* 보조 이동. 설명(/architecture)과 실제 실행(/demo/mission)을 나란히 두되
            학습자·교수자 두 주 경로보다 작게 유지한다. 실증 시작 전에는 감춘다. */}
        {IS_DEMO && (
          <section className="mt-6 flex flex-wrap items-center justify-center gap-3" aria-label="구조·대표 미션 살펴보기">
            <Link
              to="/architecture"
              className={secondaryLink}
            >
              <Network aria-hidden size={17} strokeWidth={1.9} className="text-[#5C6A7A]" />
              통합 구조 보기
              <ArrowRight aria-hidden size={14} strokeWidth={2} className={`text-[#5C6A7A] ${arrow}`} />
            </Link>
            <Link
              to={REPRESENTATIVE_MISSION_PATH}
              className={secondaryLink}
            >
              <Play aria-hidden size={16} strokeWidth={1.6} className="fill-[#3E4C57] text-[#3E4C57]" />
              대표 미션 살펴보기
              <ArrowRight aria-hidden size={14} strokeWidth={2} className={`text-[#5C6A7A] ${arrow}`} />
            </Link>
          </section>
        )}
      </main>

      <footer className="mx-auto w-full max-w-3xl px-6 pb-6">
        <p className="break-keep border-t border-[#E6E1D2] pt-3 text-center text-[12.5px] leading-relaxed text-[#5C6A7A]">
          <strong className="font-semibold text-[#3E4C57]">PRAGMA · AI 기반 한·중 통번역 학습</strong>
          {" | "}
          <span className="inline-block">한국외국어대학교 중어중문학과 · 임소영</span>
          {" | "}
          <span className="inline-block text-[11px] text-[#6B7280]">© 2026 임소영. All rights reserved.</span>
        </p>
      </footer>
    </div>
  );
};

export default Landing;
