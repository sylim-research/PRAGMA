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

/** PC 헤더 안의 같은 두 탭. 현재 탭은 노란 밑줄로 표시한다. */
export const LearnerTopNav = () => (
  // 밑줄은 글자 폭에만 긋는다 — 좌우 여백까지 덮으면 무엇을 가리키는지 흐려진다(2026-09-20).
  // 탭이 둘뿐이고 이름이 두 글자라 아이콘은 구분에 기여하지 않아 PC 헤더에서는 뺀다(모바일 하단 탭은 유지).
  // 밑줄은 흐름 밖(absolute)에 그린다 — border-b로 그리면 글자가 위로 밀려 옆의 「내 계정」과
  // 높이가 어긋났다(2026-09-28). 세 항목 모두 h-9 안에서 가운데 정렬한다.
  <nav aria-label="학습자 메뉴" className="hidden items-center gap-1 md:flex">
    {TABS.map((t) => (
      <NavLink
        key={t.to}
        to={t.to}
        className={({ isActive }) =>
          [
            "relative inline-flex h-9 items-center px-3 text-[14px] font-semibold tracking-[-0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FAD338] focus-visible:ring-offset-2 focus-visible:ring-offset-[#15202B] rounded-md",
            isActive ? "text-white" : "text-[#9EABB7] hover:text-white",
          ].join(" ")
        }
      >
        {({ isActive }) => (
          <>
            {t.label}
            <span
              aria-hidden
              className={[
                "absolute inset-x-3 bottom-[3px] h-[2px] rounded-full bg-[#FAD338] transition-opacity",
                isActive ? "opacity-100" : "opacity-0",
              ].join(" ")}
            />
          </>
        )}
      </NavLink>
    ))}
  </nav>
);
