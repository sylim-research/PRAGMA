import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_NAV_GROUPS } from "@/lib/admin/adminNavigation";

// 원자료 분석은 시나리오 생성 화면 안으로 흡수했다(2026-09-09). 예전에는 별도 화면에서
// sessionStorage로 넘겨 생성기가 마운트 때 1회 소비했다. 지금은 같은 화면 안에서
// onApply가 곧바로 생성 조건에 들어간다 — 그 연결이 끊기지 않았는지 본다.
const GENERATOR = readFileSync(
  resolve(process.cwd(), "src/pages/admin/AdminGenerator.tsx"),
  "utf8",
);

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("원자료 후보를 생성 조건으로", () => {
  it("고른 후보가 생성기의 조건 적용 함수로 곧장 들어간다", () => {
    expect(GENERATOR).toContain("<AuthenticImportPanel onApply={applyAuthentic} />");
  });

  it("세션 저장소를 거치는 왕복이 남아 있지 않다", () => {
    expect(GENERATOR).not.toContain("AUTHENTIC_HANDOFF_KEY");
    expect(GENERATOR).not.toContain('from") !== "authentic"');
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    // 옛 주소는 살려 두되 화면이 아니라 생성기로 보낸다.
    expect(app).toContain('path="/admin/authentic" element={<Navigate to="/admin/generator" replace />}');
    expect(app).not.toContain("AdminAuthentic");
  });

  it("사이드바에서 독립 항목이 사라지고 생성기만 남는다", () => {
    const paths = ADMIN_NAV_GROUPS.flatMap((group) => group.items).map((item) => item.to);
    expect(paths).not.toContain("/admin/authentic");
    expect(paths).toContain("/admin/generator");
  });

  it("패널은 기본으로 접혀 있어 생성 화면을 밀어내지 않는다", async () => {
    vi.resetModules();
    const { default: AuthenticImportPanel } = await import("./AuthenticImportPanel");
    render(
      <details>
        <summary>실제 자료에서 시작하기</summary>
        <AuthenticImportPanel onApply={() => {}} />
      </details>,
    );
    const summary = screen.getByText("실제 자료에서 시작하기");
    const wrapper = summary.closest("details");
    expect(wrapper?.open).toBe(false);
    fireEvent.click(summary);
  });
});
