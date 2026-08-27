import { describe, expect, it } from 'vitest';
import { createBatteryChallenge, scoreBatteryEstimate } from './games/batteryPercentage';
import { createCircleChallenge, scoreCircleCenter } from './games/circleCenter';
import { createDistanceChallenge, scoreDistanceEstimate } from './games/guessDistance';
import { createPercentageChallenge, scorePercentageEstimate } from './games/guessPercentage';
import { createEmojiChallenge, scoreFindEmoji } from './games/orangeEmojis';
import { createMapPointChallenge, scoreMapPoint } from './games/pointOnMap';
import { createStraightLineTarget, scoreStraightLine } from './games/straightLine';
import {
  chooseMiniGame,
  estimateMiniGamesDurationMs,
  MINI_GAME_IDS,
  MINI_GAMES_DEFAULT_ROUND_COUNT,
  MINI_GAMES_ROUND_OPTIONS,
  normalizeMiniGamesRoundCount,
} from './registry';

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
    expect(new Set(challenge.items.map((item) => item.x.toFixed(3))).size).toBeGreaterThan(5);
    expect(new Set(challenge.items.map((item) => item.y.toFixed(3))).size).toBeGreaterThan(5);
  });

  it('scores a direct line above a crooked line', () => {
    const start = { x: 0.1, y: 0.2 };
    const end = { x: 0.9, y: 0.8 };
    const direct = scoreStraightLine([start, { x: 0.5, y: 0.5 }, end], start, end, 3_000);
    const crooked = scoreStraightLine([start, { x: 0.5, y: 0.95 }, end], start, end, 3_000);
    expect(direct.straightness).toBe(100);
    expect(direct.score).toBeGreaterThan(crooked.score);
  });

  it('always places the straight-line start to the left of the finish', () => {
    const target = createStraightLineTarget(() => 0.99);
    expect(target.start.x).toBeLessThan(target.end.x);
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

  it('registers every challenge and creates valid visual payloads', () => {
    expect(MINI_GAME_IDS).toEqual([
      'straightLine',
      'orangeEmojis',
      'guessPercentage',
      'circleCenter',
      'guessDistance',
      'pointOnMap',
      'batteryPercentage',
    ]);
    const percentage = createPercentageChallenge(() => 0.42);
    expect(percentage.segments).toHaveLength(3);
    expect(percentage.segments.reduce((total, segment) => total + segment.percentage, 0)).toBe(100);
    expect(percentage.segments.some((segment) => segment.color === percentage.targetColor)).toBe(true);
    const circle = createCircleChallenge(() => 0.5);
    expect(circle.center.x).toBeGreaterThan(0);
    expect(circle.radius).toBeGreaterThan(0);
    expect(createBatteryChallenge(() => 0)).toBe(12);
  });

  it('scores estimates, center clicks, and map points on the shared scale', () => {
    expect(scorePercentageEstimate(42, 42, 2_000).score).toBeGreaterThan(scorePercentageEstimate(42, 85, 2_000).score);
    expect(scoreBatteryEstimate(42, 42, 2_000)).toEqual(scorePercentageEstimate(42, 42, 2_000));
    expect(scoreDistanceEstimate(5_000, 5_100, 2_000).score).toBeGreaterThan(
      scoreDistanceEstimate(5_000, 10_000, 2_000).score
    );
    expect(scoreCircleCenter({ x: 0.4, y: 0.6 }, 0.2, { x: 0.4, y: 0.6 }, 2_000).score).toBeGreaterThan(
      scoreCircleCenter({ x: 0.4, y: 0.6 }, 0.2, { x: 0.8, y: 0.2 }, 2_000).score
    );
    const target = createMapPointChallenge(() => 0.42);
    expect(scoreMapPoint(target, target).score).toBe(1_000);
    const distance = createDistanceChallenge(() => 0.42);
    expect(distance.first.name).not.toBe(distance.second.name);
    expect(distance.answer).toBeGreaterThan(0);
  });
});
