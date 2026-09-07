/** Historical role scaffolding is presentation metadata, not part of the event. */
export function naturalLearnerScene(text: string): string {
  return text
    .replace(/(?:학습자\s*통역사\s*C인\s*)?당신은\s*(?:한국어|중국어)\s*원발화자\s*A와\s*(?:한국어|중국어)\s*청자\s*B\s*사이에서\s*통역을\s*맡았습니다\.[\s]*/gu, '')
    .replace(/(?:한국어|중국어|한국인|중국인)\s*(?:원발화자|화자)\s*A/gu, 'A')
    .replace(/(?:한국어|중국어|한국인|중국인)\s*청자\s*B/gu, 'B')
    .replace(/원발화자\s*A/gu, 'A')
    .replace(/청자\s*B/gu, 'B')
    .replace(/([가-힣]+)\s+[AB](은|는|이|가|을|를|와|과)(?=[^A-Za-z]|$)/gu, (_, noun: string, particle: string) => {
      const consonant = (noun.charCodeAt(noun.length - 1) - 0xac00) % 28 !== 0;
      const pairs: Record<string, string[]> = { 은: ['은', '는'], 는: ['은', '는'], 이: ['이', '가'], 가: ['이', '가'], 을: ['을', '를'], 를: ['을', '를'], 와: ['과', '와'], 과: ['과', '와'] };
      return noun + pairs[particle][consonant ? 0 : 1];
    })
    .replace(/([가-힣])\s+[AB](?=에게|의|도|[, .]|$)/gu, '$1')
    .replace(/(?<![A-Za-z])A는/gu, '나는')
    .replace(/(?<![A-Za-z])A가/gu, '내가')
    .replace(/(?<![A-Za-z])A의/gu, '내')
    .replace(/(?<![A-Za-z])A(?=에게|와|를|도|[ ,.]|$)/gu, '나')
    .replace(/(?<![A-Za-z])B(?![A-Za-z])/gu, '상대')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Used by generation and semantic review; this is not a keyword-based pass gate. */
export const SCENE_PLAUSIBILITY_RULE = `
[장면의 현실성·개연성 — P/D/R에 앞서 확인]
학생이 첫 장면을 읽고 실제로 일어날 법하다고 받아들일 수 있어야 한다.
① 이 관계에서 이 용건을 이 사람에게 말할 이유가 있는가?
② 상대가 요청된 일을 수행·조정할 권한과 현실적인 능력이 있는가?
③ 개인정보·사적 일정·금전·건강 등 민감한 일을 맡긴다면 신뢰·동의·기존 도움 관계가 장면에 있는가?
④ 인물·장소·채널·행동·접촉 이력이 서로 맞는가? 평범한 일을 억지로 고부담 사건으로 만들지 않았는가?
"가능할 수도 있다"는 예외를 지어내거나, 화면 밖 배경을 상상해서 장면을 정당화하지 않는다.
예: 단순히 자주 마주치는 이웃에게 병원 예약 변경을 부탁하는 장면은 이유·위임 배경이 없으면 부적절하다.
병원 접수 담당자에게 자신의 예약 변경을 문의하거나, 평소 예약을 도와준 가족에게 이미 동의한 도움을 청하는 장면은 검토할 수 있다.
특정 관계·직업·국적을 일괄 금지하지 않는다. 실제로 적힌 사실과 해당 행위의 연결로 판단한다.
P/D/R 조합·시드가 이 기준과 충돌하면 인물을 억지로 끼워 맞추지 말고 충돌을 검토 사유로 남긴다.
`;

export const NATURAL_INTERPRETING_SCENE_RULE = `
[통역 훈련 장면의 서술]
상황문은 번역처럼 인물의 실제 관계·사건·핵심 제약만 담은 짧은 한국어 두 문장으로 쓴다.
나/저는의 훈련 시점 또는 구체적인 역할명(환자·접수 직원·동료·친구)을 사용한다.
"학습자 통역사인 당신", "한국인 원발화자", "중국인 청자", A/B/C 역할 소개를 학생용 situation_ko·relation_ko에 넣지 않는다.
통역사가 왜 현장에 있는지 설명하기 위해 인물이나 사건을 추가하지 않는다. 주어진 발화를 듣고 다른 언어로 옮기는 훈련이다.
내부 A/B 표기는 원문을 말한 사람과 그 말의 상대를 식별하며 P/D/R도 그 관계 기준이다.
주어진 원문의 의미·의도·화용적 힘은 유지한다. 훈련 시점이 1인칭이어도 자유 발화 과제로 바꾸지 않는다.
`;
