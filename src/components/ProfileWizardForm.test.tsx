import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileWizardForm, ProfileWizardPreview } from "./ProfileWizardForm";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
  readProfile: vi.fn(),
}));

vi.mock("@/lib/auth/useProfile", () => ({
  useProfile: () => { mocks.readProfile(); return { profile: null, isDevStub: true, refresh: mocks.refresh }; },
  devStubCompleteProfile: mocks.complete,
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("학습자 프로필 입력", () => {
  it("프로필 체험은 인증 조회나 저장 없이 모든 단계를 확인한다", () => {
    const completed = vi.fn();
    render(<ProfileWizardPreview onCompleted={completed} />);
    expect(screen.getByDisplayValue("시연용 학습자")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("radio", { name: "한국어" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("학습 기록 공유")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "체험 마치기" }));
    expect(completed).toHaveBeenCalledOnce();
    expect(mocks.readProfile).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("모든 학습 배경에 응답한 뒤 기록 공유와 연구 활용 여부를 선택하게 한다", async () => {
    render(<ProfileWizardForm />);

    expect(screen.getByText("기본 정보")).toBeVisible();
    expect(screen.getByText("1 / 3")).toBeVisible();
    expect(screen.queryByText("나를 소개해요")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("실명을 입력해 주세요"), {
      target: { value: "김학습" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "대학원생(박사)" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    expect(screen.getByText("2 / 3")).toBeVisible();

    expect(screen.queryByText("학습 시작 수준")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "한국어" }));
    expect(screen.getByText("최근 HSK 급수").parentElement).not.toHaveTextContent("선택");
    expect(screen.getByRole("radio", { name: "HSK 7–9급" })).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "거의 없음" })).not.toBeInTheDocument();

    const next = screen.getByRole("button", { name: "다음" });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "응시 경험 없음" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "수업·시험" }));
    fireEvent.click(screen.getByRole("radio", { name: "없음" }));
    expect(next).toBeEnabled();
    fireEvent.click(next);

    expect(screen.getByText("학습 기록 공유")).toBeVisible();
    expect(screen.getByText(/나의 익명 학습 기록을 통번역 학습 개선/)).toBeVisible();
    expect(screen.getByText(/동의하지 않아도 수업 참여·성적·PRAGMA 이용에 불이익이 없으며/)).toBeVisible();

    const submit = screen.getByRole("button", { name: "학습 시작하기" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /담당 교수자가 나의 학습 기록을 확인/ }));
    fireEvent.click(screen.getByRole("radio", { name: "동의하지 않습니다" }));
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    expect(mocks.complete).toHaveBeenCalledWith("김학습");
  });

  it("중국어 주 사용자는 HSK 대신 TOPIK 급수를 필수로 답한다", () => {
    render(<ProfileWizardForm />);

    fireEvent.change(screen.getByPlaceholderText("실명을 입력해 주세요"), {
      target: { value: "왕학습" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "학부생" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    fireEvent.click(screen.getByRole("radio", { name: "중국어" }));

    expect(screen.getByText("최근 TOPIK 급수")).toBeVisible();
    expect(screen.getByRole("radio", { name: "TOPIK 6급" })).toBeVisible();
    expect(screen.queryByRole("radio", { name: "HSK 6급" })).not.toBeInTheDocument();
    expect(screen.queryByText("학습 시작 수준")).not.toBeInTheDocument();
  });
});
