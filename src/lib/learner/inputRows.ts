/**
 * 학습자 입력칸의 시작 줄 수 — 원문과 같은 줄 수, 원문이 한 줄이면 +1(2줄)까지.
 * 입력칸이 원문보다 크면 「길게 써야 한다」는 부담을 주므로 원문 길이에 묶는다(연구자 규칙, 2026-10-10).
 * 줄 수는 한 줄 약 45자(17px 본문 기준)로 어림한다. 학습자가 더 쓰면 칸은 늘릴 수 있다.
 */
export function sourceLineRows(source: string, charsPerLine = 45): number {
  const lines = source
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.trim().length / charsPerLine)), 0);
  return Math.min(6, Math.max(2, lines));
}
