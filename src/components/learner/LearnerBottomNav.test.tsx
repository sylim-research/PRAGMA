import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LearnerBottomNav } from "@/components/learner/LearnerBottomNav";

describe("LearnerBottomNav", () => {
  it("renders only course and records in the approved order", () => {
    render(<MemoryRouter initialEntries={["/learner/records"]}><LearnerBottomNav /></MemoryRouter>);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent?.trim())).toEqual(["수업", "기록"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/learner/course",
      "/learner/records",
    ]);
    expect(screen.getByRole("link", { name: "기록" })).toHaveClass("text-[#15202B]");
  });
});
