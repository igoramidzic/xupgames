import { describe, expect, it } from 'vitest';
import { calculateDoodleDashPoints } from './doodleDashScoring';

describe('Doodle Dash scoring', () => {
  it('rewards faster guessers and the drawer who helped them', () => {
    expect(calculateDoodleDashPoints(0, 45_000)).toEqual({ guessPoints: 1_000, drawerPoints: 400 });
    expect(calculateDoodleDashPoints(22_500, 45_000)).toEqual({ guessPoints: 750, drawerPoints: 300 });
    expect(calculateDoodleDashPoints(45_000, 45_000)).toEqual({ guessPoints: 500, drawerPoints: 200 });
  });

  it('clamps times outside the turn window', () => {
    expect(calculateDoodleDashPoints(-100, 30_000)).toEqual({ guessPoints: 1_000, drawerPoints: 400 });
    expect(calculateDoodleDashPoints(90_000, 30_000)).toEqual({ guessPoints: 500, drawerPoints: 200 });
  });
});
