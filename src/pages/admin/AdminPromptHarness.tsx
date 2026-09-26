import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PROMPT_SNAPSHOT, type PromptSnapshotEntry } from "@/lib/pragma/promptSnapshot.generated";
import { ACTIVE_RULE_IDS } from "@/lib/pragma/missionRules";

// ── 저장소 정본(읽기 전용) ─────────────────────────────────────────────
// 이 섹션의 원문은 promptSnapshot.generated.ts에서 온다. 그 파일은 build마다
// 실제 edge 소스에서 자동 재생성되므로(prebuild) 화면이 코드보다 낡을 수 없다.
// 편집 경로는 만들지 않는다 — 프롬프트를 고치려면 코드를 고쳐야 한다.
const SNAPSHOT_GROUP_LABEL: Record<string, string> = {
  core: "시나리오 생성",
  mission: "학습 미션 생성 (v5 형식 · v6 전환의 원본)",
  review: "AI 검토와 교차 점검",
  runtime: "학습자 AI 피드백",
  authoring: "실제 자료 활용",
};
const HARNESS_SECTION_ORDER = ["core", "mission", "review", "runtime", "authoring"];
// 화면 조작으로 호출될 수 없는 지시문. 스냅숏(감사 기록)에는 남기고 화면에서만 뺀다.
// 집중 구간 없는 피드백은 편성된 4문항 미션이 학습자에게 열리지 않아 호출 경로가 없다.
const HIDDEN_PROMPT_KEYS = new Set([
  "feedback.system",
  "feedback.system.zh_ko",
  "feedback.system.zh_ko.spoken",
  "feedback.system.spoken",
]);

function HarnessOverview() {
  return (
    <section
      aria-labelledby="harness-overview-title"
      className="rounded-xl border border-[#D9D2BF] bg-white p-4 sm:p-5"
    >
      <div className="max-w-[48rem]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A7621]">
          품질 관리 구조
        </p>
        <h2 id="harness-overview-title" className="mt-1 text-[18px] font-bold text-[#26333B]">
          자동 품질 점검과 AI 검토는 근거를 제시하고, 최종 승인은 교수자가 합니다
        </h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          자동 품질 점검과 AI 검토를 거친 뒤, 교수자가 감수하고 최종 승인합니다.
        </p>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-[#E5DEC9] bg-[#FBFAF6] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#6D5C1F]">자동 품질 점검</span>
            <Badge variant="outline" className="bg-white font-normal">재현 가능</Badge>
          </div>
          <h3 className="mt-2 text-[14px] font-bold">규칙 기반 검사</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            같은 입력에는 같은 결과를 냅니다. HSK 어휘 참고 범위 점검과 현행 규칙 {ACTIVE_RULE_IDS.length}개가
            여기에 속합니다.
          </p>
        </div>
        <div className="rounded-lg border border-[#D8E0E5] bg-[#F7FAFB] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#3F6172]">AI 검토</span>
            <Badge variant="outline" className="bg-white font-normal">문맥 검토</Badge>
          </div>
          <h3 className="mt-2 text-[14px] font-bold">프롬프트 통제 기반 검토</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            생성과 분리된 AI가 버전이 관리되는 지시문에 따라 의미·자연성·후보 자격을 검토합니다.
          </p>
        </div>
        <div className="rounded-lg border border-[#E1DDD4] bg-[#FAF9F7] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#6D675D]">최종 사용 결정</span>
            <Badge variant="outline" className="bg-white font-normal">최종 권한</Badge>
          </div>
          <h3 className="mt-2 text-[14px] font-bold">교수자 최종 승인</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            자동 품질 점검·AI 검토 근거를 보고 더 쉽게 또는 더 도전적으로 조정할지와 학습자 공개 여부를
            결정합니다.
          </p>
        </div>
      </div>
    </section>
  );
}

function SnapshotCard({ entry }: { entry: PromptSnapshotEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={open ? "md:col-span-2" : undefined}>
      <CardHeader className="p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex min-w-0 flex-1 items-center gap-1 text-left"
          >
            {open ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <CardTitle className="truncate text-[15px]">{entry.label}</CardTitle>
          </button>
          <Badge variant="outline" className="shrink-0 font-mono text-[11px]">
            {entry.sha256.slice(0, 10)}
          </Badge>
          <Badge variant="secondary" className="shrink-0 font-normal">
            {entry.text.length.toLocaleString()}자
          </Badge>
        </div>
        <p className="mt-1 truncate pl-5 text-xs text-muted-foreground" title={entry.note}>
          {entry.note}
        </p>
      </CardHeader>
      {open && (
        <CardContent className="p-4 pt-0">
          <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
            {entry.text}
          </pre>
          <p className="mt-2 break-all font-mono text-[10.5px] text-muted-foreground">
            {entry.key} · sha256 {entry.sha256}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

const AdminPromptHarness = () => {
  return (
    <AdminShell
      title="생성 계약·프롬프트"
      description="생성 계약과 버전이 관리되는 프롬프트, 자동 품질 점검 규칙, 교수자 감수와 최종 승인의 관계를 확인합니다."
    >
      <HarnessOverview />

      <div className="mt-6 space-y-6">
        {HARNESS_SECTION_ORDER.map((g) => {
          const items = PROMPT_SNAPSHOT.prompts.filter((p) => p.group === g && !HIDDEN_PROMPT_KEYS.has(p.key));
          if (items.length === 0) return null;
          return (
            <div key={g}>
              <h3 className="mb-2 text-[15px] font-bold">{SNAPSHOT_GROUP_LABEL[g] ?? g}</h3>
              <div className="grid grid-flow-row-dense gap-2 md:grid-cols-2">
                {items.map((p) => (
                  <SnapshotCard key={p.key} entry={p} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
};

export default AdminPromptHarness;
