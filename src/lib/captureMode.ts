import { useLocation } from "react-router-dom";

/**
 * 원고 캡처 모드(2026-10-09). 주소에 ?capture=1을 붙이면 이 탭에서 계속 켜지고 ?capture=0으로 끈다.
 * 켜면 관리자·학습자 화면 모두 본문을 800px 캔버스로 묶고 관리자 사이드바를 감춘다 —
 * 카드를 잘라 HWPX 본문 폭(약 14cm)에 넣었을 때 14px 글씨가 7pt 안팎으로 읽히게 하려는 장치다.
 * 웹앱 화면(기본)에는 영향을 주지 않는다.
 */
const CAPTURE_KEY = "pragma.captureMode";
export const CAPTURE_CANVAS = "max-w-[800px]";

export function useCaptureMode(): boolean {
  const { search } = useLocation();
  const param = new URLSearchParams(search).get("capture");
  try {
    if (param === "1") window.sessionStorage.setItem(CAPTURE_KEY, "1");
    if (param === "0") window.sessionStorage.removeItem(CAPTURE_KEY);
    return window.sessionStorage.getItem(CAPTURE_KEY) === "1";
  } catch {
    return param === "1";
  }
}
