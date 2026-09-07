import { describe, expect, it } from "vitest";

import { checkCore, type CheckContext } from "@/lib/pragma/missionRules";

const baseContext: CheckContext = {
  speech_act: "request",
  level: "intermediate",
  domain: "work",
  theme_code: "career_workplace",
  topic_code: "schedule_change",
  mode: "translation",
  source_modality: "written",
};

const baseCore = {
  schema_version: "scenario_core_v1",
  situation_ko: "거래처 담당자에게 일정 변경 요청을 글로 작성해 보낸다.",
  relation_ko: "거래처 담당자와 실무자 관계",
  source_modality: "written",
  source_text_ko: "회의를 하루 앞당길 수 있을까요?",
  preceding_turn_zh: null,
  pdr: { p: "speaker_lower", d: "acquaintance", r: "mid" },
  channel: "messenger",
};

const r16Fails = (core: unknown, context: CheckContext) =>
  checkCore(core, context).violations.filter(
    (violation) => violation.id === "R16" && violation.level === "fail",
  );

const r30Fails = (core: unknown, context: CheckContext) =>
  checkCore(core, context).violations.filter(
    (violation) => violation.id === "R30" && violation.level === "fail",
  );

const r16Warnings = (core: unknown, context: CheckContext) =>
  checkCore(core, context).violations.filter(
    (violation) => violation.id === "R16" && violation.level === "warning",
  );

describe("R16 명시적 수행 모드 모순", () => {
  it("번역 셀에서 글을 부정하고 직접 말한다고 하면 저장 전 차단한다", () => {
    const core = {
      ...baseCore,
      situation_ko:
        "발표를 마친 뒤 상대를 칭찬한다. 글로 남기지 않고 직접 말하는 상황이다.",
    };

    expect(r16Fails(core, baseContext).map((item) => item.message)).toContainEqual(
      expect.stringContaining("구두 수행을 명시"),
    );
  });

  it("통역 셀에서 이메일로 작성해 보낸다고 하면 저장 전 차단한다", () => {
    const core = {
      ...baseCore,
      situation_ko: "담당자에게 일정 변경 요청을 이메일로 작성해 보내는 상황이다.",
      source_modality: "spoken",
      channel: "facetoface",
    };
    const context: CheckContext = {
      ...baseContext,
      mode: "stt_interpreting",
      source_modality: "spoken",
    };

    expect(r16Fails(core, context).map((item) => item.message)).toContainEqual(
      expect.stringContaining("서면 수행을 명시"),
    );
  });

  it("번역 셀의 즉시 반응 기대와 통역 셀의 직접 대화는 각각 허용한다", () => {
    const written = {
      ...baseCore,
      situation_ko: "메신저로 글을 보내며 상대의 즉시 반응을 기대하는 상황이다.",
    };
    const writtenNotice = {
      ...baseCore,
      situation_ko:
        "어려움을 정중하지만 분명한 어조로 글로 작성해 알리는 상황이다. 메시지는 기록으로 남는다.",
    };
    const writtenBecauseSpeakingIsAwkward = {
      ...baseCore,
      situation_ko:
        "이웃 간에 소음 문제로 서로 불편함을 느껴 글로 정중하게 부탁하는 상황이다. 직접 만나서 말하기는 어색하여 편지나 메모 형태로 요청을 전한다.",
    };
    const writtenWithoutImmediateResponse = {
      ...baseCore,
      situation_ko:
        "몇 차례 얼굴을 마주친 적 있는 이웃에게 소음 문제에 대해 글로 정중히 부탁하는 상황이다. 상대방이 내용을 충분히 검토할 수 있도록 글로 남기며 즉각적인 반응은 기대하지 않는다. 요청 사항은 이웃이 직접 소음을 줄이는 행동을 할 수 있는 범위 내에 있다.",
    };
    const spoken = {
      ...baseCore,
      situation_ko:
        "한국어 원발화자가 중국어 청자에게 일정 변경을 요청하며, 학습자는 두 사람 사이에서 통역한다.",
      source_modality: "spoken",
      channel: "facetoface",
    };
    const spokenContext: CheckContext = {
      ...baseContext,
      mode: "stt_interpreting",
      source_modality: "spoken",
    };

    expect(r16Fails(written, baseContext)).toEqual([]);
    expect(r16Fails(writtenNotice, baseContext)).toEqual([]);
    expect(r16Fails(writtenBecauseSpeakingIsAwkward, baseContext)).toEqual([]);
    expect(r16Fails(writtenWithoutImmediateResponse, baseContext)).toEqual([]);
    expect(r16Fails(spoken, spokenContext)).toEqual([]);
  });

  // 2026-07-31 495 본배치 회귀: 통역 셀 4건이 "기록으로 남기지는 않습니다"류 부정
  // 표현에서 오탐으로 버려졌다. 부정은 보조사·거리·어간 축약을 함께 처리해야 한다.
  describe("통역 셀에서 서면을 부정하는 표현은 오탐이 아니다", () => {
    const spokenContext: CheckContext = {
      ...baseContext,
      mode: "stt_interpreting",
      source_modality: "spoken",
    };
    const spokenCore = (situation_ko: string) => ({
      ...baseCore,
      situation_ko: `한국어 원발화자와 중국어 청자가 대화하며, 학습자는 두 사람 사이에서 통역한다. ${situation_ko}`,
      source_modality: "spoken",
      channel: "facetoface",
    });

    it.each([
      ["보조사가 낀 부정", "이 대화는 직접 말하는 자리이고, 즉각적인 반응을 기대하지만 공식 기록으로 남기지는 않습니다."],
      ["부정어가 멀리 있는 경우", "회의실에서 직접 알리는 상황입니다. 상대는 즉시 반응을 기대하지만, 이 요청은 기록으로 남기려는 목적은 아닙니다."],
      ["어간이 줄어든 부정", "직접 감사의 말을 전하는 장면이다. 이 감사는 구두로 전달되어 기록으로 남지 않으며, 후배가 자발적으로 도운 상황이다."],
      ["지+ㄴ 축약 부정", "학생들이 모여 직접 말로 의견을 나누는 자리입니다. 제안 내용은 기록으로 남기진 않지만 모두가 함께 결정할 사안입니다."],
    ])("%s", (_label, situation) => {
      expect(r16Fails(spokenCore(situation), spokenContext)).toEqual([]);
    });

    // `직접`이 발화가 아닌 동사를 수식하는데 구두 장면으로 오인해 번역 셀을 버렸다.
    it("번역 셀에서 '직접 수행'은 구두 수행 명시가 아니다", () => {
      const core = {
        ...baseCore,
        situation_ko:
          "조별 과제 진행 상황을 점검하기 위해 조장이 조원에게 메시지를 작성한다. 상대가 직접 수행할 수 있는 과제 관련 행동을 요청하며, 조원은 이 요청을 검토하고 선택할 수 있다. 글로 남기는 공식적인 요청이다.",
      };
      expect(r16Fails(core, baseContext)).toEqual([]);
    });

    it("진짜 서면 장면은 그대로 차단한다 — 활용형이 바뀌어도", () => {
      expect(
        r16Fails(spokenCore("사내 메신저로 참여를 부탁하는 메시지를 작성한다."), spokenContext),
      ).not.toEqual([]);
      expect(
        r16Fails(spokenCore("이 초대는 기록으로 남기며, 팀장의 참여 여부를 존중한다."), spokenContext),
      ).not.toEqual([]);
    });
  });

  describe("통역 장면의 이중언어 참여자", () => {
    const spokenContext: CheckContext = {
      ...baseContext,
      mode: "stt_interpreting",
      source_modality: "spoken",
    };
    const spokenCore = (situation_ko: string) => ({
      ...baseCore,
      situation_ko,
      source_modality: "spoken",
      channel: "facetoface",
    });

    it("통역사 소개 없이 자연스러운 1인칭 훈련 장면을 허용한다", () => {
      expect(r16Fails(spokenCore("나는 접수 직원에게 예약 변경을 문의합니다. 진료 시간과 회의가 겹칩니다."), spokenContext)).toEqual([]);
    });

    it("원발화자·학습자 통역사·청자의 세 역할이 분리된 장면은 통과한다", () => {
      expect(
        r16Fails(
          spokenCore(
            "한국어 원발화자와 중국어 청자가 예산을 논의하며, 학습자는 두 사람 사이에서 순차통역한다.",
          ),
          spokenContext,
        ),
      ).toEqual([]);
    });

    it("역할 명사가 분리되면 '두 사람 사이'라는 고정 문구를 요구하지 않는다", () => {
      expect(
        r16Fails(
          spokenCore(
            "한국어 원발화자인 담당자가 중국인 직원에게 감사하고, 학습자는 이 대화를 통역하는 통역사 역할을 맡는다.",
          ),
          spokenContext,
        ),
      ).toEqual([]);
    });

    it("역할 소개 생략과 직접 대화에 기계적인 역할 경고를 붙이지 않는다", () => {
      expect(r16Warnings(spokenCore("나는 동료와 회의 일정을 직접 논의합니다. 이번 주에 함께 진행할 발표가 있습니다."), spokenContext)).toEqual([]);
    });

    it("신규 통역 코어는 구조화된 A/B/C·PDR 역할 계약도 필요하다", () => {
      const strictContext: CheckContext = {
        ...spokenContext,
        require_context_spec: true,
      };
      const situation =
        "한국어 원발화자와 중국어 청자가 예산을 논의하며, 학습자는 두 사람 사이에서 통역한다.";
      const commonSpec = {
        standard_situation_code: "work.schedule_change.request",
        role_pair: { speaker_ko: "한국 담당자", addressee_ko: "중국 담당자" },
        speaker_entitlement: "요청 권한",
        addressee_obligation: "검토 권한",
        decision_authority: "상대가 결정",
      };
      const missingContract = spokenCore(situation) as typeof baseCore & {
        context_spec?: typeof commonSpec;
      };
      missingContract.context_spec = commonSpec;
      const withContract = {
        ...spokenCore(situation),
        context_spec: {
          ...commonSpec,
          interpreter_role_contract: {
            source_speaker: "A",
            target_addressee: "B",
            learner_interpreter: "C",
            pdr_relation: "A_to_B",
          },
        },
      };

      expect(
        checkCore(missingContract, strictContext).violations.map((item) => item.message),
      ).toContainEqual(expect.stringContaining("A/B/C 및 P·D·R=A↔B"));
      expect(
        checkCore(withContract, strictContext).violations.filter(
          (item) => item.id === "R25" && item.level === "fail",
        ),
      ).toEqual([]);
    });
  });

  describe("R30 학생용 평가 기준 비노출", () => {
    it("정중성·부담 완화 방향을 상황문에 알려 주면 저장 전 차단한다", () => {
      const core = {
        ...baseCore,
        situation_ko:
          "처음 만난 협력 기관 담당자를 발표회에 부담을 주지 않으면서도 정중하게 초대한다.",
      };
      expect(r30Fails(core, baseContext)).not.toEqual([]);
    });

    it("관찰 가능한 상대·용건만 제시한 상황문은 통과한다", () => {
      const core = {
        ...baseCore,
        situation_ko: "처음 만난 협력 기관 담당자를 금요일 발표회와 점심 모임에 초대한다.",
      };
      expect(r30Fails(core, baseContext)).toEqual([]);
    });
  });
});
