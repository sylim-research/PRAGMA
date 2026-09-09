import { BookOpen, History } from "lucide-react";
import { NavLink } from "react-router-dom";

// 학습자 최상위 공간 — 필수 학습(수업) · 회고(기록).
//
// 홈 탭은 없앴다(2026-08-01). 수업 화면이 「이번 학습」 CTA와 9화행 지도를 갖게 되면서
// 홈에 남은 것이 다른 탭으로 가는 우회 링크뿐이었고, 홈의 이월 조언은 이번 주 화행과
// 무관한 지난 화행을 나란히 보여 오히려 오해를 만들었다. 이월은 관련 미션 직전에서
// 회수한다(latestFocusCarryOver는 그 용도로 남겨 둔다).
const TABS = [
  { to: "/learner/course", label: "수업", icon: BookOpen },
  { to: "/learner/records", label: "기록", icon: History },
];

export const LearnerBottomNav = () => (
  <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#EAE4D2] bg-white/95 backdrop-blur">
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
