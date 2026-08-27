import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Beaker, Check, Copy, Dices, LoaderCircle, Play, Trophy } from 'lucide-react';
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import MiniGameChallenge, { type MiniGamePoint } from './MiniGameChallenges';
import { MiniGameAnswerReveal, MiniGameRoundPodium } from './MiniGameRoundRecap';
import MiniGamesConfigurationDialog, { formatMiniGamesDuration } from './MiniGamesConfigurationDialog';
import NewMiniGameChallenge, { type NewMiniGameSubmission } from './NewMiniGameChallenges';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;
type GameView = FunctionReturnType<typeof api.miniGames.getGame>;
type MiniGameRound = NonNullable<GameView['round']>;
type LinePoint = { x: number; y: number };
const ROULETTE_SLOT_IDS = [
  'slot-a',
  'slot-b',
  'slot-c',
  'slot-d',
  'slot-e',
  'slot-f',
  'slot-g',
  'slot-h',
  'slot-i',
  'slot-j',
  'slot-k',
  'slot-l',
  'slot-m',
  'slot-n',
] as const;
const ROULETTE_REST_MS = 420;
const ROULETTE_SPIN_MS = 2_400;
const MINI_GAME_ROUND_MS = 10_000;
const MINI_GAME_ANSWER_REVEAL_MS = 3_000;
const MINI_GAME_RESULTS_MS = 8_000;
const MINI_GAME_GLYPHS: Record<MiniGameRound['miniGame']['id'], string> = {
  straightLine: '✏️',
  orangeEmojis: '🍊',
  guessPercentage: '◔',
  circleCenter: '◎',
  batteryPercentage: '🔋',
  flashbackTiles: '▦',
  copycatSequence: '◆',
  crowdCount: '●',
  dropZone: '📦',
  shadowMatch: '★',
  flagFrenzy: '⚑',
  brakeCheck: '🏁',
  signalSnap: '⚡',
};
const MINI_GAME_CARD_COLORS = ['bg-[#bde8ff]', 'bg-[#fff0b8]', 'bg-[#eadfff]', 'bg-[#d9f7ca]', 'bg-[#ffdcd7]'] as const;

function useClock(enabled: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [enabled]);
  return now;
}

function CountdownCircle({ remainingMs, totalMs, label }: { remainingMs: number; totalMs: number; label: string }) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const progress = Math.min(1, Math.max(0, remainingMs / totalMs));
  const timerStyle = { '--countdown-progress': `${progress * 360}deg` } as CSSProperties;

  return (
    <strong
      className="grid size-16 shrink-0 place-items-center rounded-full bg-[conic-gradient(from_-90deg,#3155d9_var(--countdown-progress),#ccd6e6_0)] p-1 shadow-[3px_3px_0_#17203a] transition-[--countdown-progress] duration-100 before:col-start-1 before:row-start-1 before:size-13 before:rounded-full before:border-2 before:border-[#17203a] before:bg-[#ffd85c] before:content-[''] motion-reduce:transition-none data-[urgent=true]:bg-[conic-gradient(from_-90deg,#e85d2a_var(--countdown-progress),#ecd4c9_0)]"
      style={timerStyle}
      data-urgent={remainingMs <= 3_000}
      role="timer"
      aria-label={`${label}: ${seconds} seconds`}
    >
      <span className="z-1 col-start-1 row-start-1 font-display text-xl leading-none font-[900] tabular-nums">
        {seconds}
      </span>
    </strong>
  );
}

function MiniGameRoundHeader({
  round,
  totalRounds,
  remainingMs,
  totalMs,
  timerLabel,
  phaseLabel,
}: {
  round: MiniGameRound;
  totalRounds: number;
  remainingMs: number;
  totalMs: number;
  timerLabel: string;
  phaseLabel?: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 border-b border-[#d5ddea] bg-white px-5 py-4"
      data-mini-game-round-header
    >
      <div>
        <p className="mb-1 text-[9px] font-[850] tracking-[0.14em] text-[#e85d2a] uppercase">
          {round.miniGame.eyebrow} · Round {round.roundNumber} of {totalRounds}
          {phaseLabel === undefined ? '' : ` · ${phaseLabel}`}
        </p>
        <h1 className="m-0 font-display text-[clamp(25px,4vw,38px)] leading-none font-[880] tracking-[-0.05em]">
          {round.miniGame.title}
        </h1>
      </div>
      <CountdownCircle remainingMs={remainingMs} totalMs={totalMs} label={timerLabel} />
    </div>
  );
}

function RoulettePanel({ round, miniGames }: { round: MiniGameRound; miniGames: GameView['miniGames'] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const targetIndex = 11;
  const selectedIndex = Math.max(
    0,
    miniGames.findIndex((game) => game.id === round.miniGame.id)
  );
  const cards = ROULETTE_SLOT_IDS.map((slotId, index) => {
    const sourceIndex =
      (((selectedIndex - targetIndex + index) % miniGames.length) + miniGames.length) % miniGames.length;
    return { slotId, game: miniGames[sourceIndex] ?? round.miniGame, index };
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const target = track?.children.item(targetIndex) as HTMLElement | null;
    if (viewport === null || track === null || target === null) return;
    track.style.transition = 'none';
    track.style.transform = 'translate3d(0, 0, 0)';
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const frame = window.requestAnimationFrame(() => {
      const offset = Math.max(0, target.offsetLeft - (viewport.clientWidth - target.offsetWidth) / 2);
      track.style.transition = reducedMotion
        ? 'none'
        : `transform ${ROULETTE_SPIN_MS}ms cubic-bezier(.42,0,.18,1) ${ROULETTE_REST_MS}ms`;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section
      className="relative grid min-h-[clamp(470px,calc(100dvh-210px),680px)] place-content-center overflow-hidden px-0 py-10"
      aria-label="Mini-game roulette"
    >
      <div className="mb-8 px-5 text-center">
        <p className="mb-2 text-[10px] font-[850] tracking-[0.16em] text-[#e85d2a] uppercase">
          Round {round.roundNumber} · Picking the next challenge
        </p>
        <h1 className="m-0 font-display text-[clamp(42px,7vw,76px)] leading-[0.88] font-[900] tracking-[-0.07em] text-[#17203a]">
          Spin the mix.
        </h1>
      </div>
      <div ref={viewportRef} className="relative w-full overflow-hidden py-5" aria-live="polite">
        <div
          ref={trackRef}
          className="flex w-max items-stretch gap-3 px-4 will-change-transform motion-reduce:transition-none"
          data-roulette-track="true"
        >
          {cards.map(({ game, index, slotId }) => (
            <article
              key={slotId}
              className={cn(
                'grid h-38 w-[min(68vw,240px)] shrink-0 place-content-center rounded-[20px_12px_22px_14px] border-2 border-[#17203a] px-5 text-center shadow-[5px_5px_0_#17203a]',
                MINI_GAME_CARD_COLORS[index % MINI_GAME_CARD_COLORS.length],
                index % 2 === 0 ? '-rotate-1' : 'rotate-1'
              )}
              data-roulette-target={index === targetIndex || undefined}
            >
              <span className="mb-1 text-4xl" aria-hidden="true">
                {MINI_GAME_GLYPHS[game.id]}
              </span>
              <strong className="font-display text-lg font-[850] tracking-[-0.035em]">{game.title}</strong>
              <small className="mt-1 text-[9px] font-[760] tracking-[0.08em] text-[#68758b] uppercase">
                {game.eyebrow}
              </small>
            </article>
          ))}
        </div>
        <span className="absolute top-0 left-1/2 z-2 h-full w-0.75 -translate-x-1/2 bg-[#e85d2a]" aria-hidden="true" />
        <span
          className="absolute top-0 left-1/2 z-3 -translate-x-1/2 border-x-9 border-t-12 border-x-transparent border-t-[#e85d2a]"
          aria-hidden="true"
        />
      </div>
      <p className="mt-7 mb-0 text-center text-xs font-[720] text-[#718097]">Everyone lands on the same mini-game.</p>
    </section>
  );
}

function StraightLineChallenge({
  round,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onSubmit: (points: LinePoint[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<LinePoint[]>([]);
  const drawingRef = useRef(false);
  const pointsRef = useRef<LinePoint[]>([]);
  const target = round.lineTarget;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas === null || canvas === undefined || context === null || context === undefined || target === null) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#fffdf5';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(23, 32, 58, .07)';
    context.lineWidth = 1;
    for (let x = 30; x < canvas.width; x += 30) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    for (let y = 30; y < canvas.height; y += 30) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
    if (points.length > 1) {
      context.beginPath();
      context.moveTo((points[0]?.x ?? 0) * canvas.width, (points[0]?.y ?? 0) * canvas.height);
      for (const point of points.slice(1)) context.lineTo(point.x * canvas.width, point.y * canvas.height);
      context.strokeStyle = '#17203a';
      context.lineWidth = 7;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
    }
    for (const marker of [
      { point: target.start, color: '#3155d9', label: 'START' },
      { point: target.end, color: '#e85d2a', label: 'FINISH' },
    ]) {
      context.beginPath();
      context.arc(marker.point.x * canvas.width, marker.point.y * canvas.height, 14, 0, Math.PI * 2);
      context.fillStyle = marker.color;
      context.fill();
      context.font = '800 12px Geist, sans-serif';
      context.textAlign = 'center';
      context.fillText(marker.label, marker.point.x * canvas.width, marker.point.y * canvas.height - 24);
    }
  }, [points, target]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(1, bounds.width))),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / Math.max(1, bounds.height))),
    };
  }

  function start(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const first = pointFromEvent(event);
    pointsRef.current = [first];
    setPoints([first]);
  }

  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    const next = pointFromEvent(event);
    const previous = pointsRef.current.at(-1);
    if (previous !== undefined && Math.hypot(next.x - previous.x, next.y - previous.y) < 0.004) return;
    if (pointsRef.current.length >= 299) return;
    pointsRef.current = [...pointsRef.current, next];
    setPoints(pointsRef.current);
  }

  function finish(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    drawingRef.current = false;
    const next = pointFromEvent(event);
    const finalPoints = [...pointsRef.current, next].slice(-300);
    pointsRef.current = finalPoints;
    setPoints(finalPoints);
    if (finalPoints.length >= 2) onSubmit(finalPoints);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLCanvasElement>) {
    if (disabled || target === null) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!drawingRef.current) {
        drawingRef.current = true;
        pointsRef.current = [target.start];
        setPoints([target.start]);
      } else if (pointsRef.current.length >= 2) {
        drawingRef.current = false;
        onSubmit(pointsRef.current);
      }
      return;
    }
    const direction =
      event.key === 'ArrowLeft'
        ? { x: -0.025, y: 0 }
        : event.key === 'ArrowRight'
          ? { x: 0.025, y: 0 }
          : event.key === 'ArrowUp'
            ? { x: 0, y: -0.025 }
            : event.key === 'ArrowDown'
              ? { x: 0, y: 0.025 }
              : null;
    if (direction === null) return;
    event.preventDefault();
    if (!drawingRef.current) {
      drawingRef.current = true;
      pointsRef.current = [target.start];
    }
    if (pointsRef.current.length >= 300) return;
    const previous = pointsRef.current.at(-1) ?? target.start;
    const next = {
      x: Math.min(1, Math.max(0, previous.x + direction.x)),
      y: Math.min(1, Math.max(0, previous.y + direction.y)),
    };
    pointsRef.current = [...pointsRef.current, next];
    setPoints(pointsRef.current);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={900}
        height={480}
        className="block aspect-[15/8] w-full touch-none rounded-[18px_11px_20px_13px] border-2 border-[#17203a] bg-[#fffdf5] shadow-[5px_5px_0_#b8c8e5] disabled:cursor-default"
        aria-label="Draw one line from the blue start dot to the orange finish dot"
        aria-describedby="straight-line-keyboard-help"
        tabIndex={disabled ? -1 : 0}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={() => {
          drawingRef.current = false;
        }}
        onKeyDown={handleKeyDown}
      />
      <p id="straight-line-keyboard-help" className="mt-3 mb-0 text-center text-xs font-[680] text-[#68758b]">
        One stroke only. Draw from the blue start dot to the orange finish dot.
      </p>
    </div>
  );
}

function EmojiChallenge({
  round,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onSubmit: (clickedIds: string[]) => void;
}) {
  const [clickedIds, setClickedIds] = useState<string[]>([]);
  const submittedRef = useRef(false);
  const targetEmoji = round.targetEmoji ?? '🍊';
  const targetIds = useMemo(
    () => round.emojiItems.filter((item) => item.emoji === targetEmoji).map((item) => item.id),
    [round.emojiItems, targetEmoji]
  );
  const targetFound = targetIds.filter((id) => clickedIds.includes(id)).length;

  useEffect(() => {
    if (!disabled && !submittedRef.current && targetIds.length > 0 && targetFound === targetIds.length) {
      submittedRef.current = true;
      onSubmit(clickedIds);
    }
  }, [clickedIds, disabled, onSubmit, targetFound, targetIds.length]);

  return (
    <div>
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[16px_10px_18px_12px] border-2 border-[#17203a] bg-[#fff0b8] px-[clamp(16px,4vw,28px)] py-3 shadow-[5px_5px_0_#e85d2a]">
        <div className="flex min-w-0 items-center gap-4">
          <span className="text-[10px] font-[850] tracking-[0.16em] text-[#a43f1b] uppercase">Find this emoji:</span>
          <strong
            className="text-[clamp(38px,6vw,54px)] leading-none"
            role="img"
            aria-label={`Target emoji ${targetEmoji}`}
          >
            {targetEmoji}
          </strong>
        </div>
        <p className="m-0 text-right text-xs font-[760] text-[#53627a]" aria-live="polite">
          {targetFound} of {round.targetCount} found
        </p>
      </div>
      <div className="relative min-h-[clamp(360px,54dvh,560px)] overflow-hidden rounded-[18px_11px_20px_13px] border-2 border-[#17203a] bg-[#eef6ff] shadow-[5px_5px_0_#b8c8e5]">
        {round.emojiItems.map((item, index) => {
          const clicked = clickedIds.includes(item.id);
          const isTarget = item.emoji === targetEmoji;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                'absolute grid size-[clamp(34px,5vw,50px)] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-transparent bg-white/72 text-[clamp(20px,3.2vw,30px)] shadow-[0_4px_10px_rgb(23_32_58/10%)] transition-[transform,opacity,border-color,background-color] hover:scale-110 focus-visible:border-[#3155d9] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#3155d9]/30 disabled:cursor-default motion-reduce:transition-none data-[clicked=true]:scale-75 data-[clicked=true]:opacity-55',
                clicked && isTarget && 'border-[#16815f] bg-[#dcf7ea]',
                clicked && !isTarget && 'border-[#c94b3f] bg-[#fff0ed]'
              )}
              style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, rotate: `${item.rotation}deg` }}
              aria-label={`${item.emoji} emoji ${index + 1}`}
              aria-pressed={clicked}
              data-clicked={clicked}
              disabled={disabled || clicked}
              onClick={() => setClickedIds((current) => [...current, item.id])}
            >
              {item.emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoundResults({ game, now }: { game: GameView; now: number }) {
  const round = game.round;
  if (round === null) return null;
  const resultsStartedAt = game.phaseStartedAt ?? (game.phaseEndsAt ?? now) - MINI_GAME_RESULTS_MS;
  const answerRevealEndsAt = resultsStartedAt + MINI_GAME_ANSWER_REVEAL_MS;
  const revealingAnswer = now < answerRevealEndsAt;
  const remainingMs = Math.max(0, (revealingAnswer ? answerRevealEndsAt : (game.phaseEndsAt ?? now)) - now);
  return (
    <section className="min-h-[clamp(470px,calc(100dvh-210px),680px)]">
      <MiniGameRoundHeader
        round={round}
        totalRounds={game.totalRounds}
        remainingMs={remainingMs}
        totalMs={revealingAnswer ? MINI_GAME_ANSWER_REVEAL_MS : MINI_GAME_RESULTS_MS - MINI_GAME_ANSWER_REVEAL_MS}
        timerLabel={revealingAnswer ? 'Round replay' : 'Next spin'}
        phaseLabel={revealingAnswer ? 'Replay' : 'Round winners'}
      />
      {revealingAnswer ? (
        <MiniGameAnswerReveal
          round={round}
          result={game.currentResult ?? game.roundResults.find((result) => result.isCurrentPlayer) ?? null}
        />
      ) : (
        <MiniGameRoundPodium game={game} />
      )}
    </section>
  );
}

type Standing = GameView['standings'][number];
type StandingMemberId = Standing['memberId'];

function reconcileStandingOrder(previousIds: StandingMemberId[], standingIds: StandingMemberId[]) {
  const currentIds = new Set(standingIds);
  const knownIds = new Set(previousIds);
  return [
    ...previousIds.filter((memberId) => currentIds.has(memberId)),
    ...standingIds.filter((memberId) => !knownIds.has(memberId)),
  ];
}

function useMiniGameStandingOrder(standings: GameView['standings'], roundNumber: number, phase: GameView['phase']) {
  const [frozenOrder, setFrozenOrder] = useState<{ roundNumber: number; memberIds: StandingMemberId[] }>(() => ({
    roundNumber,
    memberIds: standings.map((standing) => standing.memberId),
  }));
  const roundIsLive = phase === 'selecting' || phase === 'playing';
  const standingIdsKey = standings.map((standing) => standing.memberId).join('|');
  const standingIds = useMemo(
    () => (standingIdsKey === '' ? [] : (standingIdsKey.split('|') as StandingMemberId[])),
    [standingIdsKey]
  );
  const baseIds = frozenOrder.roundNumber === roundNumber ? frozenOrder.memberIds : standingIds;
  const nextIds = useMemo(() => reconcileStandingOrder(baseIds, standingIds), [baseIds, standingIds]);

  useEffect(() => {
    if (!roundIsLive) return;
    setFrozenOrder((previous) => {
      if (previous.roundNumber === roundNumber && previous.memberIds.join('|') === nextIds.join('|')) return previous;
      return { roundNumber, memberIds: nextIds };
    });
  }, [nextIds, roundIsLive, roundNumber]);

  if (!roundIsLive) return standings;
  const standingByMemberId = new Map(standings.map((standing) => [standing.memberId, standing]));
  return nextIds.flatMap((memberId) => {
    const standing = standingByMemberId.get(memberId);
    return standing === undefined ? [] : [standing];
  });
}

function Standings({ game }: { game: GameView }) {
  const roundNumber = game.round?.roundNumber ?? game.currentRoundNumber;
  const roundIsLive = game.phase === 'selecting' || game.phase === 'playing';
  const resultByMemberId = useMemo(
    () => new Map(game.roundResults.map((result) => [result.memberId, result])),
    [game.roundResults]
  );
  const preRoundStandings = useMemo(() => {
    if (!roundIsLive) return game.standings;
    return game.standings
      .map((standing) => {
        const result = resultByMemberId.get(standing.memberId);
        const roundHasFinished = result !== undefined && result.status !== 'waiting';
        return {
          ...standing,
          totalScore: standing.totalScore - (roundHasFinished ? result.score : 0),
          roundsFinished: standing.roundsFinished - (roundHasFinished ? 1 : 0),
        };
      })
      .sort(
        (first, second) => second.totalScore - first.totalScore || first.displayName.localeCompare(second.displayName)
      );
  }, [game.standings, resultByMemberId, roundIsLive]);
  const orderedStandings = useMiniGameStandingOrder(preRoundStandings, roundNumber, game.phase);
  const standingsOrderKey = orderedStandings.map((standing) => standing.memberId).join('|');
  const setStandingItemRef = useListReorderAnimation(standingsOrderKey, {
    animate: game.phase === 'roundResults',
    resetKey: `${game.gameNumber}:${roundNumber}`,
  });

  return (
    <aside
      className={cn(
        'flex flex-col overflow-hidden rounded-[18px_11px_20px_13px] border border-[#aebed5] bg-[#17203a] text-white shadow-[6px_7px_0_#a9c6ff]',
        GAME_STANDINGS_SIDEBAR_HEIGHT_CLASS,
        'max-[820px]:h-auto max-[820px]:max-h-96'
      )}
      aria-label="Mini Game Mix standings"
    >
      <div className="flex items-center justify-between border-b border-white/12 px-4 py-4">
        <div>
          <p className="mb-0.5 text-[9px] font-[820] tracking-[0.13em] text-[#9ec1ff] uppercase">Running total</p>
          <h2 className="m-0 font-display text-xl font-[850]">Standings</h2>
        </div>
        <Trophy className="size-5 text-[#ffd85c]" aria-hidden="true" />
      </div>
      <ol className="m-0 grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto p-3" aria-label="Player standings">
        {orderedStandings.map((standing, index) => {
          const displayRank = roundIsLive ? index + 1 : standing.rank;
          return (
            <li
              key={standing.memberId}
              ref={(element) => setStandingItemRef(standing.memberId, element)}
              className={cn(
                'grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 rounded-[11px_7px_12px_8px] px-2.5 py-2.5 transition-[background-color,opacity] data-[reordering=true]:z-2 data-[reordering=true]:pointer-events-none motion-reduce:transition-none',
                standing.isCurrentPlayer && 'bg-white/10',
                !standing.isActive && 'opacity-45'
              )}
              data-display-position={index}
              data-display-rank={displayRank}
              data-authoritative-rank={standing.rank}
            >
              <span className="grid size-6 place-items-center rounded-full bg-white/10 text-[10px] font-[820]">
                {displayRank}
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-xs">
                  {standing.displayName}
                  {standing.isCurrentPlayer ? ' (you)' : ''}
                </strong>
                <small className="text-[9px] text-[#aebbd0]">{standing.roundsFinished} rounds scored</small>
              </span>
              <strong className="font-display text-sm text-[#ffd85c] tabular-nums">{standing.totalScore}</strong>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

export default function MiniGamesRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  const navigate = useNavigate();
  const game = useQuery(api.miniGames.getGame, { roomId: session.roomId, sessionToken: guest.sessionToken });
  const startGame = useMutation(api.miniGames.startGame);
  const configureGame = useMutation(api.miniGames.configureGame);
  const submitStraightLine = useMutation(api.miniGames.submitStraightLine);
  const submitOrangeEmojis = useMutation(api.miniGames.submitOrangeEmojis);
  const submitEstimate = useMutation(api.miniGames.submitEstimate);
  const submitCircleCenter = useMutation(api.miniGames.submitCircleCenter);
  const submitChallenge = useMutation(api.miniGames.submitChallenge);
  const leaveRoom = useMutation(api.rooms.leave);
  const closeRoom = useMutation(api.rooms.close);
  const { onlineByMemberId } = useRoomPresence({ roomId: session.roomId, sessionToken: guest.sessionToken });
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [gameModeOpen, setGameModeOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<'leave' | 'close' | null>(null);
  const [actionPending, setActionPending] = useState<'leave' | 'close' | null>(null);
  const isClosed = session.status === 'closed';
  const now = useClock(game?.phase === 'selecting' || game?.phase === 'playing' || game?.phase === 'roundResults');
  const members = getRoomMembers(session);
  const ownerName = members.find((member) => member.isOwner)?.displayName ?? 'The room owner';

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1_800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copyRoomLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setNotice(null);
    } catch {
      setNotice('Copy failed. Select the address in your browser to share this room.');
    }
  }

  async function start() {
    setStarting(true);
    setNotice(null);
    try {
      await startGame({ roomId: session.roomId, sessionToken: guest.sessionToken });
    } catch (error) {
      setNotice(userFacingError(error, 'Mini Game Mix could not be started.'));
    } finally {
      setStarting(false);
    }
  }

  async function submitLine(points: LinePoint[]) {
    setNotice(null);
    try {
      await submitStraightLine({ roomId: session.roomId, sessionToken: guest.sessionToken, points });
    } catch (error) {
      setNotice(userFacingError(error, 'Your line could not be scored.'));
    }
  }

  async function submitEmojis(clickedIds: string[]) {
    setNotice(null);
    try {
      await submitOrangeEmojis({ roomId: session.roomId, sessionToken: guest.sessionToken, clickedIds });
    } catch (error) {
      setNotice(userFacingError(error, 'Your emoji picks could not be scored.'));
    }
  }

  async function submitNumericEstimate(guess: number) {
    setNotice(null);
    try {
      await submitEstimate({ roomId: session.roomId, sessionToken: guest.sessionToken, guess });
    } catch (error) {
      setNotice(userFacingError(error, 'Your estimate could not be scored.'));
    }
  }

  async function submitCirclePoint(point: MiniGamePoint) {
    setNotice(null);
    try {
      await submitCircleCenter({ roomId: session.roomId, sessionToken: guest.sessionToken, point });
    } catch (error) {
      setNotice(userFacingError(error, 'Your center point could not be scored.'));
    }
  }

  async function submitNewChallenge(submission: NewMiniGameSubmission) {
    setNotice(null);
    try {
      await submitChallenge({ roomId: session.roomId, sessionToken: guest.sessionToken, submission });
    } catch (error) {
      setNotice(userFacingError(error, 'Your challenge answer could not be scored.'));
    }
  }

  async function confirmAction() {
    const action = confirmation;
    setConfirmation(null);
    if (action === null) return;
    setActionPending(action);
    try {
      if (action === 'close') {
        await closeRoom({ code: session.code, sessionToken: guest.sessionToken });
        setNotice('Room closed. The current scores stay visible.');
      } else {
        await leaveRoom({ code: session.code, sessionToken: guest.sessionToken });
        navigate('/');
      }
    } catch (error) {
      setNotice(
        userFacingError(error, action === 'close' ? 'The room could not be closed.' : 'The room could not be left.')
      );
    } finally {
      setActionPending(null);
    }
  }

  if (game === undefined) {
    return (
      <main className="grid min-h-dvh place-content-center bg-[#fff9e8] text-center text-[#66738a]">
        <Dices className="mx-auto mb-4 size-12 text-[#e85d2a]" aria-hidden="true" />
        <LoaderCircle className="mx-auto size-5 animate-spin" aria-hidden="true" />
        <p className="text-xs font-bold">Shuffling the mini-games…</p>
      </main>
    );
  }

  const winner = game.standings[0] ?? null;
  const surfaceKey =
    game.phase === 'lobby' || game.phase === 'complete'
      ? game.phase
      : `${game.phase}:${game.round?.roundId ?? game.currentRoundNumber}`;
  const currentFinished = game.currentResult?.status === 'finished';

  return (
    <div className="min-h-dvh bg-[#edf4ff] bg-[radial-gradient(circle_at_18px_18px,rgb(49_85_217/10%)_1.5px,transparent_1.5px)] bg-size-[36px_36px] text-[#17203a]">
      <header className="sticky top-0 z-30 grid h-18 grid-cols-[1fr_auto_1fr] items-center border-b border-[#bdc9dc] bg-[rgb(237_244_255/92%)] px-5 backdrop-blur-[16px] max-[760px]:h-16 max-[760px]:grid-cols-[auto_1fr_auto] max-[760px]:px-3">
        <Link
          className="inline-flex items-center gap-2.5 font-display text-lg font-[860] tracking-[-0.045em] text-[#17203a] no-underline"
          to="/"
          aria-label="Xup Games home"
        >
          <span className="grid size-8 -rotate-3 place-items-center rounded-[7px_11px_8px_10px] border-2 border-[#17203a] bg-[#e85d2a] text-white shadow-[3px_3px_0_#17203a]">
            X
          </span>
          <span className="max-[760px]:hidden">Xup Mix</span>
        </Link>
        <Button
          className="-rotate-1 px-4 text-[10px] tracking-[0.13em] max-[760px]:px-2.5"
          variant="type-code"
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
          game.phase === 'lobby'
            ? [GAME_LOBBY_FRAME_CLASS, GAME_LOBBY_GRID_CLASS]
            : 'mx-auto grid w-full max-w-360 grid-cols-[minmax(0,1fr)_300px] items-start gap-4.5 p-4 max-[820px]:grid-cols-1 max-[620px]:p-2.5'
        )}
      >
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
            <section
              className={cn(
                'relative w-full overflow-hidden rounded-[26px_16px_28px_18px] border-2 border-[#17203a] bg-[#fff9e8] shadow-[8px_9px_0_#a9c6ff]',
                game.phase === 'lobby' && GAME_LOBBY_CARD_HEIGHT_CLASS
              )}
              data-mini-game-surface-card
            >
              <GameSurfaceTransition
                showResults={game.phase === 'complete'}
                surfaceKey={surfaceKey}
                results={({ playIntro }) => (
                  <PostGameBoard
                    className="min-h-[clamp(600px,calc(100dvh-112px),768px)] rounded-none border-0 bg-transparent shadow-none"
                    eyebrow={`${game.totalRounds} mini-games · Final score`}
                    title={winner ? `${winner.displayName} wins the mix.` : 'Mix complete.'}
                    detail={
                      winner
                        ? `${winner.totalScore.toLocaleString()} total points across ${winner.roundsFinished} rounds.`
                        : 'The final scores are locked in.'
                    }
                    icon={Trophy}
                    accent="#e85d2a"
                    accentTint="#fff0b8"
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
                        label="Final Mini Game Mix podium"
                        animate={playIntro}
                        entries={game.standings.slice(0, 3).map((standing) => ({
                          id: standing.memberId,
                          place: standing.rank,
                          name: standing.displayName,
                          result: `${standing.totalScore.toLocaleString()} pts`,
                        }))}
                      />
                    }
                  />
                )}
              >
                {game.phase === 'lobby' ? (
                  <section
                    className={cn('relative flex w-full flex-col overflow-hidden', GAME_LOBBY_CARD_HEIGHT_CLASS)}
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
                      <p className="mb-3 text-[10px] font-[850] tracking-[0.18em] text-[#e85d2a] uppercase">
                        Spin · Play · Score · Repeat
                      </p>
                      <h1 className="m-0 max-w-190 font-display text-[clamp(66px,10vw,108px)] leading-[0.77] font-[920] tracking-[-0.085em] max-[520px]:text-[clamp(58px,20vw,82px)]">
                        Tiny games.
                        <br />
                        <span className="text-[#3155d9]">One big score.</span>
                      </h1>

                      <div className="my-7 flex flex-wrap gap-x-7 gap-y-3 border-y border-[#d5dce8] py-4 text-[11px] font-[650] text-[#748096] [&_strong]:mr-1 [&_strong]:text-[15px] [&_strong]:text-[#17203a]">
                        <span>
                          <strong>{session.activeMemberCount}</strong>{' '}
                          {session.activeMemberCount === 1 ? 'player' : 'players'} ready
                        </span>
                        <span>
                          <strong>{game.configuration.roundCount}</strong> mini-games
                        </span>
                        <span>
                          <strong>10s</strong> each
                        </span>
                        <span>
                          <strong>~{formatMiniGamesDuration(game.estimatedDurationMs)}</strong> game time
                        </span>
                      </div>

                      {isClosed ? (
                        <p className="m-0 rounded-[10px_6px_11px_7px] border border-[#cbd3e0] bg-[#eef1f6] px-4 py-3 text-xs font-bold text-[#667186]">
                          This room is closed.
                        </p>
                      ) : session.isOwner ? (
                        <Button
                          className="h-13.5 min-w-50"
                          variant="brand"
                          size="xl"
                          onClick={start}
                          disabled={starting}
                        >
                          {starting ? <LoaderCircle className="animate-spin" /> : <Play />}{' '}
                          {starting ? 'Shuffling…' : 'Start the mix'}
                        </Button>
                      ) : (
                        <p className="m-0 rounded-[10px_6px_11px_7px] border border-[#cbd3e0] bg-[#eef1f6] px-4 py-3 text-xs font-bold text-[#667186]">
                          Waiting for {ownerName} to start
                        </p>
                      )}

                      {!isClosed ? (
                        <Button className="mt-4.5" type="button" variant="paper" size="sm" onClick={copyRoomLink}>
                          {copied ? <Check /> : <Copy />} {copied ? 'Invite link copied' : 'Copy invite link'}
                        </Button>
                      ) : null}
                    </div>

                    <section
                      className="relative z-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-[#d5dce8] bg-[rgb(239_243_252/88%)] px-[clamp(24px,4vw,48px)] py-4.5 max-[520px]:grid-cols-1 max-[520px]:gap-3.5"
                      aria-label="Mini Game Mix game configuration"
                    >
                      <div className="min-w-0">
                        <h2 className="m-0 text-[11px] font-[850] tracking-[0.12em] text-[#2748bd] uppercase">
                          Game setup
                        </h2>
                        <p className="mt-1.5 mb-0 truncate text-xs leading-5 text-[#667186] max-[520px]:whitespace-normal">
                          <strong className="text-[#34445d]">{game.configuration.roundCount} mini-games</strong>
                          {' · '}10s each
                          {' · '}About {formatMiniGamesDuration(game.estimatedDurationMs)}
                          {' · '}
                          {game.miniGames.length} challenges in rotation
                        </p>
                      </div>
                      {session.isOwner && !isClosed ? (
                        <MiniGamesConfigurationDialog
                          configuration={game.configuration}
                          onSave={async (roundCount) => {
                            await configureGame({
                              roomId: session.roomId,
                              sessionToken: guest.sessionToken,
                              roundCount,
                            });
                          }}
                        />
                      ) : null}
                    </section>
                  </section>
                ) : game.phase === 'selecting' && game.round !== null ? (
                  <RoulettePanel key={game.round.roundId} round={game.round} miniGames={game.miniGames} />
                ) : game.phase === 'roundResults' ? (
                  <RoundResults game={game} now={now} />
                ) : game.phase === 'playing' && game.round !== null ? (
                  <section className="overflow-hidden">
                    <MiniGameRoundHeader
                      round={game.round}
                      totalRounds={game.totalRounds}
                      remainingMs={Math.max(0, (game.phaseEndsAt ?? now) - now)}
                      totalMs={MINI_GAME_ROUND_MS}
                      timerLabel="Time remaining"
                    />
                    <div className="relative p-[clamp(14px,3vw,30px)]">
                      <p className="mt-0 mb-4 text-center text-xs font-[720] text-[#65738a]">
                        {game.round.miniGame.instructions}
                      </p>
                      {game.round.miniGame.id === 'straightLine' ? (
                        <StraightLineChallenge
                          key={game.round.roundId}
                          round={game.round}
                          disabled={currentFinished || isClosed}
                          onSubmit={(points) => void submitLine(points)}
                        />
                      ) : game.round.miniGame.id === 'orangeEmojis' ? (
                        <EmojiChallenge
                          key={game.round.roundId}
                          round={game.round}
                          disabled={currentFinished || isClosed}
                          onSubmit={(ids) => void submitEmojis(ids)}
                        />
                      ) : game.round.challengePayload ? (
                        <NewMiniGameChallenge
                          key={game.round.roundId}
                          round={game.round}
                          now={now}
                          disabled={currentFinished || isClosed}
                          onSubmit={(submission) => void submitNewChallenge(submission)}
                        />
                      ) : (
                        <MiniGameChallenge
                          key={game.round.roundId}
                          round={game.round}
                          disabled={currentFinished || isClosed}
                          onEstimate={(guess) => void submitNumericEstimate(guess)}
                          onCirclePoint={(point) => void submitCirclePoint(point)}
                        />
                      )}
                      {currentFinished ? (
                        <div className="absolute inset-0 grid place-content-center bg-[#fff9e8]/88 text-center backdrop-blur-[2px]">
                          <Check className="mx-auto mb-3 size-11 rounded-full bg-[#16815f] p-2 text-white" />
                          <strong className="font-display text-2xl font-[870]">Score locked in.</strong>
                          <span className="mt-1 text-xs text-[#68758b]">Waiting for the other players…</span>
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </GameSurfaceTransition>
            </section>
          </GameModeContent>
          {notice ? (
            <p
              className="mt-4 rounded-[12px_8px_13px_9px] border border-[#e0b4aa] bg-[#fff1ed] px-4 py-3 text-xs font-[700] text-[#a54335]"
              role="alert"
            >
              {notice}
            </p>
          ) : null}
        </section>

        {game.phase === 'lobby' ? (
          <LobbyPlayersSidebar
            members={members}
            activeMemberCount={session.activeMemberCount}
            currentMemberId={session.currentMember.memberId}
            onlineByMemberId={onlineByMemberId}
            readyLabel="Ready to mix"
            copied={copied}
            onInvite={copyRoomLink}
            theme={{
              background: '#17203a',
              border: '#17203a',
              shadow: '7px 8px 0 #a9c6ff',
              text: '#ffffff',
              mutedText: '#aebbd0',
              eyebrow: '#9ec1ff',
              divider: 'rgb(255 255 255 / 12%)',
              countBackground: '#293553',
              countText: '#dce7ff',
              currentPlayerBackground: '#293553',
              avatarBackground: '#ffd85c',
              inviteBackground: '#293553',
              inviteHoverBackground: '#34415f',
              inviteBorder: '#53627a',
              inviteText: '#ffffff',
            }}
          />
        ) : (
          <Standings game={game} />
        )}
      </main>

      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{confirmation === 'close' ? 'Close this room?' : 'Leave this room?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmation === 'close'
              ? 'Everyone will lose access to the remaining mini-games.'
              : 'Your scores remain in the standings after you leave.'}
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmAction()}>
              {confirmation === 'close' ? 'Close room' : 'Leave room'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
