import type { Id } from '@convex/_generated/dataModel';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import NextGameVoting from '@/components/NextGameVoting';
import { cn } from '@/lib/utils';

type GameType = 'trivia' | 'typeRacer';

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
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  icon: LucideIcon;
  accent: string;
  accentTint: string;
  roomId: Id<'rooms'>;
  currentGameId: Id<'roomGames'> | null;
  currentGameType: GameType;
  sessionToken: string;
  isOwner: boolean;
  isClosed: boolean;
  closedMessage: string;
  summary?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'relative flex min-h-[clamp(600px,calc(100dvh-112px),768px)] overflow-hidden rounded-[22px_14px_24px_16px] border border-[#b8c4d6] bg-[#f8faff] p-[clamp(24px,4vw,54px)] text-[#17203a] shadow-[7px_8px_0_#d2dbea] max-[760px]:min-h-150 max-[620px]:p-4',
        className
      )}
      style={{ '--post-game-accent': accent, '--post-game-tint': accentTint } as CSSProperties}
      aria-labelledby="post-game-title"
    >
      <div
        className="pointer-events-none absolute -top-16 -right-12 size-54 rotate-12 rounded-[34%_66%_54%_46%] bg-[var(--post-game-tint)] opacity-85"
        aria-hidden="true"
      />
      <div className="relative z-1 m-auto w-full max-w-215">
        <div className="mb-6 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 max-[520px]:items-start">
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

        {summary ? <div className="mb-6">{summary}</div> : null}

        {isClosed ? (
          <p className="m-0 rounded-[15px_10px_17px_12px] border border-[#c7d1df] bg-white p-5 text-center text-sm text-[#657087]">
            {closedMessage}
          </p>
        ) : (
          <NextGameVoting
            roomId={roomId}
            currentGameId={currentGameId}
            currentGameType={currentGameType}
            sessionToken={sessionToken}
            isOwner={isOwner}
          />
        )}
      </div>
    </section>
  );
}
