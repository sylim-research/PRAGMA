import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  IDLE_STATUSES,
  isStale,
  readStoredReport,
  runServiceHealthCheck,
  storeReport,
  type ServiceId,
  type ServiceStatus,
  type ServiceTone,
} from "@/lib/admin/serviceHealthApi";

// 시연·수업 직전에 확인하는 연동 상태. 화면 맨 위에 두되 평소에는 한 줄만 차지한다.
//
// - 화면을 열면 마지막 결과를 먼저 보여 주고, 오래됐을 때만 조용히 다시 확인한다.
//   빈 목록으로 시작하면 무엇을 보는 화면인지 알 수 없어 그냥 지나치게 된다.
// - 모두 정상이면 접어 둔다. 매일 보는 운영 지표를 밀어내지 않기 위해서다.
//   대신 정상이 아닌 항목이 하나라도 있으면 스스로 펼쳐 눈에 걸리게 한다.
// - 이 점검이 부르는 것은 잔량 조회와 인증 확인뿐이라 토큰·글자 수를 쓰지 않는다.
// - 각 줄에는 상태만 둔다. 잔액 관리 안내는 목록 아래 한 줄로 모았다 —
//   같은 안내를 행마다 반복하면 상태 목록이 사과문처럼 읽힌다.

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

const NAMES = (statuses: ServiceStatus[], tone: ServiceTone) =>
  statuses.filter((status) => status.tone === tone).map((status) => SERVICE_META[status.id].name);

const formatStamp = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hour = date.getHours();
  const meridiem = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${meridiem} ${hour12}:${String(date.getMinutes()).padStart(2, "0")}`;
};

/**
 * 접힌 줄의 요약.
 *
 * 🔑 「모르는 것」이 「나쁜 것」을 뜻하지 않게 한다. 점검 경로가 없어 판정하지 못한 항목(manual)은
 * 불을 깎지 않는다 — 확인된 문제(fail·warn)가 없으면 초록이다. 대신 문구에는 어느 서비스를 직접
 * 봐야 하는지 남겨 숨기지는 않는다. 실제 문제가 있으면 접혀 있어도 색과 이름으로 드러난다.
 */
const summarizeStatuses = (statuses: ServiceStatus[]) => {
  const failed = NAMES(statuses, "fail");
  if (failed.length > 0) return { tone: "fail" as const, text: `실패 ${failed.length}건 · ${failed.join(" · ")}` };

  const warned = NAMES(statuses, "warn");
  if (warned.length > 0) return { tone: "warn" as const, text: `주의 ${warned.length}건 · ${warned.join(" · ")}` };

  const ok = NAMES(statuses, "ok");
  if (ok.length === 0) return { tone: "idle" as const, text: "아직 점검하지 않았습니다" };

  const manual = NAMES(statuses, "manual");
  if (manual.length > 0) {
    return { tone: "ok" as const, text: `${ok.length}개 정상 · ${manual.join("·")} 직접 확인` };
  }
  return { tone: "ok" as const, text: `${statuses.length}개 서비스 모두 정상` };
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
          {!pending && status.link && (
            <a
              className="text-sm text-muted-foreground underline underline-offset-2"
              href={status.link.href}
              target="_blank"
              rel="noreferrer"
            >
              {status.link.label} ↗
            </a>
          )}
        </div>
        {!pending && status.detail && <p className="mt-0.5 text-xs text-muted-foreground">{status.detail}</p>}
      </div>
    </li>
  );
};

export const ServiceHealthPanel = () => {
  // 첫 그림부터 마지막 결과로 채운다 — 깜빡임 없이 「최근에 이랬다」를 보여 준다.
  const stored = useRef(readStoredReport()).current;
  const [statuses, setStatuses] = useState<ServiceStatus[]>(stored?.statuses ?? IDLE_STATUSES);
  const [checkedAt, setCheckedAt] = useState<string | null>(stored?.checkedAt ?? null);
  const [pending, setPending] = useState(false);
  // 기본은 접어 둔다 — 첫 화면의 주인공은 아래 콘텐츠 수치다. 문제는 접힌 줄의 색과 이름으로 드러난다.
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => summarizeStatuses(statuses), [statuses]);

  const runCheck = async () => {
    setPending(true);
    try {
      const report = await runServiceHealthCheck();
      setStatuses(report.statuses);
      setCheckedAt(report.checkedAt);
      storeReport(report);
    } catch {
      // 개별 서비스의 실패는 위에서 상태로 바뀐다. 여기까지 오면 점검 자체가 못 돈 것이다 —
      // 미점검으로 되돌리지 않고 실패로 표시해 「다시 시도」가 필요함을 보인다.
      setStatuses(IDLE_STATUSES.map((status) => ({ ...status, tone: "fail", summary: "점검을 실행하지 못했습니다 — 다시 시도해 주세요" })));
      setCheckedAt(new Date().toISOString());
    } finally {
      setPending(false);
    }
  };

  // 보관된 결과가 없거나 오래됐으면 화면을 열 때 한 번 다시 확인한다.
  useEffect(() => {
    if (stored && !isStale(stored.checkedAt)) return;
    void runCheck();
    // 첫 그림에서만 판단한다 — 이후 갱신은 버튼으로 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tone = TONE[pending ? "idle" : summary.tone];

  return (
    <section aria-labelledby="service-health-title" className="mt-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-card px-3 py-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${pending ? "animate-pulse" : ""} ${tone.dot}`}
          data-testid="summary-dot"
          aria-hidden="true"
        />
        <h2 id="service-health-title" className="text-sm font-semibold text-[#1B2A36]">
          외부 서비스 연동
        </h2>
        <span className={`text-sm ${tone.text}`}>{pending ? "점검 중…" : summary.text}</span>
        {checkedAt && !pending && (
          <span className="text-xs text-muted-foreground">마지막 점검 · {formatStamp(checkedAt)}</span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground"
            aria-expanded={open}
            aria-controls="service-health-list"
            onClick={() => setOpen(!open)}
          >
            {open ? "접기" : "펼쳐 보기"}
            <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </Button>
          <Button size="sm" variant="outline" className="h-7" onClick={runCheck} disabled={pending}>
            {pending ? "점검 중…" : "지금 점검"}
          </Button>
        </div>
      </div>

      {open && (
        <div id="service-health-list">
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card px-4">
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
        </div>
      )}
    </section>
  );
};

export default ServiceHealthPanel;
