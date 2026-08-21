import { describe, expect, it } from 'vitest';
import { calculateCrowdMedian, calculateTrendlineScore, TRENDLINE_HINT_POINT_CAP } from './scoring';

describe('Trendline scoring', () => {
  const rising = Array.from({ length: 24 }, (_, index) => index / 23);

  it('awards a perfect line the full 1,000 points', () => {
    expect(calculateTrendlineScore(rising, rising, false)).toEqual({
      meanAbsoluteError: 0,
      shapeAccuracy: 1,
      pointsAwarded: 1_000,
    });
  });

  it('rewards matching shape but keeps closeness dominant', () => {
    const shifted = rising.map((value) => Math.min(1, value + 0.15));
    const reversed = [...rising].reverse();
    expect(calculateTrendlineScore(shifted, rising, false).pointsAwarded).toBeGreaterThan(
      calculateTrendlineScore(reversed, rising, false).pointsAwarded
    );
  });

  it('caps a hinted prediction and calculates the crowd point by point', () => {
    expect(calculateTrendlineScore(rising, rising, true).pointsAwarded).toBe(TRENDLINE_HINT_POINT_CAP);
    expect(calculateCrowdMedian([Array(24).fill(0.2), Array(24).fill(0.8)])).toEqual(Array(24).fill(0.5));
  });
});
