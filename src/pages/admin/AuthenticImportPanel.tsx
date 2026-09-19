// 「실제 자료 활용」 (Authentic Source Import) — /admin/authentic 전용 본체.
// 관리자가 실제 중국어/한국어 자료(이미지 또는 문구)를 입력하면 edge function
// generate-scenario(action:"authentic_analyze")가 분석해 '활용 후보'를 제안한다.
// 생성 로직은 복제하지 않고 "자료 해석·후보 선택"만 여기서 한다.
//
// 호스트(AdminAuthentic)는 분석 결과를 onAnalyzed로 받아 보관하고,
// 후보를 고르면 onApply로 생성기에 넘긴다. 2026-09-09: 잠시 생성기 안 접이식 패널로 흡수했다가 되돌렸다 —
// 분석 결과가 저장되지 않고 사라지는 것이 문제였고, 그건 화면 위치가 아니라
// 보관함이 없어서였다.
//
// 이 패널은 원자료(실제 문구)와 AI가 새로 구성한 내용을 화면에서 분리해 보여준다.
// 업로드 이미지는 분석에만 쓰이고 저장/학습자 노출하지 않는다(전송 후 폐기) —
// 드라마·쇼츠 캡처를 DB에 저장하면 저작권 문제가 생기므로 지켜야 할 설계다.

import { type ReactNode, useRef, useState } from "react";
import { ImageIcon, PlayCircle, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  SPEECH_ACT_UI,
  LEVEL,
  PDR_POWER_SHORT,
  PDR_DISTANCE_SHORT,
  PDR_BURDEN_SHORT,
  DOMAIN,
  INDUSTRY,
  CHANNEL_UI,
} from "@/lib/pragma/enums";
import type {
  SpeechActUI,
  LearnerLevel,
  LanguageDirection,
  ChannelUI,
  PdrPower,
  PdrDistance,
  PdrBurden,
  Domain,
  IndustrySector,
  ComplexTaskUI,
} from "@/lib/pragma/enums";
import type { CoreProvenance, CoreSourceType } from "@/lib/pragma/coreSchema";

// ── 활용 유형 라벨 ──────────────────────────────────────────────────────
type UsageType =
  | "scenario_seed"
  | "preceding_turn"
  | "translation_source"
  | "response_task"
  | "expression_resource"
  | "unsuitable";

// 표현 자원은 참고 후보로 보관한다 — 내부 타입명(expression_resource)은 불변.
const USAGE_KO: Record<UsageType, string> = {
  scenario_seed: "시나리오",
  preceding_turn: "선행 발화",
  translation_source: "번역 출발문",
  response_task: "후속 반응 과제",
  expression_resource: "참고 표현 후보",
  unsuitable: "미션 부적합",
};
const USAGE_TONE: Record<UsageType, string> = {
  scenario_seed: "border-[#6EE7B7] bg-[#D1FAE5] text-[#065F46]",
  preceding_turn: "border-[#93C5FD] bg-[#DBEAFE] text-[#1E40AF]",
  translation_source: "border-[#C4B5FD] bg-[#EDE9FE] text-[#5B21B6]",
  response_task: "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]",
  expression_resource: "border-[#EAE4D2] bg-[#FAF7EE] text-[#5B5446]",
  unsuitable: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]",
};
// 생성기로 전달 가능한 유형(억지 화행화 금지 유형은 전달 버튼 없음).
const GENERATABLE: UsageType[] = [
  "scenario_seed",
  "preceding_turn",
  "translation_source",
  "response_task",
];

// 후보를 유형별 섹션으로 묶는다(2026-07-30 수렴안) — 원자료가 어떤 콘텐츠 갈래로
// 나뉘는지(시나리오/선행 발화/출발문/참고 표현) 화면 구조 자체가 말하게 한다.
const CANDIDATE_SECTIONS: { title: string; types: UsageType[] }[] = [
  { title: "시나리오", types: ["scenario_seed"] },
  { title: "선행 발화", types: ["preceding_turn"] },
  { title: "번역 출발문·반응 과제", types: ["translation_source", "response_task"] },
  { title: "참고 표현 후보", types: ["expression_resource"] },
  { title: "미션 부적합 — 참고만", types: ["unsuitable"] },
];

// ── AI 응답 타입(관대하게 받는다) ───────────────────────────────────────
interface RawCandidate {
  usage_type?: string;
  label_ko?: string;
  speech_act?: string | null;
  language_direction?: string;
  domain?: string;
  industry?: string | null;
  channel?: string;
  complex_task?: string;
  level?: string;
  pdr_power?: string;
  pdr_distance?: string;
  pdr_burden?: string;
  situation_seed_ko?: string | null;
  source_text?: string | null;
  preceding_turn?: string | null;
  source_usage_note_ko?: string | null;
  ai_adaptation_note_ko?: string | null;
  expression?: {
    text?: string;
    meaning_ko?: string;
    usage_note_ko?: string;
    example_zh?: string;
    tags?: string[];
  } | null;
}
interface RawAnalysis {
  source_original?: string;
  extraction_confidence?: string;
  scene_ko?: string;
  linguistic_features_ko?: string;
  recommended_uses?: string[];
  recommendation_reason_ko?: string;
  connectable_speech_acts?: string[];
  unsuitable_reason_ko?: string | null;
  candidates?: RawCandidate[];
}

// 상위 생성기 폼에 전달할 정규화된 후보(모든 enum 키가 유효).
export interface AuthenticApply {
  usage_type: UsageType;
  speech_act_ui: SpeechActUI;
  language_direction: LanguageDirection;
  domain: Domain;
  industry: IndustrySector | null;
  channel: ChannelUI;
  complex_task: ComplexTaskUI;
  level: LearnerLevel;
  pdr_power: PdrPower;
  pdr_distance: PdrDistance;
  pdr_burden: PdrBurden;
  source_text: string;
  /** provenance-lite(0-q·98) — 지금까지 버려지던 출처를 상위로 넘긴다 */
  provenance: CoreProvenance;
}

// ── enum 방어 정규화 ────────────────────────────────────────────────────
const SPEECH_ACTS = Object.keys(SPEECH_ACT_UI) as SpeechActUI[];
function asSpeechAct(v?: string | null): SpeechActUI {
  return SPEECH_ACTS.includes(v as SpeechActUI) ? (v as SpeechActUI) : "request";
}
function asDirection(v?: string | null): LanguageDirection {
  return v === "zh_ko" ? "zh_ko" : v === "ko_zh" ? "ko_zh" : "zh_ko";
}
function asDomain(v?: string | null): Domain {
  return v === "daily" || v === "school" || v === "work" ? v : "work";
}
function asIndustry(v?: string | null): IndustrySector | null {
  return v && v in INDUSTRY ? (v as IndustrySector) : null;
}
function asChannel(v?: string | null): ChannelUI {
  return v === "email" || v === "messenger" || v === "facetoface" || v === "phone"
    ? v
    : "messenger";
}
function asComplexTask(v?: string | null): ComplexTaskUI {
  return v === "none" || v === "persuade" || v === "coordinate" || v === "negotiate"
    ? v
    : "none";
}
function asLevel(v?: string | null): LearnerLevel {
  return v === "beginner_intermediate" || v === "intermediate" || v === "advanced"
    ? v
    : "intermediate";
}
// pdr는 AI가 JSON 이름(speaker_lower 등) 또는 enum 키(higher 등)로 답할 수 있어 둘 다 수용.
function asPower(v?: string | null): PdrPower {
  if (v === "speaker_lower") return "higher";
  if (v === "speaker_higher") return "lower";
  return v === "higher" || v === "equal" || v === "lower" ? v : "equal";
}
function asDistance(v?: string | null): PdrDistance {
  if (v === "distant") return "formal";
  return v === "close" || v === "acquaintance" || v === "formal" ? v : "acquaintance";
}
function asBurden(v?: string | null): PdrBurden {
  return v === "low" || v === "mid" || v === "high" ? v : "mid";
}
function asUsageType(v?: string | null): UsageType {
  return (["scenario_seed", "preceding_turn", "translation_source", "response_task", "expression_resource", "unsuitable"] as UsageType[]).includes(
    v as UsageType,
  )
    ? (v as UsageType)
    : "unsuitable";
}

// provenance는 후보(candidate)가 아니라 패널 입력 상태에서 나오므로 여기서 제외한다.
function normalizeApply(c: RawCandidate): Omit<AuthenticApply, "provenance"> {
  return {
    usage_type: asUsageType(c.usage_type),
    speech_act_ui: asSpeechAct(c.speech_act),
    language_direction: asDirection(c.language_direction),
    domain: asDomain(c.domain),
    industry: asIndustry(c.industry),
    channel: asChannel(c.channel),
    complex_task: asComplexTask(c.complex_task),
    level: asLevel(c.level),
    pdr_power: asPower(c.pdr_power),
    pdr_distance: asDistance(c.pdr_distance),
    pdr_burden: asBurden(c.pdr_burden),
    source_text: (c.source_text ?? "").trim(),
  };
}

const CONFIDENCE_KO: Record<string, { label: string; tone: string }> = {
  high: { label: "인식 신뢰도 높음", tone: "bg-[#D1FAE5] text-[#065F46]" },
  medium: { label: "인식 신뢰도 보통 — 확인 권장", tone: "bg-[#FEF3C7] text-[#92400E]" },
  low: { label: "인식 불확실 — 추출 문구를 확인해 주세요", tone: "bg-[#FEE2E2] text-[#991B1B]" },
  text_input: { label: "직접 입력 문구", tone: "bg-[#EAE4D2] text-[#5B5446]" },
};

/** 분석이 끝났을 때 호스트가 통째로 보관할 수 있게 넘기는 꾸러미.
 *  후보는 화면에 보이는 순서 그대로다 — onApply의 index와 같은 순서. */
export interface AuthenticAnalyzed {
  source_type: "image" | "text";
  source_ref: string | null;
  source_original: string;
  extraction_confidence: string | null;
  scene_ko: string | null;
  linguistic_features_ko: string | null;
  recommendation_reason_ko: string | null;
  recommended_uses: string[];
  connectable_speech_acts: string[];
  candidates: {
    usage_type: UsageType;
    label_ko: string | null;
    source_text: string | null;
    preceding_turn: string | null;
    situation_seed_ko: string | null;
    source_usage_note_ko: string | null;
    ai_adaptation_note_ko: string | null;
    conditions: Omit<AuthenticApply, "provenance" | "source_text">;
    expression: Record<string, unknown> | null;
  }[];
}

interface Props {
  onApply: (a: AuthenticApply, index: number) => void;
  /** 분석 성공 직후 1회. 호스트가 보관함에 저장한다(고르지 않은 후보도 남기려고). */
  onAnalyzed?: (a: AuthenticAnalyzed) => void;
  /** 오른쪽 칼럼 아래(분석 전에는 맨 위)에 둘 생성 결과 목록 */
  history?: ReactNode;
}

// YouTube 자막 탭: 2026-08-05에 뺐다가 2026-09-19 복원했다(youtube-transcript·SUPADATA_API_KEY 운영 확인).
type InputTab = "image" | "text" | "youtube";

// YouTube 자막(CC)만 쓴다(mode=native) — AI 받아쓰기는 실제 자료가 아니다.
// 중국어를 먼저 찾고, 없으면 한국어를 찾는다. 가져온 자막 언어가 곧 원문 언어다.
type CaptionResult = { lang: string; text: string } | { missing: true } | { error: string };
const isZh = (lang: unknown) => typeof lang === "string" && /^zh/i.test(lang);
const isKo = (lang: unknown) => typeof lang === "string" && /^ko/i.test(lang);

async function fetchCaptionTrack(url: string, lang: "zh" | "ko"): Promise<CaptionResult & { available?: string[] }> {
  const { data, error } = await supabase.functions.invoke("youtube-transcript", {
    body: { url, lang, mode: "native", text: false },
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: typeof data.error === "string" ? data.error : JSON.stringify(data.error) };
  const available = Array.isArray(data?.availableLangs) ? (data.availableLangs as string[]) : [];
  const match = lang === "zh" ? isZh(data?.lang) : isKo(data?.lang);
  const content = (data?.raw as { content?: unknown } | undefined)?.content;
  const caption = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((seg: { text?: string }) => seg?.text ?? "").join(" ")
      : "";
  if (!match || !caption.trim()) return { missing: true, available };
  return { lang: String(data.lang), text: caption.replace(/\s+/g, " ").trim(), available };
}

const AuthenticImportPanel = ({ onApply, onAnalyzed, history }: Props) => {
  const [inputTab, setInputTab] = useState<InputTab>("image");
  const [imgLarge, setImgLarge] = useState(false);
  const [text, setText] = useState("");
  // 출처·메모 입력 칸은 화면에서 뺐다(2026-09-19). 출처는 YouTube 자막을 가져올 때만 영상 주소로 자동 기록한다.
  const [sourceRef, setSourceRef] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytLoading, setYtLoading] = useState(false);
  const note = "";
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [direction, setDirection] = useState<LanguageDirection>("zh_ko");
  // 원자료 취득 경로 = provenance.source_type(0-q·98). 명시적 입력 행위에서만 바뀐다.
  // 이미지에서 뽑은 텍스트를 관리자가 고쳐 재분석해도 출처는 여전히 이미지다.
  const [inputOrigin, setInputOrigin] = useState<CoreSourceType>("authentic_text");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RawAnalysis | null>(null);
  const [editedOriginal, setEditedOriginal] = useState("");
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickImage = (file: File | null) => {
    if (!file) return;
    if (!/image\/(jpeg|jpg|png|webp)/.test(file.type)) {
      setError("jpg·png·webp 이미지만 지원합니다.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("이미지는 6MB 이하로 업로드하세요.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setImageName(file.name);
      setInputOrigin("authentic_image");
    };
    reader.readAsDataURL(file);
  };

  const fetchCaption = async () => {
    const url = youtubeUrl.trim();
    if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
      setError("YouTube 영상 주소를 넣어 주세요.");
      return;
    }
    setYtLoading(true);
    setError(null);
    try {
      let result = await fetchCaptionTrack(url, "zh");
      if ("missing" in result) result = await fetchCaptionTrack(url, "ko");
      if ("error" in result) {
        setError(`자막을 가져오지 못했습니다: ${result.error}`);
        return;
      }
      if ("missing" in result) {
        setError("이 영상에는 중국어·한국어 자막(CC)이 없습니다. 다른 영상을 찾아 주세요.");
        return;
      }
      setText(result.text);
      setInputTab("text");
      setInputOrigin("authentic_youtube");
      setSourceRef(url);
      setDirection(isZh(result.lang) ? "zh_ko" : "ko_zh");
    } finally {
      setYtLoading(false);
    }
  };

  const clearImage = () => {
    setImageDataUrl(null);
    setImageName(null);
    setInputOrigin("authentic_text");
    if (fileRef.current) fileRef.current.value = "";
  };

  // reAnalyzeText: 관리자가 추출 원문을 수정한 뒤 그 텍스트로만 재분석(이미지 제외).
  const runAnalyze = async (overrideText?: string) => {
    const useText = (overrideText ?? text).trim();
    if (!useText && !imageDataUrl) {
      setError("이미지를 업로드하거나 문구를 입력하세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setAppliedIdx(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-scenario", {
        body: {
          action: "authentic_analyze",
          authentic: {
            text: useText || null,
            // 재분석(수정 원문)일 때는 이미지 제외 — 관리자가 확정한 텍스트를 신뢰.
            image_data_url: overrideText !== undefined ? null : imageDataUrl,
            source_ref: sourceRef.trim() || null,
            note: note.trim() || null,
            language_direction: direction,
          },
        },
      });
      if (fnErr) throw fnErr;
      if (!data?.analysis) throw new Error(data?.error ?? "분석 결과가 비어 있습니다.");
      const a = data.analysis as RawAnalysis;
      setAnalysis(a);
      const original = (a.source_original ?? useText ?? "").trim();
      setEditedOriginal(original);
      // 고르지 않은 후보까지 남기려면 여기서 통째로 넘겨야 한다 — 카드를 눌러야만
      // 저장하면 눌리지 않은 후보는 그대로 사라진다.
      onAnalyzed?.({
        source_type: inputOrigin === "authentic_image" ? "image" : "text",
        source_ref: sourceRef.trim() || null,
        source_original: original,
        extraction_confidence: a.extraction_confidence ?? null,
        scene_ko: a.scene_ko ?? null,
        linguistic_features_ko: a.linguistic_features_ko ?? null,
        recommendation_reason_ko: a.recommendation_reason_ko ?? null,
        recommended_uses: a.recommended_uses ?? [],
        connectable_speech_acts: a.connectable_speech_acts ?? [],
        candidates: (a.candidates ?? []).map((c) => {
          const { source_text, ...conditions } = normalizeApply(c);
          return {
            usage_type: conditions.usage_type,
            label_ko: c.label_ko ?? null,
            source_text: source_text || null,
            preceding_turn: c.preceding_turn ?? null,
            situation_seed_ko: c.situation_seed_ko ?? null,
            source_usage_note_ko: c.source_usage_note_ko ?? null,
            ai_adaptation_note_ko: c.ai_adaptation_note_ko ?? null,
            conditions,
            expression: (c.expression ?? null) as Record<string, unknown> | null,
          };
        }),
      });
    } catch (e) {
      setError((e as Error).message ?? "분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const apply = (c: RawCandidate, i: number) => {
    const base = normalizeApply(c);
    // 관리자가 확정한 원문을 우선한다(없으면 모델이 판독한 원문).
    const original = (editedOriginal || analysis?.source_original || "").trim();
    onApply({
      ...base,
      provenance: {
        source_type: inputOrigin,
        source_ref: sourceRef.trim() || null,
        source_original: original || null,
        // 사용 원문이 원자료와 다르면 AI가 재구성한 것이다.
        ai_adapted: original.length > 0 && base.source_text.trim() !== original,
        // anonymized는 수집 UI가 아직 없어 미설정으로 둔다(스키마 optional).
      },
    }, i);
    setAppliedIdx(i);
  };

  return (
    // 좌 = 자료 입력(고정폭 썸네일·문구·출처·방향), 우 = 분석·후보. 입력 칼럼은
    // 스크롤해도 따라오게 sticky — 후보를 훑다가 원문을 고치는 왕복이 잦다.
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      {/* ── LEFT: 자료 → 문구 확정 ── */}
      <section className="space-y-4 rounded-xl border border-[#D9D2BF] bg-white p-4 lg:sticky lg:top-4">
        {/* ① 원자료 가져오기 — 세 경로는 결국 전부 '문구'가 된다 */}
        <div>
          <h3 className="text-[14px] font-bold text-[#15202B]">① 원자료 가져오기</h3>
          <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-[#F3F0E7] p-1">
            {([
              ["image", "이미지에서 추출", ImageIcon],
              ["text", "텍스트 직접 입력", Type],
              ["youtube", "YouTube 자막", PlayCircle],
            ] as const).map(([k, l, Icon]) => (
              <button
                key={k}
                type="button"
                onClick={() => setInputTab(k)}
                aria-pressed={inputTab === k}
                className={[
                  "flex h-10 items-center justify-center gap-1.5 rounded-md text-[12.5px] transition-colors",
                  inputTab === k
                    ? "bg-white font-semibold text-[#15202B] shadow-sm ring-1 ring-[#D9D2BF]"
                    : "font-medium text-[#3F4E59] hover:bg-white/60",
                ].join(" ")}
              >
                <Icon className="hidden h-4 w-4 shrink-0 2xl:block" aria-hidden />
                <span className="truncate">{l}</span>
              </button>
            ))}
          </div>

          {inputTab === "image" && (
            <div className="mt-2.5">
              {!imageDataUrl ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-[#B9AF97] bg-[#FAF8F2] text-[12.5px] font-medium text-[#3F4E59] hover:bg-[#F3F0E7]"
                >
                  + 쇼츠·드라마 캡처 업로드 (jpg·png·webp) · 이미지는 저장하지 않습니다
                </button>
              ) : imgLarge ? (
                <div className="space-y-1.5">
                  <button type="button" onClick={() => setImgLarge(false)} title="클릭하면 작게 보기" className="block w-full">
                    <img
                      src={imageDataUrl}
                      alt={imageName ?? "미리보기"}
                      className="max-h-96 w-full rounded-md border border-[#EAE4D2] bg-[#F1EDE2] object-contain"
                    />
                  </button>
                  <div className="flex items-center justify-between">
                    <p className="truncate text-[12px] text-muted-foreground">{imageName}</p>
                    <button type="button" onClick={clearImage}
                      className="rounded-md border border-[#EAE4D2] bg-white px-2.5 py-1 text-[11.5px] text-[#1d2336] hover:bg-muted">
                      제거
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setImgLarge(true)}
                    title="클릭하면 크게 보기"
                    className="h-28 w-20 shrink-0 overflow-hidden rounded-md border border-[#EAE4D2] bg-[#F1EDE2]"
                  >
                    <img src={imageDataUrl} alt={imageName ?? "미리보기"} className="h-full w-full object-contain" />
                  </button>
                  <div className="min-w-0 space-y-1.5">
                    <p className="truncate text-[12px] text-muted-foreground">{imageName}</p>
                    <p className="text-[10.5px] text-[#5A6670]">썸네일을 누르면 크게 봅니다</p>
                    <button type="button" onClick={clearImage}
                      className="rounded-md border border-[#EAE4D2] bg-white px-2.5 py-1 text-[11.5px] text-[#1d2336] hover:bg-muted">
                      제거
                    </button>
                  </div>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {inputTab === "youtube" && (
            <div className="mt-2.5">
              <div className="flex gap-2">
                <input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !ytLoading && youtubeUrl.trim()) fetchCaption(); }}
                  placeholder="https://www.youtube.com/watch?v=…"
                  aria-label="YouTube 영상 주소"
                  className="h-10 min-w-0 flex-1 rounded-md border border-[#D9D2BF] bg-white px-3 text-[13px] text-[#15202B] placeholder:text-[#8A949C] focus:outline-none focus:ring-2 focus:ring-[#C8AA2F]/40"
                />
                <button
                  type="button"
                  onClick={fetchCaption}
                  disabled={ytLoading || !youtubeUrl.trim()}
                  className="h-10 shrink-0 rounded-md bg-[#15202B] px-4 text-[13px] font-semibold text-white hover:bg-[#15202B]/90 disabled:bg-[#C9CED2]"
                >
                  {ytLoading ? "가져오는 중…" : "자막 가져오기"}
                </button>
              </div>
              <p className="mt-1.5 truncate text-[11.5px] text-[#5A6670]">
                중국어·한국어 CC 자막을 가져와 텍스트 칸에 채웁니다.
              </p>
            </div>
          )}

          {inputTab === "text" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="중국어 또는 한국어 텍스트 (예: 每天都有忙不完的事) — 소설 구절·메신저 문구·자막 대사"
              className="mt-2.5 h-28 w-full resize-none rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#C8AA2F]/40"
            />
          )}

        </div>

        {/* 만들 콘텐츠의 언어 방향 — 자료(영상·이미지)의 언어가 아니라 학습 과제의 방향 */}
        <div className="border-t border-[#EFEAE0] pt-4">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-[13px] font-semibold text-[#15202B]">만들 콘텐츠의 언어 방향</label>
            <span className="text-[11px] text-[#5A6670]">자료의 언어와 다를 수 있습니다</span>
          </div>
          <div className="mt-2 flex gap-2">
            {(["zh_ko", "ko_zh"] as LanguageDirection[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                aria-pressed={direction === d}
                className={[
                  "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] transition-colors",
                  direction === d
                    ? "border-2 border-[#15202B] bg-white font-semibold text-[#15202B]"
                    : "border border-[#D9D2BF] bg-white font-medium text-[#3F4E59] hover:bg-[#F3F0E7]",
                ].join(" ")}
              >
                {d === "zh_ko" ? "중→한" : "한→중"}
                <span className="text-[11px] font-normal text-[#5A6670]">{d === "zh_ko" ? "중국어 원문" : "한국어 원문"}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => runAnalyze()}
          disabled={loading || (!text.trim() && !imageDataUrl)}
          className="h-11 w-full bg-[#FAD338] text-[14px] font-semibold text-[#15202B] hover:bg-[#F2C71E] disabled:opacity-50"
        >
          {loading ? "분석 중…" : "활용 가능성 분석"}
        </Button>

        {error && (
          <div className="rounded-md border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#991B1B]">
            {error}
          </div>
        )}

        {/* ② 추출 문구 확인 — 입력의 최종 산출물은 오른쪽이 아니라 여기서 확정된다 */}
        {analysis && (
          <div className="rounded-md border border-[#EAE4D2] bg-white p-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] font-bold text-[#15202B]">② 추출 문구 확인</span>
              {analysis.extraction_confidence && (
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                    (CONFIDENCE_KO[analysis.extraction_confidence] ?? CONFIDENCE_KO.text_input).tone,
                  ].join(" ")}
                >
                  {(CONFIDENCE_KO[analysis.extraction_confidence] ?? CONFIDENCE_KO.text_input).label}
                </span>
              )}
            </div>
            <textarea
              value={editedOriginal}
              onChange={(e) => setEditedOriginal(e.target.value)}
              className="h-20 w-full resize-none rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-3 py-2 text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#C8AA2F]/40"
            />
            <button
              type="button"
              onClick={() => runAnalyze(editedOriginal)}
              disabled={loading || !editedOriginal.trim()}
              className="mt-2 rounded-md border border-[#EAE4D2] bg-[#FAF7EE] px-3 py-1 text-[11.5px] text-[#1d2336] hover:bg-muted disabled:opacity-60"
            >
              ↻ 수정한 문구로 다시 분석
            </button>
          </div>
        )}

        {/* 출처·메모 = 소스가 아니라 메타데이터 — 보조 위계로 격하 */}
      </section>

      {/* ── RIGHT: 확정된 문구 → 활용 ── */}
      <section className="space-y-4">
        {!analysis && !history && (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#EAE4D2] bg-[#FAF8F2] px-6 py-10 text-center text-[13px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-[#5B5446]">
              원자료 가져오기 → 추출 문구 확인 → 활용 방향 분석 → 콘텐츠 후보
            </p>
            <p>왼쪽에 자료를 넣고 「활용 가능성 분석」을 실행하면 여기에 활용 방향과 후보가 표시됩니다.</p>
          </div>
        )}
        {analysis && (
          <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-bold text-emerald-800">교수자가 확인한 원자료</span>
                  {sourceRef.trim() && <span className="max-w-full truncate text-[10.5px] text-emerald-700">출처 · {sourceRef.trim()}</span>}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#19372D]">
                  {editedOriginal || analysis.source_original || "확정 원자료가 없습니다."}
                </p>
                <p className="mt-2 text-[10.5px] leading-4 text-emerald-700">
                  아래의 상황·활용 방향은 AI 제안입니다. 원자료 활용과 AI 변형 설명을 확인한 뒤 교수자가 전달 여부를 결정합니다.
                </p>
              </div>
              {/* ③ 활용 방향 분석 — 확정된 문구가 어떤 콘텐츠가 될 수 있는가 */}
              <div className="space-y-2 rounded-xl border border-[#EAE4D2] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2 border-l-[3px] border-[#FAD338] pl-2.5">
                  <span className="text-[13.5px] font-bold text-[#1d2336]">③ 활용 방향 분석</span>
                  <span className="rounded-full bg-[#EAE4D2] px-2 py-0.5 text-[10px] font-medium text-[#5B5446]">AI 제안</span>
                </div>
                {analysis.scene_ko && (
                  <p className="text-[12.5px] text-foreground">
                    <b className="text-[#1d2336]">담화 상황 · </b>{analysis.scene_ko}
                  </p>
                )}
                {analysis.linguistic_features_ko && (
                  <p className="text-[12px] text-muted-foreground">
                    <b className="text-[#1d2336]">표현 특징 · </b>{analysis.linguistic_features_ko}
                  </p>
                )}
                {analysis.recommended_uses && analysis.recommended_uses.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11.5px] font-medium text-[#1d2336]">추천 활용 ·</span>
                    {analysis.recommended_uses.map((u, i) => {
                      const ut = asUsageType(u);
                      return (
                        <span key={i} className={["rounded border px-1.5 py-0.5 text-[11px]", USAGE_TONE[ut]].join(" ")}>
                          {i + 1}. {USAGE_KO[ut]}
                        </span>
                      );
                    })}
                  </div>
                )}
                {analysis.recommendation_reason_ko && (
                  <p className="text-[12px] text-muted-foreground">
                    <b className="text-[#1d2336]">추천 근거 · </b>{analysis.recommendation_reason_ko}
                  </p>
                )}
                {analysis.connectable_speech_acts && analysis.connectable_speech_acts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11.5px] font-medium text-[#1d2336]">적용 가능한 화행 ·</span>
                    {analysis.connectable_speech_acts.map((s, i) => (
                      <span key={i} className="rounded bg-[#FAF7EE] px-1.5 py-0.5 text-[11px] text-[#5B5446]">
                        {SPEECH_ACT_UI[asSpeechAct(s)]}
                      </span>
                    ))}
                  </div>
                )}
                {analysis.unsuitable_reason_ko && (
                  <p className="rounded border border-[#FCA5A5] bg-[#FEE2E2] px-2 py-1 text-[11.5px] text-[#991B1B]">
                    독립 미션화 주의 · {analysis.unsuitable_reason_ko}
                  </p>
                )}
              </div>

              {/* ④ 콘텐츠 후보 — 유형별 섹션, 홀수면 마지막 카드를 2열 폭으로 확장 */}
              <div className="space-y-4">
                {CANDIDATE_SECTIONS.map(({ title, types }) => {
                  const items = (analysis.candidates ?? [])
                    .map((c, i) => ({ c, i }))
                    .filter(({ c }) => types.includes(asUsageType(c.usage_type)));
                  if (items.length === 0) return null;
                  return (
                    <div key={title} className="space-y-2">
                      <span className="block border-l-[3px] border-[#FAD338] pl-2.5 text-[12.5px] font-bold text-[#1d2336]">
                        ④ {title} · {items.length}개
                      </span>
                      <div className="grid grid-cols-1 gap-2.5">
                {items.map(({ c, i }, k) => {
                  const spanFull = items.length % 2 === 1 && k === items.length - 1;
                  const ut = asUsageType(c.usage_type);
                  const generatableType = GENERATABLE.includes(ut);
                  const canGen = generatableType && !!(c.source_text ?? "").trim();
                  const norm = canGen ? normalizeApply(c) : null;
                  return (
                    <div
                      key={i}
                      className={[
                        "flex flex-col gap-2 rounded-md border border-border bg-background p-3",
                        spanFull ? "xl:col-span-2" : "",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={["rounded border px-1.5 py-0.5 text-[11px] font-medium", USAGE_TONE[ut]].join(" ")}>
                          {USAGE_KO[ut]}
                        </span>
                        <span className="text-[12.5px] font-medium text-foreground">{c.label_ko ?? "(제목 없음)"}</span>
                      </div>

                      {/* AI 재구성 내용 */}
                      {c.situation_seed_ko && (
                        <p className="text-[12px] leading-relaxed text-foreground">
                          <span className="text-[#5B21B6]">AI 상황 · </span>{c.situation_seed_ko}
                        </p>
                      )}
                      {c.source_text && (
                        <div className="rounded border border-[#EAE4D2] bg-[#FAF7EE] px-2.5 py-1.5 text-[12.5px] leading-relaxed">
                          <span className="text-[10.5px] text-[#8a857c]">출발문(source_text) · </span>
                          {c.source_text}
                        </div>
                      )}
                      {c.preceding_turn && (
                        <div className="rounded border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1.5 text-[12px] leading-relaxed text-[#1E40AF]">
                          <span className="text-[10.5px]">선행 발화 · </span>{c.preceding_turn}
                        </div>
                      )}

                      {/* 표현 자원(비생성 후보) — 후속 「오늘의 살아 있는 표현」 카드 후보 */}
                      {c.expression?.text && (
                        <div className="rounded border border-[#EAE4D2] bg-[#FAF7EE] px-2.5 py-1.5 text-[12px] space-y-0.5">
                          <div>
                            <span className="font-medium text-foreground">{c.expression.text}</span>
                            {c.expression.meaning_ko && <span className="text-muted-foreground"> — {c.expression.meaning_ko}</span>}
                          </div>
                          {c.expression.usage_note_ko && (
                            <div className="text-[11px] text-muted-foreground">{c.expression.usage_note_ko}</div>
                          )}
                          {c.expression.example_zh && (
                            <div className="text-[11px] text-foreground">例：{c.expression.example_zh}</div>
                          )}
                          {c.expression.tags && c.expression.tags.length > 0 && (
                            <div className="text-[10.5px] text-[#8a857c]">#{c.expression.tags.join(" #")}</div>
                          )}
                        </div>
                      )}

                      {/* 매핑된 PRAGMA 필드 */}
                      {norm && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {[
                            SPEECH_ACT_UI[norm.speech_act_ui],
                            norm.language_direction === "zh_ko" ? "중→한" : "한→중",
                            DOMAIN[norm.domain],
                            ...(norm.industry ? [INDUSTRY[norm.industry]] : []),
                            CHANNEL_UI[norm.channel],
                            LEVEL[norm.level],
                            PDR_POWER_SHORT[norm.pdr_power],
                            PDR_DISTANCE_SHORT[norm.pdr_distance],
                            PDR_BURDEN_SHORT[norm.pdr_burden],
                          ].map((t) => (
                            <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 원자료 활용 / AI 변형 설명 */}
                      {(c.source_usage_note_ko || c.ai_adaptation_note_ko) && (
                        <div className="space-y-0.5 border-t border-border pt-1.5 text-[11px] leading-relaxed">
                          {c.source_usage_note_ko && (
                            <p className="text-muted-foreground"><b className="text-[#065F46]">원자료 활용 · </b>{c.source_usage_note_ko}</p>
                          )}
                          {c.ai_adaptation_note_ko && (
                            <p className="text-muted-foreground"><b className="text-[#5B21B6]">AI 변형 · </b>{c.ai_adaptation_note_ko}</p>
                          )}
                        </div>
                      )}

                      {/* 전달 버튼 — 카드 하단 정렬(2열에서 높이가 달라도 줄 맞춤) */}
                      {canGen ? (
                        <Button
                          onClick={() => apply(c, i)}
                          className={[
                            "mt-auto w-full text-[12.5px]",
                            appliedIdx === i
                              ? "bg-[#065F46] text-white hover:bg-[#065F46]"
                              : "bg-[#15202B] text-white hover:bg-[#15202B]/90",
                          ].join(" ")}
                        >
                          {appliedIdx === i ? "✓ 근거와 함께 전달 중…" : "이 자료로 상황 시나리오 만들기"}
                        </Button>
                      ) : (
                        <p className="mt-auto rounded-md border border-dashed border-[#EAE4D2] bg-[#FAF7EE] px-2.5 py-1.5 text-[11px] text-muted-foreground">
                          {generatableType
                            ? "근거 부족 · 생성기로 전달할 출발문이 없습니다. 원문을 수정해 다시 분석하세요."
                            : "이 유형은 독립 미션으로 억지 변환하지 않습니다. 표현 자원·상황 배경으로만 참고하세요."}
                        </p>
                      )}
                    </div>
                  );
                })}
                      </div>
                    </div>
                  );
                })}
                {(analysis.candidates ?? []).length === 0 && (
                  <p className="rounded-md border border-dashed border-[#EAE4D2] bg-[#FAF7EE] px-3 py-2 text-[12px] text-muted-foreground">
                    제안된 활용 후보가 없습니다. 원문을 수정해 재분석하거나 다른 자료를 시도하세요.
                  </p>
                )}
              </div>
            </div>
          )}
        {history}
      </section>
    </div>
  );
};

export default AuthenticImportPanel;
