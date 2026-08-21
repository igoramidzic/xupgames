import { describe, expect, it } from 'vitest';
import { buildTrendlineBotPrediction } from './trendline';

describe('Trendline playtest adapter', () => {
  it('creates stable, bounded, varied predictions for 50 bots', () => {
    const actual = Array.from({ length: 24 }, (_, index) => index / 23);
    const predictions = Array.from({ length: 50 }, (_, index) => buildTrendlineBotPrediction(actual, index + 1));
    expect(predictions.every((prediction) => prediction.length === 24)).toBe(true);
    expect(predictions.flat().every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(new Set(predictions.map((prediction) => prediction.join(','))).size).toBeGreaterThan(20);
    expect(buildTrendlineBotPrediction(actual, 17)).toEqual(buildTrendlineBotPrediction(actual, 17));
  });
});
