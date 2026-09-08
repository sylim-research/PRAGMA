import { describe, expect, it } from "vitest";
import { prepareTeachingMaterial, applyTeachingDraft } from "./teachingGeneration";
import { buildContentReviewDomain } from "@/lib/pragma/contentReviewDomain";
import { buildWeeklyMaterialsHtml } from "@/lib/pragma/instructorGuideHtml";
import { SAMPLE_MISSION_V5_NATIVE } from "@/lib/mission/missionV4Sample";
import { CURRENT_CONTENT_RELEASE_ID } from "../../../supabase/functions/_shared/contentRelease";
import { buildTeachingPrompt, TEACHING_SECTION_KEYS, teachingKind, validateTeachingContent,
  type TeachingContent, type TeachingDraft, type TeachingKind } from "../../../supabase/functions/_shared/teachingMaterial";

const config = { missionIds: ["t", "i"], extraText: "", extraRef: "" };
const base = (weekNo = 2) => ({
  outline: { id: "course", title: "화용 수업", level: "intermediate", language_direction: "ko_zh", course_mode: "mixed", target_interpreting_week_count: 10 },
  week: { week_no: weekNo, type: "regular", title: "요청", speech_act: weekNo === 7 || weekNo === 14 ? null : "request", can_do: ["상황에 비추어 요청 표현의 판단 근거를 설명한다."] },
  assignments: weekNo === 7 || weekNo === 14 ? [] : [{ scenario_id: "t", week_no: weekNo, position: 0 }, { scenario_id: "i", week_no: weekNo, position: 1 }],
  scenarios: weekNo === 7 || weekNo === 14 ? [] : references(),
});
function references() {
  return ["translation", "stt_interpreting"].map((mode, index) => ({ scenario_id: index ? "i" : "t", week_no: 2,
    speech_act: "request", learner_level: "intermediate", mode, mission_status: "reviewed", content_release_id: CURRENT_CONTENT_RELEASE_ID,
    core_content: { direction: "ko_zh", situation_ko: "같은 직장의 동료에게 파일을 요청합니다.", source_text: "파일을 보내 주세요." },
    mission_content: { ...SAMPLE_MISSION_V5_NATIVE, quality_check: { secret: "PRIOR_CRITIC_SENTINEL" } },
  }));
}
function content(kind: TeachingKind = "lesson"): TeachingContent {
  return { sections: TEACHING_SECTION_KEYS[kind].map((key) => ({ key, title: key, paragraphs: ["관계와 부담에 비추어 판단합니다."],
    items: ["왜 그렇게 판단했나요?"], source_ids: ["M1"] })), instructor_notes: [{ title: "교수자 안내", body: "PRIVATE_GUIDE_SENTINEL", source_ids: ["M1"] }] };
}
function draft(kind: TeachingKind = "lesson", weekNo = 2): TeachingDraft {
  return { id: "draft", outline_id: "course", week_no: weekNo, revision: 1, kind, source_hash: "hash", source_config: config,
    sources: [{ id: "M1", label: "2주차 통역 미션", text: "RAW_SOURCE_SENTINEL" }], content: content(kind),
    provenance: { model: "test", prompt_version: "weekly_teaching_v1", input_hash: "hash", response_id: "id" }, created_at: "2026-09-08" };
}

describe("GOLD 수업자료·메타화용 토론", () => {
  it("only maps ten speech-act weeks and two discussion weeks", () => {
    const kinds = Array.from({ length: 15 }, (_, i) => teachingKind(i + 1, i === 0 ? "orientation" : i === 7 ? "midterm" : i === 14 ? "final" : "regular"));
    expect(kinds.filter((kind) => kind === "lesson")).toHaveLength(10);
    expect(kinds.filter((kind) => kind === "discussion")).toHaveLength(2);
    expect(teachingKind(8, "regular")).toBeNull();
    expect(teachingKind(7, "midterm")).toBeNull();
  });
  it("grounds lessons in the complete assigned pair and strips prior model judgments", () => {
    const prepared = prepareTeachingMaterial({ base: base(), references: references() }, config);
    expect(prepared.kind).toBe("lesson");
    expect(prepared.material.missions).toHaveLength(2);
    expect(prepared.prompt.user).toContain("파일을 보내 주세요.");
    expect(prepared.prompt.user).not.toContain("PRIOR_CRITIC_SENTINEL");
    expect(() => prepareTeachingMaterial({ base: { ...base(), scenarios: references().slice(0, 1) }, references: references() }, config)).toThrow("미션 2개");
  });
  it.each([7, 14])("prepares discussion week %i from prior material without requiring learner data", (weekNo) => {
    const prepared = prepareTeachingMaterial({ base: base(weekNo), references: references() }, config);
    expect(prepared.kind).toBe("discussion");
    expect(prepared.material.missions).toHaveLength(0);
    expect(prepared.prompt.user).toContain(`2~${weekNo - 1}주차`);
    expect(prepared.prompt.system).toContain("기록이 없어도 제시 사례로 참여");
  });
  it("requires source attribution, rejects oversized input and never cuts selected text", () => {
    expect(() => prepareTeachingMaterial({ base: base(), references: references() }, { ...config, extraText: "본문" })).toThrow("출처");
    expect(() => buildTeachingPrompt("lesson", {}, [{ id: "S1", label: "큰 자료", text: "a".repeat(100001) }])).toThrow("임의로 자르지");
    const prepared = prepareTeachingMaterial({ base: base(), references: references() }, { ...config, extraText: "확인한 원문 그대로", extraRef: "문헌 12쪽" });
    expect(prepared.sources.at(-1)?.text).toBe("확인한 원문 그대로");
    expect(() => prepareTeachingMaterial({ base: base(), references: references().map((row) => ({ ...row, learner_level: "advanced" })) }, config)).toThrow("수준");
  });
  it("rejects missing sections, unknown sources and extra private fields", () => {
    expect(validateTeachingContent(content(), "lesson", ["M1"])).toEqual(content());
    const bad = content(); bad.sections[0].source_ids = ["invented"];
    expect(() => validateTeachingContent(bad, "lesson", ["M1"])).toThrow();
    expect(() => validateTeachingContent({ ...content(), learner_results: [] }, "lesson", ["M1"])).toThrow();
    expect(() => validateTeachingContent({ ...content(), sections: content().sections.slice(1) }, "lesson", ["M1"])).toThrow();
    expect(() => validateTeachingContent(content("discussion"), "lesson", ["M1"])).toThrow();
  });
  it("public handout and HTML exclude raw sources and teacher notes", () => {
    const prepared = prepareTeachingMaterial({ base: base(), references: references() }, config);
    const material = applyTeachingDraft(prepared.material, draft());
    for (const output of [JSON.stringify(material), buildWeeklyMaterialsHtml(material)]) {
      expect(output).toContain("왜 그렇게 판단했나요?");
      expect(output).not.toContain("PRIVATE_GUIDE_SENTINEL");
      expect(output).not.toContain("RAW_SOURCE_SENTINEL");
    }
  });
  it("review accepts complete discussion content, includes dependencies, and fails stale or missing drafts", () => {
    const source = { ...base(7), teaching_draft: draft("discussion", 7), teaching_current: true, teaching_references: references() };
    const result = buildContentReviewDomain("weekly_material", source);
    expect(result.rules.verdict).toBe("pass");
    expect(result.dependencies).toEqual(["t", "i"]);
    expect(JSON.stringify(result.snapshot.content.instructor_only)).toContain("PRIVATE_GUIDE_SENTINEL");
    expect(JSON.stringify(result.snapshot.content.public_material)).not.toContain("PRIVATE_GUIDE_SENTINEL");
    expect(buildContentReviewDomain("weekly_material", { ...source, teaching_current: false }).rules.verdict).toBe("fail");
    expect(buildContentReviewDomain("weekly_material", base(7)).rules.verdict).toBe("fail");
    expect(buildContentReviewDomain("weekly_material", { ...source, week: { ...source.week, week_no: 8, type: "midterm" } }).rules.verdict).toBe("fail");
  });
});
