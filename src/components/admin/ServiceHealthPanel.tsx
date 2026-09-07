import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  IDLE_STATUSES,
  runServiceHealthCheck,
  type ServiceId,
  type ServiceStatus,
  type ServiceTone,
} from "@/lib/admin/serviceHealthApi";

// 시연·수업 직전에 한 번 누르는 점검. 화면 진입 시 자동 호출하지 않는다 —
// 대시보드는 매일 여는 화면이라, 열 때마다 외부 API를 두드리면 요금과 혼란만 는다.
//
// 각 줄에는 상태만 둔다. 잔액을 어떻게 관리하는지는 목록 아래 한 줄로 모았다 —
// 같은 안내를 행마다 반복하면 상태 목록이 사과문처럼 읽힌다.

const SERVICE_META: Record<ServiceId, { name: string; role: string }> = {
  elevenlabs: { name: "ElevenLabs", role: "음성 합성" },
  openai: { name: "OpenAI", role: "생성·검수·STT" },
  anthropic: { name: "Anthropic", role: "콘텐츠 검토" },
  supabase: { name: "Supabase", role: "로그인·데이터" },
  app: { name: "앱 배포", role: "화면 제공" },
};

const TONE: Record<ServiceTone, { label: string; dot: string; text: string }> = {
  ok: { label: "정상", dot: "bg-emerald-500", text: "text-emerald-900" },
  warn: { label: "주의", dot: "bg-amber-500", text: "text-amber-900" },
  fail: { label: "실패", dot: "bg-rose-500", text: "text-rose-900" },
  // 점검 경로가 없는 것은 서비스 이상이 아니다 — 빨간불을 켜지 않는다.
  manual: { label: "직접 확인", dot: "bg-slate-400", text: "text-muted-foreground" },
  idle: { label: "미점검", dot: "bg-slate-300", text: "text-muted-foreground" },
};

const CONSOLES = [
  { label: "OpenAI 콘솔", href: "https://platform.openai.com/settings/organization/billing/overview" },
  { label: "Anthropic 콘솔", href: "https://platform.claude.com/dashboard" },
];

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
    <li className="flex gap-3 py-2" data-testid={`service-${status.id}`}>
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
        {!pending && (status.detail || status.link) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {status.detail}
            {status.detail && status.link && " · "}
            {status.link && (
              <a className="underline underline-offset-2" href={status.link.href} target="_blank" rel="noreferrer">
                {status.link.label} ↗
              </a>
            )}
          </p>
        )}
      </div>
    </li>
  );
};

/**
 * 머리 띠는 운영 대시보드의 `PanelHeader`와 같은 형태로 맞춘다(같은 화면의 다른 절과 한 몸으로 읽히게).
 * 저 컴포넌트는 AdminDashboard 안에 있어 가져다 쓸 수 없으므로 같은 클래스만 되풀이한다.
 */
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
    <section aria-labelledby="service-health-title">
      <div className="mb-2 mt-7 rounded-r-md border-l-4 border-[#D6BE42] bg-[#F3F0E5] px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="service-health-title" className="text-[15px] font-semibold tracking-[-0.01em] text-[#1B2A36]">
            외부 서비스 연동
          </h2>
          <Button size="sm" variant="outline" className="ml-auto h-7" onClick={runCheck} disabled={pending}>
            {pending ? "점검 중…" : "지금 점검"}
          </Button>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {checkedAt
            ? `마지막 점검 · ${formatStamp(checkedAt)}`
            : "시연·수업 전에 눌러 확인합니다. 생성·검수·음성 요청은 만들지 않습니다."}
        </p>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border bg-card px-4">
        {statuses.map((status) => (
          <StatusRow key={status.id} status={status} pending={pending} />
        ))}
      </ul>

      <p className="mt-2 text-[11px] text-muted-foreground">
        OpenAI·Anthropic 선불 잔액은 콘솔의 자동 충전으로 관리합니다 ·{" "}
        {CONSOLES.map((item, index) => (
          <span key={item.href}>
            {index > 0 && " · "}
            <a className="underline underline-offset-2" href={item.href} target="_blank" rel="noreferrer">
              {item.label}
            </a>
          </span>
        ))}
      </p>
    </section>
  );
};

export default ServiceHealthPanel;
