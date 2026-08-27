import { Check, LoaderCircle, Star, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const PROMPT_ARCADE_RATING_DURATION_MS = 5_000;

export default function PromptArcadeRatingPanel({
  title,
  authorName,
  phaseEndsAt,
  now,
  rating,
  canRate,
  isAuthor,
  isParticipant,
  ratingCount,
  eligibleRaterCount,
  onRate,
}: {
  title: string;
  authorName: string;
  phaseEndsAt: number | null;
  now: number;
  rating: number | null;
  canRate: boolean;
  isAuthor: boolean;
  isParticipant: boolean;
  ratingCount: number;
  eligibleRaterCount: number;
  onRate: (rating: number) => Promise<void>;
}) {
  const [selectedRating, setSelectedRating] = useState(rating);
  const [submitting, setSubmitting] = useState(false);
  const remainingMs = Math.max(0, (phaseEndsAt ?? now) - now);
  const progress = Math.min(100, (remainingMs / PROMPT_ARCADE_RATING_DURATION_MS) * 100);
  const seconds = Math.ceil(remainingMs / 1_000);
  const ratingClosed = remainingMs <= 0;

  useEffect(() => {
    setSelectedRating(rating);
    setSubmitting(false);
  }, [rating]);

  async function chooseRating(nextRating: number) {
    if (!canRate || ratingClosed || submitting) return;
    const previousRating = selectedRating;
    setSelectedRating(nextRating);
    setSubmitting(true);
    try {
      await onRate(nextRating);
    } catch {
      setSelectedRating(previousRating);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="relative mb-5 overflow-hidden rounded-[18px_11px_20px_13px] border-2 border-[#17203a] bg-[#2d285f] px-5 py-5 text-white shadow-[6px_6px_0_#17203a] max-[520px]:px-3.5"
      aria-labelledby="prompt-arcade-rating-title"
    >
      <span
        className="pointer-events-none absolute -top-10 -right-7 size-32 rotate-12 rounded-[38%_62%_48%_52%] bg-[#7168dc]/35"
        aria-hidden="true"
      />
      <div className="relative z-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[9px] font-[880] tracking-[0.16em] text-[#ffd75a] uppercase">
              Rating booth · creator bonus
            </p>
            <h2
              className="m-0 font-display text-[clamp(26px,5vw,42px)] leading-[0.95] font-[910] tracking-[-0.055em]"
              id="prompt-arcade-rating-title"
            >
              {isAuthor ? 'Your game is on the marquee.' : `How was ${title}?`}
            </h2>
          </div>
          <span
            className="grid size-12 shrink-0 place-items-center rounded-[15px_9px_17px_11px] border-2 border-[#17203a] bg-[#ffd75a] font-display text-sm font-[920] text-[#17203a] tabular-nums shadow-[3px_3px_0_#151128]"
            role="timer"
            aria-label={`${seconds} ${seconds === 1 ? 'second' : 'seconds'} left to rate`}
          >
            {seconds}s
          </span>
        </div>

        {canRate ? (
          <div className="mt-5">
            <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={`Rate ${title}`}>
              {[1, 2, 3, 4, 5].map((value) => {
                const selected = selectedRating !== null && value <= selectedRating;
                return (
                  <Button
                    className={cn(
                      'h-15 min-w-0 rounded-[12px_7px_13px_8px] border-2 border-[#aaa4df] bg-[#f8f7ff] px-0 text-[#8179bd] shadow-[0_4px_0_#151128] enabled:hover:border-[#ffd75a] enabled:hover:bg-white enabled:hover:text-[#e4ac12] max-[420px]:h-13',
                      selected && 'border-[#ffd75a] bg-[#fff4bd] text-[#d49c00] shadow-[0_4px_0_#c58f00]'
                    )}
                    key={value}
                    type="button"
                    variant="paper"
                    role="radio"
                    aria-checked={selectedRating === value}
                    aria-label={`${value} out of 5 stars`}
                    data-selected={selectedRating === value}
                    disabled={ratingClosed || submitting}
                    onClick={() => void chooseRating(value)}
                  >
                    <Star
                      className="size-7 max-[420px]:size-6"
                      fill={selected ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  </Button>
                );
              })}
            </div>
            <p
              className="mt-3 mb-0 flex min-h-5 items-center justify-center gap-1.5 text-center text-xs font-[720] text-[#d7d3f6]"
              aria-live="polite"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Sending {selectedRating}-star rating…
                </>
              ) : selectedRating === null ? (
                'Pick quickly. Your last choice before time expires counts.'
              ) : (
                <>
                  <Check className="size-3.5 text-[#7de2c7]" aria-hidden="true" />
                  {selectedRating} out of 5 selected. You can change it while the booth is open.
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-[13px_8px_14px_9px] border border-[#7770ba] bg-[#211d4b] px-4 py-4 text-sm leading-[1.5] text-[#dedbf7]">
            <strong className="block text-white">
              {isAuthor
                ? `${authorName}, everyone else has five seconds to rate your game.`
                : isParticipant
                  ? 'Your rating is locked for this cartridge.'
                  : 'Voting is for players who played this cartridge.'}
            </strong>
            <span className="mt-1 block text-xs text-[#aaa5d7]">
              The highest-rated creator earns a 500-point bonus after the playlist.
            </span>
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-[9px] font-[820] tracking-[0.1em] text-[#bdb8e5] uppercase">
            <span className="inline-flex items-center gap-1.5">
              <Timer className="size-3.5 text-[#ffd75a]" aria-hidden="true" /> Rate before the bell
            </span>
            <span className="tabular-nums">
              {ratingCount} of {eligibleRaterCount} rated
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full border border-[#7770ba] bg-[#171337]"
            role="progressbar"
            aria-label="Rating time remaining"
            aria-valuemin={0}
            aria-valuemax={PROMPT_ARCADE_RATING_DURATION_MS}
            aria-valuenow={remainingMs}
          >
            <span
              className="block h-full rounded-full bg-[#ffd75a] transition-[width] duration-100 ease-linear motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
