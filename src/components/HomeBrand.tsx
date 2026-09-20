import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";

export const HomeBrand = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pulse, setPulse] = useState(false);

  const handleClick = () => {
    if (pathname === "/") {
      setPulse(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => setPulse(false), 250);
    } else {
      navigate("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="홈으로"
      className={[
        "group inline-flex items-baseline gap-2 text-[#F1EFE8]",
        "cursor-pointer transition-all duration-200 hover:text-white",
        pulse ? "scale-[0.98] opacity-90" : "scale-100 opacity-100",
      ].join(" ")}
    >
      <span aria-hidden className="inline-block h-[15px] w-[5px] translate-y-[1px] rounded-full bg-[#FAD338]" />
      {/* 제품명은 로고타입처럼 — 자간을 넓혀 문장이 아니라 '마크'로 읽히게 한다. */}
      <span className="text-[16px] font-bold tracking-[0.18em] sm:text-[17px]">PRAGMA</span>
      {/* 공식 설명어(= 논문 제목의 앞부분). 좁은 화면에서는 제품명만 남긴다. */}
      <span aria-hidden className="hidden h-[11px] w-px self-center bg-[#3E4C5A] sm:inline-block" />
      <span className="hidden text-[14px] font-normal text-[#A9B6C4] transition-colors group-hover:text-[#D3DBE3] sm:inline">
        AI 기반 한·중 통번역 학습
      </span>
    </button>
  );
};

export default HomeBrand;
