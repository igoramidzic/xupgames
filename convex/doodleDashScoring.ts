export function calculateDoodleDashPoints(responseTimeMs: number, drawDurationMs: number) {
  const safeDuration = Math.max(1, drawDurationMs);
  const clampedResponseTime = Math.min(safeDuration, Math.max(0, responseTimeMs));
  const remainingRatio = (safeDuration - clampedResponseTime) / safeDuration;
  return {
    guessPoints: 500 + Math.round(500 * remainingRatio),
    drawerPoints: 200 + Math.round(200 * remainingRatio),
  };
}
