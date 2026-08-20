import { describe, expect, it } from 'vitest';
import { buildDrawingBotPlan, drawingPointsForElapsed } from './drawing';

describe('drawing playtest adapter', () => {
  it('builds a bounded path beginning at the bot cursor', () => {
    const origin = { x: 0.5, y: 0.5 };
    const plan = buildDrawingBotPlan(origin, () => 0);

    expect(plan.style).toBe('loop');
    expect(plan.color).toBe('#3155d9');
    expect(plan.width).toBe(3);
    expect(plan.points).toHaveLength(16);
    expect(plan.points[0]).toEqual(origin);
    for (const point of plan.points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  });

  it('varies the path style between bots', () => {
    const origin = { x: 0.5, y: 0.5 };
    const spiral = buildDrawingBotPlan(origin, () => 0.26);
    const zigzag = buildDrawingBotPlan(origin, () => 0.8);

    expect(spiral.style).toBe('spiral');
    expect(zigzag.style).toBe('zigzag');
    expect(spiral.points).not.toEqual(zigzag.points);
  });

  it('advances a stroke gradually while keeping pace across bot counts', () => {
    expect(drawingPointsForElapsed(100)).toBe(1);
    expect(drawingPointsForElapsed(420)).toBe(4);
    expect(drawingPointsForElapsed(1_000)).toBe(8);
  });
});
