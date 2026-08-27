import { LoaderCircle, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const PROMPT_ARCADE_RATING_DURATION_MS = 5_000;

export default function PromptArcadeRatingPanel({
  title,
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
  const [previewRating, setPreviewRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const remainingMs = Math.max(0, (phaseEndsAt ?? now) - now);
  const progress = Math.min(100, (remainingMs / PROMPT_ARCADE_RATING_DURATION_MS) * 100);
  const seconds = Math.ceil(remainingMs / 1_000);
  const ratingClosed = remainingMs <= 0;

  useEffect(() => {
    setSelectedRating(rating);
    setPreviewRating(null);
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
      className="relative mb-5 overflow-hidden rounded-[20px_12px_22px_14px] border-3 border-[#17203a] bg-[#2d285f] px-6 pt-5 pb-4 text-white shadow-[8px_8px_0_#17203a] max-[520px]:px-3.5"
      aria-labelledby="prompt-arcade-rating-title"
    >
      <div className="relative z-1">
        <div className="flex items-center justify-between gap-4">
          <h2
            className="m-0 min-w-0 truncate font-display text-[clamp(24px,4vw,36px)] leading-none font-[910] tracking-[-0.045em]"
            id="prompt-arcade-rating-title"
          >
            {isAuthor ? title : `Rate ${title}`}
          </h2>
          <span
            className="grid size-13 shrink-0 place-items-center rounded-[16px_9px_18px_11px] border-2 border-[#17203a] bg-[#ffd75a] font-display text-base font-[920] text-[#17203a] tabular-nums shadow-[3px_3px_0_#151128]"
            role="timer"
            aria-label={`${seconds} ${seconds === 1 ? 'second' : 'seconds'} left to rate`}
          >
            {seconds}s
          </span>
        </div>

        {canRate ? (
          <div className="mt-3">
            <div
              className="grid grid-cols-5 gap-1 rounded-[17px_10px_19px_12px] border-2 border-[#7770ba] bg-[#211d4b] px-2 py-2 shadow-[inset_0_2px_0_rgb(255_255_255/6%)]"
              role="radiogroup"
              aria-label={`Rate ${title}`}
              onMouseLeave={() => setPreviewRating(null)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setPreviewRating(null);
              }}
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const previewed = previewRating !== null && value <= previewRating;
                const selected = previewRating === null && selectedRating !== null && value <= selectedRating;
                const filled = previewed || selected;
                return (
                  <Button
                    className={cn(
                      'h-20 min-w-0 rounded-xl border-0 bg-transparent px-0 text-[#8f88c8] shadow-none hover:bg-transparent focus-visible:outline-[#ffd75a] active:translate-y-0 max-[420px]:h-16',
                      filled && 'text-[#ffd75a]',
                      previewRating === value && 'scale-[1.08]'
                    )}
                    key={value}
                    type="button"
                    variant="paper"
                    role="radio"
                    aria-checked={selectedRating === value}
                    aria-label={`${value} out of 5 stars`}
                    data-selected={selectedRating === value}
                    disabled={ratingClosed || submitting}
                    onMouseEnter={() => setPreviewRating(value)}
                    onFocus={() => setPreviewRating(value)}
                    onClick={() => void chooseRating(value)}
                  >
                    <Star
                      className="size-12 stroke-[2.25] transition-[color,fill,transform] duration-100 motion-reduce:transition-none max-[520px]:size-10 max-[380px]:size-8"
                      fill={filled ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  </Button>
                );
              })}
            </div>
            <p
              className="mt-2 mb-0 flex min-h-5 items-center justify-center gap-1.5 text-center text-xs font-[820] text-[#d7d3f6]"
              aria-live="polite"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Saving…
                </>
              ) : selectedRating === null ? (
                'Choose 1–5'
              ) : (
                `${selectedRating} / 5`
              )}
            </p>
          </div>
        ) : (
          <div className="mt-4 grid min-h-24 place-items-center rounded-[17px_10px_19px_12px] border-2 border-[#7770ba] bg-[#211d4b] px-4 text-center font-display text-xl font-[850] text-[#ffd75a]">
            {isAuthor ? 'Players are rating' : isParticipant ? 'Rating locked' : 'Watching the ratings'}
          </div>
        )}

        <div className="mt-3">
          <span className="sr-only" aria-live="polite">
            {ratingCount} of {eligibleRaterCount} players rated
          </span>
          <div
            className="h-2.5 overflow-hidden rounded-full border border-[#7770ba] bg-[#171337]"
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
