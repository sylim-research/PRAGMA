import { useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  IDLE_STATUSES,
  runServiceHealthCheck,
  type ServiceId,
  type ServiceStatus,
  type ServiceTone,
} from "@/lib/admin/serviceHealthApi";

// 시연·수업 직전에 한 번 누르는 패널. 페이지 진입 시 자동 호출하지 않는다 —
// 백업·복원 때문에도 여는 화면이라, 열 때마다 외부 API를 두드리면 요금과 혼란만 는다.

const SERVICE_META: Record<ServiceId, { name: string; role: string; note?: string; consoleUrl?: string }> = {
  elevenlabs: { name: "ElevenLabs", role: "음성 합성" },
  openai: {
    name: "OpenAI", role: "생성·검수·STT",
    note: "잔액은 API로 확인할 수 없습니다. 콘솔에서 자동 충전을 켜 두세요.",
    consoleUrl: "https://platform.openai.com/settings/organization/billing/overview",
  },
  anthropic: {
    name: "Anthropic", role: "콘텐츠 검토",
    note: "잔액은 API로 확인할 수 없습니다. 콘솔에서 자동 충전을 켜 두세요.",
    consoleUrl: "https://platform.claude.com/dashboard",
  },
  supabase: { name: "Supabase", role: "로그인·데이터" },
  app: { name: "앱 배포", role: "화면 제공" },
};

const TONE: Record<ServiceTone, { label: string; dot: string; text: string }> = {
  ok: { label: "정상", dot: "bg-emerald-500", text: "text-emerald-900" },
  warn: { label: "주의", dot: "bg-amber-500", text: "text-amber-900" },
  fail: { label: "실패", dot: "bg-rose-500", text: "text-rose-900" },
  idle: { label: "미점검", dot: "bg-slate-300", text: "text-muted-foreground" },
};

const formatStamp = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hour = date.getHours();
  const meridiem = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${meridiem} ${hour12}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const StatusRow = ({ status, pending }: { status: ServiceStatus; pending: boolean }) => {
  const meta = SERVICE_META[status.id];
  const tone = TONE[pending ? "idle" : status.tone];
  return (
    <li className="flex gap-3 py-2.5" data-testid={`service-${status.id}`}>
      <span
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${pending ? "animate-pulse" : ""} ${tone.dot}`}
        role="img"
        aria-label={pending ? "점검 중" : tone.label}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-sm font-semibold">{meta.name}</span>
          <span className="text-xs text-muted-foreground">{meta.role}</span>
          <span className={`text-sm ${tone.text}`}>
            {pending ? "점검 중…" : status.summary}
            {!pending && status.tone !== "idle" && typeof status.latencyMs === "number" && (
              <span className="text-muted-foreground"> · {status.latencyMs}ms</span>
            )}
          </span>
        </div>
        {!pending && status.detail && <p className="mt-0.5 text-sm text-muted-foreground">{status.detail}</p>}
        {meta.note && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {meta.note}
            {meta.consoleUrl && (
              <>
                {" "}
                <a className="underline underline-offset-2" href={meta.consoleUrl} target="_blank" rel="noreferrer">
                  콘솔 열기
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </li>
  );
};

export const ServiceHealthPanel = () => {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(IDLE_STATUSES);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const runCheck = async () => {
    setPending(true);
    try {
      const report = await runServiceHealthCheck();
      setStatuses(report.statuses);
      setCheckedAt(report.checkedAt);
    } catch {
      // 개별 서비스의 실패는 위에서 상태로 바뀐다. 여기까지 오면 점검 자체가 못 돈 것이다 —
      // 미점검으로 되돌리지 않고 실패로 표시해 「다시 시도」가 필요함을 보인다.
      setStatuses(IDLE_STATUSES.map((status) => ({ ...status, tone: "fail", summary: "점검을 실행하지 못했습니다 — 다시 시도해 주세요" })));
      setCheckedAt(new Date().toISOString());
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card" aria-labelledby="service-health-title">
      <div className="h-1 bg-primary/15" />
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary/80" aria-hidden="true" />
              <h2 id="service-health-title" className="text-lg font-semibold">외부 서비스 연동 점검</h2>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              시연·수업 전에 연동 상태를 확인합니다. 버튼을 눌렀을 때만 점검하며, 생성·검수·음성 요청은 만들지 않습니다.
            </p>
          </div>
          <Button onClick={runCheck} disabled={pending} variant={checkedAt ? "outline" : "default"}>
            {pending ? "점검 중…" : "지금 점검"}
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {checkedAt ? `마지막 점검 · ${formatStamp(checkedAt)}` : "아직 점검하지 않았습니다"}
        </p>

        <ul className="mt-2 divide-y divide-border">
          {statuses.map((status) => (
            <StatusRow key={status.id} status={status} pending={pending} />
          ))}
        </ul>
      </div>
    </section>
  );
};

export default ServiceHealthPanel;
