/** 옛 주소(/admin/class-responses·/admin/package·/admin/decision-traces?tab=class)를 「메타화용 토론」으로 넘긴다. */
export function classResponsesTabPath(params: URLSearchParams) {
  const next = new URLSearchParams();
  for (const key of ["courseId", "weekNo", "missionId", "demo"]) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `/admin/discussion?${query}` : "/admin/discussion";
}
