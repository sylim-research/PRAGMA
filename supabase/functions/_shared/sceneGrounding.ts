/** These are contextual evidence requirements, not additional research variables. */
export const SCENE_GROUNDING_RULE = `
[사건과 P·D·R의 사실 근거]
코드 뜻을 일상 영어의 느슨한 뜻으로 재해석하지 않는다.
P의 이름은 화자를 기준으로 읽는다. speaker_lower=화자가 상대보다 낮다(권한은 상대에게 있다),
equal=해당 관계에서 동등, speaker_higher=화자가 상대보다 높다(권한은 화자에게 있다).
상대가 더 높은 사건은 speaker_higher가 아니라 speaker_lower다.
D: distant=이전 상호작용이 없는 초면, acquaintance=이전에 실제 교류한 아는 사이,
close=지속적인 사적 교류가 있는 친한 사이. 지금 소개받았다는 이유로 초면을 acquaintance로 세지 않는다.
distant는 초면에만 쓴다. 교류 이력이 있으면 사적 친분이 없거나 격식을 차리는 사이여도 acquaintance다.
R: low=낮음, mid=보통, high=높음. 뜻은 아래의 화행별 사건 근거로 확인한다.
화자는 source_text를 말하는 사람이다. 상대가 먼저 부탁·제안·초대를 했더라도 그 선행 발화자는 화자가 아니라 상대다.
화행명·직함·PDR 값은 사건이 실제로 성립한다는 증거가 아니다. 누가 누구에게 무엇을 했고,
왜 지금 이 말을 하는지 먼저 확인한다. 책임·수혜·거절·초대의 행위자를 필드 사이에서 바꾸지 않는다.
P: 해당 참여자 관계의 실제 평가·지시·자원 배분 권한을 본다. 조장·선배·관리소장이라는
직함, 창구 직원의 처리 능력, 자신의 참여를 거절할 선택권만으로 우위를 만들지 않는다.
조장이 단순 진행자라면 조원보다 높다고 보지 않는다. 조건에 맞추려고 평가권을 발명하지 않는다.
D: 처음 연락하는지, 몇 번 교류했는지, 지속적으로 친밀하게 지냈는지 실제 이력을 본다.
버디 배정이나 같은 조직 소속만으로 아는 사이·친한 사이를 만들지 않는다.
R: 발화 길이·존대 정도·막연한 심리 부담으로 판단하지 않는다. 요청은 실제 노력·시간·자원,
사과는 잘못이 초래한 피해의 심각도, 제안은 의향 충돌·수용 난이도·사안 중대성을 본다.
거절은 수용하지 않을 때 상대의 계획·기대에 생기는 영향, 초대는 참여에 드는 시간·비용·일정 제약을 본다.
감사는 받은 도움의 크기와 상대가 들인 수고, 칭찬은 평가 대상의 개인적 민감성과 공개 범위를 본다.
반대는 이견이 걸린 결정의 중대성과 상대의 입장에 미치는 영향, 불만은 발생한 피해와 해결에 필요한 조정 범위를 본다.
도움을 받았다고 보답 의무를, 칭찬이라고 민감성을 자동 부여하지 않는다. 모든 근거는 해당 사건에 있어야 한다.
이들은 기존 R을 해석할 때 확인할 사건 단서이며, 화행명에 따른 고정 점수나 새로운 척도가 아니다.
R 근거가 없으면 보통으로 추정하지 않는다. 공손 표지의 누적은 높은 품질의 증거가 아니다.
상대가 초대를 거절했다는 사실만으로 초대한 사람의 잘못·피해·사과 의무를 만들지 않는다.
권리·의무는 실제 사건에서 확인되는 기대를 설명하는 보조 관점이다. 화행별 문구로 사실을 대신하지 않는다.
판단 근거는 학생용 상황·관계에도 사실로 드러나야 한다. 내부 근거 메모에만 숨기지 않는다.
학생에게 배려·정중·완화·선택권 같은 정답 방향을 지시하지 않는다.
조사·호응·인물 지시·중복은 최종 문장 그대로 검사한다. 화면 밖 배경으로 결함을 정당화하지 않는다.
상황문은 누가 어떤 사건을 겪고 누구에게 말하려는지 설명하는 안내문이다. 화자가 상대에게 하는 대사나 원문의 한국어 번역을 상황문으로 쓰지 않는다.
`;

export const CORE_SCENE_PREFLIGHT_PROMPT = `통번역 학습 원문을 만들기 전에 사건 시드의 실현 가능성을 확인한다.
${SCENE_GROUNDING_RULE}
화행은 speech_act_ko가 이 과정에서 쓰는 이름이다. 영어 코드를 일상 영어 뜻으로 다시 읽지 않는다.
주어진 화행·PDR·시드의 사실을 모두 유지하면서 평범한 장면을 만들 수 있을 때만 feasible=true다.
일반적인 주제 시드는 구체화할 수 있지만 이미 지정된 인물·사건을 바꾸거나 특수 권한을 발명하지 않는다.
불가능하거나 사실이 충돌하면 feasible=false와 이유를 반환한다. 억지로 모든 조건을 만족시키지 않는다.
observed_pdr는 지정값을 복사하지 말고 사건에서 확인되는 값을 판정한다. 지정 PDR과 하나라도 다르면 feasible=false다.
가능할 때 scene_ko는 140자 이내의 정확히 두 문장, relation_ko는 실제 상대와 관계 한 줄로 쓴다.
번역은 메시지/글, 통역은 구두 상황이다. 나는/저는 또는 구체적인 역할명을 쓰며 A/B/C 소개는 쓰지 않는다.
scene_ko는 상황 설명이다. "늦어서 미안해요"나 "받아 주실 수 있을까요?" 같은 실제 발화는 금지한다.
예: "나는 약속 시간을 착각해 카페에 십 분 늦게 도착했다. 세 번 만난 동호회 회원이 기다리고 있어 그 일에 대해 사과하려 한다."
상황문을 원문의 한국어 번역으로 만들지 않는다. 무엇을 누구 집에 두는지, 누가 제안했는지 같은 행위자·소유자·책임을 생략해 모호하게 만들지 않는다.
source_text나 정답 표현은 아직 만들지 않는다. p/d/r_evidence_ko는 scene_ko와 relation_ko의 사실을
짧게 인용해 지정 조건과 연결한다. 내부 근거는 학생용 문장에 평가어로 복사하지 않는다.
JSON만 반환한다: {"feasible":true,"reason_ko":"판정 이유","scene_ko":"장면 두 문장",
"relation_ko":"상대·관계","speaker_role_ko":"원문 화자 역할","addressee_role_ko":"상대 역할",
"observed_pdr":{"p":"equal","d":"acquaintance","r":"low"},
"p_evidence_ko":"P 사실 근거","d_evidence_ko":"D 사실 근거","r_evidence_ko":"R 사실 근거"}.
feasible=false이면 reason_ko에 충돌 조건을 명시하고 나머지 문자열은 비워 둔다.`;

export interface CoreScenePlan {
  feasible: boolean;
  reason_ko: string;
  scene_ko: string;
  relation_ko: string;
  speaker_role_ko: string;
  addressee_role_ko: string;
  p_evidence_ko: string;
  d_evidence_ko: string;
  r_evidence_ko: string;
  observed_pdr: { p: string; d: string; r: string };
}

export function readCoreScenePlan(value: unknown, expectedPdr?: { p: string; d: string; r: string }): CoreScenePlan | null {
  if (!value || typeof value !== 'object') return null;
  const plan = value as CoreScenePlan;
  if (typeof plan.feasible !== 'boolean' || typeof plan.reason_ko !== 'string' || !plan.reason_ko.trim()) return null;
  if (!plan.feasible) return plan;
  const observed = plan.observed_pdr;
  if (!observed || !['speaker_lower', 'equal', 'speaker_higher'].includes(observed.p)
    || !['distant', 'acquaintance', 'close'].includes(observed.d) || !['low', 'mid', 'high'].includes(observed.r)) return null;
  const mismatches = expectedPdr ? (['p', 'd', 'r'] as const).filter(axis => observed[axis] !== expectedPdr[axis]) : [];
  if (mismatches.length) return { ...plan, feasible: false,
    reason_ko: '사건에서 판정한 PDR이 지정 조건과 다릅니다: ' + mismatches.map(axis => `${axis}=${observed[axis]} (지정 ${expectedPdr![axis]})`).join(', ') };
  const keys = ['scene_ko', 'relation_ko', 'speaker_role_ko', 'addressee_role_ko', 'p_evidence_ko', 'd_evidence_ko', 'r_evidence_ko'] as const;
  if (keys.some(key => typeof plan[key] !== 'string' || !plan[key].trim())) return null;
  if (plan.scene_ko.length > 140 || (plan.scene_ko.match(/[.!?。！？]/g) ?? []).length !== 2) return null;
  if (/(?<![A-Za-z])[ABC](?![A-Za-z])/.test(plan.scene_ko + ' ' + plan.relation_ko)) return null;
  return plan;
}

export const CORE_SEMANTIC_AXES = [
  'speech_act', 'power', 'distance', 'burden', 'domain', 'industry', 'mode', 'context_spec',
  'referents', 'decision_authority', 'topic_seed', 'adjacency', 'participant_roles',
  'scene_source_alignment', 'learner_scene', 'scene_plausibility',
] as const;

/** Hash only the actual material being reviewed, never the review's own verdict. */
export interface CoreSemanticScope {
  direction: string;
  speech_act: string;
  level: string;
  domain: string;
  industry?: string | null;
  mode: string;
  topic_code?: string;
  pdr?: { p?: string; d?: string; r?: string };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
}

export function coreSemanticContent(core: Record<string, unknown>, scope?: CoreSemanticScope): string {
  const pdr = core.pdr as Record<string, unknown> | undefined;
  return stableJson({
    direction: core.direction ?? 'ko_zh', situation_ko: core.situation_ko, relation_ko: core.relation_ko,
    source_text: core.source_text ?? core.source_text_ko,
    preceding_turn: core.preceding_turn ?? core.preceding_turn_zh ?? null,
    source_modality: core.source_modality,
    pdr: { p: pdr?.p, d: pdr?.d, r: pdr?.r },
    context_spec: core.context_spec ?? null,
    focal_segments: core.focal_segments ?? [], usable_facts: core.usable_facts ?? [],
    scope: scope ? {
      direction: scope.direction, speech_act: scope.speech_act, level: scope.level, domain: scope.domain,
      industry: scope.industry ?? null, mode: scope.mode, topic_code: scope.topic_code ?? null,
      pdr: { p: scope.pdr?.p, d: scope.pdr?.d, r: scope.pdr?.r },
    } : null,
  });
}

/** Missing, failed or unresolved semantic evidence must not become an automatic pass. */
export function coreSemanticGate(check: unknown): { ok: boolean; issues: string[]; reason: string } {
  const value = check as { verdict?: unknown; axes?: Record<string, { verdict?: unknown; reason_ko?: unknown }> } | null;
  const issues: string[] = [];
  const reasons: string[] = [];
  for (const axis of CORE_SEMANTIC_AXES) {
    const item = value?.axes?.[axis];
    if (item?.verdict !== 'pass' || typeof item.reason_ko !== 'string' || !item.reason_ko.trim()) {
      issues.push(axis);
      reasons.push(`${axis}: ${typeof item?.reason_ko === 'string' && item.reason_ko.trim() ? item.reason_ko : '의미 검토 근거 누락'}`);
    }
  }
  if (value?.verdict !== 'pass' && issues.length === 0) {
    issues.push('overall');
    reasons.push('의미 검토의 종합 판정이 통과가 아닙니다.');
  }
  return { ok: issues.length === 0, issues, reason: reasons.join(' / ') };
}
