import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  VIRTUAL_RESPONSE_COUNTS,
  VIRTUAL_RESPONSE_TOTAL,
} from "@/lib/demo/virtualClassResponseFixture";
import VirtualResponseDiscussionDemo from "./VirtualResponseDiscussionDemo";

describe("가상 응답 토론 시연", () => {
  it("fixture는 20건이고 표시 비율의 합은 100%다", () => {
    expect(VIRTUAL_RESPONSE_TOTAL).toBe(20);
    expect(VIRTUAL_RESPONSE_COUNTS.map((c) => c.count)).toEqual([3, 7, 8, 2]);
    const shares = VIRTUAL_RESPONSE_COUNTS.map((c) => Math.round((c.count / VIRTUAL_RESPONSE_TOTAL) * 100));
    expect(shares).toEqual([15, 35, 40, 10]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("그림 안에 가상 자료 문구·상황·판단 대상·척도 순서의 건수와 비율·질문 세 개를 보인다", () => {
    render(<VirtualResponseDiscussionDemo />);
    const figure = screen.getByTestId("virtual-response-figure");
    const inFigure = within(figure);
    expect(inFigure.getByText("가상 응답을 이용한 학급 토론 예시")).toBeInTheDocument();
    expect(inFigure.getByText("연구자가 구성한 가상 응답 20건 · 실제 학습자 자료 아님")).toBeInTheDocument();
    expect(inFigure.getByText("把最终版PPT发到群里吧。")).toBeInTheDocument();
    expect(inFigure.getByText("최종 PPT 단톡방에 올려줘.")).toBeInTheDocument();

    const rows = inFigure.getAllByRole("listitem").filter((li) => /건$/.test(li.textContent ?? ""));
    expect(rows.map((li) => li.textContent)).toEqual([
      "매우 적절15%3건", "다소 적절35%7건", "다소 부적절40%8건", "매우 부적절10%2건",
    ]);
    expect(inFigure.getByText(/같은 표현을 적절하거나 부적절하다고 판단한 근거는 무엇인가/)).toBeInTheDocument();
    expect(inFigure.getByText(/관계·부담·선행 맥락 중 어떤 단서에 주목했는가/)).toBeInTheDocument();
    expect(inFigure.getByText(/원문의 의미와 화행 목적을 유지하면서 어떻게 조정할 수 있는가/)).toBeInTheDocument();

    // 운영 대시보드의 집계 요약·문항 선택 줄과 정답 표시는 없다.
    expect(inFigure.queryByText("집계 학습자")).not.toBeInTheDocument();
    expect(inFigure.queryByRole("group", { name: "판단 문항 선택" })).not.toBeInTheDocument();
    expect(inFigure.queryByText(/정답$/)).not.toBeInTheDocument();
  });
});
