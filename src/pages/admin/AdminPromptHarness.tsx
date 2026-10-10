import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminShell } from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PROMPT_SNAPSHOT, type PromptSnapshotEntry } from "@/lib/pragma/promptSnapshot.generated";
import {
  CURRENT_MISSION_V6_RULE_IDS,
  CURRENT_PIPELINE_RULE_IDS,
  CURRENT_SCENARIO_RULE_IDS,
  QUALITY_RULE_CATALOG,
  QUALITY_RULE_CATALOG_REVIEW_STATUS,
  QUALITY_RULE_CATEGORIES,
  QUALITY_RULE_IDS_IN_CATALOG,
  type QualityRuleNature,
} from "@/lib/pragma/qualityRuleCatalog";
import type { RuleId } from "@/lib/pragma/missionRules";

// ── 저장소 정본(읽기 전용) ─────────────────────────────────────────────
// 이 섹션의 원문은 promptSnapshot.generated.ts에서 온다. 그 파일은 build마다
// 실제 edge 소스에서 자동 재생성되므로(prebuild) 화면이 코드보다 낡을 수 없다.
// 편집 경로는 만들지 않는다 — 프롬프트를 고치려면 코드를 고쳐야 한다.
const SNAPSHOT_GROUP_LABEL: Record<string, string> = {
  core: "시나리오 생성",
  mission: "학습 미션 생성",
  review: "AI 품질 심사와 독립 검토",
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
// 호출은 되지만 화면에서는 생략하는 지시문(2026-10-09). 선행발화의 언어 표기만 1회 고치는 기술 보정이라
// 연구 서술과 관련이 가장 적다. 스냅숏(감사 기록)에는 그대로 남는다. 카드를 2열로 짝 맞추기 위해 뺐다.
const OMITTED_PROMPT_KEYS = new Set(["core.user.preceding_turn_repair"]);

// 생성계약 정본(docs/contracts/PRAGMA_생성계약_정본.md)이 고정하는 것을 화면용 한 줄로 옮긴다.
// 정본은 변경 이력·결정 ID가 섞인 긴 문서라 원문을 싣지 않는다. 계약이 바뀌면 이 목록도 고친다.
const CONTRACT_CLAUSES: { title: string; body: string }[] = [
  { title: "생성 조건", body: "화행·상황과 관계·수준·언어 방향·수행 방식 조합으로만 만듭니다." },
  { title: "두 단계 생성", body: "시나리오부터 만들고, 고른 것만 학습 미션으로 만듭니다." },
  { title: "언어 방향", body: "원문·산출 언어를 방향마다 고정해 검사합니다." },
  { title: "평가 경계", body: "의미·문법·상황 적절성을 따로 판정하고 합산하지 않습니다." },
  { title: "생성 기록", body: "모델·프롬프트 판본과 생성 시각을 남겨 추적합니다." },
  { title: "공개 조건", body: "교수자가 승인한 미션만 공개합니다." },
];

// 이 화면의 세 부분(생성계약 → 품질관리 구조 → 운영 프롬프트)은 같은 급의 제목으로 나란히 둔다.
// 구역은 HSK 화면처럼 흰 카드 하나로 묶는다 — 카드 머리에 제목과 짧은 요약을 한 줄로 둔다(2026-10-09).
const PART_CARD = "overflow-hidden rounded-xl border border-[#E2DED2] bg-white";
const PART_BODY = "border-t border-[#EFEAE0] px-5 py-4";

// 1층 = 카드 머리(제목 + 요약), 2층 = 크림 바탕·노란 윗선 안쪽 카드, 3층 = 흰 항목.
// 아이콘은 두지 않는다 — 정렬이 깨져 오히려 읽기 어렵다(2026-10-09).
function PartHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pb-3 pt-4">
      <h2 id={id} className="text-[17.5px] font-bold tracking-[-0.01em] text-[#15202B]">{title}</h2>
      <span className="text-[13.5px] text-[#514C44]">{description}</span>
    </div>
  );
}

// 단계 카드의 이동·펼침 문구 — 무거운 굵은 글씨 대신 노란 알약으로 가볍게, 마우스를 올리면 화살표가 살짝 움직인다.
const STAGE_LINK = "mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-[#FFF3C4] px-3 py-1 text-[13px] font-semibold text-[#15202B] transition-colors hover:bg-[#FAD338]";
const STAGE_ARROW = "h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5";
const STAGE_CARD = "rounded-lg border border-[#DED8CB] border-t-[3px] border-t-[#E2C847] bg-[#FCFBF7] px-3 py-3.5";

function ContractSummary() {
  return (
    <section aria-labelledby="contract-title" className={PART_CARD}>
      <PartHeading id="contract-title" title="생성계약" description="모든 생성·검토·저장이 지키는 여섯 조건" />
      {/* 번호는 세로로 읽힌다(왼쪽 1~3, 오른쪽 4~6). 두 열 사이에 가는 구분선(2026-10-10). */}
      <ol className={`grid gap-y-2 md:grid-flow-col md:grid-cols-2 md:grid-rows-3 md:gap-0 ${PART_BODY}`}>
        {CONTRACT_CLAUSES.map((clause, index) => (
          <li key={clause.title} className={`flex items-center gap-2.5 md:py-1 ${index >= 3 ? "md:border-l md:border-[#E7E2D6] md:pl-6" : "md:pr-6"}`}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#C9A62E] text-[12px] font-bold text-[#6D5C1F]">{index + 1}</span>
            <p className="text-[14px] leading-relaxed text-[#3B4A54]"><b className="font-bold text-[#15202B]">{clause.title}</b> · {clause.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const NATURE_LABEL: Record<QualityRuleNature, string> = {
  structural: "형식 확인",
  signal: "위험 신호",
  governance: "기록 확인",
};
const SCENARIO_RULES = new Set<RuleId>(CURRENT_SCENARIO_RULE_IDS);
const MISSION_RULES = new Set<RuleId>(CURRENT_MISSION_V6_RULE_IDS);
const ruleOrder = (id: RuleId) => Number(id.replace(/\D/g, "")) + (id.endsWith("c") ? 0.5 : 0);

function RuleCatalogPanel() {
  const [scope, setScope] = useState<"current" | "legacy">("current");
  const ids = QUALITY_RULE_IDS_IN_CATALOG.filter((id) => (scope === "current") === CURRENT_PIPELINE_RULE_IDS.has(id));
  const currentCount = QUALITY_RULE_IDS_IN_CATALOG.filter((id) => CURRENT_PIPELINE_RULE_IDS.has(id)).length;
  const legacyCount = QUALITY_RULE_IDS_IN_CATALOG.length - currentCount;
  return (
    <div id="quality-rules" className="mt-3 rounded-lg border border-[#E2DED2] bg-[#FFFDF7] p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        {([["current", `현행 미션에 적용 ${currentCount}`], ["legacy", `이전 형식 전용 ${legacyCount}`]] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}
            className={`rounded-lg border px-3 py-1.5 text-[13.75px] font-medium ${scope === value ? "border-[#15202B] bg-[#15202B] text-white" : "border-[#E2DED2] bg-white text-[#3B4A54] hover:bg-[#F5F4EF]"}`}>
            {label}
          </button>
        ))}
        {QUALITY_RULE_CATALOG_REVIEW_STATUS === "draft_pending_researcher_review" && (
          <span className="ml-auto text-[13px] text-[#8A7621]">설명 문안은 연구자 확인 전입니다.</span>
        )}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-[#52616B]">
        {scope === "current"
          ? "지금 만드는 시나리오와 학습 미션에 실제로 실행되는 규칙입니다."
          : "이전 미션 형식에만 실행되는 규칙입니다. 현행 미션의 문항 품질은 AI 검토와 교수자 승인으로 확인합니다."}
      </p>
      <div className="mt-3 space-y-4">
        {QUALITY_RULE_CATEGORIES.map((category) => {
          const rules = ids.filter((id) => QUALITY_RULE_CATALOG[id].category === category).sort((a, b) => ruleOrder(a) - ruleOrder(b));
          if (rules.length === 0) return null;
          return (
            <div key={category}>
              <h4 className="text-[13.75px] font-bold text-[#15202B]">{category} <span className="font-normal text-[#6D675D]">{rules.length}</span></h4>
              <ul className="mt-1.5 divide-y divide-[#EEE9DB] rounded-md border border-[#EEE9DB] bg-white">
                {rules.map((id) => {
                  const rule = QUALITY_RULE_CATALOG[id];
                  return (
                    <li key={id} className="grid gap-1 px-3 py-2 sm:grid-cols-[3.25rem_minmax(0,1fr)]">
                      <span className="font-mono text-[13.5px] font-bold text-[#15202B]">{id}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {scope === "current" && SCENARIO_RULES.has(id) && <Badge variant="outline" className="bg-white px-1.5 py-0 text-[13px] font-normal">시나리오</Badge>}
                          {scope === "current" && MISSION_RULES.has(id) && <Badge variant="outline" className="bg-white px-1.5 py-0 text-[13px] font-normal">학습 미션</Badge>}
                          <Badge variant="outline" className="border-[#E2DED2] bg-[#FBFAF6] px-1.5 py-0 text-[13px] font-normal text-[#6D5C1F]">{NATURE_LABEL[rule.nature]}</Badge>
                        </div>
                        <p className="mt-1 text-[13.5px] leading-relaxed text-[#26333B]">{rule.summary_ko}</p>
                        {rule.applicability_ko && <p className="mt-0.5 text-[13px] leading-relaxed text-[#6D675D]">적용 조건 · {rule.applicability_ko}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HarnessOverview() {
  const [rulesOpen, setRulesOpen] = useState(false);
  return (
    <section aria-labelledby="harness-overview-title" className={PART_CARD}>
      <PartHeading id="harness-overview-title" title="품질관리 구조" description="자동 규칙 점검 → AI 품질 심사 → 교수자 최종 승인" />
      <div className={PART_BODY}>
      <div className="grid gap-2 md:grid-cols-3">
        <button type="button" aria-expanded={rulesOpen} aria-controls="quality-rules" onClick={() => setRulesOpen((o) => !o)}
          className={`group ${STAGE_CARD} text-left transition-colors hover:border-[#C9A62E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15202B] ${rulesOpen ? "border-[#C9A62E] bg-[#FFFDF7]" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[#6D5C1F]">자동 규칙 점검</span>
            <Badge variant="outline" className="bg-white font-normal">서버 코드</Badge>
          </div>
          <h3 className="mt-1.5 text-[15.5px] font-bold">현행 미션 규칙 {MISSION_RULES.size}개</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
            {/* HSK 어휘 대조는 점검·승인 조건이 아니라 생성 후 참고 기록이라 여기 두지 않는다(2026-09-27 정본). */}
            구성·수량·언어 방향·생성 기록을 확인합니다. 같은 입력에는 같은 결과를 냅니다.
          </p>
          <span className={STAGE_LINK}>
            {rulesOpen ? "규칙 접기" : "규칙 보기"}
            {rulesOpen ? <ChevronDown aria-hidden className={STAGE_ARROW} /> : <ChevronRight aria-hidden className={STAGE_ARROW} />}
          </span>
        </button>
        <div className={STAGE_CARD}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[#3F6172]">AI 품질 심사</span>
            <Badge variant="outline" className="bg-white font-normal">GPT-4.1</Badge>
          </div>
          <h3 className="mt-1.5 text-[15.5px] font-bold">결함 유형별 심사</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
            의미·화행·자연성·해설 일치를 심사합니다. 필요 시 독립 검토와 재판정이 이어집니다.
          </p>
          <a href="#prompts-review" className={`group ${STAGE_LINK}`}>
            검토 프롬프트 보기<ChevronDown aria-hidden className={STAGE_ARROW} />
          </a>
        </div>
        <div className={STAGE_CARD}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[#6D675D]">교수자 최종 승인</span>
            <Badge variant="outline" className="bg-white font-normal">최종 권한</Badge>
          </div>
          <h3 className="mt-1.5 text-[15.5px] font-bold">수정·보류·사용 결정</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
            각 단계의 의견과 실제 콘텐츠를 직접 대조해 수업 사용 여부를 결정합니다.
          </p>
          <Link to="/admin/review" className={`group ${STAGE_LINK}`}>
            승인 화면으로<ChevronRight aria-hidden className={STAGE_ARROW} />
          </Link>
        </div>
      </div>
      {rulesOpen && <RuleCatalogPanel />}
      </div>
    </section>
  );
}

// 장면 사전 검토는 원문을 쓰기 전 관계 조건을 거르는 첫 관문이라 시나리오 생성 묶음의 맨 위 한 줄을 차지한다.

function SnapshotCard({ entry }: { entry: PromptSnapshotEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={`border-[#E2DED2] ${open ? "md:col-span-2" : ""}`}>
      <CardHeader className="space-y-[3px] p-0 px-4 py-3">
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
            <CardTitle className="text-[15px] leading-tight">{entry.label.replace(/\s*\(([^)]*)\)/g, " $1")}</CardTitle>
          </button>
          <Badge variant="outline" className="shrink-0 px-2 py-0 font-mono text-[13px] leading-5">
            {entry.sha256.slice(0, 10)}
          </Badge>
          <Badge variant="secondary" className="shrink-0 px-2 py-0 font-normal leading-5">
            {entry.text.length.toLocaleString()}자
          </Badge>
        </div>
        <p className="truncate pl-5 text-[13.25px] leading-tight text-muted-foreground" title={entry.note}>
          {entry.note}
        </p>
      </CardHeader>
      {open && (
        <CardContent className="p-4 pt-0">
          <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-[13px] leading-relaxed">
            {entry.text}
          </pre>
          <p className="mt-2 break-all font-mono text-[13px] text-muted-foreground">
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
      title="생성계약·운영 프롬프트"
      description="생성계약과 버전이 관리되는 운영 프롬프트, 자동 품질 점검 규칙, 교수자 감수와 최종 승인의 관계를 확인합니다."
    >
      <div className="flex flex-col gap-4">
      <ContractSummary />
      <HarnessOverview />

      <section aria-labelledby="prompts-title" className={PART_CARD}>
        <PartHeading id="prompts-title" title="운영 프롬프트" description="코드에서 그대로 가져온 생성·검토·피드백 원문" />
        <div className={`space-y-9 ${PART_BODY}`}>
        {HARNESS_SECTION_ORDER.map((g) => {
          const items = PROMPT_SNAPSHOT.prompts.filter((p) => p.group === g && !HIDDEN_PROMPT_KEYS.has(p.key) && !OMITTED_PROMPT_KEYS.has(p.key));
          if (items.length === 0) return null;
          return (
            <div key={g} id={`prompts-${g}`} className="scroll-mt-4">
              <h3 className="mb-3 border-l-[3px] border-[#C9A62E] pl-2.5 text-[17px] font-bold leading-6 text-[#8A7423]">{SNAPSHOT_GROUP_LABEL[g] ?? g}</h3>
              <div className="grid gap-1.5 md:grid-cols-2">
                {items.map((p) => (
                  <SnapshotCard key={p.key} entry={p} />
                ))}
              </div>
            </div>
          );
        })}
        </div>
      </section>
      </div>
    </AdminShell>
  );
};

export default AdminPromptHarness;
