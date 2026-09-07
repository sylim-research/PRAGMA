import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mission/missionStt", () => ({
  requestSttTranscript: vi.fn(),
}));
vi.mock("@/lib/tts", () => ({
  requestTtsAudio: vi.fn(),
}));

import { requestSttTranscript } from "@/lib/mission/missionStt";
import { requestTtsAudio } from "@/lib/tts";
import { InterpretingConsole } from "@/components/mission/InterpretingConsole";

class FakeMediaRecorder {
  mimeType = "audio/webm";
  state: RecordingState = "inactive";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

describe("InterpretingConsole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:audio") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("Audio", class {
      currentTime = 0;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      pause = vi.fn();
      play = vi.fn().mockResolvedValue(undefined);
    });
  });

  it("maps zh_ko to Chinese listening and Korean recording without exposing source text", () => {
    render(
      <InterpretingConsole
        sourceText="方便的话，请把修改意见发给我。"
        sourceLanguage={{ code: "zh", label: "중국어" }}
        targetLanguage={{ code: "ko", label: "한국어" }}
        learnerLevel="advanced"
        replayLimit={2}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByText("① 원발화 듣기 (중국어)")).toBeInTheDocument();
    expect(screen.getByText("② 통역 녹음 (한국어)")).toBeInTheDocument();
    expect(screen.getByText("최대 2회")).toBeInTheDocument();
    expect(screen.queryByText("方便的话，请把修改意见发给我。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "확인한 전사로 제출" })).toBeDisabled();
  });

  it("plays Chinese TTS, transcribes Korean speech, and submits only the confirmed transcript", async () => {
    vi.mocked(requestTtsAudio).mockResolvedValue({
      ok: true,
      blob: new Blob(["source"], { type: "audio/mpeg" }),
      requestedVoiceId: "zh-test",
      usedVoiceId: "zh-test",
      fallbackUsed: false,
    });
    vi.mocked(requestSttTranscript).mockResolvedValue({
      ok: true,
      text: "가능하시면 수정 의견을 보내 주세요.",
      provenance: { provider: "openai", model: "gpt-4o-transcribe", language: "ko" },
    });
    const onSubmit = vi.fn();

    render(
      <InterpretingConsole
        sourceText="方便的话，请把修改意见发给我。"
        sourceLanguage={{ code: "zh", label: "중국어" }}
        targetLanguage={{ code: "ko", label: "한국어" }}
        learnerLevel="advanced"
        replayLimit={2}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "원발화 재생" }));
    await waitFor(() => expect(requestTtsAudio).toHaveBeenCalledWith(expect.objectContaining({
      text: "方便的话，请把修改意见发给我。",
      lang: "zh",
      level: "advanced",
    })));

    fireEvent.click(screen.getByRole("button", { name: "● 녹음 시작" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "■ 녹음 정지" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "■ 녹음 정지" }));

    await waitFor(() => expect(requestSttTranscript).toHaveBeenCalledWith(expect.any(Blob), "ko"));
    expect(await screen.findByDisplayValue("가능하시면 수정 의견을 보내 주세요.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "말한 내용과 같아요" }));
    fireEvent.click(screen.getByRole("button", { name: "확인한 전사로 제출" }));
    expect(onSubmit).toHaveBeenCalledWith("가능하시면 수정 의견을 보내 주세요.");
  });
});
