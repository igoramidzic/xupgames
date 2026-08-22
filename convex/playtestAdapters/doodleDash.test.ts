import { describe, expect, it } from 'vitest';
import { buildDoodleDashBotPath, buildDoodleDashBotRoundPlan, doodleDashBotGuessAt } from './doodleDash';

describe('Doodle Dash playtest adapter', () => {
  it('builds stable, varied, bounded random-looking paths', () => {
    const paths = Array.from({ length: 12 }, (_, strokeIndex) => buildDoodleDashBotPath(8_141, strokeIndex));

    expect(buildDoodleDashBotPath(8_141, 3)).toEqual(buildDoodleDashBotPath(8_141, 3));
    expect(new Set(paths.map((path) => JSON.stringify(path))).size).toBe(paths.length);
    for (const path of paths) {
      expect(path.length).toBeGreaterThanOrEqual(16);
      expect(path.length).toBeLessThanOrEqual(28);
      for (const point of path) {
        expect(point.x).toBeGreaterThanOrEqual(0.04);
        expect(point.x).toBeLessThanOrEqual(0.96);
        expect(point.y).toBeGreaterThanOrEqual(0.04);
        expect(point.y).toBeLessThanOrEqual(0.96);
      }
    }
  });

  it('stagger-selects one valid word option for a bot drawer', () => {
    const round = { choiceStartedAt: 10_000, gameNumber: 4, turnNumber: 7 };
    const plans = Array.from({ length: 50 }, (_, index) => buildDoodleDashBotRoundPlan(round as never, index + 1));

    for (const plan of plans) {
      expect(plan.wordChoiceAt).toBeGreaterThanOrEqual(10_450);
      expect(plan.wordChoiceAt).toBeLessThan(11_400);
      expect(plan.wordOptionIndex).toBeGreaterThanOrEqual(0);
      expect(plan.wordOptionIndex).toBeLessThanOrEqual(2);
    }
    expect(new Set(plans.map((plan) => plan.wordChoiceAt)).size).toBeGreaterThan(1);
  });

  it('schedules every bot guess before the shortened final countdown can expire', () => {
    const drawStartedAt = 100_000;
    const guessTimes = Array.from({ length: 50 }, (_, index) => doodleDashBotGuessAt(drawStartedAt, index + 1, 3));

    expect(Math.min(...guessTimes)).toBeGreaterThanOrEqual(drawStartedAt + 2_000);
    expect(Math.max(...guessTimes)).toBeLessThan(drawStartedAt + 9_000);
    expect(Math.max(...guessTimes) - Math.min(...guessTimes)).toBeLessThan(12_000);
    expect(new Set(guessTimes).size).toBeGreaterThan(1);
  });
});
