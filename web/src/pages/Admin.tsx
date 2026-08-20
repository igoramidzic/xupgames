import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import {
  ArrowRight,
  Bot,
  CircleStop,
  ExternalLink,
  Gamepad2,
  LoaderCircle,
  Play,
  Timer,
  UsersRound,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { readGuest } from '@/lib/guest';

type InspectResult = FunctionReturnType<typeof api.playtests.inspect>;
type PlaytestRoom = Extract<InspectResult, { kind: 'room' }>;

const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const TARGETS = [10, 25, 50] as const;
const DURATIONS = [
  { value: 60_000, label: '1 min' },
  { value: 120_000, label: '2 min' },
  { value: 300_000, label: '5 min' },
] as const;

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const convexPayload = error.message.match(/\{.*"message":"([^"]+)".*\}/)?.[1];
  return convexPayload ?? error.message.replace(/^Uncaught Error:\s*/, '');
}

export default function Admin() {
  const params = useParams();
  const code = (params.code ?? '').trim().toUpperCase();
  const guest = readGuest();
  const isValidCode = ROOM_CODE_PATTERN.test(code);
  const result = useQuery(
    api.playtests.inspect,
    isValidCode && guest ? { code, sessionToken: guest.sessionToken } : 'skip'
  );

  if (!isValidCode) {
    return <AdminRoomPicker initialCode={code} />;
  }
  if (guest === null) {
    return (
      <AdminGate
        eyebrow="No owner session"
        title="Open the room from the browser that created it."
        detail="Playtests are owner-only until Xup Games has account-based admin roles. Create or rejoin your room here first."
        code={code}
      />
    );
  }
  if (result === undefined) {
    return <AdminLoading />;
  }
  if (result.kind === 'not_found') {
    return (
      <AdminGate
        eyebrow="Room not found"
        title="That table is off the floor plan."
        detail="Check the room code, then try again."
      />
    );
  }
  if (result.kind === 'not_owner') {
    return (
      <AdminGate
        eyebrow="Owner access required"
        title="This browser does not own that room."
        detail="Open Playtest from the room owner’s toolbar. Other players cannot add simulated members."
        code={code}
      />
    );
  }

  return <PlaytestPanel panel={result} sessionToken={guest.sessionToken} />;
}

function AdminRoomPicker({ initialCode = '' }: { initialCode?: string }) {
  const navigate = useNavigate();
  const [code, setCode] = useState(initialCode);
  const normalizedCode = code.trim().toUpperCase();

  function openRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ROOM_CODE_PATTERN.test(normalizedCode)) {
      navigate(`/admin/${normalizedCode}`);
    }
  }

  return (
    <div className="admin-gate-shell">
      <AdminWordmark />
      <main className="admin-picker-card">
        <div className="admin-gate-mark" aria-hidden="true">
          <Gamepad2 />
        </div>
        <p className="eyebrow">Playtest control</p>
        <h1>Choose the room you own.</h1>
        <p>Enter its eight-character code or use Playtest from the live room toolbar.</p>
        <form onSubmit={openRoom}>
          <label htmlFor="admin-room-code">Room code</label>
          <div>
            <input
              id="admin-room-code"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={8}
              placeholder="ABCDEFGH"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <button type="submit" disabled={!ROOM_CODE_PATTERN.test(normalizedCode)}>
              Open controls <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function AdminWordmark() {
  return (
    <header className="admin-gate-header">
      <Link className="wordmark" to="/" aria-label="Xup Games home">
        <span className="wordmark-mark" aria-hidden="true">
          X
        </span>
        <span>Xup Games</span>
      </Link>
      <span>Playtest control</span>
    </header>
  );
}

function AdminGate({
  eyebrow,
  title,
  detail,
  code,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  code?: string;
}) {
  return (
    <div className="admin-gate-shell">
      <AdminWordmark />
      <main className="admin-picker-card">
        <div className="admin-gate-mark" aria-hidden="true">
          <Bot />
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        <div className="admin-gate-actions">
          {code ? (
            <Link className="admin-primary-link" to={`/r/${code}`}>
              Open room <ArrowRight aria-hidden="true" />
            </Link>
          ) : null}
          <Link to="/admin">Try another code</Link>
        </div>
      </main>
    </div>
  );
}

function AdminLoading() {
  return (
    <main className="admin-loading">
      <div className="wordmark-mark" aria-hidden="true">
        X
      </div>
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>Counting the seats…</p>
    </main>
  );
}

function PlaytestPanel({ panel, sessionToken }: { panel: PlaytestRoom; sessionToken: string }) {
  const startPlaytest = useMutation(api.playtests.start);
  const stopPlaytest = useMutation(api.playtests.stop);
  const [target, setTarget] = useState<(typeof TARGETS)[number]>(10);
  const [durationMs, setDurationMs] = useState<(typeof DURATIONS)[number]['value']>(120_000);
  const [pending, setPending] = useState<'start' | 'stop' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const run = panel.latestRun;
  const isRunActive = run?.isActive ?? false;
  const adapterCopy = gameAdapterCopy(panel.room.gameType);

  useEffect(() => {
    if (!isRunActive) {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [isRunActive]);

  async function handleStart() {
    setPending('start');
    setNotice(null);
    try {
      await startPlaytest({
        code: panel.room.code,
        sessionToken,
        targetActiveMemberCount: target,
        durationMs,
      });
    } catch (error) {
      setNotice(errorMessage(error, 'The playtest could not start.'));
    } finally {
      setPending(null);
    }
  }

  async function handleStop() {
    if (!run) {
      return;
    }
    setPending('stop');
    setNotice(null);
    try {
      await stopPlaytest({ runId: run.runId, sessionToken });
    } catch (error) {
      setNotice(errorMessage(error, 'The playtest could not stop.'));
    } finally {
      setPending(null);
    }
  }

  const remainingSeconds = run?.isActive ? Math.max(0, Math.ceil((run.endsAt - now) / 1_000)) : 0;
  const targetUnavailable = target <= panel.room.activeMemberCount;
  const canStart = panel.room.status === 'open' && !isRunActive && !targetUnavailable;
  const statusLabel = run ? run.status[0].toUpperCase() + run.status.slice(1) : 'Ready';

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link className="wordmark" to="/" aria-label="Xup Games home">
          <span className="wordmark-mark" aria-hidden="true">
            X
          </span>
          <span>Xup Games</span>
        </Link>
        <div className="admin-room-label">
          <span>PLAYTEST</span>
          <strong>ROOM {panel.room.code}</strong>
        </div>
        <Link className="admin-open-room" to={`/r/${panel.room.code}`}>
          Open live room <ExternalLink aria-hidden="true" />
        </Link>
      </header>

      <main className="admin-main">
        <section className="admin-intro">
          <div>
            <p className="eyebrow">Game master controls</p>
            <h1>Fill the table. Watch the game bend.</h1>
          </div>
          <p>
            Bots join as room members, publish live cursors, and follow the <strong>{panel.room.gameType}</strong>{' '}
            game’s playtest adapter.
          </p>
        </section>

        <section className="admin-grid">
          <div className="seat-map-card">
            <div className="admin-card-heading">
              <div>
                <p className="eyebrow">Live table map</p>
                <h2>{panel.room.activeMemberCount} seats occupied</h2>
              </div>
              <span className={`playtest-status playtest-status-${run?.status ?? 'ready'}`}>
                <span /> {statusLabel}
              </span>
            </div>

            <SeatMap panel={panel} target={target} />

            <div className="seat-legend">
              <span>
                <i data-seat="human" /> Real players
              </span>
              <span>
                <i data-seat="bot" /> Live bots
              </span>
              <span>
                <i data-seat="queued" /> Target seats
              </span>
            </div>

            <div className="table-readout">
              <div>
                <UsersRound aria-hidden="true" />
                <span>
                  Real players<strong>{panel.room.humanMemberCount}</strong>
                </span>
              </div>
              <div>
                <Bot aria-hidden="true" />
                <span>
                  Live bots<strong>{run?.activeBotCount ?? 0}</strong>
                </span>
              </div>
              <div>
                <Timer aria-hidden="true" />
                <span>
                  Time left<strong>{isRunActive ? formatDuration(remainingSeconds) : '—'}</strong>
                </span>
              </div>
            </div>
          </div>

          <aside className="playtest-controls-card">
            <div className="admin-card-heading">
              <div>
                <p className="eyebrow">Run setup</p>
                <h2>Call bots to the table</h2>
              </div>
              <Gamepad2 aria-hidden="true" />
            </div>

            <fieldset disabled={isRunActive || pending !== null}>
              <legend>Target room size</legend>
              <div className="segmented-control target-control">
                {TARGETS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-label={`${option} seats`}
                    data-selected={target === option}
                    disabled={option <= panel.room.activeMemberCount}
                    onClick={() => setTarget(option)}
                  >
                    <strong>{option}</strong>
                    <span>seats</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset disabled={isRunActive || pending !== null}>
              <legend>Run for</legend>
              <div className="segmented-control duration-control">
                {DURATIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    data-selected={durationMs === option.value}
                    onClick={() => setDurationMs(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="adapter-note">
              <span>
                <Bot aria-hidden="true" />
              </span>
              <div>
                <strong>{adapterCopy.label}</strong>
                <p>{adapterCopy.description}</p>
              </div>
            </div>

            {isRunActive && run ? (
              <button className="stop-playtest" type="button" onClick={handleStop} disabled={pending !== null}>
                {pending === 'stop' ? (
                  <LoaderCircle className="spin" aria-hidden="true" />
                ) : (
                  <CircleStop aria-hidden="true" />
                )}
                {run.status === 'stopping' ? 'Removing bots…' : 'Stop playtest'}
              </button>
            ) : (
              <button
                className="start-playtest"
                type="button"
                onClick={handleStart}
                disabled={!canStart || pending !== null}
              >
                {pending === 'start' ? (
                  <LoaderCircle className="spin" aria-hidden="true" />
                ) : (
                  <Play aria-hidden="true" />
                )}
                {targetUnavailable ? 'Choose a larger target' : `Fill to ${target} players`}
              </button>
            )}

            {run ? (
              <div className="last-run-note">
                <span>
                  {run.provisionedBotCount}/{run.requestedBotCount} bots joined
                </span>
                {run.stopReason ? <p>{run.stopReason}</p> : null}
              </div>
            ) : null}
            {panel.room.status === 'closed' ? (
              <p className="admin-error">This room is closed. Create a new room to run another playtest.</p>
            ) : null}
            {notice ? (
              <p className="admin-error" role="alert">
                {notice}
              </p>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
}

function SeatMap({ panel, target }: { panel: PlaytestRoom; target: number }) {
  const liveBots = panel.latestRun?.isActive ? panel.latestRun.activeBotCount : 0;
  const humans = panel.room.humanMemberCount;
  return (
    <div
      className="seat-map"
      role="img"
      aria-label={`${panel.room.activeMemberCount} of ${panel.room.maxPlayers} seats occupied`}
    >
      {Array.from({ length: panel.room.maxPlayers }, (_, index) => {
        const seatNumber = index + 1;
        const state =
          seatNumber <= humans
            ? 'human'
            : seatNumber <= humans + liveBots
              ? 'bot'
              : seatNumber <= target
                ? 'queued'
                : 'empty';
        return (
          <span key={seatNumber} data-seat={state} aria-hidden="true">
            <i>{seatNumber}</i>
          </span>
        );
      })}
    </div>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function gameAdapterCopy(gameType: PlaytestRoom['room']['gameType']) {
  switch (gameType) {
    case 'drawing':
      return {
        label: 'Drawing adapter',
        description: 'Bots roam independently, then draw loops, spirals, waves, and zigzags point by point.',
      };
    default: {
      const unsupportedGameType: never = gameType;
      throw new Error(`Missing playtest copy for game type: ${unsupportedGameType}`);
    }
  }
}
