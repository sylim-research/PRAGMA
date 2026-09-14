// Learning session collection, persistence, seed, and export utilities.
// Sessions are stored under localStorage["learning_sessions"] as a JSON array.
// A draft (in-progress) session is kept under localStorage["learning_session_draft"]
// and is only promoted to the array when the learner reaches step 5 and confirms.


export const SESSIONS_KEY = "learning_sessions";
export const DRAFT_KEY = "learning_session_draft";

export type StepNum = 1 | 2 | 3 | 4 | 5;

export interface StageDurations {
  step1: number;
  step2: number;
  step3: number;
  step4: number;
  step5: number;
}

export interface LearningSession {
  session_id: string;
  material_id: string;
  mode: "translation" | "interpretation";
  speech_act: string;
  discourse_genre: string;
  sector: string;
  difficulty: string;
  source_text: string;
  ai_translations: { A: string; B: string; C: string };
  selected_translation: string;
  final_translation: string;
  final_reasoning: string;
  stage_durations_sec: StageDurations;
  total_duration_sec: number;
  timestamp: string;
}

interface Draft {
  session_id: string;
  started_at: string;
  stage_durations_sec: StageDurations;
  saved?: boolean;
}

// ---------- material catalog (mirrors prototype scenarios) ----------

type ActId = "request" | "refusal";

const MATERIAL_BY_ACT: Record<ActId, {
  material_id: string;
  speech_act: string;
  discourse_genre: string;
  sector: string;
  difficulty: string;
  source_text: string;
  ai_translations: { A: string; B: string; C: string };
  title: string;
}> = {
  request: {
    material_id: "material_001",
    speech_act: "request",
    discourse_genre: "business_email",
    sector: "entertainment",
    difficulty: "intermediate",
    source_text:
      "이번 자료 전달 일정을 10일 정도 연장해 주실 수 있을지 검토 부탁드립니다.",
    ai_translations: {
      A: "请将本次资料提交时间延后十天。",
      B: "不知贵方是否方便将本次资料提交时间延后十天,烦请考虑。",
      C: "由于我方仍需等待艺人方面的最终确认,恳请贵方酌情考虑将本次资料提交时间延后十天。由此可能给贵方上线安排带来的不便,我们深表歉意。",
    },
    title: "K-pop 팬 이벤트 자료 전달 일정 연장 요청",
  },
  refusal: {
    material_id: "material_002",
    speech_act: "refusal",
    discourse_genre: "business_email",
    sector: "entertainment",
    difficulty: "intermediate",
    source_text: "검토해 봤는데 이번에는 프로모션 비용 인하가 어려울 것 같습니다.",
    ai_translations: {
      A: "我们研究过了,这次不能降低推广费用。",
      B: "我们内部讨论过了,这次推广费用方面确实很难再调整,还请您理解。",
      C: "感谢贵方一直以来的支持。关于此次推广费用调整,我们已认真进行内部讨论,但由于项目预算和执行安排已经基本确定,实在难以再下调。还请您理解,我们也会继续积极配合后续活动推进。",
    },
    title: "K-pop 팬 이벤트 공동 프로모션 비용 인하 거절",
  },
};

// ---------- helpers ----------

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function emptyDurations(): StageDurations {
  return { step1: 0, step2: 0, step3: 0, step4: 0, step5: 0 };
}

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d.stage_durations_sec) d.stage_durations_sec = emptyDurations();
    return d;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

export function ensureDraft(): Draft {
  let d = readDraft();
  if (!d || d.saved) {
    d = {
      session_id: uuid(),
      started_at: new Date().toISOString(),
      stage_durations_sec: emptyDurations(),
    };
    writeDraft(d);
  }
  return d;
}

export function addStageSeconds(step: StepNum, seconds: number) {
  if (seconds <= 0) return;
  const d = ensureDraft();
  const key = `step${step}` as keyof StageDurations;
  d.stage_durations_sec[key] = (d.stage_durations_sec[key] || 0) + seconds;
  writeDraft(d);
}

// ---------- session assembly ----------

export function getSessions(): LearningSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as LearningSession[]) : [];
  } catch {
    return [];
  }
}

// ---------- seed demo data ----------

const SEED_FLAG_KEY = "learning_sessions_seeded_v1";

const SEED_SESSIONS: LearningSession[] = [
  {
    session_id: "00000000-0000-4000-8000-000000000001",
    material_id: "material_001",
    mode: "translation",
    speech_act: "request",
    discourse_genre: "business_email",
    sector: "entertainment",
    difficulty: "intermediate",
    source_text: MATERIAL_BY_ACT.request.source_text,
    ai_translations: MATERIAL_BY_ACT.request.ai_translations,
    selected_translation: "B",
    final_translation:
      "由于我方仍需等待艺人方面的最终确认,烦请贵方酌情考虑将本次资料提交时间延后十天,如有不便敬请谅解。",
    final_reasoning:
      "처음에는 A가 가장 명확하다고 봤지만, 첫 협업 상대에게 보내기에는 너무 단정적이라는 수신자 페르소나의 지적이 와닿았습니다. B의 완곡함을 기본으로 두고, C에서 본 사유 제시 부분을 한 줄만 더해 정중함과 정보량의 균형을 맞추는 쪽으로 정리했습니다.",
    stage_durations_sec: { step1: 92, step2: 188, step3: 241, step4: 173, step5: 58 },
    total_duration_sec: 752,
    timestamp: "2026-05-19T10:14:00+09:00",
  },
  {
    session_id: "00000000-0000-4000-8000-000000000002",
    material_id: "material_002",
    mode: "translation",
    speech_act: "refusal",
    discourse_genre: "business_email",
    sector: "entertainment",
    difficulty: "intermediate",
    source_text: MATERIAL_BY_ACT.refusal.source_text,
    ai_translations: MATERIAL_BY_ACT.refusal.ai_translations,
    selected_translation: "C",
    final_translation:
      "感谢贵方一直以来的支持。关于此次推广费用调整,我方已认真进行内部讨论,但由于本次项目预算和执行安排已基本确定,实在难以再下调,还请您理解。后续活动方面,我们会继续积极配合,共同推进。",
    final_reasoning:
      "처음에는 B가 완곡해서 적절하다고 봤지만, 통번역 교수자 피드백에서 거절 의사가 명확히 드러나지 않을 수 있다는 지적을 보고 C로 다듬었습니다. 거절의 명확성과 관계 유지를 동시에 살리는 게 핵심이라고 판단했고, 후속 협업 의지 부분은 과한 약속이 되지 않도록 한 톤 낮춰 정리했습니다.",
    stage_durations_sec: { step1: 105, step2: 212, step3: 286, step4: 198, step5: 71 },
    total_duration_sec: 872,
    timestamp: "2026-05-20T15:42:00+09:00",
  },
  {
    session_id: "00000000-0000-4000-8000-000000000003",
    material_id: "material_001",
    mode: "translation",
    speech_act: "request",
    discourse_genre: "business_email",
    sector: "entertainment",
    difficulty: "intermediate",
    source_text: MATERIAL_BY_ACT.request.source_text,
    ai_translations: MATERIAL_BY_ACT.request.ai_translations,
    selected_translation: "C",
    final_translation:
      "由于我方仍需等待艺人方面的最终确认,恳请贵方酌情考虑将本次资料提交时间延后十天。如由此给贵方上线安排带来不便,我们深表歉意,后续会及时同步进度。",
    final_reasoning:
      "B와 C 사이에서 오래 고민했는데, 이번 건은 상대 일정에 영향이 크다고 판단해 사유 제시와 사과 표현이 함께 들어간 C를 기본 골격으로 잡았습니다. 다만 원문보다 사과 강도가 너무 무거워지지 않도록 마지막 한 문장은 진행 상황 공유 약속으로 톤을 정리했습니다.",
    stage_durations_sec: { step1: 78, step2: 169, step3: 224, step4: 211, step5: 63 },
    total_duration_sec: 745,
    timestamp: "2026-05-21T14:30:00+09:00",
  },
];

export function seedIfEmpty() {
  try {
    if (localStorage.getItem(SEED_FLAG_KEY)) return;
    const existing = getSessions();
    if (existing.length === 0) {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(SEED_SESSIONS));
    }
    localStorage.setItem(SEED_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

// ---------- export helpers ----------

export function formatExportFilename(ext: "json" | "jsonl"): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `learning_sessions_${stamp}.${ext}`;
}

export function serializeSessions(
  sessions: LearningSession[],
  format: "json" | "jsonl",
): string {
  if (format === "jsonl") {
    return sessions.map((s) => JSON.stringify(s)).join("\n");
  }
  return JSON.stringify(sessions, null, 2);
}
