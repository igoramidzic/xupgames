import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  Beaker,
  Check,
  Copy,
  Eye,
  LoaderCircle,
  Medal,
  MessageCircle,
  Paintbrush,
  Play,
  Send,
  Trophy,
  UsersRound,
} from 'lucide-react';
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GameModeControl, { GameModeContent } from '@/components/GameModeControl';
import GameSurfaceTransition from '@/components/GameSurfaceTransition';
import LobbyPlayersSidebar from '@/components/LobbyPlayersSidebar';
import PostGameBoard, { PostGamePodium } from '@/components/PostGameBoard';
import RoomHeaderActions from '@/components/RoomHeaderActions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isLocalhost } from '@/lib/environment';
import {
  GAME_LOBBY_CARD_HEIGHT_CLASS,
  GAME_LOBBY_FRAME_CLASS,
  GAME_LOBBY_GRID_CLASS,
  GAME_STANDINGS_SIDEBAR_HEIGHT_CLASS,
} from '@/lib/gameLobbyLayout';
import type { GuestIdentity } from '@/lib/guest';
import { getRoomMembers } from '@/lib/roomSession';
import { useListReorderAnimation } from '@/lib/useListReorderAnimation';
import { useRoomPresence } from '@/lib/useRoomPresence';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';
import DoodleDashCanvas from './DoodleDashCanvas';
import DoodleDashConfigurationDialog from './DoodleDashConfigurationDialog';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;
type GameView = FunctionReturnType<typeof api.doodleDash.getGame>;

function useClock(enabled: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [enabled]);
  return now;
}

function formatPoints(points: number) {
  return new Intl.NumberFormat('en-US').format(points);
}

function formatTimer(milliseconds: number) {
  const safeMilliseconds = Math.max(0, milliseconds);
  const seconds = Math.ceil(safeMilliseconds / 1_000);
  return String(seconds).padStart(2, '0');
}

export default function DoodleDashRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  const navigate = useNavigate();
  const game = useQuery(api.doodleDash.getGame, { roomId: session.roomId, sessionToken: guest.sessionToken });
  const shouldSubscribeToLiveStrokes =
    game !== undefined && game.phase === 'drawing' && game.round !== null && !game.round.isDrawer;
  const liveStrokeChunks = useQuery(
    api.doodleDash.listLiveStrokeChunks,
    shouldSubscribeToLiveStrokes ? { roomId: session.roomId, sessionToken: guest.sessionToken } : 'skip'
  );
  const startGame = useMutation(api.doodleDash.startGame);
  const chooseWord = useMutation(api.doodleDash.chooseWord);
  const submitGuess = useMutation(api.doodleDash.submitGuess);
  const appendStroke = useMutation(api.doodleDash.appendStroke);
  const streamStrokeChunk = useMutation(api.doodleDash.streamStrokeChunk);
  const undoStroke = useMutation(api.doodleDash.undoStroke);
  const redoStroke = useMutation(api.doodleDash.redoStroke);
  const clearCanvas = useMutation(api.doodleDash.clearCanvas);
  const configureGame = useMutation(api.doodleDash.configureGame);
  const leaveRoom = useMutation(api.rooms.leave);
  const closeRoom = useMutation(api.rooms.close);
  const { onlineByMemberId } = useRoomPresence({ roomId: session.roomId, sessionToken: guest.sessionToken });
  const [starting, setStarting] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [guess, setGuess] = useState('');
  const [guessFeedback, setGuessFeedback] = useState<string | null>(null);
  const [guessing, setGuessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'leave' | 'close' | null>(null);
  const [actionPending, setActionPending] = useState<'leave' | 'close' | null>(null);
  const [gameModeOpen, setGameModeOpen] = useState(false);
  const isClosed = session.status === 'closed';
  const now = useClock(game?.phase === 'choosing' || game?.phase === 'drawing' || game?.phase === 'reveal');
  const remainingMs = Math.max(0, (game?.phaseEndsAt ?? now) - now);
  const roundPhaseKey = `${game?.round?.roundId ?? 'none'}:${game?.phase ?? 'loading'}`;

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1_800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    void roundPhaseKey;
    setChoosing(false);
    setGuess('');
    setGuessFeedback(null);
  }, [roundPhaseKey]);

  useEffect(() => {
    if (game?.phase !== 'lobby') setStarting(false);
  }, [game?.phase]);

  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setNotice(null);
    } catch {
      setNotice('Copy failed. Select the browser address to share this room.');
    }
  }

  async function handleStart() {
    setStarting(true);
    setNotice(null);
    try {
      await startGame({ roomId: session.roomId, sessionToken: guest.sessionToken });
    } catch (startError) {
      setNotice(userFacingError(startError, 'Doodle Dash could not be started.'));
      setStarting(false);
    }
  }

  async function handleChooseWord(optionIndex: number) {
    if (choosing) return;
    setChoosing(true);
    setNotice(null);
    try {
      await chooseWord({ roomId: session.roomId, sessionToken: guest.sessionToken, optionIndex });
    } catch (choiceError) {
      setNotice(userFacingError(choiceError, 'That word could not be selected.'));
      setChoosing(false);
    }
  }

  async function handleGuess(event: FormEvent) {
    event.preventDefault();
    if (guessing || !game?.canGuess || guess.trim() === '') return;
    const submittedGuess = guess;
    setGuess('');
    setGuessing(true);
    setGuessFeedback(null);
    try {
      const result = await submitGuess({
        roomId: session.roomId,
        sessionToken: guest.sessionToken,
        guess: submittedGuess,
      });
      if (result.kind === 'close') setGuessFeedback('Very close — check your spelling.');
      if (result.kind === 'correct') setGuessFeedback(`You got it! +${formatPoints(result.pointsAwarded)}`);
    } catch (guessError) {
      setGuess((currentGuess) => (currentGuess === '' ? submittedGuess : currentGuess));
      setGuessFeedback(userFacingError(guessError, 'Your guess could not be sent.'));
    } finally {
      setGuessing(false);
    }
  }

  async function handleConfigure(categories: string[], roundCount: number, drawDurationMs: number) {
    await configureGame({
      roomId: session.roomId,
      sessionToken: guest.sessionToken,
      categories,
      roundCount,
      drawDurationMs,
    });
  }

  async function handleLeave() {
    setConfirmation(null);
    setActionPending('leave');
    try {
      await leaveRoom({ code: session.code, sessionToken: guest.sessionToken });
      navigate('/');
    } catch (leaveError) {
      setNotice(userFacingError(leaveError, 'The room could not be left.'));
      setActionPending(null);
    }
  }

  async function handleClose() {
    setConfirmation(null);
    setActionPending('close');
    try {
      await closeRoom({ code: session.code, sessionToken: guest.sessionToken });
      setNotice('Room closed. The final standings stay visible.');
      setActionPending(null);
    } catch (closeError) {
      setNotice(userFacingError(closeError, 'The room could not be closed.'));
      setActionPending(null);
    }
  }

  if (game === undefined) {
    return (
      <main className="grid min-h-dvh place-content-center bg-[#f4efe6] text-center text-[#746958]">
        <Paintbrush className="mx-auto mb-4 size-13 text-[#3155d9]" aria-hidden="true" />
        <LoaderCircle className="mx-auto size-5 animate-spin" aria-hidden="true" />
        <p className="text-xs font-bold">Opening the sketchbook…</p>
      </main>
    );
  }

  const members = getRoomMembers(session);
  const ownerName = members.find((member) => member.isOwner)?.displayName ?? 'The room owner';
  const showLobbyPlayers = game.phase === 'lobby' || game.phase === 'complete';

  return (
    <div className="min-h-dvh bg-[#f4efe6] bg-[radial-gradient(circle_at_84%_14%,rgb(49_85_217/10%)_0_12rem,transparent_27rem),linear-gradient(rgb(80_69_51/5%)_1px,transparent_1px)] bg-size-[auto,auto_32px] text-[#142747]">
      <header className="sticky top-0 z-20 grid h-18 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#d3c8b8] bg-[rgb(255_253_247/92%)] px-5 backdrop-blur-[15px] max-[760px]:h-16 max-[760px]:px-3">
        <Link
          className="inline-flex items-center gap-2.5 font-display text-lg font-extrabold tracking-[-0.035em] text-[#142747] no-underline"
          to="/"
          aria-label="Xup Games home"
        >
          <span
            className="grid size-8.5 -rotate-4 place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#142747] bg-[#3155d9] text-lg leading-none text-white shadow-[3px_3px_0_#142747] max-[760px]:size-7.5"
            aria-hidden="true"
          >
            X
          </span>
          <span className="max-[760px]:hidden">Doodle Dash</span>
        </Link>
        <Button
          className="-rotate-1 justify-self-center px-4 text-[10px] tracking-[0.12em] max-[760px]:px-2.5 max-[760px]:text-[8px]"
          variant="sunny"
          size="sm"
          type="button"
          onClick={copyRoomLink}
          aria-label="Copy room link"
        >
          ROOM {session.code} {copied ? <Check /> : <Copy />}
        </Button>
        <div className="flex items-center justify-end gap-2">
          <GameModeControl
            roomId={session.roomId}
            currentGameId={session.currentGameId}
            currentGameType={session.gameType}
            sessionToken={guest.sessionToken}
            isOwner={session.isOwner}
            isClosed={isClosed}
            onOpen={() => setGameModeOpen(true)}
          />
          {session.isOwner && !isClosed && isLocalhost() ? (
            <Button asChild variant="paper" size="sm" className="max-[760px]:w-9 max-[760px]:px-0 [&_svg]:size-3.75">
              <Link to={`/admin/${session.code}`}>
                <Beaker aria-hidden="true" />
                <span className="max-[760px]:hidden">Playtest</span>
              </Link>
            </Button>
          ) : null}
          <RoomHeaderActions
            isOwner={session.isOwner}
            isClosed={isClosed}
            pendingAction={actionPending}
            onRequestLeave={() => setConfirmation('leave')}
            onRequestClose={() => setConfirmation('close')}
          />
        </div>
      </header>

      <main
        className={cn(
          showLobbyPlayers
            ? GAME_LOBBY_FRAME_CLASS
            : 'mx-auto min-h-[calc(100dvh-72px)] w-full max-w-400 p-4 max-[760px]:min-h-[calc(100dvh-64px)] max-[760px]:p-2.5'
        )}
      >
        <div className={cn('min-w-0', showLobbyPlayers && GAME_LOBBY_GRID_CLASS)}>
          <section className="min-w-0">
            <GameModeContent
              roomId={session.roomId}
              currentGameId={session.currentGameId}
              currentGameType={session.gameType}
              sessionToken={guest.sessionToken}
              isOwner={session.isOwner}
              isClosed={isClosed}
              open={gameModeOpen}
              onClose={() => setGameModeOpen(false)}
            >
              <GameSurfaceTransition
                showResults={game.phase === 'complete'}
                results={({ playIntro }) => (
                  <CompletePanel
                    game={game}
                    session={session}
                    sessionToken={guest.sessionToken}
                    playIntro={playIntro}
                  />
                )}
              >
                {game.phase === 'lobby' ? (
                  <LobbyPanel
                    game={game}
                    isOwner={session.isOwner}
                    ownerName={ownerName}
                    playerCount={session.activeMemberCount}
                    starting={starting}
                    isClosed={isClosed}
                    onStart={handleStart}
                    onCopy={copyRoomLink}
                    onConfigure={handleConfigure}
                  />
                ) : (
                  <ActiveBoard
                    game={game}
                    liveStrokeChunks={liveStrokeChunks ?? []}
                    remainingMs={remainingMs}
                    onlineByMemberId={onlineByMemberId}
                    guess={guess}
                    guessing={guessing}
                    guessFeedback={guessFeedback}
                    choosing={choosing}
                    onGuessChange={setGuess}
                    onGuess={handleGuess}
                    onChooseWord={handleChooseWord}
                    onCanvasError={(canvasError) =>
                      setNotice(userFacingError(canvasError, 'The canvas could not be updated.'))
                    }
                    onAppend={async (stroke) => {
                      return await appendStroke({
                        roomId: session.roomId,
                        sessionToken: guest.sessionToken,
                        ...stroke,
                      });
                    }}
                    onStream={async (chunk) => {
                      await streamStrokeChunk({
                        roomId: session.roomId,
                        sessionToken: guest.sessionToken,
                        ...chunk,
                      });
                    }}
                    onUndo={async () => {
                      await undoStroke({ roomId: session.roomId, sessionToken: guest.sessionToken });
                    }}
                    onRedo={async () => {
                      await redoStroke({ roomId: session.roomId, sessionToken: guest.sessionToken });
                    }}
                    onClear={async () => {
                      await clearCanvas({ roomId: session.roomId, sessionToken: guest.sessionToken });
                    }}
                  />
                )}
              </GameSurfaceTransition>
            </GameModeContent>
          </section>

          {showLobbyPlayers ? (
            <LobbyPlayersSidebar
              members={members}
              activeMemberCount={session.activeMemberCount}
              currentMemberId={session.currentMember.memberId}
              onlineByMemberId={onlineByMemberId}
              readyLabel={game.phase === 'complete' ? 'Ready to vote' : 'Ready to play'}
              copied={copied}
              onInvite={copyRoomLink}
            />
          ) : null}
        </div>
      </main>

      {notice ? (
        <div
          className="fixed right-4 bottom-4 z-30 max-w-90 rounded-[11px_7px_12px_8px] border border-[#142747] bg-[#142747] px-4 py-3 text-sm font-[720] text-white shadow-[5px_5px_0_rgb(20_39_71/22%)]"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <AlertDialog open={confirmation !== null} onOpenChange={(open) => !open && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>
            {confirmation === 'close' ? 'Close this Doodle Dash room?' : 'Leave this room?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation === 'close'
              ? 'The room stops accepting play, but everyone can still see the final board.'
              : 'Your score remains in the standings, but you will be removed from the active game.'}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction onClick={() => void (confirmation === 'close' ? handleClose() : handleLeave())}>
              {confirmation === 'close' ? 'Close room' : 'Leave room'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LobbyPanel({
  game,
  isOwner,
  ownerName,
  playerCount,
  starting,
  isClosed,
  onStart,
  onCopy,
  onConfigure,
}: {
  game: GameView;
  isOwner: boolean;
  ownerName: string;
  playerCount: number;
  starting: boolean;
  isClosed: boolean;
  onStart: () => void;
  onCopy: () => void;
  onConfigure: (categories: string[], roundCount: number, drawDurationMs: number) => Promise<void>;
}) {
  const categorySummary =
    game.configuration.categories.length === game.configuration.availableCategories.length
      ? 'All word categories'
      : game.configuration.categories.join(', ');

  return (
    <section
      className={cn(
        'relative flex w-full flex-col overflow-hidden rounded-[24px_13px_27px_16px] border border-[#bdc9dc] bg-[#fffdf7] shadow-[8px_9px_0_#d4ddeb]',
        GAME_LOBBY_CARD_HEIGHT_CLASS
      )}
    >
      <div
        className="pointer-events-none absolute -top-20 right-[8%] size-80 rotate-12 rounded-[36px_19px_40px_23px] bg-[#dfe7ff]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-[18%] right-[18%] size-26 -rotate-8 rounded-full border-2 border-dashed border-[#3155d9]/25"
        aria-hidden="true"
      />

      <div className="relative z-1 flex flex-1 flex-col items-start justify-center px-[clamp(34px,7vw,92px)] pt-[clamp(42px,7vw,78px)] pb-8 max-[760px]:px-6 max-[760px]:pt-16">
        <p className="mb-3 text-[10px] font-[850] tracking-[0.16em] text-[#2748bd] uppercase">
          Draw fast · Guess faster
        </p>
        <h1 className="m-0 max-w-190 font-display text-[clamp(66px,10vw,108px)] leading-[0.77] font-[900] tracking-[-0.075em] text-[#142747] max-[520px]:text-[clamp(58px,20vw,82px)]">
          Doodle
          <br />
          <span className="text-[#3155d9]">Dash.</span>
        </h1>

        <div className="my-7 flex flex-wrap gap-x-7 gap-y-3 border-y border-[#d5dce8] py-4 text-[11px] font-[650] text-[#748096] [&_strong]:mr-1 [&_strong]:text-[15px] [&_strong]:text-[#142747]">
          <span>
            <strong>{playerCount}</strong> {playerCount === 1 ? 'player' : 'players'} ready
          </span>
          <span>
            <strong>{game.configuration.roundCount}</strong> {game.configuration.roundCount === 1 ? 'round' : 'rounds'}{' '}
            each
          </span>
          <span>
            <strong>{game.configuration.drawDurationMs / 1_000}s</strong> drawing time
          </span>
          <span>
            <strong>~{game.configuration.estimatedMinutes} min</strong> for this lobby
          </span>
        </div>

        {isClosed ? (
          <p className="m-0 rounded-[10px_6px_11px_7px] border border-[#cbd3e0] bg-[#eef1f6] px-4 py-3 text-xs font-bold text-[#667186]">
            This room is closed.
          </p>
        ) : isOwner ? (
          <Button
            className="h-13.5 min-w-50 disabled:cursor-wait"
            type="button"
            variant="brand"
            size="xl"
            onClick={onStart}
            disabled={starting || playerCount < 2}
          >
            {starting ? <LoaderCircle className="animate-spin" /> : <Play />}
            {starting ? 'Opening sketchbook…' : playerCount < 2 ? 'Waiting for one more player' : 'Start Doodle Dash'}
          </Button>
        ) : (
          <p className="m-0 rounded-[10px_6px_11px_7px] border border-[#cbd3e0] bg-[#eef1f6] px-4 py-3 text-xs font-bold text-[#667186]">
            Waiting for {ownerName} to start
          </p>
        )}

        {!isClosed ? (
          <Button className="mt-4.5" type="button" variant="paper" size="sm" onClick={onCopy}>
            <Copy /> Copy invite link
          </Button>
        ) : null}
      </div>

      <section
        className="relative z-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-[#d5dce8] bg-[rgb(239_243_252/88%)] px-[clamp(24px,4vw,48px)] py-4.5 max-[520px]:grid-cols-1 max-[520px]:gap-3.5"
        aria-label="Doodle Dash game configuration"
      >
        <div className="min-w-0">
          <h2 className="m-0 text-[11px] font-[850] tracking-[0.12em] text-[#2748bd] uppercase">Game setup</h2>
          <p className="mt-1.5 mb-0 truncate text-xs leading-5 text-[#667186] max-[520px]:whitespace-normal">
            <strong className="text-[#34445d]">
              {game.configuration.roundCount} {game.configuration.roundCount === 1 ? 'round' : 'rounds'} each
            </strong>
            {' · '}
            {game.configuration.drawDurationMs / 1_000}s drawing
            {' · '}About {game.configuration.estimatedMinutes} min for {playerCount}{' '}
            {playerCount === 1 ? 'player' : 'players'}
            {' · '}
            <span title={game.configuration.categories.join(', ')}>{categorySummary}</span>
          </p>
        </div>
        {isOwner && !isClosed ? (
          <DoodleDashConfigurationDialog
            configuration={game.configuration}
            playerCount={playerCount}
            onSave={onConfigure}
          />
        ) : null}
      </section>
    </section>
  );
}

function ActiveBoard({
  game,
  liveStrokeChunks,
  remainingMs,
  onlineByMemberId,
  guess,
  guessing,
  guessFeedback,
  choosing,
  onGuessChange,
  onGuess,
  onChooseWord,
  onCanvasError,
  onAppend,
  onStream,
  onUndo,
  onRedo,
  onClear,
}: {
  game: GameView;
  liveStrokeChunks: NonNullable<FunctionReturnType<typeof api.doodleDash.listLiveStrokeChunks>>;
  remainingMs: number;
  onlineByMemberId: Map<string, boolean>;
  guess: string;
  guessing: boolean;
  guessFeedback: string | null;
  choosing: boolean;
  onGuessChange: (guess: string) => void;
  onGuess: (event: FormEvent) => void;
  onChooseWord: (optionIndex: number) => void;
  onCanvasError: (error: unknown) => void;
  onAppend: Parameters<typeof DoodleDashCanvas>[0]['onAppend'];
  onStream: Parameters<typeof DoodleDashCanvas>[0]['onStream'];
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const round = game.round;
  const orderKey = game.leaderboard.map((entry) => entry.memberId).join('|');
  const setLeaderboardRef = useListReorderAnimation(orderKey);
  if (round === null) return null;
  return (
    <section className="grid min-h-0 grid-cols-[300px_minmax(430px,1fr)_300px] items-start gap-4.5 max-[1120px]:grid-cols-[minmax(0,1fr)_300px] max-[760px]:grid-cols-1">
      <StandingsPanel game={game} onlineByMemberId={onlineByMemberId} setItemRef={setLeaderboardRef} />
      <div className="order-2 grid min-h-0 gap-3 max-[1120px]:order-1" data-slot="doodle-dash-center-stack">
        <section
          className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[12px_7px_13px_8px] border border-[#c8b9a6] bg-[#f5efe6] px-4 py-3 shadow-[4px_5px_0_#ded2c2] max-[560px]:grid-cols-[1fr_auto]"
          aria-label="Round status"
          data-slot="doodle-dash-status-card"
        >
          <div className="min-w-0">
            <p className="text-[9px] font-[850] tracking-[0.12em] text-[#2748bd] uppercase">
              Round {round.roundNumber} · Turn {round.turnNumber}/{round.totalTurns}
            </p>
            <strong className="block truncate text-sm">
              {round.isDrawer ? 'Your turn to draw' : `${round.drawerDisplayName} is drawing`}
            </strong>
          </div>
          <div className="min-w-0 text-center max-[560px]:col-span-2 max-[560px]:row-start-2">
            {game.phase === 'choosing' ? (
              <strong className="font-mono text-sm tracking-[0.08em] text-[#867a69]">CHOOSING A WORD</strong>
            ) : (
              <>
                <p className="mb-1 text-[9px] font-[800] tracking-[0.1em] text-[#9c8e7a] uppercase">
                  {round.category ?? 'Secret word'} · {round.wordLengths.join(' + ')} letters
                </p>
                <strong className="block max-w-full overflow-hidden font-mono text-[clamp(14px,2.1vw,25px)] tracking-normal text-ellipsis whitespace-nowrap text-[#142747] [word-spacing:-0.3em]">
                  {round.word?.toUpperCase() ?? round.hint ?? '—'}
                </strong>
              </>
            )}
          </div>
          {game.phase === 'choosing' ? (
            <div aria-hidden="true" />
          ) : (
            <div className="justify-self-end text-right">
              <p className="text-[9px] font-[850] tracking-[0.12em] text-[#2748bd] uppercase">
                {game.phase === 'reveal' ? 'Next turn' : 'Time left'}
              </p>
              <strong className="font-mono text-xl text-[#e74f45] tabular-nums">{formatTimer(remainingMs)}</strong>
            </div>
          )}
        </section>

        <div className="relative min-h-0">
          <DoodleDashCanvas
            key={round.roundId}
            strokes={round.strokes}
            liveStrokes={liveStrokeChunks}
            canDraw={round.isDrawer && game.phase === 'drawing'}
            showTools={round.isDrawer}
            canUndo={round.canUndo}
            canRedo={round.canRedo}
            onAppend={onAppend}
            onStream={onStream}
            onUndo={onUndo}
            onRedo={onRedo}
            onClear={onClear}
            onError={onCanvasError}
          />
          {game.phase === 'choosing' ? (
            <div className="absolute inset-0 z-10 grid place-items-center rounded-[11px_17px_10px_15px] bg-[rgb(255_253_247/94%)] p-5 backdrop-blur-[4px]">
              {round.isDrawer ? (
                <div className="w-full max-w-180 text-center">
                  <div className="mb-2 flex flex-wrap items-center justify-center gap-2.5">
                    <p className="m-0 text-[10px] font-[850] tracking-[0.15em] text-[#2748bd] uppercase">
                      Pick your prompt
                    </p>
                    <div
                      className="inline-flex items-baseline gap-1.5 rounded-[9px_6px_10px_7px] border border-[#e0b345] bg-[#fff1bd] px-2.5 py-1 text-[#7f481e] shadow-[2px_2px_0_#e2c067]"
                      role="timer"
                      aria-label="Time left to choose"
                    >
                      <span className="text-[9px] font-[850] tracking-[0.08em] uppercase">Pick in</span>
                      <strong className="font-mono text-lg leading-none tabular-nums">
                        {formatTimer(remainingMs)}s
                      </strong>
                    </div>
                  </div>
                  <h2 className="mt-0 mb-5 font-display text-[clamp(32px,5vw,60px)] leading-[0.95] tracking-[-0.05em]">
                    What will you draw?
                  </h2>
                  <div className="grid grid-cols-3 gap-3 max-[560px]:grid-cols-1">
                    {round.wordOptions.map((option) => (
                      <Button
                        type="button"
                        variant="choice"
                        className="min-h-28 flex-col justify-center gap-2 p-4 text-center"
                        key={option.optionIndex}
                        disabled={choosing}
                        onClick={() => onChooseWord(option.optionIndex)}
                      >
                        <strong className="text-[clamp(16px,2vw,22px)] text-[#142747]">{option.word}</strong>
                        <span className="text-[9px] font-[820] tracking-[0.1em] text-[#2748bd] uppercase">
                          {option.category}
                        </span>
                      </Button>
                    ))}
                  </div>
                  <p className="mt-5 text-xs text-[#817564]">
                    A random option is selected when the timer reaches zero.
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <LoaderCircle className="mx-auto mb-4 size-9 animate-spin text-[#3155d9]" />
                  <h2 className="m-0 font-display text-[clamp(30px,5vw,56px)] tracking-[-0.05em]">
                    {round.drawerDisplayName} is choosing…
                  </h2>
                  <div
                    className="mx-auto mt-4 inline-flex items-baseline gap-1.5 rounded-[9px_6px_10px_7px] border border-[#e0b345] bg-[#fff1bd] px-3 py-1.5 text-[#7f481e] shadow-[2px_2px_0_#e2c067]"
                    role="timer"
                    aria-label="Time left to choose"
                  >
                    <span className="text-[9px] font-[850] tracking-[0.08em] uppercase">Choosing</span>
                    <strong className="font-mono text-lg leading-none tabular-nums">{formatTimer(remainingMs)}s</strong>
                  </div>
                  <p className="mt-3 text-sm text-[#776c5c]">Keep your eyes on the canvas.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
      <GuessPanel
        game={game}
        guess={guess}
        guessing={guessing}
        feedback={guessFeedback}
        onGuessChange={onGuessChange}
        onGuess={onGuess}
      />
    </section>
  );
}

function StandingsPanel({
  game,
  onlineByMemberId,
  setItemRef,
}: {
  game: GameView;
  onlineByMemberId: Map<string, boolean>;
  setItemRef: (key: string, element: HTMLElement | null) => void;
}) {
  const currentPlayer = game.leaderboard.find((entry) => entry.isCurrentPlayer) ?? null;
  return (
    <aside
      className={cn(
        'order-1 flex flex-col overflow-hidden rounded-[15px_8px_17px_10px] border border-[#c8b9a6] bg-[#fffdf7] shadow-[4px_5px_0_#ded2c2] max-[1120px]:order-3 max-[1120px]:col-span-2 max-[1120px]:h-auto max-[1120px]:max-h-90 max-[760px]:col-span-1',
        GAME_STANDINGS_SIDEBAR_HEIGHT_CLASS
      )}
      data-slot="doodle-dash-standings-card"
    >
      <div className="mx-3 flex items-center justify-between border-b border-[#e4d9ca] pt-4 pb-3">
        <div>
          <p className="text-[9px] font-[850] tracking-[0.12em] text-[#2748bd]">LIVE TABLE</p>
          <h2 className="m-0 font-display text-2xl tracking-[-0.045em]">Standings</h2>
        </div>
        <UsersRound className="size-5 text-[#3155d9]" />
      </div>
      {currentPlayer ? (
        <div className="mx-3 my-3 rounded-[10px_6px_11px_7px] bg-[#142747] px-3 py-2.5 text-white">
          <span className="text-[10px] font-[760] text-[#aab8cc]">Your score</span>
          <strong className="float-right text-xl text-[#f4cd54] tabular-nums">
            {formatPoints(currentPlayer.totalPoints)}
          </strong>
        </div>
      ) : null}
      <ScrollArea className="min-h-0" type="always">
        <ol className="m-0 grid list-none gap-1.5 p-3 pt-0" aria-label="Player standings">
          {game.leaderboard.map((entry) => {
            const disconnected = entry.isActive && onlineByMemberId.get(entry.memberId) === false;
            return (
              <li
                key={entry.memberId}
                ref={(element) => setItemRef(entry.memberId, element)}
                className={cn(
                  'grid min-h-12 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-[8px_4px_9px_5px] px-2 py-1.5 text-xs text-[#675e51] data-[current=true]:bg-[#edf1ff]',
                  !entry.isActive && 'opacity-45 grayscale'
                )}
                data-current={entry.isCurrentPlayer}
              >
                <span className="grid size-6 place-items-center font-[850] text-[#9c8e7b]">
                  {entry.rank <= 3 ? <Medal className="size-3.5 text-[#d19e18]" /> : entry.rank}
                </span>
                <span className="min-w-0">
                  <strong className="flex items-center gap-1 truncate text-[#263951]">
                    {entry.displayName}
                    {entry.isDrawer ? <Paintbrush className="size-3 text-[#3155d9]" /> : null}
                    {entry.hasGuessedCurrentWord ? <Check className="size-3 text-[#16856b]" /> : null}
                  </strong>
                  <small className="block truncate text-[9px] text-[#9a8e7c]">
                    {!entry.isActive ? 'Left' : disconnected ? 'Disconnected' : `${entry.wordsGuessed} guessed`}
                  </small>
                </span>
                <span className="text-right">
                  <strong className="block tabular-nums">{formatPoints(entry.totalPoints)}</strong>
                  {entry.pointsGained ? (
                    <small className="text-[9px] font-[850] text-[#16856b]">+{entry.pointsGained}</small>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </ScrollArea>
    </aside>
  );
}

function GuessPanel({
  game,
  guess,
  guessing,
  feedback,
  onGuessChange,
  onGuess,
}: {
  game: GameView;
  guess: string;
  guessing: boolean;
  feedback: string | null;
  onGuessChange: (guess: string) => void;
  onGuess: (event: FormEvent) => void;
}) {
  const messageLogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const round = game.round;
  const messageCount = round?.messages.length ?? 0;
  useLayoutEffect(() => {
    void messageCount;
    const messageLog = messageLogRef.current;
    if (messageLog !== null) messageLog.scrollTop = messageLog.scrollHeight;
  }, [messageCount]);
  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (
        !game.canGuess ||
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key.length !== 1 ||
        document.activeElement === inputRef.current ||
        document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
      ) {
        return;
      }

      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
      onGuessChange(`${guess}${event.key}`.slice(0, 80));
    }

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [game.canGuess, guess, onGuessChange]);
  if (round === null) return null;
  const currentPlayer = game.leaderboard.find((entry) => entry.isCurrentPlayer) ?? null;
  const placeholder = !game.isParticipant
    ? 'Playing next game'
    : game.phase === 'choosing'
      ? 'Waiting for the word'
      : game.phase === 'reveal'
        ? 'Next turn starting'
        : round.isDrawer
          ? 'You are drawing'
          : game.canGuess
            ? 'Type your guess…'
            : currentPlayer?.hasGuessedCurrentWord
              ? 'You got the word!'
              : 'Guessing is closed';
  return (
    <aside
      className="order-3 flex h-[calc(100dvh-104px)] min-h-0 flex-col self-start overflow-hidden rounded-[15px_8px_17px_10px] border border-[#c8b9a6] bg-[#fffdf7] shadow-[4px_5px_0_#ded2c2] max-[1120px]:order-2 max-[760px]:h-105"
      data-slot="doodle-dash-guesses-card"
    >
      <div className="mx-3 flex items-center justify-between border-b border-[#e4d9ca] pt-4 pb-3">
        <div>
          <p className="text-[9px] font-[850] tracking-[0.12em] text-[#2748bd]">ROOM FEED</p>
          <h2 className="m-0 font-display text-2xl tracking-[-0.045em]">Guesses</h2>
        </div>
        <MessageCircle className="size-5 text-[#3155d9]" />
      </div>
      <div
        ref={messageLogRef}
        className="min-h-30 flex-1 overflow-y-auto px-3 py-3 [overscroll-behavior:contain]"
        role="log"
        aria-label="Room guesses"
        aria-live="polite"
      >
        {round.messages.length === 0 ? (
          <p className="mt-8 text-center text-xs text-[#9a8e7c]">No guesses yet. Someone has to go first.</p>
        ) : null}
        <div className="grid gap-2">
          {round.messages.map((message) => (
            <div
              className={cn(
                'rounded-[9px_5px_10px_6px] px-2.5 py-2 text-xs',
                message.kind === 'correct'
                  ? 'bg-[#dff5e9] text-[#15704f]'
                  : message.isCurrentPlayer
                    ? 'bg-[#eef1fb] text-[#3c4d73]'
                    : 'bg-[#f4efe7] text-[#61594e]'
              )}
              key={message.messageId}
            >
              {message.kind === 'correct' ? (
                <p className="m-0 flex items-center gap-1.5 font-[820]">
                  <Check className="size-3.5" /> {message.displayName} got the answer!
                </p>
              ) : (
                <>
                  <p className="m-0">
                    <strong>{message.displayName}</strong> <span className="wrap-break-word">{message.text}</span>
                  </p>
                  {message.isClose ? <p className="mt-1 mb-0 font-[850] text-[#d15345]">You’re very close!</p> : null}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <form className="border-t border-[#e4d9ca] bg-[#f8f3eb] p-3" onSubmit={onGuess}>
        {feedback ? (
          <p className="mb-2 rounded-md bg-[#fff3c9] px-2.5 py-2 text-[10px] font-[800] text-[#795e18]" role="status">
            {feedback}
          </p>
        ) : null}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="h-10 min-w-0 flex-1 rounded-[9px_5px_10px_6px] border border-[#cfc2b0] bg-white px-3 text-sm outline-none placeholder:text-[#a79b89] focus:border-[#3155d9] focus:ring-3 focus:ring-[#3155d9]/15 disabled:bg-[#eee8df]"
            value={guess}
            maxLength={80}
            placeholder={placeholder}
            aria-label="Your guess"
            disabled={!game.canGuess}
            onChange={(event) => onGuessChange(event.target.value)}
          />
          <Button
            type="submit"
            variant="brand-compact"
            size="icon-lg"
            aria-label="Send guess"
            disabled={!game.canGuess || guessing || guess.trim() === ''}
          >
            {guessing ? <LoaderCircle className="animate-spin" /> : <Send />}
          </Button>
        </div>
        {round.isDrawer ? (
          <p className="mt-2 mb-0 flex items-center gap-1 text-[9px] text-[#8c806e]">
            <Eye className="size-3" /> Correct words are hidden from this feed.
          </p>
        ) : null}
      </form>
    </aside>
  );
}

function CompletePanel({
  game,
  session,
  sessionToken,
  playIntro,
}: {
  game: GameView;
  session: ActiveSession;
  sessionToken: string;
  playIntro: boolean;
}) {
  const eligible = game.leaderboard.filter((entry) => entry.isActive);
  const winner = eligible[0] ?? null;
  return (
    <PostGameBoard
      eyebrow={`Game ${game.gameNumber} complete`}
      title={winner ? `${winner.displayName} takes the sketchbook.` : 'Doodles down.'}
      detail="Fast guesses and drawings that helped the room both counted toward the final table."
      icon={Trophy}
      accent="#3155d9"
      accentTint="#ffe2dc"
      roomId={session.roomId}
      currentGameId={session.currentGameId}
      currentGameType={session.gameType}
      sessionToken={sessionToken}
      isOwner={session.isOwner}
      isClosed={session.status === 'closed'}
      closedMessage="The room is closed. These standings are final."
      playIntro={playIntro}
      summary={
        <div className="grid gap-5">
          <PostGamePodium
            entries={eligible.slice(0, 3).map((entry, index) => ({
              id: entry.memberId,
              place: index + 1,
              name: entry.displayName,
              result: `${formatPoints(entry.totalPoints)} pts`,
            }))}
            label="Doodle Dash podium"
            animate={playIntro}
          />
          <div className="grid grid-cols-3 gap-2 max-[560px]:grid-cols-1">
            {eligible.slice(0, 3).map((entry) => (
              <div
                className="rounded-[11px_7px_12px_8px] border border-[#d5c8b8] bg-white p-3 text-center"
                key={entry.memberId}
              >
                <strong className="block text-lg text-[#142747]">{entry.wordsGuessed}</strong>
                <span className="text-[10px] text-[#817565]">
                  words guessed · {formatPoints(entry.drawPoints)} draw pts
                </span>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
