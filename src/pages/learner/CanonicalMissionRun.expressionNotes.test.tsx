import { describe, expect, it } from "vitest";
import { collectExpressionNotes } from "./CanonicalMissionRun";
import type { MissionQuest } from "@/lib/mission/canonicalMissionPreview";

const quest = (feedback: string) => ({ id: "A1", kind: "scale", feedback } as unknown as MissionQuest);

describe("collectExpressionNotes", () => {
  it("메모가 없는 해설에서는 아무것도 모으지 않는다", () => {
    expect(collectExpressionNotes([quest("이미 올리기로 한 파일을 상기하는 장면입니다.")])).toEqual([]);
  });

  it("한→중 메모의 표현과 첫 문장만 모은다", () => {
    const notes = collectExpressionNotes([
      quest(
        "짧은 부탁도 자연스럽습니다.\n표현 메모\n" +
          "· `发到群里` — 단체 대화방에 올리다. 메신저 문맥에서 `群`은 단체 대화방을 가리킬 수 있습니다.\n" +
          "· `一封推荐信` — 추천서·편지는 양사 `封`으로 셉니다.",
      ),
    ]);
    expect(notes).toEqual([
      { term: "`发到群里`", gloss: "단체 대화방에 올리다." },
      { term: "`一封推荐信`", gloss: "추천서·편지는 양사 `封`으로 셉니다." },
    ]);
  });

  it("중→한 메모의 「」 표현도 모으고, 같은 표현은 한 번만 남긴다", () => {
    const notes = collectExpressionNotes([
      quest("해설.\n표현 메모\n· 「이따」 — `等下`에 대응하는 구어. '조금 뒤에'라는 뜻입니다."),
      quest("다른 해설.\n표현 메모\n· 「이따」 — 같은 표현이 다시 나온 경우입니다."),
    ]);
    expect(notes).toEqual([{ term: "「이따」", gloss: "`等下`에 대응하는 구어." }]);
  });

  it("불릿이 아닌 줄을 만나면 그 뒤는 읽지 않는다", () => {
    const notes = collectExpressionNotes([
      quest("해설.\n표현 메모\n· `核实` — 사실이나 기록이 맞는지 확인하다.\n덧붙이는 다른 문단입니다.\n· `系统显示` — 읽히면 안 됩니다."),
    ]);
    expect(notes).toEqual([{ term: "`核实`", gloss: "사실이나 기록이 맞는지 확인하다." }]);
  });
});
