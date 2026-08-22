import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ArrowRight, Bot, CircleStop, ExternalLink, Gamepad2, LoaderCircle, Play, UsersRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { readGuest } from '@/lib/guest';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type InspectResult = FunctionReturnType<typeof api.playtests.inspect>;
type PlaytestRoom = Extract<InspectResult, { kind: 'room' }>;
type ReadyPlaytestRoom = PlaytestRoom & {
  room: PlaytestRoom['room'] & { gameType: Exclude<PlaytestRoom['room']['gameType'], null> };
};

const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const TARGETS = [10, 25, 50] as const;
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
  if (result.room.gameType === null) {
    return (
      <AdminGate
        eyebrow="Game vote in progress"
        title="Pick the first game before adding bots."
        detail="Return to the room, finish the ballot, and let the owner start the selected game."
        code={code}
      />
    );
  }

  return <PlaytestPanel panel={result as ReadyPlaytestRoom} sessionToken={guest.sessionToken} />;
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
    <div className="min-h-screen bg-[#edf2f8] bg-[radial-gradient(circle_at_50%_45%,rgb(255_255_255/96%)_0_16rem,transparent_35rem)] text-[#17203a] [&_a:focus-visible]:outline-3 [&_a:focus-visible]:outline-offset-3 [&_a:focus-visible]:outline-[rgb(49_85_217/28%)] [&_button:focus-visible]:outline-3 [&_button:focus-visible]:outline-offset-3 [&_button:focus-visible]:outline-[rgb(49_85_217/28%)] [&_input:focus-visible]:outline-3 [&_input:focus-visible]:outline-offset-3 [&_input:focus-visible]:outline-[rgb(49_85_217/28%)]">
      <AdminWordmark />
      <main className="mx-auto mt-[11vh] box-border w-[min(460px,calc(100%-40px))] rounded-[18px_13px_20px_14px] border border-[#bdc8d8] bg-white p-9.5 text-center shadow-[8px_9px_0_rgb(23_32_58/9%)] max-[620px]:mt-[7vh] max-[620px]:px-5.5 max-[620px]:py-7">
        <div className="mx-auto mb-6.25 grid size-14.5 -rotate-4 place-items-center rounded-[18px_13px_17px_12px] border-2 border-[#17203a] bg-[#f3cb42] shadow-[4px_4px_0_#17203a]">
          <Gamepad2 className="size-6.5" aria-hidden="true" />
        </div>
        <p className="mb-5 text-xs font-[780] tracking-[0.12em] text-[#3155d9] uppercase">Playtest control</p>
        <h1 className="m-0 font-display text-[32px] leading-[1.05] font-[780] tracking-[-0.045em]">
          Choose the room you own.
        </h1>
        <p className="mx-auto mt-4 mb-6 text-[13px] leading-[1.55] text-[#667187]">
          Enter its eight-character code or use Playtest from the live room toolbar.
        </p>
        <form className="text-left" onSubmit={openRoom}>
          <label className="mb-1.75 block text-[11px] font-[730] text-[#4c5870]" htmlFor="admin-room-code">
            Room code
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 max-[620px]:grid-cols-1">
            <input
              className="box-border h-11 min-w-0 rounded-lg border border-[#bfc9d8] px-3 font-display font-[750] tracking-[0.08em] text-[#17203a] uppercase"
              id="admin-room-code"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={8}
              placeholder="ABCDEFGH"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
            <Button
              className="text-[11px] disabled:opacity-45 [&_svg]:size-3.5"
              variant="brand"
              type="submit"
              disabled={!ROOM_CODE_PATTERN.test(normalizedCode)}
            >
              Open controls <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}

function AdminWordmark() {
  return (
    <header className="grid h-19 grid-cols-[1fr_auto] items-center border-b border-[#c8d1e0] bg-[rgb(248_250_253/94%)] px-7 backdrop-blur-[14px] max-[620px]:h-16.5 max-[620px]:px-4">
      <Link
        className="inline-flex items-center gap-2.75 font-display text-lg font-extrabold tracking-[-0.03em] text-[#17203a] no-underline"
        to="/"
        aria-label="Xup Games home"
      >
        <span
          className="grid size-8.5 -rotate-4 place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#17203a] bg-[#f3cb42] text-lg leading-none shadow-[3px_3px_0_#17203a]"
          aria-hidden="true"
        >
          X
        </span>
        <span className="max-[620px]:hidden">Xup Games</span>
      </Link>
      <span className="text-[11px] font-[740] tracking-[0.08em] text-[#6b768b] uppercase">Playtest control</span>
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
    <div className="min-h-screen bg-[#edf2f8] bg-[radial-gradient(circle_at_50%_45%,rgb(255_255_255/96%)_0_16rem,transparent_35rem)] text-[#17203a] [&_a:focus-visible]:outline-3 [&_a:focus-visible]:outline-offset-3 [&_a:focus-visible]:outline-[rgb(49_85_217/28%)] [&_button:focus-visible]:outline-3 [&_button:focus-visible]:outline-offset-3 [&_button:focus-visible]:outline-[rgb(49_85_217/28%)]">
      <AdminWordmark />
      <main className="mx-auto mt-[11vh] box-border w-[min(460px,calc(100%-40px))] rounded-[18px_13px_20px_14px] border border-[#bdc8d8] bg-white p-9.5 text-center shadow-[8px_9px_0_rgb(23_32_58/9%)] max-[620px]:mt-[7vh] max-[620px]:px-5.5 max-[620px]:py-7">
        <div className="mx-auto mb-6.25 grid size-14.5 -rotate-4 place-items-center rounded-[18px_13px_17px_12px] border-2 border-[#17203a] bg-[#f3cb42] shadow-[4px_4px_0_#17203a]">
          <Bot className="size-6.5" aria-hidden="true" />
        </div>
        <p className="mb-5 text-xs font-[780] tracking-[0.12em] text-[#3155d9] uppercase">{eyebrow}</p>
        <h1 className="m-0 font-display text-[32px] leading-[1.05] font-[780] tracking-[-0.045em]">{title}</h1>
        <p className="mx-auto mt-4 mb-6 text-[13px] leading-[1.55] text-[#667187]">{detail}</p>
        <div className="flex items-center justify-center gap-3.5">
          {code ? (
            <Button asChild variant="brand" className="text-[11px] no-underline [&_svg]:size-3.5">
              <Link to={`/r/${code}`}>
                Open room <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          <Link className="text-[11px] font-bold text-[#526079]" to="/admin">
            Try another code
          </Link>
        </div>
      </main>
    </div>
  );
}

function AdminLoading() {
  return (
    <main className="grid min-h-screen place-content-center bg-[#eef2f8] text-center text-[#68748a]">
      <div
        className="mx-auto grid size-8.5 -rotate-4 place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#17203a] bg-[#f3cb42] text-lg leading-none shadow-[3px_3px_0_#17203a]"
        aria-hidden="true"
      >
        X
      </div>
      <LoaderCircle className="mx-auto mt-4.5 mb-1 size-6 animate-spin text-[#3155d9]" aria-hidden="true" />
      <p className="text-xs">Counting the seats…</p>
    </main>
  );
}

function PlaytestPanel({ panel, sessionToken }: { panel: ReadyPlaytestRoom; sessionToken: string }) {
  const startPlaytest = useMutation(api.playtests.start);
  const stopPlaytest = useMutation(api.playtests.stop);
  const [target, setTarget] = useState<(typeof TARGETS)[number]>(10);
  const [pending, setPending] = useState<'start' | 'stop' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const run = panel.latestRun;
  const isRunActive = run?.isActive ?? false;
  const adapterCopy = gameAdapterCopy(panel.room.gameType);

  async function handleStart() {
    setPending('start');
    setNotice(null);
    try {
      await startPlaytest({
        code: panel.room.code,
        sessionToken,
        targetActiveMemberCount: target,
      });
    } catch (error) {
      setNotice(userFacingError(error, 'The playtest could not start.'));
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
      setNotice(userFacingError(error, 'The playtest could not stop.'));
    } finally {
      setPending(null);
    }
  }

  const targetUnavailable = target <= panel.room.activeMemberCount;
  const canStart = panel.room.status === 'open' && !isRunActive && !targetUnavailable;
  const statusLabel = run ? run.status[0].toUpperCase() + run.status.slice(1) : 'Ready';

  return (
    <div className="min-h-screen bg-[#eef2f8] bg-[linear-gradient(90deg,rgb(49_85_217/4%)_1px,transparent_1px),linear-gradient(rgb(49_85_217/4%)_1px,transparent_1px)] bg-size-[32px_32px] text-[#17203a] [&_a:focus-visible]:outline-3 [&_a:focus-visible]:outline-offset-3 [&_a:focus-visible]:outline-[rgb(49_85_217/28%)] [&_button:focus-visible]:outline-3 [&_button:focus-visible]:outline-offset-3 [&_button:focus-visible]:outline-[rgb(49_85_217/28%)]">
      <header className="grid h-19 grid-cols-[1fr_auto_1fr] items-center border-b border-[#c8d1e0] bg-[rgb(248_250_253/94%)] px-7 backdrop-blur-[14px] max-[620px]:h-16.5 max-[620px]:grid-cols-[1fr_auto] max-[620px]:px-4">
        <Link
          className="inline-flex items-center gap-2.75 font-display text-lg font-extrabold tracking-[-0.03em] text-[#17203a] no-underline"
          to="/"
          aria-label="Xup Games home"
        >
          <span
            className="grid size-8.5 -rotate-4 place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#17203a] bg-[#f3cb42] text-lg leading-none shadow-[3px_3px_0_#17203a]"
            aria-hidden="true"
          >
            X
          </span>
          <span className="max-[620px]:hidden">Xup Games</span>
        </Link>
        <div className="flex -rotate-[0.5deg] items-center gap-2.25 rounded-[8px_11px_7px_10px] border border-[#bfc9d9] bg-white py-1.75 pr-3 pl-2 font-display shadow-[3px_3px_0_#dbe2ec] max-[620px]:justify-self-end">
          <span className="rounded-sm bg-[#ff685b] px-1.5 py-1 text-[9px] font-[850] tracking-[0.11em] text-white">
            PLAYTEST
          </span>
          <strong className="text-[11px] tracking-[0.09em]">ROOM {panel.room.code}</strong>
        </div>
        <Link
          className="inline-flex items-center justify-self-end gap-1.75 text-xs font-bold text-[#46536d] no-underline hover:text-[#3155d9] max-[620px]:hidden"
          to={`/r/${panel.room.code}`}
        >
          Open live room <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </header>

      <main className="mx-auto w-[min(1180px,calc(100%-48px))] pt-13.5 pb-17.5 max-[900px]:w-[min(100%-32px,720px)] max-[900px]:pt-9.5 max-[620px]:w-[calc(100%-24px)] max-[620px]:pt-7.5 max-[620px]:pb-12">
        <section className="mb-8.5 grid grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] items-end gap-18 max-[900px]:grid-cols-1 max-[900px]:gap-4.5">
          <div>
            <p className="mb-2.25 text-xs font-[780] tracking-[0.12em] text-[#3155d9] uppercase">
              Game master controls
            </p>
            <h1 className="m-0 max-w-175 font-display text-[clamp(38px,5.2vw,68px)] leading-[0.98] font-[790] tracking-[-0.055em] max-[620px]:text-[38px]">
              Fill the table. Watch the game bend.
            </h1>
          </div>
          <p className="mb-1 max-w-105 text-sm leading-[1.65] text-[#5a667d] max-[900px]:max-w-150 [&_strong]:text-[#3155d9] [&_strong]:capitalize">
            Bots join as room members, publish live cursors, and follow the <strong>{panel.room.gameType}</strong>{' '}
            game’s playtest adapter.
          </p>
        </section>

        <section className="grid grid-cols-[minmax(0,1.48fr)_minmax(310px,0.72fr)] items-start gap-4.5 max-[900px]:grid-cols-1">
          <div className="rounded-[18px_12px_20px_13px] border border-[#bdc8d9] bg-white p-7 shadow-[7px_8px_0_rgb(23_32_58/8%)] max-[620px]:p-4.75 max-[620px]:shadow-[4px_5px_0_rgb(23_32_58/8%)]">
            <div className="flex items-start justify-between gap-4.5">
              <div>
                <p className="mb-2.25 text-xs font-[780] tracking-[0.12em] text-[#3155d9] uppercase">Live table map</p>
                <h2 className="m-0 font-display text-2xl font-[760] tracking-[-0.035em]">
                  {panel.room.activeMemberCount} seats occupied
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.75 rounded-full border border-[#cad3e1] bg-[#f7f9fc] px-2.5 py-1.75 text-[11px] font-[740] text-[#5c687d]">
                <span
                  className={cn(
                    'size-1.75 rounded-full bg-[#8c96a8]',
                    (run?.status === 'provisioning' || run?.status === 'running') &&
                      'bg-[#35b87f] shadow-[0_0_0_4px_rgb(53_184_127/12%)]',
                    run?.status === 'stopping' && 'bg-[#f3a63b]'
                  )}
                />{' '}
                {statusLabel}
              </span>
            </div>

            <SeatMap panel={panel} target={target} />

            <div className="mb-7 flex flex-wrap items-center gap-4.5 text-[11px] font-[650] text-[#68748a]">
              <span className="inline-flex items-center gap-1.75">
                <i className="size-2.25 rounded-full border border-[#17203a] bg-[#f3cb42]" /> Real players
              </span>
              <span className="inline-flex items-center gap-1.75">
                <i className="size-2.25 rounded-full border border-[#3155d9] bg-[#3155d9]" /> Live bots
              </span>
              <span className="inline-flex items-center gap-1.75">
                <i className="size-2.25 rounded-full border border-dashed border-[#ef6d62] bg-[#fff1ef]" /> Target seats
              </span>
            </div>

            <div className="grid grid-cols-3 border-t border-[#d5dce7] max-[620px]:gap-0">
              <div className="flex items-center gap-2.75 border-r border-[#d5dce7] pt-5 pr-3.5 pb-0.5 max-[620px]:gap-1.75 max-[620px]:px-2 max-[620px]:pt-3.75">
                <UsersRound className="size-4.5 text-[#3155d9] max-[620px]:hidden" aria-hidden="true" />
                <span className="flex flex-col text-[10px] font-bold tracking-[0.04em] text-[#7a8497] uppercase">
                  Real players<strong>{panel.room.humanMemberCount}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2.75 border-r border-[#d5dce7] px-3.5 pt-5 pb-0.5 max-[620px]:gap-1.75 max-[620px]:px-2 max-[620px]:pt-3.75">
                <Bot className="size-4.5 text-[#3155d9] max-[620px]:hidden" aria-hidden="true" />
                <span className="flex flex-col text-[10px] font-bold tracking-[0.04em] text-[#7a8497] uppercase">
                  Live bots<strong>{run?.activeBotCount ?? 0}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2.75 px-3.5 pt-5 pb-0.5 max-[620px]:gap-1.75 max-[620px]:px-2 max-[620px]:pt-3.75">
                <Bot className="size-4.5 text-[#3155d9] max-[620px]:hidden" aria-hidden="true" />
                <span className="flex flex-col text-[10px] font-bold tracking-[0.04em] text-[#7a8497] uppercase">
                  Players stay
                  <strong className="mt-0.75 text-lg tracking-[-0.02em] text-[#17203a] normal-case max-[620px]:text-[15px]">
                    Until you remove them
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <aside className="rotate-[0.15deg] rounded-[12px_19px_13px_18px] border border-[#bdc8d9] bg-white p-6 shadow-[7px_8px_0_rgb(23_32_58/8%)] max-[900px]:rotate-0 max-[620px]:p-4.75 max-[620px]:shadow-[4px_5px_0_rgb(23_32_58/8%)]">
            <div className="flex items-start justify-between gap-4.5">
              <div>
                <p className="mb-2.25 text-xs font-[780] tracking-[0.12em] text-[#3155d9] uppercase">Run setup</p>
                <h2 className="m-0 font-display text-2xl font-[760] tracking-[-0.035em]">Call bots to the table</h2>
              </div>
              <Gamepad2
                className="size-6.75 rotate-7 rounded-full border border-[#c5cfdd] bg-[#f3cb42] p-2"
                aria-hidden="true"
              />
            </div>

            <fieldset className="mt-6.25 min-w-0 border-0 p-0" disabled={isRunActive || pending !== null}>
              <legend className="mb-2.25 text-[11px] font-[730] text-[#4f5b72]">Target room size</legend>
              <div className="grid grid-cols-3 gap-1.5 rounded-[10px] border border-[#c8d2e0] bg-[#eef2f7] p-1.25">
                {TARGETS.map((option) => (
                  <Button
                    key={option}
                    variant="tab"
                    type="button"
                    aria-label={`${option} seats`}
                    className="h-11.25 min-w-0 flex-col text-xs disabled:opacity-[.38] [&_strong]:font-display [&_strong]:text-[17px] [&_strong]:leading-none [&_span]:mt-0.5 [&_span]:text-[9px] [&_span]:font-[650]"
                    data-selected={target === option}
                    disabled={option <= panel.room.activeMemberCount}
                    onClick={() => setTarget(option)}
                  >
                    <strong>{option}</strong>
                    <span>seats</span>
                  </Button>
                ))}
              </div>
            </fieldset>

            <div className="my-6 flex items-start gap-3 rounded-[9px_13px_8px_12px] border border-dashed border-[#bdc8d8] bg-[#f7f9fc] p-3.5">
              <span className="grid size-7.5 shrink-0 -rotate-3 place-items-center rounded-[8px_6px_9px_7px] bg-[#dfe6fb] text-[#3155d9]">
                <Bot className="size-4" aria-hidden="true" />
              </span>
              <div>
                <strong className="text-xs">{adapterCopy.label}</strong>
                <p className="mt-0.75 text-[11px] leading-[1.45] text-[#6a758a]">{adapterCopy.description}</p>
              </div>
            </div>

            {isRunActive && run ? (
              <Button
                className="h-12 w-full text-[13px] disabled:opacity-52 [&_svg]:size-4.25"
                variant="destructive-soft"
                type="button"
                onClick={handleStop}
                disabled={pending !== null}
              >
                {pending === 'stop' ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <CircleStop aria-hidden="true" />
                )}
                {run.status === 'stopping' ? 'Removing players…' : 'Remove players'}
              </Button>
            ) : (
              <Button
                className="h-12 w-full text-[13px] disabled:opacity-52 [&_svg]:size-4.25"
                variant="brand-compact"
                type="button"
                onClick={handleStart}
                disabled={!canStart || pending !== null}
              >
                {pending === 'start' ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Play aria-hidden="true" />
                )}
                {targetUnavailable ? 'Choose a larger target' : `Fill to ${target} players`}
              </Button>
            )}

            {run ? (
              <div className="mt-4 flex flex-col gap-1 text-center text-[10px] text-[#6c778c]">
                <span className="font-[720] uppercase">
                  {run.provisionedBotCount}/{run.requestedBotCount} bots joined
                </span>
                {run.stopReason ? <p className="m-0">{run.stopReason}</p> : null}
              </div>
            ) : null}
            {panel.room.status === 'closed' ? (
              <p className="mt-3.5 rounded-lg border border-[#efb4af] bg-[#fff2f0] px-3 py-2.5 text-[11px] leading-[1.4] text-[#ad3932]">
                This room is closed. Create a new room to run another playtest.
              </p>
            ) : null}
            {notice ? (
              <p
                className="mt-3.5 rounded-lg border border-[#efb4af] bg-[#fff2f0] px-3 py-2.5 text-[11px] leading-[1.4] text-[#ad3932]"
                role="alert"
              >
                {notice}
              </p>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
}

function SeatMap({ panel, target }: { panel: ReadyPlaytestRoom; target: number }) {
  const liveBots = panel.latestRun?.isActive ? panel.latestRun.activeBotCount : 0;
  const humans = panel.room.humanMemberCount;
  return (
    <div
      className="my-6.25 mt-8.5 grid grid-cols-10 gap-x-2.5 gap-y-3 rounded-[42%_44%_40%_43%/16%_17%_15%_18%] border border-dashed border-[#b9c5d6] bg-[#f3f6fa] bg-[radial-gradient(circle_at_50%_48%,#fff_0_30%,transparent_69%)] px-6 py-7 shadow-[inset_0_0_0_7px_#fff] max-[620px]:grid-cols-5 max-[620px]:gap-2.25 max-[620px]:rounded-[26%_28%_25%_27%/8%_9%_8%_10%] max-[620px]:px-5 max-[620px]:py-5.5"
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
          <span
            className={cn(
              'relative grid aspect-square place-items-center rounded-full border border-[#c3cedd] bg-[#e7ebf2] font-display text-[#9aa4b4] shadow-[0_2px_0_#c4cedc] transition-[transform,background,border-color] duration-200 motion-reduce:transition-none',
              seatNumber % 3 === 0 && 'translate-y-0.75',
              seatNumber % 4 === 0 && 'rotate-3',
              state === 'human' && 'border-[#17203a] bg-[#f3cb42] text-[#17203a] shadow-[0_3px_0_#17203a]',
              state === 'bot' &&
                'animate-pulse border-[#2748bd] bg-[#3155d9] text-white shadow-[0_3px_0_#1f3b9e] motion-reduce:animate-none',
              state === 'queued' && 'border-dashed border-[#ef6d62] bg-[#fff1ef] text-[#c64e46] shadow-none'
            )}
            key={seatNumber}
            data-seat={state}
            aria-hidden="true"
          >
            <i className="text-[9px] font-[750] not-italic">{seatNumber}</i>
          </span>
        );
      })}
    </div>
  );
}

function gameAdapterCopy(gameType: ReadyPlaytestRoom['room']['gameType']) {
  switch (gameType) {
    case 'doodleDash':
      return {
        label: 'Doodle Dash drawing adapter',
        description:
          'Bots choose words, make random doodles, and submit staggered correct guesses. They stay at the table until you remove them.',
      };
    case 'trivia':
      return {
        label: 'Trivia answer adapter',
        description:
          'Bots answer every game with varied speed and accuracy. They stay at the table until you remove them.',
      };
    case 'typeRacer':
      return {
        label: 'Type racer adapter',
        description:
          'Bots type in every race at varied speeds and accuracy. They stay at the table until you remove them.',
      };
    case 'trendline':
      return {
        label: 'Trendline drawing adapter',
        description: 'Bots draw varied predictions in every data round. They stay at the table until you remove them.',
      };
    default: {
      const unsupportedGameType: never = gameType;
      throw new Error(`Missing playtest copy for game type: ${unsupportedGameType}`);
    }
  }
}
