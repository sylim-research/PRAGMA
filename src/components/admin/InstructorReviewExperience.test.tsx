import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
