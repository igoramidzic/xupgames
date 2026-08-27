export const MINI_GAMES_SELECTION_MS = 3_200;
export const MINI_GAMES_ROUND_MS = 10_000;
export const MINI_GAMES_RESULTS_MS = 8_000;

export type NormalizedPoint = { x: number; y: number };

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function pointDistance(first: NormalizedPoint, second: NormalizedPoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function rounded(value: number, decimals = 1) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
