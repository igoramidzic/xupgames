import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  Beaker,
  BrainCircuit,
  Check,
  Copy,
  Crown,
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
import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GuestIdentity } from '@/lib/guest';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const ANSWER_DURATION_MS = 15_000;
const COUNTDOWN_DURATION_MS = 3_000;
const REVEAL_DURATION_MS = 7_000;
const QUESTION_FADE_OUT_MS = 260;

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const convexPayload = error.message.match(/\{.*"message":"([^"]+)".*\}/)?.[1];
  return convexPayload ?? error.message.replace(/^Uncaught Error:\s*/, '');
}

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

function useLeaderboardSwapAnimation(orderKey: string) {
  const elements = useRef(new Map<string, HTMLLIElement>());
  const previousPositions = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const memberIds = orderKey === '' ? [] : orderKey.split('|');
    const nextPositions = new Map<string, DOMRect>();
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    for (const memberId of memberIds) {
      const element = elements.current.get(memberId);
      if (!element) {
        continue;
      }
      const nextPosition = element.getBoundingClientRect();
      const previousPosition = previousPositions.current.get(memberId);
      nextPositions.set(memberId, nextPosition);
      const offsetY = previousPosition ? previousPosition.top - nextPosition.top : 0;
      if (reduceMotion || Math.abs(offsetY) < 1 || typeof element.animate !== 'function') {
        continue;
      }

      element.dataset.reordering = 'true';
      const animation = element.animate(
        [{ transform: `translate3d(0, ${offsetY}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
        { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
      void animation.finished
        .catch(() => undefined)
        .finally(() => {
          delete element.dataset.reordering;
        });
    }

    previousPositions.current = nextPositions;
  }, [orderKey]);

  return (memberId: string, element: HTMLLIElement | null) => {
    if (element === null) {
      elements.current.delete(memberId);
      return;
    }
    elements.current.set(memberId, element);
  };
}

export default function TriviaRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  const navigate = useNavigate();
  const game = useQuery(api.trivia.getGame, { roomId: session.roomId, sessionToken: guest.sessionToken });
  const startGame = useMutation(api.trivia.startGame);
  const submitAnswer = useMutation(api.trivia.submitAnswer);
  const leaveRoom = useMutation(api.rooms.leave);
  const closeRoom = useMutation(api.rooms.close);
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

  const ownerName = session.activeMembers.find((member) => member.isOwner)?.displayName ?? 'The room owner';
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
  const setLeaderboardItemRef = useLeaderboardSwapAnimation(leaderboardOrderKey);

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
      setNotice(errorMessage(startError, 'Trivia could not be started.'));
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
      setNotice(errorMessage(answerError, 'Your answer could not be locked in.'));
      setPendingAnswer(null);
    }
  }

  async function handleLeave() {
    setConfirmation(null);
    setActionPending('leave');
    try {
      await leaveRoom({ code: session.code, sessionToken: guest.sessionToken });
      navigate('/');
    } catch (leaveError) {
      setNotice(errorMessage(leaveError, 'The room could not be left.'));
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
      setNotice(errorMessage(closeError, 'The room could not be closed.'));
      setActionPending(null);
    }
  }

  if (game === undefined) {
    return (
      <main className="trivia-loading">
        <BrainCircuit aria-hidden="true" />
        <LoaderCircle className="spin" aria-hidden="true" />
        <p>Stacking the questions…</p>
      </main>
    );
  }

  return (
    <div className="trivia-shell">
      <header className="trivia-header">
        <Link className="wordmark trivia-wordmark" to="/" aria-label="Xup Games home">
          <span className="wordmark-mark" aria-hidden="true">
            X
          </span>
          <span>Xup Trivia</span>
        </Link>

        <button className="trivia-room-code" type="button" onClick={copyRoomLink} aria-label="Copy room link">
          <span>ROOM {session.code}</span>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </button>

        <div className="room-header-actions">
          <span className={isClosed ? 'room-status room-status-closed' : 'room-status'}>
            <span className="live-dot" /> {isClosed ? 'Closed' : 'Live'}
          </span>
          {session.isOwner && !isClosed ? (
            <Link className="room-action" to={`/admin/${session.code}`}>
              <Beaker aria-hidden="true" />
              <span>Playtest</span>
            </Link>
          ) : null}
          {session.isOwner && !isClosed ? (
            <button className="room-action" type="button" onClick={() => setConfirmation('close')}>
              <LockKeyhole aria-hidden="true" />
              <span>Close room</span>
            </button>
          ) : null}
          <button
            className="room-action"
            type="button"
            onClick={() => setConfirmation('leave')}
            disabled={actionPending !== null}
          >
            {actionPending === 'leave' ? <LoaderCircle className="spin" aria-hidden="true" /> : <DoorOpen />}
            <span>Leave</span>
          </button>
        </div>
      </header>

      <main className="trivia-workspace">
        <section className="trivia-game-column" aria-live="polite">
          {game.phase === 'lobby' ? (
            <LobbyPanel
              isOwner={session.isOwner}
              ownerName={ownerName}
              playerCount={session.activeMemberCount}
              starting={starting}
              isClosed={isClosed}
              onStart={handleStart}
              onCopy={copyRoomLink}
            />
          ) : null}

          {game.phase === 'countdown' ? (
            <div className="trivia-countdown-panel">
              <p>Game {game.gameNumber}</p>
              <strong>{Math.max(1, Math.ceil(remainingMs / 1_000))}</strong>
              <h1>Eyes up. First question incoming.</h1>
              <span>Fast and right beats merely right.</span>
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

          {game.phase === 'complete' ? (
            <CompletePanel
              leaderboard={game.leaderboard}
              gameNumber={game.gameNumber}
              isOwner={session.isOwner}
              isClosed={isClosed}
              starting={starting}
              onStart={handleStart}
            />
          ) : null}
        </section>

        <aside className="trivia-scoreboard">
          <div className="trivia-scoreboard-heading">
            <div>
              <p>LIVE TABLE</p>
              <h2>Standings</h2>
            </div>
            <span>
              <UsersRound aria-hidden="true" /> {session.activeMemberCount}
            </span>
          </div>

          {currentPlayer ? (
            <div className="trivia-player-score">
              <span>Your score</span>
              <strong>{formatPoints(currentPlayer.totalPoints)}</strong>
              <small>
                {currentPlayer.correctAnswers}/{completedRounds} correct
              </small>
            </div>
          ) : null}

          <ScrollArea className="trivia-leaderboard-scroll" viewportClassName="scroll-fade" type="always">
            <ol className="trivia-leaderboard" aria-label="Player standings">
              {game.leaderboard.map((entry) => (
                <li
                  key={entry.memberId}
                  ref={(element) => setLeaderboardItemRef(entry.memberId, element)}
                  data-current={entry.isCurrentPlayer}
                  data-rank={entry.rank}
                >
                  <span className="trivia-rank">{entry.rank <= 3 ? <Medal aria-hidden="true" /> : entry.rank}</span>
                  <span className="trivia-player-name">
                    <strong>{entry.displayName}</strong>
                    <small>
                      {entry.correctAnswers} right
                      {entry.bestStreak >= 2 ? (
                        <em>
                          <Flame aria-hidden="true" /> {entry.bestStreak}
                        </em>
                      ) : null}
                    </small>
                  </span>
                  <span className="trivia-points-column">
                    <strong className="trivia-points">{formatPoints(entry.totalPoints)}</strong>
                    {game.phase === 'reveal' && entry.pointsGained !== null && entry.pointsGained > 0 ? (
                      <small className="trivia-points-gained">+{formatPoints(entry.pointsGained)} points</small>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </ScrollArea>
        </aside>
      </main>

      {notice ? (
        <button className="room-notice" type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
          {notice}
          <span aria-hidden="true">×</span>
        </button>
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
  onStart,
  onCopy,
}: {
  isOwner: boolean;
  ownerName: string;
  playerCount: number;
  starting: boolean;
  isClosed: boolean;
  onStart: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="trivia-lobby-panel">
      <div className="trivia-lobby-orbit" aria-hidden="true">
        <span>?</span>
        <span>!</span>
        <BrainCircuit />
      </div>
      <p className="trivia-kicker">10 QUESTIONS · 15 SECONDS EACH</p>
      <h1>
        Know it.
        <br />
        Hit it first.
      </h1>
      <p className="trivia-lobby-copy">
        Every question has four choices. Accuracy keeps you alive; speed takes you to the top of the table.
      </p>
      <div className="trivia-lobby-stats">
        <span>
          <strong>115</strong> launch questions
        </span>
        <span>
          <strong>{playerCount}</strong> {playerCount === 1 ? 'player' : 'players'} ready
        </span>
        <span>
          <strong>1,000</strong> max points
        </span>
      </div>
      {isClosed ? (
        <p className="trivia-waiting">
          <LockKeyhole aria-hidden="true" /> This room is closed.
        </p>
      ) : isOwner ? (
        <button className="trivia-start-button" type="button" onClick={onStart} disabled={starting}>
          {starting ? <LoaderCircle className="spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
          {starting ? 'Building game…' : 'Start the game'}
        </button>
      ) : (
        <p className="trivia-waiting">
          <LoaderCircle className="spin" aria-hidden="true" /> Waiting for {ownerName} to start
        </p>
      )}
      {!isClosed ? (
        <button className="trivia-invite-button" type="button" onClick={onCopy}>
          Copy invite link
        </button>
      ) : null}
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
    <div className="trivia-question-layout">
      <div className="trivia-question-meta">
        <span>
          QUESTION {round.questionNumber} / {game.totalQuestions}
        </span>
        <span>{round.category}</span>
        {isReveal ? (
          <strong className="trivia-round-over">
            <Check aria-hidden="true" /> Round over
          </strong>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>

      <div className="trivia-question-stage" data-answer-result={answerResult}>
        <div className="trivia-question-card">
          <QuestionContentTransition
            round={round}
            isReveal={isReveal}
            selectedOption={selectedOption}
            phase={game.phase}
            remainingMs={remainingMs}
            timeProgress={timeProgress}
            totalQuestions={game.totalQuestions}
            onAnswer={onAnswer}
          />
          <div className="trivia-question-footer">
            <span>{round.answeredCount} locked in</span>
            {isReveal && game.playerAnswer?.isCorrect ? (
              <strong className="trivia-result-correct">
                <Check aria-hidden="true" /> +{game.playerAnswer.pointsAwarded} points
              </strong>
            ) : null}
            {isReveal && game.playerAnswer?.isCorrect === false ? (
              <strong className="trivia-result-wrong">
                <X aria-hidden="true" /> No points this round
              </strong>
            ) : null}
            {isReveal && game.playerAnswer === null ? <strong>Time ran out — no answer recorded.</strong> : null}
          </div>
        </div>
      </div>
      <div className="trivia-question-guidance">
        <Timer aria-hidden="true" />
        <p>
          Correct answers earn <strong>500–1,000 points.</strong> The faster they land, the more they’re worth.
        </p>
      </div>
    </div>
  );
}

type QuestionRound = NonNullable<GameView['round']>;
type QuestionContentSnapshot = {
  round: QuestionRound;
  isReveal: boolean;
  selectedOption: number | null;
  phase: GameView['phase'];
  remainingMs: number;
  timeProgress: number;
  totalQuestions: number;
};

function QuestionContentTransition({
  round,
  isReveal,
  selectedOption,
  phase,
  remainingMs,
  timeProgress,
  totalQuestions,
  onAnswer,
}: QuestionContentSnapshot & { onAnswer: (index: number) => void }) {
  const snapshot = useMemo(
    () => ({ round, isReveal, selectedOption, phase, remainingMs, timeProgress, totalQuestions }),
    [round, isReveal, selectedOption, phase, remainingMs, timeProgress, totalQuestions]
  );
  const latestSnapshotRef = useRef<QuestionContentSnapshot>(snapshot);
  latestSnapshotRef.current = snapshot;
  const displayedRoundIdRef = useRef(round.roundId);
  const [displayed, setDisplayed] = useState<QuestionContentSnapshot>(latestSnapshotRef.current);
  const [transitionPhase, setTransitionPhase] = useState<'visible' | 'out' | 'in'>('visible');
  const visibleSnapshotRef = useRef(snapshot);

  if (transitionPhase === 'visible' && displayedRoundIdRef.current === round.roundId) {
    visibleSnapshotRef.current = snapshot;
  }

  useLayoutEffect(() => {
    if (displayedRoundIdRef.current === round.roundId) {
      return;
    }

    setDisplayed(visibleSnapshotRef.current);
    setTransitionPhase('out');
    let firstFrame = 0;
    let secondFrame = 0;
    const swapTimer = window.setTimeout(() => {
      const nextSnapshot = latestSnapshotRef.current;
      displayedRoundIdRef.current = nextSnapshot.round.roundId;
      setDisplayed(nextSnapshot);
      setTransitionPhase('in');
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          setTransitionPhase('visible');
        });
      });
    }, QUESTION_FADE_OUT_MS);

    return () => {
      window.clearTimeout(swapTimer);
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [round.roundId]);

  const activeSnapshot =
    transitionPhase === 'visible' && displayedRoundIdRef.current === round.roundId
      ? snapshot
      : transitionPhase === 'visible'
        ? visibleSnapshotRef.current
        : displayed;
  const timerSeconds = Math.max(0, Math.ceil(activeSnapshot.remainingMs / 1_000));
  const displayedSeconds = activeSnapshot.isReveal
    ? Math.min(REVEAL_DURATION_MS / 1_000, timerSeconds)
    : Math.min(ANSWER_DURATION_MS / 1_000, timerSeconds);
  const timerStyle = { '--round-progress': `${activeSnapshot.timeProgress * 360}deg` } as CSSProperties;
  const timerLabel = activeSnapshot.isReveal
    ? `${activeSnapshot.round.questionNumber >= activeSnapshot.totalQuestions ? 'Final results' : 'Next question'} in ${displayedSeconds} seconds`
    : `${displayedSeconds} seconds left to answer`;
  const totalAnswerCount = Math.max(
    1,
    (activeSnapshot.round.optionAnswerCounts ?? []).reduce((total, count) => total + count, 0)
  );

  return (
    <div className="trivia-question-content" data-transition={transitionPhase}>
      <div className="trivia-question-card-heading">
        <strong
          key={`${activeSnapshot.round.roundId}:${activeSnapshot.phase}`}
          className="trivia-round-timer"
          data-phase={activeSnapshot.isReveal ? 'reveal' : 'question'}
          data-urgent={!activeSnapshot.isReveal && activeSnapshot.remainingMs <= 5_000}
          style={timerStyle}
          role="timer"
          aria-label={timerLabel}
        >
          <span className="trivia-round-timer-value">{displayedSeconds}</span>
        </strong>
      </div>
      <h1>{activeSnapshot.round.prompt}</h1>
      <div className="trivia-answer-grid">
        {activeSnapshot.round.options.map((option, index) => {
          const isSelected = activeSnapshot.selectedOption === index;
          const isCorrect = activeSnapshot.isReveal && activeSnapshot.round.correctOptionIndex === index;
          const isIncorrectSelection = activeSnapshot.isReveal && isSelected && !isCorrect;
          const answerCount = activeSnapshot.round.optionAnswerCounts?.[index] ?? 0;
          return (
            <button
              key={option}
              type="button"
              className="trivia-answer-option"
              data-selected={isSelected}
              data-correct={isCorrect}
              data-incorrect={isIncorrectSelection}
              onClick={() => onAnswer(index)}
              disabled={activeSnapshot.phase !== 'question' || activeSnapshot.selectedOption !== null}
            >
              <span className="trivia-answer-letter">{ANSWER_LABELS[index]}</span>
              <span className="trivia-answer-text">{option}</span>
              {activeSnapshot.isReveal ? (
                <span className="trivia-answer-result">
                  <span style={{ '--answer-share': `${(answerCount / totalAnswerCount) * 100}%` } as CSSProperties} />
                  <strong>{answerCount}</strong>
                </span>
              ) : isSelected ? (
                <Check className="trivia-answer-lock" aria-label="Answer locked" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompletePanel({
  leaderboard,
  gameNumber,
  isOwner,
  isClosed,
  starting,
  onStart,
}: {
  leaderboard: GameView['leaderboard'];
  gameNumber: number;
  isOwner: boolean;
  isClosed: boolean;
  starting: boolean;
  onStart: () => void;
}) {
  const winner = leaderboard[0];
  return (
    <div className="trivia-complete-panel">
      <div className="trivia-trophy-mark">
        <Trophy aria-hidden="true" />
      </div>
      <p className="trivia-kicker">GAME {gameNumber} · FINAL</p>
      <h1>{winner ? `${winner.displayName} takes it.` : 'That’s the game.'}</h1>
      {winner ? (
        <p className="trivia-winner-score">
          <Crown aria-hidden="true" /> {formatPoints(winner.totalPoints)} points · {winner.correctAnswers} correct
        </p>
      ) : null}
      <div className="trivia-podium">
        {leaderboard.slice(0, 3).map((entry) => (
          <div key={entry.memberId} data-place={entry.rank}>
            <span>{entry.rank}</span>
            <strong>{entry.displayName}</strong>
            <small>{formatPoints(entry.totalPoints)}</small>
          </div>
        ))}
      </div>
      {isOwner && !isClosed ? (
        <button className="trivia-start-button" type="button" onClick={onStart} disabled={starting}>
          {starting ? <LoaderCircle className="spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
          {starting ? 'Building game…' : 'Play another 10'}
        </button>
      ) : null}
    </div>
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
  const title = isClosing
    ? 'Close this trivia room?'
    : ownerIsLeaving
      ? 'Leave and close the room?'
      : 'Leave this room?';
  const detail = isClosing
    ? 'The current game stops accepting answers, but the final standings remain visible.'
    : ownerIsLeaving
      ? 'You created this room, so leaving closes it for everyone.'
      : 'You can rejoin from this browser later while the room remains open.';
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="room-confirm-dialog">
        <div className="room-confirm-paper">
          <div className="room-confirm-mark" data-action={action} aria-hidden="true">
            {isClosing ? <LockKeyhole /> : <DoorOpen />}
          </div>
          <p className="eyebrow">Before you go</p>
          <AlertDialogTitle asChild>
            <h2>{title}</h2>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <p>{detail}</p>
          </AlertDialogDescription>
          <div className="room-confirm-actions">
            <AlertDialogCancel className="room-confirm-cancel">Stay in the game</AlertDialogCancel>
            <AlertDialogAction className="room-confirm-submit" onClick={onConfirm}>
              {isClosing ? 'Close room' : ownerIsLeaving ? 'Leave & close' : 'Leave room'}
            </AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
