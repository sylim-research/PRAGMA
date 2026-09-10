import { describe, it, expect } from 'vitest';
import { CORE_SEMANTIC_AXES, coreSemanticGate, coreSemanticContent, readCoreScenePlan } from '../../../supabase/functions/_shared/sceneGrounding';

const allPass = () => ({ verdict: 'pass', axes: Object.fromEntries(CORE_SEMANTIC_AXES.map(axis => [axis, { verdict: 'pass', reason_ko: '제시된 사실과 일치합니다.' }])) });

describe('grounded scene gate', () => {
  it('does not trust a pass summary when power/roles/plausibility fail or remain uncertain', () => {
    for (const axis of ['power', 'distance', 'burden', 'referents', 'scene_source_alignment', 'scene_plausibility']) {
      for (const verdict of ['warning', 'fail']) {
        const check = allPass();
        check.axes[axis] = { verdict, reason_ko: '본문에 권한·접촉 이력 또는 사건 근거가 없습니다.' };
        expect(coreSemanticGate(check)).toMatchObject({ ok: false, issues: [axis] });
      }
    }
  });
  it('cannot pass without every axis and its evidence', () => {
    expect(coreSemanticGate(null).ok).toBe(false);
    const missing = allPass(); delete missing.axes.referents;
    expect(coreSemanticGate(missing).ok).toBe(false);
    const empty = allPass(); empty.axes.burden.reason_ko = ' ';
    expect(coreSemanticGate(empty).ok).toBe(false);
    expect(coreSemanticGate(allPass()).ok).toBe(true);
  });
  it('binds review reuse to the actual scene, referents, source and PDR', () => {
    const core = { situation_ko: 'A가 B에게 사과한다.', relation_ko: '이웃', source_text: '제가 시간을 잘못 알려 드렸어요.', pdr: { p: 'equal', d: 'acquaintance', r: 'mid' } };
    expect(coreSemanticContent(core)).not.toBe(coreSemanticContent({ ...core, situation_ko: 'B가 A에게 사과한다.' }));
    expect(coreSemanticContent(core)).not.toBe(coreSemanticContent({ ...core, pdr: { ...core.pdr, p: 'speaker_higher' } }));
    expect(coreSemanticContent(core)).toBe(coreSemanticContent({ ...core, generation: { semantic_check: allPass() } }));
    expect(coreSemanticContent({ ...core, context_spec: { role_pair: { speaker_ko: '나', addressee_ko: '이웃' }, decision_authority: '없음' } }))
      .toBe(coreSemanticContent({ ...core, context_spec: { decision_authority: '없음', role_pair: { addressee_ko: '이웃', speaker_ko: '나' } } }));
    expect(coreSemanticContent(core)).not.toBe(coreSemanticContent({ ...core, usable_facts: ['새로운 보상 약속'] }));
  });
  it('rejects incomplete preflight plans instead of inferring mid burden or repairing role markers', () => {
    const plan = { feasible: true, reason_ko: '일정 착오가 실제 피해를 초래했습니다.', scene_ko: '저는 이웃에게 모임 시간을 잘못 알려 주었습니다. 이웃은 한 시간 기다렸고 저는 메시지로 사과합니다.', relation_ko: '몇 차례 인사한 이웃', speaker_role_ko: '시간을 잘못 알린 이웃', addressee_role_ko: '기다린 이웃', p_evidence_ko: '서로 이웃', d_evidence_ko: '몇 차례 인사', r_evidence_ko: '한 시간 기다림' };
    Object.assign(plan, { observed_pdr: { p: 'equal', d: 'acquaintance', r: 'mid' } });
    expect(readCoreScenePlan(plan)).toEqual(plan);
    expect(readCoreScenePlan(plan, { p: 'equal', d: 'formal', r: 'mid' })?.feasible).toBe(false);
    expect(readCoreScenePlan({ ...plan, r_evidence_ko: '' })).toBeNull();
    expect(readCoreScenePlan({ ...plan, scene_ko: 'A는 조장이고 B는 조원입니다. 과제를 합니다.' })).toBeNull();
    expect(readCoreScenePlan({ feasible: false, reason_ko: '상대가 거절했다는 사실만으로 화자의 잘못은 성립하지 않습니다.' })?.feasible).toBe(false);
  });
});
