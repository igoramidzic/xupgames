import { describe, expect, it } from 'vitest';
import { buildTriviaBotPlan } from './trivia';

describe('trivia playtest adapter', () => {
  const round = { correctOptionIndex: 2 };

  it('can plan a correct answer after a human-like delay', () => {
    const plan = buildTriviaBotPlan(round, 10_000, 1, () => 0);

    expect(plan.selectedOptionIndex).toBe(2);
    expect(plan.answerAt).toBeGreaterThan(10_000);
    expect(plan.answerAt).toBeLessThanOrEqual(22_000);
  });

  it('can plan a believable wrong answer', () => {
    const randomValues = [0.99, 0.5, 0.25];
    const plan = buildTriviaBotPlan(round, 10_000, 1, () => randomValues.shift() ?? 0);

    expect(plan.selectedOptionIndex).not.toBe(2);
    expect(plan.selectedOptionIndex).toBeGreaterThanOrEqual(0);
    expect(plan.selectedOptionIndex).toBeLessThan(4);
    expect(plan.answerAt).toBeGreaterThan(10_000);
    expect(plan.answerAt).toBeLessThanOrEqual(22_000);
  });
});
