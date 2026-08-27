import { clamp, MINI_GAMES_ROUND_MS, type NormalizedPoint, pointDistance } from '../../shared';

export type EmojiColor = 'orange' | 'blue' | 'green' | 'pink' | 'purple';
export type MiniGameEmojiItem = {
  id: string;
  emoji: string;
  color: EmojiColor;
  x: number;
  y: number;
  rotation: number;
};

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
  const positions: NormalizedPoint[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    let position: NormalizedPoint | null = null;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const candidate = { x: 0.06 + random() * 0.88, y: 0.08 + random() * 0.84 };
      if (positions.every((existing) => pointDistance(existing, candidate) >= 0.105)) {
        position = candidate;
        break;
      }
    }
    if (position === null) {
      position = {
        x: 0.06 + ((index * 0.61803398875 + random() * 0.17) % 1) * 0.88,
        y: 0.08 + ((index * 0.754877666 + random() * 0.17) % 1) * 0.84,
      };
    }
    positions.push(position);
  }
  const items = entries.map((entry, index) => {
    const position = positions[index] ?? { x: 0.5, y: 0.5 };
    return {
      id: `emoji-${index + 1}`,
      emoji: entry.emoji,
      color: entry.color,
      x: position.x,
      y: position.y,
      rotation: Math.round((random() - 0.5) * 34),
    };
  });
  return { targetEmoji: target.emoji, items };
}

export function scoreFindEmoji(targetCount: number, wrongClicks: number, timeMs: number) {
  const accuracy = targetCount < 1 ? 0 : targetCount / (targetCount + Math.max(0, wrongClicks));
  const speed = clamp(1 - timeMs / MINI_GAMES_ROUND_MS, 0, 1);
  return { accuracy: Math.round(accuracy * 1_000) / 10, score: Math.round(accuracy * 600 + speed * 400) };
}
