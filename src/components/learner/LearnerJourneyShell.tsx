import type { ReactNode } from "react";
import { HomeBrand } from "@/components/HomeBrand";
import { LearnerBottomNav, LearnerTopNav } from "@/components/learner/LearnerBottomNav";

interface LearnerJourneyShellProps {
  children: ReactNode;
  /** 헤더 우측 슬롯 (모드 전환 등). 학습자 UI에 노출되는 요소만 넣을 것. */
  headerRight?: ReactNode;
  /** 세 열 리포트처럼 넓은 읽기 폭이 필요한 화면에만 사용한다. */
  wide?: boolean;
  /** 데스크톱 미션 화면에서 세로 단계표와 본문을 아우르는 축에 헤더를 맞춘다. */
  missionLayout?: boolean;
  /** 학습자 최상위 화면(수업·기록)의 두 탭. PC는 헤더 안, 모바일은 화면 아래에 둔다. */
  nav?: boolean;
  /**
   * 본문 캔버스 폭(Tailwind max-w 클래스). 헤더 안쪽도 같은 폭을 써서 로고·메뉴가 본문 가장자리와 맞는다.
   * 주면 기본 폭(max-w-4xl)·wide보다 우선한다.
   */
  canvas?: string;
}

/**
 * 학습자 여정 공통 레이아웃.
 * 프로토타입의 header + .wrap(max-width 720px)에 대응. 프로토타입의 여정 맵(jmap)은
 * 개발용 라우터이므로 학습자 UI에는 포함하지 않는다.
 */
export const LearnerJourneyShell = ({
  children,
  headerRight,
  wide = false,
  missionLayout = false,
  nav = false,
  canvas,
}: LearnerJourneyShellProps) => {
  // 학습자 화면 폭 기준 하나: 본문 848px(max-w-4xl). 예외는 미션 수행 화면(720px, canvas="max-w-3xl") — 몰입과 캡처 보존.
  const widthClass = canvas ?? (wide ? "max-w-6xl" : "max-w-4xl");
  const verticalPaddingClass = wide ? "py-3" : missionLayout ? "py-4" : "py-6";
  const headerAlignmentClass = missionLayout
    ? "xl:w-[61rem] xl:max-w-none xl:-translate-x-[6.5rem] xl:px-0"
    : "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 bg-[#15202B] print:hidden">
        <div className={`mx-auto flex ${widthClass} items-center justify-between gap-4 px-6 py-4 ${headerAlignmentClass}`}>
          <HomeBrand />
          {nav ? (
            <div className="flex items-center gap-4">
              {headerRight}
              <LearnerTopNav />
            </div>
          ) : headerRight}
        </div>
      </header>
      <div className={`mx-auto ${widthClass} px-6 ${verticalPaddingClass}`}>{children}</div>
      {nav && <LearnerBottomNav />}
    </div>
  );
};
