import {
  countCoreEffectiveChars,
  type CoreLengthRange,
} from './coreLengthPolicy.ts'

export const CORE_SOURCE_SENTENCE_MIN = 2
export const CORE_SOURCE_SENTENCE_MAX = 4

/** 한국어·중국어 종결 부호 기준 문장 수. 부호 없는 마지막 절도 한 문장으로 센다. */
export function countCoreSourceSentences(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const chunks = trimmed.match(/[^.!?。！？…]+[.!?。！？…]*/g) ?? []
  const count = chunks.filter((chunk) => /[가-힣一-鿿A-Za-z0-9]/.test(chunk)).length
  return count === 0 ? 1 : count
}

export function coreSourceSentenceIssue(text: string): { count: number; message: string } | null {
  const count = countCoreSourceSentences(text)
  if (count >= CORE_SOURCE_SENTENCE_MIN && count <= CORE_SOURCE_SENTENCE_MAX) return null
  return {
    count,
    message: `source_text는 종결부호 기준 ${CORE_SOURCE_SENTENCE_MIN}~${CORE_SOURCE_SENTENCE_MAX}문장이어야 하지만 ${count}문장입니다.`,
  }
}

export interface CoreSourceIssue {
  sentenceCount: number
  effectiveCharCount: number
  sentenceOutOfRange: boolean
  lengthOutOfRange: boolean
  message: string
}

export type CoreLanguage = 'ko' | 'zh'

export interface CorePrecedingTurnIssue {
  code: 'missing' | 'wrong_language'
  expectedLanguage: CoreLanguage
  message: string
}

export interface CoreBilingualSceneIssue {
  sourceLanguage: CoreLanguage
  targetLanguage: CoreLanguage
  missing: Array<
    | 'source_speaker'
    | 'target_speaker'
    | 'interpreting'
    | 'learner_interpreter'
    | 'role_overlap'
    | 'source_first_person'
  >
  message: string
}

export interface CoreBilingualSceneWarning {
  code: 'ambiguous_direct_party_interaction'
  message: string
}

export interface CoreLearnerSceneIssue {
  code: 'evaluation_criteria'
  message: string
}

export interface CanonicalInterpreterTextResult {
  value: string
  applied: boolean
}

const CORE_LANGUAGE_KO: Record<CoreLanguage, string> = {
  ko: '한국어',
  zh: '중국어',
}

const CORE_SCENE_LANGUAGE_MARKER: Record<CoreLanguage, RegExp> = {
  ko: /한국|한국어/u,
  zh: /중국|중국어|중화권/u,
}

// 생성 계약은 학습자 C의 화면 관점을 `당신`으로 시작할 수 있게 한다. 반면 `학생`은
// A/B의 실제 직업·신분일 수 있으므로 조사 없이 뒤의 `통역`까지 넓게 잇지 않는다.
const LEARNER_INTERPRETER_MARKER = /(?:당신(?:은|이|가)?[^.!?]{0,80}(?:통역|옮기|옮긴|옮겨|전달)|(?:학습자|학생)(?:(?:는|가|이)[^.!?]{0,50}(?:통역|옮기|옮긴|옮겨|전달)|\s*통역사))/u
const LEARNER_LANGUAGE_SPEAKER = /(?:학습자|학생)(?:는|가|이)?[^.!?]{0,25}(?:중국어|한국어)\s*화자(?:로서|이며|이고|이다|역할)/u
const LEARNER_PARTY_ROLE = /(?:학습자|학생)(?:는|가|이)\s*(?:호텔\s*)?(?:고객|투숙객|학생|조원|직원|담당자|교수|연구원|상사|후배|선배)(?:으로|로|이며|이고|이다|입니다)|(?:학습자|학생)인\s*(?:고객|투숙객|학생|조원|직원|담당자|교수|연구원|상사|후배|선배)(?:은|는|이|가)/u
const LEARNER_PARTY_LABEL = /학습자\s*(?:인\s*)?[AB](?![A-Za-z])|[AB](?![A-Za-z])(?:는|은|이|가)?\s*(?:학습자)(?:는|은|이|가|로서|이다|입니다)?/u
const LEARNER_DIRECT_SPEECH_ACT = /(?:학습자|학생)(?:는|가|이)?[^.!?]{0,90}(?:직접\s*(?:말|구두|발화)[^.!?]{0,30}|(?:상대|청자|직원|담당자|고객|학생|상사|교수)에게[^.!?]{0,45})(?:요청하|거절하|감사하|사과하|제안하|초대하|반대하|칭찬하|불만(?:을|을\s*직접)?\s*(?:말하|제기하)|말하)/u
const LEARNER_SPEECH_ACT_RECIPIENT = /(?:학습자|학생)(?:는|가|이)?[^.!?]{0,70}(?:감사|사과|칭찬|초대|요청|불만|제안|반대)(?:\s*인사|\s*말)?(?:을|를)?[^.!?]{0,18}(?:듣|받)/u
const LEARNER_SELF_INTERPRETING = /(?:학습자|학생)(?:는|가|이)?[^.!?]{0,60}(?:자기|자신)(?:의)?\s*(?:말|발화)[^.!?]{0,45}(?:통역|옮기|전달)/u
const YOU_PARTY_ROLE = /당신(?:은|이|가)\s*(?:호텔\s*)?(?:고객|투숙객|학생|조원|직원|담당자|교수|연구원|상사|후배|선배|멘토|책임자|관리자)(?:으로|로|이며|이고|이다|입니다|로서)/u
const YOU_DIRECT_SPEECH_ACT = /당신(?:은|이|가)?[^.!?]{0,90}(?:직접\s*(?:말|구두|발화)[^.!?]{0,30}|(?:상대|청자|직원|담당자|고객|학생|상사|교수)에게[^.!?]{0,45})(?:요청하|거절하|감사하|사과하|제안하|초대하|반대하|칭찬하|불만(?:을|를)?\s*(?:말하|제기하)|말하)/u
const SOURCE_FIRST_PERSON_NARRATION = /(?:^|[.!?]\s*)(?:저는|나는)\s|원발화자[^.!?]{0,35}(?:저는|나는)\s/u
const NO_INTERPRETER_DIRECT_TALK = /통역\s*(?:이|을|가)?\s*없이(?:도)?[^.!?]{0,30}(?:직접\s*)?(?:대화|협의|논의|말)/u
const AMBIGUOUS_DIRECT_PARTY_INTERACTION = /(?:원발화자|화자|청자|담당자|직원|고객|학생|A|B)[^.!?]{0,55}직접[^.!?]{0,25}(?:대화|협의|논의|말)/u

const LEARNER_SCENE_EVALUATION_CUES = [
  /부담(?:을|이|\s*없이)[^.!?]{0,35}(?:크지\s*않도록|없도록|없이)[^.!?]{0,25}(?:배려하며|표현해야|표현을\s*사용)/u,
  /(?:정중한|공손한)\s*표현을\s*사용해야|부담\s*없이[^.!?]{0,35}표현해야/u,
  /부담(?:을|이)\s*(?:주지|느끼지)\s*않[^.!?]{0,35}(?:정중|공손)/u,
  /(?:정중|공손)하게[^.!?]{0,35}(?:요청|거절|초대|제안|사과|감사|불만|반대|칭찬|표현|말|전달)/u,
  /(?:완화|직접성|선택권|화용|대역|적절성|강도|명료성)(?:을|를|이|가|은|는)?[^.!?]{0,30}(?:조절|유지|남기|보장|드러내|표현|고려)/u,
]

/** 통역 코어의 첫 문장을 방향에 따라 같은 A/B/C 역할·언어 계약으로 고정한다. */
export function canonicalInterpreterSituationLead(
  sourceLanguage: CoreLanguage,
  targetLanguage: CoreLanguage,
): string {
  return `학습자 통역사 C인 당신은 ${CORE_LANGUAGE_KO[sourceLanguage]} 원발화자 A와 ${CORE_LANGUAGE_KO[targetLanguage]} 청자 B 사이에서 통역을 맡았습니다.`
}

/**
 * `학습자 A/B`는 확정 계약상 불가능한 결속이므로 모델 문체가 아니라 구조 오류로 본다.
 * 사람의 실제 신분일 수 있는 `학생 A/B`는 바꾸지 않는다.
 */
export function canonicalizeInterpreterPartyLabels(
  text: unknown,
  required: boolean,
): CanonicalInterpreterTextResult {
  const value = typeof text === 'string' ? text.trim() : ''
  if (!required || !value) return { value, applied: false }
  const normalized = value
    .replace(/학습자\s*(?:인\s*)?A(?![A-Za-z])/gu, '원발화자 A')
    .replace(/학습자\s*(?:인\s*)?B(?![A-Za-z])/gu, '청자 B')
    .replace(/A(?![A-Za-z])\s*\(\s*학습자\s*\)/gu, '원발화자 A')
    .replace(/B(?![A-Za-z])\s*\(\s*학습자\s*\)/gu, '청자 B')
  return { value: normalized, applied: normalized !== value }
}

/**
 * 모델이 C를 A/B와 합친 역할 소개 문장을 만들지 못하게 첫 문장을 서버가 조립한다.
 * 기존 첫 문장이 역할 소개라면 교체하고, 사건 서술이라면 앞에 붙여 사건 사실을 보존한다.
 */
export function canonicalizeInterpreterSituation(
  situationKo: unknown,
  sourceLanguage: CoreLanguage,
  targetLanguage: CoreLanguage,
  required: boolean,
): CanonicalInterpreterTextResult {
  const value = typeof situationKo === 'string' ? situationKo.trim() : ''
  if (!required) return { value, applied: false }

  const canonicalLead = canonicalInterpreterSituationLead(sourceLanguage, targetLanguage)
  const labelNormalized = canonicalizeInterpreterPartyLabels(value, true).value
  if (!labelNormalized) return { value: canonicalLead, applied: true }

  const chunks = (labelNormalized.match(/[^.!?。！？…]+[.!?。！？…]*/gu) ?? [])
    .map((chunk) => chunk.trim())
    .filter(Boolean)
  const first = chunks[0] ?? labelNormalized
  if (first === canonicalLead) {
    const normalized = [canonicalLead, ...chunks.slice(1)].join(' ')
    return {
      value: normalized,
      applied: normalized !== value,
    }
  }

  const firstIsRoleFrame =
    /^(?:학습자\s*통역사\s*C인\s*)?당신(?:은|이|가)/u.test(first) ||
    /(?:학습자|학생)\s*(?:인\s*)?[AB](?![A-Za-z])/u.test(first) ||
    /통역[^.!?。！？…]{0,35}(?:맡|역할|진행)|(?:맡|역할)[^.!?。！？…]{0,35}통역/u.test(first)
  const remainder = firstIsRoleFrame && chunks.length > 1 ? chunks.slice(1) : chunks
  const normalized = [canonicalLead, ...remainder].join(' ')
  return { value: normalized, applied: normalized !== value }
}

/** 학생용 situation_ko에 목표 화용 답의 방향이 노출되는지 확인한다. */
export function coreLearnerSceneIssue(situationKo: unknown): CoreLearnerSceneIssue | null {
  const value = typeof situationKo === 'string' ? situationKo.trim() : ''
  if (!LEARNER_SCENE_EVALUATION_CUES.some((pattern) => pattern.test(value))) return null
  return {
    code: 'evaluation_criteria',
    message: '학생용 situation_ko에 정중성·완화·선택권·강도 같은 답안 평가 기준을 노출하면 안 됩니다.',
  }
}

/** 통역 장면이 서로 다른 원발화자·학습자 통역사·청자의 3자 구조인지 확인한다. */
export function coreBilingualSceneIssue(
  situationKo: unknown,
  sourceLanguage: CoreLanguage,
  targetLanguage: CoreLanguage,
  required: boolean,
  relationKo?: unknown,
): CoreBilingualSceneIssue | null {
  if (!required) return null
  const value = typeof situationKo === 'string' ? situationKo.trim() : ''
  const relationValue = typeof relationKo === 'string' ? relationKo.trim() : ''
  const roleScope = `${value} ${relationValue}`.trim()
  const missing: CoreBilingualSceneIssue['missing'] = []
  if (!CORE_SCENE_LANGUAGE_MARKER[sourceLanguage].test(value)) missing.push('source_speaker')
  if (!CORE_SCENE_LANGUAGE_MARKER[targetLanguage].test(value)) missing.push('target_speaker')
  if (!/통역/u.test(value)) missing.push('interpreting')
  if (!LEARNER_INTERPRETER_MARKER.test(value)) missing.push('learner_interpreter')
  if (
    LEARNER_LANGUAGE_SPEAKER.test(roleScope) ||
    LEARNER_PARTY_ROLE.test(roleScope) ||
    LEARNER_PARTY_LABEL.test(roleScope) ||
    LEARNER_DIRECT_SPEECH_ACT.test(roleScope) ||
    LEARNER_SPEECH_ACT_RECIPIENT.test(roleScope) ||
    LEARNER_SELF_INTERPRETING.test(roleScope) ||
    YOU_PARTY_ROLE.test(roleScope) ||
    YOU_DIRECT_SPEECH_ACT.test(roleScope) ||
    NO_INTERPRETER_DIRECT_TALK.test(roleScope)
  ) missing.push('role_overlap')
  if (SOURCE_FIRST_PERSON_NARRATION.test(value)) missing.push('source_first_person')
  if (missing.length === 0) return null
  return {
    sourceLanguage,
    targetLanguage,
    missing,
    message: `통역 situation_ko에는 서로 다른 ${CORE_LANGUAGE_KO[sourceLanguage]} 원발화자 A·${CORE_LANGUAGE_KO[targetLanguage]} 청자 B·학습자 통역사 C가 드러나야 합니다. 학습자는 A/B나 화행 수행자·수신자를 겸할 수 없고, A의 1인칭 시점으로 서술하면 안 됩니다.`,
  }
}

/**
 * `직접` 자체는 금칙어가 아니다. 학습자가 현장에서 직접 통역하는 서술은 허용하고,
 * A/B가 직접 대화·협의한다고만 써 중개 여부가 모호한 경우만 사람 확인 경고로 돌린다.
 */
export function coreBilingualSceneWarning(
  situationKo: unknown,
  required: boolean,
): CoreBilingualSceneWarning | null {
  if (!required) return null
  const value = typeof situationKo === 'string' ? situationKo.trim() : ''
  if (!AMBIGUOUS_DIRECT_PARTY_INTERACTION.test(value)) return null
  if (/(?:학습자|학생)[^.!?]{0,35}직접[^.!?]{0,12}통역/u.test(value)) return null
  return {
    code: 'ambiguous_direct_party_interaction',
    message: 'A/B가 직접 대화·협의한다고 서술되어 통역사의 중개 역할이 모호할 수 있습니다.',
  }
}

/** 응답 화행의 preceding_turn은 대화 상대가 쓰는 target 언어여야 한다(R8/R10). */
export function corePrecedingTurnIssue(
  text: unknown,
  expectedLanguage: CoreLanguage,
  required: boolean,
): CorePrecedingTurnIssue | null {
  if (!required) return null
  const value = typeof text === 'string' ? text.trim() : ''
  if (!value) {
    return {
      code: 'missing',
      expectedLanguage,
      message: `응답 화행의 preceding_turn은 ${CORE_LANGUAGE_KO[expectedLanguage]}로 필수입니다.`,
    }
  }
  const hasExpectedScript = expectedLanguage === 'ko'
    ? /[가-힣]/u.test(value)
    : /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(value)
  if (hasExpectedScript) return null
  return {
    code: 'wrong_language',
    expectedLanguage,
    message: `preceding_turn은 ${CORE_LANGUAGE_KO[expectedLanguage]}여야 합니다.`,
  }
}

/** 생성 단계의 1회 교정 여부를 결정한다. 문장 경계와 글자 수를 함께 본다. */
export function coreSourceIssue(text: string, range: CoreLengthRange): CoreSourceIssue | null {
  const sentenceCount = countCoreSourceSentences(text)
  const effectiveCharCount = countCoreEffectiveChars(text)
  const sentenceOutOfRange =
    sentenceCount < CORE_SOURCE_SENTENCE_MIN || sentenceCount > CORE_SOURCE_SENTENCE_MAX
  const lengthOutOfRange = effectiveCharCount < range.min || effectiveCharCount > range.max
  if (!sentenceOutOfRange && !lengthOutOfRange) return null
  return {
    sentenceCount,
    effectiveCharCount,
    sentenceOutOfRange,
    lengthOutOfRange,
    message: [
      sentenceOutOfRange
        ? `종결부호 기준 ${CORE_SOURCE_SENTENCE_MIN}~${CORE_SOURCE_SENTENCE_MAX}문장 필요(실측 ${sentenceCount})`
        : null,
      lengthOutOfRange
        ? `유효 글자 ${range.min}~${range.max}자 필요(실측 ${effectiveCharCount})`
        : null,
    ].filter(Boolean).join(', '),
  }
}

interface CoreSourceRepairPromptInput {
  originalUserPrompt: string
  previousOutput: Record<string, unknown>
  sourceLanguage: 'ko' | 'zh'
  lengthHintKo: string
  measuredSentenceCount: number
  measuredEffectiveCharCount: number
  effectiveCharRange: CoreLengthRange
}

interface CoreOutputRepairPromptInput {
  originalUserPrompt: string
  previousOutput: Record<string, unknown>
  sourceLanguage: CoreLanguage
  lengthHintKo: string
  effectiveCharRange: CoreLengthRange
  sourceIssue: CoreSourceIssue | null
  precedingTurnIssue: CorePrecedingTurnIssue | null
  bilingualSceneIssue?: CoreBilingualSceneIssue | null
  learnerSceneIssue?: CoreLearnerSceneIssue | null
}

export interface MergeValidatedCoreRepairInput {
  originalOutput: Record<string, unknown>
  repairedOutput: Record<string, unknown>
  effectiveCharRange: CoreLengthRange
  sourceIssue: CoreSourceIssue | null
  precedingTurnIssue: CorePrecedingTurnIssue | null
  bilingualSceneIssue?: CoreBilingualSceneIssue | null
  learnerSceneIssue?: CoreLearnerSceneIssue | null
  interpreterScene?: {
    sourceLanguage: CoreLanguage
    targetLanguage: CoreLanguage
    required: boolean
    relationKo?: unknown
  }
}

export interface MergeValidatedCoreRepairResult {
  output: Record<string, unknown>
  sourceRepairApplied: boolean
  precedingTurnRepairApplied: boolean
  bilingualSceneRepairApplied: boolean
  learnerSceneRepairApplied: boolean
}

function hasValidFocalSegments(sourceText: string, raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 3) return false
  let headCount = 0
  let supportCount = 0
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false
    const segment = item as { text?: unknown; role?: unknown }
    if (typeof segment.text !== 'string' || !segment.text.trim()) return false
    if (!sourceText.includes(segment.text.trim())) return false
    if (segment.role === 'head') headCount += 1
    else if (segment.role === 'support') supportCount += 1
    else return false
  }
  return headCount === 1 && supportCount <= 2
}

/**
 * 한 번의 repair가 여러 필드를 동시에 고칠 때, 통과한 필드만 원본에 합성한다.
 * 한 항목이 아직 실패했다는 이유로 다른 항목의 유효한 교정까지 폐기하지 않는다.
 */
export function mergeValidatedCoreRepair(
  input: MergeValidatedCoreRepairInput,
): MergeValidatedCoreRepairResult {
  const output = { ...input.originalOutput }
  let sourceRepairApplied = false
  let precedingTurnRepairApplied = false
  let bilingualSceneRepairApplied = false
  let learnerSceneRepairApplied = false

  if (input.sourceIssue) {
    const repairedSourceText = String(
      input.repairedOutput.source_text ?? input.repairedOutput.source_text_ko ?? '',
    )
    const repairedFocalSegments = hasValidFocalSegments(
      repairedSourceText,
      input.repairedOutput.focal_segments,
    )
      ? input.repairedOutput.focal_segments
      : hasValidFocalSegments(repairedSourceText, input.originalOutput.focal_segments)
        ? input.originalOutput.focal_segments
        : null
    if (
      !coreSourceIssue(repairedSourceText, input.effectiveCharRange) &&
      repairedFocalSegments
    ) {
      output.source_text = repairedSourceText
      delete output.source_text_ko
      output.focal_segments = repairedFocalSegments
      sourceRepairApplied = true
    }
  }

  if (input.precedingTurnIssue) {
    const repairedPrecedingTurn =
      input.repairedOutput.preceding_turn ?? input.repairedOutput.preceding_turn_zh ?? null
    if (
      !corePrecedingTurnIssue(
        repairedPrecedingTurn,
        input.precedingTurnIssue.expectedLanguage,
        true,
      )
    ) {
      output.preceding_turn = repairedPrecedingTurn
      delete output.preceding_turn_zh
      precedingTurnRepairApplied = true
    }
  }

  if (input.bilingualSceneIssue || input.learnerSceneIssue) {
    const repairedSituationRaw = String(input.repairedOutput.situation_ko ?? '')
    const repairedSituation = input.interpreterScene
      ? canonicalizeInterpreterSituation(
        repairedSituationRaw,
        input.interpreterScene.sourceLanguage,
        input.interpreterScene.targetLanguage,
        input.interpreterScene.required,
      ).value
      : repairedSituationRaw
    const bilingualIssue = input.bilingualSceneIssue
      ? coreBilingualSceneIssue(
        repairedSituation,
        input.bilingualSceneIssue.sourceLanguage,
        input.bilingualSceneIssue.targetLanguage,
        true,
        input.interpreterScene?.relationKo,
      )
      : input.interpreterScene
        ? coreBilingualSceneIssue(
          repairedSituation,
          input.interpreterScene.sourceLanguage,
          input.interpreterScene.targetLanguage,
          input.interpreterScene.required,
          input.interpreterScene.relationKo,
        )
        : null
    const learnerIssue = coreLearnerSceneIssue(repairedSituation)
    if (!bilingualIssue && !learnerIssue) {
      output.situation_ko = repairedSituation
      bilingualSceneRepairApplied = Boolean(input.bilingualSceneIssue)
      learnerSceneRepairApplied = Boolean(input.learnerSceneIssue)
    }
  }

  return {
    output,
    sourceRepairApplied,
    precedingTurnRepairApplied,
    bilingualSceneRepairApplied,
    learnerSceneRepairApplied,
  }
}

/** 원문 분량과 응답 화행 선행 발화 언어 오류를 한 번의 제한된 호출로 함께 교정한다. */
export function buildCoreOutputRepairPrompt(input: CoreOutputRepairPromptInput): string {
  const punctuation = input.sourceLanguage === 'zh'
    ? '중국어 종결부호(。！？)'
    : '한국어 종결부호(.?!)'
  const repairRules: string[] = []

  if (input.sourceIssue) {
    const targetEffectiveCharCount = Math.floor(
      (input.effectiveCharRange.min + input.effectiveCharRange.max) / 2,
    )
    const targetDelta = targetEffectiveCharCount - input.sourceIssue.effectiveCharCount
    const targetDeltaInstruction = targetDelta >= 0
      ? `현재보다 약 ${targetDelta}자 늘리세요.`
      : `현재보다 약 ${Math.abs(targetDelta)}자 줄이세요.`
    repairRules.push(
      `- 직전 source_text 실측: 종결부호 기준 ${input.sourceIssue.sentenceCount}문장, 유효 글자 ${input.sourceIssue.effectiveCharCount}자.`,
      `- 원문 분량은 ${input.lengthHintKo}입니다.`,
      `- 공백·문장부호를 제외한 유효 글자 수를 반드시 ${input.effectiveCharRange.min}~${input.effectiveCharRange.max}자로 맞추세요.`,
      `- 허용 범위의 경계를 겨냥하지 말고 유효 글자 ${targetEffectiveCharCount}자를 목표로 하세요. ${targetDeltaInstruction}`,
      '- 종결부호 기준 2~4문장으로 나누세요.',
      `- 쉼표로 여러 절을 길게 잇는 한 문장으로 만들지 말고, ${punctuation}로 자연스러운 문장 경계를 명시하세요.`,
      '- source_text를 고친 뒤 focal_segments도 새 source_text에서 그대로 복사한 부분문자열로 다시 맞추세요.',
      `- 반환 직전에 source_text의 유효 글자 수를 다시 세어 ${input.effectiveCharRange.min}~${input.effectiveCharRange.max}자 안인지 확인하세요.`,
    )
    if (input.sourceLanguage === 'zh') {
      repairRules.push(
        '- 중국어 계수에서 한자·라틴문자·숫자는 각각 유효 글자 1자이고 공백·문장부호는 제외합니다.',
        `- 짧은 중국어 절 두 개로 끝내지 말고, 기존 situation_ko에 이미 있는 사람·사건·부담을 새 사실 없이 source_text에 충분히 실현하여 유효 글자 ${targetEffectiveCharCount}자 부근까지 확장하세요.`,
      )
    }
  } else {
    repairRules.push('- source_text와 focal_segments는 직전 출력에서 바꾸지 마세요.')
  }

  if (input.precedingTurnIssue) {
    const targetLanguage = CORE_LANGUAGE_KO[input.precedingTurnIssue.expectedLanguage]
    const forbiddenLanguage = input.precedingTurnIssue.expectedLanguage === 'ko' ? '중국어' : '한국어'
    repairRules.push(
      `- preceding_turn 오류: ${input.precedingTurnIssue.message}`,
      `- preceding_turn은 상대 B가 방금 말한 자연스러운 ${targetLanguage} 발화로 고치세요. ${forbiddenLanguage}로 쓰지 마세요.`,
      '- 직전 preceding_turn이 있으면 그 명제·화행·사람·소유·행위 대상을 그대로 보존해 언어만 바로잡으세요.',
      '- 직전 preceding_turn이 비어 있으면 source_text가 직접 응답하는 하나의 명제만 복원하세요. 화면 밖 사실이나 새 논점을 추가하지 마세요.',
      '- source_text를 preceding_turn의 언어로 번역하거나 두 턴의 언어를 서로 뒤집지 마세요.',
    )
  } else {
    repairRules.push('- preceding_turn은 직전 출력에서 바꾸지 마세요.')
  }

  if (input.bilingualSceneIssue) {
    const sourceLanguage = CORE_LANGUAGE_KO[input.bilingualSceneIssue.sourceLanguage]
    const targetLanguage = CORE_LANGUAGE_KO[input.bilingualSceneIssue.targetLanguage]
    repairRules.push(
      `- situation_ko 오류: ${input.bilingualSceneIssue.message}`,
      `- situation_ko는 "당신은 A와 B 사이에서 통역을 맡았습니다"처럼 학습자 통역사 C의 관점으로 시작하세요. A=${sourceLanguage} 원발화자, B=${targetLanguage} 청자, C=학습자 통역사의 세 참여자를 자연스럽게 명시하세요.`,
      '- `학습자`는 C만 가리킵니다. A/B를 학습자라고 부르거나, 학습자가 화행을 직접 수행·수신하거나 자기 말을 스스로 통역하게 만들지 마세요.',
      '- A를 `저는`·`나는`으로 서술하지 마세요. P·D·R은 A↔B 관계이며 C와 A/B의 관계가 아닙니다.',
      '- C는 A의 의미·의도·화용적 힘을 기능적으로 등가 재현합니다. 목표어 형식 조정은 허용하지만 힘·태도·화행 목적을 자의적으로 개선하지 마세요.',
      '- 기존 A/B 역할·P/D/R·사건은 바꾸지 말고 세 사람의 언어 역할과 통역 개입만 분명히 하세요.',
    )
  }

  if (input.learnerSceneIssue) {
    repairRules.push(
      `- situation_ko 오류: ${input.learnerSceneIssue.message}`,
      '- 정중성·완화·선택권·강도·명료성처럼 답의 방향을 알려 주는 표현만 제거하세요.',
      '- 상대·용건·접촉 이력·실제 부담·수행 모드는 관찰 가능한 사실로 그대로 보존하세요.',
    )
  }

  if (!input.bilingualSceneIssue && !input.learnerSceneIssue) {
    repairRules.push('- situation_ko는 직전 출력에서 바꾸지 마세요.')
  }

  return `${input.originalUserPrompt}

[직전 출력의 구조 오류 — 한 번만 교정]
${repairRules.join('\n')}
- 직전 출력의 인물·관계·상황·사실·화행 목적은 그대로 보존하세요. 새 이유·대안·일정·보상을 추가하지 마세요.
- 수정된 전체 JSON만 반환하세요.

[직전 출력]
${JSON.stringify(input.previousOutput, null, 2)}`
}

/**
 * R29 원문 분량이 어긋났을 때 사용하는 1회 교정 요청. 기존 장면 사실을 다시 생성하지
 * 않고 글자 수·문장 경계와 그에 종속된 focal_segments만 정합하게 고치도록 제한한다.
 */
export function buildCoreSourceRepairPrompt(input: CoreSourceRepairPromptInput): string {
  return buildCoreOutputRepairPrompt({
    originalUserPrompt: input.originalUserPrompt,
    previousOutput: input.previousOutput,
    sourceLanguage: input.sourceLanguage,
    lengthHintKo: input.lengthHintKo,
    effectiveCharRange: input.effectiveCharRange,
    sourceIssue: {
      sentenceCount: input.measuredSentenceCount,
      effectiveCharCount: input.measuredEffectiveCharCount,
      sentenceOutOfRange:
        input.measuredSentenceCount < CORE_SOURCE_SENTENCE_MIN ||
        input.measuredSentenceCount > CORE_SOURCE_SENTENCE_MAX,
      lengthOutOfRange:
        input.measuredEffectiveCharCount < input.effectiveCharRange.min ||
        input.measuredEffectiveCharCount > input.effectiveCharRange.max,
      message: 'source_text 분량 또는 문장 경계 오류',
    },
    precedingTurnIssue: null,
    bilingualSceneIssue: null,
    learnerSceneIssue: null,
  })
}
