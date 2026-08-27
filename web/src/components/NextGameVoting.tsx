import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Gamepad2, LoaderCircle, Sparkles, Timer, Vote } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import GameChoiceCard from '@/components/GameChoiceCard';
import { Button } from '@/components/ui/button';
import { type GameCatalogEntry, type GameType, hasGamePresentation } from '@/games/registry';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type SelectableGame = GameCatalogEntry & { gameType: GameType };
const NEXT_GAME_AUTO_ADVANCE_DELAY_MS = 5_000;
const AUTO_ADVANCE_COUNTDOWN_TICK_MS = 100;

function gameDefinition(games: SelectableGame[], gameType: GameType) {
  const game = games.find((candidate) => candidate.gameType === gameType);
  if (game === undefined) {
    throw new Error(`Unknown game type: ${gameType}`);
  }
  return game;
}

function WinnerCountdown({ gameName, autoAdvanceAt }: { gameName: string; autoAdvanceAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow >= autoAdvanceAt) {
        window.clearInterval(interval);
      }
    }, AUTO_ADVANCE_COUNTDOWN_TICK_MS);
    return () => window.clearInterval(interval);
  }, [autoAdvanceAt]);

  const remaining = Math.max(0, autoAdvanceAt - now);
  const seconds = Math.ceil(remaining / 1_000);
  const progress = Math.min(
    100,
    Math.max(0, Math.round(((NEXT_GAME_AUTO_ADVANCE_DELAY_MS - remaining) / NEXT_GAME_AUTO_ADVANCE_DELAY_MS) * 100))
  );
  const countdownText = seconds > 0 ? `Starting ${gameName} in ${seconds}s` : `Starting ${gameName}…`;

  return (
    <div className="mb-3 rounded-[10px_7px_11px_8px] bg-[#eef2ff] px-3.5 py-2.5 text-[#3155d9]">
      <div className="flex items-center justify-between gap-3 text-xs font-[760] max-[620px]:flex-col max-[620px]:items-start max-[620px]:gap-1.5">
        <span className="inline-flex items-center gap-2">
          <Timer className="size-4" aria-hidden="true" /> The winning game is locked in.
        </span>
        <span className="shrink-0 tabular-nums" aria-live="polite">
          {countdownText}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#d8e0f4]"
        role="progressbar"
        aria-label={`Time until ${gameName} starts`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={countdownText}
      >
        <span
          className="block h-full rounded-full bg-[#3155d9] transition-[width] duration-100 ease-linear motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function NextGameVoting({
  roomId,
  currentGameId,
  currentGameType,
  sessionToken,
  isOwner,
  layout = 'page',
}: {
  roomId: Id<'rooms'>;
  currentGameId: Id<'roomGames'> | null;
  currentGameType: GameType | null;
  sessionToken: string;
  isOwner: boolean;
  layout?: 'page' | 'dialog';
}) {
  const poll = useQuery(api.roomGames.getNextGamePoll, { roomId, sessionToken });
  const catalog = useQuery(api.games.listAvailable, {});
  const games = (catalog ?? []).filter(hasGamePresentation);
  const openVoting = useMutation(api.roomGames.openNextGameVoting);
  const castVote = useMutation(api.roomGames.castNextGameVote);
  const closeRound = useMutation(api.roomGames.closeNextGameVotingRound);
  const chooseGame = useMutation(api.roomGames.chooseNextGame);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openAttempted = useRef(false);

  useEffect(() => {
    if (poll !== null || pendingAction !== null || openAttempted.current) {
      return;
    }
    openAttempted.current = true;
    setPendingAction('open-voting');
    void openVoting({ roomId, sessionToken })
      .catch((openError) => setError(userFacingError(openError, 'The next-game ballot could not be opened.')))
      .finally(() => setPendingAction(null));
  }, [openVoting, pendingAction, poll, roomId, sessionToken]);

  async function handleVote(gameType: GameType) {
    setPendingAction(`vote:${gameType}`);
    setError(null);
    try {
      await castVote({ roomId, sessionToken, gameType });
    } catch (voteError) {
      setError(userFacingError(voteError, 'Your vote could not be saved.'));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCloseRound() {
    if (poll === undefined || poll === null) {
      return;
    }
    setPendingAction('close-round');
    setError(null);
    try {
      await closeRound({ roomId, sessionToken, roundId: poll.roundId });
    } catch (closeError) {
      setError(userFacingError(closeError, 'This voting round could not be closed.'));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleChoose(gameType: GameType) {
    setPendingAction(`choose:${gameType}`);
    setError(null);
    try {
      await chooseGame({ roomId, sessionToken, expectedRoomGameId: currentGameId, gameType });
    } catch (chooseError) {
      setError(userFacingError(chooseError, 'The next game could not be opened.'));
    } finally {
      setPendingAction(null);
    }
  }

  if (poll === undefined || poll === null || catalog === undefined) {
    return (
      <div className="flex min-h-27 items-center justify-center gap-2.5 rounded-[16px_11px_18px_12px] border border-[#c7d1e0] bg-white/75 px-5 text-xs font-[680] text-[#657087]">
        <LoaderCircle className="size-4 animate-spin text-[#3155d9]" aria-hidden="true" /> Preparing the game ballot…
      </div>
    );
  }

  const votingOpen = poll.roundStatus === 'open' && (poll.status === 'round1' || poll.status === 'round2');
  const awaitingOwner = poll.status === 'awaitingOwner';
  const isInitialVote = currentGameType === null;
  const isDialogLayout = layout === 'dialog';
  const orderedOptions = [...poll.options].sort((first, second) => {
    if (first === currentGameType) {
      return -1;
    }
    if (second === currentGameType) {
      return 1;
    }
    return 0;
  });
  const recommendedGame = poll.recommendedGameType === null ? null : gameDefinition(games, poll.recommendedGameType);
  const tieNeedsOwner = awaitingOwner && recommendedGame === null;

  return (
    <section
      className={cn(
        'w-full rounded-[20px_13px_22px_15px] border border-[#bcc8d9] bg-[rgb(255_255_255/96%)] text-left text-[#17203a] shadow-[6px_7px_0_rgb(23_32_58/12%)]',
        isDialogLayout ? 'p-4' : 'p-5 max-[620px]:p-4'
      )}
      aria-labelledby="next-game-heading"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-[820] tracking-[0.13em] text-[#3155d9] uppercase">
            <Vote className="size-3.5" aria-hidden="true" />
            {awaitingOwner
              ? 'Ballot complete'
              : `${isInitialVote ? 'First game' : 'Next game'} · Round ${poll.roundNumber}`}
          </p>
          <h2
            className={cn(
              'm-0 font-display leading-none font-[850] tracking-[-0.045em]',
              isDialogLayout ? 'text-[clamp(24px,3vw,30px)]' : 'text-[clamp(24px,4vw,34px)]'
            )}
            id="next-game-heading"
          >
            {awaitingOwner
              ? recommendedGame !== null
                ? `${recommendedGame.name} is up next.`
                : isOwner
                  ? 'Break the tie.'
                  : 'The vote is tied.'
              : isInitialVote
                ? 'What should we play first?'
                : 'What should we play next?'}
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#edf1f7] px-2.5 py-1.5 text-[10px] font-[780] text-[#5f6c82] tabular-nums">
          {poll.votesCast}/{poll.eligibleVoterCount} voted
        </span>
      </div>

      {votingOpen ? (
        <>
          <div
            className={cn(
              'grid grid-cols-3',
              isDialogLayout
                ? 'gap-2.5 max-[700px]:grid-cols-1'
                : 'gap-3 max-[1100px]:grid-cols-2 max-[520px]:grid-cols-1'
            )}
          >
            {orderedOptions.map((gameType) => {
              const game = gameDefinition(games, gameType);
              const selected = poll.selectedGameType === gameType;
              const tally = poll.tallies?.find((candidate) => candidate.gameType === gameType);
              return (
                <GameChoiceCard
                  key={gameType}
                  game={game}
                  selected={selected}
                  tally={tally}
                  pending={pendingAction === `vote:${gameType}`}
                  onClick={() => handleVote(gameType)}
                  disabled={!poll.isEligible || pendingAction !== null}
                />
              );
            })}
          </div>
          {isOwner ? (
            <div className="mt-4 flex justify-end">
              <Button
                variant="sunny"
                className="h-10 shrink-0 text-xs [&_svg]:size-3.75"
                type="button"
                onClick={handleCloseRound}
                disabled={poll.votesCast === 0 || pendingAction !== null}
              >
                {pendingAction === 'close-round' ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                Close round
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      {awaitingOwner ? (
        <div>
          {recommendedGame !== null && poll.autoAdvanceAt !== null ? (
            <WinnerCountdown gameName={recommendedGame.name} autoAdvanceAt={poll.autoAdvanceAt} />
          ) : isOwner ? (
            <p className="mb-3 flex items-center gap-2 rounded-[10px_7px_11px_8px] bg-[#eef2ff] px-3.5 py-2.5 text-xs font-[720] text-[#3155d9]">
              <Gamepad2 className="size-4" aria-hidden="true" /> Pick one of the tied games to continue.
            </p>
          ) : null}
          <div
            className={cn(
              'grid grid-cols-3',
              isDialogLayout
                ? 'gap-2.5 max-[700px]:grid-cols-1'
                : 'gap-3 max-[1100px]:grid-cols-2 max-[520px]:grid-cols-1'
            )}
          >
            {orderedOptions.map((gameType) => {
              const game = gameDefinition(games, gameType);
              const tally = poll.tallies?.find((candidate) => candidate.gameType === gameType);
              const recommended = poll.recommendedGameType === gameType;
              const ownerCanBreakTie = tieNeedsOwner && isOwner;
              return (
                <GameChoiceCard
                  key={gameType}
                  game={game}
                  selected={poll.selectedGameType === gameType}
                  tally={tally}
                  complete
                  recommended={recommended}
                  advancing={recommended && poll.autoAdvanceAt !== null}
                  pending={pendingAction === `choose:${gameType}`}
                  onClick={ownerCanBreakTie ? () => handleChoose(gameType) : () => undefined}
                  disabled={!ownerCanBreakTie || pendingAction !== null}
                />
              );
            })}
          </div>
          {tieNeedsOwner && !isOwner ? (
            <p className="mt-4 mb-0 flex items-center gap-2 text-xs text-[#687389]">
              <Gamepad2 className="size-4 text-[#3155d9]" aria-hidden="true" /> Waiting for the room owner to break the
              tie.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 mb-0 text-xs font-[680] text-[#b72934]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
