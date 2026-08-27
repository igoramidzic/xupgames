import type { api } from '@convex/_generated/api';
import type { GameType as BackendGameType } from '@convex/gameRegistry';
import type { FunctionReturnType } from 'convex/server';
import { BrainCircuit, Dices, Keyboard, type LucideIcon, Paintbrush, TrendingUp, WandSparkles } from 'lucide-react';
import type { ComponentType } from 'react';
import TrendlineCardPreview from '@/games/community/trendline/TrendlineCardPreview';
import TrendlinePreview from '@/games/community/trendline/TrendlinePreview';
import DoodleDashCardPreview from '@/games/official/doodle-dash/DoodleDashCardPreview';
import DoodleDashPreview from '@/games/official/doodle-dash/DoodleDashPreview';
import MiniGamesCardPreview from '@/games/official/mini-games/MiniGamesCardPreview';
import MiniGamesPreview from '@/games/official/mini-games/MiniGamesPreview';
import PromptArcadeCardPreview from '@/games/official/prompt-arcade/PromptArcadeCardPreview';
import PromptArcadePreview from '@/games/official/prompt-arcade/PromptArcadePreview';
import TriviaCardPreview from '@/games/official/trivia/TriviaCardPreview';
import TriviaPreview from '@/games/official/trivia/TriviaPreview';
import TypeRacerCardPreview from '@/games/official/type-racer/TypeRacerCardPreview';
import TypeRacerPreview from '@/games/official/type-racer/TypeRacerPreview';
import { cn } from '@/lib/utils';

export type GameType = BackendGameType;
export const GAME_TYPES = [
  'doodleDash',
  'miniGames',
  'promptArcade',
  'trivia',
  'typeRacer',
  'trendline',
] as const satisfies readonly GameType[];
export type GameCatalogEntry = FunctionReturnType<typeof api.games.listAvailable>[number];
export type GameSource = GameCatalogEntry['source'];

type GamePresentation = {
  icon: LucideIcon;
  color: string;
  tint: string;
  modeLabel: string;
  cardPreviewClassName: string;
  cardPreview?: ComponentType;
  previewLabel: string;
  preview: ComponentType;
};

const GAME_PRESENTATIONS: Record<GameType, GamePresentation> = {
  doodleDash: {
    icon: Paintbrush,
    color: '#3155d9',
    tint: '#e3e9ff',
    modeLabel: 'Draw & guess',
    cardPreviewClassName: 'top-[54%] w-[80%]',
    cardPreview: DoodleDashCardPreview,
    previewLabel: 'A preview of a Doodle Dash drawing turn',
    preview: DoodleDashPreview,
  },
  miniGames: {
    icon: Dices,
    color: '#e85d2a',
    tint: '#fff0b8',
    modeLabel: 'Party mix',
    cardPreviewClassName: 'top-[54%] w-[80%]',
    cardPreview: MiniGamesCardPreview,
    previewLabel: 'A preview of the Mini Game Mix challenge spinner',
    preview: MiniGamesPreview,
  },
  promptArcade: {
    icon: WandSparkles,
    color: '#b52b68',
    tint: '#ffe2ee',
    modeLabel: 'Prompt & play',
    cardPreviewClassName: 'top-[54%] w-[80%]',
    cardPreview: PromptArcadeCardPreview,
    previewLabel: 'A preview of player-made Prompt Arcade games moving through the live game factory',
    preview: PromptArcadePreview,
  },
  trivia: {
    icon: BrainCircuit,
    color: '#6347e8',
    tint: '#e8e1ff',
    modeLabel: 'Quick-fire trivia',
    cardPreviewClassName: 'top-[54%] w-[80%]',
    cardPreview: TriviaCardPreview,
    previewLabel: 'A preview of a trivia round',
    preview: TriviaPreview,
  },
  typeRacer: {
    icon: Keyboard,
    color: '#ef493f',
    tint: '#ffdcd7',
    modeLabel: 'Typing race',
    cardPreviewClassName: 'top-[54%] w-[80%]',
    cardPreview: TypeRacerCardPreview,
    previewLabel: 'A preview of a multiplayer type race',
    preview: TypeRacerPreview,
  },
  trendline: {
    icon: TrendingUp,
    color: '#078b68',
    tint: '#d5f6e8',
    modeLabel: 'Draw the data',
    cardPreviewClassName: 'top-[54%] w-[80%]',
    cardPreview: TrendlineCardPreview,
    previewLabel: 'A preview of drawing a real-world historical trend',
    preview: TrendlinePreview,
  },
};

export function isGameType(value: string): value is GameType {
  return (GAME_TYPES as readonly string[]).includes(value);
}

export function hasGamePresentation(game: GameCatalogEntry): game is GameCatalogEntry & { gameType: GameType } {
  return isGameType(game.gameType);
}

export function gamePresentation(gameType: GameType): GamePresentation {
  return GAME_PRESENTATIONS[gameType];
}

export function GamePreview({ gameType }: { gameType: GameType }) {
  const presentation = gamePresentation(gameType);
  const Preview = presentation.preview;

  return (
    <section
      className="relative mx-auto w-[min(100%,760px)] [perspective:1200px] max-[1040px]:mb-16 max-[1040px]:w-[min(92%,700px)] max-[620px]:w-[94%]"
      aria-label={presentation.previewLabel}
    >
      <Preview />
    </section>
  );
}

export function GameSourceBadge({
  source,
  className,
  label = 'Community game',
}: {
  source: GameSource;
  className?: string;
  label?: 'Community' | 'Community game';
}) {
  if (source === 'official') return null;
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[9px] leading-none font-[820] tracking-[0.08em] uppercase',
        'border-[#b991db] bg-[#f4eafe] text-[#74409d]',
        className
      )}
    >
      {label}
    </span>
  );
}

export function GameAuthor({ game, className }: { game: GameCatalogEntry; className?: string }) {
  if (game.source === 'official') return null;
  return (
    <span className={cn('min-w-0 truncate text-[10px] text-[#7a8499]', className)}>
      by <span className="font-[680] text-[#536079]">{game.author.name}</span>
    </span>
  );
}
