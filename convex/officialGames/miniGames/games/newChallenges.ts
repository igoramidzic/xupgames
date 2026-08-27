const clamp = (value: number, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

function integer(random: () => number, minimum: number, maximum: number) {
  return Math.floor(random() * (maximum - minimum + 1)) + minimum;
}

function shuffle<T>(items: readonly T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(random() * (index + 1)));
    [result[index], result[swapIndex]] = [result[swapIndex] as T, result[index] as T];
  }
  return result;
}

function speedBonus(timeMs: number, maximum = 100) {
  return Math.round(maximum * clamp(1 - timeMs / 10_000));
}

export function createFlashbackTilesChallenge(random: () => number = Math.random) {
  const targetCount = integer(random, 5, 8);
  return {
    kind: 'flashbackTiles' as const,
    gridSize: 5,
    targetTileIds: shuffle(
      Array.from({ length: 25 }, (_, index) => index),
      random
    ).slice(0, targetCount),
    revealDurationMs: 1_650,
  };
}

export function scoreFlashbackTiles(targetTileIds: number[], selectedTileIds: number[], timeMs: number) {
  const targets = new Set(targetTileIds);
  const selected = new Set(selectedTileIds);
  const correct = [...selected].filter((id) => targets.has(id)).length;
  const wrong = selected.size - correct;
  const missed = targets.size - correct;
  const recall = clamp((correct - wrong * 0.6) / Math.max(1, targets.size));
  const score = Math.round(recall * 900 + (correct === targets.size && wrong === 0 ? speedBonus(timeMs) : 0));
  return { score, correct, wrong, missed };
}

export function createCopycatSequenceChallenge(random: () => number = Math.random) {
  return {
    kind: 'copycatSequence' as const,
    sequence: Array.from({ length: integer(random, 5, 6) }, () => integer(random, 0, 3)),
    playbackStepMs: 460,
  };
}

export function scoreCopycatSequence(sequence: number[], padIds: number[], timeMs: number) {
  let correctPrefix = 0;
  while (correctPrefix < padIds.length && padIds[correctPrefix] === sequence[correctPrefix]) correctPrefix += 1;
  const completed = correctPrefix === sequence.length && padIds.length === sequence.length;
  const score = Math.round((correctPrefix / Math.max(1, sequence.length)) * 900 + (completed ? speedBonus(timeMs) : 0));
  return { score, correctPrefix, sequenceLength: sequence.length };
}

const CROWD_SYMBOLS = ['●', '▲', '■', '◆'] as const;

export function createCrowdCountChallenge(random: () => number = Math.random) {
  const count = integer(random, 7, 14);
  const characters = Array.from({ length: count }, (_, index) => ({
    id: `bean-${index}`,
    lane: integer(random, 0, 3),
    delayMs: integer(random, 0, 2_500),
    durationMs: integer(random, 2_400, 4_200),
    direction: random() < 0.5 ? -1 : 1,
    symbol: CROWD_SYMBOLS[integer(random, 0, CROWD_SYMBOLS.length - 1)] ?? '●',
  }));
  const offsets = shuffle([-2, -1, 0, 1, 2], random).slice(0, 4);
  if (!offsets.includes(0)) offsets[0] = 0;
  const answerOptions = shuffle([...new Set(offsets.map((offset) => Math.max(1, count + offset)))], random);
  while (answerOptions.length < 4) {
    const candidate = Math.max(1, count + answerOptions.length + 1);
    if (!answerOptions.includes(candidate)) answerOptions.push(candidate);
  }
  return { kind: 'crowdCount' as const, characters, answerOptions };
}

export function scoreCrowdCount(answer: number, guess: number) {
  const error = Math.abs(answer - guess);
  const score = error === 0 ? 1_000 : error === 1 ? 650 : error === 2 ? 300 : 0;
  return { score, error };
}

export function createDropZoneChallenge(random: () => number = Math.random) {
  return {
    kind: 'dropZone' as const,
    targetCenter: Math.round((0.28 + random() * 0.44) * 1_000) / 1_000,
    targetWidth: 0.16,
    cycleDurationsMs: [1_900, 1_500, 1_150],
  };
}

export function scoreDropZone(targetCenter: number, targetWidth: number, releasePositions: number[]) {
  const errors = releasePositions.map((position) => Math.abs(position - targetCenter));
  const averageError = errors.reduce((total, error) => total + error, 0) / Math.max(1, errors.length);
  const perfectDrops = errors.filter((error) => error <= targetWidth / 4).length;
  const score = Math.round(clamp(1 - averageError / 0.5) * 850 + perfectDrops * 50);
  return { score: Math.min(1_000, score), averageError: Math.round(averageError * 100), perfectDrops };
}

export const SHADOW_SHAPES = ['star', 'heart', 'moon', 'bolt', 'diamond', 'flower'] as const;

export function createShadowMatchChallenge(random: () => number = Math.random) {
  const targets = shuffle(SHADOW_SHAPES, random).slice(0, 3);
  return {
    kind: 'shadowMatch' as const,
    cards: targets.map((targetShape) => ({
      targetShape,
      options: shuffle(
        [
          targetShape,
          ...shuffle(
            SHADOW_SHAPES.filter((shape) => shape !== targetShape),
            random
          ).slice(0, 3),
        ],
        random
      ),
    })),
  };
}

export function scoreShadowMatch(
  cards: Array<{ targetShape: string; options: string[] }>,
  selectedOptionIndices: number[],
  timeMs: number
) {
  const correct = cards.filter(
    (card, index) => card.options[selectedOptionIndices[index] ?? -1] === card.targetShape
  ).length;
  const wrong = cards.length - correct;
  const score = correct * 300 + (correct === cards.length ? speedBonus(timeMs) : 0);
  return { score, correct, wrong };
}

export function createFlagFrenzyChallenge(random: () => number = Math.random) {
  return {
    kind: 'flagFrenzy' as const,
    signals: Array.from({ length: 8 }, () => integer(random, 0, 3)),
    signalDurationMs: 820,
  };
}

export function scoreFlagFrenzy(signals: number[], pressedPads: number[]) {
  let correct = 0;
  let streak = 0;
  let bestStreak = 0;
  for (let index = 0; index < signals.length; index += 1) {
    if (pressedPads[index] === signals[index]) {
      correct += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  }
  const wrong = signals.length - correct;
  const score = Math.min(1_000, correct * 105 + bestStreak * 20);
  return { score, correct, wrong, bestStreak };
}

export function createBrakeCheckChallenge(random: () => number = Math.random) {
  return {
    kind: 'brakeCheck' as const,
    targets: [0.58 + random() * 0.27, 0.58 + random() * 0.27].map((value) => Math.round(value * 1_000) / 1_000),
    fillDurationMs: 2_200,
  };
}

export function scoreBrakeCheck(targets: number[], releaseValues: number[]) {
  const attempts = targets.map((target, index) => {
    const value = releaseValues[index] ?? 0;
    const error = Math.abs(target - value);
    const overshot = value > target;
    const score = clamp(1 - error / 0.45) * (overshot ? 0.65 : 1);
    return { error, overshot, score };
  });
  const best = attempts.reduce((current, attempt) => (attempt.score > current.score ? attempt : current), attempts[0]);
  return {
    score: Math.round((best?.score ?? 0) * 1_000),
    bestError: Math.round((best?.error ?? 1) * 100),
    overshoots: attempts.filter((attempt) => attempt.overshot).length,
  };
}

export function createSignalSnapChallenge(random: () => number = Math.random) {
  return {
    kind: 'signalSnap' as const,
    cueOffsetsMs: [1_350 + integer(random, 0, 500), 4_150 + integer(random, 0, 500), 7_000 + integer(random, 0, 500)],
  };
}

export function scoreSignalSnap(cueOffsetsMs: number[], responseOffsetsMs: number[]) {
  const reactions = cueOffsetsMs
    .map((cue, index) => (responseOffsetsMs[index] ?? -1) - cue)
    .filter((reaction) => reaction >= 0 && reaction <= 1_500)
    .sort((first, second) => first - second);
  const falseStarts = cueOffsetsMs.length - reactions.length;
  const medianMs = reactions.length === 0 ? null : (reactions[Math.floor(reactions.length / 2)] ?? null);
  const reactionScore = medianMs === null ? 0 : Math.round(clamp(1 - (medianMs - 150) / 900) * 900);
  return { score: Math.max(0, reactionScore - falseStarts * 100), medianMs, falseStarts };
}

export function createNewChallenge(miniGameId: string, random: () => number = Math.random) {
  switch (miniGameId) {
    case 'flashbackTiles':
      return createFlashbackTilesChallenge(random);
    case 'copycatSequence':
      return createCopycatSequenceChallenge(random);
    case 'crowdCount':
      return createCrowdCountChallenge(random);
    case 'dropZone':
      return createDropZoneChallenge(random);
    case 'shadowMatch':
      return createShadowMatchChallenge(random);
    case 'flagFrenzy':
      return createFlagFrenzyChallenge(random);
    case 'brakeCheck':
      return createBrakeCheckChallenge(random);
    case 'signalSnap':
      return createSignalSnapChallenge(random);
    default:
      return null;
  }
}
