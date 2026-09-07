// 관리자 「외부 서비스 연동 점검」의 데이터 접근 계층.
//
// 시연·수업 전에 버튼 한 번으로 "연결이 살아 있는가"를 답한다. 잔액은 ElevenLabs만 API로 읽을 수
// 있다(OpenAI·Anthropic은 선불 잔액 조회 API가 없다 — 콘솔의 자동 충전 설정이 답이다).
//
// - ElevenLabs: 기존 `tts?action=usage`(PR #97)를 그대로 부른다. 여기서 다시 만들지 않는다.
// - OpenAI·Anthropic: `service-health` 함수가 /v1/models 인증만 확인한다(토큰 소비 0).
//   설정된 모델명도 함께 받아 화면에 보인다 — 「키가 산다」보다 「이 키로 이 모델을 부른다」가 더 쓸모 있다.
// - Supabase·앱 배포: 이 화면이 열려 있고 세션이 있으면 정상이다. 추가 호출을 만들지 않는다.
// - 키·청구 정보·제공자 오류 본문은 어디에서도 화면에 오지 않는다. 정해진 코드만 옮긴다.

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type ServiceId = "elevenlabs" | "openai" | "anthropic" | "supabase" | "app";
// manual = 우리 쪽 자동 점검 경로가 없어 판정을 못 한 상태. 서비스가 죽었다는 뜻이 아니므로
// 빨간불을 켜지 않고, 사람이 직접 볼 수 있는 콘솔 링크를 준다.
export type ServiceTone = "ok" | "warn" | "fail" | "manual" | "idle";

export type ServiceStatus = {
  id: ServiceId;
  tone: ServiceTone;
  /** 한 줄 요약 — 「정상」, 「키가 등록되지 않았습니다」 등. */
  summary: string;
  /** 잔량 등 부가 정보. 없으면 생략. */
  detail?: string;
  latencyMs?: number | null;
  /** 자동 판정을 못 했을 때 사람이 직접 확인할 곳. */
  link?: { label: string; href: string };
};

export type ServiceHealthReport = {
  checkedAt: string;
  statuses: ServiceStatus[];
  /** 관리자 세션이 있는 상태에서 얻은 결과인가. 없이 얻은 결과는 「로그인 필요」뿐이라 보관할 가치가 없다. */
  authenticated: boolean;
};

// 마지막 점검 결과를 이 브라우저에 남긴다. 화면을 열자마자 빈 상태가 아니라 「최근에 이랬다」를
// 보여 주기 위해서다(빈 목록은 무엇을 보는 화면인지 알려 주지 못한다).
const STORE_KEY = "pragma.admin.serviceHealth.v1";
/** 이보다 오래된 결과는 화면을 열 때 조용히 다시 확인한다. */
export const STALE_AFTER_MS = 30 * 60 * 1000;

export function readStoredReport(): ServiceHealthReport | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ServiceHealthReport>;
    if (typeof parsed?.checkedAt !== "string" || !Array.isArray(parsed.statuses) || parsed.statuses.length === 0) return null;
    if (Number.isNaN(new Date(parsed.checkedAt).getTime())) return null;
    // 로그인 전에 돈 결과(또는 이 필드가 없던 옛 형식)는 「관리자 로그인이 필요합니다」 다섯 줄이다.
    // 그것을 로그인 뒤에도 보여 주면 멀쩡한 시스템이 죽은 것처럼 보인다 — 없는 것으로 보고 다시 확인한다.
    if (parsed.authenticated !== true) return null;
    return parsed as ServiceHealthReport;
  } catch {
    // 사생활 보호 모드 등에서 접근이 막힐 수 있다 — 없는 것으로 본다.
    return null;
  }
}

export function storeReport(report: ServiceHealthReport): void {
  if (!report.authenticated) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(report));
  } catch {
    // 보관은 편의 기능이다. 실패해도 점검 자체는 그대로 동작한다.
  }
}

export const isStale = (checkedAt: string, now = Date.now()): boolean => {
  const stamp = new Date(checkedAt).getTime();
  return Number.isNaN(stamp) || now - stamp > STALE_AFTER_MS;
};

export type ElevenLabsUsage = {
  used: number;
  limit: number;
  remaining: number;
  tier?: string | null;
  resetsAt?: number | null;
};

/** docs/operations/TTS_CREDIT_MONITOR.md의 기준을 그대로 쓴다. */
export const ELEVENLABS_WARN_RATIO = 0.5;
export const ELEVENLABS_URGENT_RATIO = 0.2;

type Deps = {
  fetcher?: typeof fetch;
  /** 테스트용. 지정하면 세션 조회를 건너뛴다(null = 로그인 없음). */
  token?: string | null;
  now?: () => number;
};

const idle = (id: ServiceId): ServiceStatus => ({ id, tone: "idle", summary: "미점검" });

/** jsdom 등 AbortSignal.timeout이 없는 환경에서는 신호 없이 보낸다(브라우저는 모두 지원). */
const timeoutSignal = (ms: number): AbortSignal | undefined =>
  typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(ms) : undefined;
export const IDLE_STATUSES: ServiceStatus[] = (["elevenlabs", "openai", "anthropic", "supabase", "app"] as ServiceId[]).map(idle);

const formatResetDate = (unix: number | null | undefined) => {
  if (!unix || !Number.isFinite(unix)) return null;
  const date = new Date(unix * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getMonth() + 1}/${date.getDate()} 갱신`;
};

/** 잔량 수치를 화면 상태로 바꾼다. 순수 함수 — 테스트에서 직접 부른다. */
export function classifyElevenLabs(usage: ElevenLabsUsage, latencyMs: number | null = null): ServiceStatus {
  const { used, limit, remaining } = usage;
  if (![used, limit, remaining].every(Number.isFinite) || limit <= 0 || used < 0) {
    return { id: "elevenlabs", tone: "warn", summary: "잔량 응답을 확인해 주세요", latencyMs };
  }
  const ratio = remaining / limit;
  const percent = Math.round(ratio * 1000) / 10;
  const parts = [
    `잔량 ${remaining.toLocaleString()} / ${limit.toLocaleString()}자 (${percent}%)`,
    usage.tier ? `${usage.tier}` : null,
    formatResetDate(usage.resetsAt),
  ].filter(Boolean);
  const detail = parts.join(" · ");
  if (ratio <= ELEVENLABS_URGENT_RATIO) {
    return { id: "elevenlabs", tone: "warn", summary: "잔량 20% 이하 — 긴급 확인", detail, latencyMs };
  }
  if (ratio <= ELEVENLABS_WARN_RATIO) {
    return { id: "elevenlabs", tone: "warn", summary: "잔량 50% 이하 — 수업 예정 사용량과 비교해 주세요", detail, latencyMs };
  }
  return { id: "elevenlabs", tone: "ok", summary: "정상", detail, latencyMs };
}

async function resolveToken(deps: Deps): Promise<string | null> {
  if (deps.token !== undefined) return deps.token;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY });

/** 제공자 오류 본문은 옮기지 않는다 — 코드만 읽는다. */
const readCode = async (response: Response): Promise<string | null> => {
  try {
    const payload = (await response.json()) as { code?: unknown };
    return typeof payload.code === "string" ? payload.code : null;
  } catch {
    return null;
  }
};

export async function fetchElevenLabsStatus(token: string, deps: Deps = {}): Promise<ServiceStatus> {
  const fetcher = deps.fetcher ?? fetch;
  const now = deps.now ?? Date.now;
  const started = now();
  try {
    const response = await fetcher(`${SUPABASE_URL}/functions/v1/tts?action=usage`, {
      method: "GET",
      headers: authHeaders(token),
      signal: timeoutSignal(15_000),
    });
    const latencyMs = now() - started;
    if (response.ok) {
      const usage = (await response.json()) as ElevenLabsUsage;
      return classifyElevenLabs(usage, latencyMs);
    }
    if (response.status === 401 || response.status === 403) {
      return { id: "elevenlabs", tone: "fail", summary: "관리자 로그인을 확인해 주세요", latencyMs };
    }
    const code = await readCode(response);
    if (code === "elevenlabs_key_missing") return { id: "elevenlabs", tone: "fail", summary: "ELEVENLABS_API_KEY가 등록되지 않았습니다", latencyMs };
    if (code === "usage_unavailable") return { id: "elevenlabs", tone: "fail", summary: "키의 User 읽기 권한을 확인해 주세요", latencyMs };
    if (code === "usage_invalid") return { id: "elevenlabs", tone: "warn", summary: "잔량 응답을 확인해 주세요", latencyMs };
    return { id: "elevenlabs", tone: "fail", summary: `점검에 실패했습니다 (${response.status})`, latencyMs };
  } catch {
    return { id: "elevenlabs", tone: "fail", summary: "응답이 없습니다", latencyMs: now() - started };
  }
}

type ProviderHealth = {
  provider: "openai" | "anthropic";
  code: "ok" | "missing_key" | "auth_failed" | "unreachable" | "provider_error";
  httpStatus: number | null;
  latencyMs: number | null;
  models?: string[];
};

const KEY_NAME: Record<ProviderHealth["provider"], string> = { openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" };

export const PROVIDER_CONSOLE: Record<ProviderHealth["provider"], { label: string; href: string }> = {
  openai: { label: "OpenAI 콘솔에서 확인", href: "https://platform.openai.com/settings/organization/billing/overview" },
  anthropic: { label: "Anthropic 콘솔에서 확인", href: "https://platform.claude.com/dashboard" },
};

const providerStatus = (health: ProviderHealth): ServiceStatus => {
  const { provider: id, latencyMs } = health;
  // 설정된 모델은 상태와 무관하게 보여 준다 — 키가 죽어 있을 때도 「무엇을 부르려 했는가」는 유효한 정보다.
  const models = Array.isArray(health.models) ? health.models.filter((name) => typeof name === "string" && name) : [];
  const detail = models.length > 0 ? models.join(" · ") : undefined;
  switch (health.code) {
    case "ok": return { id, tone: "ok", summary: "정상", detail, latencyMs };
    case "missing_key": return { id, tone: "fail", summary: `${KEY_NAME[id]}가 등록되지 않았습니다`, detail, latencyMs };
    case "auth_failed": return { id, tone: "fail", summary: "키 인증에 실패했습니다 — 키를 다시 확인해 주세요", detail, latencyMs };
    case "unreachable": return { id, tone: "fail", summary: "응답이 없습니다", detail, latencyMs };
    default: return { id, tone: "fail", summary: `제공자 오류 (${health.httpStatus ?? "?"})`, detail, latencyMs };
  }
};

const bothFail = (summary: string): ServiceStatus[] => [
  { id: "openai", tone: "fail", summary },
  { id: "anthropic", tone: "fail", summary },
];

/**
 * 점검 함수 자체에 닿지 못했을 때. 제공자의 상태는 우리가 모르는 것이지 나쁜 것이 아니다 —
 * 실패로 칠하지 않고 직접 볼 곳을 준다(예: service-health 배포 전).
 */
const bothManual = (): ServiceStatus[] =>
  (["openai", "anthropic"] as const).map((id) => ({
    // 문장으로 사정을 설명하지 않는다 — 할 수 있는 일(콘솔에서 보기)만 남긴다.
    id, tone: "manual" as const, summary: "", link: PROVIDER_CONSOLE[id],
  }));

export async function fetchProviderStatuses(token: string, deps: Deps = {}): Promise<ServiceStatus[]> {
  const fetcher = deps.fetcher ?? fetch;
  try {
    const response = await fetcher(`${SUPABASE_URL}/functions/v1/service-health`, {
      method: "GET",
      headers: authHeaders(token),
      signal: timeoutSignal(20_000),
    });
    // 권한 문제는 우리가 고칠 수 있는 실제 문제다 — 이것만 빨간불.
    if (response.status === 401 || response.status === 403) return bothFail("관리자 로그인을 확인해 주세요");
    // 그 밖의 응답(미배포 404 포함)은 「제공자가 죽었다」가 아니라 「우리가 못 물어봤다」이다.
    if (!response.ok) return bothManual();
    const payload = (await response.json()) as { providers?: ProviderHealth[] };
    const providers = Array.isArray(payload.providers) ? payload.providers : [];
    const byId = new Map(providers.map((health) => [health.provider, providerStatus(health)]));
    return (["openai", "anthropic"] as const).map(
      (id) => byId.get(id) ?? { id, tone: "fail", summary: "점검 결과가 없습니다" },
    );
  } catch {
    return bothManual();
  }
}

/** 버튼 한 번 = 이 함수 한 번. 페이지 진입 시 자동으로 부르지 않는다. */
export async function runServiceHealthCheck(deps: Deps = {}): Promise<ServiceHealthReport> {
  const token = await resolveToken(deps);
  const app: ServiceStatus = { id: "app", tone: "ok", summary: "정상", detail: "이 화면이 열려 있습니다" };
  if (!token) {
    const summary = "관리자 로그인이 필요합니다";
    return {
      checkedAt: new Date().toISOString(),
      authenticated: false,
      statuses: [
        { id: "elevenlabs", tone: "fail", summary },
        ...bothFail(summary),
        { id: "supabase", tone: "fail", summary: "로그인 세션이 없습니다" },
        app,
      ],
    };
  }
  const [elevenlabs, providers] = await Promise.all([
    fetchElevenLabsStatus(token, deps),
    fetchProviderStatuses(token, deps),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    authenticated: true,
    statuses: [
      elevenlabs,
      ...providers,
      { id: "supabase", tone: "ok", summary: "정상", detail: "로그인 세션이 있습니다" },
      app,
    ],
  };
}
