import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import audioManifest from "../../../public/demo-audio/manifest.json";

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

  it.each(audioManifest.recordings)("plays the recorded $language demo at reduced volume without requesting synthesis", async (entry) => {
    const audio = { currentTime: 0, volume: 1, playbackRate: 1, onended: null as null | (() => void),
      onerror: null, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) };
    const AudioMock = vi.fn(function () { return audio; });
    vi.stubGlobal("Audio", AudioMock);
    const language = entry.language as "ko" | "zh";
    const { unmount } = render(<InterpretingConsole
      sourceText={entry.sourceText} sourceLanguage={{ code: language, label: language }}
      targetLanguage={{ code: language === "ko" ? "zh" : "ko", label: "target" }}
      demoMode onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "원발화 재생" }));
    await waitFor(() => expect(screen.getByText("남은 재생 1회")).toBeInTheDocument());
    expect(AudioMock).toHaveBeenCalledWith(entry.src);
    expect(audio.volume).toBe(0.85);
    expect(audio.playbackRate).toBe(1);
    expect(requestTtsAudio).not.toHaveBeenCalled();
    expect(requestSttTranscript).not.toHaveBeenCalled();
    act(() => audio.onended?.());
    fireEvent.click(screen.getByRole("button", { name: "원발화 재생" }));
    await waitFor(() => expect(screen.getByText("남은 재생 0회")).toBeInTheDocument());
    act(() => audio.onended?.());
    expect(screen.getByRole("button", { name: "원발화 재생" })).toBeDisabled();
    expect(AudioMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(audio.pause).toHaveBeenCalled();
  });

  it("does not substitute a different recording or request TTS for an unknown demo source", () => {
    const AudioMock = vi.fn();
    vi.stubGlobal("Audio", AudioMock);
    render(<InterpretingConsole sourceText="unmatched source"
      sourceLanguage={{ code: "ko", label: "한국어" }} targetLanguage={{ code: "zh", label: "중국어" }}
      demoMode onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "원발화 재생" }));
    expect(screen.getByText(/음성 파일을 찾지 못했습니다/)).toBeInTheDocument();
    expect(AudioMock).not.toHaveBeenCalled();
    expect(requestTtsAudio).not.toHaveBeenCalled();
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
