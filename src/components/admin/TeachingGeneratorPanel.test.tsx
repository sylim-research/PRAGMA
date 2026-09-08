import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeachingGeneratorPanel } from "./TeachingGeneratorPanel";
import { MemoryRouter } from "react-router-dom";
import type { LearnerCourse, LearnerCourseWeek } from "@/lib/curriculum/learnerCourse";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/curriculum/teachingGenerationApi", () => ({ teachingRequest: mocks.request }));
const week = (weekNo: number): LearnerCourseWeek => ({ week_no: weekNo, title: "수업", type: "regular", can_do: ["근거 설명"],
  speech_act: weekNo === 7 || weekNo === 14 ? null : "request", channel: null, pdr_power: null, pdr_distance: null,
  pdr_imposition: null, review_released: false, competency_focus: null, domain: null,
  scenarios: weekNo === 7 || weekNo === 14 ? [] : ["translation", "stt_interpreting"].map((mode, i) => ({ scenario_id: `m${weekNo}-${i}`,
    situation_ko: `${weekNo}주차 상황 ${i}`, target_feature: null, mission_status: "reviewed", mode: mode as "translation" | "stt_interpreting", runnable: true })),
});
const course = { outline: { id: "course" }, weeks: [week(2),week(6),week(7),week(9),week(14)] } as LearnerCourse;
const preview = { system: "시스템 프롬프트", user: "원문", inputHash: "preview-hash", sourceHash: "source", model: "test", promptVersion: "v1", characters: 123,
  sources: [{ id: "M1",label: "2주차 미션",characters: 50 }] };
const onSaved = vi.fn();
function mount(weekNo = 7, overrides: Record<string, unknown> = {}) {
  return render(<TeachingGeneratorPanel course={course} week={week(weekNo)} state={{ draft: null,current:true }} loading={false} loadError={false}
    onSaved={onSaved} onReload={vi.fn()} onReview={vi.fn()} {...overrides} />, { wrapper: MemoryRouter });
}
beforeEach(() => { vi.clearAllMocks(); mocks.request.mockResolvedValue(preview); });
afterEach(cleanup);
describe("교수자 자료 생성 흐름", () => {
  it("requires preview before generation and sends its exact input binding", async () => {
    mount(); expect(mocks.request).not.toHaveBeenCalled();
    expect(screen.queryByRole("button",{name:"초안 생성"})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"생성 내용 확인"}));
    await screen.findByRole("button",{name:"초안 생성"});
    expect(mocks.request).toHaveBeenLastCalledWith(expect.objectContaining({ action:"preview",weekNo:7,expectedRevision:0,
      config:{ missionIds:["m2-0","m2-1"],extraText:"",extraRef:"" } }));
    mocks.request.mockResolvedValue({ draft:null,current:true });
    fireEvent.click(screen.getByRole("button",{name:"초안 생성"}));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mocks.request).toHaveBeenLastCalledWith(expect.objectContaining({ action:"generate",inputHash:"preview-hash" }));
  });
  it("week 7 cannot select future sources and editing input discards the preview", async () => {
    mount();
    expect(screen.queryByText("9주차 상황 0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"생성 내용 확인"}));
    await screen.findByRole("button",{name:"초안 생성"});
    fireEvent.change(screen.getByLabelText("추가 원자료 본문 · 선택"),{ target:{value:"확인한 원문"} });
    expect(screen.queryByRole("button",{name:"초안 생성"})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"생성 내용 확인"})).toBeDisabled();
    fireEvent.change(screen.getByLabelText("추가 원자료 출처 · 선택"),{ target:{value:"자료 출처"} });
    expect(screen.getByRole("button",{name:"생성 내용 확인"})).toBeEnabled();
  });
  it("blocks unavailable storage, incomplete lessons and unsupported assessment weeks", () => {
    const { unmount } = mount(2,{loadError:true});
    expect(screen.getByRole("button",{name:"생성 내용 확인"})).toBeDisabled(); unmount();
    const partial = week(2); partial.scenarios.pop();
    const second = mount(2,{week:partial});
    expect(screen.getByRole("button",{name:"생성 내용 확인"})).toBeDisabled(); second.unmount();
    mount(8,{week:{...week(8),type:"midterm"}});
    expect(screen.queryByRole("region",{name:"수업자료 생성"})).not.toBeInTheDocument();
  });
  it("preserves the previous saved state on model failure and never retries automatically", async () => {
    mount(); fireEvent.click(screen.getByRole("button",{name:"생성 내용 확인"}));
    await screen.findByRole("button",{name:"초안 생성"});
    mocks.request.mockRejectedValue(new Error("모델 호출 실패"));
    fireEvent.click(screen.getByRole("button",{name:"초안 생성"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("모델 호출 실패");
    expect(onSaved).not.toHaveBeenCalled(); expect(mocks.request).toHaveBeenCalledTimes(2);
  });
  it("discards a confirmed preview when refreshed source state becomes stale", async () => {
    const view = mount();
    fireEvent.click(screen.getByRole("button",{name:"생성 내용 확인"}));
    await screen.findByRole("button",{name:"초안 생성"});
    view.rerender(<TeachingGeneratorPanel course={course} week={week(7)} state={{draft:null,current:false}}
      loading={false} loadError={false} onSaved={onSaved} onReload={vi.fn()} onReview={vi.fn()} />);
    expect(screen.queryByRole("button",{name:"초안 생성"})).not.toBeInTheDocument();
  });
  it("restores saved source settings and drops missions no longer in the course scope", async () => {
    mount(7,{state:{draft:{revision:2,source_config:{missionIds:["m6-0","removed"],extraText:"저장한 원문",extraRef:"저장한 출처"}},current:false}});
    expect(screen.getByLabelText("추가 원자료 본문 · 선택")).toHaveValue("저장한 원문");
    fireEvent.click(screen.getByRole("button",{name:"생성 내용 확인"}));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({expectedRevision:2,
      config:{missionIds:["m6-0"],extraText:"저장한 원문",extraRef:"저장한 출처"}})));
  });
});
