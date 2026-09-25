import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import AdminLearners from "./AdminLearners";

const mocks = vi.hoisted(() => ({ order: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: mocks.order }),
        // 학습한 교과목·최근 활동 조회(learner_mission_logs·curriculum_outlines)
        in: () => Promise.resolve({ data: [], error: null }),
        then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => resolve({ data: [], error: null }),
      }),
    }),
  },
}));

vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

beforeEach(() => {
  mocks.order.mockResolvedValue({
    data: [
      {
        id: "profile-a",
        user_id: "user-a",
        full_name: "박정원",
        email: "auraweon7@gmail.com",
        affiliation: "교강사/연구자",
        affiliation_or_status: null,
        language_background: "ko",
        chinese_proficiency_self_report: "advanced",
        chinese_level: "hsk6",
        ti_experience_level: "coursework",
        profile_completed: true,
        approval_status: "approved",
        anonymous_participant_id: "anon-a",
        updated_at: "2026-08-07T12:55:00Z",
        created_at: "2026-08-07T12:00:00Z",
        role: "learner",
      },
      {
        id: "profile-b",
        user_id: "user-b",
        full_name: "임소영",
        email: "learner@example.com",
        affiliation: "대학원생(박사)",
        affiliation_or_status: null,
        language_background: "ko",
        chinese_proficiency_self_report: "intermediate",
        chinese_level: "hsk5",
        ti_experience_level: "none",
        profile_completed: false,
        approval_status: "pending_approval",
        anonymous_participant_id: null,
        updated_at: "2026-08-07T12:55:00Z",
        created_at: "2026-08-07T12:00:00Z",
        role: "learner",
      },
    ],
    error: null,
  });
});

afterEach(cleanup);

describe("학습자 관리 목록", () => {
  it("필터와 내부 메타데이터 대신 학습 배경과 관리 동작을 표시한다", async () => {
    render(<MemoryRouter><AdminLearners /></MemoryRouter>);

    expect(await screen.findByText("박정원")).toBeVisible();
    expect(screen.getByText("교강사/연구자")).toBeVisible();
    expect(screen.getAllByText("한국어")).toHaveLength(2);
    expect(screen.getByText("HSK 6급")).toBeVisible();
    expect(screen.queryByText("학원·대학교에서 관련 수업 수강")).not.toBeInTheDocument(); // 통번역 경험은 상세 창에서만 보인다
    expect(screen.getAllByText("승인 완료").find((node) => node.tagName === "DIV")).toHaveClass("bg-emerald-50");
    expect(screen.queryByText("학습자 목록")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("프로필 완료")).not.toBeInTheDocument();
    expect(screen.queryByText("익명 ID")).not.toBeInTheDocument();

    const learnerCell = screen.getByText("박정원").closest("td");
    expect(learnerCell?.querySelector('[aria-hidden="true"]')).toBeNull();

    const table = screen.getByRole("table");
    expect(table).toHaveClass("table-fixed", "min-w-[920px]");
    expect(Array.from(table.querySelectorAll("col")).map((col) => col.style.width)).toEqual([
      "21%", "14%", "9%", "9%", "17%", "9%", "9%", "12%",
    ]);
    expect(screen.getAllByRole("link", { name: "수행 기록 →" })[0]).toHaveAttribute(
      "href",
      "/admin/decision-traces?q=auraweon7%40gmail.com",
    );
    expect(screen.getByRole("button", { name: "박정원 프로필 보기" })).toHaveTextContent("박정원");
    expect(screen.queryByRole("button", { name: "프로필 보기" })).not.toBeInTheDocument();
  });

  it("상세를 기본 정보·학습 배경·접힌 연구 데이터로 정리한다", async () => {
    render(<MemoryRouter><AdminLearners /></MemoryRouter>);
    expect(await screen.findByText("박정원")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "박정원 프로필 보기" }));
    expect(screen.getByText("기본 정보")).toBeVisible();
    expect(screen.getByText("학습 배경")).toBeVisible();
    expect(screen.queryByText("학습 시작 수준")).not.toBeInTheDocument();
    expect(screen.getByText("연구·데이터 관리")).toBeVisible();
    fireEvent.click(screen.getByText("연구·데이터 관리"));
    expect(screen.getByText("학습 기록 공유 동의")).toBeVisible();
    expect(screen.queryByText(/이전 프로필/)).not.toBeInTheDocument();
    expect(screen.queryByText("역할")).not.toBeInTheDocument();
  });
});
