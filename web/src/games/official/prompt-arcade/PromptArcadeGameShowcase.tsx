import { Gamepad2, Sparkles, Star, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export const GAME_SHOWCASE_REVEAL_MS = 1_500;
export const GAME_SHOWCASE_HOLD_MS = 3_500;

export type PromptArcadeGameRanking = {
  rank: number;
  entryId: string;
  displayName: string;
  title: string;
  interpretation: string;
  averageRating: number | null;
  ratingCount: number;
  isWinner: boolean;
  creatorBonus: number;
  isCurrentPlayer: boolean;
};

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function placeLabel(place: number) {
  if (place === 1) return 'Top-rated game';
  if (place === 2) return 'Second place';
  return 'Third place';
}

function ratingLabel(entry: PromptArcadeGameRanking) {
  if (entry.averageRating === null) return 'No peer ratings';
  return `${entry.averageRating.toFixed(1)} out of 5 · ${entry.ratingCount} ${entry.ratingCount === 1 ? 'rating' : 'ratings'}`;
}

export default function PromptArcadeGameShowcase({
  rankings,
  onFinished,
}: {
  rankings: readonly PromptArcadeGameRanking[];
  onFinished: () => void;
}) {
  const podium = useMemo(() => rankings.slice(0, 3), [rankings]);
  const revealOrder = useMemo(() => [...podium].reverse(), [podium]);
  const [revealedCount, setRevealedCount] = useState(1);

  useEffect(() => {
    if (revealOrder.length === 0) {
      onFinished();
      return;
    }
    const reducedMotion = prefersReducedMotion();
    setRevealedCount(reducedMotion ? revealOrder.length : 1);
    const timeouts: number[] = [];
    if (!reducedMotion) {
      for (let index = 1; index < revealOrder.length; index += 1) {
        timeouts.push(window.setTimeout(() => setRevealedCount(index + 1), GAME_SHOWCASE_REVEAL_MS * index));
      }
    }
    const revealDuration = reducedMotion ? 0 : GAME_SHOWCASE_REVEAL_MS * Math.max(0, revealOrder.length - 1);
    timeouts.push(window.setTimeout(onFinished, revealDuration + GAME_SHOWCASE_HOLD_MS));
    return () => {
      for (const timeout of timeouts) window.clearTimeout(timeout);
    };
  }, [onFinished, revealOrder]);

  const activeEntry = revealOrder[Math.min(revealedCount - 1, revealOrder.length - 1)];

  return (
    <section
      className="relative min-h-[clamp(600px,calc(100dvh-112px),768px)] overflow-hidden rounded-[22px_14px_24px_16px] border-2 border-[#17203a] bg-[#25214d] p-[clamp(22px,4vw,48px)] text-white shadow-[7px_8px_0_#17203a]"
      aria-labelledby="game-showcase-title"
    >
      <span
        className="pointer-events-none absolute -top-20 -left-15 size-64 -rotate-12 rounded-[44%_56%_62%_38%] bg-[#5b53bd]/35"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -right-14 -bottom-20 size-72 rotate-12 rounded-[58%_42%_36%_64%] bg-[#ef7543]/22"
        aria-hidden="true"
      />
      <div className="relative z-1 mx-auto w-full max-w-250">
        <div className="mx-auto mb-8 max-w-185 text-center">
          <span className="mx-auto mb-4 grid size-13 -rotate-3 place-items-center rounded-[17px_10px_19px_12px] border-2 border-[#17203a] bg-[#ffd75a] text-[#5148c5] shadow-[4px_4px_0_#11102a]">
            <Trophy className="size-5.5" aria-hidden="true" />
          </span>
          <p className="mb-1.5 text-[10px] font-[880] tracking-[0.16em] text-[#a9a2ff] uppercase">
            Player-made game awards
          </p>
          <h1
            className="m-0 font-display text-[clamp(38px,7vw,72px)] leading-[0.88] font-[930] tracking-[-0.07em]"
            id="game-showcase-title"
          >
            The arcade has spoken.
          </h1>
          <p className="mt-4 mb-0 min-h-6 text-sm font-[720] text-[#d6d2f1]" aria-live="polite">
            {activeEntry === undefined
              ? 'No games received a peer rating.'
              : `${placeLabel(activeEntry.rank)} · ${activeEntry.title} by ${activeEntry.displayName}`}
          </p>
        </div>

        <ol
          className="m-0 grid min-h-85 list-none grid-cols-3 items-end gap-4 p-0 max-[640px]:min-h-72 max-[640px]:gap-2"
          aria-label="Top-rated Prompt Arcade games"
        >
          {podium.map((entry) => {
            const revealIndex = revealOrder.findIndex((candidate) => candidate.entryId === entry.entryId);
            const visible = revealIndex >= 0 && revealIndex < revealedCount;
            const active = activeEntry?.entryId === entry.entryId;
            const centerOffset =
              active && entry.rank === 3
                ? 'translateX(calc(-100% - 16px))'
                : active && entry.rank === 2
                  ? 'translateX(calc(100% + 16px))'
                  : undefined;
            return (
              <li
                className={cn(
                  'relative min-w-0 overflow-hidden rounded-[18px_11px_20px_13px] border-2 border-[#7d77b4] bg-[#f9f8ff] text-[#17203a] opacity-0 shadow-[0_8px_0_#11102a] transition-[transform,opacity,min-height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                  visible && 'opacity-100',
                  entry.rank === 1
                    ? 'min-h-83 border-[#ffd75a] shadow-[0_8px_0_#c49000] max-[640px]:min-h-72'
                    : 'min-h-70 max-[640px]:min-h-62',
                  active && entry.rank !== 1 && 'z-2 min-h-83 border-[#ffd75a] max-[640px]:min-h-72',
                  entry.isCurrentPlayer && 'ring-3 ring-[#8be1d2]/60'
                )}
                key={entry.entryId}
                style={{
                  gridColumn: entry.rank === 1 ? 2 : entry.rank === 2 ? 1 : 3,
                  gridRow: 1,
                  transform: visible ? centerOffset : 'translateY(22px) scale(0.96)',
                }}
                data-place={entry.rank}
                data-visible={visible}
                data-active={active}
              >
                <div
                  className={cn(
                    'grid min-h-29 place-content-center border-b-2 border-[#17203a] bg-[#dad7ff] px-3 text-center',
                    entry.rank === 1 && 'bg-[#fff0a8]'
                  )}
                >
                  <span className="mx-auto mb-2 grid size-9 place-items-center rounded-full border-2 border-[#17203a] bg-[#17203a] text-xs font-[900] text-white">
                    {entry.rank}
                  </span>
                  <Gamepad2 className="mx-auto size-7 text-[#564dd8]" aria-hidden="true" />
                </div>
                <div className="p-3.5 text-center max-[480px]:p-2">
                  <p className="mb-1 text-[8px] font-[880] tracking-[0.13em] text-[#ef7543] uppercase">
                    {placeLabel(entry.rank)}
                  </p>
                  <h2 className="m-0 overflow-hidden font-display text-[clamp(15px,2.4vw,24px)] leading-[0.95] font-[920] tracking-[-0.05em] text-ellipsis">
                    {entry.title}
                  </h2>
                  <p className="mt-1.5 mb-0 truncate text-[10px] font-[760] text-[#69758b]">by {entry.displayName}</p>
                  <div className="mt-3 flex items-center justify-center gap-1 text-[#d49c00]">
                    <Star className="size-4 fill-current" aria-hidden="true" />
                    <strong className="text-sm tabular-nums">
                      {entry.averageRating === null ? '—' : entry.averageRating.toFixed(1)}
                    </strong>
                    <span className="text-[9px] text-[#8a8398]">/ 5</span>
                  </div>
                  <p className="sr-only">{ratingLabel(entry)}</p>
                  {entry.creatorBonus > 0 ? (
                    <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#dff7ed] px-2 py-1 text-[8px] font-[880] tracking-[0.08em] text-[#15705f] uppercase">
                      <Sparkles className="size-3" aria-hidden="true" /> +{entry.creatorBonus} creator bonus
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {activeEntry !== undefined ? (
          <p className="mx-auto mt-6 mb-0 max-w-165 text-center text-xs leading-[1.5] text-[#bdb9d8]">
            {activeEntry.interpretation}
          </p>
        ) : null}
      </div>
    </section>
  );
}
