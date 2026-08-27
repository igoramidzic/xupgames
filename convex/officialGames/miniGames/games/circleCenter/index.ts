import { clamp, MINI_GAMES_ROUND_MS, type NormalizedPoint, rounded } from '../../shared';

export function createCircleChallenge(random: () => number = Math.random) {
  return {
    center: { x: 0.32 + random() * 0.36, y: 0.32 + random() * 0.36 },
    radius: 0.19 + random() * 0.07,
    gapRotation: Math.round(random() * 360),
  };
}

export function scoreCircleCenter(answer: NormalizedPoint, radius: number, guess: NormalizedPoint, timeMs: number) {
  const distanceFromCenter = Math.hypot((answer.x - guess.x) * (16 / 9), answer.y - guess.y);
  const radiusError = distanceFromCenter / Math.max(radius, 0.001);
  const speed = clamp(1 - timeMs / MINI_GAMES_ROUND_MS, 0, 1);
  return {
    error: rounded(radiusError * 100),
    score: Math.round(clamp(1 - radiusError, 0, 1) * 900 + speed * 100),
  };
}
