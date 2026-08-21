export const TRENDLINE_POINT_COUNT = 24;
export const TRENDLINE_MAX_POINTS = 1_000;
export const TRENDLINE_HINT_POINT_CAP = 700;

export type TrendlineScore = {
  meanAbsoluteError: number;
  shapeAccuracy: number;
  pointsAwarded: number;
};

function direction(delta: number): -1 | 0 | 1 {
  if (delta > 0.035) return 1;
  if (delta < -0.035) return -1;
  return 0;
}

export function validateNormalizedTrendline(values: number[]): number[] {
  if (
    values.length !== TRENDLINE_POINT_COUNT ||
    values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
  ) {
    throw new Error(`A trendline must contain ${TRENDLINE_POINT_COUNT} finite values between zero and one.`);
  }
  return values.map((value) => Math.round(value * 10_000) / 10_000);
}

export function calculateTrendlineScore(predicted: number[], actual: number[], usedHint: boolean): TrendlineScore {
  const prediction = validateNormalizedTrendline(predicted);
  const truth = validateNormalizedTrendline(actual);
  const meanAbsoluteError =
    prediction.reduce((total, value, index) => total + Math.abs(value - truth[index]), 0) / TRENDLINE_POINT_COUNT;
  const boundaries = [0, 4, 8, 12, 16, 20, 23] as const;
  let shapeTotal = 0;
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const predictedDirection = direction(prediction[end] - prediction[start]);
    const actualDirection = direction(truth[end] - truth[start]);
    shapeTotal +=
      predictedDirection === actualDirection ? 1 : predictedDirection === 0 || actualDirection === 0 ? 0.35 : 0;
  }
  const shapeAccuracy = shapeTotal / (boundaries.length - 1);
  const uncappedPoints = Math.max(
    0,
    Math.min(TRENDLINE_MAX_POINTS, Math.round(850 * (1 - meanAbsoluteError) ** 2 + 150 * shapeAccuracy))
  );
  return {
    meanAbsoluteError: Math.round(meanAbsoluteError * 10_000) / 10_000,
    shapeAccuracy: Math.round(shapeAccuracy * 10_000) / 10_000,
    pointsAwarded: usedHint ? Math.min(TRENDLINE_HINT_POINT_CAP, uncappedPoints) : uncappedPoints,
  };
}

export function calculateCrowdMedian(predictions: number[][]): number[] | null {
  if (predictions.length === 0) return null;
  const normalized = predictions.map(validateNormalizedTrendline);
  return Array.from({ length: TRENDLINE_POINT_COUNT }, (_, pointIndex) => {
    const values = normalized.map((prediction) => prediction[pointIndex]).sort((first, second) => first - second);
    const middle = Math.floor(values.length / 2);
    const median = values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
    return Math.round(median * 10_000) / 10_000;
  });
}
