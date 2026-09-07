// 관리자 「외부 서비스 연동 점검」의 데이터 접근 계층.
//
// 시연·수업 전에 버튼 한 번으로 "연결이 살아 있는가"를 답한다. 잔액은 ElevenLabs만 API로 읽을 수
// 있다(OpenAI·Anthropic은 선불 잔액 조회 API가 없다 — 콘솔의 자동 충전 설정이 답이다).
//
// - ElevenLabs: 기존 `tts?action=usage`(PR #97)를 그대로 부른다. 여기서 다시 만들지 않는다.
// - OpenAI·Anthropic: `service-health` 함수가 /v1/models 인증만 확인한다(토큰 소비 0).
// - Supabase·앱 배포: 이 화면이 열려 있고 세션이 있으면 정상이다. 추가 호출을 만들지 않는다.
// - 키·청구 정보·제공자 오류 본문은 어디에서도 화면에 오지 않는다. 정해진 코드만 옮긴다.

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type ServiceId = "elevenlabs" | "openai" | "anthropic" | "supabase" | "app";
export type ServiceTone = "ok" | "warn" | "fail" | "idle";

export type ServiceStatus = {
  id: ServiceId;
  tone: ServiceTone;
  /** 한 줄 요약 — 「정상」, 「키가 등록되지 않았습니다」 등. */
  summary: string;
  /** 잔량 등 부가 정보. 없으면 생략. */
  detail?: string;
  latencyMs?: number | null;
};

export type ServiceHealthReport = { checkedAt: string; statuses: ServiceStatus[] };

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
};

const KEY_NAME: Record<ProviderHealth["provider"], string> = { openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" };

const providerStatus = (health: ProviderHealth): ServiceStatus => {
  const { provider: id, latencyMs } = health;
  switch (health.code) {
    case "ok": return { id, tone: "ok", summary: "정상", latencyMs };
    case "missing_key": return { id, tone: "fail", summary: `${KEY_NAME[id]}가 등록되지 않았습니다`, latencyMs };
    case "auth_failed": return { id, tone: "fail", summary: "키 인증에 실패했습니다 — 키를 다시 확인해 주세요", latencyMs };
    case "unreachable": return { id, tone: "fail", summary: "응답이 없습니다", latencyMs };
    default: return { id, tone: "fail", summary: `제공자 오류 (${health.httpStatus ?? "?"})`, latencyMs };
  }
};

const bothFail = (summary: string): ServiceStatus[] => [
  { id: "openai", tone: "fail", summary },
  { id: "anthropic", tone: "fail", summary },
];

export async function fetchProviderStatuses(token: string, deps: Deps = {}): Promise<ServiceStatus[]> {
  const fetcher = deps.fetcher ?? fetch;
  try {
    const response = await fetcher(`${SUPABASE_URL}/functions/v1/service-health`, {
      method: "GET",
      headers: authHeaders(token),
      signal: timeoutSignal(20_000),
    });
    if (response.status === 401 || response.status === 403) return bothFail("관리자 로그인을 확인해 주세요");
    if (!response.ok) return bothFail(`점검에 실패했습니다 (${response.status})`);
    const payload = (await response.json()) as { providers?: ProviderHealth[] };
    const providers = Array.isArray(payload.providers) ? payload.providers : [];
    const byId = new Map(providers.map((health) => [health.provider, providerStatus(health)]));
    return (["openai", "anthropic"] as const).map(
      (id) => byId.get(id) ?? { id, tone: "fail", summary: "점검 결과가 없습니다" },
    );
  } catch {
    return bothFail("응답이 없습니다");
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
    statuses: [
      elevenlabs,
      ...providers,
      { id: "supabase", tone: "ok", summary: "정상", detail: "로그인 세션이 있습니다" },
      app,
    ],
  };
}
