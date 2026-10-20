import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { publicRepresentativeMission } from "@/lib/demo/representativeMission";
import { adaptRunnableMissionToCanonical } from "@/lib/mission/canonicalMissionRuntime";
import { MissionHandoutPage } from "./MissionHandoutPage";

const mission = adaptRunnableMissionToCanonical(publicRepresentativeMission());
const scale = mission.quests.find((quest) => quest.kind === "scale");
const dct = mission.quests.find((quest) => quest.kind === "dct");
// 해설 첫 문장(백틱 표시 전)만으로 찾는다 — 화면에서는 백틱이 굵은 글씨로 바뀐다.
const feedbackHead = scale?.kind === "scale" ? scale.feedback.split("`")[0].trim() : "";

describe("MissionHandoutPage", () => {
  it("문항지는 문항만 담고 기준 판단·해설·참고 표현은 숨긴다", () => {
    render(<MissionHandoutPage missions={[mission]} heading="2주차 요청 화행" />);
    const article = screen.getByRole("article", { name: "미션 1" });
    expect(within(article).getByText("통번역 과제", { exact: false })).toBeInTheDocument();
    expect(within(article).getAllByText(/판단 문항 \d/).length).toBe(5);
    expect(within(article).queryByText("기준 판단")).toBeNull();
    expect(within(article).queryByText("핵심 정리")).toBeNull();
    expect(within(article).queryByText(feedbackHead, { exact: false })).toBeNull();
    if (dct?.kind === "dct") expect(within(article).queryByText(dct.referenceAnswer, { exact: false })).toBeNull();
  });

  it("해설지로 바꾸면 기준 판단·해설·참고 표현과 핵심 정리를 함께 보인다", () => {
    render(<MissionHandoutPage missions={[mission]} heading="2주차 요청 화행" />);
    fireEvent.click(screen.getByRole("radio", { name: "해설지" }));
    const article = screen.getByRole("article", { name: "미션 1" });
    expect(within(article).getAllByText("기준 판단").length).toBeGreaterThan(0);
    expect(within(article).getByText("핵심 정리")).toBeInTheDocument();
    expect(within(article).getAllByText(feedbackHead, { exact: false }).length).toBeGreaterThan(0);
    expect(within(article).queryByText("표현 메모", { exact: false })).toBeNull();
    expect(article.textContent).not.toContain("`");
    if (dct?.kind === "dct") expect(within(article).getAllByText(dct.referenceAnswer, { exact: false }).length).toBeGreaterThan(0);
  });

  it("승인된 미션이 없으면 빈 안내를 보인다", () => {
    render(<MissionHandoutPage missions={[]} heading="3주차" />);
    expect(screen.getByText("이 주차에 인쇄할 수 있는 승인된 미션이 없습니다.")).toBeInTheDocument();
  });
});
