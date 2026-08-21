import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { Check, Gamepad2, LoaderCircle, Sparkles, Vote } from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  GameAuthor,
  type GameCatalogEntry,
  GameSourceBadge,
  type GameType,
  gamePresentation,
  hasGamePresentation,
} from '@/games/registry';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type SelectableGame = GameCatalogEntry & { gameType: GameType };
type GameTally = { votes: number; percentage: number };

function GameOptionCard({
  game,
  layout,
  selected,
  tally,
  complete = false,
  recommended = false,
  lost = false,
  pending = false,
  disabled,
  onClick,
}: {
  game: SelectableGame;
  layout: 'page' | 'dialog';
  selected: boolean;
  tally?: GameTally;
  complete?: boolean;
  recommended?: boolean;
  lost?: boolean;
  pending?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const presentation = gamePresentation(game.gameType);
  const Icon = presentation.icon;
  const isDialogLayout = layout === 'dialog';

  return (
    <Button
      variant="game-choice"
      className={cn(
        'relative h-auto! min-h-0 min-w-0 gap-0! overflow-hidden disabled:cursor-default disabled:opacity-100',
        isDialogLayout ? 'p-3.5' : 'aspect-[4/3] p-4 pb-4.5 max-[520px]:aspect-auto max-[520px]:min-h-40',
        lost && 'opacity-40'
      )}
      type="button"
      style={{ '--game-color': presentation.color, '--game-tint': presentation.tint } as CSSProperties}
      data-selected={complete ? recommended : selected}
      data-lost={lost}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={complete ? undefined : selected}
    >
      {tally ? (
        <span
          className="absolute inset-y-0 left-0 bg-[var(--game-color)] opacity-10 transition-[width] duration-300"
          style={{ width: `${tally.percentage}%` }}
          aria-hidden="true"
        />
      ) : null}
      <span className="relative z-1 flex min-w-0 items-center justify-between gap-2">
        <span
          className={cn(
            'grid place-items-center rounded-[11px_8px_12px_9px] bg-[var(--game-color)] text-white shadow-[2px_2px_0_rgb(23_32_58/18%)]',
            isDialogLayout ? 'size-10' : 'size-11'
          )}
        >
          <Icon className={isDialogLayout ? 'size-5.5' : 'size-6'} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <GameSourceBadge source={game.source} label="Community" className="shrink-0" />
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : recommended ? (
            <span className="text-[9px] font-[820] tracking-[0.08em] text-[#16885c] uppercase">Top vote</span>
          ) : selected ? (
            <Check className="size-4 text-[#16885c]" aria-label="Your vote" />
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          'relative z-1 flex min-w-0 flex-1 content-start items-start pt-3',
          isDialogLayout ? 'flex-col gap-1.5' : 'gap-2 max-[760px]:flex-col max-[760px]:gap-1.5'
        )}
      >
        <strong
          className={cn(
            'min-w-0 font-display leading-[1.05] font-[830]',
            isDialogLayout ? 'text-[17px]' : 'text-[clamp(17px,1.7vw,22px)]'
          )}
        >
          {game.name}
        </strong>
      </span>
      <span
        className={cn(
          'relative z-1 flex min-w-0 items-end justify-between gap-2 pt-2.5',
          isDialogLayout ? 'mt-3' : 'min-h-7'
        )}
      >
        <GameAuthor game={game} className="pb-1" />
        {tally ? (
          <b className="ml-auto min-w-7 rounded-full bg-white/70 px-2 py-1 text-center text-xs text-[#34415b] tabular-nums">
            {tally.votes}
          </b>
        ) : null}
      </span>
    </Button>
  );
}

function gameDefinition(games: SelectableGame[], gameType: GameType) {
  const game = games.find((candidate) => candidate.gameType === gameType);
  if (game === undefined) {
    throw new Error(`Unknown game type: ${gameType}`);
  }
  return game;
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
  const orderedGames = [...games].sort((first, second) => {
    if (first.gameType === currentGameType) {
      return -1;
    }
    if (second.gameType === currentGameType) {
      return 1;
    }
    return 0;
  });

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
              ? isOwner
                ? isInitialVote
                  ? 'Pick the first game.'
                  : 'Pick the next game.'
                : 'The owner has the final pick.'
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
                <GameOptionCard
                  key={gameType}
                  game={game}
                  layout={layout}
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
          {isOwner ? (
            <>
              <p className="mb-3 flex items-center gap-2 rounded-[10px_7px_11px_8px] bg-[#eef2ff] px-3.5 py-2.5 text-xs font-[720] text-[#3155d9]">
                <Gamepad2 className="size-4" aria-hidden="true" /> Pick one to continue. Everyone will move into the
                game you choose.
              </p>
              <div
                className={cn(
                  'grid grid-cols-3 gap-2.5',
                  isDialogLayout ? 'max-[700px]:grid-cols-1' : 'max-[1100px]:grid-cols-2 max-[520px]:grid-cols-1'
                )}
              >
                {orderedGames.map((game) => {
                  const presentation = gamePresentation(game.gameType);
                  const Icon = presentation.icon;
                  const recommended = poll.recommendedGameType === game.gameType;
                  return (
                    <Button
                      variant="decision"
                      className="h-auto! min-h-0 min-w-0 flex-col items-stretch justify-start gap-0! p-4 disabled:cursor-wait disabled:opacity-60"
                      type="button"
                      key={game.gameType}
                      data-recommended={recommended}
                      onClick={() => handleChoose(game.gameType)}
                      disabled={pendingAction !== null}
                    >
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <Icon className="size-6" style={{ color: presentation.color }} aria-hidden="true" />
                        {pendingAction === `choose:${game.gameType}` ? (
                          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                        ) : recommended ? (
                          <span className="text-[9px] font-[820] tracking-[0.08em] text-[#16885c] uppercase">
                            Top vote
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-3 flex min-w-0 flex-wrap items-center gap-1.5">
                        <strong className="text-sm">{game.name}</strong>
                        <GameSourceBadge source={game.source} />
                      </span>
                      {game.source === 'community' ? (
                        <span className="mt-2 min-w-0">
                          <GameAuthor game={game} />
                        </span>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            </>
          ) : (
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
                  const tally = poll.tallies?.find((candidate) => candidate.gameType === gameType);
                  const recommended = poll.recommendedGameType === gameType;
                  return (
                    <GameOptionCard
                      key={gameType}
                      game={game}
                      layout={layout}
                      selected={poll.selectedGameType === gameType}
                      tally={tally}
                      complete
                      recommended={recommended}
                      lost={poll.recommendedGameType !== null && !recommended}
                      disabled
                      onClick={() => undefined}
                    />
                  );
                })}
              </div>
              <p className="mt-4 mb-0 flex items-center gap-2 text-xs text-[#687389]">
                <Gamepad2 className="size-4 text-[#3155d9]" aria-hidden="true" /> Waiting for the room owner to choose.
              </p>
            </>
          )}
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
