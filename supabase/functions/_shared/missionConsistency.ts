/** Shared generation/critic rules; semantic checks remain model judgements. */
export function missionCriticContent(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const { quality_check, provenance, authoring, hsk_lexical_audit, ...content } =
    value as Record<string, unknown>
  // Previous verdicts and quoted old candidates bias a fresh critic and may
  // describe content that no longer exists after candidate regeneration.
  return content
}

export const SCENE_ROLE_PDR_RULE = `
[장면·관계·PDR 일치 — 모든 화행·방향·수행 방식 공통]
P는 원문을 말하는 사람 기준이다. 상대보다 낮으면 speaker_lower, 동등하면 equal,
상대보다 높으면 speaker_higher다. 직원이 자기 상사에게 말하면 speaker_lower이고
상사가 자기 직원에게 말하면 speaker_higher다. 통역 훈련자의 지위는 이 코드와 무관하다.
상대의 업무상 처리 권한만으로 지위가 높다고 보지 말고 실제 관계와 장면의 사실을 함께 본다.
relation_ko는 상대를 설명한다(예: "처음 만난 접수 직원", "나를 지도하는 교수").
"나는 나의 상사이다"처럼 나와 상대를 동일인으로 만들거나 나의 역할만 쓰지 않는다.
지정 PDR에 맞는 관계·사건을 먼저 선택한다. 관계가 맞지 않으면 장면을 다시 설계하며,
장면은 그대로 두고 PDR 코드만 바꿔 모순을 숨기지 않는다.
X/A/Y/C는 모두 지정 화행의 목적을 유지한다. 새 사건은 허용하되 요청을 초대·제안으로,
사과를 보상 제안으로 바꾸는 등 다른 화행을 중심 목적으로 삼지 않는다.
`

export const REASON_DISCRIMINATION_RULE = `
[이유 선택지의 구별]
primary만 현재 표현의 실제 주원인을 설명한다. 오답 두 개도 원문·상황·target에 비추어
사실로 성립해야 한다. pragmatic_misconception은 target에 실제로 있는 표현을 근거로 한,
사실이지만 핵심 원인은 아닌 화용 요인(어조·부담 인식·관계 거리 등)이고,
meaning_grammar_context는 사실이지만 다른 판단 차원의 관찰(정보 순서·지시 명시성·어휘 격 등,
그 장면에서 실제로 성립할 때만. 길이는 쓰지 않는다)이다. 오답은 원문 오독·없는 사실·
target에 없는 의미 오류를 전제하지 않는다. 오답이 주원인과 무관하거나 부차적인 것은 결함이 아니다.
세 선택지 모두 이유를 주장해야 한다. "문법적으로 문제가 없다"만으로 끝내지 않는다.
"직접적이다", "선택권이 부족하다", "더 완화해야 한다"가 이 문항에서 같은 진단이라면
세 선택지로 나누지 않는다. 오답이 주원인의 바꿔 말하기·부분 설명이거나 정답과 비슷한 강도로
핵심 이유가 될 수 있으면 다시 쓴다. target에 실제 문법 오류를 넣지 않는다. kind 라벨은 정답의 근거가 아니다.
`

/** Reuses the existing second critic pass; no additional provider call. */
export function buildMissionConsistencyAuditPrompt(targetLanguage: string): string {
  return `너는 PRAGMA 미션의 장면·선택지·피드백 정합성을 대조하는 심사자다.
MJT1~5와 DCT를 순서대로 끝까지 확인한다. 새로운 문장이나 개선안을 생성하지 않는다.
${SCENE_ROLE_PDR_RULE}
${REASON_DISCRIMINATION_RULE}

1. internal_inconsistency / context_plan_mismatch
- 각 situation_ko·relation_ko의 실제 인물 관계를 pdr와 대조한다. 코드가 맞는 것만으로
  장면이 맞다고 가정하지 않는다. 자기 자신이 자기 상사가 되는 서술도 확인한다.
- X/A/Y/C 모두 요청된 화행인지, Anchor와 DCT PDR이 같은지 확인한다.
- 명백한 관계/P 모순과 다른 화행으로의 이탈은 fail이다. 직업명 하나만으로 P를 추정하지 않는다.

2. primary_reason_ambiguity
- 이유 선택지 각각을 target·source·상황과 대조한다. 오답의 전제가 사실이 아니거나(원문 오독·
  없는 사실·target에 없는 의미 오류), 실제 주원인과 같은 뜻이거나 정답과 비슷한 강도로 핵심 이유가
  될 수 있는 오답이 있거나, 이유가 아닌 사실 확인 문장만 있으면 fail이다. 사실이고 명백히 부차적이거나
  다른 판단 차원인 오답은 정상이며, 주원인과 무관하다는 이유로 fail하지 않는다.
  서로 다른 말투로 썼다는 이유로 구별하지 않는다.
- 문제가 없다고 판단한 선택지에는 finding을 만들지 않는다. note_ko가 「정상」「허용」으로 끝나는 finding은
  내지 않는다. finding의 severity는 note_ko의 결론과 같아야 한다.
- finding은 해당 reasons[i].text_ko를 인용하고, note_ko에 겹치는 선택지 ID와 근거를 적는다.

3. internal_inconsistency / feedback_quality_mismatch
- 모든 explanation_ko, corrections/candidates의 note_ko, DCT reference_alternatives의 note_ko를
  현재 연결된 ${targetLanguage} 표현과 정답 키에 대조한다.
- 없어진 표현 인용, 없는 조건절/사과/약속을 있다고 하는 해설, 존재하는 자원을 없다고
  하는 설명은 internal_inconsistency fail이다. 후보가 수정되었어도 이전 해설을 신뢰하지 않는다.
- 현재 상황 단서 → 실제 표현 자원·기능 → 관계적 효과 → 유지/수정 방향이 빠지고
  "공손하다/부적절하다" 같은 일반 평가만 있으면 feedback_quality_mismatch warning이다.

4. comparison_quality_mismatch / gate1_violation
- 두 적정 후보의 전략과 note_ko의 관계 효과가 실질적으로 다른지 확인한다. 단순 재서술은 warning이다.
- 모든 후보와 참고안을 해당 source와 대조한다. 원문에 없는 새 약속·이유·일정 등은
  gate1_violation fail이다. DCT 참고안만 production_task.usable_facts의 추가 사실을 사용할 수 있다.
- 두 적정안 사이에 숨은 유일 정답이나 선형 서열을 요구하지 않는다.

native 미션은 preceding_turn=null이 정식 설계다. 앞선 사건은 situation_ko 안에서 확인한다.
각 finding의 where는 실제 존재하는 한 경로, evidence_excerpt는 그 값의 실제 부분문자열이다.
배열 인덱스는 0부터 시작한다(MJT1=mpj_items[0], MJT5=[4]).
단정할 근거가 없으면 warning으로 남긴다. 모든 문항을 확인하고 최대 16개 finding을 반환한다.
네 검사 영역을 각각 끝까지 점검하고 JSON의 scene_findings, reason_findings, feedback_findings,
meaning_findings에 나누어 반환한다. 한 영역의 결함을 찾았다고 다른 영역을 생략하지 않는다.
각 영역에 결함이 없으면 빈 배열이다. where가 pdr.p라면 evidence_excerpt는 speaker_higher처럼
값만 인용한다. 필드명이나 JSON 문법을 붙이지 않는다.`
}

export const MISSION_CONSISTENCY_SECTIONS = [
  'scene_findings', 'reason_findings', 'feedback_findings', 'meaning_findings',
] as const

export const MISSION_CONSISTENCY_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'pragma_mission_consistency',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [...MISSION_CONSISTENCY_SECTIONS],
      properties: Object.fromEntries(MISSION_CONSISTENCY_SECTIONS.map(section => [section, {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'severity', 'where', 'evidence_excerpt', 'note_ko'],
          properties: {
            code: { type: 'string', enum: ['internal_inconsistency', 'context_plan_mismatch',
              'primary_reason_ambiguity', 'feedback_quality_mismatch', 'comparison_quality_mismatch', 'gate1_violation'] },
            severity: { type: 'string', enum: ['fail', 'warning'] },
            where: { type: 'string' },
            evidence_excerpt: { type: 'string' },
            note_ko: { type: 'string' },
          },
        },
      }])),
    },
  },
}
