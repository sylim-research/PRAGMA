// 논문 4.3.4 회의 일정 변경 요청 승인본. 운영 DB 읽기 조회: 2026-10-06.
// 수행 기록 1f90aac0-21f7-4b54-abe9-5f946f1be534 (2026-10-05)의 원문·피드백과 대조.
export const REVERSE_REPRESENTATIVE_SNAPSHOT = {
  "scenario_id": "a44d3c46-4ec2-428e-a056-3ff65bea0d57",
  "speech_act": "request",
  "learner_level": "intermediate",
  "mission_status": "reviewed",
  "release_gate_mode": "legacy_reviewed",
  "mission_content": {
    "unit": {
      "closing_ko": "요청은 표현형이나 친밀도만으로 판단하지 않습니다. 원문의 뜻을 지키며 상황에 필요한 명료성과 상대의 선택권을 함께 살핍니다.",
      "learner_label": "완화와 선택권",
      "target_feature": "request_mitigation_optionality",
      "target_feature_version": "1.1"
    },
    "authoring": {
      "stage": "professor_finalized",
      "lineage_status": "complete",
      "schema_version": "mission_authoring_v1",
      "repair_attempts": 0,
      "item_lineage_coverage": "not_covered",
      "professor_issue_overrides": []
    },
    "direction": "zh_ko",
    "mpj_items": [
      {
        "id": 1,
        "pdr": {
          "d": "close",
          "p": "equal",
          "r": "low"
        },
        "type": "scale4",
        "title": "커피 부탁",
        "prompt": "이 통역안은 이 상황에 얼마나 잘 맞나요?",
        "source": "你去买咖啡的话，帮我也带一杯呗，跟上次一样的。",
        "target": "커피 사러 가면 내 것도 한 잔 사다 줘. 저번이랑 같은 걸로.",
        "channel": "facetoface",
        "relation_ko": "같은 팀에서 매일 함께 일하는 친한 동료",
        "short_label": "첫인상 판단",
        "situation_ko": "점심 뒤 중국인 직원이, 커피를 사러 나가는 친한 한국인 동료에게 자기 것도 하나 사다 달라고 합니다.",
        "explanation_ko": "친한 동료가 어차피 커피를 사러 가는 길에 하나 더 부탁하는 장면입니다. 원문 「帮我也带一杯呗」는 가벼운 부탁이고, 통역안의 「사다 줘」도 같은 무게입니다. 이 관계와 부담에서는 짧은 반말 부탁이 자연스럽습니다.",
        "learner_context_ko": "중국인 직원이 친한 한국인 동료에게 커피를 사다 달라고 합니다. 직접 만나 부탁합니다.",
        "accepted_scale_codes": [
          "very_appropriate",
          "somewhat_appropriate"
        ],
        "reference_scale_code": "very_appropriate"
      },
      {
        "id": 2,
        "pdr": {
          "d": "distant",
          "p": "equal",
          "r": "mid"
        },
        "type": "scale4",
        "title": "견적서 재발송",
        "prompt": "이 번역안은 이 상황에 얼마나 잘 맞나요?",
        "source": "您好，能不能麻烦您把报价单再发一份给我？之前那份我这边找不到了。",
        "target": "안녕하세요, 견적서 한 부 다시 보내세요. 전에 받은 건 못 찾겠네요.",
        "channel": "facetoface",
        "relation_ko": "이번에 처음 거래하는 업체 직원",
        "short_label": "맥락 판단",
        "situation_ko": "중국인 담당자가 처음 거래하는 한국 업체 직원을 만났습니다. 전에 받은 견적서를 찾을 수 없어 한 부 다시 보내 줄 수 있는지 묻습니다.",
        "reason_choice": {
          "prompt": "가장 큰 이유는 무엇인가요?",
          "options": [
            {
              "id": "greeting-enough",
              "text": "「안녕하세요」로 시작해 처음 만난 상대에게 충분히 공손하기 때문입니다."
            },
            {
              "id": "order-not-ask",
              "text": "다시 보내 줄 수 있는지 묻던 말을 「보내세요」라는 지시로 바꿨기 때문입니다."
            },
            {
              "id": "haeyo-level",
              "text": "합쇼체가 아니라 해요체를 써서 거래처에 격이 맞지 않기 때문입니다."
            }
          ],
          "accepted_id": "order-not-ask"
        },
        "explanation_ko": "원문은 「能不能麻烦您…」으로, 처음 거래하는 상대에게 다시 보내 줄 수 있는지 묻습니다. 통역안은 「보내세요」로 끝나 묻던 말이 지시가 되었습니다. 해요체라서 공손하다고 볼 수 없습니다 — 상대가 거절할 여지가 사라졌기 때문입니다.",
        "revision_examples": [
          "안녕하세요, 견적서를 한 부 다시 보내 주실 수 있을까요? 전에 받은 걸 찾지 못해서요.",
          "안녕하세요, 번거로우시겠지만 견적서 한 부만 다시 보내 주시겠어요? 전에 주신 걸 제가 못 찾았습니다."
        ],
        "learner_context_ko": "중국인 담당자가 처음 거래하는 한국 업체 직원에게 견적서를 다시 보내 달라고 합니다. 직접 만나 부탁합니다.",
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
        "title": "출고일 확인",
        "prompt": "원문의 핵심 의미와 화행 목적을 지키면서 이 상황에 맞게 고친 표현을 골라보세요.",
        "source": "李经理，这批货的发货日期好像写错了，您能帮忙核对一下吗？",
        "target": "이 팀장님, 이번 물량 출고일이 잘못 적힌 것 같은데, 반드시 확인해 주셔야 합니다.",
        "channel": "facetoface",
        "corrections": [
          {
            "text": "이 팀장님, 이번 물량 출고일이 잘못 적힌 것 같은데, 한번 확인해 주실 수 있을까요?",
            "note_ko": "「好像」이 담은 불확실성과 「核对一下」라는 확인 부탁이 원문 그대로이고, 해 줄 수 있는지 묻습니다.",
            "is_valid": true
          },
          {
            "text": "이 팀장님, 죄송하지만 이번 물량 출고일이 잘못 적힌 것 같은데, 번거로우시더라도 반드시 확인해 주셔야 합니다.",
            "note_ko": "사과와 감사를 보탰지만 「반드시 확인해 주셔야 합니다」로 확인을 반드시 해야 할 일로 요구합니다. 해 줄 수 있는지 묻는 원문보다 요구가 강합니다.",
            "is_valid": false
          },
          {
            "text": "이 팀장님, 이번 물량 출고일이 잘못 적힌 것 같은데, 확인은 팀장님이 해 주시는 걸로 알겠습니다.",
            "note_ko": "상태와 부탁 내용은 원문대로지만 「해 주시는 걸로 알겠습니다」로 상대가 이미 맡은 일처럼 말합니다. 해 줄 수 있는지 묻는 원문과 요청 방식이 다릅니다.",
            "is_valid": false
          }
        ],
        "relation_ko": "같은 부서의 한국인 팀장",
        "short_label": "선택교정",
        "situation_ko": "중국인 직원이 이번 물량의 출고 서류를 보다가 출고일이 이상해 보입니다. 잘못 적힌 것인지는 아직 모릅니다. 한국인 이 팀장에게 확인해 달라고 합니다.",
        "explanation_ko": "세 표현 모두 출고일이 잘못 적힌 것 같다라는 같은 내용과 불확실성을 담고 있습니다. 차이는 요청 방식입니다 — 확인해 줄 수 있는지 묻는가, 반드시 해야 할 일로 요구하는가, 상대가 이미 맡은 일처럼 말하는가. 존칭이나 감사를 더한다고 요청 방식이 같아지지는 않습니다.",
        "learner_context_ko": "중국인 직원이 한국인 팀장에게 출고일을 확인해 달라고 합니다. 직접 만나 부탁합니다."
      },
      {
        "id": 4,
        "pdr": {
          "d": "acquaintance",
          "p": "equal",
          "r": "high"
        },
        "type": "free_correction",
        "title": "샘플 검사 일정",
        "prompt": "원문의 핵심 의미와 화행 목적을 지키면서 필요한 부분을 직접 고쳐 보세요.",
        "source": "下周的样品检验能不能推到周四？我们这边包装材料还没到。",
        "target": "다음 주 샘플 검사는 목요일로 미루겠습니다. 저희 쪽 포장재가 아직 안 와서요. 일정은 이렇게 정하겠습니다.",
        "channel": "facetoface",
        "contrast": {
          "target": "다음 주 샘플 검사, 목요일로 좀 미뤄도 돼요? 저희 포장재가 아직 안 와서요.",
          "context_ko": "같은 거래처 동료지만 오래 알고 지내 편한 사이라면",
          "explanation_ko": "미뤄도 되는지 묻는다는 점은 그대로입니다. 편한 사이라 말투만 가벼워집니다."
        },
        "relation_ko": "업무로 자주 연락하는 거래처 동료 — 직급은 비슷함",
        "short_label": "직접 고쳐 보기",
        "situation_ko": "다음 주에 한국 거래처와 샘플 검사가 잡혀 있습니다. 중국 쪽 포장재가 아직 도착하지 않아 목요일로 미루고 싶지만, 거래처 동료에게 아직 묻지 않았습니다.",
        "explanation_ko": "원문: 목요일로 미룰 수 있는지(能不能) 묻는 말과 그 이유입니다. / 번역안의 문제: 시간과 이유는 그대로지만 「일정은 이렇게 정하겠습니다」로 상대의 동의를 구하지 않고 변경을 확정합니다. / 고칠 방향: 포장재가 안 왔다는 이유은 그대로 두고, 바꿔도 되는지 묻는 말로 되돌리십시오. 참고 표현은 가능한 예시입니다.",
        "learner_context_ko": "중국인 담당자가 한국 거래처 동료에게 샘플 검사를 미뤄도 되는지 묻습니다. 직접 만나 부탁합니다.",
        "reference_alternatives": [
          "다음 주 샘플 검사를 목요일로 미뤄도 될까요? 저희 쪽 포장재가 아직 안 와서요.",
          "저희 쪽 포장재가 아직 도착하지 않아서요. 다음 주 샘플 검사를 목요일로 미룰 수 있을까요?"
        ]
      },
      {
        "id": 5,
        "pdr": {
          "d": "acquaintance",
          "p": "equal",
          "r": "low"
        },
        "type": "multi_judge",
        "title": "네 요청, 원문과 견주면 어디에 놓일까요?",
        "prompt": "각 표현을 읽고, 이 상황에서 어떻게 들리는지 판단해 보세요.",
        "source": "您好，下午的视频会议能不能借用一下您这边的会议室？我们那边的在装修。",
        "channel": "facetoface",
        "candidates": [
          {
            "text": "안녕하세요, 오후 화상 회의 때 그쪽 회의실을 좀 써도 될까요? 저희 쪽 회의실이 공사 중이라서요.",
            "note_ko": "빌려 써도 되는지 묻는 말과 공사 중이라는 이유가 원문 그대로입니다.",
            "accepted_band_codes": [
              "appropriate"
            ]
          },
          {
            "text": "안녕하세요, 저희 회의실이 공사 중이어서 그런데, 오후 화상 회의를 그쪽 회의실에서 해도 괜찮을까요?",
            "note_ko": "이유를 먼저 말하고 가능한지 묻는 또 다른 적절한 표현입니다.",
            "accepted_band_codes": [
              "appropriate"
            ]
          },
          {
            "text": "안녕하세요, 오후 화상 회의는 그쪽 회의실에서 하겠습니다. 저희 쪽은 공사 중이라서요.",
            "note_ko": "내용은 원문 그대로지만 「能不能借用」이 「하겠습니다」라는 통보로 바뀌었습니다. 상대가 거절할 여지를 남기지 않습니다.",
            "accepted_band_codes": [
              "too_direct"
            ]
          },
          {
            "text": "안녕하세요… 저, 혹시나 해서 여쭤보는 건데요, 저희 회의실이 좀 공사 중이기도 하고… 오후에 화상 회의가 있긴 한데… 아, 어려우시면 정말 괜찮고요, 그냥 한번 여쭤본 거예요.",
            "note_ko": "유보를 겹겹이 더해 회의실을 빌려 달라는 말이 끝내 분명히 나오지 않습니다. 상대는 무엇을 해 달라는 건지 되물어야 합니다.",
            "accepted_band_codes": [
              "too_indirect"
            ]
          }
        ],
        "relation_ko": "몇 번 함께 일한 협력사 직원",
        "short_label": "네 표현 비교",
        "situation_ko": "중국인 담당자네 회의실이 공사 중입니다. 오후 화상 회의를 협력사 사무실 회의실에서 해도 되는지, 몇 번 함께 일한 한국 협력사 직원에게 묻습니다.",
        "learner_context_ko": "중국인 담당자가 한국 협력사 직원에게 회의실을 빌려 써도 되는지 묻습니다. 직접 만나 부탁합니다."
      }
    ],
    "provenance": {
      "model": "Claude",
      "finalized_at": "2026-09-21T08:21:42.163Z",
      "generated_at": "2026-09-21T08:17:53.113Z",
      "prompt_version": "v5_to_v6_retained_items_claude_20260917",
      "content_release_id": "pragma_zhko_bidirectional_candidate_20260904_02",
      "generation_attempt": 1,
      "source_scenario_id": "b85547c1-95b9-48e8-af04-2e7461ca3dee",
      "mission_content_hash": "ebafabbf3423a929c88b3ea944cf0dc3ed797435b77934bd2b157fcdf49b3261",
      "source_mission_content_hash": "d7c1cf04da8da1a851a0d54f4b811ff3efc814a7f0ed421615bbc4e83fd9c046"
    },
    "learning_goal": {
      "kind": "speech_act",
      "speech_act": "request"
    },
    "lesson_points": [
      {
        "text": "1번 「帮我也带一杯呗」는 친한 동료에게 하는 작은 부탁이라, 「사다 줘」로 짧게 옮겨도 충분합니다.",
        "label": "가까운 사이의 작은 부탁은 짧아도 됩니다",
        "item_id": 1
      },
      {
        "text": "2번 원문 「能不能麻烦您…」을 「보내세요」로 옮기면, 해요체여도 처음 거래하는 상대에게 요구하는 말이 됩니다.",
        "label": "묻던 말이 지시가 되면 선택권이 사라집니다",
        "item_id": 2
      },
      {
        "text": "3번 원문 「核对一下」는 해 줄 수 있는지 묻습니다. 「반드시 확인해 주셔야 합니다」나 「해 주시는 걸로 알겠습니다」로 옮기면 내용은 같아도 상대의 선택권이 사라집니다.",
        "label": "같은 부탁을 요구나 위임으로 바꾸지 않습니다",
        "item_id": 3
      },
      {
        "text": "4번 「能不能推到周四」는 거래처의 동의를 묻습니다. 「이렇게 정하겠습니다」로 끝내면 그 부분이 사라집니다.",
        "label": "허락을 구하는 말을 확정으로 바꾸지 않습니다",
        "item_id": 4
      },
      {
        "text": "5번에서 「하겠습니다」 통보는 여지를 없애고, 유보를 겹겹이 쌓은 말은 무엇을 부탁하는지 흐립니다.",
        "label": "너무 직접적인 것도, 너무 돌려 말하는 것도 벗어납니다",
        "item_id": 5
      }
    ],
    "quality_check": {
      "model": "gpt-4.1",
      "verdict": "pass",
      "findings": [],
      "checked_at": "2026-09-21T08:18:34.840Z",
      "summary_ko": "실제 결함 없음 — 모든 문항이 상황, 관계, 요청의 직접성/선택권에 맞게 설계되어 있음.",
      "prompt_version": "quality_mission_v6_act_general_v3_scene_plausibility",
      "mission_content_hash": "47f414a48741df4b65dbaed3e5451bdf58ff953c65b88ad28ff2c6b0881cef89"
    },
    "schema_version": "mission_v6",
    "production_task": {
      "pdr": {
        "d": "acquaintance",
        "p": "equal",
        "r": "high"
      },
      "mode": "interpreting",
      "channel": "facetoface",
      "relation_ko": "업무로 알고 지내는 거래처 동료 — 직급은 비슷하고, 일정을 맞출지는 상대가 정함",
      "source_text": "我们这边因为供应商生产进度有变，原定下周的供应链协调会时间需要调整。能否请您看看您的日程，确认是否方便配合新的安排？",
      "replay_limit": 2,
      "situation_ko": "중국 제조업체의 운영 담당자가, 공급업체 생산 일정이 바뀌어 다음 주 공급망 조정 회의 시간을 옮겨야 합니다. 한국 거래처 동료에게 새 일정에 맞출 수 있는지 확인해 달라고 합니다.",
      "focal_segments": [
        {
          "role": "head",
          "text": "原定下周的供应链协调会时间需要调整"
        },
        {
          "role": "support",
          "text": "能否请您看看您的日程，确认是否方便配合新的安排"
        }
      ],
      "preceding_turn": null,
      "source_modality": "spoken",
      "learner_context_ko": "중국인 운영 담당자가 한국 거래처 동료에게 다음 주 공급망 조정 회의 시간을 바꿀 수 있는지 묻습니다. 직접 만나 부탁합니다.",
      "reference_alternatives": [
        {
          "text": "저희 쪽 공급업체 생산 일정이 바뀌어서, 다음 주로 잡혀 있던 공급망 조정 회의 시간을 조정해야 할 것 같습니다. 일정 한번 확인해 보시고, 새 일정에 맞춰 주실 수 있을지 알려 주시겠어요?",
          "note_ko": "일정을 바꿔야 하는 사정과, 새 일정에 맞출 수 있는지 확인해 달라는 부탁이 원문 그대로입니다."
        },
        {
          "text": "공급업체 생산 일정에 변동이 생겨서 다음 주 공급망 조정 회의 시간을 바꿔야 하게 됐습니다. 혹시 일정 보시고 새로 잡는 시간이 괜찮으실지 확인해 주실 수 있을까요?",
          "note_ko": "사정을 먼저 밝히고 상대가 괜찮은지 묻습니다. 같은 부탁을 다른 방식으로 옮긴 예입니다."
        }
      ]
    },
    "hsk_lexical_audit": {
      "note": "Candidate review only: unmatched tokens may be proper nouns, terms, segmentation units, or vocabulary above/outside the reference dataset.",
      "scope": "zh_source_mission",
      "status": "complete",
      "direction": "zh_ko",
      "source_id": "hsk30_syllabus_2025_11_effective_2026_07",
      "non_blocking": true,
      "coverage_ratio": 0.6552,
      "policy_version": "hsk3_lexical_reference_v1",
      "reference_ceiling": 5,
      "matched_token_count": 57,
      "distinct_token_count": 87,
      "out_of_reference_candidates": [
        "我也",
        "一杯",
        "呗",
        "跟上",
        "您好",
        "能不能",
        "报价",
        "一份",
        "那份",
        "找不到",
        "李",
        "批货",
        "写错",
        "核对",
        "下周",
        "样品",
        "检验",
        "推到",
        "周四",
        "没",
        "借用",
        "供应",
        "商",
        "进度",
        "原定",
        "链",
        "协调",
        "看看",
        "日程",
        "新的"
      ]
    }
  }
};
