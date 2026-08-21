import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { BrainCircuit, Check, Gamepad2, Keyboard, LoaderCircle, Sparkles, Vote } from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type GameType = 'trivia' | 'typeRacer';

const GAMES: ReadonlyArray<{
  gameType: GameType;
  name: string;
  description: string;
  icon: typeof BrainCircuit;
  color: string;
  tint: string;
}> = [
  {
    gameType: 'trivia',
    name: 'Trivia',
    description: 'Take on another ten questions.',
    icon: BrainCircuit,
    color: '#0c8bb7',
    tint: '#e9f8fc',
  },
  {
    gameType: 'typeRacer',
    name: 'Type Racer',
    description: 'Line up for a new passage.',
    icon: Keyboard,
    color: '#e54f50',
    tint: '#fff0ef',
  },
];

function gameDefinition(gameType: GameType) {
  const game = GAMES.find((candidate) => candidate.gameType === gameType);
  if (game === undefined) {
    throw new Error(`Unknown game type: ${gameType}`);
  }
  return game;
}

function replayLabel(gameType: GameType) {
  switch (gameType) {
    case 'trivia':
      return 'Play Trivia Again';
    case 'typeRacer':
      return 'Race Again';
  }
}

export default function NextGameVoting({
  roomId,
  currentGameId,
  currentGameType,
  sessionToken,
  isOwner,
}: {
  roomId: Id<'rooms'>;
  currentGameId: Id<'roomGames'> | null;
  currentGameType: GameType;
  sessionToken: string;
  isOwner: boolean;
}) {
  const poll = useQuery(api.roomGames.getNextGamePoll, { roomId, sessionToken });
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
    if (currentGameId === null) {
      return;
    }
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

  if (poll === undefined || poll === null) {
    return (
      <div className="flex min-h-27 items-center justify-center gap-2.5 rounded-[16px_11px_18px_12px] border border-[#c7d1e0] bg-white/75 px-5 text-xs font-[680] text-[#657087]">
        <LoaderCircle className="size-4 animate-spin text-[#3155d9]" aria-hidden="true" /> Preparing the next-game
        ballot…
      </div>
    );
  }

  const votingOpen = poll.roundStatus === 'open' && (poll.status === 'round1' || poll.status === 'round2');
  const awaitingOwner = poll.status === 'awaitingOwner';
  const orderedOptions = [...poll.options].sort((first, second) => {
    if (first === currentGameType) {
      return -1;
    }
    if (second === currentGameType) {
      return 1;
    }
    return 0;
  });
  const orderedGames = [...GAMES].sort((first, second) => {
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
      className="w-full rounded-[20px_13px_22px_15px] border border-[#bcc8d9] bg-[rgb(255_255_255/96%)] p-5 text-left text-[#17203a] shadow-[6px_7px_0_rgb(23_32_58/12%)] max-[620px]:p-4"
      aria-labelledby="next-game-heading"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-[820] tracking-[0.13em] text-[#3155d9] uppercase">
            <Vote className="size-3.5" aria-hidden="true" />
            {awaitingOwner ? 'Ballot complete' : `Next game · Round ${poll.roundNumber}`}
          </p>
          <h2
            className="m-0 font-display text-[clamp(24px,4vw,34px)] leading-none font-[850] tracking-[-0.045em]"
            id="next-game-heading"
          >
            {awaitingOwner
              ? isOwner
                ? 'Choose what comes next.'
                : 'The owner has the final pick.'
              : 'Play again or switch games?'}
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-[#edf1f7] px-2.5 py-1.5 text-[10px] font-[780] text-[#5f6c82] tabular-nums">
          {poll.votesCast}/{poll.eligibleVoterCount} voted
        </span>
      </div>

      {votingOpen ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 max-[620px]:grid-cols-1">
            {orderedOptions.map((gameType) => {
              const game = gameDefinition(gameType);
              const Icon = game.icon;
              const selected = poll.selectedGameType === gameType;
              const isReplay = gameType === currentGameType;
              const tally = poll.tallies?.find((candidate) => candidate.gameType === gameType);
              return (
                <button
                  className="relative min-h-28 cursor-pointer overflow-hidden rounded-[14px_9px_15px_10px] border-[1.5px] border-[#c8d2e1] bg-[var(--game-tint)] p-3.5 text-left shadow-[0_4px_0_#d7deea] transition-[transform,border-color,box-shadow] enabled:hover:-translate-y-0.5 enabled:hover:border-[var(--game-color)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgb(49_85_217/30%)] data-[selected=true]:border-[var(--game-color)] data-[selected=true]:shadow-[0_4px_0_var(--game-color)] disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none"
                  type="button"
                  key={gameType}
                  style={{ '--game-color': game.color, '--game-tint': game.tint } as CSSProperties}
                  data-selected={selected}
                  onClick={() => handleVote(gameType)}
                  disabled={!poll.isEligible || pendingAction !== null}
                  aria-pressed={selected}
                >
                  {tally ? (
                    <span
                      className="absolute inset-y-0 left-0 bg-[var(--game-color)] opacity-10 transition-[width] duration-300"
                      style={{ width: `${tally.percentage}%` }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="relative z-1 flex items-center justify-between gap-2">
                    <Icon className="size-5 text-[var(--game-color)]" aria-hidden="true" />
                    {pendingAction === `vote:${gameType}` ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    ) : selected ? (
                      <Check className="size-4 text-[#16885c]" aria-label="Your vote" />
                    ) : null}
                  </span>
                  <strong className="relative z-1 mt-3 block font-display text-lg font-[830]">
                    {isReplay ? replayLabel(gameType) : `Switch to ${game.name}`}
                  </strong>
                  <span className="relative z-1 mt-1 flex items-end justify-between gap-2 text-[11px] leading-[1.35] text-[#657087]">
                    {isReplay ? `Keep playing ${game.name}.` : game.description}
                    {tally ? <b className="text-[#34415b] tabular-nums">{tally.votes}</b> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 max-[620px]:items-start">
            <p className="m-0 text-[11px] leading-[1.45] text-[#6d788c]">
              {poll.selectedGameType === null
                ? 'Vote to reveal the live count. You can change your pick until the owner closes the round.'
                : poll.roundNumber === 1
                  ? 'A two-thirds majority ends the ballot. Otherwise the leading choices go to round two.'
                  : 'This runoff produces a recommendation; the owner still decides.'}
            </p>
            {isOwner ? (
              <button
                className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-[10px_7px_11px_8px] border border-[#17203a] bg-[#f3cb42] px-4 text-xs font-[800] text-[#17203a] shadow-[3px_3px_0_#17203a] enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.75"
                type="button"
                onClick={handleCloseRound}
                disabled={poll.votesCast === 0 || pendingAction !== null}
              >
                {pendingAction === 'close-round' ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                Close round
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {awaitingOwner ? (
        <div>
          {poll.recommendedGameType ? (
            <p className="mb-3 rounded-[10px_7px_11px_8px] bg-[#e8f7ef] px-3.5 py-2.5 text-xs font-[720] text-[#176b49]">
              Players recommend <strong>{gameDefinition(poll.recommendedGameType).name}</strong>.
            </p>
          ) : (
            <p className="mb-3 rounded-[10px_7px_11px_8px] bg-[#fff3d1] px-3.5 py-2.5 text-xs font-[720] text-[#785c14]">
              The vote ended in a tie. The owner can break it.
            </p>
          )}
          {poll.tallies ? (
            <fieldset className="mb-3 grid gap-1.5 border-0 p-0">
              <legend className="sr-only">Final vote count</legend>
              {poll.tallies.map((tally) => (
                <div
                  className="grid grid-cols-[90px_minmax(0,1fr)_34px] items-center gap-2 text-[11px] text-[#5f6c82]"
                  key={tally.gameType}
                >
                  <span className="font-[720] text-[#34415b]">{gameDefinition(tally.gameType).name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[#e5eaf1]">
                    <span
                      className="block h-full rounded-full bg-[#3155d9]"
                      style={{ width: `${tally.percentage}%` }}
                    />
                  </span>
                  <strong className="text-right tabular-nums">{tally.votes}</strong>
                </div>
              ))}
            </fieldset>
          ) : null}
          {isOwner ? (
            <div className="grid grid-cols-2 gap-2.5 max-[620px]:grid-cols-1">
              {orderedGames.map((game) => {
                const Icon = game.icon;
                const recommended = poll.recommendedGameType === game.gameType;
                const isReplay = game.gameType === currentGameType;
                return (
                  <button
                    className={cn(
                      'min-h-22 cursor-pointer rounded-[13px_8px_14px_9px] border border-[#c5cfdd] bg-white p-3 text-left shadow-[0_4px_0_#d7deea] transition-transform enabled:hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgb(49_85_217/30%)] disabled:cursor-wait disabled:opacity-60',
                      recommended && 'border-[#35a675] bg-[#ecf9f2] shadow-[0_4px_0_#35a675]'
                    )}
                    type="button"
                    key={game.gameType}
                    onClick={() => handleChoose(game.gameType)}
                    disabled={currentGameId === null || pendingAction !== null}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <Icon className="size-4.5" style={{ color: game.color }} aria-hidden="true" />
                      {pendingAction === `choose:${game.gameType}` ? (
                        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      ) : recommended ? (
                        <span className="text-[9px] font-[820] tracking-[0.08em] text-[#16885c] uppercase">
                          Top vote
                        </span>
                      ) : null}
                    </span>
                    <strong className="mt-2 block text-sm">
                      {isReplay ? replayLabel(game.gameType) : `Switch to ${game.name}`}
                    </strong>
                    <span className="mt-0.5 block text-[10px] text-[#6b768a]">{game.description}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="m-0 flex items-center gap-2 text-xs text-[#687389]">
              <Gamepad2 className="size-4 text-[#3155d9]" aria-hidden="true" /> Waiting for the room owner to choose.
            </p>
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
