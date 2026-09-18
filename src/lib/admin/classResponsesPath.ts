/** 옛 주소(/admin/class-responses·/admin/package)를 「학습 수행 기록 › 학급 응답 분포」 탭으로 넘긴다. */
export function classResponsesTabPath(params: URLSearchParams) {
  const next = new URLSearchParams({ tab: "class" });
  for (const key of ["courseId", "weekNo", "missionId"]) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  return `/admin/decision-traces?${next}`;
}
