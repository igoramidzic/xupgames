import type { Id } from '@convex/_generated/dataModel';
import { type LucideIcon, Timer } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import NextGameVoting from '@/components/NextGameVoting';
import type { GameType } from '@/games/registry';
import { cn } from '@/lib/utils';

export const NEXT_GAME_BALLOT_DELAY_MS = 2_000;
export const WINNER_SPOTLIGHT_DURATION_MS = 3_000;
const BALLOT_COUNTDOWN_TICK_MS = 100;
type PostGamePhase = 'winner' | 'countdown' | 'voting';

export function PostGamePodium({
  entries,
  label,
  animate = true,
}: {
  entries: ReadonlyArray<{ id: string; place: number; name: string; result: string }>;
  label: string;
  animate?: boolean;
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <ol className="m-0 flex w-full list-none items-end justify-center gap-2.25 p-0" aria-label={label}>
      {entries.slice(0, 3).map((entry, index) => (
        <li
          className={cn(
            "order-3 flex min-h-20 w-[31%] flex-col items-center justify-center rounded-[12px_6px_13px_7px] border border-[#b9c8d6] bg-[#edf4f8] px-2 py-3 text-center data-[place='1']:order-2 data-[place='1']:min-h-24 data-[place='1']:border-[#c9a21f] data-[place='1']:bg-[#fff3bd] data-[place='2']:order-1",
            animate &&
              'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-500'
          )}
          key={entry.id}
          data-place={entry.place}
          data-post-game-place={entry.place}
          style={animate ? { animationDelay: `${180 + index * 110}ms` } : undefined}
        >
          <span className="mb-1.5 grid size-6 place-items-center rounded-full bg-[#17203a] text-[9px] font-[850] text-white">
            {entry.place}
          </span>
          <strong className="max-w-full overflow-hidden text-xs text-ellipsis whitespace-nowrap text-[#22384f]">
            {entry.name}
          </strong>
          <small className="mt-0.75 max-w-full overflow-hidden text-[10px] text-ellipsis whitespace-nowrap text-[#74869a]">
            {entry.result}
          </small>
        </li>
      ))}
    </ol>
  );
}

export default function PostGameBoard({
  eyebrow,
  title,
  detail,
  icon: Icon,
  accent,
  accentTint,
  roomId,
  currentGameId,
  currentGameType,
  sessionToken,
  isOwner,
  isClosed,
  closedMessage,
  summary,
  className,
  playIntro = false,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  icon: LucideIcon;
  accent: string;
  accentTint: string;
  roomId: Id<'rooms'>;
  currentGameId: Id<'roomGames'> | null;
  currentGameType: GameType | null;
  sessionToken: string;
  isOwner: boolean;
  isClosed: boolean;
  closedMessage: string;
  summary?: ReactNode;
  className?: string;
  playIntro?: boolean;
}) {
  const shouldPlayIntro = useRef(playIntro).current;
  const [phase, setPhase] = useState<PostGamePhase>(shouldPlayIntro ? 'winner' : 'voting');
  const [ballotDelayRemaining, setBallotDelayRemaining] = useState(shouldPlayIntro ? NEXT_GAME_BALLOT_DELAY_MS : 0);

  useEffect(() => {
    if (isClosed || !shouldPlayIntro) {
      return;
    }
    const countdownStartsAt = Date.now() + WINNER_SPOTLIGHT_DURATION_MS;
    const ballotOpensAt = countdownStartsAt + NEXT_GAME_BALLOT_DELAY_MS;
    let interval: number | undefined;
    const countdownTimeout = window.setTimeout(() => {
      setPhase('countdown');
      setBallotDelayRemaining(Math.max(0, ballotOpensAt - Date.now()));
      interval = window.setInterval(() => {
        setBallotDelayRemaining(Math.max(0, ballotOpensAt - Date.now()));
      }, BALLOT_COUNTDOWN_TICK_MS);
    }, WINNER_SPOTLIGHT_DURATION_MS);
    const ballotTimeout = window.setTimeout(() => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
      setBallotDelayRemaining(0);
      setPhase('voting');
    }, WINNER_SPOTLIGHT_DURATION_MS + NEXT_GAME_BALLOT_DELAY_MS);
    return () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
      window.clearTimeout(countdownTimeout);
      window.clearTimeout(ballotTimeout);
    };
  }, [isClosed, shouldPlayIntro]);

  const ballotCountdownSeconds = Math.ceil(ballotDelayRemaining / 1_000);
  const ballotProgress = Math.min(
    100,
    Math.max(0, Math.round(((NEXT_GAME_BALLOT_DELAY_MS - ballotDelayRemaining) / NEXT_GAME_BALLOT_DELAY_MS) * 100))
  );
  const ballotCountdownLabel = `${ballotCountdownSeconds} ${ballotCountdownSeconds === 1 ? 'second' : 'seconds'} remaining`;

  return (
    <section
      className={cn(
        'relative flex min-h-[clamp(600px,calc(100dvh-112px),768px)] items-start overflow-hidden rounded-[22px_14px_24px_16px] border border-[#b8c4d6] bg-[#f8faff] p-[clamp(24px,4vw,54px)] text-[#17203a] shadow-[7px_8px_0_#d2dbea] max-[760px]:min-h-150 max-[620px]:p-4',
        shouldPlayIntro && 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500',
        className
      )}
      style={{ '--post-game-accent': accent, '--post-game-tint': accentTint } as CSSProperties}
      aria-labelledby="post-game-title"
    >
      <div
        className="pointer-events-none absolute -top-16 -right-12 size-54 rotate-12 rounded-[34%_66%_54%_46%] bg-[var(--post-game-tint)] opacity-85"
        aria-hidden="true"
      />
      <div className="relative z-1 mx-auto w-full max-w-215">
        <div
          className="transition-opacity duration-500 data-[dimmed=true]:opacity-45 motion-reduce:transition-none"
          data-dimmed={phase === 'voting'}
          data-post-game-results
        >
          <div
            className={cn(
              'mb-6 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 max-[520px]:items-start',
              shouldPlayIntro &&
                'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:duration-500'
            )}
          >
            <span className="grid size-14 -rotate-3 place-items-center rounded-[18px_12px_20px_14px] border-2 border-[#17203a] bg-[var(--post-game-tint)] text-[var(--post-game-accent)] shadow-[4px_4px_0_#17203a] [&_svg]:size-6">
              <Icon aria-hidden="true" />
            </span>
            <div>
              <p className="mb-1.5 text-[10px] font-[830] tracking-[0.14em] text-[var(--post-game-accent)] uppercase">
                {eyebrow}
              </p>
              <h1
                className="m-0 font-display text-[clamp(38px,6vw,68px)] leading-[0.9] font-[860] tracking-[-0.06em]"
                id="post-game-title"
              >
                {title}
              </h1>
              {detail ? <p className="mt-3 mb-0 text-sm leading-[1.5] text-[#687389]">{detail}</p> : null}
            </div>
          </div>

          {summary ? <div>{summary}</div> : null}
        </div>

        {isClosed ? (
          <p className="mt-6 mb-0 rounded-[15px_10px_17px_12px] border border-[#c7d1df] bg-white p-5 text-center text-sm text-[#657087]">
            {closedMessage}
          </p>
        ) : (
          <div className="mt-6 grid">
            <div
              className="pointer-events-none col-start-1 row-start-1 self-start rounded-[12px_8px_13px_9px] border border-[#c7d1e0] bg-white/70 px-3.5 py-3 opacity-0 shadow-[0_3px_0_#dde4ee] transition-opacity duration-500 data-[visible=true]:opacity-100 motion-reduce:transition-none"
              data-visible={phase === 'countdown'}
              data-countdown-card
              aria-hidden={phase !== 'countdown'}
            >
              <div className="flex items-center justify-between gap-3 text-[10px] font-[800] tracking-[0.08em] text-[#536078] uppercase">
                <span className="inline-flex items-center gap-1.5">
                  <Timer className="size-3.5 text-[#3155d9]" aria-hidden="true" /> Next-game vote
                </span>
                <span className="text-[#3155d9] tabular-nums">Opens in {ballotCountdownSeconds}s</span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dfe5ee]"
                role="progressbar"
                aria-label="Time until next-game voting opens"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={ballotProgress}
                aria-valuetext={ballotCountdownLabel}
              >
                <span
                  className="block h-full rounded-full bg-[#3155d9] transition-[width] duration-100 ease-linear motion-reduce:transition-none"
                  style={{ width: `${ballotProgress}%` }}
                />
              </div>
            </div>
            <div
              className="col-start-1 row-start-1 opacity-0 transition-opacity duration-500 data-[active=true]:opacity-100 motion-reduce:transition-none"
              data-active={phase === 'voting'}
              aria-hidden={phase !== 'voting'}
              inert={phase !== 'voting'}
            >
              <NextGameVoting
                roomId={roomId}
                currentGameId={currentGameId}
                currentGameType={currentGameType}
                sessionToken={sessionToken}
                isOwner={isOwner}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
