import { clamp, MINI_GAMES_ROUND_MS, rounded } from '../../shared';

export function scoreDistanceEstimate(answer: number, guess: number, timeMs: number) {
  const relativeError = Math.abs(answer - guess) / Math.max(1, answer);
  const speed = clamp(1 - timeMs / MINI_GAMES_ROUND_MS, 0, 1);
  return {
    error: rounded(relativeError * 100),
    score: Math.round(clamp(1 - relativeError, 0, 1) * 900 + speed * 100),
  };
}
