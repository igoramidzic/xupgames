import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Gamepad2, LoaderCircle, Shuffle, UsersRound, Vote } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import GameChoiceCard from '@/components/GameChoiceCard';
import NextGameVoting from '@/components/NextGameVoting';
import { Button } from '@/components/ui/button';
import { type GameType, hasGamePresentation } from '@/games/registry';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type ControlView = 'method' | 'pick' | 'vote';

type GameModeProps = {
  roomId: Id<'rooms'>;
  currentGameId: Id<'roomGames'> | null;
  currentGameType: GameType | null;
  sessionToken: string;
  isOwner: boolean;
  isClosed: boolean;
};

export default function GameModeControl({
  roomId,
  currentGameId,
  currentGameType,
  sessionToken,
  isOwner,
  isClosed,
  onOpen,
  buttonVariant = 'paper',
  className,
}: GameModeProps & {
  onOpen: () => void;
  buttonVariant?: 'paper' | 'type-paper';
  className?: string;
}) {
  const poll = useQuery(api.roomGames.getNextGamePoll, { roomId, sessionToken });
  const hasActivePoll = poll !== undefined && poll !== null;

  if (currentGameId === null || currentGameType === null || isClosed || hasActivePoll || !isOwner) {
    return null;
  }

  return (
    <Button
      variant={buttonVariant}
      size="sm"
      className={cn('max-[760px]:w-9 max-[760px]:px-0 [&_svg]:size-3.75', className)}
      type="button"
      onClick={onOpen}
      aria-label="Change game"
    >
      <Shuffle aria-hidden="true" />
      <span className="max-[760px]:hidden">Change game</span>
    </Button>
  );
}

export function GameModeContent({
  roomId,
  currentGameId,
  currentGameType,
  sessionToken,
  isOwner,
  isClosed,
  open,
  onClose,
  children,
}: GameModeProps & {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const poll = useQuery(api.roomGames.getNextGamePoll, { roomId, sessionToken });
  const catalog = useQuery(api.games.listAvailable, {});
  const startVote = useMutation(api.roomGames.startGameModeVote);
  const changeGame = useMutation(api.roomGames.changeGameNow);
  const games = (catalog ?? []).filter(hasGamePresentation);
  const manualVoteActive = poll?.trigger === 'owner';
  const hasOtherActivePoll = poll !== undefined && poll !== null && !manualVoteActive;
  const [view, setView] = useState<ControlView>('method');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setView('method');
    setError(null);
  }, [open]);

  useEffect(() => {
    if ((manualVoteActive || hasOtherActivePoll) && open) {
      onClose();
    }
  }, [hasOtherActivePoll, manualVoteActive, onClose, open]);

  if (
    currentGameId === null ||
    currentGameType === null ||
    isClosed ||
    hasOtherActivePoll ||
    (!manualVoteActive && (!isOwner || !open))
  ) {
    return children;
  }

  const activeRoomGameId: Id<'roomGames'> = currentGameId;
  const activeGameType: GameType = currentGameType;

  async function handleStartVote() {
    setPending('vote');
    setError(null);
    try {
      await startVote({ roomId, sessionToken, expectedRoomGameId: activeRoomGameId });
      setView('vote');
    } catch (voteError) {
      setError(userFacingError(voteError, 'The game vote could not be started.'));
    } finally {
      setPending(null);
    }
  }

  async function handleDirectChange(gameType: GameType) {
    setPending(`pick:${gameType}`);
    setError(null);
    try {
      await changeGame({ roomId, sessionToken, expectedRoomGameId: activeRoomGameId, gameType });
      onClose();
    } catch (changeError) {
      setError(userFacingError(changeError, 'The room could not switch games.'));
    } finally {
      setPending(null);
    }
  }

  if (manualVoteActive || view === 'vote') {
    return (
      <div className="grid min-h-[clamp(560px,calc(100dvh-112px),768px)] content-start gap-3 max-[760px]:min-h-140">
        <div className="flex items-start gap-2.5 rounded-[12px_8px_13px_9px] border border-[#c9d4e4] bg-[#eef2ff] px-4 py-3 text-xs leading-[1.45] font-[720] text-[#3155d9] shadow-[3px_4px_0_rgb(23_32_58/8%)]">
          <UsersRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {isOwner
              ? 'You opened the room vote. Vote too, then close the round when everyone is ready.'
              : 'The game is paused. Pick what you want everyone to play next.'}
          </span>
        </div>
        <NextGameVoting
          roomId={roomId}
          currentGameId={activeRoomGameId}
          currentGameType={activeGameType}
          sessionToken={sessionToken}
          isOwner={isOwner}
        />
      </div>
    );
  }

  return (
    <section className="flex min-h-[clamp(560px,calc(100dvh-112px),768px)] items-start rounded-[22px_14px_24px_16px] border border-[#b8c4d6] bg-[#f8faff] p-[clamp(22px,4vw,48px)] text-[#17203a] shadow-[7px_8px_0_#d2dbea] max-[760px]:min-h-140 max-[620px]:p-4">
      <div className="mx-auto w-full max-w-215">
        {view === 'method' ? (
          <>
            <Button variant="ghost" size="sm" className="mb-5 w-fit" type="button" onClick={onClose}>
              <ArrowLeft aria-hidden="true" /> Keep playing
            </Button>
            <div className="max-w-165">
              <p className="m-0 text-[10px] font-[820] tracking-[0.13em] text-[#3155d9] uppercase">Next game</p>
              <h1 className="mt-2 mb-0 font-display text-[clamp(36px,6vw,62px)] leading-[0.93] font-[850] tracking-[-0.055em] text-[#17203a]">
                Who picks what&apos;s next?
              </h1>
              <p className="mt-4 mb-0 max-w-140 text-sm leading-[1.55] text-[#657087]">
                Changing games ends this round for everyone. Hand the choice to the room, or move everyone to your pick.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
              <Button
                variant="choice"
                className="h-auto! min-w-0 items-start justify-start gap-3 p-4 text-left"
                type="button"
                onClick={handleStartVote}
                disabled={pending !== null}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-[11px_8px_12px_9px] bg-[#3155d9] text-white shadow-[2px_2px_0_#17203a]">
                  {pending === 'vote' ? <LoaderCircle className="animate-spin" /> : <Vote aria-hidden="true" />}
                </span>
                <span className="min-w-0 whitespace-normal">
                  <strong className="block text-sm text-[#17203a]">Let the room vote</strong>
                  <span className="mt-1 block text-xs leading-[1.45] text-[#687389]">
                    Everyone gets the same ballot. You close the round and make the final pick.
                  </span>
                </span>
              </Button>
              <Button
                variant="choice"
                className="h-auto! min-w-0 items-start justify-start gap-3 p-4 text-left"
                type="button"
                onClick={() => setView('pick')}
                disabled={pending !== null}
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-[11px_8px_12px_9px] bg-[#f3cb42] text-[#17203a] shadow-[2px_2px_0_#17203a]">
                  <Gamepad2 aria-hidden="true" />
                </span>
                <span className="min-w-0 whitespace-normal">
                  <strong className="block text-sm text-[#17203a]">I&apos;ll choose</strong>
                  <span className="mt-1 block text-xs leading-[1.45] text-[#687389]">
                    Skip the ballot and move everyone to a fresh game lobby.
                  </span>
                </span>
              </Button>
            </div>
          </>
        ) : null}

        {view === 'pick' ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mb-5 w-fit"
              type="button"
              onClick={() => setView('method')}
              disabled={pending !== null}
            >
              <ArrowLeft aria-hidden="true" /> Back
            </Button>
            <p className="m-0 text-[10px] font-[820] tracking-[0.13em] text-[#3155d9] uppercase">Owner&apos;s pick</p>
            <h1 className="mt-2 mb-0 font-display text-[clamp(36px,6vw,62px)] leading-[0.93] font-[850] tracking-[-0.055em] text-[#17203a]">
              Choose the next game.
            </h1>
            <p className="mt-4 mb-0 max-w-140 text-sm leading-[1.55] text-[#657087]">
              Your choice ends this round and opens a fresh game lobby for everyone.
            </p>

            {catalog === undefined ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#657087]">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading games…
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-3 gap-3 max-[620px]:grid-cols-1">
                {games.map((game) => {
                  const isCurrent = game.gameType === activeGameType;
                  const isPending = pending === `pick:${game.gameType}`;
                  return (
                    <GameChoiceCard
                      key={game.gameType}
                      game={game}
                      statusLabel={isCurrent ? 'Play again' : undefined}
                      pending={isPending}
                      onClick={() => handleDirectChange(game.gameType)}
                      disabled={pending !== null}
                    />
                  );
                })}
              </div>
            )}
          </>
        ) : null}

        {error ? (
          <p className="mt-4 mb-0 text-xs font-[680] text-[#b72934]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
