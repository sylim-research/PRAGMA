import { useEffect, useRef, useState } from "react";
import { Mic, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestSttTranscript, type SttLang } from "@/lib/mission/missionStt";
import { requestTtsAudio, type TtsLang, type TtsLevel } from "@/lib/tts";

type LanguageSpec = {
  code: "ko" | "zh";
  label: string;
};

export function InterpretingConsole({
  sourceText,
  sourceLanguage,
  targetLanguage,
  learnerLevel = "intermediate",
  replayLimit = 2,
  demoTranscript,
  onSubmit,
}: {
  sourceText: string;
  sourceLanguage: LanguageSpec;
  targetLanguage: LanguageSpec;
  learnerLevel?: TtsLevel;
  replayLimit?: number;
  /** 데모에서만 명시적으로 채운 예시. 녹음·전사 API는 호출하지 않는다. */
  demoTranscript?: string;
  onSubmit: (transcript: string) => void;
}) {
  const maxPlays = Math.max(1, replayLimit);
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState(demoTranscript ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(demoTranscript ? "시연용 전사 예시입니다. 실제 녹음한 내용이 아닙니다." : null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const sourceAudioRef = useRef<HTMLAudioElement | null>(null);
  const sourceAudioUrlRef = useRef<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    sourceAudioRef.current?.pause();
    if (sourceAudioUrlRef.current) URL.revokeObjectURL(sourceAudioUrlRef.current);
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
  }, []);

  const playSource = async () => {
    if (plays >= maxPlays || playing || ttsLoading) return;
    setNotice(null);
    try {
      let audio = sourceAudioRef.current;
      if (!audio) {
        setTtsLoading(true);
        const result = await requestTtsAudio({
          text: sourceText,
          lang: sourceLanguage.code as TtsLang,
          level: learnerLevel,
          logPrefix: "[canonical-mission-tts]",
        });
        setTtsLoading(false);
        if (result.ok === false) {
          setNotice(`원발화 음성을 준비하지 못했습니다 — ${result.message}`);
          return;
        }
        const url = URL.createObjectURL(result.blob);
        sourceAudioUrlRef.current = url;
        audio = new Audio(url);
        sourceAudioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.onerror = () => {
          setPlaying(false);
          setNotice("원발화 재생에 실패했습니다. 다시 시도해 주세요.");
        };
      }
      audio.currentTime = 0;
      setPlaying(true);
      await audio.play();
      setPlays((count) => count + 1);
    } catch {
      setPlaying(false);
      setTtsLoading(false);
      setNotice("원발화 재생에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const startRecording = async () => {
    setNotice(null);
    setRecorded(false);
    setConfirmed(false);
    setTranscript("");
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = null;
    setRecordingUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        recorderRef.current = null;
        setRecorded(true);
        if (blob.size === 0) {
          setNotice("녹음된 음성이 없습니다. 통역 내용을 직접 입력해 주세요.");
          return;
        }
        const url = URL.createObjectURL(blob);
        recordingUrlRef.current = url;
        setRecordingUrl(url);
        setTranscribing(true);
        const result = await requestSttTranscript(blob, targetLanguage.code as SttLang);
        setTranscribing(false);
        if (result.ok === true) {
          setTranscript(result.text);
          setNotice(null);
        } else {
          setNotice(`${result.message} 통역 내용을 직접 입력해 확인할 수 있습니다.`);
        }
      };
      recorder.start();
      setRecording(true);
    } catch {
      setRecorded(true);
      setNotice("마이크를 사용할 수 없습니다. 통역 내용을 직접 입력해 확인·제출할 수 있습니다.");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
  };

  const canSubmit = !transcribing && confirmed && transcript.trim().length > 0;

  return (
    <div className="space-y-3" data-scene-skin="oral-console">
      <section className="overflow-hidden rounded-2xl border border-[#CBD4DC] bg-white shadow-[0_8px_22px_rgba(21,32,43,0.07)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#E1E6EA] bg-[#F7F9FA] px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#40515F]"><Mic className="h-4 w-4" />직접 통역하기</div>
          <span className="text-[10.5px] text-[#7B8994]">듣기 → 녹음 → 전사 확인</span>
        </div>
        <div className="space-y-4 p-4">
          <section aria-label="원발화 듣기">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-bold text-[#273642]">① 원발화 듣기 ({sourceLanguage.label})</h3>
              <span className="text-[10.5px] text-[#7B8994]">최대 {maxPlays}회</span>
            </div>
            <div className="mt-2 flex items-center gap-3 rounded-xl bg-[#101922] p-3 text-white">
              <button type="button" onClick={playSource} disabled={plays >= maxPlays || playing || ttsLoading} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FAD338] text-[#15202B] disabled:opacity-40" aria-label="원발화 재생">
                <Volume2 className="h-[18px] w-[18px]" />
              </button>
              <div><p className="text-sm font-semibold">{ttsLoading ? "음성 준비 중…" : playing ? "재생 중…" : "원발화 재생"}</p><p className="text-[11px] text-[#A5B5C1]">남은 재생 {Math.max(0, maxPlays - plays)}회</p></div>
            </div>
          </section>
          <section aria-label="통역 녹음">
            <h3 className="text-xs font-bold text-[#273642]">② 통역 녹음 ({targetLanguage.label})</h3>
            <div className="mt-2 flex items-center gap-3 rounded-xl bg-[#101922] p-3">
              <button type="button" onClick={recording ? stopRecording : startRecording} disabled={transcribing} className={`rounded-lg border px-4 py-2 text-xs font-bold ${recording ? "border-[#B44647] bg-[#B44647] text-white" : "border-[#C4494A] text-[#F0A3A4]"}`}>
                {recording ? "■ 녹음 정지" : transcribing ? "전사 중…" : recorded ? "● 다시 녹음" : "● 녹음 시작"}
              </button>
              <span className="text-[11px] text-[#A5B5C1]">{recording ? "녹음 중…" : transcribing ? "자동 전사 중…" : recorded ? "아래에서 전사를 확인하세요" : "버튼을 누른 뒤 통역 시작"}</span>
            </div>
            <p className="mt-2 text-[10.5px] leading-5 text-[#7B8994]">음성은 자동 전사를 위해 OpenAI 음성 인식 API로 전송됩니다. 음성 파일은 저장하지 않고 확인한 전사만 제출합니다.</p>
          </section>
        </div>
      </section>

      {(recorded || notice || transcribing) && (
        <section className="rounded-2xl border border-[#E1DED5] bg-[#F7F6F2] p-4">
          <h3 className="text-sm font-bold text-[#15202B]">③ 내가 말한 내용 확인</h3>
          {notice && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[#536572]">{notice}</p>}
          {recordingUrl && <audio src={recordingUrl} controls preload="metadata" className="mt-3 h-9 w-full" aria-label="내 통역 녹음" />}
          <textarea value={transcript} onChange={(event) => { setTranscript(event.target.value); setConfirmed(false); }} rows={3} disabled={transcribing} placeholder={`통역한 ${targetLanguage.label} 문장`} className="mt-3 w-full rounded-xl border-2 border-[#15202B] bg-white p-3 text-[15.5px] leading-7 outline-none focus:ring-2 focus:ring-[#FAD338]/55" />
          <button type="button" onClick={() => transcript.trim() && setConfirmed(true)} disabled={transcribing || !transcript.trim()} className={`mt-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${confirmed ? "border-[#2E7D5B] bg-[#E7F5EC] text-[#256548]" : "border-[#B8B3A2] bg-white text-[#3D4B55]"}`}>
            {confirmed ? "✓ 전사 확인 완료" : "말한 내용과 같아요"}
          </button>
        </section>
      )}

      <Button className="h-12 w-full" disabled={!canSubmit} onClick={() => onSubmit(transcript.trim())}>확인한 전사로 제출</Button>
    </div>
  );
}
