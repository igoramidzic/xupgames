import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  Beaker,
  BrainCircuit,
  Check,
  Copy,
  DoorOpen,
  Flame,
  LoaderCircle,
  LockKeyhole,
  Medal,
  Play,
  Timer,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GameModeControl, { GameModeContent } from '@/components/GameModeControl';
import GameSurfaceTransition from '@/components/GameSurfaceTransition';
import PostGameBoard, { PostGamePodium } from '@/components/PostGameBoard';
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
import type { GuestIdentity } from '@/lib/guest';
import { getRoomMembers } from '@/lib/roomSession';
import { useListReorderAnimation } from '@/lib/useListReorderAnimation';
import { useRoomPresence } from '@/lib/useRoomPresence';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';
import TriviaConfigurationDialog from './TriviaConfigurationDialog';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const ANSWER_DURATION_MS = 15_000;
const COUNTDOWN_DURATION_MS = 3_000;
const REVEAL_DURATION_MS = 7_000;

function useClock(enabled: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) {
      return;
    }
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [enabled]);
  return now;
}

function formatPoints(points: number) {
  return new Intl.NumberFormat('en-US').format(points);
}

function completedRoundCount(phase: GameView['phase'], currentQuestionNumber: number): number {
  if (phase === 'question') {
    return Math.max(0, currentQuestionNumber - 1);
  }
  if (phase === 'reveal' || phase === 'complete') {
    return currentQuestionNumber;
  }
  return 0;
}

export default function TriviaRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  const navigate = useNavigate();
  const game = useQuery(api.trivia.getGame, { roomId: session.roomId, sessionToken: guest.sessionToken });
  const startGame = useMutation(api.trivia.startGame);
  const submitAnswer = useMutation(api.trivia.submitAnswer);
  const configureGame = useMutation(api.trivia.configureGame);
  const leaveRoom = useMutation(api.rooms.leave);
  const closeRoom = useMutation(api.rooms.close);
  const { onlineByMemberId } = useRoomPresence({ roomId: session.roomId, sessionToken: guest.sessionToken });
  const [pendingAnswer, setPendingAnswer] = useState<{
    gameNumber: number;
    questionNumber: number;
    optionIndex: number;
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'leave' | 'close' | null>(null);
  const [actionPending, setActionPending] = useState<'leave' | 'close' | null>(null);
  const [gameModeOpen, setGameModeOpen] = useState(false);
  const timerEnabled = game?.phase === 'countdown' || game?.phase === 'question' || game?.phase === 'reveal';
  const now = useClock(timerEnabled);
  const isClosed = session.status === 'closed';

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => setCopied(false), 1_800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (game?.phase === 'countdown' || game?.phase === 'question' || game?.phase === 'reveal') {
      setStarting(false);
    }
  }, [game?.phase]);

  const members = getRoomMembers(session);
  const ownerName = members.find((member) => member.isOwner)?.displayName ?? 'The room owner';
  const currentPlayer = game?.leaderboard.find((entry) => entry.isCurrentPlayer) ?? null;
  const completedRounds = game ? completedRoundCount(game.phase, game.currentQuestionNumber) : 0;
  const phaseDuration =
    game?.phase === 'countdown'
      ? COUNTDOWN_DURATION_MS
      : game?.phase === 'question'
        ? ANSWER_DURATION_MS
        : REVEAL_DURATION_MS;
  const remainingMs = Math.max(0, (game?.phaseEndsAt ?? now) - now);
  const timeProgress = game?.phaseEndsAt === null ? 0 : Math.min(1, remainingMs / phaseDuration);
  const pendingOptionForCurrentRound =
    pendingAnswer !== null &&
    game !== undefined &&
    pendingAnswer.gameNumber === game.gameNumber &&
    pendingAnswer.questionNumber === game.currentQuestionNumber
      ? pendingAnswer.optionIndex
      : null;
  const selectedOption = game?.playerAnswer?.selectedOptionIndex ?? pendingOptionForCurrentRound;
  const leaderboardOrderKey = game?.leaderboard.map((entry) => entry.memberId).join('|') ?? '';
  const setLeaderboardItemRef = useListReorderAnimation(leaderboardOrderKey);

  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setNotice(null);
    } catch {
      setNotice('Copy failed. Select the address in your browser to share this room.');
    }
  }

  async function handleStart() {
    setStarting(true);
    setNotice(null);
    try {
      await startGame({ roomId: session.roomId, sessionToken: guest.sessionToken });
    } catch (startError) {
      setNotice(userFacingError(startError, 'Trivia could not be started.'));
      setStarting(false);
    }
  }

  async function handleAnswer(optionIndex: number) {
    if (selectedOption !== null || game?.phase !== 'question') {
      return;
    }
    setPendingAnswer({
      gameNumber: game.gameNumber,
      questionNumber: game.currentQuestionNumber,
      optionIndex,
    });
    setNotice(null);
    try {
      await submitAnswer({
        roomId: session.roomId,
        sessionToken: guest.sessionToken,
        selectedOptionIndex: optionIndex,
      });
    } catch (answerError) {
      setNotice(userFacingError(answerError, 'Your answer could not be locked in.'));
      setPendingAnswer(null);
    }
  }

  async function handleConfigure(categories: string[], roundCount: number) {
    await configureGame({
      roomId: session.roomId,
      sessionToken: guest.sessionToken,
      categories,
      roundCount,
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
      setNotice('Room closed. The final scoreboard stays visible.');
      setActionPending(null);
    } catch (closeError) {
      setNotice(userFacingError(closeError, 'The room could not be closed.'));
      setActionPending(null);
    }
  }

  if (game === undefined) {
    return (
      <main className="grid min-h-dvh place-content-center bg-[#edf5fb] text-center text-[#52657f]">
        <BrainCircuit className="mx-auto mb-4.5 size-13.5 text-[#12a8d4]" aria-hidden="true" />
        <LoaderCircle className="mx-auto size-5 animate-spin" aria-hidden="true" />
        <p className="text-xs font-bold">Stacking the questions…</p>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-[#edf5fb] bg-[radial-gradient(circle_at_18%_20%,rgb(35_157_211/10%)_0_13rem,transparent_28rem),linear-gradient(rgb(35_74_116/7%)_1px,transparent_1px),linear-gradient(90deg,rgb(35_74_116/7%)_1px,transparent_1px)] bg-size-[auto,40px_40px,40px_40px,auto] font-trivia text-[#10213d]">
      <header className="sticky top-0 z-10 grid h-19 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#b9cada] bg-[rgb(244_249_253/92%)] px-5.5 backdrop-blur-[15px] max-[760px]:h-17 max-[760px]:px-3">
        <Link
          className="inline-flex items-center gap-2.75 font-display text-lg font-extrabold tracking-[-0.03em] text-[#17203a] no-underline"
          to="/"
          aria-label="Xup Games home"
        >
          <span
            className="grid size-8.5 -rotate-4 place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#17203a] bg-[#12a8d4] text-lg leading-none shadow-[3px_3px_0_#10213d] max-[760px]:size-7.5"
            aria-hidden="true"
          >
            X
          </span>
          <span className="max-[760px]:hidden">Xup Trivia</span>
        </Link>

        <Button
          className="-rotate-1 justify-self-center px-4 text-[10px] tracking-[0.12em] max-[760px]:w-fit max-[760px]:px-2.5 max-[760px]:text-[8px] [&_svg]:size-3.25"
          variant="trivia-code"
          size="sm"
          type="button"
          onClick={copyRoomLink}
          aria-label="Copy room link"
        >
          <span>ROOM {session.code}</span>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>

        <div className="flex items-center justify-end gap-2">
          <span className="mr-1 inline-flex items-center gap-2 text-xs font-bold text-[#4d5a72] max-[760px]:hidden">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                isClosed
                  ? 'bg-[#8b95a7] shadow-[0_0_0_4px_rgb(139_149_167/13%)]'
                  : 'bg-[#35b87f] shadow-[0_0_0_4px_rgb(53_184_127/13%)]'
              )}
            />{' '}
            {isClosed ? 'Closed' : 'Live'}
          </span>
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
            <Button asChild variant="paper" size="sm" className="max-[760px]:w-8.5 max-[760px]:px-0 [&_svg]:size-3.75">
              <Link to={`/admin/${session.code}`}>
                <Beaker aria-hidden="true" />
                <span className="max-[760px]:hidden">Playtest</span>
              </Link>
            </Button>
          ) : null}
          {session.isOwner && !isClosed ? (
            <Button
              variant="paper"
              size="sm"
              className="max-[760px]:w-8.5 max-[760px]:px-0 [&_svg]:size-3.75"
              type="button"
              onClick={() => setConfirmation('close')}
            >
              <LockKeyhole aria-hidden="true" />
              <span className="max-[760px]:hidden">Close room</span>
            </Button>
          ) : null}
          <Button
            variant="paper"
            size="sm"
            className="disabled:opacity-[.58] max-[760px]:w-8.5 max-[760px]:px-0 [&_svg]:size-3.75"
            type="button"
            onClick={() => setConfirmation('leave')}
            disabled={actionPending !== null}
          >
            {actionPending === 'leave' ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <DoorOpen />}
            <span className="max-[760px]:hidden">Leave</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100dvh-76px)] w-full max-w-345 grid-cols-[minmax(0,1fr)_300px] gap-4.5 p-4.5 [--trivia-question-min-height:clamp(560px,calc(100dvh-230px),720px)] max-[980px]:grid-cols-[minmax(0,1fr)_240px] max-[760px]:min-h-[calc(100dvh-68px)] max-[760px]:grid-cols-1 max-[760px]:p-2.25 max-[760px]:[--trivia-question-min-height:clamp(590px,calc(100dvh-180px),680px)]">
        <section className="grid min-h-0 min-w-0 place-items-stretch content-start" aria-live="polite">
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
                  leaderboard={game.leaderboard}
                  gameNumber={game.gameNumber}
                  session={session}
                  sessionToken={guest.sessionToken}
                  playIntro={playIntro}
                />
              )}
            >
              {game.phase === 'lobby' ? (
                <LobbyPanel
                  isOwner={session.isOwner}
                  ownerName={ownerName}
                  playerCount={session.activeMemberCount}
                  starting={starting}
                  isClosed={isClosed}
                  configuration={game.configuration}
                  onStart={handleStart}
                  onCopy={copyRoomLink}
                  onConfigure={handleConfigure}
                />
              ) : null}

              {game.phase === 'countdown' ? (
                <div className="relative flex h-[clamp(640px,calc(100dvh-112px),768px)] max-h-192 min-h-0 flex-col items-center justify-center overflow-hidden rounded-[24px_10px_26px_12px] border border-[#aebfd0] bg-[#10213d] p-[clamp(50px,7vw,100px)] text-center text-white shadow-[8px_9px_0_#ccdae6] max-[760px]:min-h-150 max-[760px]:px-6 max-[760px]:py-8.5">
                  <p className="m-0 text-[11px] font-extrabold tracking-[0.16em] text-[#67c9e8] uppercase">
                    Game {game.gameNumber}
                  </p>
                  <strong className="mt-4 mb-1.5 text-[clamp(150px,24vw,310px)] leading-[0.78] font-[850] tracking-[-0.1em] text-[#ffda55] tabular-nums [text-shadow:9px_9px_0_rgb(0_0_0/24%)]">
                    {Math.max(1, Math.ceil(remainingMs / 1_000))}
                  </strong>
                  <h1 className="mt-6.5 mb-2 text-[clamp(24px,4vw,48px)] tracking-[-0.04em]">
                    Eyes up. First question incoming.
                  </h1>
                  <span className="text-[13px] text-[#9eb2c9]">Fast and right beats merely right.</span>
                </div>
              ) : null}

              {game.phase === 'question' || game.phase === 'reveal' ? (
                <QuestionPanel
                  game={game}
                  remainingMs={remainingMs}
                  timeProgress={timeProgress}
                  selectedOption={selectedOption}
                  onAnswer={handleAnswer}
                />
              ) : null}
            </GameSurfaceTransition>
          </GameModeContent>
        </section>

        <aside className="flex h-[max(680px,calc(100dvh-112px))] min-h-0 flex-col self-start overflow-hidden rounded-[15px_7px_17px_9px] border border-[#aebfd0] bg-[rgb(250_252_254/96%)] shadow-[5px_6px_0_#ccdae6] max-[760px]:h-107.5 max-[760px]:min-h-107.5">
          <div className="mx-3 flex items-start justify-between border-b border-[#ced9e4] pt-5 pb-3.75">
            <div>
              <p className="mb-0.75 text-[10px] font-[850] tracking-[0.13em] text-[#0c86ae]">LIVE TABLE</p>
              <h2 className="m-0 text-[25px] tracking-[-0.045em] text-[#10213d]">Standings</h2>
            </div>
            <span className="inline-flex items-center gap-1.25 rounded-md bg-[#e7eff5] px-2 py-1.5 text-xs font-[760] text-[#53687d]">
              <UsersRound className="size-3.25" aria-hidden="true" /> {session.activeMemberCount}
            </span>
          </div>

          {currentPlayer ? (
            <div className="mx-3 my-4 grid grid-cols-[1fr_auto] rounded-[12px_6px_13px_7px] bg-[#10213d] p-3.5 text-white">
              <span className="text-xs font-bold text-[#91a7bf]">Your score</span>
              <strong className="col-start-2 row-start-1 row-end-3 self-center text-[28px] text-[#ffda55] tabular-nums">
                {formatPoints(currentPlayer.totalPoints)}
              </strong>
              <small className="text-xs font-bold text-[#91a7bf]">
                {currentPlayer.correctAnswers}/{completedRounds} correct
              </small>
            </div>
          ) : null}

          <ScrollArea
            className="min-h-25 flex-1 [--scroll-fade-reveal:72px] [--scroll-fade-size:30px]"
            viewportClassName="scroll-fade"
            scrollbarClassName="w-2 border-l-0 px-0.5 py-0.25"
            thumbClassName="bg-[#aeb8c2]"
            type="always"
          >
            <ol className="m-0 flex list-none flex-col gap-2 pt-3 pr-4 pb-7.5 pl-3" aria-label="Player standings">
              {game.leaderboard.map((entry) => {
                const isDisconnected = entry.isActive && onlineByMemberId.get(entry.memberId) === false;
                return (
                  <li
                    key={entry.memberId}
                    ref={(element) => setLeaderboardItemRef(entry.memberId, element)}
                    data-current={entry.isCurrentPlayer}
                    data-rank={entry.rank}
                    className={cn(
                      'relative grid min-h-13.5 grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2 rounded-[8px_4px_9px_5px] px-1.75 py-1.25 text-[#53677d] transition-opacity data-[current=true]:bg-[#e2f4fb] data-[current=true]:text-[#145b77] data-[reordering=true]:z-2 data-[reordering=true]:pointer-events-none',
                      !entry.isActive && 'opacity-45 grayscale'
                    )}
                  >
                    <span className="grid size-6.75 place-items-center text-sm font-extrabold text-[#8292a3]">
                      {!entry.isActive ? (
                        '—'
                      ) : entry.rank <= 3 ? (
                        <Medal className="size-4 text-[#d2a411]" aria-hidden="true" />
                      ) : (
                        entry.rank
                      )}
                    </span>
                    <span className="grid min-w-0">
                      <strong className="overflow-hidden text-sm text-ellipsis whitespace-nowrap text-[#253a52]">
                        {entry.displayName}
                      </strong>
                      <small className="flex items-center gap-1.75 text-[11px] text-[#8897a8]">
                        {!entry.isActive ? 'Left' : isDisconnected ? 'Disconnected' : `${entry.correctAnswers} right`}
                        {entry.isActive && !isDisconnected && entry.bestStreak >= 2 ? (
                          <em className="inline-flex items-center gap-0.5 font-extrabold not-italic text-[#e15a42]">
                            <Flame className="size-2.25" aria-hidden="true" /> {entry.bestStreak}
                          </em>
                        ) : null}
                      </small>
                    </span>
                    <span className="grid justify-items-end">
                      <strong className="text-sm text-[#223950] tabular-nums">{formatPoints(entry.totalPoints)}</strong>
                      {game.phase === 'reveal' && entry.pointsGained !== null && entry.pointsGained > 0 ? (
                        <small className="animate-in whitespace-nowrap text-[11px] font-[850] text-[#16855c] tabular-nums fade-in slide-in-from-bottom-1 duration-300">
                          +{formatPoints(entry.pointsGained)} points
                        </small>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </ScrollArea>
        </aside>
      </main>

      {notice ? (
        <Button
          className="fixed right-5.5 bottom-5.5 z-10 max-w-[min(440px,calc(100vw-44px))] gap-4 py-3.25 pr-3.5 pl-4 text-xs"
          variant="notice"
          type="button"
          onClick={() => setNotice(null)}
          aria-label="Dismiss message"
        >
          {notice}
          <span className="text-xl leading-none" aria-hidden="true">
            ×
          </span>
        </Button>
      ) : null}

      {confirmation ? (
        <TriviaActionDialog
          action={confirmation}
          ownerIsLeaving={confirmation === 'leave' && session.isOwner}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmation === 'leave' ? handleLeave : handleClose}
        />
      ) : null}
    </div>
  );
}

function LobbyPanel({
  isOwner,
  ownerName,
  playerCount,
  starting,
  isClosed,
  configuration,
  onStart,
  onCopy,
  onConfigure,
}: {
  isOwner: boolean;
  ownerName: string;
  playerCount: number;
  starting: boolean;
  isClosed: boolean;
  configuration: GameView['configuration'];
  onStart: () => void;
  onCopy: () => void;
  onConfigure: (categories: string[], roundCount: number) => Promise<void>;
}) {
  const categorySummary =
    configuration.categories.length === configuration.availableCategories.length
      ? 'All categories'
      : configuration.categories.join(', ');

  return (
    <div className="relative flex h-[clamp(640px,calc(100dvh-112px),768px)] max-h-192 min-h-0 flex-col overflow-hidden rounded-[24px_10px_26px_12px] border border-[#aebfd0] bg-[rgb(249_252_255/96%)] shadow-[8px_9px_0_#ccdae6] max-[760px]:h-auto max-[760px]:min-h-150">
      <div
        className="absolute top-[clamp(40px,8vw,90px)] right-[clamp(36px,8vw,110px)] aspect-square w-[clamp(140px,18vw,240px)] animate-spin rounded-full border border-[#99c8db] [animation-duration:18s] motion-reduce:animate-none before:absolute before:inset-[15%] before:rounded-full before:border before:border-dashed before:border-[#b6cfdb] before:content-[''] after:absolute after:inset-[34%] after:rounded-full after:border after:border-dashed after:border-[#b6cfdb] after:bg-[#12a8d4] after:content-[''] max-[980px]:opacity-40 max-[760px]:top-9 max-[760px]:right-6.25 max-[760px]:w-32.5"
        aria-hidden="true"
      >
        <span className="absolute -top-4.5 left-[42%] grid size-9.5 place-items-center rounded-full border border-[#10213d] bg-[#ffda55] text-xl font-[850] text-[#10213d] shadow-[2px_2px_0_#10213d]">
          ?
        </span>
        <span className="absolute right-[-18px] bottom-[26%] grid size-9.5 place-items-center rounded-full border border-[#10213d] bg-[#ff6f61] text-xl font-[850] text-[#10213d] shadow-[2px_2px_0_#10213d]">
          !
        </span>
        <BrainCircuit className="absolute inset-[41%] z-2 size-[18%] text-white" />
      </div>
      <div className="relative z-1 flex flex-1 flex-col items-start justify-center px-[clamp(42px,7vw,100px)] pt-[clamp(38px,6vw,80px)] pb-7 max-[760px]:px-6 max-[760px]:pt-13 max-[760px]:pb-8.5">
        <h1 className="m-0 max-w-187.5 font-trivia text-[clamp(66px,8vw,118px)] leading-[0.78] font-[820] tracking-[-0.075em] text-[#10213d] [font-stretch:condensed] max-[760px]:text-[clamp(58px,20vw,84px)]">
          Know it.
          <br />
          Hit it first.
        </h1>
        <p className="mt-7 max-w-142.5 text-[clamp(16px,1.6vw,20px)] leading-[1.55] text-[#5c6f87] max-[760px]:max-w-[84%] max-[760px]:text-[15px]">
          Every question has four choices. Accuracy keeps you alive; speed takes you to the top of the table.
        </p>
        <div className="my-7 flex flex-wrap gap-6.5 border-y border-[#cfdae5] py-4 text-[11px] font-[650] text-[#75869a] max-[760px]:gap-x-5 max-[760px]:gap-y-3 [&_strong]:mr-1 [&_strong]:text-[15px] [&_strong]:text-[#10213d]">
          <span>
            <strong>{playerCount}</strong> {playerCount === 1 ? 'player' : 'players'} ready
          </span>
          <span>
            <strong>1,000</strong> max points
          </span>
        </div>
        {isClosed ? (
          <p className="m-0 inline-flex items-center gap-2.25 rounded-[10px_6px_11px_7px] border border-[#c2cfdb] bg-[#eef4f8] px-4.25 py-3.5 text-xs font-bold text-[#53677c] [&_svg]:size-4">
            <LockKeyhole aria-hidden="true" /> This room is closed.
          </p>
        ) : isOwner ? (
          <Button
            className="h-13.5 min-w-47.5 disabled:cursor-wait disabled:opacity-65"
            variant="trivia-primary"
            size="xl"
            type="button"
            onClick={onStart}
            disabled={starting}
          >
            {starting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
            {starting ? 'Building game…' : 'Start the game'}
          </Button>
        ) : (
          <p className="m-0 inline-flex items-center gap-2.25 rounded-[10px_6px_11px_7px] border border-[#c2cfdb] bg-[#eef4f8] px-4.25 py-3.5 text-xs font-bold text-[#53677c] [&_svg]:size-4">
            <LoaderCircle className="animate-spin" aria-hidden="true" /> Waiting for {ownerName} to start
          </p>
        )}
        {!isClosed ? (
          <Button
            className="mt-4.5 ml-0.75 h-9 px-3 text-[11px] font-[720] text-[#51677e] focus-visible:outline-[rgb(18_168_212/32%)]"
            variant="paper"
            type="button"
            onClick={onCopy}
          >
            Copy invite link
          </Button>
        ) : null}
      </div>

      <section
        className="relative z-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-[#cfdae5] bg-[rgb(239_247_251/82%)] px-[clamp(24px,4vw,52px)] py-4.5 max-[520px]:grid-cols-1 max-[520px]:gap-3.5"
        aria-label="Trivia rules and game configuration"
      >
        <div className="min-w-0">
          <h2 className="m-0 text-[11px] font-[850] tracking-[0.12em] text-[#087fa7] uppercase">
            Rules &amp; game setup
          </h2>
          <p className="mt-1.5 mb-0 text-xs leading-5 text-[#667a90]">
            <strong className="text-[#31465f]">{configuration.roundCount} rounds</strong>
            {' · '}
            About {configuration.estimatedMinutes} min
            {' · '}
            <span title={configuration.categories.join(', ')}>{categorySummary}</span>
          </p>
        </div>
        {isOwner && !isClosed ? <TriviaConfigurationDialog configuration={configuration} onSave={onConfigure} /> : null}
      </section>
    </div>
  );
}

type GameView = NonNullable<FunctionReturnType<typeof api.trivia.getGame>>;

function QuestionPanel({
  game,
  remainingMs,
  timeProgress,
  selectedOption,
  onAnswer,
}: {
  game: GameView;
  remainingMs: number;
  timeProgress: number;
  selectedOption: number | null;
  onAnswer: (index: number) => void;
}) {
  const round = game.round;
  if (round === null) {
    return null;
  }
  const isReveal = game.phase === 'reveal';
  const answerResult = !isReveal ? 'pending' : game.playerAnswer?.isCorrect ? 'correct' : 'incorrect';

  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="grid min-h-12 grid-cols-[1fr_auto_1fr] items-center px-2 text-[10px] font-[780] tracking-[0.1em] text-[#5c7088] max-[760px]:grid-cols-[1fr_auto]">
        <span>
          QUESTION {round.questionNumber} / {game.totalQuestions}
        </span>
        <span className="text-[#087fa7] max-[760px]:hidden">{round.category}</span>
        {isReveal ? (
          <strong className="inline-flex items-center justify-self-end gap-1.75 text-[10px] tracking-[0.08em] text-[#16855c] uppercase [&_svg]:size-4">
            <Check aria-hidden="true" /> Round over
          </strong>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>

      <div
        className="trivia-question-stage relative min-h-[var(--trivia-question-min-height)] overflow-hidden rounded-[25px_11px_27px_13px] bg-[#cbd9e5] p-2 shadow-[8px_9px_0_#c7d7e3] [container-type:inline-size] transition-colors duration-[260ms] ease-in data-[answer-result=correct]:bg-[#42b884] data-[answer-result=correct]:duration-0 data-[answer-result=incorrect]:bg-[#df625a] data-[answer-result=incorrect]:duration-0 motion-reduce:transition-none"
        data-answer-result={answerResult}
      >
        <div className="trivia-question-card relative z-1 flex min-h-[calc(var(--trivia-question-min-height)-16px)] flex-col rounded-[19px_6px_21px_8px] bg-[#fafdff] p-[clamp(30px,4cqw,58px)] max-[980px]:p-8.5 max-[760px]:px-4.5 max-[760px]:py-7">
          <QuestionContent
            round={round}
            isReveal={isReveal}
            selectedOption={selectedOption}
            phase={game.phase}
            remainingMs={remainingMs}
            timeProgress={timeProgress}
            totalQuestions={game.totalQuestions}
            onAnswer={onAnswer}
          />
          <div className="flex min-h-6.5 items-center justify-between gap-4.5 text-[11px] font-[680] text-[#78899c] max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-1.25 [&_strong]:inline-flex [&_strong]:items-center [&_strong]:gap-1.5 [&_strong]:text-[#4f6278] [&_svg]:size-3.75">
            <span>{round.answeredCount} locked in</span>
            {isReveal && game.playerAnswer?.isCorrect ? (
              <strong className="text-[#16855c]">
                <Check aria-hidden="true" /> +{game.playerAnswer.pointsAwarded} points
              </strong>
            ) : null}
            {isReveal && game.playerAnswer?.isCorrect === false ? (
              <strong className="text-[#c4433c]">
                <X aria-hidden="true" /> No points this round
              </strong>
            ) : null}
            {isReveal && game.playerAnswer === null ? <strong>Time ran out — no answer recorded.</strong> : null}
          </div>
        </div>
      </div>
      <div className="trivia-question-guidance flex min-h-11 items-start gap-2.25 px-2.5 pt-3.5 text-[10px] leading-[1.45] text-[#718399] [&_strong]:text-[#3c536c]">
        <Timer className="size-3.75 shrink-0 text-[#0b8bb5]" aria-hidden="true" />
        <p className="m-0">
          Correct answers earn <strong>500–1,000 points.</strong> The faster they land, the more they’re worth.
        </p>
      </div>
    </div>
  );
}

type QuestionRound = NonNullable<GameView['round']>;
function QuestionContent({
  round,
  isReveal,
  selectedOption,
  phase,
  remainingMs,
  timeProgress,
  totalQuestions,
  onAnswer,
}: {
  round: QuestionRound;
  isReveal: boolean;
  selectedOption: number | null;
  phase: GameView['phase'];
  remainingMs: number;
  timeProgress: number;
  totalQuestions: number;
  onAnswer: (index: number) => void;
}) {
  const timerSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const displayedSeconds = isReveal
    ? Math.min(REVEAL_DURATION_MS / 1_000, timerSeconds)
    : Math.min(ANSWER_DURATION_MS / 1_000, timerSeconds);
  const timerStyle = { '--round-progress': `${timeProgress * 360}deg` } as CSSProperties;
  const timerLabel = isReveal
    ? `${round.questionNumber >= totalQuestions ? 'Final results' : 'Next question'} in ${displayedSeconds} seconds`
    : `${displayedSeconds} seconds left to answer`;
  const totalAnswerCount = Math.max(
    1,
    (round.optionAnswerCounts ?? []).reduce((total, count) => total + count, 0)
  );

  return (
    <div className="trivia-question-content flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-19 basis-19 items-start justify-end max-[760px]:min-h-17 max-[760px]:basis-17">
        <strong
          key={`${round.roundId}:${phase}`}
          className="trivia-round-timer grid size-18 shrink-0 place-items-center rounded-full bg-[conic-gradient(from_-90deg,var(--timer-color)_var(--round-progress),#cbd9e5_0)] p-1.25 shadow-[0_3px_0_var(--timer-shadow)] [--timer-color:#12a8d4] [--timer-shadow:#9acfe0] transition-[--round-progress] duration-100 data-[phase=reveal]:[--timer-color:#16855c] data-[phase=reveal]:[--timer-shadow:#a8c8ba] data-[urgent=true]:[--timer-color:#d7433d] data-[urgent=true]:[--timer-shadow:#e8b2ae] before:col-start-1 before:row-start-1 before:size-15 before:rounded-full before:bg-[#fafdff] before:content-[''] motion-reduce:transition-none max-[760px]:size-16 max-[760px]:basis-16 max-[760px]:before:size-13"
          data-phase={isReveal ? 'reveal' : 'question'}
          data-urgent={!isReveal && remainingMs <= 5_000}
          style={timerStyle}
          role="timer"
          aria-label={timerLabel}
        >
          <span className="z-1 col-start-1 row-start-1 text-2xl leading-none font-[850] text-[#10213d] max-[760px]:text-[21px]">
            {displayedSeconds}
          </span>
        </strong>
      </div>
      <h1 className="m-0 max-w-245 font-sans text-[clamp(32px,4.4cqw,58px)] leading-[1.08] font-[720] tracking-[-0.025em] text-[#10213d] max-[760px]:text-[clamp(30px,8.5vw,46px)]">
        {round.prompt}
      </h1>
      <div className="mt-auto mb-6 grid grid-cols-2 gap-3 pt-[clamp(28px,4cqw,48px)] max-[760px]:grid-cols-1 max-[760px]:gap-2 max-[760px]:pt-6">
        {round.options.map((option, index) => {
          const isSelected = selectedOption === index;
          const isCorrect = isReveal && round.correctOptionIndex === index;
          const isIncorrectSelection = isReveal && isSelected && !isCorrect;
          const answerCount = round.optionAnswerCounts?.[index] ?? 0;
          return (
            <Button
              key={option}
              variant="answer"
              type="button"
              className="relative grid min-h-20.5 grid-cols-[46px_minmax(0,1fr)_auto] gap-3.5 overflow-hidden py-3 pr-4 pl-3 disabled:cursor-default max-[760px]:min-h-16.25 max-[760px]:grid-cols-[38px_minmax(0,1fr)_auto]"
              data-selected={isSelected && !isReveal}
              data-correct={isCorrect}
              data-incorrect={isIncorrectSelection}
              onClick={() => onAnswer(index)}
              disabled={phase !== 'question' || selectedOption !== null}
            >
              <span className="relative z-1 grid size-11.5 place-items-center rounded-[12px_6px_13px_7px] bg-[#10213d] text-base font-[850] text-white max-[760px]:size-9.5">
                {ANSWER_LABELS[index]}
              </span>
              <span className="relative z-1 text-[clamp(14px,1.5vw,18px)] leading-tight font-[720] max-[760px]:text-sm">
                {option}
              </span>
              {isReveal ? (
                <span className="trivia-answer-result relative z-1 grid size-11 overflow-hidden place-items-center rounded-full bg-[#edf2f6] shadow-[inset_0_0_0_1px_#dbe5ed]">
                  <span
                    className="absolute right-0 bottom-0 left-0 h-[var(--answer-share)] max-h-full rounded-b-full bg-[rgb(18_168_212/32%)] transition-[height] duration-200"
                    style={{ '--answer-share': `${(answerCount / totalAnswerCount) * 100}%` } as CSSProperties}
                  />
                  <strong className="relative z-1 text-xs">{answerCount}</strong>
                </span>
              ) : isSelected ? (
                <Check className="relative z-1 size-5 text-[#8c6c00]" aria-label="Answer locked" />
              ) : null}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function CompletePanel({
  leaderboard,
  gameNumber,
  session,
  sessionToken,
  playIntro,
}: {
  leaderboard: GameView['leaderboard'];
  gameNumber: number;
  session: ActiveSession;
  sessionToken: string;
  playIntro: boolean;
}) {
  const eligibleLeaderboard = leaderboard
    .filter((entry) => entry.isActive)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const winner = eligibleLeaderboard[0];
  return (
    <PostGameBoard
      eyebrow={`Game ${gameNumber} · Final`}
      title={winner ? `${winner.displayName} takes it.` : 'That’s the game.'}
      detail={
        winner
          ? `${formatPoints(winner.totalPoints)} points · ${winner.correctAnswers} correct`
          : 'The final scores are in.'
      }
      icon={Trophy}
      accent="#087fa7"
      accentTint="#ffda55"
      roomId={session.roomId}
      currentGameId={session.currentGameId}
      currentGameType={session.gameType}
      sessionToken={sessionToken}
      isOwner={session.isOwner}
      isClosed={session.status === 'closed'}
      closedMessage="This room is closed. The final scoreboard stays here to view."
      playIntro={playIntro}
      summary={
        <PostGamePodium
          label="Final podium"
          animate={playIntro}
          entries={eligibleLeaderboard.slice(0, 3).map((entry) => ({
            id: entry.memberId,
            place: entry.rank,
            name: entry.displayName,
            result: `${formatPoints(entry.totalPoints)} points`,
          }))}
        />
      }
    />
  );
}

function TriviaActionDialog({
  action,
  ownerIsLeaving,
  onCancel,
  onConfirm,
}: {
  action: 'leave' | 'close';
  ownerIsLeaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isClosing = action === 'close';
  const title = isClosing ? 'Close this trivia room?' : 'Leave this room?';
  const detail = isClosing
    ? 'The current game stops accepting answers, but the final standings remain visible.'
    : ownerIsLeaving
      ? 'The room stays open. Ownership will pass to the next active player.'
      : 'You can rejoin from this browser later while the room remains open.';
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="box-border w-[min(420px,calc(100vw-32px))] max-w-105 overflow-visible rounded-[22px_16px_24px_18px] border border-[#bfc9d9] bg-white p-0 text-[#17203a] shadow-[9px_10px_0_rgb(23_32_58/16%),0_28px_80px_rgb(23_32_58/28%)] motion-reduce:animate-none">
        <div className="px-8.5 pt-8.5 pb-7.5 text-center max-[520px]:px-5.5 max-[520px]:pt-7.5 max-[520px]:pb-5.5">
          <div
            className="mx-auto -mt-15.5 mb-6 grid size-14.5 -rotate-4 place-items-center rounded-[18px_14px_20px_15px] border-2 border-[#17203a] bg-[#ff685b] text-white shadow-[5px_5px_0_#17203a] data-[action=close]:rotate-3 data-[action=close]:bg-[#3155d9] [&_svg]:size-6"
            data-action={action}
            aria-hidden="true"
          >
            {isClosing ? <LockKeyhole /> : <DoorOpen />}
          </div>
          <p className="mb-1.75 text-[9px] font-[780] tracking-[0.12em] text-[#3155d9] uppercase">Before you go</p>
          <AlertDialogTitle asChild>
            <h2 className="m-0 font-display text-[clamp(28px,5vw,36px)] tracking-[-0.05em]">{title}</h2>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <p className="mx-auto mt-3.5 mb-6.5 max-w-85 text-[13px] leading-[1.55] text-[#657087]">{detail}</p>
          </AlertDialogDescription>
          <div className="grid grid-cols-2 gap-2.5 max-[520px]:grid-cols-1">
            <AlertDialogCancel variant="paper" className="min-h-11 text-xs font-[760] max-[520px]:order-2">
              Stay in the game
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" className="min-h-11 text-xs" onClick={onConfirm}>
              {isClosing ? 'Close room' : 'Leave room'}
            </AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
