import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ADMIN_NAV_GROUPS } from "@/lib/admin/adminNavigation";

// 원자료 분석은 보관함을 갖춘 별도 화면이다(2026-09-09 오후). 오전에 생성기 안 접이식
// 패널로 흡수했다가 되돌렸다 — 문제는 화면 위치가 아니라 분석 결과가 저장되지 않고
// 사라지는 것이었고, 그건 보관함으로 고쳤다.
//
// 여기서 지키는 것은 두 가지다. ① 분리했다고 해서 옛 sessionStorage 왕복이 돌아오지
// 않는다(저장되지 않는 경로가 다시 생기면 같은 문제가 반복된다). ② 고르지 않은 후보도
// 남도록 분석 결과 전체가 보관된다.
const GENERATOR = readFileSync(
  resolve(process.cwd(), "src/pages/admin/AdminGenerator.tsx"),
  "utf8",
);
const SCREEN = readFileSync(
  resolve(process.cwd(), "src/pages/admin/AdminAuthentic.tsx"),
  "utf8",
);
const PANEL = readFileSync(
  resolve(process.cwd(), "src/pages/admin/AuthenticImportPanel.tsx"),
  "utf8",
);

describe("실제 자료 활용 분석 화면", () => {
  it("생성기는 패널을 품지 않고 넘어온 후보만 받는다", () => {
    expect(GENERATOR).not.toContain("<AuthenticImportPanel");
    // 보관된 후보는 id로 읽는다 — 새로고침해도 살아 있다.
    expect(GENERATOR).toContain('searchParams.get("candidateId")');
    expect(GENERATOR).toContain("storedCandidateToApply");
    // 조건 주입 경로 자체는 그대로다.
    expect(GENERATOR).toContain("applyAuthentic");
  });

  it("세션 저장소 왕복은 되살아나지 않았다", () => {
    expect(GENERATOR).not.toContain("AUTHENTIC_HANDOFF_KEY");
    expect(PANEL).not.toContain("AUTHENTIC_HANDOFF_KEY");
    // 주석에 남은 경위 설명은 걸리지 않게 실제 호출만 본다.
    expect(GENERATOR).not.toMatch(/sessionStorage\s*[.[]/);
    expect(SCREEN).not.toMatch(/sessionStorage\s*[.[]/);
  });

  it("분석이 끝나면 고르지 않은 후보까지 통째로 보관한다", () => {
    // 패널은 분석 직후 후보 전체를 호스트에 넘기고, 호스트가 저장한다.
    expect(PANEL).toContain("onAnalyzed?.({");
    expect(SCREEN).toContain("saveAuthenticAnalysis");
    // 카드를 눌러야만 저장하는 구조가 아니어야 한다 — 안 누른 후보가 사라지지 않게.
    expect(SCREEN).toContain("onAnalyzed={handleAnalyzed}");
  });

  it("억지 화행화 금지 원칙은 그대로다", () => {
    // 참고 표현 후보에 시나리오 버튼은 없으며 보관함에는 남는다.
    expect(PANEL).toContain("참고만 · 독립 미션으로 만들지 않음");
    expect(SCREEN).toContain("canMakeScenarioFromAuthentic(c.usage_type, c.source_text)");
  });

  it("사이드바와 라우트가 화면을 가리킨다", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('path="/admin/authentic" element={<RequireAdmin><AdminAuthentic />');
    const paths = ADMIN_NAV_GROUPS.flatMap((group) => group.items).map((item) => item.to);
    expect(paths).toContain("/admin/authentic");
    expect(paths).toContain("/admin/generator");
  });
});
