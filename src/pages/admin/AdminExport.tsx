import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  downloadMissionEventExport,
  fetchMissionEventExport,
  type MissionEventExportFormat,
} from "@/lib/mission/missionEventExport";

const ConsentBadge = () => (
  <Badge
    variant="outline"
    className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
  >
    동의 기반
  </Badge>
);

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
    title="연구 데이터 내보내기"
    description="수업이 끝난 뒤, 동의한 학습자의 수행 기록만 직접 식별정보를 제외한 연구용 파일로 내려받습니다."
  >
    <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-950">
      이 화면은 수업 전 문항 품질 검증 4단계에 포함되지 않습니다. 학기 중 쌓인 수행기록을 학기 종료 후 연구자료로 준비할 때 사용합니다.
    </div>
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-base font-semibold">내보내기 범위와 상태</h2>
      <ConsentBadge />
    </div>

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">어떤 기록을 모을 수 있나</h3>
        <table className="w-full text-sm">
          <tbody>
            {[
              ["학습자의 판단·수정 과정 저장", "가능"],
              ["관리자가 개인별 기록 확인", "학습 수행 기록에서 확인"],
              ["미션 수행 과정 저장", "가능"],
              ["동의·가명화 필터", "내보낼 때 자동 적용"],
              ["여러 학습자 결과 비교", "이 화면에서는 제공하지 않음"],
            ].map(([label, value]) => (
              <tr key={label} className="border-b border-border/50 last:border-0">
                <td className="py-2 pr-4 text-muted-foreground">{label}</td>
                <td className="py-2 text-right font-medium">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold">어떤 학습자 기록을 연구에 포함하나</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          내보낼 때는 데이터 이용·가명 분석 동의와 동의 버전이 유효한 기록만 자동으로 포함합니다.
          필수 활동 완료·응답 누락 여부 같은 분석 포함 기준은 내보낸 뒤 연구자가 별도로 확인합니다.
        </p>
      </div>
    </div>

    <div className="mt-6 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">분석할 기간을 정해 파일로 내려받기</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            선택한 기간의 학습 수행 기록을 연구용 파일로 만듭니다. 누가 언제 어떤 기준으로
            내려받았는지도 기록됩니다.
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
          내보내기 형식 1판
        </Badge>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">시작일</span>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">종료일</span>
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!!exporting} onClick={() => void runExport("json")}>한 파일로 받기 (JSON)</Button>
          <Button disabled={!!exporting} onClick={() => void runExport("jsonl")}>줄 단위로 받기 (JSONL)</Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        이름·이메일·직접 사용자 ID는 제외하고 연구용 번호로 바꿉니다. 원자료와 연결 가능성이 남는
        ‘가명화’이므로 연구자료 보안 기준에 따라 관리해야 합니다.
      </p>
      {message && <p className="mt-3 text-sm font-medium">{message}</p>}
    </div>
  </AdminShell>
  );
};

export default Page;
