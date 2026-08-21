import type { api } from '@convex/_generated/api';
import type { GameType as BackendGameType } from '@convex/gameRegistry';
import type { FunctionReturnType } from 'convex/server';
import { BrainCircuit, Keyboard, type LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import TriviaPreview from '@/games/official/trivia/TriviaPreview';
import TypeRacerPreview from '@/games/official/type-racer/TypeRacerPreview';
import { cn } from '@/lib/utils';

export type GameType = BackendGameType;
export const GAME_TYPES = ['trivia', 'typeRacer'] as const satisfies readonly GameType[];
export type GameCatalogEntry = FunctionReturnType<typeof api.games.listAvailable>[number];
export type GameSource = GameCatalogEntry['source'];

type GamePresentation = {
  icon: LucideIcon;
  color: string;
  tint: string;
  previewLabel: string;
  preview: ComponentType;
};

const GAME_PRESENTATIONS: Record<GameType, GamePresentation> = {
  trivia: {
    icon: BrainCircuit,
    color: '#0c8bb7',
    tint: '#e9f8fc',
    previewLabel: 'A preview of a trivia round',
    preview: TriviaPreview,
  },
  typeRacer: {
    icon: Keyboard,
    color: '#e54f50',
    tint: '#fff0ef',
    previewLabel: 'A preview of a multiplayer type race',
    preview: TypeRacerPreview,
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
      <div className="absolute -top-5.5 left-10.5 z-3 -rotate-4 bg-[rgb(49_85_217/92%)] px-7.5 pt-3.25 pb-2.75 font-display text-[13px] font-extrabold tracking-[0.12em] text-white [clip-path:polygon(7px_0,calc(100%-7px)_0,100%_7px,calc(100%-2px)_calc(100%-6px),calc(100%-7px)_100%,6px_100%,0_calc(100%-7px),2px_6px)] [filter:drop-shadow(0_8px_9px_rgb(49_85_217/22%))] max-[620px]:left-5">
        ROOM F7K2P
      </div>
      <Preview />
    </section>
  );
}

export function GameSourceBadge({ source, className }: { source: GameSource; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[9px] leading-none font-[820] tracking-[0.08em] uppercase',
        source === 'community'
          ? 'border-[#b991db] bg-[#f4eafe] text-[#74409d]'
          : 'border-[#b8c7f5] bg-[#edf2ff] text-[#3155d9]',
        className
      )}
    >
      {source === 'community' ? 'Community' : 'Official'}
    </span>
  );
}

export function GameAuthor({ game }: { game: GameCatalogEntry }) {
  const className = 'font-[680] text-[#536079] underline-offset-2 hover:text-[#3155d9] hover:underline';

  return (
    <span className="text-[10px] text-[#7a8499]">
      by{' '}
      {game.author.url ? (
        <a className={className} href={game.author.url} target="_blank" rel="noreferrer">
          {game.author.name}
        </a>
      ) : (
        <span className="font-[680] text-[#536079]">{game.author.name}</span>
      )}
    </span>
  );
}
