import { describe, expect, it } from 'vitest';
import { applyCandidateFeedback, candidateFeedbackPackets } from '../../../supabase/functions/_shared/missionCandidateFeedback';
import { applyMissionRepairOperations } from './promoteMission';

const before = [
  { type: 'scale4', target: '원래 판단 표현', explanation_ko: '유지할 해설' },
  { type: 'fix_choice', source: '검토해 주세요.', situation_ko: '상황 보존', pdr: { p: 'equal' },
    explanation_ko: '사라질 표현의 해설', recommended_example: '예전 후보',
    corrections: [{ text: '예전 후보', note_ko: '예전 근거', is_valid: true },
      { text: '변경 없는 오답', note_ko: '오답 근거', is_valid: false }] },
];
const replacement = { operation: 'replace_fix_choice_candidate' as const, item_index: 1, candidate_index: 0,
  candidate: { text: '시간이 괜찮으시면 검토해 주세요.', note_ko: '상대의 사정을 고려한다.', is_valid: false } };
const updatedFeedback = { item_index: 1, explanation_ko: '“시간이 괜찮으시면”은 상대의 사정을 고려한다.',
  recommended_example: replacement.candidate.text };

describe('candidate revision feedback', () => {
  it('updates feedback against final candidates while preserving answers, source, peers and other items', () => {
    const original = { mpj_items: before, production_task: { source_text: '고정 원문' } };
    const replaced = applyMissionRepairOperations(original, [replacement]);
    const packets = candidateFeedbackPackets(before, replaced.mpj_items as unknown[]);
    expect(packets.map(p=>p.item_index)).toEqual([1]);
    expect(JSON.stringify(packets)).not.toContain('사라질 표현의 해설');
    expect(JSON.stringify(packets)).not.toContain('예전 후보');
    const refreshed = applyCandidateFeedback(replaced.mpj_items as unknown[], [1], [updatedFeedback], 'within_band');
    const saved = applyMissionRepairOperations(original, [replacement,
      { operation: 'replace_item_feedback', ...updatedFeedback }]);
    expect(saved.mpj_items).toEqual(refreshed.items);
    expect((saved.mpj_items as unknown[])[0]).toEqual(before[0]);
    expect((saved.mpj_items as unknown[])[1]).toMatchObject({
      explanation_ko: updatedFeedback.explanation_ko,
      recommended_example: updatedFeedback.recommended_example,
    });
    expect((refreshed.items[1] as any).corrections[0].is_valid).toBe(true);
    expect((refreshed.items[1] as any).corrections[1]).toEqual(before[1].corrections![1]);
    expect((refreshed.items[1] as any).source).toBe(before[1].source);
    expect(saved.production_task).toEqual(original.production_task);
    expect(original.mpj_items[1].explanation_ko).toBe('사라질 표현의 해설');
  });

  it('does not refresh unchanged candidates and rejects incomplete or unrelated feedback atomically', () => {
    expect(candidateFeedbackPackets(before, structuredClone(before))).toEqual([]);
    const replaced = applyMissionRepairOperations({mpj_items:before}, [replacement]);
    const items = replaced.mpj_items as unknown[];
    const snapshot = structuredClone(items);
    for (const updates of [[], [updatedFeedback, updatedFeedback],
      [{...updatedFeedback,item_index:0}], [{...updatedFeedback,explanation_ko:''}],
      [{...updatedFeedback,recommended_example:'예전 후보'}],
      [{...updatedFeedback,explanation_ko:'“예전 후보”는 상대를 고려한다.'}],
      [{...updatedFeedback,recommended_example:'변경 없는 오답'}]]) {
      expect(()=>applyCandidateFeedback(items,[1],updates,'within_band')).toThrow();
      expect(items).toEqual(snapshot);
    }
  });

  it('accepts either final appropriate comparison candidate without creating a unique best answer', () => {
    const item = { type:'multi_judge', candidates:[
      {text:'方便的话，请看一下。', accepted_band_codes:['within_band']},
      {text:'请您有空时看一下。', accepted_band_codes:['within_band']},
      {text:'马上看。', accepted_band_codes:['too_direct']},
      {text:'立即看。', accepted_band_codes:['too_direct']},
    ] };
    for (const example of item.candidates.slice(0,2)) {
      const result = applyCandidateFeedback([item], [0], [{item_index:0,
        explanation_ko:`“${example.text}”은 상대가 검토할 시간을 고려한다.`, recommended_example:example.text}], 'within_band');
      expect((result.items[0] as typeof item).candidates).toEqual(item.candidates);
    }
    expect(()=>applyCandidateFeedback([item], [0], [{item_index:0,
      explanation_ko:'이전 해설', recommended_example:'马上看。'}], 'within_band')).toThrow();
  });
});
