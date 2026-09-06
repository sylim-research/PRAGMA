// Curriculum domain types.
//
// Two layers, deliberately separated:
//  - DB layer: aliases of the Supabase-generated Row/Insert/Update types
//    (never hand-written — always derived from Database via helpers).
//  - UI layer: *Draft types used by the admin editing UI. snake_case kept to
//    match the project's form conventions (see AdminGenerator FormState).
//
// Conversion between the two lives in ./mappers.ts.

import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
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
} from "@/lib/pragma/enums";
import type { ThemeCode } from "@/lib/pragma/scenarioTopics";
import type { CourseMode } from "@/lib/curriculum/courseModePolicy";

// ── DB aliases (source of truth: Supabase generated types) ──
export type CurriculumOutlineRow = Tables<"curriculum_outlines">;
export type CurriculumOutlineInsert = TablesInsert<"curriculum_outlines">;
export type CurriculumOutlineUpdate = TablesUpdate<"curriculum_outlines">;
export type CurriculumWeekRow = Tables<"curriculum_weeks">;
export type CurriculumWeekInsert = TablesInsert<"curriculum_weeks">;
export type CurriculumWeekUpdate = TablesUpdate<"curriculum_weeks">;

// ── Curriculum-only value sets (DB stores text + CHECK; app narrows here) ──
export type CurriculumStatus = "draft" | "published" | "archived";
export type CurriculumWeekType = "orientation" | "regular" | "midterm" | "final";

// ── UI draft types ──
//
// Null/empty-string policy (applied consistently in mappers.ts):
//  - Free-text fields (title, semester_goal, competency_focus):
//    draft uses string, DB null becomes "" on load, "" becomes null on save
//    (outline.title is NOT NULL in DB and stays a plain string).
//  - Selection fields (speech_act, channel, pdr_*, domain, industry) and
//    numeric optionals (curriculum_load_band, scenario_slots, midterm_week,
//    final_week): draft uses `| null`, null = 미선택 상태. Saved as null.
//  - Arrays (target_speech_acts, can_do): draft always holds an array
//    (DB null loads as []); saved as null when empty for nullable columns.
//  - id / outline_id: `string | null` — null means "not persisted yet".
//  - created_at / updated_at: DB-managed, never present on drafts.
//  - mode: not a field anywhere (derived from channel at display time only).

export interface CurriculumOutlineDraft {
  id: string | null;
  title: string;
  status: CurriculumStatus;
  level: LearnerLevel;
  language_direction: LanguageDirection;
  domain: Domain;
  industry: IndustrySector | null;
  semester_goal: string;
  target_speech_acts: SpeechActUI[];
  week_count: number;
  midterm_week: number | null;
  final_week: number | null;
  scenarios_per_week: number;
  /** 자동 편성에서 허용할 주제. 빈 배열은 전체 주제. */
  composition_theme_codes: ThemeCode[];
  /** 번역·통역 전용 또는 화행 주차마다 번역 1개·통역 1개를 수행하는 통번역형. */
  course_mode: CourseMode;
  /** 과거 주수 정책의 저장 호환값. 현행 미션 모드 배분에는 사용하지 않는다. */
  target_interpreting_week_count: number;
}

export interface CurriculumWeekDraft {
  id: string | null;
  outline_id: string | null;
  week_no: number;
  type: CurriculumWeekType;
  title: string;
  can_do: string[];
  speech_act: SpeechActUI | null;
  channel: ChannelUI | null;
  pdr_power: PdrPower | null;
  pdr_distance: PdrDistance | null;
  // Curriculum-side name is pdr_imposition (values high|low, same set as the
  // generator's PdrBurden type — reused here; the pdr_burden KEY mapping for
  // the Generator handoff is out of scope for these types).
  pdr_imposition: PdrBurden | null;
  /** 과거 복습면 공개 상태. 기록 호환을 위해 보존하며 현행 강의 유인물은 사용하지 않는다. */
  review_released: boolean;
  curriculum_load_band: number | null;
  competency_focus: string;
  domain: Domain | null;
  industry: IndustrySector | null;
  scenario_slots: number | null;
}
