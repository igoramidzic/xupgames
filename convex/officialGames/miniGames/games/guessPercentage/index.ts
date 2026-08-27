import { clamp, MINI_GAMES_ROUND_MS, rounded } from '../../shared';

export type PercentageColor = 'coral' | 'gold' | 'mint' | 'blue';
export type PercentageSegment = { color: PercentageColor; percentage: number };

const PERCENTAGE_COLORS = ['coral', 'gold', 'mint'] as const;

export function createPercentageChallenge(random: () => number = Math.random): {
  targetColor: PercentageColor;
  segments: PercentageSegment[];
} {
  const weights = PERCENTAGE_COLORS.map(() => 0.25 + random());
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const guaranteedShare = 10;
  const distributableShare = 100 - guaranteedShare * PERCENTAGE_COLORS.length;
  const percentages = weights.map((weight) => guaranteedShare + (weight / totalWeight) * distributableShare);
  const roundedPercentages = percentages.map((percentage) => Math.round(percentage));
  const correction = 100 - roundedPercentages.reduce((total, percentage) => total + percentage, 0);
  roundedPercentages[roundedPercentages.length - 1] =
    (roundedPercentages[roundedPercentages.length - 1] ?? 25) + correction;
  const targetIndex = Math.min(PERCENTAGE_COLORS.length - 1, Math.floor(random() * PERCENTAGE_COLORS.length));
  return {
    targetColor: PERCENTAGE_COLORS[targetIndex] ?? 'coral',
    segments: PERCENTAGE_COLORS.map((color, index) => ({ color, percentage: roundedPercentages[index] ?? 25 })),
  };
}

export function scorePercentageEstimate(answer: number, guess: number, timeMs: number) {
  const error = Math.abs(answer - guess);
  const accuracy = clamp(1 - error / 50, 0, 1);
  const speed = clamp(1 - timeMs / MINI_GAMES_ROUND_MS, 0, 1);
  return { error: rounded(error), score: Math.round(accuracy * 850 + speed * 150) };
}
