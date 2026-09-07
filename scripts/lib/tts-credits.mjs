/** Conservative early warning using actual subscription readings, never invented usage. */
export function assessTtsCredits(current, history = []) {
  const remainingPercent = Math.max(0, Math.min(100, current.remaining / current.limit * 100));
  const now = Date.parse(current.checkedAt);
  const rates = history.filter(sample =>
    sample.tier === current.tier && sample.limit === current.limit &&
    sample.resetsAt === current.resetsAt && sample.used <= current.used
  ).map(sample => {
    const days = (now - Date.parse(sample.checkedAt)) / 86_400_000;
    return days >= 0.25 && days <= 7 ? (current.used - sample.used) / days : 0;
  });
  const dailyUse = Math.max(0, ...rates);
  const daysUntilEmpty = dailyUse > 0 ? current.remaining / dailyUse : null;
  const daysUntilReset = current.resetsAt ? (current.resetsAt * 1000 - now) / 86_400_000 : null;
  const runwayWarning = daysUntilEmpty !== null && daysUntilEmpty <= 7 &&
    (daysUntilReset === null || daysUntilEmpty < daysUntilReset);
  return {
    ...current, remainingPercent: Math.round(remainingPercent * 10) / 10,
    estimatedDailyUse: dailyUse ? Math.ceil(dailyUse) : null,
    estimatedDaysRemaining: daysUntilEmpty === null ? null : Math.round(daysUntilEmpty * 10) / 10,
    flag: remainingPercent <= 20 ? 'urgent' : remainingPercent <= 50 || runwayWarning ? 'early_warning' : 'ok',
    reason: remainingPercent <= 50 ? 'remaining_credits' : runwayWarning ? 'projected_exhaustion' : null,
  };
}
