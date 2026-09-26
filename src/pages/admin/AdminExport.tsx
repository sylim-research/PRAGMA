import { Fragment, useState } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  downloadMissionEventExport,
  fetchMissionEventExport,
  type MissionEventExportFormat,
} from "@/lib/mission/missionEventExport";

// 내려받기가 이 화면의 일이므로 맨 위에 두고, 그 아래에는 학습 수행 기록이 연구 자료가 되기까지의
// 순서(동의 확인 → 가명 처리 → 연구자의 선별·구성)를 번호와 화살표로 보여 준다.
// 내려받은 파일은 아직 「학습 데이터(연구 자료)」가 아니다 — 선별·구성은 연구자의 몫이다.
const RULES: Array<[string, string]> = [
  ["동의한 기록만", "데이터 이용·가명 분석에 동의했고 동의 버전이 유효한 학습자의 기록만 자동으로 담습니다."],
  ["가명 처리", "이름·이메일·사용자 ID를 연구용 번호로 바꿉니다. 원자료와 연결될 수 있으므로 연구자료 보안 기준에 따라 보관합니다."],
  ["연구자의 선별·구성", "필수 활동 완료·응답 누락 같은 포함 기준으로 선별·구성한 뒤에 학습 데이터(연구 자료)가 됩니다."],
];

const Page = () => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState<MissionEventExportFormat | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runExport = async (format: MissionEventExportFormat) => {
    setExporting(format);
    setMessage(null);
    try {
      const rows = await fetchMissionEventExport({
        from: from ? `${from}T00:00:00+09:00` : null,
        to: to ? `${to}T23:59:59+09:00` : null,
      });
      downloadMissionEventExport(rows, format);
      setMessage(`${rows.length}개 이벤트를 ${format.toUpperCase()}로 내보냈습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "내보내기에 실패했습니다.");
    } finally {
      setExporting(null);
    }
  };

  return (
  <AdminShell
    title="연구용 학습 기록 내보내기"
    description="동의한 학습자의 학습 수행 기록을 가명 처리해 연구용 파일로 내려받습니다."
    compact
  >
    <section className="rounded-xl border border-[#E2DED2] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-bold text-[#15202B]">기간을 정해 내려받기</h2>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[11.5px] text-emerald-800">동의 기반</Badge>
          <Badge variant="outline" className="border-[#9FB0C6] bg-[#F7F9FC] text-[11.5px] text-[#1F3A5F]">내보내기 형식 1판</Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-[#15202B]">시작일</span>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-[#15202B]">종료일</span>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <div className="flex gap-2">
          <Button variant="outline" className="border-[#1F3A5F] text-[#1F3A5F] hover:bg-[#EEF2F7]" disabled={!!exporting} onClick={() => void runExport("json")}>
            {exporting === "json" ? "만드는 중…" : "한 파일로 받기 (JSON)"}
          </Button>
          <Button disabled={!!exporting} onClick={() => void runExport("jsonl")}>
            {exporting === "jsonl" ? "만드는 중…" : "줄 단위로 받기 (JSONL)"}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-[#46515A]">
        기간을 비우면 전체 기간을 내려받습니다. 누가 언제 어떤 기준으로 내려받았는지도 기록됩니다.
      </p>
      {message && <p role="status" className="mt-2 text-sm font-semibold text-[#1F3A5F]">{message}</p>}
    </section>

    <section className="mt-4 flex flex-col items-stretch gap-2 md:flex-row" aria-label="포함 기준">
      {RULES.map(([title, body], index) => (
        <Fragment key={title}>
          {index > 0 && (
            <span aria-hidden className="flex items-center justify-center text-[#B8A780]">
              <ArrowDown className="h-4 w-4 md:hidden" />
              <ArrowRight className="hidden h-4 w-4 md:block" />
            </span>
          )}
          <div className="min-w-0 flex-1 rounded-xl border border-[#E2DED2] bg-white px-4 py-3.5">
            <h3 className="flex items-center gap-2 text-[13.5px] font-bold text-[#15202B]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1F2A44] text-[11px] text-white">{index + 1}</span>
              {title}
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[#46515A]">{body}</p>
          </div>
        </Fragment>
      ))}
    </section>
  </AdminShell>
  );
};

export default Page;
