import { describe, expect, it } from 'vitest';
import { createBatteryChallenge, scoreBatteryEstimate } from './games/batteryPercentage';
import { createCircleChallenge, scoreCircleCenter } from './games/circleCenter';
import { scoreDistanceEstimate } from './games/guessDistance';
import { createPercentageChallenge, scorePercentageEstimate } from './games/guessPercentage';
import {
  createBrakeCheckChallenge,
  createCopycatSequenceChallenge,
  createCrowdCountChallenge,
  createDropZoneChallenge,
  createFlagFrenzyChallenge,
  createFlashbackTilesChallenge,
  createShadowMatchChallenge,
  createSignalSnapChallenge,
  scoreBrakeCheck,
  scoreCopycatSequence,
  scoreCrowdCount,
  scoreDropZone,
  scoreFlagFrenzy,
  scoreFlashbackTiles,
  scoreShadowMatch,
  scoreSignalSnap,
} from './games/newChallenges';
import { createEmojiChallenge, scoreFindEmoji } from './games/orangeEmojis';
import { scoreMapPoint } from './games/pointOnMap';
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
    expect(chooseMiniGame('pointOnMap', () => 0)).toBe('straightLine');
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
    expect(estimateMiniGamesDurationMs(10)).toBe(212_000);
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
      'batteryPercentage',
      'flashbackTiles',
      'copycatSequence',
      'crowdCount',
      'dropZone',
      'shadowMatch',
      'flagFrenzy',
      'brakeCheck',
      'signalSnap',
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

  it('generates bounded payloads for all eight new challenges', () => {
    const flashback = createFlashbackTilesChallenge(() => 0.42);
    expect(flashback.gridSize).toBe(5);
    expect(flashback.targetTileIds.length).toBeGreaterThanOrEqual(5);
    expect(new Set(flashback.targetTileIds).size).toBe(flashback.targetTileIds.length);

    const copycat = createCopycatSequenceChallenge(() => 0.42);
    expect(copycat.sequence.length).toBeGreaterThanOrEqual(5);
    expect(copycat.sequence.every((pad) => pad >= 0 && pad <= 3)).toBe(true);

    const crowd = createCrowdCountChallenge(() => 0.42);
    expect(crowd.characters.length).toBeGreaterThanOrEqual(7);
    expect(crowd.answerOptions).toHaveLength(4);
    expect(crowd.answerOptions).toContain(crowd.characters.length);

    const drop = createDropZoneChallenge(() => 0.42);
    expect(drop.cycleDurationsMs).toHaveLength(3);
    expect(drop.targetCenter).toBeGreaterThan(0);
    expect(drop.targetCenter).toBeLessThan(1);

    const shadow = createShadowMatchChallenge(() => 0.42);
    expect(shadow.cards).toHaveLength(3);
    expect(shadow.cards.every((card) => card.options.length === 4 && card.options.includes(card.targetShape))).toBe(
      true
    );

    expect(createFlagFrenzyChallenge(() => 0.42).signals).toHaveLength(8);
    expect(createBrakeCheckChallenge(() => 0.42).targets).toHaveLength(2);
    expect(createSignalSnapChallenge(() => 0.42).cueOffsetsMs).toHaveLength(3);
  });

  it('scores the intended answer above a clearly wrong answer in every new challenge', () => {
    expect(scoreFlashbackTiles([1, 2, 3], [1, 2, 3], 2_000).score).toBeGreaterThan(
      scoreFlashbackTiles([1, 2, 3], [4, 5, 6], 2_000).score
    );
    expect(scoreCopycatSequence([0, 1, 2, 3], [0, 1, 2, 3], 2_000).score).toBeGreaterThan(
      scoreCopycatSequence([0, 1, 2, 3], [3], 2_000).score
    );
    expect(scoreCrowdCount(10, 10).score).toBeGreaterThan(scoreCrowdCount(10, 14).score);
    expect(scoreDropZone(0.5, 0.16, [0.5, 0.5, 0.5]).score).toBeGreaterThan(scoreDropZone(0.5, 0.16, [0, 0, 0]).score);
    const cards = [{ targetShape: 'star', options: ['moon', 'star', 'heart', 'bolt'] }];
    expect(scoreShadowMatch(cards, [1], 2_000).score).toBeGreaterThan(scoreShadowMatch(cards, [0], 2_000).score);
    expect(scoreFlagFrenzy([0, 1, 2, 3], [0, 1, 2, 3]).score).toBeGreaterThan(
      scoreFlagFrenzy([0, 1, 2, 3], [3, 2, 1, 0]).score
    );
    expect(scoreBrakeCheck([0.7, 0.8], [0.69, 0.79]).score).toBeGreaterThan(scoreBrakeCheck([0.7, 0.8], [1, 1]).score);
    expect(scoreSignalSnap([1_000, 4_000, 7_000], [1_220, 4_250, 7_230]).score).toBeGreaterThan(
      scoreSignalSnap([1_000, 4_000, 7_000], [-1, -1, -1]).score
    );
  });

  it('scores estimates and center clicks on the shared scale', () => {
    expect(scorePercentageEstimate(42, 42, 2_000).score).toBeGreaterThan(scorePercentageEstimate(42, 85, 2_000).score);
    expect(scoreBatteryEstimate(42, 42, 2_000)).toEqual(scorePercentageEstimate(42, 42, 2_000));
    expect(scoreCircleCenter({ x: 0.4, y: 0.6 }, 0.2, { x: 0.4, y: 0.6 }, 2_000).score).toBeGreaterThan(
      scoreCircleCenter({ x: 0.4, y: 0.6 }, 0.2, { x: 0.8, y: 0.2 }, 2_000).score
    );
  });

  it('keeps legacy map scoring available without registering either map challenge', () => {
    expect(MINI_GAME_IDS).not.toContain('guessDistance');
    expect(MINI_GAME_IDS).not.toContain('pointOnMap');
    expect(scoreDistanceEstimate(5_000, 5_100, 2_000).score).toBeGreaterThan(
      scoreDistanceEstimate(5_000, 10_000, 2_000).score
    );
    expect(
      scoreMapPoint({ latitude: 35.6762, longitude: 139.6503, x: 0.8879, y: 0.3018 }, { x: 0.8879, y: 0.3018 }).score
    ).toBeGreaterThan(990);
  });
});
