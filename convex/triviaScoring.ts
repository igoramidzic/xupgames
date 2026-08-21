export const TRIVIA_ANSWER_DURATION_MS = 15_000;

export function calculateTriviaPoints(responseTimeMs: number): number {
  const clampedResponseTime = Math.min(TRIVIA_ANSWER_DURATION_MS, Math.max(0, responseTimeMs));
  const remainingRatio = (TRIVIA_ANSWER_DURATION_MS - clampedResponseTime) / TRIVIA_ANSWER_DURATION_MS;
  return 500 + Math.round(500 * remainingRatio);
}
