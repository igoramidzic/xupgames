import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  Beaker,
  Check,
  Copy,
  Crown,
  DoorOpen,
  Gauge,
  Keyboard,
  LibraryBig,
  LoaderCircle,
  LockKeyhole,
  Play,
  Timer,
  Trophy,
  UsersRound,
} from 'lucide-react';
import { type CSSProperties, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
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
import { isLocalhost } from '@/lib/environment';
import type { GuestIdentity } from '@/lib/guest';
import { getRoomMembers } from '@/lib/roomSession';
import { alignTypeRacerInput, type TypeRacerInputAlignment, typingAccuracy } from '@/lib/typeRacerTyping';
import { useListReorderAnimation } from '@/lib/useListReorderAnimation';
import { useRoomPresence } from '@/lib/useRoomPresence';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;
type RaceView = FunctionReturnType<typeof api.typeRacer.getRace>;
type Racer = RaceView['racers'][number];
type RacerMemberId = Racer['memberId'];

const PROGRESS_REPORT_INTERVAL_MS = 500;
const MAX_INSERTED_CHARACTERS = 64;
const RACER_COLORS = ['#ff746c', '#74a7ff', '#58d7a1', '#f1c84f', '#d89aff', '#4ed4e6', '#ff8fc5', '#b8d65c'];

function memberColor(memberId: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < memberId.length; index += 1) {
    hash ^= memberId.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return RACER_COLORS[(hash >>> 0) % RACER_COLORS.length];
}

function currentPlayerFirst(memberIds: RacerMemberId[], currentPlayerId: RacerMemberId | undefined) {
  return currentPlayerId === undefined
    ? memberIds
    : [currentPlayerId, ...memberIds.filter((memberId) => memberId !== currentPlayerId)];
}

function reconcileRacerOrder(
  previousIds: RacerMemberId[],
  racerIds: RacerMemberId[],
  currentPlayerId: RacerMemberId | undefined
) {
  const currentIds = new Set(racerIds);
  const knownIds = new Set(previousIds);
  const retainedIds = previousIds.filter((memberId) => currentIds.has(memberId));
  const arrivingIds = racerIds.filter((memberId) => !knownIds.has(memberId));
  const nextIds = [...retainedIds, ...arrivingIds];

  return currentPlayerFirst(nextIds, currentPlayerId);
}

function useRaceBoardOrder(racers: Racer[], raceNumber: number, phase: RaceView['phase']) {
  const [frozenOrder, setFrozenOrder] = useState<{ raceNumber: number; memberIds: RacerMemberId[] }>(() => {
    const memberIds = racers.map((racer) => racer.memberId);
    const currentPlayerId = racers.find((racer) => racer.isCurrentPlayer)?.memberId;
    return { raceNumber, memberIds: currentPlayerFirst(memberIds, currentPlayerId) };
  });
  const raceInProgress = phase === 'countdown' || phase === 'racing';
  const racerIdsKey = racers.map((racer) => racer.memberId).join('|');
  const currentPlayerId = racers.find((racer) => racer.isCurrentPlayer)?.memberId;
  const racerIds = useMemo(
    () => (racerIdsKey === '' ? [] : (racerIdsKey.split('|') as RacerMemberId[])),
    [racerIdsKey]
  );
  const initialIds = useMemo(() => currentPlayerFirst(racerIds, currentPlayerId), [currentPlayerId, racerIds]);
  const baseIds = frozenOrder.raceNumber === raceNumber ? frozenOrder.memberIds : initialIds;
  const nextIds = useMemo(
    () => reconcileRacerOrder(baseIds, racerIds, currentPlayerId),
    [baseIds, currentPlayerId, racerIds]
  );

  useEffect(() => {
    if (!raceInProgress) {
      return;
    }
    setFrozenOrder((previous) => {
      if (previous.raceNumber === raceNumber && previous.memberIds.join('|') === nextIds.join('|')) {
        return previous;
      }
      return { raceNumber, memberIds: nextIds };
    });
  }, [nextIds, raceInProgress, raceNumber]);

  if (!raceInProgress) {
    return racers;
  }

  const racersById = new Map(racers.map((racer) => [racer.memberId, racer]));
  return nextIds.flatMap((memberId) => {
    const racer = racersById.get(memberId);
    return racer === undefined ? [] : [racer];
  });
}

type TypingState = {
  text: string;
  totalKeystrokes: number;
  errorKeystrokes: number;
};

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

function typingWpm(correctChars: number, startsAt: number | null, now: number): number {
  if (startsAt === null || correctChars < 1 || now <= startsAt) {
    return 0;
  }
  return (correctChars / 5) * (60_000 / (now - startsAt));
}

function formatWpm(wpm: number) {
  return Math.max(0, Math.round(wpm));
}

function formatAccuracy(accuracy: number) {
  return `${Math.max(0, Math.min(100, accuracy)).toFixed(accuracy < 99.95 ? 1 : 0)}%`;
}

function formatFinishTime(milliseconds: number | null) {
  if (milliseconds === null) {
    return '—';
  }
  return `${(milliseconds / 1_000).toFixed(2)}s`;
}

function passageWords(text: string) {
  let startIndex = 0;
  return (text.match(/\S+\s*/g) ?? []).map((word) => {
    const characters = Array.from(word, (character, offset) => ({
      character,
      index: startIndex + offset,
      key: `${startIndex + offset}-${character}`,
    }));
    const result = { text: word, startIndex, characters };
    startIndex += word.length;
    return result;
  });
}

export default function TypeRacerRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  const navigate = useNavigate();
  const game = useQuery(api.typeRacer.getRace, { roomId: session.roomId, sessionToken: guest.sessionToken });
  const startRace = useMutation(api.typeRacer.startRace);
  const reportProgress = useMutation(api.typeRacer.reportProgress);
  const leaveRoom = useMutation(api.rooms.leave);
  const closeRoom = useMutation(api.rooms.close);
  const { onlineByMemberId } = useRoomPresence({ roomId: session.roomId, sessionToken: guest.sessionToken });
  const [typing, setTyping] = useState<TypingState>({ text: '', totalKeystrokes: 0, errorKeystrokes: 0 });
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'leave' | 'close' | null>(null);
  const [actionPending, setActionPending] = useState<'leave' | 'close' | null>(null);
  const [gameModeOpen, setGameModeOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(typing);
  const reportTimerRef = useRef<number | null>(null);
  const lastReportAtRef = useRef(0);
  const reportRevisionRef = useRef(0);
  const raceNumberRef = useRef(0);
  const isClosed = session.status === 'closed';
  const clockEnabled = game?.phase === 'countdown' || game?.phase === 'racing';
  const now = useClock(clockEnabled);
  const effectivePhase =
    game?.phase === 'countdown' && (game.startsAt ?? Number.POSITIVE_INFINITY) <= now ? 'racing' : game?.phase;
  const passage = game?.passage?.text ?? '';
  const inputAlignment = useMemo(() => alignTypeRacerInput(typing.text, passage), [passage, typing.text]);
  const correctChars = inputAlignment.correctChars;
  const localAccuracy = typingAccuracy(typing.totalKeystrokes, typing.errorKeystrokes);
  const currentPlayer = game?.currentPlayer ?? null;
  const localWpm = typingWpm(correctChars, currentPlayer?.startedAt ?? game?.startsAt ?? null, now);
  const hasTypingError = inputAlignment.hasError;
  const isTypingEnabled =
    !isClosed && effectivePhase === 'racing' && currentPlayer !== null && currentPlayer.status !== 'finished';
  const countdown = Math.max(1, Math.ceil(((game?.startsAt ?? now) - now) / 1_000));
  const members = getRoomMembers(session);
  const ownerName = members.find((member) => member.isOwner)?.displayName ?? 'The room owner';

  useEffect(() => {
    typingRef.current = typing;
  }, [typing]);

  useEffect(() => {
    if (game === undefined || raceNumberRef.current === game.raceNumber) {
      return;
    }
    raceNumberRef.current = game.raceNumber;
    const reset = { text: '', totalKeystrokes: 0, errorKeystrokes: 0 };
    typingRef.current = reset;
    setTyping(reset);
    reportRevisionRef.current = 0;
    lastReportAtRef.current = 0;
    if (reportTimerRef.current !== null) {
      window.clearTimeout(reportTimerRef.current);
      reportTimerRef.current = null;
    }
  }, [game]);

  useEffect(() => {
    if (!isTypingEnabled) {
      return;
    }
    inputRef.current?.focus({ preventScroll: true });
  }, [isTypingEnabled]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => setCopied(false), 1_800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(
    () => () => {
      if (reportTimerRef.current !== null) {
        window.clearTimeout(reportTimerRef.current);
      }
    },
    []
  );

  const displayedRacers = useMemo(() => {
    if (game === undefined || currentPlayer === null) {
      return game?.racers ?? [];
    }
    return game.racers.map((racer) =>
      racer.isCurrentPlayer && racer.status !== 'finished'
        ? {
            ...racer,
            correctChars,
            typedChars: inputAlignment.targetIndex,
            progress: passage.length < 1 ? 0 : correctChars / passage.length,
            wpm: localWpm,
            accuracy: localAccuracy,
          }
        : racer
    );
  }, [correctChars, currentPlayer, game, inputAlignment.targetIndex, localAccuracy, localWpm, passage.length]);

  function sendProgress(nextTyping: TypingState, finished: boolean) {
    if (game === undefined || game.passage === null) {
      return;
    }
    reportRevisionRef.current += 1;
    lastReportAtRef.current = Date.now();
    const nextAlignment = alignTypeRacerInput(nextTyping.text, game.passage.text);
    void reportProgress({
      roomId: session.roomId,
      sessionToken: guest.sessionToken,
      correctChars: nextAlignment.correctChars,
      typedChars: nextAlignment.targetIndex,
      totalKeystrokes: nextTyping.totalKeystrokes,
      errorKeystrokes: nextTyping.errorKeystrokes,
      revision: reportRevisionRef.current,
      ...(finished ? { typedText: nextTyping.text } : {}),
    }).catch((progressError) => {
      setNotice(userFacingError(progressError, 'Your latest progress could not be shared. Keep typing.'));
    });
  }

  function queueProgress(nextTyping: TypingState, finished: boolean) {
    if (finished) {
      if (reportTimerRef.current !== null) {
        window.clearTimeout(reportTimerRef.current);
        reportTimerRef.current = null;
      }
      sendProgress(nextTyping, true);
      return;
    }
    if (reportTimerRef.current !== null) {
      return;
    }
    const delay = Math.max(0, PROGRESS_REPORT_INTERVAL_MS - (Date.now() - lastReportAtRef.current));
    reportTimerRef.current = window.setTimeout(() => {
      reportTimerRef.current = null;
      sendProgress(typingRef.current, false);
    }, delay);
  }

  function handleTyping(nextValue: string) {
    if (!isTypingEnabled || game?.passage === null || game?.passage === undefined) {
      return;
    }
    const previous = typingRef.current;
    const candidate = nextValue.slice(0, game.passage.text.length + MAX_INSERTED_CHARACTERS);
    const isAppend = candidate.startsWith(previous.text);
    const isBacktrack = previous.text.startsWith(candidate);
    if (!isAppend && !isBacktrack) {
      inputRef.current?.setSelectionRange(previous.text.length, previous.text.length);
      return;
    }

    const addedText = isAppend ? candidate.slice(previous.text.length) : '';
    const previousAlignment = alignTypeRacerInput(previous.text, game.passage.text);
    const nextAlignment = alignTypeRacerInput(candidate, game.passage.text);
    const addedErrors = isAppend ? nextAlignment.errorCount - previousAlignment.errorCount : 0;
    const nextTyping = {
      text: candidate,
      totalKeystrokes: previous.totalKeystrokes + addedText.length,
      errorKeystrokes: previous.errorKeystrokes + addedErrors,
    };
    typingRef.current = nextTyping;
    setTyping(nextTyping);
    const finished = nextAlignment.isExact;
    queueProgress(nextTyping, finished);
    window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(candidate.length, candidate.length));
  }

  const handleTypingEvent = useEffectEvent(handleTyping);

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (
        !isTypingEnabled ||
        confirmation !== null ||
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key.length !== 1 ||
        document.activeElement === inputRef.current
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
      handleTypingEvent(`${typingRef.current.text}${event.key}`);
    }

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [confirmation, isTypingEnabled]);

  async function handleStart() {
    setStarting(true);
    setNotice(null);
    try {
      await startRace({ roomId: session.roomId, sessionToken: guest.sessionToken });
    } catch (startError) {
      setNotice(userFacingError(startError, 'The race could not be started.'));
    } finally {
      setStarting(false);
    }
  }

  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setNotice(null);
    } catch {
      setNotice('Copy failed. Select the address in your browser to share this room.');
    }
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
      <main className="grid min-h-dvh place-content-center bg-[#edf3ff] text-center text-[#5c5470]">
        <Keyboard className="mx-auto mb-4 size-13 text-[#ff5c57]" aria-hidden="true" />
        <LoaderCircle className="mx-auto size-5 animate-spin" aria-hidden="true" />
        <p className="text-xs font-bold">Setting the type…</p>
      </main>
    );
  }

  const winner = game.racers.find((racer) => racer.memberId === game.winnerMemberId) ?? game.racers[0] ?? null;
  const localRacer = displayedRacers.find((racer) => racer.isCurrentPlayer) ?? currentPlayer;

  return (
    <div className="min-h-dvh bg-[#edf3ff] bg-[linear-gradient(rgb(69_54_99/6%)_1px,transparent_1px)] bg-size-[100%_28px] text-[#27183f]">
      <header className="sticky top-0 z-30 grid h-18 grid-cols-[1fr_auto_1fr] items-center border-b border-[#b8c5e6] bg-[rgb(237_243_255/92%)] px-5 backdrop-blur-[16px] max-[760px]:h-16 max-[760px]:grid-cols-[auto_1fr_auto] max-[760px]:px-3">
        <Link
          className="inline-flex items-center gap-2.5 font-display text-lg font-[850] tracking-[-0.04em] text-[#27183f] no-underline"
          to="/"
          aria-label="Xup Games home"
        >
          <span className="grid size-8 -rotate-3 place-items-center rounded-[6px_10px_7px_9px] border-2 border-[#27183f] bg-[#ff5c57] text-base text-white shadow-[3px_3px_0_#27183f]">
            X
          </span>
          <span className="max-[760px]:hidden">Xup Type</span>
        </Link>

        <Button
          className="-rotate-1 px-4 text-[10px] tracking-[0.13em] max-[760px]:w-fit max-[760px]:justify-self-center max-[760px]:px-2.5 max-[760px]:text-[8px] [&_svg]:size-3.25"
          variant="type-code"
          size="sm"
          type="button"
          onClick={copyRoomLink}
          aria-label="Copy room link"
        >
          ROOM {session.code} {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
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
            buttonVariant="type-paper"
          />
          {session.isOwner && !isClosed && isLocalhost() ? (
            <Button
              asChild
              variant="type-paper"
              size="sm"
              className="no-underline max-[760px]:w-9 max-[760px]:px-0 [&_svg]:size-3.75"
            >
              <Link to={`/admin/${session.code}`}>
                <Beaker aria-hidden="true" /> <span className="max-[760px]:hidden">Playtest</span>
              </Link>
            </Button>
          ) : null}
          {session.isOwner && !isClosed ? (
            <Button
              variant="type-paper"
              size="sm"
              className="max-[760px]:w-9 max-[760px]:px-0 [&_svg]:size-3.75"
              type="button"
              onClick={() => setConfirmation('close')}
            >
              <LockKeyhole aria-hidden="true" /> <span className="max-[760px]:hidden">Close</span>
            </Button>
          ) : null}
          <Button
            variant="type-paper"
            size="sm"
            className="disabled:opacity-55 max-[760px]:w-9 max-[760px]:px-0 [&_svg]:size-3.75"
            type="button"
            onClick={() => setConfirmation('leave')}
            disabled={actionPending !== null}
          >
            {actionPending === 'leave' ? <LoaderCircle className="animate-spin" /> : <DoorOpen aria-hidden="true" />}
            <span className="max-[760px]:hidden">Leave</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-360 grid-cols-[minmax(0,1fr)_390px] gap-4 p-4 max-[1060px]:grid-cols-[minmax(0,1fr)_330px] max-[820px]:grid-cols-1 max-[620px]:p-2.5">
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
                <PostGameBoard
                  eyebrow={`Race ${game.raceNumber} · Photo finish`}
                  title={winner ? `${winner.displayName} wins.` : 'Race complete.'}
                  detail={
                    winner
                      ? `${formatWpm(winner.wpm)} WPM · ${formatAccuracy(winner.accuracy)} accuracy · ${formatFinishTime(winner.finishTimeMs)}`
                      : 'The final standings are locked in.'
                  }
                  icon={Trophy}
                  accent="#e54f50"
                  accentTint="#ffd65a"
                  roomId={session.roomId}
                  currentGameId={session.currentGameId}
                  currentGameType={session.gameType}
                  sessionToken={guest.sessionToken}
                  isOwner={session.isOwner}
                  isClosed={isClosed}
                  closedMessage="This room is closed. The final standings stay here to view."
                  playIntro={playIntro}
                  summary={
                    <PostGamePodium
                      label="Final podium"
                      animate={playIntro}
                      entries={game.racers
                        .filter((racer) => racer.isActive)
                        .slice(0, 3)
                        .map((racer, index) => ({
                          id: racer.memberId,
                          place: index + 1,
                          name: racer.displayName,
                          result: `${formatWpm(racer.wpm)} WPM · ${formatFinishTime(racer.finishTimeMs)}`,
                        }))}
                    />
                  }
                />
              )}
            >
              {game.phase === 'lobby' ? (
                <LobbyPanel
                  isOwner={session.isOwner}
                  isClosed={isClosed}
                  ownerName={ownerName}
                  playerCount={session.activeMemberCount}
                  starting={starting}
                  onStart={handleStart}
                  onCopy={copyRoomLink}
                />
              ) : game.phase === 'complete' ? null : (
                <div className="relative overflow-hidden rounded-[14px_26px_16px_24px] border border-[#9faed5] bg-white shadow-[7px_8px_0_#c7d3ef]">
                  <div className="flex min-h-16 items-center justify-between gap-4 border-b border-[#d9e0f2] bg-[#f9fbff] px-6 py-3 max-[620px]:px-4">
                    <div className="min-w-0">
                      <p className="m-0 text-[9px] font-[820] tracking-[0.13em] text-[#766d89] uppercase">
                        {game.passage?.kind ?? 'Passage'} · Race {game.raceNumber}
                      </p>
                      <p className="mt-1 mb-0 truncate text-xs font-[720] text-[#3c3152]" id="passage-source">
                        {game.passage?.title}{' '}
                        <span className="font-[520] text-[#817991]">by {game.passage?.author}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-5">
                      <Stat
                        label="WPM"
                        value={String(formatWpm(localRacer?.wpm ?? 0))}
                        icon={<Gauge aria-hidden="true" />}
                      />
                      <Stat label="ACCURACY" value={formatAccuracy(localRacer?.accuracy ?? 100)} />
                    </div>
                  </div>

                  <div
                    className={cn(
                      'relative min-h-[clamp(420px,calc(100dvh-245px),650px)] px-[clamp(22px,5vw,72px)] py-[clamp(42px,7vw,84px)]',
                      inputFocused && isTypingEnabled && 'ring-3 ring-inset ring-[#ff5c57]/25'
                    )}
                  >
                    <Passage text={passage} alignment={inputAlignment} showCaret={isTypingEnabled} />
                    <textarea
                      ref={inputRef}
                      className="absolute inset-0 z-10 size-full cursor-text resize-none opacity-0 disabled:cursor-default"
                      aria-label="Type the passage"
                      aria-describedby="passage-source typing-guidance"
                      value={typing.text}
                      onChange={(event) => handleTyping(event.target.value)}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      onPaste={(event) => {
                        event.preventDefault();
                        setNotice('Pasting is off for races. Type the passage to move.');
                      }}
                      onSelect={(event) => {
                        if (event.currentTarget.selectionEnd !== typing.text.length) {
                          event.currentTarget.setSelectionRange(typing.text.length, typing.text.length);
                        }
                      }}
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={!isTypingEnabled}
                    />

                    {effectivePhase === 'countdown' ? (
                      <div className="absolute inset-0 z-20 grid place-items-center bg-[rgb(39_24_63/84%)] text-center text-white backdrop-blur-[3px]">
                        <div>
                          <p className="mb-3 text-[10px] font-[850] tracking-[0.18em] text-[#b9c9ff] uppercase">
                            Hands on the keys
                          </p>
                          <strong className="block font-display text-[clamp(150px,26vw,300px)] leading-[0.72] tracking-[-0.1em] text-[#ffd65a] tabular-nums [text-shadow:8px_8px_0_rgb(0_0_0/22%)]">
                            {countdown}
                          </strong>
                          <span className="mt-8 block text-sm text-[#d8ddf1]">The full passage unlocks at zero.</span>
                        </div>
                      </div>
                    ) : null}

                    {currentPlayer?.status === 'finished' ? (
                      <div className="absolute inset-x-5 bottom-5 z-20 flex items-center justify-center gap-2 rounded-xl border border-[#82c7a8] bg-[#e4f8ef] px-4 py-3 text-xs font-[760] text-[#176b49] shadow-lg">
                        <Check className="size-4" aria-hidden="true" /> Finished in{' '}
                        {formatFinishTime(currentPlayer.finishTimeMs)}. The field has 15 seconds to follow.
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={cn(
                      'flex min-h-14 items-center justify-between gap-4 border-t border-[#d9e0f2] bg-[#f9fbff] px-6 py-3 text-xs max-[620px]:px-4',
                      hasTypingError ? 'text-[#ba383d]' : 'text-[#6f667f]'
                    )}
                    id="typing-guidance"
                    aria-live="polite"
                  >
                    <span className="inline-flex items-center gap-2 font-[680]">
                      <Keyboard className="size-4" aria-hidden="true" />
                      {hasTypingError
                        ? 'Backspace to the first red letter.'
                        : isTypingEnabled
                          ? inputFocused
                            ? 'Typing is live. Keep your eyes on the line.'
                            : 'Tap the passage to keep typing.'
                          : 'Wait for the countdown.'}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums">
                      {correctChars}/{passage.length}
                    </span>
                  </div>
                </div>
              )}
            </GameSurfaceTransition>
          </GameModeContent>
          {notice ? (
            <p
              className="mt-4 rounded-xl border border-[#e9a5a7] bg-[#fff1f1] px-4 py-3 text-xs font-[650] text-[#a83239]"
              role="alert"
            >
              {notice}
            </p>
          ) : null}
        </section>

        <RaceBoard
          racers={displayedRacers}
          onlineByMemberId={onlineByMemberId}
          phase={effectivePhase ?? 'lobby'}
          raceNumber={game.raceNumber}
        />
      </main>

      {confirmation ? (
        <TypeRacerActionDialog
          action={confirmation}
          ownerIsLeaving={session.isOwner}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmation === 'close' ? handleClose : handleLeave}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="text-right">
      <small className="mb-0.5 flex items-center justify-end gap-1 text-[8px] font-[820] tracking-[0.12em] text-[#857d95] [&_svg]:size-3">
        {icon} {label}
      </small>
      <strong className="font-display text-xl leading-none font-[850] tracking-[-0.04em] tabular-nums">{value}</strong>
    </div>
  );
}

function TypingCaret() {
  return (
    <span
      className="relative inline-block w-0 before:pointer-events-none before:absolute before:top-[-1.18em] before:left-0 before:z-2 before:h-[1.25em] before:w-[3px] before:-translate-x-[2px] before:rounded-full before:bg-[#e0aa12] before:content-[''] motion-safe:before:animate-pulse"
      data-caret="true"
      aria-hidden="true"
    />
  );
}

function InsertedCharacters({ alignment, targetIndex }: { alignment: TypeRacerInputAlignment; targetIndex: number }) {
  return (alignment.insertionsByTargetIndex.get(targetIndex) ?? []).map((insertion) => (
    <span
      className="relative text-[#e04d5b]"
      data-character-state="wrong"
      data-inserted-character="true"
      key={insertion.key}
    >
      {insertion.character}
    </span>
  ));
}

function Passage({
  text,
  alignment,
  showCaret,
}: {
  text: string;
  alignment: TypeRacerInputAlignment;
  showCaret: boolean;
}) {
  return (
    <p
      className="relative z-1 m-0 font-mono text-[clamp(24px,2.7vw,37px)] leading-[1.55] font-[560] tracking-[-0.035em] text-[#aaa6b0] select-none"
      data-testid="race-passage"
    >
      {passageWords(text).map((word) => (
        <span className="inline-block whitespace-pre" data-passage-word key={`${word.startIndex}-${word.text}`}>
          {word.characters.map(({ character, index, key }) => {
            const characterState = alignment.targetStates[index] ?? 'pending';
            return (
              <span className="contents" key={key}>
                <InsertedCharacters alignment={alignment} targetIndex={index} />
                {showCaret && alignment.targetIndex === index ? <TypingCaret /> : null}
                <span
                  className={cn(
                    'relative transition-colors duration-75',
                    characterState === 'correct' && 'text-[#2d243c]',
                    characterState === 'wrong' && 'text-[#e04d5b]'
                  )}
                  data-character-state={characterState}
                  data-expected-space={character === ' ' ? 'true' : undefined}
                >
                  {character}
                </span>
              </span>
            );
          })}
        </span>
      ))}
      <InsertedCharacters alignment={alignment} targetIndex={text.length} />
      {showCaret && alignment.targetIndex === text.length ? <TypingCaret /> : null}
    </p>
  );
}

function LobbyPanel({
  isOwner,
  isClosed,
  ownerName,
  playerCount,
  starting,
  onStart,
  onCopy,
}: {
  isOwner: boolean;
  isClosed: boolean;
  ownerName: string;
  playerCount: number;
  starting: boolean;
  onStart: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="relative flex min-h-[calc(100dvh-104px)] flex-col justify-center overflow-hidden rounded-[14px_26px_16px_24px] border border-[#9faed5] bg-white px-[clamp(28px,7vw,92px)] py-16 shadow-[7px_8px_0_#c7d3ef] max-[820px]:min-h-145">
      <div className="absolute top-10 right-10 grid size-20 rotate-4 place-items-center rounded-[12px_22px_14px_20px] border-2 border-[#27183f] bg-[#ffd65a] shadow-[6px_6px_0_#27183f] max-[620px]:top-7 max-[620px]:right-6 max-[620px]:size-14">
        <LibraryBig className="size-9 max-[620px]:size-6" aria-hidden="true" />
      </div>
      <p className="mb-5 text-[10px] font-[850] tracking-[0.17em] text-[#ff5c57] uppercase">The reading room is open</p>
      <h1 className="m-0 max-w-180 font-display text-[clamp(62px,8.5vw,118px)] leading-[0.78] font-[880] tracking-[-0.075em] text-[#27183f]">
        Every letter
        <span className="block text-[#4f6ee8]">moves you.</span>
      </h1>
      <p className="mt-8 mb-0 max-w-145 text-[clamp(16px,2vw,20px)] leading-[1.6] text-[#6c647d]">
        {isOwner
          ? 'Start when the room is ready. Everyone gets the same fiction excerpt and four seconds to find the home row.'
          : `${ownerName} starts the race. You will see every typo, every recovery, and every racer moving down the line.`}
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-3">
        {isOwner && !isClosed ? (
          <Button
            variant="type-primary"
            size="xl"
            className="disabled:opacity-65"
            type="button"
            onClick={onStart}
            disabled={starting}
          >
            {starting ? <LoaderCircle className="animate-spin" /> : <Play aria-hidden="true" />}
            {starting ? 'Setting the passage…' : 'Start the countdown'}
          </Button>
        ) : (
          <span className="inline-flex h-13 items-center gap-2 rounded-[8px_13px_9px_12px] border border-[#c3cce3] bg-[#f4f7ff] px-5 text-xs font-[720] text-[#5e5670]">
            <Timer className="size-4" aria-hidden="true" /> Waiting for {ownerName}
          </span>
        )}
        <Button
          className="h-13 px-5 text-xs font-[720] focus-visible:outline-[rgb(79_110_232/28%)] [&_svg]:size-4"
          variant="type-paper"
          type="button"
          onClick={onCopy}
        >
          <Copy aria-hidden="true" /> Invite racers
        </Button>
      </div>
      <div className="mt-12 flex items-center gap-4 border-t border-[#dce3f3] pt-6 text-xs text-[#746c84]">
        <span className="grid size-10 place-items-center rounded-full bg-[#e7ecff] text-[#4f6ee8]">
          <UsersRound className="size-4.5" aria-hidden="true" />
        </span>
        <span>
          <strong className="block text-sm text-[#352947]">{playerCount} on the line</strong>
          Up to 50 racers. Speed wins; accuracy tells the story.
        </span>
      </div>
    </div>
  );
}

function RaceBoard({
  racers,
  onlineByMemberId,
  phase,
  raceNumber,
}: {
  racers: Racer[];
  onlineByMemberId: ReadonlyMap<string, boolean>;
  phase: RaceView['phase'];
  raceNumber: number;
}) {
  const orderedRacers = useRaceBoardOrder(racers, raceNumber, phase);
  const racerOrderKey = orderedRacers.map((racer) => racer.memberId).join('|');
  const setRacerItemRef = useListReorderAnimation(racerOrderKey, {
    animate: phase === 'complete',
    resetKey: raceNumber,
  });

  return (
    <aside className="flex h-[calc(100dvh-104px)] min-h-145 flex-col overflow-hidden rounded-[22px_12px_24px_14px] border border-[#9faed5] bg-[#2b1b45] text-white shadow-[7px_8px_0_#c7d3ef] max-[820px]:h-145">
      <div className="flex items-center justify-between border-b border-white/12 px-5 py-5">
        <div>
          <p className="m-0 text-[10px] font-[830] tracking-[0.15em] text-[#aebcf1] uppercase">Live field</p>
          <h2 className="mt-1 mb-0 font-display text-[25px] font-[850] tracking-[-0.045em]">
            {orderedRacers.length} racer{orderedRacers.length === 1 ? '' : 's'}
          </h2>
        </div>
        <div className="grid size-11 place-items-center rounded-[10px_16px_11px_15px] bg-[#ff5c57] shadow-[3px_3px_0_#120b1d]">
          {phase === 'complete' ? (
            <Trophy className="size-5" aria-hidden="true" />
          ) : (
            <Gauge className="size-5" aria-hidden="true" />
          )}
        </div>
      </div>

      <ol
        className="m-0 flex-1 list-none overflow-y-auto p-3.5 [scrollbar-color:#776991_transparent]"
        aria-label="Racer standings"
      >
        {orderedRacers.map((racer, index) => {
          const color = memberColor(racer.memberId);
          const progress = Math.max(0, Math.min(1, racer.progress));
          const isDisconnected = racer.isActive && onlineByMemberId.get(racer.memberId) === false;
          const playerState = !racer.isActive ? 'inactive' : isDisconnected ? 'disconnected' : 'connected';
          const racerStyle = { '--racer-progress': `${progress * 100}%`, '--racer-color': color } as CSSProperties;
          return (
            <li
              ref={(element) => setRacerItemRef(racer.memberId, element)}
              className="relative mb-2.5 rounded-[10px_15px_11px_14px] border border-[#6e5c87]/55 bg-[#37274f] px-3.5 py-3 transition-[border-color,background-color,opacity,filter] data-[current=true]:border-[#ffd65a]/60 data-[current=true]:bg-[#443452] data-[player-state=disconnected]:opacity-55 data-[player-state=disconnected]:saturate-50 data-[player-state=inactive]:opacity-40 data-[player-state=inactive]:saturate-25 data-[reordering=true]:z-2 data-[reordering=true]:pointer-events-none motion-reduce:transition-none"
              key={racer.memberId}
              data-current={racer.isCurrentPlayer}
              data-display-position={index + 1}
              data-member-id={racer.memberId}
              data-player-state={playerState}
            >
              <div className="mb-2.5 grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <strong className="self-start pt-0.5 text-[#bcb1ca] tabular-nums">{racer.rank}</strong>
                <span className="grid min-w-0">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <strong className="truncate text-sm text-white">{racer.displayName}</strong>
                    {racer.rank === 1 && phase !== 'lobby' ? (
                      <Crown className="size-3 shrink-0 text-[#ffd65a]" aria-label="Leader" />
                    ) : null}
                  </span>
                  {playerState !== 'connected' ? (
                    <small className="mt-0.5 text-[10px] leading-none font-[760] tracking-[0.04em] text-[#c9bed7] uppercase">
                      {playerState === 'inactive' ? 'No longer playing' : 'Disconnected'}
                    </small>
                  ) : null}
                </span>
                <span className="self-start font-mono text-sm text-[#d7cfdf] tabular-nums">
                  {formatWpm(racer.wpm)} <small className="text-[10px]">WPM</small>
                </span>
              </div>
              <div
                className="relative h-6 overflow-hidden rounded-full border border-[#806f96]/40 bg-[#120d1f] shadow-[inset_0_1px_3px_rgb(0_0_0/65%)]"
                style={racerStyle}
                role="img"
                data-progress-track="true"
                aria-label={`${racer.displayName}: ${Math.round(progress * 100)} percent, ${formatWpm(racer.wpm)} words per minute`}
              >
                <span
                  className="absolute inset-y-0 left-0 w-[var(--racer-progress)] bg-[color:var(--racer-color)] opacity-75 shadow-[inset_0_1px_0_rgb(255_255_255/28%)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  data-progress-fill="true"
                />
                <span className="absolute top-1/2 left-[clamp(10px,var(--racer-progress),calc(100%-10px))] grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[4px_7px_4px_6px] border border-[#0b0711] bg-[color:var(--racer-color)] text-[10px] font-[900] text-[#160d21] shadow-[2px_1px_0_#0b0711] transition-[left] duration-500 ease-out motion-reduce:transition-none">
                  {racer.status === 'finished' ? (
                    <Check className="size-2.5" aria-hidden="true" />
                  ) : (
                    racer.displayName[0]?.toUpperCase()
                  )}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] font-[650] text-[#aaa2b6]">
                <span>{formatAccuracy(racer.accuracy)} accurate</span>
                <span>
                  {racer.status === 'finished'
                    ? formatFinishTime(racer.finishTimeMs)
                    : `${Math.round(progress * 100)}%`}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function TypeRacerActionDialog({
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
  const title = isClosing ? 'Close this race room?' : 'Leave this race?';
  const detail = isClosing
    ? 'Typing stops for everyone, but the latest standings remain visible.'
    : ownerIsLeaving
      ? 'The room stays open. Ownership will pass to the next active player.'
      : 'You can rejoin from this browser while the room remains open.';
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="box-border w-[min(420px,calc(100vw-32px))] max-w-105 overflow-visible rounded-[22px_14px_24px_16px] border border-[#aaafd0] bg-white p-0 text-[#27183f] shadow-[9px_10px_0_rgb(39_24_63/18%),0_28px_80px_rgb(39_24_63/28%)] motion-reduce:animate-none">
        <div className="px-8 pt-8 pb-7 text-center max-[520px]:px-5.5">
          <div className="mx-auto -mt-15 mb-6 grid size-14 -rotate-3 place-items-center rounded-[10px_17px_11px_16px] border-2 border-[#27183f] bg-[#ff5c57] text-white shadow-[5px_5px_0_#27183f] [&_svg]:size-6">
            {isClosing ? <LockKeyhole aria-hidden="true" /> : <DoorOpen aria-hidden="true" />}
          </div>
          <AlertDialogTitle asChild>
            <h2 className="m-0 font-display text-3xl font-[850] tracking-[-0.05em]">{title}</h2>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <p className="mx-auto mt-3 mb-6 max-w-84 text-[13px] leading-[1.55] text-[#6c647d]">{detail}</p>
          </AlertDialogDescription>
          <div className="grid grid-cols-2 gap-2.5 max-[520px]:grid-cols-1">
            <AlertDialogCancel variant="type-paper" className="min-h-11 text-xs font-[760] max-[520px]:order-2">
              Stay in the race
            </AlertDialogCancel>
            <AlertDialogAction variant="type-destructive" className="min-h-11 text-xs" onClick={onConfirm}>
              {isClosing ? 'Close room' : 'Leave race'}
            </AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
