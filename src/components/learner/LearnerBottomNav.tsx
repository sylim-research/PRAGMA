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
  { to: "/learner/records", label: "기록", icon: History },
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

/** PC 헤더 안의 같은 두 탭. 현재 탭은 밝은 알약 배경으로 표시한다. */
export const LearnerTopNav = () => (
  // 2026-09-28: 가는 밑줄 + 옅은 회청색 글자는 학생이 「누를 수 있는 메뉴」로 읽기 어려웠다.
  // 세 항목(수업·기록·내 계정)을 같은 높이의 알약 모양으로 통일하고, 아이콘을 다시 붙여
  // 무엇을 여는지 한눈에 보이게 한다. 현재 탭은 채운 배경 + 노란 아이콘으로 표시한다.
  <nav aria-label="학습자 메뉴" className="hidden items-center gap-1 md:flex">
    {TABS.map((t) => (
      <NavLink
        key={t.to}
        to={t.to}
        className={({ isActive }) =>
          [
            "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[15px] font-semibold tracking-[-0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FAD338] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15202B]",
            isActive ? "bg-white/[0.12] text-white" : "text-[#DCE3E9] hover:bg-white/[0.06] hover:text-white",
          ].join(" ")
        }
      >
        {({ isActive }) => (
          <>
            <t.icon
              aria-hidden
              strokeWidth={2}
              className={["h-[17px] w-[17px]", isActive ? "text-[#FAD338]" : "text-[#B9C4CE]"].join(" ")}
            />
            {t.label}
          </>
        )}
      </NavLink>
    ))}
  </nav>
);
