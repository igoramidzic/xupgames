import { api } from '@convex/_generated/api';
import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  Beaker,
  Check,
  Copy,
  Crown,
  DoorOpen,
  Eye,
  Globe2,
  LineChart,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Play,
  Timer,
  Trophy,
  UsersRound,
} from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
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
import { useRoomPresence } from '@/lib/useRoomPresence';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;
type GameView = FunctionReturnType<typeof api.trendline.getGame>;

const POINT_COUNT = 24;
const VIEWBOX_WIDTH = 1_000;
const VIEWBOX_HEIGHT = 520;
const PLOT_LEFT = 84;
const PLOT_RIGHT = 966;
const PLOT_TOP = 42;
const PLOT_BOTTOM = 456;

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

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

export function trendlinePoints(values: number[]) {
  return values
    .map((value, index) => {
      const x = PLOT_LEFT + (index / (POINT_COUNT - 1)) * (PLOT_RIGHT - PLOT_LEFT);
      const y = PLOT_BOTTOM - clamp(value) * (PLOT_BOTTOM - PLOT_TOP);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function formatValue(normalized: number, axisMin: number, axisMax: number, decimals: number) {
  return (axisMin + clamp(normalized) * (axisMax - axisMin)).toFixed(decimals);
}

function interpolateLine(values: number[], fromIndex: number, fromValue: number, toIndex: number, toValue: number) {
  const next = [...values];
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  for (let index = start; index <= end; index += 1) {
    if (index === 0) continue;
    const progress = start === end ? 1 : (index - start) / (end - start);
    const leftValue = fromIndex <= toIndex ? fromValue : toValue;
    const rightValue = fromIndex <= toIndex ? toValue : fromValue;
    next[index] = clamp(leftValue + (rightValue - leftValue) * progress);
  }
  return next;
}

export default function TrendlineRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  const navigate = useNavigate();
  const game = useQuery(api.trendline.getGame, { roomId: session.roomId, sessionToken: guest.sessionToken });
  const startGame = useAction(api.trendline.startGame);
  const submitPrediction = useMutation(api.trendline.submitPrediction);
  const revealHint = useMutation(api.trendline.revealHint);
  const leaveRoom = useMutation(api.rooms.leave);
  const closeRoom = useMutation(api.rooms.close);
  const { onlineByMemberId } = useRoomPresence({ roomId: session.roomId, sessionToken: guest.sessionToken });
  const [lineValues, setLineValues] = useState<number[]>(Array(POINT_COUNT).fill(0.5));
  const [hasDrawn, setHasDrawn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hinting, setHinting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'leave' | 'close' | null>(null);
  const [actionPending, setActionPending] = useState<'leave' | 'close' | null>(null);
  const [gameModeOpen, setGameModeOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointerActiveRef = useRef(false);
  const lastPointRef = useRef<{ index: number; value: number } | null>(null);
  const roundKeyRef = useRef<string | null>(null);
  const clockEnabled = game?.phase === 'countdown' || game?.phase === 'drawing' || game?.phase === 'reveal';
  const now = useClock(clockEnabled);
  const remainingMs = Math.max(0, (game?.phaseEndsAt ?? now) - now);
  const seconds = Math.ceil(remainingMs / 1_000);
  const isClosed = session.status === 'closed';
  const members = getRoomMembers(session);
  const ownerName = members.find((member) => member.isOwner)?.displayName ?? 'The room owner';
  const canDraw =
    game?.phase === 'drawing' && remainingMs > 0 && game.playerPrediction === null && !isClosed && !submitting;

  useEffect(() => {
    const roundKey =
      game?.round === null || game?.round === undefined ? null : `${game.gameNumber}:${game.round.roundId}`;
    if (roundKeyRef.current === roundKey) return;
    roundKeyRef.current = roundKey;
    if (game?.round) {
      const initial = game.playerPrediction?.values ?? Array(POINT_COUNT).fill(game.round.firstValue);
      setLineValues(initial);
      setHasDrawn(game.playerPrediction !== null);
    }
  }, [game]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1_800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  function chartPoint(event: ReactPointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
    return {
      index: Math.max(
        1,
        Math.min(POINT_COUNT - 1, Math.round(((x - PLOT_LEFT) / (PLOT_RIGHT - PLOT_LEFT)) * (POINT_COUNT - 1)))
      ),
      value: clamp((PLOT_BOTTOM - y) / (PLOT_BOTTOM - PLOT_TOP)),
    };
  }

  function applyPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (!canDraw) return;
    const point = chartPoint(event);
    if (!point) return;
    const previous = lastPointRef.current ?? point;
    setLineValues((values) => interpolateLine(values, previous.index, previous.value, point.index, point.value));
    setHasDrawn(true);
    lastPointRef.current = point;
  }

  async function handleStart() {
    setStarting(true);
    setNotice(null);
    try {
      await startGame({ roomId: session.roomId, sessionToken: guest.sessionToken });
    } catch (error) {
      setNotice(userFacingError(error, 'Trendline could not load World Bank data. Try again.'));
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit() {
    if (!game?.round || !canDraw || !hasDrawn) return;
    setSubmitting(true);
    setNotice(null);
    try {
      await submitPrediction({
        roomId: session.roomId,
        sessionToken: guest.sessionToken,
        roundId: game.round.roundId,
        values: lineValues,
      });
    } catch (error) {
      setNotice(userFacingError(error, 'Your line could not be locked in.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHint() {
    if (!game?.round) return;
    setHinting(true);
    setNotice(null);
    try {
      await revealHint({ roomId: session.roomId, sessionToken: guest.sessionToken, roundId: game.round.roundId });
    } catch (error) {
      setNotice(userFacingError(error, 'The hint could not be revealed.'));
    } finally {
      setHinting(false);
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
    } catch (error) {
      setNotice(userFacingError(error, 'The room could not be left.'));
      setActionPending(null);
    }
  }

  async function handleClose() {
    setConfirmation(null);
    setActionPending('close');
    try {
      await closeRoom({ code: session.code, sessionToken: guest.sessionToken });
      setNotice('Room closed. The final standings stay visible.');
    } catch (error) {
      setNotice(userFacingError(error, 'The room could not be closed.'));
    } finally {
      setActionPending(null);
    }
  }

  if (game === undefined) {
    return (
      <main className="grid min-h-dvh place-content-center bg-[#eef8f4] text-center text-[#49665e]">
        <LineChart className="mx-auto mb-4 size-13 text-[#158067]" aria-hidden="true" />
        <LoaderCircle className="mx-auto size-5 animate-spin" aria-hidden="true" />
        <p className="text-xs font-bold">Plotting the room…</p>
      </main>
    );
  }

  const winner = game.leaderboard.find((entry) => entry.isActive) ?? game.leaderboard[0] ?? null;
  return (
    <div className="min-h-dvh bg-[#eef8f4] bg-[linear-gradient(rgb(24_58_54/6%)_1px,transparent_1px)] bg-size-[100%_28px] text-[#183a36]">
      <header className="sticky top-0 z-30 grid h-18 grid-cols-[1fr_auto_1fr] items-center border-b border-[#b9d8cf] bg-[rgb(238_248_244/92%)] px-5 backdrop-blur-[16px] max-[760px]:h-16 max-[760px]:grid-cols-[auto_1fr_auto] max-[760px]:px-3">
        <Link
          className="inline-flex items-center gap-2.5 font-display text-lg font-[850] tracking-[-0.04em] text-[#183a36] no-underline"
          to="/"
          aria-label="Xup Games home"
        >
          <span className="grid size-8 -rotate-3 place-items-center rounded-[6px_10px_7px_9px] border-2 border-[#183a36] bg-[#158067] text-base text-white shadow-[3px_3px_0_#183a36]">
            X
          </span>
          <span className="max-[760px]:hidden">Xup Trendline</span>
        </Link>
        <Button
          className="-rotate-1 px-4 text-[10px] tracking-[0.13em] max-[760px]:px-2.5 max-[760px]:text-[8px]"
          variant="secondary"
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
            <Button asChild variant="paper" size="sm" className="no-underline max-[760px]:w-9 max-[760px]:px-0">
              <Link to={`/admin/${session.code}`}>
                <Beaker /> <span className="max-[760px]:hidden">Playtest</span>
              </Link>
            </Button>
          ) : null}
          {session.isOwner && !isClosed ? (
            <Button
              variant="paper"
              size="sm"
              className="max-[760px]:w-9 max-[760px]:px-0"
              type="button"
              onClick={() => setConfirmation('close')}
            >
              <LockKeyhole /> <span className="max-[760px]:hidden">Close</span>
            </Button>
          ) : null}
          <Button
            variant="paper"
            size="sm"
            className="max-[760px]:w-9 max-[760px]:px-0"
            type="button"
            onClick={() => setConfirmation('leave')}
            disabled={actionPending !== null}
          >
            {actionPending === 'leave' ? <LoaderCircle className="animate-spin" /> : <DoorOpen />}
            <span className="max-[760px]:hidden">Leave</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-360 grid-cols-[minmax(0,1fr)_360px] gap-4 p-4 max-[1040px]:grid-cols-[minmax(0,1fr)_310px] max-[820px]:grid-cols-1 max-[620px]:p-2.5">
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
                  eyebrow={`Trendline · ${game.totalRounds} real-world series`}
                  title={winner ? `${winner.displayName} reads the curve.` : 'The lines are in.'}
                  detail={
                    winner
                      ? `${winner.totalPoints.toLocaleString()} points across ${winner.roundsSubmitted} rounds.`
                      : 'The final standings are locked in.'
                  }
                  icon={Trophy}
                  accent="#158067"
                  accentTint="#f4cd54"
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
                      entries={game.leaderboard
                        .filter((entry) => entry.isActive)
                        .slice(0, 3)
                        .map((entry) => ({
                          id: entry.memberId,
                          place: entry.rank,
                          name: entry.displayName,
                          result: `${entry.totalPoints.toLocaleString()} pts`,
                        }))}
                    />
                  }
                />
              )}
            >
              {game.phase === 'lobby' ? (
                <TrendlineLobby
                  isOwner={session.isOwner}
                  isClosed={isClosed}
                  ownerName={ownerName}
                  playerCount={session.activeMemberCount}
                  starting={starting}
                  onStart={handleStart}
                  onCopy={copyRoomLink}
                />
              ) : game.phase === 'complete' ? null : game.phase === 'preparing' ? (
                <div className="grid min-h-[calc(100dvh-104px)] place-items-center rounded-[20px_28px_22px_26px] border border-[#9bc4b9] bg-white text-center shadow-[7px_8px_0_#c6e1da] max-[820px]:min-h-130">
                  <div className="px-6">
                    <Globe2 className="mx-auto mb-5 size-14 animate-pulse text-[#158067] motion-reduce:animate-none" />
                    <h1 className="font-display text-4xl font-[850] tracking-[-0.05em]">Calling the World Bank…</h1>
                    <p className="mx-auto max-w-100 text-sm leading-6 text-[#647d76]">
                      Selecting six complete historical series and fixing their axes for fair play.
                    </p>
                  </div>
                </div>
              ) : game.round ? (
                <div className="relative overflow-hidden rounded-[20px_28px_22px_26px] border border-[#9bc4b9] bg-white shadow-[7px_8px_0_#c6e1da]">
                  <div className="flex min-h-18 items-center justify-between gap-4 border-b border-[#d6e8e2] bg-[#f8fffc] px-6 py-3 max-[620px]:px-4">
                    <div className="min-w-0">
                      <p className="m-0 text-[9px] font-[850] tracking-[0.13em] text-[#158067] uppercase">
                        {game.round.category} · Round {game.currentRoundNumber}/{game.totalRounds}
                      </p>
                      <h1 className="mt-1 mb-0 text-balance font-display text-[clamp(20px,3vw,32px)] leading-[1.02] font-[850] tracking-[-0.045em]">
                        {game.round.indicatorName} in {game.round.countryName}
                      </h1>
                      <p className="mt-1 mb-0 text-xs text-[#647d76]">{game.round.unitLabel}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <small className="block text-[8px] font-[820] tracking-[0.1em] text-[#789188]">
                        {game.phase.toUpperCase()}
                      </small>
                      <strong className="font-display text-3xl font-[850] tabular-nums text-[#f06449]">
                        {seconds}s
                      </strong>
                    </div>
                  </div>
                  <TrendlineChart
                    game={game}
                    lineValues={lineValues}
                    canDraw={canDraw}
                    svgRef={svgRef}
                    onPointerDown={(event) => {
                      pointerActiveRef.current = true;
                      lastPointRef.current = null;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      applyPointer(event);
                    }}
                    onPointerMove={(event) => {
                      if (pointerActiveRef.current) applyPointer(event);
                    }}
                    onPointerUp={(event) => {
                      pointerActiveRef.current = false;
                      lastPointRef.current = null;
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                  />
                  {game.phase === 'countdown' ? (
                    <div className="absolute inset-0 z-20 grid place-items-center bg-[rgb(24_58_54/86%)] text-center text-white backdrop-blur-[3px]">
                      <div>
                        <p className="mb-3 text-[10px] font-[850] tracking-[0.18em] text-[#a8e0d0] uppercase">
                          Study the axes
                        </p>
                        <strong className="block font-display text-[clamp(130px,24vw,270px)] leading-[0.72] tracking-[-0.1em] text-[#f4cd54] tabular-nums">
                          {Math.max(1, seconds)}
                        </strong>
                        <span className="mt-8 block text-sm text-[#d6eee7]">
                          The first value is anchored. Draw the next 23 years.
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div className="border-t border-[#d6e8e2] bg-[#f8fffc] px-5 py-4">
                    {canDraw ? (
                      <div className="flex justify-end">
                        <Button variant="brand" type="button" onClick={handleSubmit} disabled={!hasDrawn || submitting}>
                          {submitting ? <LoaderCircle className="animate-spin" /> : <Pencil />}
                          {submitting ? 'Locking…' : 'Lock line'}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 text-xs text-[#5e756e]">
                        <span className="inline-flex items-center gap-2">
                          {game.playerPrediction ? (
                            <>
                              <Check className="size-4 text-[#158067]" /> Line locked · {game.round.submittedCount}{' '}
                              submitted
                            </>
                          ) : game.phase === 'reveal' ? (
                            'Round closed'
                          ) : (
                            'Waiting for the drawing phase'
                          )}
                        </span>
                        {game.playerPrediction?.pointsAwarded !== null &&
                        game.playerPrediction?.pointsAwarded !== undefined ? (
                          <strong className="font-display text-xl text-[#158067]">
                            +{game.playerPrediction.pointsAwarded} pts
                          </strong>
                        ) : null}
                      </div>
                    )}
                    {game.phase === 'drawing' && game.playerPrediction === null ? (
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#dcebe6] pt-3 text-[10px] text-[#71877f]">
                        <span>Draw directly on the chart.</span>
                        <Button
                          variant="paper"
                          size="sm"
                          type="button"
                          onClick={handleHint}
                          disabled={hinting || game.round.hintedEndValue !== null}
                        >
                          <Eye />
                          {game.round.hintedEndValue === null
                            ? 'Reveal ending · max 700'
                            : `Ends at ${formatValue(game.round.hintedEndValue, game.round.axisMin, game.round.axisMax, game.round.valueDecimals)}`}
                        </Button>
                      </div>
                    ) : null}
                    {game.round.source ? (
                      <p className="mt-3 mb-0 text-[9px] text-[#71877f]">
                        Source:{' '}
                        <a
                          className="font-[750] text-[#158067]"
                          href={game.round.source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {game.round.source.name}
                        </a>{' '}
                        · {game.round.source.organization} · {game.round.source.licenseName} · retrieved{' '}
                        {new Date(game.round.source.retrievedAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
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
        <TrendlineLeaderboard game={game} onlineByMemberId={onlineByMemberId} />
      </main>
      {confirmation ? (
        <TrendlineActionDialog
          action={confirmation}
          ownerIsLeaving={session.isOwner}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmation === 'close' ? handleClose : handleLeave}
        />
      ) : null}
    </div>
  );
}

function TrendlineChart({
  game,
  lineValues,
  canDraw,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  game: GameView;
  lineValues: number[];
  canDraw: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
}) {
  const round = game.round;
  if (!round) return null;
  const showReveal = round.actualValues !== null;
  return (
    <div className="relative px-3 pt-4 max-[620px]:px-0">
      <svg
        ref={svgRef}
        className={cn('block aspect-[1.85] w-full select-none', canDraw && 'touch-none cursor-crosshair')}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        role="img"
        aria-label={`Prediction chart for ${round.indicatorName} in ${round.countryName}, ${round.startYear} to ${round.endYear}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = PLOT_BOTTOM - fraction * (PLOT_BOTTOM - PLOT_TOP);
          return (
            <g key={fraction}>
              <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke="#d5e8e2" strokeDasharray="6 8" />
              <text x={PLOT_LEFT - 12} y={y + 5} textAnchor="end" fill="#6c837c" fontSize="18" fontWeight="700">
                {formatValue(fraction, round.axisMin, round.axisMax, round.valueDecimals)}
              </text>
            </g>
          );
        })}
        <line x1={PLOT_LEFT} x2={PLOT_LEFT} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="#73958b" strokeWidth="2" />
        <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={PLOT_BOTTOM} y2={PLOT_BOTTOM} stroke="#73958b" strokeWidth="2" />
        <text x={PLOT_LEFT} y="494" fill="#5f7770" fontSize="18" fontWeight="750">
          {round.startYear}
        </text>
        <text x={PLOT_RIGHT} y="494" textAnchor="end" fill="#5f7770" fontSize="18" fontWeight="750">
          {round.endYear}
        </text>
        {round.crowdMedianValues ? (
          <polyline
            points={trendlinePoints(round.crowdMedianValues)}
            fill="none"
            stroke="#7b82ad"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="8 11"
            opacity="0.8"
          />
        ) : null}
        {showReveal ? (
          <polyline
            points={trendlinePoints(round.actualValues ?? [])}
            fill="none"
            stroke="#158067"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <polyline
          points={trendlinePoints(lineValues)}
          fill="none"
          stroke="#f06449"
          strokeWidth={showReveal ? 7 : 11}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={game.playerPrediction || canDraw ? 1 : 0.55}
        />
        <circle
          cx={PLOT_LEFT}
          cy={PLOT_BOTTOM - round.firstValue * (PLOT_BOTTOM - PLOT_TOP)}
          r="12"
          fill="#f4cd54"
          stroke="#183a36"
          strokeWidth="4"
        />
        {round.hintedEndValue !== null && !showReveal ? (
          <circle
            cx={PLOT_RIGHT}
            cy={PLOT_BOTTOM - round.hintedEndValue * (PLOT_BOTTOM - PLOT_TOP)}
            r="12"
            fill="#f4cd54"
            stroke="#183a36"
            strokeWidth="4"
          />
        ) : null}
      </svg>
      <div className="absolute top-6 right-7 flex flex-col items-end gap-1 text-[9px] font-[800] tracking-[0.07em] uppercase">
        <span className="text-[#f06449]">— You</span>
        {showReveal ? (
          <>
            <span className="text-[#158067]">— History</span>
            {round.crowdMedianValues ? <span className="text-[#70779f]">- - Crowd</span> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function TrendlineLobby({
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
    <div className="relative flex min-h-[calc(100dvh-104px)] flex-col justify-center overflow-hidden rounded-[20px_28px_22px_26px] border border-[#9bc4b9] bg-white px-[clamp(28px,7vw,92px)] py-16 shadow-[7px_8px_0_#c6e1da] max-[820px]:min-h-145">
      <div className="absolute top-10 right-10 grid size-20 rotate-4 place-items-center rounded-[12px_22px_14px_20px] border-2 border-[#183a36] bg-[#f4cd54] shadow-[6px_6px_0_#183a36] max-[620px]:top-7 max-[620px]:right-6 max-[620px]:size-14">
        <LineChart className="size-9 max-[620px]:size-6" />
      </div>
      <p className="mb-5 text-[10px] font-[850] tracking-[0.17em] text-[#158067] uppercase">
        Community game · Igor Amidzic
      </p>
      <h1 className="m-0 max-w-180 font-display text-[clamp(62px,8.5vw,118px)] leading-[0.78] font-[880] tracking-[-0.075em]">
        Draw what you think<span className="block text-[#f06449]">happened.</span>
      </h1>
      <p className="mt-8 mb-0 max-w-150 text-[clamp(16px,2vw,20px)] leading-[1.6] text-[#637a73]">
        {isOwner
          ? 'Start when the room is ready. Trendline uses six real historical series from the World Bank.'
          : `${ownerName} starts the game. You will get the first value, a fixed axis, and 25 seconds to draw each history.`}
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-3">
        {isOwner && !isClosed ? (
          <Button variant="brand" size="xl" type="button" onClick={onStart} disabled={starting}>
            {starting ? <LoaderCircle className="animate-spin" /> : <Play />}
            {starting ? 'Starting game…' : 'Start game'}
          </Button>
        ) : (
          <span className="inline-flex h-13 items-center gap-2 rounded-xl border border-[#bed8d0] bg-[#f4fbf8] px-5 text-xs font-[720] text-[#567069]">
            <Timer className="size-4" /> Waiting for {ownerName}
          </span>
        )}
        <Button className="h-13 px-5 text-xs font-[720]" variant="paper" type="button" onClick={onCopy}>
          <Copy /> Invite players
        </Button>
      </div>
      <div className="mt-12 flex items-center gap-4 border-t border-[#d6e8e2] pt-6 text-xs text-[#6f847e]">
        <span className="grid size-10 place-items-center rounded-full bg-[#e1f2ec] text-[#158067]">
          <UsersRound className="size-4.5" />
        </span>
        <span>
          <strong className="block text-sm text-[#294b45]">{playerCount} reading the data</strong>Up to 50 players.
          Shape matters; speed does not.
        </span>
      </div>
    </div>
  );
}

function TrendlineLeaderboard({
  game,
  onlineByMemberId,
}: {
  game: GameView;
  onlineByMemberId: ReadonlyMap<string, boolean>;
}) {
  return (
    <aside className="flex h-[calc(100dvh-104px)] min-h-145 flex-col overflow-hidden rounded-[22px_12px_24px_14px] border border-[#315a53] bg-[#183a36] text-white shadow-[7px_8px_0_#c6e1da] max-[820px]:h-145">
      <div className="flex items-center justify-between border-b border-white/12 px-5 py-5">
        <div>
          <p className="m-0 text-[10px] font-[830] tracking-[0.15em] text-[#9bd9c8] uppercase">The field</p>
          <h2 className="mt-1 mb-0 font-display text-[25px] font-[850] tracking-[-0.045em]">
            {game.leaderboard.length} player{game.leaderboard.length === 1 ? '' : 's'}
          </h2>
        </div>
        <div className="grid size-11 place-items-center rounded-[10px_16px_11px_15px] bg-[#f06449] shadow-[3px_3px_0_#0c211e]">
          {game.phase === 'complete' ? <Trophy className="size-5" /> : <Globe2 className="size-5" />}
        </div>
      </div>
      <ol className="m-0 flex-1 list-none overflow-y-auto p-3.5" aria-label="Trendline standings">
        {game.leaderboard.map((entry) => {
          const disconnected = entry.isActive && onlineByMemberId.get(entry.memberId) === false;
          return (
            <li
              className="mb-2.5 grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 rounded-[10px_15px_11px_14px] border border-[#51736d]/60 bg-[#244b45] px-3.5 py-3 data-[current=true]:border-[#f4cd54]/70 data-[inactive=true]:opacity-45"
              key={entry.memberId}
              data-current={entry.isCurrentPlayer}
              data-inactive={!entry.isActive || disconnected}
            >
              <strong className="text-[#a8c8c0] tabular-nums">{entry.rank}</strong>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <strong className="truncate text-sm">{entry.displayName}</strong>
                  {entry.rank === 1 && game.phase !== 'lobby' ? (
                    <Crown className="size-3 shrink-0 text-[#f4cd54]" />
                  ) : null}
                </span>
                <small className="text-[9px] text-[#a7c0ba]">
                  {entry.roundsSubmitted} line{entry.roundsSubmitted === 1 ? '' : 's'} · best {entry.bestRoundPoints}
                </small>
              </span>
              <span className="text-right">
                <strong className="block font-display text-lg tabular-nums">
                  {entry.totalPoints.toLocaleString()}
                </strong>
                {entry.pointsGained !== null ? (
                  <small className="font-[800] text-[#f4cd54]">+{entry.pointsGained}</small>
                ) : (
                  <small className="text-[8px] text-[#9eb8b2]">PTS</small>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function TrendlineActionDialog({
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
  const closing = action === 'close';
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogTitle>{closing ? 'Close this room?' : 'Leave this room?'}</AlertDialogTitle>
        <AlertDialogDescription>
          {closing
            ? 'Everyone will be removed and the room cannot be reopened.'
            : ownerIsLeaving
              ? 'Ownership will transfer to another active player when possible.'
              : 'You can rejoin later while the room remains open.'}
        </AlertDialogDescription>
        <div className="flex justify-end gap-2">
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant={closing ? 'destructive' : 'default'} onClick={onConfirm}>
            {closing ? 'Close room' : 'Leave room'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
