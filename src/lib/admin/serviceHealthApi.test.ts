import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}));

import {
  classifyElevenLabs,
  fetchElevenLabsStatus,
  fetchProviderStatuses,
  runServiceHealthCheck,
} from "./serviceHealthApi";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("classifyElevenLabs", () => {
  it("잔량이 넉넉하면 정상, 수치는 detail에 담는다", () => {
    const status = classifyElevenLabs({ used: 442, limit: 10000, remaining: 9558, tier: "free" }, 412);
    expect(status.tone).toBe("ok");
    expect(status.summary).toBe("정상");
    expect(status.detail).toContain("9,558 / 10,000자");
    expect(status.detail).toContain("95.6%");
    expect(status.latencyMs).toBe(412);
  });

  it("50% 이하는 주의, 20% 이하는 긴급 주의다", () => {
    expect(classifyElevenLabs({ used: 5000, limit: 10000, remaining: 5000 }).summary).toContain("50% 이하");
    expect(classifyElevenLabs({ used: 8500, limit: 10000, remaining: 1500 }).summary).toContain("20% 이하");
  });

  it("수치가 깨져 있으면 잔량 0으로 읽지 않고 주의로 표시한다", () => {
    const status = classifyElevenLabs({ used: Number.NaN, limit: 0, remaining: 0 });
    expect(status.tone).toBe("warn");
    expect(status.summary).toContain("응답을 확인");
  });
});

describe("fetchElevenLabsStatus", () => {
  it("기존 tts?action=usage를 GET으로 부르고 결과를 분류한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ used: 442, limit: 10000, remaining: 9558, tier: "free" }));
    const status = await fetchElevenLabsStatus("token-1", { fetcher, now: () => 0 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/tts?action=usage");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
    expect(status.tone).toBe("ok");
  });

  it("키 미등록(503)은 실패로, 어느 키인지 이름만 보여 준다", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: "…", code: "elevenlabs_key_missing" }, 503));
    const status = await fetchElevenLabsStatus("t", { fetcher });
    expect(status.tone).toBe("fail");
    expect(status.summary).toContain("ELEVENLABS_API_KEY");
  });

  it("권한 부족(usage_unavailable)은 잔량 0이 아니라 권한 문제로 알린다", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ code: "usage_unavailable" }, 502));
    const status = await fetchElevenLabsStatus("t", { fetcher });
    expect(status.tone).toBe("fail");
    expect(status.summary).toContain("읽기 권한");
    expect(status.detail).toBeUndefined();
  });

  it("네트워크 실패는 「응답이 없습니다」로 끝난다 — 오류 본문을 옮기지 않는다", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("secret-ish provider body"));
    const status = await fetchElevenLabsStatus("t", { fetcher });
    expect(status.tone).toBe("fail");
    expect(status.summary).toBe("응답이 없습니다");
    expect(JSON.stringify(status)).not.toContain("secret-ish");
  });
});

describe("fetchProviderStatuses", () => {
  it("service-health 응답을 OpenAI·Anthropic 두 줄로 옮긴다", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      providers: [
        { provider: "openai", code: "ok", httpStatus: 200, latencyMs: 331, models: ["gpt-4o", "gpt-4.1"] },
        { provider: "anthropic", code: "missing_key", httpStatus: null, latencyMs: null, models: ["claude-opus-5"] },
      ],
    }));
    const statuses = await fetchProviderStatuses("t", { fetcher });
    expect(fetcher.mock.calls[0][0]).toContain("/functions/v1/service-health");
    expect(statuses.map((s) => s.id)).toEqual(["openai", "anthropic"]);
    expect(statuses[0]).toMatchObject({ tone: "ok", summary: "정상", detail: "gpt-4o · gpt-4.1", latencyMs: 331 });
    expect(statuses[1].tone).toBe("fail");
    expect(statuses[1].summary).toContain("ANTHROPIC_API_KEY");
    // 키가 죽어 있어도 「무엇을 부르려 했는가」는 보여 준다.
    expect(statuses[1].detail).toBe("claude-opus-5");
  });

  it("인증 실패 코드는 키 재확인으로 안내한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      providers: [
        { provider: "openai", code: "auth_failed", httpStatus: 401, latencyMs: 200 },
        { provider: "anthropic", code: "unreachable", httpStatus: null, latencyMs: 10000 },
      ],
    }));
    const [openai, anthropic] = await fetchProviderStatuses("t", { fetcher });
    expect(openai.summary).toContain("키 인증에 실패");
    expect(anthropic.summary).toBe("응답이 없습니다");
  });

  it("점검 함수에 닿지 못하면 제공자를 실패로 칠하지 않고 콘솔 링크를 준다", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("down"));
    const statuses = await fetchProviderStatuses("t", { fetcher });
    expect(statuses.every((s) => s.tone === "manual")).toBe(true);
    expect(statuses.every((s) => s.tone !== "fail")).toBe(true);
    expect(statuses[0].link?.href).toContain("platform.openai.com");
    expect(statuses[1].link?.href).toContain("platform.claude.com");
  });

  it("함수가 아직 배포되지 않았을 때(404)도 같은 처리다 — 제공자 상태를 우리가 모를 뿐이다", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: "not found" }, 404));
    const statuses = await fetchProviderStatuses("t", { fetcher });
    expect(statuses.map((s) => s.tone)).toEqual(["manual", "manual"]);
    expect(statuses[0].summary).toBe("자동 점검을 쓸 수 없습니다");
    expect(statuses[0].link?.label).toContain("OpenAI 콘솔");
  });

  it("관리자 권한 문제는 우리가 고칠 실제 문제이므로 실패로 남긴다", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: "forbidden" }, 403));
    const statuses = await fetchProviderStatuses("t", { fetcher });
    expect(statuses.every((s) => s.tone === "fail")).toBe(true);
    expect(statuses[0].summary).toContain("관리자 로그인");
  });
});

describe("runServiceHealthCheck", () => {
  it("로그인이 없으면 외부 호출 없이 실패로 채운다", async () => {
    const fetcher = vi.fn();
    const report = await runServiceHealthCheck({ fetcher, token: null });
    expect(fetcher).not.toHaveBeenCalled();
    expect(report.statuses.map((s) => s.id)).toEqual(["elevenlabs", "openai", "anthropic", "supabase", "app"]);
    expect(report.statuses.find((s) => s.id === "supabase")?.tone).toBe("fail");
    expect(report.statuses.find((s) => s.id === "app")?.tone).toBe("ok");
  });

  it("로그인이 있으면 두 호출을 나란히 보내고 다섯 줄을 돌려준다", async () => {
    const fetcher = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(url.includes("service-health")
        ? jsonResponse({ providers: [
            { provider: "openai", code: "ok", httpStatus: 200, latencyMs: 1 },
            { provider: "anthropic", code: "ok", httpStatus: 200, latencyMs: 2 },
          ] })
        : jsonResponse({ used: 0, limit: 10000, remaining: 10000 })));
    const report = await runServiceHealthCheck({ fetcher, token: "t" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(report.statuses.map((s) => s.tone)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(new Date(report.checkedAt).getTime()).not.toBeNaN();
  });
});
