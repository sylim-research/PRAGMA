// mission_v6 생성 프롬프트. Edge(generate-scenario)와 로컬 파일럿 러너가 같은 문자열을 쓴다.
//
// 설계 = Documents/pragma-v6-conversion/2026-09-21_v6생성기_설계안_v2.md (Codex 검토 반영, 연구자 결정 3건).
// 이 파일이 정하는 것은 「생성 템플릿」(모델에게 주는 목표)이다. 저장본의 유효 조건은
// MissionV6Schema와 checkMission의 v6 분기가 정하며, 여기의 목표를 어겼다고 계약 위반이 되지 않는다.
// 모델은 내용 필드만 쓴다. 고정 문구·척도 코드·unit·DCT 원문 계승·provenance는 서버가 넣는다.

import { SCENE_PLAUSIBILITY_RULE } from './learnerScene.ts'

export const MISSION_V6_GENERATION_PROMPT_VERSION = 'mission_v6_generate_v4_under_band_fixchoice_20260921'

export type V6SpeechAct =
  | 'request' | 'refusal' | 'apology' | 'thanks' | 'proposal'
  | 'agreement' | 'opposition' | 'compliment' | 'complaint'
export type V6Direction = 'ko_zh' | 'zh_ko'
export type V6Mode = 'translation' | 'interpreting'

/** 카탈로그에서 프롬프트에 필요한 부분만. 방향별 판(zh_ko)은 호출자가 골라 넣는다. */
export interface V6FeatureForPrompt {
  code: string
  learner_label: string
  operational_definition: string
  band_schema: { code: string; label_ko: string }[]
  /** 저장본이 쓰는 중간 대역 코드(요청만 동결 예외 `appropriate`). */
  within_band_code: string
  relevant_resources: string[]
  excluded_confounds: string[]
  counter_rule_note: string
  fidelity_note: string
}

const ACT_KO: Record<V6SpeechAct, string> = {
  request: '요청', refusal: '거절', apology: '사과', thanks: '감사', proposal: '제안',
  agreement: '초대', opposition: '반대', compliment: '칭찬', complaint: '불만',
}

// 화행별 제작 요령. 카탈로그(targetFeatures.ts)가 정본이고 이 표는 그 안에서 오답을 만드는 요령이다.
// 사람 집필 60건에서 작동한 방식을 예시로 들되, 특정 어휘가 정오를 정하지 않는다(연구자 결정 ②).
// 원문 사실을 바꾸는 오답은 쓰지 않는다(연구자 결정 ③).
const ACT_RECIPES: Record<V6SpeechAct, string> = {
  request: `- 과잉 쪽: 상대가 아직 수락하지 않은 부탁을 이미 맡긴 일·기정사실처럼 전달한다(가능 여부를 묻던 말을 전달 지시로). 예시 형태일 뿐, 같은 형태가 장면에 따라 통상 업무 요청으로 수용될 수 있는지 먼저 따진다.
- 과소 쪽: 요청은 남아 있으나 유보를 겹쳐 무엇을 부탁하는지 흐려진 경우만. 요청 목적 자체가 사라지면 대역이 아니라 명제 위반이다.
- 공손 표지(麻烦您·谢谢 등)만 얹은 문장을 「형식 때문에 부적절」한 오답으로 쓰지 않는다. 그런 문장이 오답이려면 수락 전제 같은 기능 문제가 따로 있어야 한다.`,
  refusal: `- 판단은 완충어 유무가 아니라 기능이다: 거절이 상대의 요청·제안을 어떻게 받는지, 결론이 전달되는지.
- 과잉 쪽: 관계와 부담에 비해 상대 요청을 잘라 내는 기능(상대 사정을 받아 주는 기능 없이 닫기). 완충어가 없다는 사실만으로 오답이 되지 않는다.
- 과소 쪽: 유보가 쌓여 거절 결론이 전달되지 않음.
- 원문에 없는 사유·대안·약속을 지어내지 않는다(오답에서도).`,
  apology: `- 기존 책임의 크기를 과장하거나 축소하는 실현만 대역으로 쓴다.
- 과소 쪽: 책임 주체를 흐리거나 영향을 작게 평가하는 말로 사과가 가벼워짐. 주어만 빼는 식의 차이는 맥락이 되살리므로 쓰지 않는다.
- 과잉 쪽: 지지 않은 책임까지 떠안는 실현.
- 새 책임 사건·원문에 없는 보상·약속을 발명하지 않는다(오답에서도). 사과 공식의 개수로 가르지 않는다.`,
  thanks: `- 감사 대상과 근거(무엇에 대한 감사인지)는 모든 후보에서 그대로 둔다. 근거를 지우는 오답은 쓰지 않는다.
- 과소 쪽: 상대의 도움을 실제로 낮추는 평가어가 그 장면에서 도움을 깎아내릴 때만(단순히 짧은 감사는 적절할 수 있다).
- 과잉 쪽: 의례화되거나 보답 부담을 지우는 실현.
- 호칭·격식으로 가르지 않는다.`,
  agreement: `- 행사·초대 의도는 모든 후보에서 유지한다. 초대 의도가 사라지면 대역이 아니라 명제 위반이다.
- 과잉 쪽: 수락을 압박하는 실현(상대의 선택권을 닫는 말하기). 원문에 없는 약속 사실을 지어내지 않는다.
- 과소 쪽: 초대가 남아 있으나 유보가 쌓여 상대가 어떻게 답해야 할지 불명.`,
  compliment: `- 칭찬 근거(관찰 가능한 행동·성과·특성)와 대상은 유지한다. 초점은 근거와 민감도(그 관계에서 그 내용을 어떻게 언급하는가)다.
- 평가 형용사 개수·강도어 개수로 가르지 않는다. 칭찬 대응(칭찬받고 답하기)과 섞지 않는다.`,
  complaint: `- 문제 사실과 영향은 모든 후보에서 보존한다. 확정된 문제를 스스로 불확실하게 만들거나(예: 제가 잘못 봤나 봐요) 요구를 철회하는(예: 신경 쓰지 마세요) 후보는 원문 사실을 바꾸므로 쓰지 않는다.
- 과소 쪽: 요구는 문장에 그대로 남아 있고, 문제·영향을 가리키는 말이 모호하거나 작게 평가되어 무엇이 문제인지 흐려진 것이다. 만드는 법: 구체적 문제를 「那个事」「有点问题」「好像不太对」처럼 뭉개거나, 영향을 「稍微」「一点点」으로 작게 평가하되, 요구 문장(「今天能不能…」「请…」)은 남긴다.
- 과소 쪽에서 쓰지 않는 것: 「不急」「有空再…」「没关系」「算了」「你看着办」처럼 요구·기한을 거두는 말. 이것은 과소가 아니라 요구 철회다.
- 과잉 쪽: 책임·심각도를 근거보다 키움(원인 확인 전 책임 단정, 피해 범위 확대). 단순 책임 강도인지 원문에 없는 별도 처분 요구인지 구분하고, 후자는 쓰지 않는다.
- 인신 비난·의도 추정·수리 요구 유무로 가르지 않는다.`,
  opposition: `- 반대 입장은 모든 후보에서 남아 있어야 한다. 결국 찬성으로 돌아서는 후보는 화행 목적이 바뀌므로 쓰지 않는다.
- 과잉 쪽: 제시된 안을 원문 논점 범위 안에서 전면 부정하는 대립적 실현. 새 논점을 만들지 않는다.
- 과소 쪽: 반대가 남아 있으나 흐려져 이견이 전달되지 않음.
- 인격 평가·완화어 개수로 가르지 않는다.`,
  proposal: `- 제안 형식과 선택 가능한 안은 모든 후보에서 유지한다. 제안이 단독 결정·명령으로 바뀐 후보는 쓰지 않는다(제외 항목).
- 과잉 쪽: 제안 형식은 남아 있으나 다른 선택지를 닫는 실현. 특정 어휘(只能·必须 등)가 있다는 사실만으로 판정하지 않는다.
- 과소 쪽: 유보가 겹쳐 무엇을 제안하는지 불명.`,
}

const OUTPUT_SHAPE = `{
  "plan": ["1번: 누가 누구에게 어떤 용건으로(한 줄)", "2번: …", "3번: …", "4번: …", "5번: …"],
  "items": [
    { "id": 1, "situation_ko": "", "relation_ko": "", "learner_context_ko": "", "channel": "messenger",
      "pdr": { "p": "equal", "d": "close", "r": "low" }, "title": "", "source": "", "target": "",
      "judgment": "appropriate", "explanation_ko": "", "revision_examples": [] },
    { "id": 2, ...장면 필드, "title": "", "source": "", "target": "", "judgment": "inappropriate", "defect_ko": "",
      "explanation_ko": "", "revision_examples": ["", ""],
      "reason_options": [ { "id": "kebab-case", "text": "" }, { "id": "", "text": "" }, { "id": "", "text": "" } ],
      "accepted_reason_id": "" },
    { "id": 3, ...장면 필드, "title": "", "source": "", "target": "", "defect_ko": "",
      "corrections": [ { "text": "", "is_valid": true, "note_ko": "" }, { "text": "", "is_valid": false, "note_ko": "" }, { "text": "", "is_valid": false, "note_ko": "" } ],
      "explanation_ko": "" },
    { "id": 4, ...장면 필드, "title": "", "source": "", "target": "", "defect_ko": "",
      "reference_alternatives": ["", ""], "explanation_ko": "",
      "contrast": { "context_ko": "", "target": "", "explanation_ko": "" } },
    { "id": 5, ...장면 필드, "source": "",
      "candidates": [ { "text": "", "accepted_band_codes": [""], "note_ko": "" }, ...4개 ] }
  ],
  "lesson_points": [ { "item_id": 1, "label": "", "text": "" }, ...5개 ],
  "dct": { "situation_ko": "", "relation_ko": "", "learner_context_ko": "",
    "reference_alternatives": [ { "text": "", "note_ko": "" }, { "text": "", "note_ko": "" } ],
    "vocabulary_hints": [ { "source": "", "target": "" }, { "source": "", "target": "" } ] }
}`

export function buildMissionV6SystemPrompt(input: {
  act: V6SpeechAct
  direction: V6Direction
  mode: V6Mode
  feature: V6FeatureForPrompt
  /** 같은 화행의 승인된 사람 집필 미션(생성 출력 형식). 문체·깊이의 본보기이며 내용을 베끼지 않는다. */
  exemplar?: unknown
}): string {
  const { act, direction, mode, feature, exemplar } = input
  const srcLang = direction === 'ko_zh' ? '한국어' : '중국어'
  const tgtLang = direction === 'ko_zh' ? '중국어' : '한국어'
  const product = mode === 'interpreting' ? '통역안' : '번역안'
  const bands = feature.band_schema
    // 요청은 저장 코드가 `appropriate`(동결 예외)라 카탈로그의 within_band를 그 코드로 보여 준다.
    .map((band) => `${band.code === 'within_band' ? feature.within_band_code : band.code} = ${band.label_ko}`)
    .join(' / ')
  const directionRules = direction === 'zh_ko'
    ? `- 목표문은 한국어다. 주어를 기계적으로 드러내지 말고, 숙어를 직역하지 말고, 한국어 연어로 옮긴다. 오답 후보도 한국어로 자연스러워야 한다.
- 높임 등급 차이 자체는 판정 기준이 아니다.`
    : `- 목표문은 중국어다. 오답 후보도 중국어 화자가 실제로 쓸 법한 자연스러운 문장이어야 한다.
- 您/你 선택, 격식 어휘, 길이는 판정 기준이 아니다.`
  const modeRules = mode === 'interpreting'
    ? `- 이 미션은 통역 미션이다. 다섯 문항의 channel은 모두 facetoface 또는 phone이다(messenger·email 금지). 문항 장면은 말로 전하는 장면으로 쓰고, 목표문은 말로 옮긴 구어다. 해설에서도 「${product}」이라고 부른다.
- 장면에 통역사를 등장시키지 않는다. 「통역사 C」「A·B」 같은 기호를 쓰지 않고 역할명으로 쓴다(예: 한국인 조장, 중국인 조원).`
    : `- 이 미션은 번역 미션이다. 채널(메신저·이메일 등)에 맞는 글말로 쓰되, 메신저·대면 장면에 공문체를 쓰지 않는다.`

  return `너는 한·중 통번역 화용 학습 미션(mission_v6)의 초안을 쓰는 집필자다. 출력은 JSON 하나뿐이다.
이번 미션 = 화행 「${ACT_KO[act]}」 · 방향 ${srcLang}→${tgtLang} · 방식 ${mode === 'interpreting' ? '통역' : '번역'} · 초점 「${feature.learner_label}」(${feature.code}).

[초점 정의 — 카탈로그 정본]
${feature.operational_definition}
대역(판정 축, 과소→적정→과잉): ${bands}
판정에 쓰는 장치: ${feature.relevant_resources.join(' · ')}
판정에 쓰지 않는 것(제외 항목): ${feature.excluded_confounds.join(' · ')}
깨야 할 소박한 규칙: ${feature.counter_rule_note}
충실성: ${feature.fidelity_note}

[가장 중요한 원칙 — 결함은 원문이 아니라 목표문에 있다]
- 각 문항의 원문(source)은 그 장면에서 화자가 실제로 할 법한, 그 장면에 알맞은 발화다. 원문 자체를 무례하거나 흐린 말로 만들지 않는다.
- 부적절한 목표문은 원문의 내용은 그대로 두고, 원문이 가진 대인적 힘(묻던 말·여지·크기)을 목표어에서 바꿔 버린 것이다. 원문을 충실하게 옮긴 목표문을 부적절하다고 판정하지 않는다.
- 목표문은 부적절한 것이든 적절한 것이든 원문의 사실·시점·확정성(「~할 수 있다」 가능성 ↔ 「~한다」 단정)·조건을 바꾸지 않는다. 이미 끝난 일로 바꾸거나 없는 가정을 더하면 대역 결함이 아니라 오역이다. 예: 허락을 묻던 말을 「이미 바꿨어요」「이미 받았어요」로 옮기면 오역이다. 일방적 통보로 만들 때도 「~로 바꿀게요」「~로 하죠」처럼 아직 일어나지 않은 결정의 통보까지만 쓴다.
- 과소 쪽으로 만든 문장에서도 원문의 요구·요청·기한은 남아 있어야 한다. 「괜찮다」「나중에 해도 된다」「신경 쓰지 마」「有空再说」처럼 요구를 거두는 말은 철회이므로 어떤 후보에도 쓰지 않는다. 과소는 요구가 남은 채 문제나 부탁의 크기·분명함이 줄어든 것이다.
- 2·3·4번은 목표문에 반드시 대역 결함이 하나 있다. 각 문항에 defect_ko(원문 대비 목표문이 어느 대역으로 어떻게 벗어났는지 한 줄)를 쓰고, 결함이 없는 목표문을 내지 않는다.
- 해설은 「원문은 ~인데 목표문은 ~로 바뀌었다」처럼 원문과 목표문의 차이를 장면 근거와 함께 쓴다. 「너무 직접적」「정중하지 않다」 같은 라벨만 쓰지 않는다.

[먼저 plan을 쓴다] 다섯 문항의 사건을 한 줄씩 계획한다. 다섯 사건은 인물·용건·장소가 서로 달라야 하고(같은 「자료 보내기」「회의 일정」을 되풀이하지 않는다), DCT 코어의 사건과도 달라야 한다. 장면(situation_ko)은 두 문장 안팎으로 계기와 아직 정해지지 않은 것(상대가 아직 답하지 않음 등)을 구체적으로 쓴다.

[문항 구조 — 다섯 문항은 서로 다른 사건이다]
1번 첫인상 판단: 짧고 직접적인 말도 이 장면에서는 적절하다는 반례. judgment 기본값 "appropriate". revision_examples는 비워도 된다.
2번 맥락 판단: 대역 한쪽으로 벗어난 ${product}. judgment 기본값 "inappropriate". revision_examples 1~2개(원문 내용 그대로, 대역만 바로잡은 문장).
   이유 선택지 3개, 그중 정답 1개(accepted_reason_id). 오답 이유는 이 문항을 실제로 잘못 읽을 법한 방식이어야 한다(예: 「내용이 다 들어 있으니 괜찮다」류, 제외 항목을 근거로 드는 이유 등은 예시일 뿐 매번 같은 틀을 반복하지 않는다).
3번 선택교정(적절 정확히 1개·부적절 2개): target은 대역 결함이 있는 ${product}이고, 선택지 3개는 그 target을 고친 후보다(세 선택지 모두 target과 다른 문장이어야 한다 — target을 그대로 선택지에 넣지 않는다). 적절한 선택지는 정확히 1개다. 나머지 2개는 결함이 남아 있거나(예: 공손 표지만 더하고 대역 문제는 그대로) 반대쪽 대역으로 넘어간 것이어서, 학습자가 실제로 골라낼 수 있어야 한다. 세 선택지 모두 원문의 내용·조건·불확실성(아마·~인 것 같다 등)을 그대로 지킨다. 오답은 대역 문제가 남아 있거나 반대쪽으로 넘어간 것이다. 다른 선택지도 사실상 적절하면 억지로 오답 해설을 붙이지 말고 문장을 바꾼다.
4번 직접 고쳐 보기: 대역 결함이 하나 있는 ${product}. reference_alternatives 1~2개. contrast는 선택이다 — 관계·부담·사전 합의·매체 가운데 한 조건만 바꾸면 판단이 달라지는 경우에만 쓰고, 방어하기 어려우면 키를 빼라.
5번 네 표현 비교: 한 원문에 대한 후보 4개. 후보마다 독립적으로 대역을 판정한다. 적절 후보 개수·양쪽 대역 배치를 맞추지 않는다(적절 3 + 조정 필요 1도 가능). 경계에 있는 후보만 대역 코드를 2개까지 쓴다.
DCT(산출 과제): 원문·핵심 구간은 서버가 코어에서 그대로 넣는다. 너는 학습자가 읽을 상황·관계·안내(상황문에 원문 문장을 옮겨 적지 않는다 — 누가 누구에게 어떤 계기로 말하는지를 쓴다)와 참고안 2개(같은 내용을 다른 방식으로 옮긴 적절한 예, 각각 note_ko)만 쓴다. 참고안은 코어 원문의 모든 문장을 빠짐없이 옮긴다(근거·기대 효과·의견 요청 등 한 문장도 생략 금지).${mode === 'translation' ? ' vocabulary_hints 2개(화용과 무관한 내용 어휘).' : ' 통역이므로 vocabulary_hints는 빼도 된다.'}
lesson_points: 문항마다 한 줄(label = 짧은 원칙, text = 그 문항의 실제 표현을 인용한 한 문장).

[공통 규칙]
- 3단계로 확인한다. A 장면: 출발어 원문이 장면·관계·P/D/R과 맞는가. B 충실성: 모든 후보·교정안·참고안이 원문의 사실·대상·시점·확정성·조건·약속을 지키는가. C 자연성: 목표문(오답 포함)이 자연스러운가.
- 오답은 대역 차이로만 만든다. 새 사실·마감·계약·사유·보상·약속을 더하거나 원문 핵심을 지워서 오답을 확실하게 만들지 않는다. 원문에 없는 것을 더하는 쪽이 대역 차이를 드러내기 쉬운 경우가 많지만, 규칙은 아니다.
- 특정 어휘가 있다는 사실만으로 대역을 정하지 않는다. 장면의 관계·권리·의무·부담으로 판정하고, 해설도 그 근거를 쓴다.
- 다섯 문항과 DCT는 사건·용건이 서로 겹치지 않는다. P/D/R 값은 장면에 맞춰 정하며 값이 겹쳐도 된다.
- 제목은 문항의 소재를 보여 주는 짧은 명사구다(예: 「시약 준비 지연」「분실한 우산」). 질문형·「~한다면?」「~는데도?」처럼 판단 방향을 암시하는 제목은 쓰지 않는다. 5번 제목은 서버가 넣는다.
- 인물은 역할명으로 부른다. 학습자가 읽는 상황문·관계문에 판정 기준어(정중·완화·선택권·강도·직접적 등)를 쓰지 않는다.
- 해설(explanation_ko)은 한국어로, 왜 그런 판단인지 장면 근거로 쓴다. 필요하면 마지막에 「표현 메모」 1~3줄(목표어 표현과 뜻)을 붙인다.
- 참고안·해설의 문체는 채널과 관계에 맞춘다.
${directionRules}
${modeRules}
- channel ∈ email / messenger / facetoface / phone. pdr.p ∈ speaker_lower / equal / speaker_higher, pdr.d ∈ close / acquaintance / distant, pdr.r ∈ low / mid / high.

[화행별 제작 요령 — ${ACT_KO[act]}]
${ACT_RECIPES[act]}

${SCENE_PLAUSIBILITY_RULE}

${exemplar ? `[본보기 — 같은 화행의 승인된 사람 집필 미션]
깊이·구체성·해설 방식의 기준이다. 사건·문장·제목을 베끼지 말고 새로 쓴다.
${JSON.stringify(exemplar)}

` : ''}[출력 형식] 아래 키만 쓴다. 문항 source는 ${srcLang}, target·corrections·candidates·reference_alternatives는 ${tgtLang}. 5번 candidates의 accepted_band_codes는 위 대역 코드만 쓴다.
${OUTPUT_SHAPE}`
}

export interface V6CoreForPrompt {
  source_text: string
  focal_segments: { role: 'head' | 'support'; text: string }[]
  situation_ko: string
  relation_ko: string
  pdr: { p: string; d: string; r: string }
  channel?: string
  usable_facts?: string[]
  context_spec?: unknown
}

export interface V6RowContext {
  learner_level: string
  domain: string
  theme_code?: string | null
  topic_code?: string | null
  industry?: string | null
}

export function buildMissionV6UserPrompt(input: { core: V6CoreForPrompt; row: V6RowContext }): string {
  const { core, row } = input
  return `[DCT 코어 — 원문과 핵심 구간은 바꾸지 않는다]
${JSON.stringify({
    source_text: core.source_text,
    focal_segments: core.focal_segments,
    situation_ko: core.situation_ko,
    relation_ko: core.relation_ko,
    pdr: core.pdr,
    channel: core.channel ?? null,
    ...(core.usable_facts?.length ? { usable_facts: core.usable_facts } : {}),
    ...(core.context_spec ? { context_spec: core.context_spec } : {}),
  }, null, 1)}

[학습 맥락] 수준 ${row.learner_level} · 영역 ${row.domain}${row.theme_code ? ` · 주제 ${row.theme_code}` : ''}${row.topic_code ? `/${row.topic_code}` : ''}${row.industry ? ` · 산업 ${row.industry}` : ''}
문항 1~5는 이 코어와 같은 화행·초점의 서로 다른 사건으로 새로 쓴다. 코어 사건을 문항에 다시 쓰지 않는다.
DCT의 situation_ko·relation_ko·learner_context_ko는 코어 장면의 사실·관계·권리·의무를 그대로 두고 학습자가 읽기 쉬운 문장으로 쓴다(A·B·통역사 C 같은 기호 금지).`
}

/** 수리 1회용: 이전 초안과 위반 목록을 그대로 주고, 지적된 곳만 고치게 한다(전체 재생성 아님). */
export function buildMissionV6RepairUserPrompt(input: {
  core: V6CoreForPrompt
  row: V6RowContext
  previousDraft: unknown
  violations: { path: string; message: string }[]
}): string {
  return `${buildMissionV6UserPrompt(input)}

[수리 요청] 아래 이전 초안에서 지적된 곳만 고쳐 같은 형식의 JSON 전체를 다시 내라. 지적되지 않은 문항·문장은 그대로 둔다.
지적 사항:
${input.violations.map((v) => `- ${v.path}: ${v.message}`).join('\n')}

이전 초안:
${JSON.stringify(input.previousDraft)}`
}
