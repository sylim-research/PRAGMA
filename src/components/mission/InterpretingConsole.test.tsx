import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mission/missionStt", () => ({
  requestSttTranscript: vi.fn(),
}));
vi.mock("@/lib/tts", () => ({
  requestTtsAudio: vi.fn(),
  DEFAULT_TTS_VOICE_BY_LANG: { ko: "tjTX4kAaf3HNGHJnq6iy", zh: "nUrEpZ0St3GU2UgOHW3h" },
}));

import { requestSttTranscript } from "@/lib/mission/missionStt";
import { requestTtsAudio } from "@/lib/tts";
import { InterpretingConsole, withSentencePauses } from "@/components/mission/InterpretingConsole";

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

  const DEMO_SOURCES = [
    { language: "ko" as const, voiceId: "tjTX4kAaf3HNGHJnq6iy", volume: 1, rate: 1, sourceText: "안녕하세요. 혹시 괜찮으시면 택배 좀 맡아 주실 수 있을까요?",
      requestText: '안녕하세요. <break time="0.5s" /> 혹시 괜찮으시면 택배 좀 맡아 주실 수 있을까요?' },
    { language: "zh" as const, voiceId: "nUrEpZ0St3GU2UgOHW3h", volume: 1, rate: 1, sourceText: "您好。方便的话，请把修改意见发给我。",
      requestText: '您好。 <break time="1.5s" /> 方便的话，请把修改意见发给我。' },
  ];
  const elevenLabsAudio = (voiceId: string) => ({ ok: true as const, blob: new Blob(["source"], { type: "audio/mpeg" }),
    requestedVoiceId: voiceId, usedVoiceId: voiceId, fallbackUsed: false, provider: "elevenlabs", model: "eleven_multilingual_v2" });

  it.each(DEMO_SOURCES.flatMap(entry => [true, false].map(demoMode => ({ ...entry, demoMode }))))("synthesizes the $language source (demo=$demoMode) with shared settings and reuses it for the replay", async (entry) => {
    vi.mocked(requestTtsAudio).mockResolvedValue(elevenLabsAudio(entry.voiceId));
    const audio = { currentTime: 0, volume: 1, playbackRate: 1, onended: null as null | (() => void),
      onerror: null, pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) };
    const AudioMock = vi.fn(function () { return audio; });
    vi.stubGlobal("Audio", AudioMock);
    const { unmount } = render(<InterpretingConsole
      sourceText={entry.sourceText} sourceLanguage={{ code: entry.language, label: entry.language }}
      targetLanguage={{ code: entry.language === "ko" ? "zh" : "ko", label: "target" }}
      demoMode={entry.demoMode} onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "원발화 재생" }));
    await waitFor(() => expect(screen.getByText("남은 재생 1회")).toBeInTheDocument());
    expect(requestTtsAudio).toHaveBeenCalledWith(expect.objectContaining({ text: entry.requestText, lang: entry.language }));
    expect(vi.mocked(requestTtsAudio).mock.calls[0][0].profile).toBeUndefined();
    expect(AudioMock).toHaveBeenCalledWith("blob:audio");
    expect(audio.volume).toBe(entry.volume);
    expect(audio.playbackRate).toBe(entry.rate);
    expect(requestSttTranscript).not.toHaveBeenCalled();
    act(() => audio.onended?.());
    fireEvent.click(screen.getByRole("button", { name: "원발화 재생" }));
    await waitFor(() => expect(screen.getByText("남은 재생 0회")).toBeInTheDocument());
    act(() => audio.onended?.());
    expect(screen.getByRole("button", { name: "원발화 재생" })).toBeDisabled();
    expect(requestTtsAudio).toHaveBeenCalledTimes(1);
    expect(AudioMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(audio.pause).toHaveBeenCalled();
  });

  it("adds pauses only between sentences", () => {
    expect(withSentencePauses("안녕하세요. 가능할까요? 감사합니다."))
      .toBe('안녕하세요. <break time="1.0s" /> 가능할까요? <break time="1.0s" /> 감사합니다.');
    expect(withSentencePauses("您好！可以吗？谢谢。", 2)).toBe('您好！ <break time="2.0s" /> 可以吗？ <break time="2.0s" /> 谢谢。');
    expect(withSentencePauses("3.5일")).toBe("3.5일");
  });

  it.each([
    ["a fallback provider", { ...elevenLabsAudio("tjTX4kAaf3HNGHJnq6iy"), provider: "openai", usedVoiceId: "nova", fallbackUsed: true }],
    ["a failed request", { ok: false as const, message: "음성을 생성할 수 없습니다.", requestedVoiceId: "tjTX4kAaf3HNGHJnq6iy" }],
  ])("does not play %s in the demo and allows a retry", async (_label, failure) => {
    vi.mocked(requestTtsAudio).mockResolvedValueOnce(failure).mockResolvedValueOnce(elevenLabsAudio("tjTX4kAaf3HNGHJnq6iy"));
    const audio = { currentTime: 0, volume: 1, playbackRate: 1, onended: null, onerror: null,
      pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined) };
    const AudioMock = vi.fn(function () { return audio; });
    vi.stubGlobal("Audio", AudioMock);
    render(<InterpretingConsole sourceText={DEMO_SOURCES[0].sourceText}
      sourceLanguage={{ code: "ko", label: "한국어" }} targetLanguage={{ code: "zh", label: "중국어" }}
      demoMode onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "원발화 재생" }));
    expect(await screen.findByText(/ElevenLabs 음성을 생성하지 못했습니다/)).toBeInTheDocument();
    expect(AudioMock).not.toHaveBeenCalled();
    expect(screen.getByText("남은 재생 2회")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "원발화 재생" }));
    await waitFor(() => expect(screen.getByText("남은 재생 1회")).toBeInTheDocument());
    expect(requestTtsAudio).toHaveBeenCalledTimes(2);
    expect(AudioMock).toHaveBeenCalledTimes(1);
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
