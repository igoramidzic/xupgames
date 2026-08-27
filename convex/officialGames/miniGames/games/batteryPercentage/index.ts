import { clamp, MINI_GAMES_ROUND_MS, rounded } from '../../shared';

export function createBatteryChallenge(random: () => number = Math.random) {
  return 12 + Math.floor(random() * 83);
}

export function scoreBatteryEstimate(answer: number, guess: number, timeMs: number) {
  const error = Math.abs(answer - guess);
  const accuracy = clamp(1 - error / 50, 0, 1);
  const speed = clamp(1 - timeMs / MINI_GAMES_ROUND_MS, 0, 1);
  return { error: rounded(error), score: Math.round(accuracy * 850 + speed * 150) };
}
