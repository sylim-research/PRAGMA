// Approved missions for the remaining demo combinations. Production DB read: 2026-10-06.
// Public demo reads these snapshots without DB or AI calls.

// 한→중 통역 칭찬 승인본
export const KO_ZH_INTERPRETING_SNAPSHOT = {
  "learner_level": "advanced",
  "mission_content": {
    "authoring": {
      "item_lineage_coverage": "not_covered",
      "lineage_status": "complete",
      "professor_issue_overrides": [],
      "repair_attempts": 0,
      "schema_version": "mission_authoring_v1",
      "stage": "professor_finalized"
    },
    "direction": "ko_zh",
    "hsk_lexical_audit": {
      "coverage_ratio": 0.7626,
      "direction": "ko_zh",
      "distinct_token_count": 139,
      "matched_token_count": 106,
      "non_blocking": true,
      "note": "Candidate review only: unmatched tokens may be proper nouns, terms, segmentation units, or vocabulary above/outside the reference dataset.",
      "out_of_reference_candidates": [
        "看起来",
        "诱",
        "辑",
        "像样",
        "看到",
        "也不",
        "真是",
        "天生",
        "营",
        "销",
        "上次",
        "锁定",
        "案",
        "看了",
        "真的",
        "很好",
        "挺好",
        "尤其是",
        "二十",
        "这次",
        "拍得",
        "图形",
        "沉浸",
        "很多",
        "挺不错",
        "也有",
        "音效",
        "一下子",
        "做出",
        "这种",
        "情调",
        "走向",
        "乐"
      ],
      "policy_version": "hsk3_lexical_reference_v1",
      "reference_ceiling": 6,
      "scope": "zh_target_mission",
      "source_id": "hsk30_syllabus_2025_11_effective_2026_07",
      "status": "complete"
    },
    "learning_goal": {
      "kind": "speech_act",
      "speech_act": "compliment"
    },
    "lesson_points": [
      {
        "item_id": 1,
        "label": "평가와 효과, 두 부분 그대로",
        "text": "「색감이랑 조명 활용이 정말 뛰어나요 → 덕분에 요리가 더 맛있어 보여요」는 평가와 효과입니다. 「非常出色…更诱人了」처럼 「정말」의 크기와 「덕분에」의 연결을 그대로 옮깁니다."
      },
      {
        "item_id": 2,
        "label": "「제법」은 내려다보는 칭찬이다",
        "text": "「편집 리듬이 정말 좋아서」를 「还挺像样的」로 옮기면 칭찬은 남아도 '기대 이하일 줄 알았는데'라는 윗사람 평가가 깔려, 처음 만난 고객을 내려다보는 말이 됩니다."
      },
      {
        "item_id": 3,
        "label": "지난 기획안을 「天生」으로 넓히지 않는다",
        "text": "「지난번 캠페인 기획안 정말 잘 봤어요」는 기획안 하나에 대한 평가입니다. 「天生做营销的料」로 옮기면 협업 상대의 재능 평가가 되고, 「贵方…值得肯定」으로 옮기면 동료 사이 칭찬이 평가 공문이 됩니다."
      },
      {
        "item_id": 4,
        "label": "칭찬의 크기만큼 말투도 원문 관계에 맞춘다",
        "text": "「이번 협업 영상 진짜 잘 나왔더라」는 팀장이 친한 후배에게 하는 반말입니다. 「您这次的合作视频拍得非常出色」로 옮기면 내용은 같아도 격식체가 되어 거리감이 생깁니다. 칭찬의 크기만큼 말투도 원문 관계에 맞춥니다."
      },
      {
        "item_id": 5,
        "label": "부족함도 과함도 대역 밖",
        "text": "「정말 인상적이에요」를 「挺不错的·有一定的沉浸感」으로 옮기면 칭찬은 남아도 원문보다 한 단계 약해지고, 「生活里一定也特别有情调」까지 가면 처음 만난 고객의 사생활을 평가하게 됩니다."
      }
    ],
    "mpj_items": [
      {
        "accepted_scale_codes": [
          "very_appropriate",
          "somewhat_appropriate"
        ],
        "channel": "facetoface",
        "explanation_ko": "원문은 「색감과 조명 활용이 뛰어나다」는 평가와 「덕분에 요리가 더 맛있어 보인다」는 효과입니다. 통역안은 둘 다 옮겼고 「정말」의 크기를 「非常」으로 두었습니다. 처음 만나는 고객에게 「您」으로 격을 갖췄고, 영상 밖의 재능이나 사람에 대한 평가는 보태지 않았습니다.",
        "id": 1,
        "learner_context_ko": "마케팅 실무자가 처음 만난 크리에이터에게 직접 만나 칭찬합니다. 그 말을 중국어로 옮깁니다.",
        "pdr": {
          "d": "distant",
          "p": "speaker_lower",
          "r": "mid"
        },
        "prompt": "이 통역안은 이 상황에 얼마나 잘 맞나요?",
        "reference_scale_code": "very_appropriate",
        "relation_ko": "처음 만나는 고객 크리에이터 — 화자는 마케팅 실무자",
        "short_label": "첫인상 판단",
        "situation_ko": "엔터테인먼트 마케팅 실무자가 요리 크리에이터를 처음 만난 자리에서, 영상의 색감과 조명에 대해 직접 말합니다.",
        "source": "작가님 영상은 색감이랑 조명 활용이 정말 뛰어나요. 덕분에 요리가 훨씬 더 맛있어 보이더라고요.",
        "target": "您视频里的色彩和灯光运用得非常出色，菜品看起来也更诱人了。",
        "title": "처음 만난 크리에이터에게, 이 칭찬 그대로 옮겨도 될까요?",
        "type": "scale4"
      },
      {
        "accepted_scale_codes": [
          "somewhat_inappropriate",
          "very_inappropriate"
        ],
        "channel": "facetoface",
        "explanation_ko": "원문 「편집 리듬이 정말 좋아서 끝까지 지루하지 않았어요. 자막 타이밍도 딱 맞아서 보기 편했습니다」는 처음 만난 고객에게 하는 정중한 칭찬입니다. 통역안은 편집 리듬·자막이라는 내용은 다 옮겼지만 「还挺像样的」(제법 그럴듯하네)가 '기대는 안 했는데'라는 윗사람의 평가를 깔았습니다. 칭찬의 모양은 남아도, 고객 앞에서 실무자가 작품을 심사하며 내려다보는 말이 됩니다. 「您视频的剪辑节奏非常好，看到最后一点也不觉得无聊」이 원문의 칭찬입니다.",
        "id": 2,
        "learner_context_ko": "크리에이터의 영상 편집에 대해 실무자가 첫 미팅에서 직접 만나 칭찬합니다. 그 말을 중국어로 옮깁니다.",
        "pdr": {
          "d": "distant",
          "p": "speaker_lower",
          "r": "low"
        },
        "prompt": "이 번역안은 이 상황에 얼마나 잘 맞나요?",
        "reason_choice": {
          "accepted_id": "r1",
          "options": [
            {
              "id": "r1",
              "text": "「还挺像样」이 '기대는 안 했는데 제법'이라는 뜻을 깔아 고객을 내려다보는 평가가 됐다."
            },
            {
              "id": "r2",
              "text": "처음 만난 고객에게는 영상을 평가하는 말 자체를 하면 안 된다."
            },
            {
              "id": "r3",
              "text": "자막 타이밍을 언급한 부분이 원문에 없다."
            }
          ],
          "prompt": "가장 큰 이유는 무엇인가요?"
        },
        "reference_scale_code": "somewhat_inappropriate",
        "relation_ko": "처음 만나는 고객 크리에이터 — 화자는 마케팅 실무자",
        "revision_examples": [
          "您视频的剪辑节奏非常好，看到最后一点也不觉得无聊。字幕的时机也卡得很准，看起来很舒服。"
        ],
        "short_label": "맥락 판단",
        "situation_ko": "마케팅 실무자가 크리에이터의 최근 영상을 보고 첫 미팅 자리에서 편집 리듬과 자막에 대해 직접 말합니다.",
        "source": "작가님 영상은 편집 리듬이 정말 좋아서 끝까지 지루하지 않았어요. 자막 타이밍도 딱 맞아서 보기 편했습니다.",
        "target": "您视频的剪辑节奏还挺像样的，看到最后也不觉得无聊，字幕时机也卡得挺准，看着很舒服。",
        "title": "「정말 좋아서」가 「还挺像样」이 되면?",
        "type": "scale4"
      },
      {
        "channel": "facetoface",
        "corrections": [
          {
            "is_valid": true,
            "note_ko": "「지난번 기획안」 → 「정말 잘 봤다」 → 「타깃을 20대 초반으로 좁힌 판단」 → 「결과로 증명됐다」가 그대로입니다. 평가가 지난 기획안에 머물러 있습니다.",
            "text": "上次的活动策划案我看了，真的很好。特别是把目标锁定在20岁出头这个判断，结果完全证明是对的。"
          },
          {
            "is_valid": false,
            "note_ko": "「타깃을 20대 초반으로 좁힌 판단이 결과로 증명됐다」가 통째로 빠졌습니다. 무엇이 좋았는지 없어져 회의 자리의 인사치레가 됐습니다.",
            "text": "上次的策划案挺好的。"
          },
          {
            "is_valid": false,
            "note_ko": "내용은 다 있지만 「贵方·已被结果充分验证·值得肯定」은 공문서·심사평 말투입니다. 몇 번 협업한 마케터끼리 회의 자리에서 하는 칭찬이 기관의 평가 공문처럼 들립니다. AI 중국어 검토에서 지적된 유형입니다.",
            "text": "贵方上次的活动策划案思路清晰、定位精准，尤其是将目标锁定于二十岁出头人群的决策，已被结果充分验证，值得肯定。"
          }
        ],
        "explanation_ko": "원문은 「지난번 캠페인 기획안」으로 범위를 그 기획안에 두고, 「정말 잘 봤다」는 평가와 「타깃 판단이 결과로 증명됐다」는 근거를 붙였습니다. 통역안은 근거는 옮겼지만 첫 문장을 「你真是天生做营销的料」로 바꿔, 기획안 하나에 대한 평가를 타고난 재능 평가로 넓혔습니다. 몇 번 협업한 마케터에게 화자가 확인한 것은 이번 기획안과 결과입니다. 「上次的活动策划案我看了，真的很好」로 범위를 돌려놓으면 됩니다. 근거를 빼면 인사치레가 되고, 공문 말투로 옮기면 동료 사이 칭찬이 평가 공문이 됩니다.",
        "id": 3,
        "learner_context_ko": "협업한 마케터에게 결과 회의에서 직접 만나 칭찬합니다. 그 말을 중국어로 옮깁니다.",
        "pdr": {
          "d": "acquaintance",
          "p": "equal",
          "r": "mid"
        },
        "prompt": "원문의 핵심 의미와 화행 목적을 지키면서 이 상황에 맞게 고친 표현을 골라보세요.",
        "relation_ko": "몇 차례 협업한 다른 회사의 마케터 — 직급은 비슷함",
        "short_label": "선택교정",
        "situation_ko": "몇 번 협업한 다른 회사 마케터가 지난 캠페인 결과를 공유했습니다. 결과 회의에서 직접 말합니다.",
        "source": "지난번 캠페인 기획안 정말 잘 봤어요. 특히 타깃을 20대 초반으로 좁힌 판단이 결과로 딱 증명됐더라고요.",
        "target": "你真是天生做营销的料。上次把目标锁定在20岁出头这个判断，结果完全证明是对的。",
        "title": "「지난번 기획안」이 「天生」이 되면?",
        "type": "fix_choice"
      },
      {
        "channel": "facetoface",
        "contrast": {
          "context_ko": "처음 같이 일하는 외부 제작사 담당자라면",
          "explanation_ko": "평가·근거·효과는 그대로이고, 이 관계에서는 격식을 갖춘 말이 맞습니다. 같은 격식이 친한 후배에게는 거리감이 됩니다.",
          "target": "这次的合作视频效果非常好。特别是产品融入得很自然，完全没有广告感。"
        },
        "explanation_ko": "원문: 「이번 협업 영상 진짜 잘 나왔더라. 특히 제품이 자연스럽게 녹아들어서 광고 같지가 않았어」 — 팀장이 친한 후배 팀원에게 하는 반말 칭찬.\n통역안의 문제: 평가·근거·효과는 다 옮겼지만 「您…非常出色…十分自然，毫无广告痕迹」로 격식체·문어체가 됐다. 팀장이 친한 후배에게 「您」을 쓰니 원문에 없던 거리감이 생기고, 후배는 오히려 어색해한다.\n고칠 방향: 평가·근거·효과는 그대로, 말투를 원문의 친근한 구어로 되돌린다.\n\n표현 메모\n· 「融入得很自然」「放进去一点也不生硬」 — 「자연스럽게 녹아들다」를 옮기는 표현입니다.\n· 「不像广告」「没有广告感」 — 「광고 같지 않다」를 옮기는 표현입니다.",
        "id": 4,
        "learner_context_ko": "팀장이 협업 영상을 만든 후배 팀원에게 직접 만나 칭찬합니다. 그 말을 중국어로 옮깁니다.",
        "pdr": {
          "d": "close",
          "p": "speaker_higher",
          "r": "low"
        },
        "prompt": "원문의 핵심 의미와 화행 목적을 지키면서 필요한 부분을 직접 고쳐 보세요.",
        "reference_alternatives": [
          "这次的合作视频做得真好。特别是产品融入得很自然，完全不像广告。",
          "这次合作的视频效果真不错。产品放进去一点也不生硬，看着不像广告。"
        ],
        "relation_ko": "같은 팀에서 친하게 지내는 후배 팀원 — 화자는 팀장",
        "short_label": "직접 고쳐 보기",
        "situation_ko": "마케팅 팀장이 친한 후배 팀원이 만든 협업 영상을 보고 사무실에서 직접 말합니다.",
        "source": "이번 협업 영상 진짜 잘 나왔더라. 특히 제품이 자연스럽게 녹아들어서 광고 같지가 않았어.",
        "target": "您这次的合作视频拍得非常出色。产品融入得十分自然，毫无广告痕迹。",
        "title": "칭찬은 그대로, 말투는 이 관계에 맞을까요?",
        "type": "free_correction"
      },
      {
        "candidates": [
          {
            "accepted_band_codes": [
              "within_band"
            ],
            "note_ko": "평가(정말 인상적) → 효과(덕분에 몰입감이 높아짐)가 원문 크기 그대로입니다. 처음 만난 고객에게 「您」으로 격을 갖췄고 보탠 평가는 없습니다.",
            "text": "您视频的声音设计和图形效果真的很出色，看的时候沉浸感强了很多。"
          },
          {
            "accepted_band_codes": [
              "under_calibrated"
            ],
            "note_ko": "칭찬이고 내용도 다 있지만 「정말 인상적」이 「挺不错的」로, 「몰입감이 훨씬 높아졌다」가 「有一定的沉浸感」으로 한 단계 낮아졌습니다. 처음 만난 고객에게 원문보다 미지근한 칭찬으로 들립니다.",
            "text": "您视频的声音设计和图形效果挺不错的，看的时候也有一定的沉浸感。"
          },
          {
            "accepted_band_codes": [
              "within_band"
            ],
            "note_ko": "같은 내용을 다른 말로 했습니다. 「看的时候特别有沉浸感」은 「몰입감이 높아졌다」를 화자 쪽에서 말한 것이라 범위 안입니다.",
            "text": "您视频里的音效设计和视觉效果给我印象很深，看的时候特别有沉浸感。"
          },
          {
            "accepted_band_codes": [
              "overreaching"
            ],
            "note_ko": "앞부분은 원문 그대로지만 영상을 본 평가가 「生活里一定也特别有情调」로 넘어갔습니다. 처음 만난 고객의 사생활까지 평가해 근거와 관계를 넘었습니다.",
            "text": "您视频的声音设计和图形效果真的很出色，内容一下子就让人沉浸进去了。能做出这种作品的人，生活里一定也特别有情调吧。"
          }
        ],
        "channel": "facetoface",
        "id": 5,
        "learner_context_ko": "실무자가 크리에이터의 영상 사운드와 그래픽을 직접 만나 칭찬합니다. 그 말을 네 가지로 옮겼습니다.",
        "pdr": {
          "d": "distant",
          "p": "speaker_lower",
          "r": "mid"
        },
        "prompt": "각 표현을 읽고, 이 상황에서 어떻게 들리는지 판단해 보세요.",
        "relation_ko": "처음 만나는 고객 크리에이터 — 화자는 마케팅 실무자",
        "short_label": "네 표현 비교",
        "situation_ko": "마케팅 실무자가 처음 만난 크리에이터에게 영상의 사운드와 그래픽에 대해 직접 말합니다.",
        "source": "작가님 영상은 사운드 디자인이랑 그래픽 효과가 정말 인상적이에요. 덕분에 콘텐츠 몰입감이 훨씬 높아졌어요.",
        "title": "네 칭찬, 원문과 견주면 어디에 놓일까요?",
        "type": "multi_judge"
      }
    ],
    "production_task": {
      "channel": "facetoface",
      "focal_segments": [
        {
          "role": "head",
          "text": "작가님 영상은 스토리 전개가 정말 독특해서 깊은 인상을 받았습니다."
        },
        {
          "role": "support",
          "text": "편집과 음악 활용도 탁월해서 콘텐츠의 매력이 더 잘 살아난 것 같습니다."
        }
      ],
      "learner_context_ko": "실무자가 처음 만난 크리에이터에게 직접 만나 칭찬합니다. 그 말을 듣고 중국어로 옮깁니다.",
      "mode": "interpreting",
      "pdr": {
        "d": "distant",
        "p": "speaker_lower",
        "r": "low"
      },
      "preceding_turn": null,
      "reference_alternatives": [
        {
          "note_ko": "평가(스토리 전개가 독특해 인상 깊음) → 근거(편집·음악 활용) → 효과(콘텐츠의 매력이 더 살아남)를 원문 크기대로 옮겼습니다. 「작가님」은 「您」으로 받았습니다(처음 만난 고객에게 호칭 없이 「您」은 자연스럽다는 AI 검토 답).",
          "text": "您视频的故事走向特别独特，让我印象很深。剪辑和配乐也用得特别好，感觉整个内容的魅力都更出来了。"
        }
      ],
      "relation_ko": "처음 만나는 고객 크리에이터 — 화자는 마케팅 실무자",
      "replay_limit": 2,
      "situation_ko": "엔터테인먼트 마케팅 실무자가 처음 만난 고객 크리에이터와의 미팅에서, 그가 만든 영상의 스토리 전개와 편집에 대해 직접 말합니다.",
      "source_modality": "spoken",
      "source_text": "작가님 영상은 스토리 전개가 정말 독특해서 깊은 인상을 받았습니다. 편집과 음악 활용도 탁월해서 콘텐츠의 매력이 더 잘 살아난 것 같습니다."
    },
    "provenance": {
      "content_release_id": "pragma_zhko_bidirectional_candidate_20260904_02",
      "finalized_at": "2026-09-18T13:36:25.453Z",
      "generated_at": "2026-09-18T12:38:41.021Z",
      "generation_attempt": 1,
      "mission_content_hash": "2cbf37b76431d4fddcbd62c734f843642588d0e3eecab6dce115c04b9cbb0665",
      "model": "Claude",
      "prompt_version": "v5_to_v6_retained_items_claude_20260917",
      "source_mission_content_hash": "a24bd243384d7696e2a1f62c64829b7c938e91b4f2cf142b57a4a0e6117140e1",
      "source_scenario_id": "809c7ccb-b416-4d91-bc7d-304daaea4df8"
    },
    "quality_check": {
      "checked_at": "2026-09-18T12:39:05.294Z",
      "findings": [],
      "mission_content_hash": "bae90e18890d9a84c19182e2f4e6f4a30c443fc3e361c117ac80b59ff6809ee9",
      "model": "gpt-4.1",
      "prompt_version": "quality_mission_v6_act_general_v2",
      "summary_ko": "실제 결함 없음: 모든 문항이 칭찬의 강도와 민감도, 맥락에 맞는 평가 범위와 어조를 적절히 구분하여 제시하고 있습니다.",
      "verdict": "pass"
    },
    "schema_version": "mission_v6",
    "unit": {
      "closing_ko": "칭찬은 세게 말하는 것보다, 실제로 확인한 강점을 관계와 주제의 민감도에 맞는 범위로 평가할 때 자연스럽습니다.",
      "learner_label": "평가 강도와 민감도",
      "target_feature": "compliment_grounding_sensitivity",
      "target_feature_version": "1.0"
    }
  },
  "mission_status": "reviewed",
  "release_gate_mode": "legacy_reviewed",
  "scenario_id": "6867d6b6-ef09-4cca-a69b-bfa281303ec3",
  "speech_act": "compliment"
} as const;

// 중→한 반대 승인본(원래 통역 미션, 데모에서는 번역 과제로 제시)
export const ZH_KO_TRANSLATION_SNAPSHOT = {
  "learner_level": "intermediate",
  "mission_content": {
    "authoring": {
      "item_lineage_coverage": "not_covered",
      "lineage_status": "complete",
      "professor_issue_overrides": [],
      "repair_attempts": 0,
      "schema_version": "mission_authoring_v1",
      "stage": "professor_finalized"
    },
    "direction": "zh_ko",
    "hsk_lexical_audit": {
      "coverage_ratio": 0.8211,
      "direction": "zh_ko",
      "distinct_token_count": 95,
      "matched_token_count": 78,
      "non_blocking": true,
      "note": "Candidate review only: unmatched tokens may be proper nouns, terms, segmentation units, or vocabulary above/outside the reference dataset.",
      "out_of_reference_candidates": [
        "点了",
        "楼下",
        "每天",
        "一周",
        "两次",
        "样",
        "删掉",
        "不好",
        "一个",
        "上市",
        "没",
        "做完",
        "要写",
        "不一致",
        "反而会",
        "进度",
        "才没"
      ],
      "policy_version": "hsk3_lexical_reference_v1",
      "reference_ceiling": 5,
      "scope": "zh_source_mission",
      "source_id": "hsk30_syllabus_2025_11_effective_2026_07",
      "status": "complete"
    },
    "learning_goal": {
      "kind": "speech_act",
      "speech_act": "opposition"
    },
    "lesson_points": [
      {
        "item_id": 1,
        "label": "근거가 있으면 가까운 사이에서는 바로 반대해도 됩니다",
        "text": "1번은 가까운 사이에서 이유와 대안을 함께 말하는 짧은 반대라 자연스럽습니다."
      },
      {
        "item_id": 2,
        "label": "제안을 단정적으로 부정하면 대립이 커집니다",
        "text": "2번 원문 「可能会不够，一周两次怎么样？」를 「완전히 말도 안 돼요」로 옮기면 선배의 제안을 전면 부정하게 됩니다."
      },
      {
        "item_id": 3,
        "label": "동의처럼 들리게 하면 이견이 사라집니다",
        "text": "3번 「我觉得留下主要的几张比较好」를 「다들 좋다면 그렇게 하죠」로 옮기면 이견이 전해지지 않습니다."
      },
      {
        "item_id": 4,
        "label": "인정과 근거를 살려 이견의 크기를 맞춥니다",
        "text": "4번 원문은 「我明白」으로 인정하고 「我建议」로 제안합니다. 「절대 안 됩니다」「무조건」은 원문에 없는 대립입니다."
      },
      {
        "item_id": 5,
        "label": "대립도 흐림도 이견의 초점에서 벗어납니다",
        "text": "5번에서 제안을 단정적으로 부정하는 말과, 동의와 유보를 겹쳐 반대가 사라진 말 모두 원문의 이견에서 벗어납니다."
      }
    ],
    "mpj_items": [
      {
        "accepted_scale_codes": [
          "very_appropriate",
          "somewhat_appropriate"
        ],
        "channel": "facetoface",
        "explanation_ko": "친한 친구의 제안에 이유와 대안을 들어 가볍게 반대하는 장면입니다. 통역안은 근거(비 때문에 늦음)와 대안(아래층)을 원문만큼 짧게 옮겼습니다.",
        "id": 1,
        "learner_context_ko": "중국인 직원이 친한 한국인 친구에게 직접 말합니다.",
        "pdr": {
          "d": "close",
          "p": "equal",
          "r": "low"
        },
        "prompt": "이 통역안은 이 상황에 얼마나 잘 맞나요?",
        "reference_scale_code": "very_appropriate",
        "relation_ko": "자주 어울리는 친한 친구",
        "short_label": "첫인상 판단",
        "situation_ko": "친한 친구가 비 오는 날 점심을 배달로 시키자고 했습니다. 비 때문에 배달이 늦을 것 같습니다.",
        "source": "外卖今天就别点了，下雨送得慢，去楼下吃吧。",
        "target": "오늘은 배달 시키지 말자. 비 와서 늦게 와. 아래층 가서 먹자.",
        "title": "배달 음식",
        "type": "scale4"
      },
      {
        "accepted_scale_codes": [
          "somewhat_inappropriate",
          "very_inappropriate"
        ],
        "channel": "facetoface",
        "explanation_ko": "원문은 「시간이 부족할 수 있다」는 근거로 이견을 밝히고 일주일에 두 번을 묻습니다. 통역안은 「완전히 말도 안 돼요」로 제안을 단정적으로 부정하고, 묻는 대안도 「두 번으로 해요」로 굳혔습니다. 근거는 같아도 대립이 커졌습니다.",
        "id": 2,
        "learner_context_ko": "중국인 직원이 한국인 선배에게 직접 말합니다.",
        "pdr": {
          "d": "acquaintance",
          "p": "speaker_lower",
          "r": "mid"
        },
        "prompt": "이 번역안은 이 상황에 얼마나 잘 맞나요?",
        "reason_choice": {
          "accepted_id": "flat-rejection",
          "options": [
            {
              "id": "alt-given",
              "text": "일주일에 두 번이라는 대안을 넣었기 때문입니다."
            },
            {
              "id": "flat-rejection",
              "text": "「완전히 말도 안 돼요」로 제안을 단정적으로 부정해, 원문의 「부족할 수 있다」보다 대립이 커졌기 때문입니다."
            },
            {
              "id": "haeyo-low",
              "text": "선배에게 해요체를 써서 격이 맞지 않기 때문입니다."
            }
          ],
          "prompt": "가장 큰 이유는 무엇인가요?"
        },
        "reference_scale_code": "somewhat_inappropriate",
        "relation_ko": "같은 협업팀 선배 — 업무로 알고 지냄",
        "revision_examples": [
          "매일 회의하면 다들 자료 정리할 시간이 부족할 수도 있을 것 같아요. 일주일에 두 번은 어떨까요?",
          "매일 회의를 하면 자료 정리할 시간이 모자랄 수 있어서요. 주 2회로 하면 어떨까요?"
        ],
        "short_label": "맥락 판단",
        "situation_ko": "한국인 선배가 「프로젝트 회의를 매일 하자」고 했습니다. 중국인 직원은 자료 정리 시간이 부족할 것 같아 일주일에 두 번을 제안하려 합니다.",
        "source": "每天开会的话，大家整理资料的时间可能会不够，一周两次怎么样？",
        "target": "매일 회의하는 건 완전히 말도 안 돼요. 다들 자료 정리할 시간도 없어져요. 일주일에 두 번으로 해요.",
        "title": "회의 횟수",
        "type": "scale4"
      },
      {
        "channel": "facetoface",
        "corrections": [
          {
            "is_valid": true,
            "note_ko": "근거(비교가 어려움)와 주요 표를 남기자는 이견이 원문 그대로입니다.",
            "text": "표를 다 빼면 오히려 데이터를 비교하기 어려울 것 같아요. 주요 표 몇 개는 남기는 게 좋겠어요."
          },
          {
            "is_valid": false,
            "note_ko": "사과를 보탰지만 「괜찮을 것 같긴 해요」「다들 좋으시면」으로 이견이 여전히 사라져 있습니다.",
            "text": "죄송한데 표를 다 빼는 것도 괜찮을 것 같긴 해요. 비교가 좀… 아무튼 다들 좋으시면 그렇게 하세요."
          },
          {
            "is_valid": false,
            "note_ko": "입장은 분명하지만 「완전히 잘못된 생각」「아예 불가능」으로 제안을 단정적으로 부정해 대립을 키웠습니다.",
            "text": "표를 다 빼자는 건 완전히 잘못된 생각이에요. 그러면 데이터 비교는 아예 불가능해요."
          }
        ],
        "explanation_ko": "원문은 「비교가 어렵다」는 근거로 주요 표를 남기자고 분명히 말합니다. 통역안은 「괜찮을 것 같긴 한데」「다들 좋다면 그렇게 하죠」를 더해 이견이 동의로 바뀌었습니다. 입장을 감추지도 키우지도 말고 원문처럼 밝히면 됩니다.",
        "id": 3,
        "learner_context_ko": "중국인 직원이 한국인 동료에게 직접 말합니다.",
        "pdr": {
          "d": "acquaintance",
          "p": "equal",
          "r": "mid"
        },
        "prompt": "원문의 핵심 의미와 화행 목적을 지키면서 이 상황에 맞게 고친 표현을 골라보세요.",
        "relation_ko": "같은 팀 동료 — 업무로 자주 협업함",
        "short_label": "선택교정",
        "situation_ko": "동료가 「보고서에서 표를 다 빼자」고 했습니다. 표를 다 빼면 데이터 비교가 어려워 주요 표는 남기자고 말하려 합니다.",
        "source": "表格全删掉的话，数据反而不好对比。我觉得留下主要的几张比较好。",
        "target": "표를 다 빼는 것도… 뭐 괜찮을 것 같긴 한데, 데이터 비교가 좀… 아니, 다들 좋다면 그렇게 하죠.",
        "title": "보고서 표",
        "type": "fix_choice"
      },
      {
        "channel": "facetoface",
        "contrast": {
          "context_ko": "같은 팀장이지만 오래 함께 일해 편한 사이라면",
          "explanation_ko": "이견과 근거는 그대로입니다. 편한 사이라 말투만 가벼워집니다.",
          "target": "한 달 당기자는 거 알겠는데요, 테스트가 아직이라 원래대로 가는 게 낫지 않을까요?"
        },
        "explanation_ko": "원문: 팀장의 생각을 인정하면서(我明白) 테스트를 근거로 원래 계획을 제안하는(我建议) 이견입니다. / 통역안의 문제: 인정을 빼고 「절대 안 됩니다」「무조건」으로 제안을 전면 부정해 대립을 키웠습니다. / 고칠 방향: 인정과 근거를 살리고 원문처럼 제안하는 말로 되돌리십시오.",
        "id": 4,
        "learner_context_ko": "중국인 직원이 한국인 팀장에게 직접 말합니다.",
        "pdr": {
          "d": "acquaintance",
          "p": "speaker_lower",
          "r": "high"
        },
        "prompt": "원문의 핵심 의미와 화행 목적을 지키면서 필요한 부분을 직접 고쳐 보세요.",
        "reference_alternatives": [
          "한 달 앞당기자는 뜻은 알겠습니다. 다만 테스트가 아직 끝나지 않아서 원래 계획대로 가는 게 좋겠습니다.",
          "출시를 앞당기려는 취지는 이해합니다. 그래도 테스트가 남아 있으니 원래 일정대로 진행하는 걸 제안드립니다."
        ],
        "relation_ko": "소속 팀 팀장 — 일정 결정권자",
        "short_label": "직접 고쳐 보기",
        "situation_ko": "한국인 팀장이 「신제품 출시를 한 달 앞당기자」고 했습니다. 테스트가 아직 끝나지 않아 원래 계획대로 가자고 말씀드리려 합니다.",
        "source": "提前一个月上市的想法我明白，但是测试还没做完，我建议按原计划来。",
        "target": "한 달 앞당기는 건 절대 안 됩니다. 테스트도 안 끝났는데 무조건 원래 계획대로 가야 합니다.",
        "title": "출시 일정",
        "type": "free_correction"
      },
      {
        "candidates": [
          {
            "accepted_band_codes": [
              "within_band"
            ],
            "note_ko": "무엇에 반대하는지와 근거·대안이 원문 크기 그대로입니다.",
            "text": "회의록은 그래도 쓰는 게 좋을 것 같아요. 안 그러면 나중에 서로 이해한 내용이 달라질 수 있어서요."
          },
          {
            "accepted_band_codes": [
              "within_band"
            ],
            "note_ko": "상대 제안을 인정한 뒤 같은 이견을 밝히는 또 다른 적절한 표현입니다. 인정 표현의 유무는 기준이 아닙니다.",
            "text": "안 써도 된다고 하셨지만, 나중에 양쪽 이해가 어긋날 수 있으니 회의록은 남기는 게 좋겠습니다."
          },
          {
            "accepted_band_codes": [
              "too_confrontational"
            ],
            "note_ko": "「말도 안 됩니다」「무조건 문제가 생깁니다」로 제안을 단정적으로 부정하고 결과를 과장해 대립을 키웠습니다.",
            "text": "회의록을 안 쓰는 건 말도 안 됩니다. 그러면 나중에 무조건 문제가 생깁니다."
          },
          {
            "accepted_band_codes": [
              "too_obscured"
            ],
            "note_ko": "「안 써도 뭐… 괜찮을 수도」「편하신 대로」를 더해 회의록을 남기자는 이견이 사라졌습니다.",
            "text": "회의록은… 쓰면 좋긴 한데… 안 써도 뭐… 괜찮을 수도 있고요… 편하신 대로 하세요."
          }
        ],
        "channel": "facetoface",
        "id": 5,
        "learner_context_ko": "중국인 직원이 처음 만난 한국 협력사 담당자에게 직접 말합니다.",
        "pdr": {
          "d": "distant",
          "p": "equal",
          "r": "mid"
        },
        "prompt": "각 표현을 읽고, 이 상황에서 어떻게 들리는지 판단해 보세요.",
        "relation_ko": "이번에 처음 만난 협력사 담당자",
        "short_label": "네 표현 비교",
        "situation_ko": "처음 만난 한국 협력사 담당자가 「회의록은 안 써도 된다」고 했습니다. 나중에 서로 이해가 달라질 수 있어 회의록을 남기자고 말하려 합니다.",
        "source": "会议记录我觉得还是要写，不然之后双方的理解可能会不一致。",
        "title": "각 표현은 어디쯤에 놓일까요?",
        "type": "multi_judge"
      }
    ],
    "production_task": {
      "channel": "facetoface",
      "focal_segments": [
        {
          "role": "head",
          "text": "如果不管质量控制，反而会影响整体进度。"
        },
        {
          "role": "support",
          "text": "每个环节的质量都得保证，这样最后交出来的东西才没问题。"
        }
      ],
      "learner_context_ko": "중국인 실무자가 한국인 선배 담당자의 일정 단축 제안에 반대 의견을 직접 말합니다.",
      "mode": "interpreting",
      "pdr": {
        "d": "acquaintance",
        "p": "speaker_lower",
        "r": "high"
      },
      "preceding_turn": null,
      "reference_alternatives": [
        {
          "note_ko": "기간 단축의 중요성을 인정하는 말, 품질 관리라는 근거, 단계별 품질을 지키자는 이견이 원문 크기 그대로입니다.",
          "text": "기간 줄이는 것도 중요하지만, 품질 관리를 안 챙기면 오히려 전체 일정에 영향이 갈 것 같아요. 단계마다 품질을 챙겨야 마지막에 넘기는 결과물도 문제가 없을 거예요."
        },
        {
          "note_ko": "같은 이견을 다른 말로 옮긴 예입니다.",
          "text": "기간 단축이 중요한 건 알지만, 품질 관리를 놓치면 오히려 전체 진행이 틀어질 수 있어요. 각 단계 품질을 지켜야 최종 결과물도 괜찮을 것 같습니다."
        }
      ],
      "relation_ko": "같은 협업팀 선배 — 업무로 알고 지냄",
      "replay_limit": 2,
      "situation_ko": "한국인 선배 담당자가 「프로젝트 기간을 2주 줄이자」고 제안했습니다. 중국인 실무자가 품질 관리를 근거로 반대 의견을 직접 말합니다.",
      "source_modality": "spoken",
      "source_text": "缩短项目时间是很重要，但如果不管质量控制，反而会影响整体进度。每个环节的质量都得保证，这样最后交出来的东西才没问题。"
    },
    "provenance": {
      "content_release_id": "pragma_zhko_bidirectional_candidate_20260904_02",
      "finalized_at": "2026-09-21T09:30:57.041Z",
      "generated_at": "2026-09-21T09:28:40.142Z",
      "generation_attempt": 1,
      "mission_content_hash": "df1870541cfafe222c7eeef8e47a0aed2907b4b8d391fb37833baad9196572d9",
      "model": "Claude",
      "prompt_version": "v5_to_v6_retained_items_claude_20260917",
      "source_mission_content_hash": "8741feacb03812537a8245e345380ee5da8ffbeb5d6dc2365c9397219eb5d13b",
      "source_scenario_id": "d55bf22b-7801-4bbe-afc0-5fbe0299d508"
    },
    "quality_check": {
      "checked_at": "2026-09-21T09:29:32.600Z",
      "findings": [
        {
          "code": "critic_grounding_failure",
          "note_ko": "현재 표현 인용이 없습니다: mpj_items[1]",
          "severity": "warning",
          "where": ""
        }
      ],
      "mission_content_hash": "8d8548a85459c1f4fdb35e6e4f1e286fa6842ce520fa86522724748d7f600740",
      "model": "gpt-4.1",
      "prompt_version": "quality_mission_v6_act_general_v3_scene_plausibility",
      "summary_ko": "AI critic finding 1건의 현재 문항 근거를 확인하지 못해 격리했습니다.",
      "verdict": "warning"
    },
    "schema_version": "mission_v6",
    "unit": {
      "closing_ko": "반대는 관계를 공격하지 않으면서도 무엇에 어느 범위까지 동의하지 않는지 알아볼 수 있어야 합니다. 완화는 이견을 숨기는 장치가 아닙니다.",
      "learner_label": "이견 명료성과 관계 조정",
      "target_feature": "opposition_stance_mitigation",
      "target_feature_version": "1.0"
    }
  },
  "mission_status": "reviewed",
  "release_gate_mode": "legacy_reviewed",
  "scenario_id": "2c7959ad-aac4-4d7a-a17a-e679d7a0b1d1",
  "speech_act": "opposition"
} as const;
