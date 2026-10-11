import { useLocation } from "react-router-dom";

/**
 * 원고 캡처 모드(2026-10-09). 주소에 ?capture=1을 붙이면 이 탭에서 계속 켜지고 ?capture=0으로 끈다.
 * 켜면 관리자·학습자 화면 모두 본문을 800px 캔버스로 묶고 관리자 사이드바를 감춘다 —
 * 카드를 잘라 HWPX 본문 폭(약 14cm)에 넣었을 때 14px 글씨가 7pt 안팎으로 읽히게 하려는 장치다.
 * ?capture=wide는 관리자 화면을 사이드바째 1440px 틀로 고정한다(2026-10-11) — 시스템 전체 구조를 보이는
 * 큰 그림용이다. 어느 모니터에서 찍어도 같은 틀이 나온다. 주소에 붙어 있을 때만 켜진다.
 * 웹앱 화면(기본)에는 영향을 주지 않는다.
 */
const CAPTURE_KEY = "pragma.captureMode";
export const CAPTURE_CANVAS = "max-w-[800px]";
export const CAPTURE_WIDE_CANVAS = "w-[1440px] max-w-none";

type CaptureValue = "1" | "wide" | null;

function useCaptureValue(): CaptureValue {
  const { search } = useLocation();
  const param = new URLSearchParams(search).get("capture");
  // wide는 주소에 붙어 있을 때만 켠다 — 탭에 남으면 좁은 창에서 틀이 넘쳐 평소 화면이 어긋나 보인다.
  if (param === "wide") return "wide";
  try {
    if (param === "1") window.sessionStorage.setItem(CAPTURE_KEY, "1");
    if (param === "0") window.sessionStorage.removeItem(CAPTURE_KEY);
    if (window.sessionStorage.getItem(CAPTURE_KEY) === "wide") window.sessionStorage.removeItem(CAPTURE_KEY);
    return window.sessionStorage.getItem(CAPTURE_KEY) === "1" ? "1" : null;
  } catch {
    return param === "1" ? "1" : null;
  }
}

export function useCaptureMode(): boolean {
  return useCaptureValue() === "1";
}

export function useWideCaptureMode(): boolean {
  return useCaptureValue() === "wide";
}
