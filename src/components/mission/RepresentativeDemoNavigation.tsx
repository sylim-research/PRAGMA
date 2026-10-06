import { Link } from "react-router-dom";
import { REPRESENTATIVE_DEMOS, representativeDemoPath, type DemoTaskMode } from "@/lib/demo/representativeMissionCatalog";

export function RepresentativeDemoNavigation({ scenarioId, mode }: { scenarioId?: string; mode: DemoTaskMode }) {
  const current = REPRESENTATIVE_DEMOS.find(item => item.scenarioId === scenarioId);
  return <section className="mb-5 rounded-xl border border-[#DED9CD] bg-white px-4 py-3" aria-label="대표 미션 선택">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-bold">대표 미션 · 시연용 학습자</p>
      <Link to="/" className="text-xs text-[#536572] underline underline-offset-4">첫 화면</Link>
    </div>
    <nav className="mt-2 flex flex-wrap gap-2" aria-label="방향과 수행 방식">
      {REPRESENTATIVE_DEMOS.flatMap(demo => (["translation", "interpreting"] as const).map(taskMode => {
        const selected = demo.scenarioId === scenarioId && mode === taskMode;
        return <Link key={`${demo.direction}:${taskMode}`} to={representativeDemoPath(demo.direction, taskMode)} aria-current={selected ? "page" : undefined}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${selected ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#DED9CD] hover:bg-[#FDF3C4]"}`}>
          {demo.label} {taskMode === "translation" ? "번역" : "통역"}
        </Link>;
      }))}
    </nav>
    <p className="mt-2 text-xs leading-5 text-[#536572]">로그인·프로필 입력 없이 시작합니다. <Link className="underline underline-offset-4" to={`/demo/profile?direction=${current?.direction ?? "ko_zh"}&mode=${mode}`}>학습자 등록·프로필 화면 보기</Link></p>
    <p className="mt-2 text-xs leading-5 text-[#536572]">‘시연용 답안 채우기’로 예시 응답과 기록된 AI 피드백을 살펴볼 수 있습니다. 수행 내용은 저장되지 않습니다.</p>
    {current && current.originalMode !== mode && <p className="mt-1 text-xs leading-5 text-[#536572]">
      이 사례는 원래 {current.originalMode === "translation" ? "번역" : "통역"} 과제입니다. 같은 원문으로 {mode === "translation" ? "번역" : "통역"} 화면을 체험하며, 피드백은 원래 수행의 기록을 보여 줍니다.
    </p>}
  </section>;
}
