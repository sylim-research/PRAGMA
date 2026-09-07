import { describe, expect, it } from 'vitest';
import { naturalLearnerScene } from '../../../supabase/functions/_shared/learnerScene';
import { compactLearnerScenario } from './canonicalMissionRuntime';

describe('natural learner scenes', () => {
  it('removes the production boilerplate before the two-sentence display limit', () => {
    const text = '학습자 통역사 C인 당신은 한국어 원발화자 A와 중국어 청자 B 사이에서 통역을 맡았습니다. A는 병원 접수 직원 B에게 예약 변경을 문의합니다. 이번 주 진료 시간이 회의와 겹칩니다.';
    expect(compactLearnerScenario(text)).toBe('나는 병원 접수 직원에게 예약 변경을 문의합니다. 이번 주 진료 시간이 회의와 겹칩니다.');
  });
  it('preserves facts rather than pretending an implausible scene has been repaired', () => {
    expect(naturalLearnerScene('A는 이웃 B에게 병원 예약 변경을 부탁합니다. B는 병원에 전화해야 합니다.')).toBe('나는 이웃에게 병원 예약 변경을 부탁합니다. 상대는 병원에 전화해야 합니다.');
  });
  it('keeps concrete roles and Korean particles, and leaves ordinary translations alone', () => {
    expect(naturalLearnerScene('환자 A는 직원 B와 이야기합니다. 이웃 B는 집에 있습니다.')).toBe('환자는 직원과 이야기합니다. 이웃은 집에 있습니다.');
    expect(naturalLearnerScene('나는 조원에게 발표 일정 변경을 요청합니다. 준비에는 이틀이 더 필요합니다.')).toBe('나는 조원에게 발표 일정 변경을 요청합니다. 준비에는 이틀이 더 필요합니다.');
  });
});
