import { describe, expect, it } from "vitest";
import { collectExpressionNotes, splitExpressionMemo } from "./CanonicalMissionRun";
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

describe("splitExpressionMemo", () => {
  it("메모가 없으면 해설 문단만 돌려준다", () => {
    expect(splitExpressionMemo("원문은 허락을 묻습니다.\n\n시간과 이유를 유지해 보세요.")).toEqual({
      paragraphs: ["원문은 허락을 묻습니다.", "시간과 이유를 유지해 보세요."],
      memo: [],
    });
  });

  it("문항 화면이 해설과 표현 메모를 따로 그릴 수 있게 가른다", () => {
    expect(
      splitExpressionMemo(
        "원문은 변경 허락을 묻습니다.\n표현 메모\n· `从A改到B` — 시간을 옮긴다고 말하는 틀입니다.\n· `推迟` — 예정된 시간을 뒤로 미루다.",
      ),
    ).toEqual({
      paragraphs: ["원문은 변경 허락을 묻습니다."],
      memo: ["`从A改到B` — 시간을 옮긴다고 말하는 틀입니다.", "`推迟` — 예정된 시간을 뒤로 미루다."],
    });
  });

  it("메모 블록 뒤에 불릿이 아닌 줄이 오면 거기서 멈춘다", () => {
    expect(splitExpressionMemo("해설.\n표현 메모\n· 「이따」 — 조금 뒤에.\n덧붙임\n· 「캡처」 — 읽히면 안 됩니다.").memo)
      .toEqual(["「이따」 — 조금 뒤에."]);
  });
});
