import { describe, expect, it } from 'vitest';
import {
  chooseMiniGame,
  createEmojiChallenge,
  estimateMiniGamesDurationMs,
  MINI_GAMES_DEFAULT_ROUND_COUNT,
  MINI_GAMES_ROUND_OPTIONS,
  normalizeMiniGamesRoundCount,
  scoreFindEmoji,
  scoreStraightLine,
} from './miniGamesEngine';

describe('Mini Game Mix engine', () => {
  it('does not repeat the previous mini-game when another is available', () => {
    expect(chooseMiniGame('straightLine', () => 0)).toBe('orangeEmojis');
    expect(chooseMiniGame('orangeEmojis', () => 0)).toBe('straightLine');
  });

  it('scatters five to ten copies of one target among repeatable decoys', () => {
    const challenge = createEmojiChallenge(() => 0.42);
    const targets = challenge.items.filter((item) => item.emoji === challenge.targetEmoji);
    const distractors = challenge.items.filter((item) => item.emoji !== challenge.targetEmoji);
    expect(challenge.items).toHaveLength(24);
    expect(targets.length).toBeGreaterThanOrEqual(5);
    expect(targets.length).toBeLessThanOrEqual(10);
    expect(distractors.every((item) => item.emoji !== challenge.targetEmoji)).toBe(true);
    expect(new Set(distractors.map((item) => item.emoji)).size).toBeLessThan(distractors.length);
    expect(challenge.items.every((item) => item.x >= 0 && item.x <= 1 && item.y >= 0 && item.y <= 1)).toBe(true);
  });

  it('scores a direct line above a crooked line', () => {
    const start = { x: 0.1, y: 0.2 };
    const end = { x: 0.9, y: 0.8 };
    const direct = scoreStraightLine([start, { x: 0.5, y: 0.5 }, end], start, end, 3_000);
    const crooked = scoreStraightLine([start, { x: 0.5, y: 0.95 }, end], start, end, 3_000);
    expect(direct.straightness).toBe(100);
    expect(direct.score).toBeGreaterThan(crooked.score);
  });

  it('penalizes wrong emoji clicks and derives the session duration from the round count', () => {
    expect(scoreFindEmoji(5, 0, 2_000).score).toBeGreaterThan(scoreFindEmoji(5, 3, 2_000).score);
    expect(estimateMiniGamesDurationMs(10)).toBe(172_000);
  });

  it('offers longer playlists and upgrades retired configuration values to the default', () => {
    expect(MINI_GAMES_ROUND_OPTIONS).toEqual([10, 15, 20, 25]);
    expect(MINI_GAMES_DEFAULT_ROUND_COUNT).toBe(10);
    expect(normalizeMiniGamesRoundCount(15)).toBe(15);
    expect(normalizeMiniGamesRoundCount(5)).toBe(10);
  });
});
