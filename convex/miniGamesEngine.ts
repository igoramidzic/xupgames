export const MINI_GAMES_SELECTION_MS = 3_200;
export const MINI_GAMES_ROUND_MS = 10_000;
export const MINI_GAMES_RESULTS_MS = 4_000;
export const MINI_GAMES_DEFAULT_ROUND_COUNT = 10;
export const MINI_GAMES_ROUND_OPTIONS = [10, 15, 20, 25] as const;

export const MINI_GAME_IDS = ['straightLine', 'orangeEmojis'] as const;
export type MiniGameId = (typeof MINI_GAME_IDS)[number];
export type EmojiColor = 'orange' | 'blue' | 'green' | 'pink' | 'purple';

export const MINI_GAME_DEFINITIONS = [
  {
    id: 'straightLine',
    title: 'Draw a straight line',
    eyebrow: 'Steady hand',
    instructions: 'Draw from the blue start to the orange finish in one clean stroke.',
  },
  {
    id: 'orangeEmojis',
    title: 'Find this emoji',
    eyebrow: 'Match maker',
    instructions: 'Click every copy of the emoji shown above the board. Repeated decoys do not count.',
  },
] as const satisfies ReadonlyArray<{
  id: MiniGameId;
  title: string;
  eyebrow: string;
  instructions: string;
}>;

export type NormalizedLinePoint = { x: number; y: number };
export type MiniGameEmojiItem = {
  id: string;
  emoji: string;
  color: EmojiColor;
  x: number;
  y: number;
  rotation: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(first: NormalizedLinePoint, second: NormalizedLinePoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function estimateMiniGamesDurationMs(roundCount: number) {
  return roundCount * (MINI_GAMES_SELECTION_MS + MINI_GAMES_ROUND_MS + MINI_GAMES_RESULTS_MS);
}

export function isMiniGamesRoundCount(roundCount: number): roundCount is (typeof MINI_GAMES_ROUND_OPTIONS)[number] {
  return (MINI_GAMES_ROUND_OPTIONS as readonly number[]).includes(roundCount);
}

export function normalizeMiniGamesRoundCount(roundCount: number | undefined) {
  return roundCount !== undefined && isMiniGamesRoundCount(roundCount) ? roundCount : MINI_GAMES_DEFAULT_ROUND_COUNT;
}

export function chooseMiniGame(previous: MiniGameId | null, random: () => number = Math.random): MiniGameId {
  const available = previous === null ? MINI_GAME_IDS : MINI_GAME_IDS.filter((id) => id !== previous);
  return available[Math.min(available.length - 1, Math.floor(random() * available.length))] ?? MINI_GAME_IDS[0];
}

export function createStraightLineTarget(random: () => number = Math.random) {
  const leftToRight = random() >= 0.5;
  const start = {
    x: leftToRight ? 0.13 + random() * 0.08 : 0.79 + random() * 0.08,
    y: 0.2 + random() * 0.6,
  };
  const end = {
    x: leftToRight ? 0.79 + random() * 0.08 : 0.13 + random() * 0.08,
    y: 0.2 + random() * 0.6,
  };
  return { start, end };
}

const EMOJI_POOLS: Record<EmojiColor, readonly string[]> = {
  orange: ['🍊', '🥕', '🧡', '🎃', '🟠', '🦊', '🐯'],
  blue: ['🫐', '💙', '🔵', '🐳', '🦋'],
  green: ['🍏', '💚', '🟢', '🐸', '🥦'],
  pink: ['🌸', '🩷', '🦩', '🐷', '🎀'],
  purple: ['🍇', '💜', '🟣', '☂️', '👾'],
};
const EMOJI_CATALOG = Object.entries(EMOJI_POOLS).flatMap(([color, emojis]) =>
  emojis.map((emoji) => ({ emoji, color: color as EmojiColor }))
);
const EMOJI_BOARD_SIZE = 24;
const EMOJI_MIN_TARGET_COUNT = 5;
const EMOJI_MAX_TARGET_COUNT = 10;

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex] as T, copy[index] as T];
  }
  return copy;
}

export function createEmojiChallenge(random: () => number = Math.random): {
  targetEmoji: string;
  items: MiniGameEmojiItem[];
} {
  const targetIndex = Math.min(EMOJI_CATALOG.length - 1, Math.floor(random() * EMOJI_CATALOG.length));
  const target = EMOJI_CATALOG[targetIndex] ?? EMOJI_CATALOG[0] ?? { emoji: '🍊', color: 'orange' as const };
  const targetCount =
    EMOJI_MIN_TARGET_COUNT +
    Math.min(
      EMOJI_MAX_TARGET_COUNT - EMOJI_MIN_TARGET_COUNT,
      Math.floor(random() * (EMOJI_MAX_TARGET_COUNT - EMOJI_MIN_TARGET_COUNT + 1))
    );
  const distractorPool = EMOJI_CATALOG.filter((entry) => entry.emoji !== target.emoji);
  const distractors = Array.from({ length: EMOJI_BOARD_SIZE - targetCount }, () => {
    const index = Math.min(distractorPool.length - 1, Math.floor(random() * distractorPool.length));
    return distractorPool[index] ?? { emoji: '🫐', color: 'blue' as const };
  });
  const entries = shuffled([...Array.from({ length: targetCount }, () => target), ...distractors], random);
  const columnCount = 5;
  const rowCount = Math.ceil(entries.length / columnCount);
  const items = entries.map((entry, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    return {
      id: `emoji-${index + 1}`,
      emoji: entry.emoji,
      color: entry.color,
      x: clamp((column + 0.5) / columnCount + (random() - 0.5) * 0.05, 0.07, 0.93),
      y: clamp((row + 0.5) / rowCount + (random() - 0.5) * 0.05, 0.07, 0.93),
      rotation: Math.round((random() - 0.5) * 22),
    };
  });
  return { targetEmoji: target.emoji, items };
}

export function scoreStraightLine(
  points: readonly NormalizedLinePoint[],
  start: NormalizedLinePoint,
  end: NormalizedLinePoint,
  timeMs: number
) {
  if (points.length < 2) {
    return { score: 0, straightness: 0 };
  }
  const lineLength = Math.max(0.001, distance(start, end));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const meanDeviation =
    points.reduce((total, point) => {
      const perpendicularDistance =
        Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / lineLength;
      return total + perpendicularDistance;
    }, 0) /
    points.length /
    lineLength;
  const endpointError =
    (distance(points[0] ?? start, start) + distance(points[points.length - 1] ?? end, end)) / lineLength;
  const straightness = clamp(Math.round((1 - meanDeviation * 4.2 - endpointError * 1.4) * 1_000) / 10, 0, 100);
  const speedPoints = clamp(1 - timeMs / MINI_GAMES_ROUND_MS, 0, 1) * 300;
  return {
    straightness,
    score: Math.round(straightness * 7 + speedPoints),
  };
}

export function scoreFindEmoji(targetCount: number, wrongClicks: number, timeMs: number) {
  const accuracy = targetCount < 1 ? 0 : targetCount / (targetCount + Math.max(0, wrongClicks));
  const speed = clamp(1 - timeMs / MINI_GAMES_ROUND_MS, 0, 1);
  return {
    accuracy: Math.round(accuracy * 1_000) / 10,
    score: Math.round(accuracy * 600 + speed * 400),
  };
}
