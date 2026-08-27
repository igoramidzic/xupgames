import { Check, LoaderCircle } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { type GameCatalogEntry, GameSourceBadge, type GameType, gamePresentation } from '@/games/registry';
import { cn } from '@/lib/utils';

type SelectableGame = GameCatalogEntry & { gameType: GameType };

export type GameChoiceTally = {
  votes: number;
  percentage: number;
};

export default function GameChoiceCard({
  game,
  selected = false,
  tally,
  complete = false,
  recommended = false,
  advancing = false,
  pending = false,
  statusLabel,
  disabled,
  onClick,
}: {
  game: SelectableGame;
  selected?: boolean;
  tally?: GameChoiceTally;
  complete?: boolean;
  recommended?: boolean;
  advancing?: boolean;
  pending?: boolean;
  statusLabel?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const presentation = gamePresentation(game.gameType);
  const Icon = presentation.icon;
  const Preview = presentation.cardPreview ?? presentation.preview;
  const hasStatus = pending || recommended || selected || statusLabel !== undefined;
  const accessibleStatus = pending
    ? 'Changing to'
    : recommended
      ? complete
        ? 'Winner:'
        : 'Top vote:'
      : selected
        ? 'Your vote:'
        : statusLabel === undefined
          ? null
          : `${statusLabel}:`;
  const accessibleName = [accessibleStatus, game.name, tally ? `${tally.votes} votes` : null]
    .filter((part) => part !== null)
    .join(' ');

  return (
    <Button
      variant="game-choice"
      className={cn(
        'relative aspect-square h-auto! min-h-0 min-w-0 gap-0! overflow-hidden border-2 bg-white p-0 text-[#17203a] disabled:cursor-default disabled:opacity-100',
        complete &&
          'bg-white data-[selected=true]:border-[#35a675] data-[selected=true]:bg-white data-[selected=true]:shadow-[0_5px_0_#35a675]'
      )}
      type="button"
      style={{ '--game-color': presentation.color, '--game-tint': presentation.tint } as CSSProperties}
      data-selected={complete ? recommended : selected}
      data-advancing={advancing}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={complete ? undefined : selected}
      aria-label={accessibleName}
    >
      <span
        className="absolute inset-x-0 top-0 h-[76%] overflow-hidden bg-[var(--game-tint)]"
        data-game-artwork={game.gameType}
        aria-hidden="true"
      >
        <span
          className={cn('absolute left-1/2 block -translate-x-1/2 -translate-y-1/2', presentation.cardPreviewClassName)}
        >
          <Preview />
        </span>
      </span>

      <span className="absolute inset-x-3 top-3 z-2 flex min-w-0 items-start justify-between gap-2">
        <GameSourceBadge
          source={game.source}
          label="Community"
          className="border-white/75 bg-white/92 shadow-[0_2px_0_rgb(23_32_58/12%)]"
        />
        {hasStatus ? (
          <span
            className={cn(
              'ml-auto inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border border-white/80 bg-white/92 px-2.5 py-1 text-[9px] leading-none font-[850] tracking-[0.07em] text-[#40506a] uppercase shadow-[0_2px_0_rgb(23_32_58/12%)]',
              recommended && 'text-[#16885c]',
              selected && !recommended && 'text-[var(--game-color)]'
            )}
          >
            {pending ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-label="Changing game" />
            ) : recommended ? (
              complete ? (
                'Winner'
              ) : (
                'Top vote'
              )
            ) : selected ? (
              <>
                <Check className="size-3.5" aria-hidden="true" /> Your vote
              </>
            ) : (
              statusLabel
            )}
          </span>
        ) : null}
      </span>

      {advancing ? (
        <span
          className="pointer-events-none absolute inset-0 z-1 bg-white/12 motion-safe:animate-pulse"
          aria-hidden="true"
        />
      ) : null}

      <span className="absolute inset-x-0 bottom-0 z-2 flex min-h-[34%] flex-col justify-end bg-[linear-gradient(to_bottom,transparent_0%,rgb(255_255_255/90%)_30%,white_54%)] px-4 pt-10 pb-3.5">
        <span className="mb-1.5 flex items-center gap-1.5 text-[9px] leading-none font-[850] tracking-[0.12em] text-[var(--game-color)] uppercase">
          <Icon className="size-3.5" aria-hidden="true" />
          {presentation.modeLabel}
        </span>
        <strong className="min-w-0 pr-12 font-display text-[clamp(20px,2.2vw,27px)] leading-[0.96] font-[860] tracking-[-0.04em]">
          {game.name}
        </strong>
      </span>

      {tally ? (
        <b className="absolute right-3.5 bottom-3.5 z-3 inline-flex min-w-8 items-center justify-center rounded-full bg-[#edf1f7] px-2 py-1 text-xs text-[#34415b] tabular-nums">
          {tally.votes}
          <span className="sr-only"> votes</span>
        </b>
      ) : null}
    </Button>
  );
}
