import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminComposer from "./AdminComposer";

const mocks = vi.hoisted(() => ({
  outlines: vi.fn(),
  curriculum: vi.fn(),
  deleteOutline: vi.fn(),
  unpublishOutline: vi.fn(),
}));

vi.mock("@/lib/curriculum/api", () => ({
  listCurriculumOutlines: mocks.outlines,
  getCurriculumOutline: mocks.curriculum,
  deleteCurriculumOutline: mocks.deleteOutline,
  unpublishCurriculumOutline: mocks.unpublishOutline,
  updateCurriculumCompositionAxes: vi.fn(),
}));
vi.mock("@/lib/curriculum/composer", () => ({
  listCoreScenarios: vi.fn(async () => []),
  listWeekAssignments: vi.fn(async () => []),
  saveWeekAssignments: vi.fn(),
}));
vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children, title }: { children: React.ReactNode; title: string }) => <main><h1>{title}</h1>{children}</main>,
}));
vi.mock("@/components/admin/CurriculumSyllabus", () => ({ CurriculumSyllabus: () => null }));
vi.mock("@/components/admin/CurriculumSyllabusSettingsForm", () => ({ CurriculumSyllabusSettingsForm: () => null }));
vi.mock("./CurriculumEditor", () => ({ CurriculumEditor: () => null }));

const outlineRow = (id: string, title: string, status: "draft" | "published") => ({
  id, title, status, level: "intermediate", language_direction: "ko_zh", course_mode: "translation",
  target_interpreting_week_count: 0, target_interpreting_ratio: 0, composition_theme_codes: [],
  domain: "daily", industry: null, midterm_week: 8, final_week: 15, scenarios_per_week: 2, semester_goal: null,
  target_speech_acts: [], week_count: 15, created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
});
const draft = outlineRow("course-draft", "초안 교과목", "draft");
const published = outlineRow("course-published", "공개 교과목", "published");

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.outlines.mockResolvedValue([draft, published]);
  mocks.curriculum.mockImplementation(async (id: string) => ({ outline: id === published.id ? published : draft, weeks: [] }));
  mocks.deleteOutline.mockResolvedValue(undefined);
  mocks.unpublishOutline.mockResolvedValue(undefined);
});
afterEach(cleanup);

const show = (path = "/admin/composer") => render(<MemoryRouter initialEntries={[path]}><AdminComposer /></MemoryRouter>);
const courseSelect = () => screen.getByRole("combobox", { name: "교과목 선택" });
const openSettings = async () => {
  const button = screen.getByRole("button", { name: /교과목 설정/ });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  return screen.getByRole("menu", { name: "교과목 설정" });
};

describe("course planning selection", () => {
  it("selects a course automatically when courses exist and none is chosen", async () => {
    show();
    await waitFor(() => expect(courseSelect()).toHaveValue(draft.id));
    expect(screen.queryByText(/아직 교과목이 없습니다/)).not.toBeInTheDocument();
  });

  it("keeps the course given in the URL over the remembered and first course", async () => {
    window.localStorage.setItem("pragma.admin.composer.lastOutline", draft.id);
    show(`/admin/composer?outline=${published.id}`);
    await waitFor(() => expect(courseSelect()).toHaveValue(published.id));
  });

  it("reopens the course last opened in this browser when the URL has none", async () => {
    window.localStorage.setItem("pragma.admin.composer.lastOutline", published.id);
    show();
    await waitFor(() => expect(courseSelect()).toHaveValue(published.id));
  });

  it("shows the empty state only when there is no course", async () => {
    mocks.outlines.mockResolvedValue([]);
    show();
    expect(await screen.findByText(/아직 교과목이 없습니다/)).toBeInTheDocument();
    expect(courseSelect()).toHaveValue("");
  });
});

describe("course planning danger actions", () => {
  it("keeps delete out of the save actions and inside the settings danger section", async () => {
    show();
    await waitFor(() => expect(courseSelect()).toHaveValue(draft.id));
    const save = screen.getByRole("button", { name: "편성 저장" });
    expect(screen.queryByRole("menuitem", { name: /교과목 삭제/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /교과목 삭제/ })).not.toBeInTheDocument();

    const menu = await openSettings();
    expect(within(menu).getByText("위험 작업")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /교과목 삭제/ })).toBeInTheDocument();
    expect(menu).not.toContainElement(save);
  });

  it("disables delete for a published course and offers unpublish with the same confirmation", async () => {
    show(`/admin/composer?outline=${published.id}`);
    await waitFor(() => expect(courseSelect()).toHaveValue(published.id));
    const menu = await openSettings();
    expect(within(menu).getByRole("menuitem", { name: /교과목 삭제/ })).toBeDisabled();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "학습자에게 비공개로 전환" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("이 교과목을 비공개로 바꾸시겠습니까?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "비공개" }));
    await waitFor(() => expect(mocks.unpublishOutline).toHaveBeenCalledWith(published.id));
    expect(mocks.deleteOutline).not.toHaveBeenCalled();
  });

  it("deletes a draft course only after the confirmation", async () => {
    show();
    await waitFor(() => expect(courseSelect()).toHaveValue(draft.id));
    const menu = await openSettings();
    fireEvent.click(within(menu).getByRole("menuitem", { name: /교과목 삭제/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("이 교과목을 삭제하시겠습니까?")).toBeInTheDocument();
    expect(within(dialog).getByText("되돌릴 수 없습니다.")).toBeInTheDocument();
    expect(mocks.deleteOutline).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mocks.deleteOutline).not.toHaveBeenCalled();

    fireEvent.click(within(await openSettings()).getByRole("menuitem", { name: /교과목 삭제/ }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(mocks.deleteOutline).toHaveBeenCalledWith(draft.id));
  });
});
