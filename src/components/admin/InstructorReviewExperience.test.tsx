import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { InstructorReviewExperience } from "./InstructorReviewExperience";
import { CanonicalReviewStage } from "@/pages/learner/CanonicalMissionRun";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { SAMPLE_MISSION_V6_REASON_CONTRAST } from "@/lib/mission/missionV6Sample";
import { EXPERIENCE_SECTIONS, experienceComplete, viewModelFromReview } from "@/lib/pragma/instructorExperience";
import { instructionalMission, type ReviewInspection } from "../../../supabase/functions/_shared/contentReview";

const effects = vi.hoisted(() => ({ save: vi.fn(), event: vi.fn(), feedback: vi.fn() }));
vi.mock("@/lib/mission/missionLog", () => ({ saveMissionAttempt: effects.save }));
vi.mock("@/lib/mission/missionEvents", () => ({ appendMissionEvent: effects.event, getOrCreateMissionAttemptId: vi.fn(), rotateMissionAttemptId: vi.fn() }));
vi.mock("@/lib/mission/missionFeedback", () => ({ requestFeedback: effects.feedback }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const inspection = (): ReviewInspection => ({ contentHash: "hash-1", sourceHash: "source-1", run: null, history: [], dependencies: [], models: { openai: "fixture", claude: "fixture" },
  snapshot: { content: { context: { scenario_id: "fixture", speech_act: "request", learner_level: "intermediate" }, mission: instructionalMission(SAMPLE_MISSION_V5_NATIVE) } } });

describe("instructor experience", () => {
  it("renders the saved version using learner components and records a hold without learner effects", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined); const onReady = vi.fn();
    render(<MemoryRouter><InstructorReviewExperience inspection={inspection()} onSave={onSave} onReady={onReady} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /3. 판단하고 고쳐보기/ }));
    fireEvent.click(screen.getByRole("button", { name: "참고 판정·해설 바로 보기" }));
    await screen.findByText("권장 수정안");
    for (const correction of SAMPLE_MISSION_V5_NATIVE.mpj_items[2].corrections) expect(screen.getByText(correction.note_ko)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "✗ 수정 요청" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ decisions: [{ section: "mjt-2", status: "revision_required", note: "" }] })));
    expect(onReady).not.toHaveBeenCalledWith(true);
    expect(effects.save).not.toHaveBeenCalled(); expect(effects.event).not.toHaveBeenCalled(); expect(effects.feedback).not.toHaveBeenCalled();
  });
  it("names v6 sections by their v6 roles, summarizes progress, and drops the duplicate findings box", async () => {
    const v6: ReviewInspection = { ...inspection(), snapshot: { content: { context: { scenario_id: "fixture", speech_act: "request", learner_level: "intermediate" },
      mission: instructionalMission(SAMPLE_MISSION_V6_REASON_CONTRAST) } } };
    render(<MemoryRouter><InstructorReviewExperience inspection={v6} onSave={vi.fn()} onReady={vi.fn()} /></MemoryRouter>);
    const nav = screen.getByRole("navigation", { name: "감수할 장면과 문항" });
    const v6Labels = ["미션 안내", "1. 적절성 판단", "2. 새 장면 판단 · 이유", "3. 선택교정", "4. 자유교정 · 대조", "5. 후보별 적절성 판단", "핵심 정리", "직접 통번역 · DCT"];
    expect(within(nav).getAllByRole("button").map((button) => button.firstElementChild?.textContent)).toEqual(v6Labels);
    for (const old of ["4. 이유 찾기", "5. 여러 초안 비교", "문항별 핵심"]) expect(within(nav).queryByText(old)).not.toBeInTheDocument();
    expect(screen.getByLabelText("감수 진행")).toHaveTextContent("확인 0 · 수정 요청 0 · 미확인 8");
    expect(screen.queryByText(/이 부분의 AI·규칙 문제 항목/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "현재 문항 감수 메모" })).toHaveAttribute("rows", "7");
  });
  it("offers only 확인 and 수정 요청, saves a note typed before judging with the judgment, and keeps legacy 보류 read-only", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const legacy: ReviewInspection = { ...inspection(), run: { instructor_experience: { version: "instructor_experience_v1", active_seconds: 30,
      decisions: [{ section: "mjt-0", status: "defer", note: "예전 메모" }] } } as unknown as ReviewInspection["run"] };
    render(<MemoryRouter><InstructorReviewExperience inspection={legacy} onSave={onSave} onReady={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "보류" })).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "감수할 장면과 문항" });
    expect(within(nav).getByText("보류(기존 기록)")).toBeInTheDocument();
    expect(screen.getByLabelText("감수 진행")).toHaveTextContent("확인 0 · 수정 요청 0 · 미확인 8");
    fireEvent.change(screen.getByRole("textbox", { name: "현재 문항 감수 메모" }), { target: { value: "도입 문구를 줄이면 좋겠습니다." } });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("확인 또는 수정 요청을 누르면 메모가 함께 저장됩니다.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "✗ 수정 요청" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ decisions: [
      { section: "mjt-0", status: "defer", note: "예전 메모" },
      { section: "scene", status: "revision_required", note: "도입 문구를 줄이면 좋겠습니다." },
    ] })));
  });
  it("keeps the fixed v5 section labels", () => {
    render(<MemoryRouter><InstructorReviewExperience inspection={inspection()} onSave={vi.fn()} onReady={vi.fn()} /></MemoryRouter>);
    const nav = screen.getByRole("navigation", { name: "감수할 장면과 문항" });
    expect(within(nav).getAllByRole("button").map((button) => button.firstElementChild?.textContent)).toEqual(EXPERIENCE_SECTIONS.map((item) => item.label));
  });
  it("shows every candidate explanation without requiring a student answer", async () => {
    const model = viewModelFromReview(inspection());
    render(<MemoryRouter><CanonicalReviewStage mission={model} section="mjt-4" revealAnswers onNext={vi.fn()} /></MemoryRouter>);
    for (const candidate of SAMPLE_MISSION_V5_NATIVE.mpj_items[4].candidates) expect(screen.getByText(candidate.note_ko)).toBeInTheDocument();
    expect(effects.save).not.toHaveBeenCalled();
  });
  it("shows v6 MJT3 corrections directly, as the learner runner does", () => {
    const v6: ReviewInspection = { ...inspection(), snapshot: { content: { context: { scenario_id: "fixture", speech_act: "request", learner_level: "intermediate" },
      mission: instructionalMission(SAMPLE_MISSION_V6_REASON_CONTRAST) } } };
    render(<MemoryRouter><CanonicalReviewStage mission={viewModelFromReview(v6)} section="mjt-2" revealAnswers={false} onNext={vi.fn()} /></MemoryRouter>);
    for (const correction of SAMPLE_MISSION_V6_REASON_CONTRAST.mpj_items[2].corrections) expect(screen.getByText(correction.text)).toBeInTheDocument();
    expect(effects.save).not.toHaveBeenCalled();
  });
  it("lets the professor preview change the v6 MJT2 judgment after a reason, as learners can", () => {
    const v6: ReviewInspection = { ...inspection(), snapshot: { content: { context: { scenario_id: "fixture", speech_act: "request", learner_level: "intermediate" },
      mission: instructionalMission(SAMPLE_MISSION_V6_REASON_CONTRAST) } } };
    render(<MemoryRouter><CanonicalReviewStage mission={viewModelFromReview(v6)} section="mjt-1" revealAnswers={false} onNext={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "다소 적절" })); fireEvent.click(screen.getByRole("button", { name: "판단 확정하기" }));
    expect(screen.queryByRole("button", { name: "다소 부적절" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: SAMPLE_MISSION_V6_REASON_CONTRAST.mpj_items[1].reason_choice.options[1].text }));
    fireEvent.click(screen.getByRole("button", { name: "다소 부적절" }));
    fireEvent.click(screen.getByRole("button", { name: "판단과 이유 확인하기" }));
    expect(within(screen.getByRole("button", { name: /다소 부적절/ })).getByText("내 선택")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /다소 적절/ })).queryByText("내 선택")).not.toBeInTheDocument();
  });
  it("opens v6 with a briefing instead of the translation scenario, and shows core hints at every level", () => {
    const v6 = (learner_level: "intermediate" | "advanced"): ReviewInspection => ({ ...inspection(), snapshot: { content: { context: { scenario_id: "fixture", speech_act: "request", learner_level },
      mission: instructionalMission(SAMPLE_MISSION_V6_REASON_CONTRAST) } } });
    const task = SAMPLE_MISSION_V6_REASON_CONTRAST.production_task;
    const { unmount } = render(<MemoryRouter><CanonicalReviewStage mission={viewModelFromReview(v6("intermediate"))} section="scene" revealAnswers={false} onNext={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText(/다섯 문항을 마친 뒤 새로운 상황의 원문을 직접 옮기고/)).toBeInTheDocument();
    expect(screen.queryByText(task.situation_ko)).not.toBeInTheDocument();
    expect(screen.queryByText("상대·관계")).not.toBeInTheDocument();
    unmount();
    for (const level of ["intermediate", "advanced"] as const) {
      const { unmount: close } = render(<MemoryRouter><CanonicalReviewStage mission={viewModelFromReview(v6(level))} section="dct" revealAnswers={false} onNext={vi.fn()} /></MemoryRouter>);
      expect(screen.getByText("단어 힌트 보기")).toBeInTheDocument();
      for (const hint of task.vocabulary_hints!) expect(screen.getByText(hint.target)).toBeInTheDocument();
      close();
    }
  });
  it("continues a v6 DCT preview through feedback, revision and final confirm without AI or saving", async () => {
    const v6: ReviewInspection = { ...inspection(), snapshot: { content: { context: { scenario_id: "fixture", speech_act: "request", learner_level: "intermediate" },
      mission: instructionalMission(SAMPLE_MISSION_V6_REASON_CONTRAST) } } };
    render(<MemoryRouter><CanonicalReviewStage mission={viewModelFromReview(v6)} section="dct" revealAnswers={false} onNext={vi.fn()} /></MemoryRouter>);
    const first = "您好，请问下周三下午三点到四点可以借用研讨室吗？";
    fireEvent.change(screen.getByRole("textbox"), { target: { value: first } });
    fireEvent.click(screen.getByRole("button", { name: /번역 제출하기/ }));
    // Same stage order as the learner runner: feedback → revision → final confirm.
    expect(await screen.findByRole("heading", { name: "번역 피드백" })).toBeInTheDocument();
    expect(screen.getByText("AI 미실행")).toBeInTheDocument();
    expect(screen.getByText(/실제 학습자 화면에서는 이 단계에서 AI 참고 피드백을 받습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "한 번 다듬어보기" }));
    const revised = "您好，我们想在下周三下午三点到四点借用研讨室，请问可以吗？";
    fireEvent.change(screen.getByRole("textbox"), { target: { value: revised } });
    fireEvent.click(screen.getByRole("button", { name: /수정안 확정하기/ }));
    const final = screen.getByRole("region", { name: "최종 확정 미리보기" });
    expect(within(final).getByText(first)).toBeInTheDocument();
    expect(within(final).getByText(revised)).toBeInTheDocument();
    expect(effects.feedback).not.toHaveBeenCalled(); expect(effects.save).not.toHaveBeenCalled(); expect(effects.event).not.toHaveBeenCalled();
  });
  it("keeps all confirmation states incomplete when a hold exists", () => {
    const value = { version: "instructor_experience_v1" as const, active_seconds: 20, decisions: EXPERIENCE_SECTIONS.map(({ id }) => ({ section: id, status: "checked" as const, note: "" })) };
    expect(experienceComplete(value)).toBe(true);
    expect(experienceComplete({ ...value, decisions: value.decisions.slice(1) })).toBe(false);
    expect(experienceComplete({ ...value, decisions: value.decisions.map((entry, index) => index === 0 ? { ...entry, status: "defer" as const } : entry) })).toBe(false);
    expect(experienceComplete({ ...value, decisions: value.decisions.map(() => value.decisions[0]) })).toBe(false);
  });
  it("submits a trial DCT locally and shows references without requesting feedback or saving an attempt", () => {
    const model = viewModelFromReview(inspection());
    render(<MemoryRouter><CanonicalReviewStage mission={model} section="dct" revealAnswers={false} onNext={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "您好，请问您方便的时候可以帮我确认一下这份资料吗？非常感谢您的帮助。" } });
    fireEvent.click(screen.getByRole("button", { name: /번역 제출하기/ }));
    expect(screen.getByText("DCT 참고 표현·해설")).toBeInTheDocument();
    expect(effects.save).not.toHaveBeenCalled(); expect(effects.event).not.toHaveBeenCalled(); expect(effects.feedback).not.toHaveBeenCalled();
  });
  it("retains and exposes an unsaved decision after a save failure", async () => {
    render(<MemoryRouter><InstructorReviewExperience inspection={inspection()} onSave={vi.fn().mockRejectedValue(new Error("保存失敗"))} onReady={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "✗ 수정 요청" }));
    await screen.findByRole("alert");
    expect(screen.getByText("저장하지 않은 감수 기록이 있습니다.")).toBeInTheDocument();
  });
});
