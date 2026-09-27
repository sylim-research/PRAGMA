import { BookOpen, History } from "lucide-react";
import { NavLink } from "react-router-dom";

// 학습자 최상위 공간 — 필수 학습(수업) · 회고(기록).
//
// 홈 탭은 없앴다(2026-08-01). 수업 화면이 「이번 학습」 CTA와 9화행 지도를 갖게 되면서
// 홈에 남은 것이 다른 탭으로 가는 우회 링크뿐이었고, 홈의 이월 조언은 이번 주 화행과
// 무관한 지난 화행을 나란히 보여 오히려 오해를 만들었다. 이월은 관련 미션 직전에서
// 회수한다(latestFocusCarryOver는 그 용도로 남겨 둔다).
//
// 같은 두 탭을 PC에서는 헤더 안(LearnerTopNav)에, 모바일에서는 화면 아래(LearnerBottomNav)에 둔다(2026-09-19).
// 하단 탭바는 모바일 관례라 PC 화면에서는 빈 공간만 강조했다.
const TABS = [
  { to: "/learner/course", label: "수업", icon: BookOpen },
  { to: "/learner/records", label: "학습 기록", icon: History },
];

export const LearnerBottomNav = () => (
  <nav aria-label="학습자 메뉴" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#EAE4D2] bg-white/95 backdrop-blur md:hidden">
    <div className="mx-auto flex max-w-3xl">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            [
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[13px] font-bold",
              isActive ? "text-[#15202B]" : "text-muted-foreground",
            ].join(" ")
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={[
                  "flex h-7 w-11 items-center justify-center rounded-full text-[16px]",
                  isActive ? "bg-[#FAD338]" : "",
                ].join(" ")}
              >
                <t.icon className="h-[17px] w-[17px]" aria-hidden />
              </span>
              {t.label}
            </>
          )}
        </NavLink>
      ))}
    </div>
  </nav>
);

/** PC 헤더 안의 같은 두 탭. 현재 탭은 헤더 아래 가장자리의 노란 선으로 표시한다. */
export const LearnerTopNav = () => (
  // 2026-09-28: 탭을 상자·알약으로 감싸면 헤더가 도구 막대처럼 무거워지고 로고보다 튀었다.
  // 글자만 두고, 현재 탭은 헤더 아래 가장자리에 붙은 노란 선(창턱처럼)으로 표시한다.
  // 선은 흐름 밖(absolute)에 그려 글자 높이를 밀지 않는다 — border-b 방식은 옆 「내 계정」과 높이가 어긋났다.
  // 글자만 있으면 「누르는 메뉴」 신호가 약해 아이콘을 붙이고, 비활성 글자도 흐리게 하지 않는다(회색=꺼진 기능으로 읽힘).
  // 「기록」→「학습 기록」: 용어대장의 「학습 수행 기록」 약칭과 맞춘다(2026-09-28).
  <nav aria-label="학습자 메뉴" className="hidden items-center gap-2 md:flex">
    {TABS.map((t) => (
      <NavLink
        key={t.to}
        to={t.to}
        className={({ isActive }) =>
          [
            "relative inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[14px] font-semibold tracking-[-0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FAD338] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15202B]",
            isActive ? "text-white" : "text-[#DCE3E9] hover:bg-white/[0.07] hover:text-white",
          ].join(" ")
        }
      >
        {({ isActive }) => (
          <>
            <t.icon aria-hidden strokeWidth={2} className={["h-[15px] w-[15px]", isActive ? "text-[#FAD338]" : ""].join(" ")} />
            {t.label}
            {/* 헤더 py-4(16px)만큼 내려 헤더 아래 가장자리에 붙인다. */}
            <span
              aria-hidden
              className={[
                "absolute inset-x-3 -bottom-4 h-[3px] bg-[#FAD338] transition-opacity",
                isActive ? "opacity-100" : "opacity-0",
              ].join(" ")}
            />
          </>
        )}
      </NavLink>
    ))}
  </nav>
);
