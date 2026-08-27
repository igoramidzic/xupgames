import { MINI_GAMES_RESULTS_MS, MINI_GAMES_ROUND_MS, MINI_GAMES_SELECTION_MS } from './shared';

export const MINI_GAMES_DEFAULT_ROUND_COUNT = 10;
export const MINI_GAMES_ROUND_OPTIONS = [10, 15, 20, 25] as const;

export const MINI_GAME_IDS = [
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
] as const;

export type MiniGameId = (typeof MINI_GAME_IDS)[number];

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
  {
    id: 'guessPercentage',
    title: 'Guess the percentage',
    eyebrow: 'Slice sense',
    instructions: 'Estimate how much of the pie belongs to the named color.',
  },
  {
    id: 'circleCenter',
    title: 'Click the circle center',
    eyebrow: 'Bullseye',
    instructions: 'Find the true center of the broken circle and place your marker.',
  },
  {
    id: 'batteryPercentage',
    title: 'Guess the battery',
    eyebrow: 'Charge check',
    instructions: 'Estimate the charge shown in the battery without counting pixels.',
  },
  {
    id: 'flashbackTiles',
    title: 'Flashback Tiles',
    eyebrow: 'Visual memory',
    instructions: 'Remember the lit tiles, then tap the same pattern after it disappears.',
  },
  {
    id: 'copycatSequence',
    title: 'Copycat Sequence',
    eyebrow: 'Pattern recall',
    instructions: 'Watch the four pads, then repeat their pattern in the same order.',
  },
  {
    id: 'crowdCount',
    title: 'Crowd Count',
    eyebrow: 'Keep count',
    instructions: 'Count every bean that crosses the stage, then choose the total.',
  },
  {
    id: 'dropZone',
    title: 'Drop Zone',
    eyebrow: 'Perfect timing',
    instructions: 'Release three packages as close to the center of the landing pad as you can.',
  },
  {
    id: 'shadowMatch',
    title: 'Shadow Match',
    eyebrow: 'Shape finder',
    instructions: 'Choose the silhouette that matches each object.',
  },
  {
    id: 'flagFrenzy',
    title: 'Flag Frenzy',
    eyebrow: 'Quick match',
    instructions: 'Press the pad that matches each signal. Keep the streak alive.',
  },
  {
    id: 'brakeCheck',
    title: 'Brake Check',
    eyebrow: 'Hold and release',
    instructions: 'Hold to fill the meter and release as close to the target line as possible.',
  },
  {
    id: 'signalSnap',
    title: 'Signal Snap',
    eyebrow: 'Reaction test',
    instructions: 'Wait for each signal to change, then tap as quickly as you can.',
  },
] as const satisfies ReadonlyArray<{
  id: MiniGameId;
  title: string;
  eyebrow: string;
  instructions: string;
}>;

export function estimateMiniGamesDurationMs(roundCount: number) {
  return roundCount * (MINI_GAMES_SELECTION_MS + MINI_GAMES_ROUND_MS + MINI_GAMES_RESULTS_MS);
}

export function isMiniGamesRoundCount(roundCount: number): roundCount is (typeof MINI_GAMES_ROUND_OPTIONS)[number] {
  return (MINI_GAMES_ROUND_OPTIONS as readonly number[]).includes(roundCount);
}

export function normalizeMiniGamesRoundCount(roundCount: number | undefined) {
  return roundCount !== undefined && isMiniGamesRoundCount(roundCount) ? roundCount : MINI_GAMES_DEFAULT_ROUND_COUNT;
}

export function chooseMiniGame(previous: string | null, random: () => number = Math.random): MiniGameId {
  const available = previous === null ? MINI_GAME_IDS : MINI_GAME_IDS.filter((id) => id !== previous);
  return available[Math.min(available.length - 1, Math.floor(random() * available.length))] ?? MINI_GAME_IDS[0];
}

export function miniGameDefinition(id: string) {
  return MINI_GAME_DEFINITIONS.find((entry) => entry.id === id) ?? null;
}
