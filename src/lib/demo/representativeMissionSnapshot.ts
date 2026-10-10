// 대표 미션 승인본: scenario 24fb6841-6868-4e14-8e54-4e946466dc8e, version 93559b05-3c36-452e-b38a-bbf4964a8006(v2), 2026-10-02T07:07:12Z 연구자 직접 승인.
// mission_content_hash 0024c9117662c674380b461cd7825e44704166577de73d752f58fa65e86a063b
// 출처: docs/research-trail/evidence/2026-10-04-representative-storage-demo/approved-snapshot.json. DB 승인본에서 생성(운영 행과 정규화 JSON 동일 확인).

export const REPRESENTATIVE_MISSION_SNAPSHOT = {
  "scenario_id": "24fb6841-6868-4e14-8e54-4e946466dc8e",
  "speech_act": "request",
  "learner_level": null,
  "mission_status": "reviewed",
  "release_gate_mode": null,
  "mission_content": {
    "unit": {
      "closing_ko": "원문의 핵심 의미와 화행 목적을 지키고, 상대가 아직 수락하지 않은 부탁은 선택할 여지를 남깁니다.",
      "learner_label": "완화와 선택권",
      "target_feature": "request_mitigation_optionality",
      "target_feature_version": "1.1"
    },
    "authoring": {
      "stage": "professor_finalized",
      "lineage_status": "complete",
      "schema_version": "mission_authoring_v1",
      "repair_attempts": 0,
      "professor_issue_overrides": []
    },
    "direction": "ko_zh",
    "mpj_items": [
      {
        "id": 1,
        "pdr": {
          "d": "close",
          "p": "equal",
          "r": "low"
        },
        "type": "scale4",
        "title": "발표 파일 전달",
        "prompt": "이 번역안은 이 상황에 얼마나 잘 맞나요?",
        "source": "최종 PPT 단톡방에 올려줘.",
        "target": "把最终版PPT发到群里吧。",
        "channel": "messenger",
        "relation_ko": "친한 팀플 조원",
        "short_label": "첫인상 판단",
        "situation_ko": "친한 팀플 조원이 최종 발표 파일을 단톡방에 올리기로 했습니다. 발표 전날인데 아직 파일이 올라오지 않아 메신저로 다시 부탁합니다.",
        "explanation_ko": "이미 파일을 올리기로 한 친한 조원에게 다시 부탁하는 상황이라, `把最终版PPT发到群里吧。`처럼 把자문으로 짧게 부탁해도 자연스럽습니다.\n\n표현 메모\n· `发到群里` — 단체 대화방에 올리다. 메신저 문맥에서 `群`은 단체 대화방을 가리킬 수 있습니다.\n· `把最终版PPT发到……` — 「무엇을 어디로 보내다」를 말할 때 대상을 `把` 뒤로 옮기는 틀입니다.",
        "learner_context_ko": "친한 팀플 조원이 하기로 한 일을 메신저로 다시 부탁합니다.",
        "accepted_scale_codes": [
          "very_appropriate",
          "somewhat_appropriate"
        ],
        "reference_scale_code": "very_appropriate"
      },
      {
        "id": 2,
        "pdr": {
          "d": "acquaintance",
          "p": "speaker_lower",
          "r": "high"
        },
        "type": "scale4",
        "title": "추천서 부탁",
        "prompt": "이 번역안은 이 상황에 얼마나 잘 맞나요?",
        "source": "교수님, 안녕하세요. 교환학생 지원에 필요한 추천서를 써주실 수 있을까요? 다음 주 금요일까지 필요합니다.",
        "target": "老师您好，交换生申请需要一封推荐信，想把写推荐信这件事交给您，可以吗？下周五之前需要。",
        "channel": "email",
        "relation_ko": "수업 담당 교수님",
        "short_label": "맥락 판단",
        "situation_ko": "수업에서만 뵌 교수님께 교환학생 지원용 추천서를 처음 부탁하는 이메일입니다. 추천서는 다음 주 금요일까지 필요하며, 교수님은 작성 여부를 아직 답하지 않았습니다.",
        "reason_choice": {
          "prompt": "가장 큰 이유는 무엇인가요?",
          "options": [
            {
              "id": "request-and-deadline",
              "text": "추천서 요청 내용과 필요한 시점이 분명하게 전달되기 때문입니다."
            },
            {
              "id": "assumed-acceptance",
              "text": "작성 가능 여부나 의향을 직접 묻기보다, 추천서 작성을 교수님께 맡기는 방식으로 부탁하기 때문입니다."
            },
            {
              "id": "earlier-deadline",
              "text": "원문보다 추천서가 필요한 날짜를 일주일 앞당겼기 때문입니다."
            }
          ],
          "accepted_id": "assumed-acceptance"
        },
        "explanation_ko": "원문은 추천서의 용도와 필요한 시점을 알리면서, 교수님께 작성 가능 여부를 묻는 요청입니다.\n`想…可以吗？`로 허락을 구하고 있어 무례한 문장은 아닙니다.\n다만 `想把写推荐信这件事交给您`는 써 주실 수 있는지 묻기보다, 추천서 쓰는 일을 교수님께 맡기겠다는 틀로 부탁을 구성합니다.\n교수님의 사정이나 의향을 묻는 틀로 바꾸면 원문의 요청에 더 가까워집니다.\n\n표현 메모\n· `一封推荐信` — 추천서·편지는 양사 `封`으로 셉니다.\n· `下周五之前需要` — 다음 주 금요일까지 필요하다는 기한을 밝힙니다.",
        "revision_examples": [
          "老师您好，您能帮我写一封交换生申请的推荐信吗？下周五就需要用到。",
          "老师您好，我申请交换生需要一封推荐信，请问您方便帮我写一封吗？下周五之前需要。"
        ],
        "learner_context_ko": "수업에서만 뵌 교수님께 이메일로 처음 부탁하며, 아직 수락을 받지 않았습니다.",
        // 2026-10-09 연구자 지시: 허용 범위는 적절/부적절 경계 한쪽에만 둔다(이전 승인본은 경계를 넘어 「다소 적절」까지 허용). 운영 DB 행은 아직 옛 값.
        "accepted_scale_codes": [
          "somewhat_inappropriate",
          "very_inappropriate"
        ],
        "reference_scale_code": "somewhat_inappropriate"
      },
      {
        "id": 3,
        "pdr": {
          "d": "acquaintance",
          "p": "speaker_lower",
          "r": "mid"
        },
        "type": "fix_choice",
        "title": "출석 기록",
        "prompt": "원문의 뜻과 의도를 살려, 이 상황에 맞게 고친 표현을 골라보세요.",
        "source": "조교님, 지난주 출석이 결석으로 되어 있는데 확인해 주실 수 있나요?",
        "target": "助教您好，系统显示我上周缺勤，您必须帮我核实清楚。",
        "channel": "messenger",
        "corrections": [
          {
            "text": "助教您好，系统显示我上周缺勤，麻烦您务必帮我核实清楚。",
            "note_ko": "‘麻烦您’를 넣었지만, ‘务必’로 확인을 반드시 해 줄 일로 요구합니다. 확인을 부탁하는 원문보다 상대에게 부과하는 요구가 강합니다.",
            "is_valid": false
          },
          {
            "text": "助教您好，系统显示我上周缺勤，想麻烦您帮我核实一下。",
            "note_ko": "표시된 상태를 알리고 ‘想麻烦您帮我核实一下’로 확인을 부탁합니다. 평서형이지만 조교가 이미 맡았다고 단정하지 않으며, 출석 인정이나 기록 변경을 미리 요구하지 않습니다.",
            "is_valid": true
          },
          {
            "text": "助教您好，系统显示我上周缺勤，这件事就交给您核实了。",
            "note_ko": "확인할 내용은 유지했지만, ‘就交给您核实了’는 조교가 확인을 맡은 것처럼 말합니다. 상대가 도와줄 수 있는지 묻는 원문과 요청 방식이 다릅니다.",
            "is_valid": false
          }
        ],
        "relation_ko": "담당 조교 · 몇 번 이야기한 사이",
        "short_label": "선택교정",
        "situation_ko": "출석 앱에서 지난주 수업이 결석으로 표시된 것을 보고 조교에게 연락합니다. 표시가 잘못된 것인지는 아직 확인되지 않았습니다.",
        "explanation_ko": "원문은 결석으로 표시된 기록을 확인해 달라는 부탁이며, 오류나 수정 필요성을 확정하지 않습니다. 세 수정 후보는 같은 기록을 확인하는 내용이지만, 반드시 처리할 일로 요구하는지, 확인을 부탁하는지, 이미 맡은 일로 말하는지가 다릅니다. ‘必须帮我核实清楚’를 ‘想麻烦您帮我核实一下’로 바꾸면 강한 요구를 줄이고 도움을 부탁하는 의도를 살립니다. ‘能帮我核实一下吗？’도 가능합니다. 평서형·의문형이나 특정 단어만으로 적절성을 판정하지 않고, 이 장면의 요청 방식과 확정성을 함께 봅니다.\n\n표현 메모\n· `核实` — 사실이나 기록이 맞는지 확인하다.\n· `系统显示` — 시스템에 표시된 상태를 말하는 표현입니다.",
        "learner_context_ko": "몇 번 이야기해 본 담당 조교에게 메신저로 출석 기록 확인을 부탁합니다."
      },
      {
        "id": 4,
        "pdr": {
          "d": "acquaintance",
          "p": "equal",
          "r": "mid"
        },
        "type": "free_correction",
        "title": "리허설 일정",
        "prompt": "원문이 전달하려는 내용과 의도를 살려, 번역안을 관계와 상황에 맞게 고쳐 보세요.",
        "source": "내일 발표 리허설을 7시에서 7시 반으로 늦춰도 될까? 수업이 늦게 끝나서.",
        "target": "我下课晚，明天的彩排从七点改到七点半，就这么定了。",
        "channel": "messenger",
        "contrast": {
          "target": "明天我下课晚，咱们把彩排从七点挪到七点半，行不？",
          "context_ko": "같은 팀플 조원들과 평소에도 친하게 지내는 사이라면",
          "explanation_ko": "친한 조원들에게 편한 말투로 부탁하는 한 가지 예입니다. ‘行不？’로 동의는 여전히 구합니다. 이 표현이 친한 사이에서만 가능하거나 반드시 써야 하는 말이라는 뜻은 아닙니다."
        },
        "relation_ko": "같은 수업의 팀플 조원들",
        "short_label": "직접 고쳐 보기",
        "situation_ko": "팀플 조원들과 내일 저녁 7시에 발표 리허설을 하기로 했습니다. 수업이 늦게 끝나 30분 늦추고 싶지만, 다른 조원들의 동의는 아직 구하지 않았습니다.",
        "explanation_ko": "원문은 리허설 시간을 바꿔도 되는지 묻습니다.\n번역안은 같은 시간과 이유를 말하지만, `就这么定了`로 조원들의 동의를 구하지 않고 변경을 확정합니다.\n일정을 바꾸려는 내용은 그대로 두고, 끝을 `…吗？`·`…可以吗？`처럼 동의를 묻는 말로 바꾸면 원문의 의도가 살아납니다.\n아래 추천 표현도 모두 조원들의 동의를 묻는 형태로 끝납니다.\n\n표현 메모\n· `从A改到B` — 시간·일정을 A에서 B로 옮긴다고 말하는 틀입니다.\n· `推迟` — 예정된 시간을 뒤로 미루다(앞당기면 `提前`).\n· `彩排` — 발표·공연의 리허설.",
        "learner_context_ko": "같은 수업의 팀플 조원들과 나누는 메신저 대화입니다.",
        "reference_alternatives": [
          "明天我下课晚，彩排能从七点推迟到七点半吗？",
          "明天我下课晚，彩排从七点改到七点半，可以吗？"
        ]
      },
      {
        "id": 5,
        "pdr": {
          "d": "acquaintance",
          "p": "speaker_lower",
          "r": "low"
        },
        "type": "multi_judge",
        "title": "각 표현은 어디쯤에 놓일까요?",
        "prompt": "각 표현을 읽고, 이 상황에서 어떻게 들리는지 판단해 보세요.",
        "source": "선배, 동아리 홍보 포스터 원본 파일을 보내주실 수 있나요? 날짜만 바꾸려고요.",
        "channel": "messenger",
        "candidates": [
          {
            "text": "学姐，能把社团宣传海报的原文件发给我吗？我只改一下日期。",
            "note_ko": "`能…吗？`로 파일을 보내 줄 수 있는지 묻고, 날짜만 바꾸려는 이유를 밝힙니다.",
            "accepted_band_codes": [
              "appropriate"
            ]
          },
          {
            "text": "学姐，能麻烦您把社团宣传海报的原文件发我一下吗？我只改一下日期。",
            "note_ko": "`能麻烦您…吗？`로 파일 전달을 부탁하고, 날짜만 바꾼다고 밝혀 부탁의 범위를 한정합니다.",
            "accepted_band_codes": [
              "appropriate"
            ]
          },
          {
            "text": "学姐，我只想改一下社团宣传海报上的日期，想麻烦您把原文件发给我。",
            "note_ko": "날짜만 바꾸려는 목적을 밝히고 `想麻烦您…`로 파일을 부탁해, 이 관계에서도 자연스럽습니다.",
            "accepted_band_codes": [
              "appropriate"
            ]
          },
          {
            "text": "学姐，社团宣传海报的原文件发我，我只改一下日期。",
            "note_ko": "`原文件发我`는 파일을 보내 달라는 지시처럼 들려, 상대가 수락할 여지가 줄어듭니다.",
            "accepted_band_codes": [
              "too_direct"
            ]
          }
        ],
        "relation_ko": "한 학년 위 여자 선배",
        "short_label": "네 표현 비교",
        "situation_ko": "동아리 홍보 포스터의 날짜를 바꾸려고 지난해 담당이었던 여자 선배에게 원본 파일을 부탁합니다. 선배와는 활동 중 몇 번 이야기했고, 파일은 선배가 보관하고 있습니다.",
        "learner_context_ko": "활동 중 몇 번 이야기한 한 학년 위 여자 선배와의 메신저 대화입니다."
      }
    ],
    "provenance": {
      "model": "Claude",
      "finalized_at": "2026-10-02T07:00:39.237Z",
      "generated_at": "2026-09-26T06:24:33.817Z",
      "prompt_version": "submission_parcel_representative_20260926",
      "content_release_id": "pragma_zhko_bidirectional_candidate_20260904_02",
      "generation_attempt": 1,
      "mission_content_hash": "0024c9117662c674380b461cd7825e44704166577de73d752f58fa65e86a063b"
    },
    "item_lineage": {
      "claims": [
        {
          "note_ko": "‘把…吧’ 구조가 명령형에 가까워 요청이 명령처럼 들릴 수 있어 ‘ba_imperative_overuse’ 위험과 ‘부담 예고’ 완화 규칙이 관찰됨.",
          "claim_id": "ILC-001",
          "risk_ids": [
            "ba_imperative_overuse"
          ],
          "rule_ids": [
            "RR-KOZH-REQ-BURDEN-FOREWARNING"
          ],
          "target_path": "mpj_items[0].target",
          "evidence_ids": [
            "EV-DESIGN-KO-ZH-CORE-PACK-V1",
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION",
            "EV-OBS-ZH-BA-IMPERATIVE"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "‘可以吗’ 능원동사 완화 질문과 ‘想’ 표현으로 완화했으나, 문장이 다소 장황해 ‘learner_verbosity’ 위험이 있음.",
          "claim_id": "ILC-002",
          "risk_ids": [
            "learner_verbosity"
          ],
          "rule_ids": [
            "RR-KOZH-REQ-MODAL-QUESTION"
          ],
          "target_path": "mpj_items[1].target",
          "evidence_ids": [
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION",
            "EV-TAGUCHI-LI-2020-L2-VERBOSITY"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "‘必须’ 사용으로 내적 완화 없이 강한 명령형이며, 요청이 명령처럼 들려 ‘ba_imperative_overuse’와 ‘weak_internal_mitigation’ 위험이 있음.",
          "claim_id": "ILC-003",
          "risk_ids": [
            "ba_imperative_overuse",
            "weak_internal_mitigation"
          ],
          "rule_ids": [],
          "target_path": "mpj_items[2].target",
          "evidence_ids": [
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION",
            "EV-OBS-ZH-BA-IMPERATIVE"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "‘麻烦您’로 부담 예고 완화 시도했으나 ‘务必’가 강한 명령어로 요청을 명령처럼 만듦.",
          "claim_id": "ILC-004",
          "risk_ids": [
            "ba_imperative_overuse"
          ],
          "rule_ids": [
            "RR-KOZH-REQ-BURDEN-FOREWARNING"
          ],
          "target_path": "mpj_items[2].corrections[0]",
          "evidence_ids": [
            "EV-DESIGN-KO-ZH-CORE-PACK-V1",
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION",
            "EV-OBS-ZH-BA-IMPERATIVE"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "‘想麻烦您帮我核实一下’로 부담 예고와 완화 표현을 사용해 정중한 요청임.",
          "claim_id": "ILC-005",
          "risk_ids": [],
          "rule_ids": [
            "RR-KOZH-REQ-BURDEN-FOREWARNING"
          ],
          "target_path": "mpj_items[2].corrections[1]",
          "evidence_ids": [
            "EV-DESIGN-KO-ZH-CORE-PACK-V1",
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "‘就交给您核实了’는 조교가 확인을 맡은 것처럼 단정적으로 표현해 내적 완화 없이 요청 명제만 직진하는 표현입니다.",
          "claim_id": "ILC-006",
          "risk_ids": [
            "weak_internal_mitigation"
          ],
          "rule_ids": [],
          "target_path": "mpj_items[2].corrections[2]",
          "evidence_ids": [
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "요청이나 완화 표현이 없고 단순한 사실 진술 문장입니다.",
          "claim_id": "ILC-007",
          "risk_ids": [],
          "rule_ids": [],
          "target_path": "mpj_items[3].target",
          "evidence_ids": [],
          "attribution_status": "model_unattributed"
        },
        {
          "note_ko": "‘能…吗？’ 구조로 능원동사 완화가 실현되어 요청을 부드럽게 표현했습니다.",
          "claim_id": "ILC-008",
          "risk_ids": [],
          "rule_ids": [
            "RR-KOZH-REQ-MODAL-QUESTION"
          ],
          "target_path": "mpj_items[4].candidates[0]",
          "evidence_ids": [
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "‘能麻烦您…吗？’로 능원동사 완화와 부담 예고가 함께 실현되어 요청을 완화했습니다.",
          "claim_id": "ILC-009",
          "risk_ids": [],
          "rule_ids": [
            "RR-KOZH-REQ-MODAL-QUESTION",
            "RR-KOZH-REQ-BURDEN-FOREWARNING"
          ],
          "target_path": "mpj_items[4].candidates[1]",
          "evidence_ids": [
            "EV-DESIGN-KO-ZH-CORE-PACK-V1",
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "‘想麻烦您…’로 부담 예고가 실현되어 요청을 부드럽게 표현했습니다.",
          "claim_id": "ILC-010",
          "risk_ids": [],
          "rule_ids": [
            "RR-KOZH-REQ-BURDEN-FOREWARNING"
          ],
          "target_path": "mpj_items[4].candidates[2]",
          "evidence_ids": [
            "EV-DESIGN-KO-ZH-CORE-PACK-V1",
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "‘原文件发我’ 표현이 명령형으로 들려 요청이 아닌 지시처럼 느껴집니다.",
          "claim_id": "ILC-011",
          "risk_ids": [
            "ba_imperative_overuse"
          ],
          "rule_ids": [],
          "target_path": "mpj_items[4].candidates[3]",
          "evidence_ids": [
            "EV-OBS-ZH-BA-IMPERATIVE"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "‘能麻烦您帮我…吗？’와 ‘如果方便的话’로 완화하고 부담을 예고하여 상대가 선택할 여지를 줍니다.",
          "claim_id": "ILC-012",
          "risk_ids": [],
          "rule_ids": [
            "RR-KOZH-REQ-MODAL-QUESTION",
            "RR-KOZH-REQ-CONDITIONAL-PREFACE",
            "RR-KOZH-REQ-BURDEN-FOREWARNING"
          ],
          "target_path": "production_task.reference_alternatives[0]",
          "evidence_ids": [
            "EV-DESIGN-KO-ZH-CORE-PACK-V1",
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION"
          ],
          "attribution_status": "model_claimed"
        },
        {
          "note_ko": "‘能麻烦您先帮我…吗？’와 ‘方便的话’로 완화하고 부담을 예고하여 상대가 선택할 여지를 남깁니다.",
          "claim_id": "ILC-013",
          "risk_ids": [],
          "rule_ids": [
            "RR-KOZH-REQ-MODAL-QUESTION",
            "RR-KOZH-REQ-CONDITIONAL-PREFACE",
            "RR-KOZH-REQ-BURDEN-FOREWARNING"
          ],
          "target_path": "production_task.reference_alternatives[1]",
          "evidence_ids": [
            "EV-DESIGN-KO-ZH-CORE-PACK-V1",
            "EV-LI-TAGUCHI-2026-REQUEST-MODIFICATION"
          ],
          "attribution_status": "model_claimed"
        }
      ],
      "claim_status": "model_attribution_pending_review",
      "schema_version": "mission_item_lineage_v1",
      "coverage_summary": {
        "total_count": 13,
        "claimed_count": 12,
        "unattributed_count": 1
      },
      "realization_pack_id": "pragma_ko_zh_request_refusal_thanks_v1",
      "attribution_provenance": {
        "calls": [
          {
            "model": "gpt-4.1-mini",
            "attempts": 1,
            "batch_index": 1,
            "target_count": 5,
            "prompt_instance_hash": "d93eb1d16656adbd8830a0052c41dbee1ed0cd7b1fc2d9a8e9a72c927a25a913"
          },
          {
            "model": "gpt-4.1-mini",
            "attempts": 1,
            "batch_index": 2,
            "target_count": 5,
            "prompt_instance_hash": "2ef3f68388381173390ef6150653ab5ee1adbd160208ff045e6ca3f09403ba28"
          },
          {
            "model": "gpt-4.1-mini",
            "attempts": 1,
            "batch_index": 3,
            "target_count": 3,
            "prompt_instance_hash": "ca2f269ea7407a26dbe9905429469ba8e385469a2947feda2bc6815448ecf762"
          }
        ],
        "model": "gpt-4.1-mini",
        "provider": "openai",
        "batch_count": 3,
        "attributed_at": "2026-10-02T07:00:38.630Z",
        "prompt_version": "item_lineage_attribution_v4_mission_v5_mpj5",
        "attribution_attempts": 3,
        "prompt_instance_hash": "f1493540a23087cf010984474531039cf959a71e4c426a92ec696974d49183f7"
      },
      "realization_pack_version": "1.2.0"
    },
    "learning_goal": {
      "kind": "speech_act",
      "speech_act": "request"
    },
    "lesson_points": [
      {
        "text": "이미 파일을 올리기로 한 친한 조원에게 「把最终版PPT发到群里吧」처럼 짧게 다시 부탁할 수 있습니다. 친밀도만으로 모든 짧은 지시가 적절해지는 것은 아닙니다.",
        "label": "짧아도 자연스러운 부탁",
        "item_id": 1
      },
      {
        "text": "「想把写推荐信这件事交给您，可以吗？」는 허락을 구하지만 일을 맡기는 틀입니다. 「请问您方便帮我写一封吗？」는 교수님의 사정과 의향을 묻습니다.",
        "label": "맡기는 틀과 묻는 틀",
        "item_id": 2
      },
      {
        "text": "「想麻烦您帮我核实一下」는 평서형으로도 확인을 부탁합니다. 반드시 처리하라는 요구나 이미 맡았다는 단정과 구별합니다.",
        "label": "확인 부탁의 강도와 확정성",
        "item_id": 3
      },
      {
        "text": "「就这么定了」를 「能从七点推迟到七点半吗？」로 바꾸면 시간과 이유를 유지하면서 조원들의 동의를 구합니다.",
        "label": "직접 고쳐 보기",
        "item_id": 4
      },
      {
        "text": "「能把……发给我吗？」와 「想麻烦您把原文件发给我」는 모두 가능합니다. 문형보다 요청 내용과 상대의 선택권을 봅니다.",
        "label": "적절한 표현은 여러 가지",
        "item_id": 5
      }
    ],
    "schema_version": "mission_v6",
    "production_task": {
      "pdr": {
        "d": "acquaintance",
        "p": "equal",
        "r": "mid"
      },
      "mode": "translation",
      "channel": "messenger",
      "relation_ko": "연락처는 주고받았지만 평소 인사만 하는 옆집 이웃",
      "source_text": "안녕하세요. 이번 주말에 집을 비운 사이 택배가 집 앞에 도착했네요. 일요일 저녁에 돌아갈 예정인데, 그때까지 잠시 보관해 주실 수 있을까요? 번거로우시겠지만 가능하시면 정말 감사하겠습니다.",
      "situation_ko": "저는 중국에 살고 있고, 같은 아파트 옆집에 사는 중국인 이웃에게 메신저로 메시지를 보냅니다. 서로 연락처는 주고받았지만 평소에는 마주치면 인사하는 정도입니다. 주말 동안 집을 비운 사이 택배가 집 앞에 도착해서, 일요일 저녁에 돌아갈 때까지 잠시 보관해 달라고 처음 부탁하려 합니다.",
      "focal_segments": [
        {
          "role": "head",
          "text": "그때까지 잠시 보관해 주실 수 있을까요?"
        },
        {
          "role": "support",
          "text": "번거로우시겠지만 가능하시면 정말 감사하겠습니다."
        }
      ],
      "preceding_turn": null,
      "source_modality": "written",
      "vocabulary_hints": [
        {
          "source": "택배",
          "target": "快递"
        },
        {
          "source": "잠시 보관하다",
          "target": "保管"
        }
      ],
      "learner_context_ko": "연락처는 주고받았지만 평소 인사만 하는 옆집 이웃에게 메시지를 보냅니다.",
      "reference_alternatives": [
        {
          "text": "您好，这周末我不在家，快递已经送到我家门口了。我周日晚上回去，能麻烦您帮我保管到那时候吗？如果方便的话，真的非常感谢。",
          "note_ko": "택배가 이미 집 앞에 와 있고 일요일 저녁에 돌아간다는 사정을 밝힌 뒤, `保管到那时候`로 그때까지 잠시 맡아 달라는 범위를 분명히 합니다. `能麻烦您…吗？`와 `如果方便的话`로 상대가 정할 여지를 남깁니다."
        },
        {
          "text": "您好，我这周末不在家，快递已经送到我家门口了。我周日晚上回来，能麻烦您先帮我拿到您家放一下吗？方便的话就太感谢了！",
          "note_ko": "`拿到您家放一下`로 돌아올 때까지 이웃 집에 잠시 맡아 두는 일을 `保管`보다 가볍고 구어적으로 말합니다. `能麻烦您先…吗？`로 부담을 인정하며 묻고, `方便的话`로 상대가 정할 여지를 남깁니다."
        }
      ]
    },
    "hsk_lexical_audit": {
      "note": "Candidate review only: unmatched tokens may be proper nouns, terms, segmentation units, or vocabulary above/outside the reference dataset.",
      "scope": "zh_target_mission",
      "status": "complete",
      "direction": "ko_zh",
      "source_id": "hsk30_syllabus_2025_11_effective_2026_07",
      "non_blocking": true,
      "coverage_ratio": 0.7347,
      "policy_version": "hsk3_lexical_reference_v1",
      "reference_ceiling": 5,
      "matched_token_count": 72,
      "distinct_token_count": 98,
      "out_of_reference_candidates": [
        "版",
        "您好",
        "一封",
        "想把",
        "交给",
        "周五",
        "助教",
        "上周",
        "缺勤",
        "核实",
        "务必",
        "彩排",
        "改到",
        "姐",
        "社团",
        "海报",
        "我吗",
        "我只",
        "只想",
        "不在家",
        "送到",
        "我家",
        "周日",
        "保管",
        "真的",
        "拿到"
      ]
    }
  }
};
