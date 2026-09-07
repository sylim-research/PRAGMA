import { describe, expect, it } from 'vitest';
import { assessTtsCredits } from '../../scripts/lib/tts-credits.mjs';

const current = { tier: 'free', used: 2000, limit: 10000, remaining: 8000,
  resetsAt: 1790000000, checkedAt: '2026-09-07T03:00:00Z' };
describe('TTS credit early warnings', () => {
  it('flags 50% remaining before exhaustion and escalates at 20%', () => {
    expect(assessTtsCredits(current).flag).toBe('ok');
    expect(assessTtsCredits({ ...current, used: 5000, remaining: 5000 }).flag).toBe('early_warning');
    expect(assessTtsCredits({ ...current, used: 8000, remaining: 2000 }).flag).toBe('urgent');
  });
  it('flags seven-day runway even above the percentage threshold', () => {
    const result = assessTtsCredits(current, [{ ...current, used: 0, checkedAt: '2026-09-06T03:00:00Z' }]);
    expect(result.estimatedDaysRemaining).toBe(4);
    expect(result.flag).toBe('early_warning');
  });
  it('does not forecast from a different billing cycle or a same-minute smoke check', () => {
    const result = assessTtsCredits(current, [
      { ...current, used: 0, resetsAt: 1780000000, checkedAt: '2026-09-06T03:00:00Z' },
      { ...current, used: 0, checkedAt: '2026-09-07T02:59:30Z' },
    ]);
    expect(result.estimatedDaysRemaining).toBeNull();
    expect(result.flag).toBe('ok');
  });
});
