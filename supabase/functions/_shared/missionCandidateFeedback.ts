/** Candidate changes and their instructional feedback form one revision. */
export const CANDIDATE_FEEDBACK_PROMPT_VERSION = 'candidate_feedback_v1_final_text';
export type CandidateFeedbackUpdate = { item_index: number; explanation_ko: string; recommended_example: string };
const record = (value: unknown): Record<string, any> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
const candidates = (item: Record<string, any>) =>
  item.type === 'fix_choice' ? item.corrections : item.type === 'multi_judge' ? item.candidates : null;

export function candidateFeedbackPackets(before: unknown[], after: unknown[]) {
  return after.flatMap((value, item_index) => {
    const item = record(value), original = record(before[item_index]);
    if (!item || !original || !Array.isArray(candidates(item))) return [];
    const texts = (v: Record<string, any>) => JSON.stringify(candidates(v)?.map((c: any) => c.text));
    if (texts(item) === texts(original)) return [];
    // Old feedback can quote removed candidates, so it is not input evidence.
    const { explanation_ko: _oldExplanation, recommended_example: _oldExample, ...final_item } = item;
    return [{ item_index, final_item }];
  });
}

export function applyCandidateFeedback(
  items: unknown[], expectedIndexes: number[], rawUpdates: unknown, withinBand: string,
): { items: unknown[]; updates: CandidateFeedbackUpdate[] } {
  if (!Array.isArray(rawUpdates) || rawUpdates.length !== expectedIndexes.length) {
    throw new Error('변경 문항의 해설 갱신 결과가 누락됐습니다.');
  }
  const expected = new Set(expectedIndexes), seen = new Set<number>();
  const updates = rawUpdates.map(value => {
    const update = record(value);
    const index = update?.item_index;
    const item = Number.isInteger(index) ? record(items[index]) : null;
    const explanation = typeof update?.explanation_ko === 'string' ? update.explanation_ko.trim() : '';
    const example = typeof update?.recommended_example === 'string' ? update.recommended_example.trim() : '';
    if (!expected.has(index) || seen.has(index) || !item || !explanation || !example) {
      throw new Error('해설 갱신의 대상·중복·필수 내용이 올바르지 않습니다.');
    }
    const validExample = candidates(item)?.some((c: any) => c.text === example &&
      (item.type === 'fix_choice' ? c.is_valid === true : c.accepted_band_codes?.includes(withinBand)));
    if (!validExample) throw new Error('참고 표현이 최종 후보의 권장/적정 표현과 일치하지 않습니다.');
    const finalTexts = [item.source, item.target, ...candidates(item).map((c: any) => c.text)]
      .filter((text): text is string => typeof text === 'string');
    for (const quote of explanation.matchAll(/[“‘「『"']([^”’」』"'\n]+)[”’」』"']/g)) {
      if (!finalTexts.some(text => text.includes(quote[1].trim()))) {
        throw new Error('해설의 인용이 최종 문항의 원문·후보에 없습니다.');
      }
    }
    seen.add(index);
    return { item_index: index, explanation_ko: explanation, recommended_example: example };
  });
  const patched = structuredClone(items);
  for (const update of updates) {
    const item = record(patched[update.item_index])!;
    patched[update.item_index] = { ...item, explanation_ko: update.explanation_ko,
      recommended_example: update.recommended_example };
  }
  return { items: patched, updates };
}
