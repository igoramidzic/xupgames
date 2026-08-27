import { clamp, MINI_GAMES_ROUND_MS, type NormalizedPoint, pointDistance } from '../../shared';

export function createStraightLineTarget(random: () => number = Math.random) {
  const start = {
    x: 0.13 + random() * 0.08,
    y: 0.2 + random() * 0.6,
  };
  const end = {
    x: 0.79 + random() * 0.08,
    y: 0.2 + random() * 0.6,
  };
  return { start, end };
}

export function scoreStraightLine(
  points: readonly NormalizedPoint[],
  start: NormalizedPoint,
  end: NormalizedPoint,
  timeMs: number
) {
  if (points.length < 2) return { score: 0, straightness: 0 };

  const lineLength = Math.max(0.001, pointDistance(start, end));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const meanDeviation =
    points.reduce((total, point) => {
      const perpendicularDistance =
        Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / lineLength;
      return total + perpendicularDistance;
    }, 0) /
    points.length /
    lineLength;
  const endpointError =
    (pointDistance(points[0] ?? start, start) + pointDistance(points[points.length - 1] ?? end, end)) / lineLength;
  const straightness = clamp(Math.round((1 - meanDeviation * 4.2 - endpointError * 1.4) * 1_000) / 10, 0, 100);
  const speedPoints = clamp(1 - timeMs / MINI_GAMES_ROUND_MS, 0, 1) * 300;
  return { straightness, score: Math.round(straightness * 7 + speedPoints) };
}
