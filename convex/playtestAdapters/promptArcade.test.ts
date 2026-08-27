import { describe, expect, it } from 'vitest';
import { getGamePlaytestBotTargetLimit } from './index';
import { buildPromptArcadeBotPrompt, buildPromptArcadeBotResultPlan } from './promptArcade';

describe('Prompt Arcade playtest adapter', () => {
  it('caps Prompt Arcade playtests at the game participant limit', () => {
    expect(getGamePlaytestBotTargetLimit('promptArcade', 50)).toBe(30);
    expect(getGamePlaytestBotTargetLimit('trivia', 50)).toBe(50);
    expect(getGamePlaytestBotTargetLimit('miniGames', 50)).toBeNull();
  });

  it('builds bounded varied prompts with explicit winning criteria', () => {
    const prompts = Array.from({ length: 30 }, (_, index) => buildPromptArcadeBotPrompt(index + 1, 3, 1));

    expect(new Set(prompts).size).toBeGreaterThan(20);
    for (const prompt of prompts) {
      expect(prompt).toContain('Winning criteria:');
      expect(prompt.length).toBeLessThanOrEqual(1_000);
    }
    expect(buildPromptArcadeBotPrompt(4, 3, 2)).not.toBe(buildPromptArcadeBotPrompt(4, 3, 1));
  });

  it('stagger-plans a bounded score submission before round timeout', () => {
    const round = { roundNumber: 4, playStartsAt: 10_000, playEndsAt: 30_000 };
    const plans = Array.from({ length: 30 }, (_, index) => buildPromptArcadeBotResultPlan(round as never, index + 1));

    expect(new Set(plans.map((plan) => plan.finishAt)).size).toBeGreaterThan(20);
    for (const plan of plans) {
      expect(plan.finishAt).toBeGreaterThan(round.playStartsAt);
      expect(plan.finishAt).toBeLessThan(round.playEndsAt);
      expect(plan.quality).toBeGreaterThanOrEqual(0);
      expect(plan.quality).toBeLessThanOrEqual(1);
    }
  });
});
