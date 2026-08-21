import { api } from '@convex/_generated/api';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Beaker, Check, Copy, Crown, DoorOpen, LoaderCircle, LockKeyhole, UsersRound, WifiOff } from 'lucide-react';
import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DrawingCanvas from '@/components/DrawingCanvas';
import TriviaRoom from '@/components/TriviaRoom';
import TypeRacerRoom from '@/components/TypeRacerRoom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { isLocalhost } from '@/lib/environment';
import { type GuestIdentity, readGuest, saveGuest, validateDisplayName } from '@/lib/guest';
import { getRoomMembers } from '@/lib/roomSession';
import { useRoomPresence } from '@/lib/useRoomPresence';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type PreviewResult = FunctionReturnType<typeof api.rooms.preview>;
type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;

const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const COLORS = ['#3155d9', '#ff685b', '#f3cb42', '#35b87f', '#8d5cf6', '#17203a'];
const WIDTHS = [4, 10, 22];

export default function Room() {
  const params = useParams();
  const code = (params.code ?? '').trim().toUpperCase();
  const isValidCode = ROOM_CODE_PATTERN.test(code);
  const [guest, setGuest] = useState<GuestIdentity | null>(() => readGuest());
  const preview = useQuery(api.rooms.preview, isValidCode ? { code } : 'skip');
  const session = useQuery(
    api.rooms.getSession,
    isValidCode && guest ? { code, sessionToken: guest.sessionToken } : 'skip'
  );

  if (!isValidCode || preview?.kind === 'not_found' || session?.kind === 'not_found') {
    return (
      <RoomUnavailable title="That room is off the map." detail="Check the link or ask the room owner for a new one." />
    );
  }

  if (preview === undefined || (guest && session === undefined)) {
    return <RoomLoading />;
  }

  if (guest && session?.kind === 'session' && session.currentMember.isActive) {
    if (session.gameType === 'trivia') {
      return <TriviaRoom guest={guest} session={session} />;
    }
    if (session.gameType === 'typeRacer') {
      return <TypeRacerRoom guest={guest} session={session} />;
    }
    return <CanvasRoom guest={guest} session={session} />;
  }

  return <JoinRoom preview={preview} code={code} guest={guest} onJoined={setGuest} />;
}

function RoomLoading() {
  return (
    <main className="grid min-h-screen place-content-center gap-4 p-8 text-center text-[#657087]">
      <div
        className="mx-auto grid size-8.5 -rotate-4 place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#17203a] bg-[#f3cb42] text-lg leading-none shadow-[3px_3px_0_#17203a]"
        aria-hidden="true"
      >
        X
      </div>
      <LoaderCircle className="mx-auto mt-2 size-6 animate-spin text-[#3155d9]" aria-hidden="true" />
      <p className="m-0 text-sm">Setting up the room…</p>
    </main>
  );
}

function RoomUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f2f5fb] px-6 py-10 text-center">
      <Link
        className="absolute top-7 left-8 inline-flex items-center gap-2.75 font-display text-lg font-extrabold tracking-[-0.03em] text-[#17203a] no-underline max-[520px]:top-5 max-[520px]:left-5"
        to="/"
      >
        <span
          className="grid size-8.5 -rotate-4 place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#17203a] bg-[#f3cb42] text-lg leading-none shadow-[3px_3px_0_#17203a]"
          aria-hidden="true"
        >
          X
        </span>
        <span>Xup Games</span>
      </Link>
      <div className="mb-7.5 grid size-19 -rotate-5 place-items-center rounded-[50%_44%_48%_42%] border-2 border-[#17203a] bg-[#f3cb42] font-display text-[42px] font-extrabold shadow-[7px_7px_0_#17203a]">
        ?
      </div>
      <p className="mb-5 text-xs font-[780] tracking-[0.12em] text-[#3155d9] uppercase">Room unavailable</p>
      <h1 className="m-0 font-display text-[clamp(40px,6vw,58px)] leading-[0.98] font-[820] tracking-[-0.055em] text-[#17203a]">
        {title}
      </h1>
      <p className="mt-4.5 mb-7 max-w-112.5 leading-[1.55] text-[#657087]">{detail}</p>
      <Link
        className="inline-flex h-13 min-w-40 cursor-pointer items-center justify-center gap-2.25 rounded-[12px_9px_13px_10px] bg-[#3155d9] px-4.5 text-sm font-[760] text-white no-underline shadow-[0_5px_0_#1838aa] transition-[transform,background,box-shadow] duration-150 hover:-translate-y-px hover:bg-[#2549cc] active:translate-y-[3px] active:shadow-[0_2px_0_#1838aa] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgb(49_85_217/30%)] motion-reduce:transition-none"
        to="/"
      >
        Make a new room
      </Link>
    </main>
  );
}

function JoinRoom({
  preview,
  code,
  guest,
  onJoined,
}: {
  preview: Extract<PreviewResult, { kind: 'room' }>;
  code: string;
  guest: GuestIdentity | null;
  onJoined: (guest: GuestIdentity) => void;
}) {
  const joinRoom = useMutation(api.rooms.join);
  const [displayName, setDisplayName] = useState(guest?.displayName ?? '');
  const [password, setPassword] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isClosed = preview.status === 'closed';
  const isFull = preview.activeMemberCount >= preview.maxPlayers;
  const isTrivia = preview.gameType === 'trivia';
  const isTypeRacer = preview.gameType === 'typeRacer';

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameError = validateDisplayName(displayName);
    if (nameError) {
      setError(nameError);
      return;
    }

    setError(null);
    setJoining(true);
    try {
      const identity = saveGuest(displayName);
      await joinRoom({ code, ...identity, ...(preview.isPasswordProtected ? { password } : {}) });
      onJoined(identity);
    } catch (joinError) {
      setError(userFacingError(joinError, 'The room could not be joined. Try again.'));
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f6fb] bg-[linear-gradient(rgb(216_225_239/52%)_1px,transparent_1px),linear-gradient(90deg,rgb(216_225_239/52%)_1px,transparent_1px)] bg-size-[32px_32px]">
      <header className="mx-auto flex h-22 w-[min(100%-48px,1440px)] items-center justify-between max-[620px]:h-18 max-[620px]:w-[calc(100%-32px)]">
        <Link
          className="inline-flex items-center gap-2.75 font-display text-lg font-extrabold tracking-[-0.03em] text-[#17203a] no-underline"
          to="/"
        >
          <span
            className="grid size-8.5 -rotate-4 place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#17203a] bg-[#f3cb42] text-lg leading-none shadow-[3px_3px_0_#17203a]"
            aria-hidden="true"
          >
            X
          </span>
          <span>Xup Games</span>
        </Link>
        <span className="rounded-lg bg-[#dfe6f4] px-3 py-2 text-[11px] font-[780] tracking-[0.1em] text-[#34415b]">
          ROOM {preview.code}
        </span>
      </header>

      <main className="grid min-h-[calc(100vh-88px)] place-items-center px-6 pt-11 pb-22 max-[520px]:px-4 max-[520px]:pt-16 max-[520px]:pb-17.5">
        <section className="relative box-border w-[min(100%,510px)] rounded-[26px_18px_30px_20px] border border-[#cbd5e4] bg-[rgb(255_255_255/95%)] p-11 shadow-[12px_14px_0_#dce4f1,0_32px_70px_rgb(45_65_103/14%)] max-[520px]:px-5.5 max-[520px]:pt-8.5 max-[520px]:pb-7">
          <div
            className="absolute -top-12.75 right-5.5 w-46.25 rotate-3 max-[520px]:-top-10.75 max-[520px]:right-3 max-[520px]:w-37.5"
            aria-hidden="true"
          >
            <svg className="w-full overflow-visible" viewBox="0 0 240 110">
              <title>Decorative overlapping lines</title>
              <path
                className="fill-none stroke-[#ff685b] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:12]"
                d="M8 76 C 55 10, 105 105, 155 38 S 215 30, 232 18"
              />
              <path
                className="fill-none stroke-[#3155d9] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:8]"
                d="M18 26 C 83 12, 108 94, 220 70"
              />
            </svg>
          </div>
          <p className="mb-5 text-xs font-[780] tracking-[0.12em] text-[#3155d9] uppercase max-[520px]:max-w-40">
            {isClosed
              ? isTrivia
                ? 'The trivia room is finished'
                : isTypeRacer
                  ? 'The type race is finished'
                  : 'The drawing is finished'
              : `${preview.ownerName} invited you`}
          </p>
          <h1 className="m-0 font-display text-[clamp(40px,6vw,58px)] leading-[0.98] font-[820] tracking-[-0.055em] text-[#17203a]">
            {isClosed
              ? 'This room is closed.'
              : isTrivia
                ? 'Take your place at the table.'
                : isTypeRacer
                  ? 'Take your place on the line.'
                  : 'Step up to the canvas.'}
          </h1>
          <div className="my-7 flex items-center justify-between border-y border-[#e1e6ef] py-3.5 text-[13px] text-[#687389] max-[520px]:gap-3">
            <span className="flex items-center gap-1.75">
              <UsersRound className="size-4" aria-hidden="true" /> {preview.activeMemberCount} / {preview.maxPlayers}{' '}
              people
            </span>
            {preview.isPasswordProtected ? (
              <span className="flex items-center gap-1.75 font-[680] text-[#4d5d91]">
                <LockKeyhole className="size-4" aria-hidden="true" /> Password protected
              </span>
            ) : null}
            <span
              className={cn(
                'rounded-full px-2.25 py-1.5 text-[11px] font-[740]',
                isClosed ? 'bg-[#eceff4] text-[#657085]' : 'bg-[#e4f7ef] text-[#16885c]'
              )}
            >
              {isClosed ? 'Closed' : 'Live now'}
            </span>
          </div>

          {isClosed || isFull ? (
            <div className="flex items-start gap-3.5 rounded-[14px] border border-[#d8dee9] bg-[#f3f5f8] p-4.5 text-[#4f5a70]">
              <LockKeyhole className="size-5.25 shrink-0 text-[#707b90]" aria-hidden="true" />
              <div>
                <strong className="mb-0.75 block text-sm text-[#29344c]">
                  {isClosed
                    ? isTrivia
                      ? 'No more answers can be added.'
                      : isTypeRacer
                        ? 'No more progress can be added.'
                        : 'No more marks can be added.'
                    : 'Every seat is taken.'}
                </strong>
                <p className="m-0 text-[13px] leading-[1.45]">
                  {isClosed ? 'Ask the owner to make a new room.' : 'Try this link again after someone leaves.'}
                </p>
              </div>
            </div>
          ) : (
            <form className="grid" onSubmit={handleJoin}>
              <label className="mb-2.25 ml-0.5 text-[13px] font-[720] text-[#35415a]" htmlFor="join-name">
                Your name
              </label>
              <input
                className="h-13 w-full rounded-xl border-[1.5px] border-[#b9c4d7] bg-white px-4 text-base text-[#17203a] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#3155d9] focus:shadow-[0_0_0_4px_rgb(49_85_217/13%)] aria-invalid:border-[#d43c45] motion-reduce:transition-none"
                id="join-name"
                autoComplete="nickname"
                maxLength={24}
                placeholder="What should we call you?"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'join-error' : 'join-hint'}
              />
              {preview.isPasswordProtected ? (
                <>
                  <label
                    className="mt-3.5 mb-2.25 ml-0.5 text-[13px] font-[720] text-[#35415a]"
                    htmlFor="join-password"
                  >
                    Room password
                  </label>
                  <input
                    className="h-13 w-full rounded-xl border-[1.5px] border-[#b9c4d7] bg-white px-4 text-base text-[#17203a] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#3155d9] focus:shadow-[0_0_0_4px_rgb(49_85_217/13%)] aria-invalid:border-[#d43c45] motion-reduce:transition-none"
                    id="join-password"
                    type="password"
                    autoComplete="current-password"
                    maxLength={64}
                    required
                    placeholder="Enter the password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'join-error' : 'join-hint'}
                  />
                </>
              ) : null}
              <button
                className="mt-3 inline-flex h-13 w-full min-w-40 cursor-pointer items-center justify-center gap-2.25 rounded-[12px_9px_13px_10px] bg-[#3155d9] px-4.5 text-sm font-[760] text-white shadow-[0_5px_0_#1838aa] transition-[transform,background,box-shadow] duration-150 enabled:hover:-translate-y-px enabled:hover:bg-[#2549cc] enabled:active:translate-y-[3px] enabled:active:shadow-[0_2px_0_#1838aa] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgb(49_85_217/30%)] disabled:cursor-wait disabled:opacity-[.72] motion-reduce:transition-none [&_svg]:size-4.25"
                type="submit"
                disabled={joining}
              >
                {joining ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                {joining
                  ? 'Joining…'
                  : guest
                    ? isTrivia
                      ? 'Rejoin the quiz'
                      : isTypeRacer
                        ? 'Rejoin the race'
                        : 'Rejoin the canvas'
                    : isTrivia
                      ? 'Join the quiz'
                      : isTypeRacer
                        ? 'Join the race'
                        : 'Join the canvas'}
              </button>
              {error ? (
                <p
                  className="mt-2.5 ml-0.5 min-h-4.5 text-xs leading-[1.45] font-[650] text-[#b72934]"
                  id="join-error"
                  role="alert"
                >
                  {error}
                </p>
              ) : (
                <p className="mt-2.5 ml-0.5 min-h-4.5 text-xs leading-[1.45] text-[#7a8499]" id="join-hint">
                  No account needed. This browser will remember your place.
                </p>
              )}
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

function CanvasRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  const members = getRoomMembers(session);
  const navigate = useNavigate();
  const leaveRoom = useMutation(api.rooms.leave);
  const closeRoom = useMutation(api.rooms.close);
  const { onlineByMemberId } = useRoomPresence({ roomId: session.roomId, sessionToken: guest.sessionToken });
  const {
    results: newestStrokes,
    status: strokeHistoryStatus,
    loadMore: loadMoreStrokes,
  } = usePaginatedQuery(
    api.drawing.listPage,
    { roomId: session.roomId, sessionToken: guest.sessionToken },
    { initialNumItems: 200 }
  );
  const strokes = useMemo(
    () => [...newestStrokes].sort((first, second) => first.sequence - second.sequence),
    [newestStrokes]
  );
  const memberColors = useMemo(
    () =>
      Object.fromEntries(members.map((member, index) => [member.memberId, memberColor(index)])) as Record<
        string,
        string
      >,
    [members]
  );
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1]);
  const [copied, setCopied] = useState(false);
  const [actionPending, setActionPending] = useState<'leave' | 'close' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState<'leave' | 'close' | null>(null);
  const membersPanelRef = useRef<HTMLElement>(null);
  const isClosed = session.status === 'closed';

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    if (strokeHistoryStatus === 'CanLoadMore') {
      loadMoreStrokes(200);
    }
  }, [loadMoreStrokes, strokeHistoryStatus]);

  useEffect(() => {
    if (!membersExpanded) {
      return;
    }

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (event.target instanceof Node && !membersPanelRef.current?.contains(event.target)) {
        setMembersExpanded(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMembersExpanded(false);
        if (membersPanelRef.current?.contains(document.activeElement)) {
          (document.activeElement as HTMLElement).blur();
        }
      }
    };

    document.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [membersExpanded]);

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
      setNotice('Room closed. The drawing is now read only.');
      setActionPending(null);
    } catch (closeError) {
      setNotice(userFacingError(closeError, 'The room could not be closed.'));
      setActionPending(null);
    }
  }

  return (
    <div className="h-dvh min-h-screen overflow-hidden bg-[#edf2fa] max-[760px]:h-auto max-[760px]:min-h-dvh max-[760px]:overflow-visible">
      <header className="grid h-19 grid-cols-[1fr_auto_1fr] items-center border-b border-[#ccd5e4] bg-[rgb(248_250_253/92%)] px-5.5 backdrop-blur-[14px] max-[760px]:sticky max-[760px]:top-0 max-[760px]:z-6 max-[760px]:h-17 max-[760px]:grid-cols-[auto_1fr_auto] max-[760px]:px-3">
        <Link
          className="inline-flex items-center gap-2.75 font-display text-lg font-extrabold tracking-[-0.03em] text-[#17203a] no-underline"
          to="/"
          aria-label="Xup Games home"
        >
          <span
            className="grid size-8.5 -rotate-4 place-items-center rounded-[10px_6px_11px_7px] border-2 border-[#17203a] bg-[#f3cb42] text-lg leading-none shadow-[3px_3px_0_#17203a] max-[760px]:size-7.5"
            aria-hidden="true"
          >
            X
          </span>
          <span className="max-[760px]:hidden">Xup Games</span>
        </Link>

        <button
          className="relative flex h-9.5 -rotate-1 cursor-pointer items-center gap-2.25 border-0 bg-[#3155d9] px-5 font-display text-[11px] font-extrabold tracking-[0.12em] text-white [clip-path:polygon(7px_0,calc(100%-7px)_0,100%_7px,calc(100%-2px)_calc(100%-6px),calc(100%-7px)_100%,6px_100%,0_calc(100%-7px),2px_6px)] [filter:drop-shadow(0_6px_7px_rgb(49_85_217/20%))] max-[760px]:h-8.5 max-[760px]:justify-self-center max-[760px]:px-3 max-[760px]:text-[9px] [&_svg]:size-3.5"
          type="button"
          onClick={copyRoomLink}
          aria-label="Copy room link"
        >
          <span>ROOM {session.code}</span>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </button>

        <div className="flex items-center justify-end gap-2 max-[520px]:gap-1.25">
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
          {session.isOwner && !isClosed && isLocalhost() ? (
            <Link
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.75 rounded-[9px] border border-[#c9d2e0] bg-white px-3 text-xs font-[680] text-[#4b5770] transition-[border-color,color,background] duration-150 hover:border-[#abb7ca] hover:bg-[#f7f9fc] hover:text-[#17203a] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgb(49_85_217/30%)] motion-reduce:transition-none max-[760px]:w-8.5 max-[760px]:px-0 max-[520px]:hidden [&_svg]:size-3.75"
              to={`/admin/${session.code}`}
            >
              <Beaker aria-hidden="true" />
              <span className="max-[760px]:hidden">Playtest</span>
            </Link>
          ) : null}
          {session.isOwner && !isClosed ? (
            <button
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.75 rounded-[9px] border border-[#c9d2e0] bg-white px-3 text-xs font-[680] text-[#4b5770] transition-[border-color,color,background] duration-150 enabled:hover:border-[#abb7ca] enabled:hover:bg-[#f7f9fc] enabled:hover:text-[#17203a] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgb(49_85_217/30%)] disabled:cursor-wait disabled:opacity-[.58] motion-reduce:transition-none max-[760px]:w-8.5 max-[760px]:px-0 [&_svg]:size-3.75"
              type="button"
              onClick={() => setConfirmation('close')}
              disabled={actionPending !== null}
            >
              <LockKeyhole aria-hidden="true" />
              <span className="max-[760px]:hidden">Close room</span>
            </button>
          ) : null}
          <button
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.75 rounded-[9px] border border-[#c9d2e0] bg-white px-3 text-xs font-[680] text-[#4b5770] transition-[border-color,color,background] duration-150 enabled:hover:border-[#abb7ca] enabled:hover:bg-[#f7f9fc] enabled:hover:text-[#17203a] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgb(49_85_217/30%)] disabled:cursor-wait disabled:opacity-[.58] motion-reduce:transition-none max-[760px]:w-8.5 max-[760px]:px-0 [&_svg]:size-3.75"
            type="button"
            onClick={() => setConfirmation('leave')}
            disabled={actionPending !== null}
          >
            {actionPending === 'leave' ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <DoorOpen aria-hidden="true" />
            )}
            <span className="max-[760px]:hidden">Leave</span>
          </button>
        </div>
      </header>

      <main className="grid h-[calc(100dvh-76px)] grid-cols-[minmax(0,1fr)_250px] gap-4 p-4 max-[920px]:relative max-[920px]:grid-cols-[minmax(0,1fr)_54px] max-[760px]:h-auto max-[760px]:grid-cols-1 max-[760px]:p-2.5">
        <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] max-[760px]:h-[calc(100dvh-88px)] max-[760px]:min-h-120">
          {strokeHistoryStatus === 'LoadingFirstPage' ? (
            <div className="relative flex min-h-0 items-center justify-center gap-2.25 overflow-hidden rounded-[24px_17px_26px_19px] border border-[#cbd4e1] bg-[#e7ecf5] text-[13px] text-[#7b879c] shadow-[8px_9px_0_#dce4f0] [&_svg]:size-4.5">
              <LoaderCircle className="animate-spin" aria-hidden="true" /> Loading every mark…
            </div>
          ) : (
            <DrawingCanvas
              roomId={session.roomId}
              sessionToken={guest.sessionToken}
              memberId={session.currentMember.memberId}
              displayName={session.currentMember.displayName}
              memberColors={memberColors}
              strokes={strokes}
              color={color}
              width={width}
              drawingControls={
                <>
                  <div className="flex items-center gap-2.5 max-[760px]:gap-1.25">
                    <span className="text-[10px] font-[760] tracking-[0.08em] text-[#69758b] uppercase max-[760px]:hidden">
                      Ink
                    </span>
                    <div className="flex items-center gap-1.25 max-[760px]:gap-0.5">
                      {COLORS.map((option) => (
                        <button
                          className="size-7.5 cursor-pointer rounded-[50%_46%_48%_43%] border-3 border-white bg-[var(--swatch)] p-0 outline outline-1 outline-transparent transition-[transform,outline-color] duration-150 enabled:hover:scale-108 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgb(49_85_217/30%)] data-[selected=true]:scale-110 data-[selected=true]:-rotate-4 data-[selected=true]:outline-[#17203a] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none max-[760px]:size-6.75"
                          type="button"
                          key={option}
                          style={{ '--swatch': option } as CSSProperties}
                          data-selected={color === option}
                          onClick={() => setColor(option)}
                          aria-label={`Use ${option} ink`}
                          aria-pressed={color === option}
                          disabled={isClosed}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="h-7 w-px bg-[#dce2ec] max-[760px]:hidden" />
                  <div className="flex items-center gap-2.5 max-[760px]:gap-1.25">
                    <span className="text-[10px] font-[760] tracking-[0.08em] text-[#69758b] uppercase max-[760px]:hidden">
                      Brush
                    </span>
                    <div className="flex items-center gap-1.25 max-[760px]:gap-0.5">
                      {WIDTHS.map((option) => (
                        <button
                          className="grid size-8 cursor-pointer place-items-center rounded-lg border border-transparent bg-transparent p-0 enabled:hover:border-[#c8d1df] enabled:hover:bg-[#edf1f7] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgb(49_85_217/30%)] data-[selected=true]:border-[#c8d1df] data-[selected=true]:bg-[#edf1f7] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none max-[760px]:size-7 [&>span]:max-h-5.5 [&>span]:max-w-5.5 [&>span]:rounded-full [&>span]:bg-[#17203a]"
                          type="button"
                          key={option}
                          data-selected={width === option}
                          onClick={() => setWidth(option)}
                          aria-label={`Use ${option} pixel brush`}
                          aria-pressed={width === option}
                          disabled={isClosed}
                        >
                          <span style={{ width: option, height: option }} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mr-0.5 text-[11px] text-[#8490a5] max-[920px]:hidden">Hold Space to move</p>
                </>
              }
              disabled={isClosed}
              onError={setNotice}
            />
          )}
        </section>

        <aside
          className="flex min-h-0 flex-col rounded-[18px_14px_20px_15px] border border-[#cbd4e1] bg-[rgb(255_255_255/80%)] p-4.5 shadow-[5px_6px_0_#dce4f0] max-[920px]:relative max-[920px]:z-6 max-[920px]:w-13.5 max-[920px]:justify-self-end max-[920px]:overflow-hidden max-[920px]:p-2 max-[920px]:backdrop-blur-xl max-[920px]:transition-[width,padding,box-shadow] max-[920px]:duration-200 max-[920px]:data-[expanded=true]:w-65 max-[920px]:data-[expanded=true]:p-4 max-[920px]:data-[expanded=true]:shadow-[0_20px_48px_rgb(38_53_84/18%),5px_6px_0_#dce4f0] max-[760px]:absolute max-[760px]:top-26.5 max-[760px]:right-2.5 max-[760px]:bottom-2.5 max-[760px]:m-0 max-[760px]:max-h-none max-[760px]:data-[expanded=true]:w-[min(260px,calc(100%-20px))] motion-reduce:transition-none"
          ref={membersPanelRef}
          data-expanded={membersExpanded}
        >
          <button
            className="absolute top-2 right-1.75 z-2 hidden size-9.5 cursor-pointer place-items-center rounded-[11px_9px_12px_10px] border border-[#cbd4e1] bg-white p-0 text-[#3155d9] shadow-[0_5px_14px_rgb(45_61_95/12%)] hover:bg-[#eef2fb] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgb(49_85_217/28%)] max-[920px]:grid [&>svg]:size-4.25"
            type="button"
            onClick={() => setMembersExpanded((expanded) => !expanded)}
            aria-expanded={membersExpanded}
            aria-controls="room-members-content"
            aria-label={
              membersExpanded ? 'Collapse people panel' : `Open people panel, ${session.activeMemberCount} here`
            }
            title={membersExpanded ? 'Collapse people panel' : 'See everyone at the table'}
          >
            <UsersRound aria-hidden="true" />
            <span className="absolute -top-1.25 -right-1.25 grid h-4.5 min-w-4.5 place-items-center rounded-full border-2 border-white bg-[#17203a] px-1 text-[10px] font-extrabold text-white tabular-nums">
              {session.activeMemberCount}
            </span>
          </button>

          <div className="flex min-h-0 flex-1 flex-col" id="room-members-content">
            <div
              className={cn(
                'flex items-start justify-between border-b border-[#e0e6ef] px-0.5 pt-0.5 pb-3.5',
                membersExpanded ? 'max-[920px]:pr-11' : 'max-[920px]:hidden'
              )}
            >
              <div>
                <p className="mb-0.75 text-[11px] font-[780] tracking-[0.12em] text-[#3155d9] uppercase">
                  At the table
                </p>
                <h2 className="m-0 font-display text-2xl tracking-[-0.04em]">People</h2>
              </div>
              <span className="rounded-full bg-[#e7ecf5] px-2 py-1.25 text-xs font-[760] text-[#536079]">
                {session.activeMemberCount}/{session.maxPlayers}
              </span>
            </div>
            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto py-2.5',
                !membersExpanded &&
                  'max-[920px]:pt-12 max-[920px]:[scrollbar-width:none] max-[920px]:[&::-webkit-scrollbar]:w-0'
              )}
            >
              {members.map((member) => {
                const isDisconnected = member.isActive && onlineByMemberId.get(member.memberId) === false;
                return (
                  <div
                    className={cn(
                      'grid min-h-11.5 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.25 px-0.75 transition-opacity',
                      !membersExpanded &&
                        'max-[920px]:flex max-[920px]:min-h-10.5 max-[920px]:justify-center max-[920px]:p-0',
                      !member.isActive && 'opacity-45 grayscale'
                    )}
                    key={member.memberId}
                  >
                    <span
                      className="grid size-8 place-items-center rounded-[50%_45%_48%_43%] border-2 border-white font-display text-[13px] font-[820] text-white shadow-[0_0_0_1px_rgb(23_32_58/11%)]"
                      style={{ background: memberColors[member.memberId] }}
                    >
                      {Array.from(member.displayName)[0]?.toUpperCase()}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 overflow-hidden text-[15px] font-[670] text-ellipsis whitespace-nowrap text-[#303c55]',
                        !membersExpanded && 'max-[920px]:hidden'
                      )}
                    >
                      {member.displayName}
                      {member.memberId === session.currentMember.memberId ? (
                        <small className="ml-1.5 text-[11px] font-[650] text-[#8994a7]">You</small>
                      ) : null}
                    </span>
                    {!member.isActive ? (
                      <span
                        className={cn(
                          'ml-auto shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500',
                          !membersExpanded && 'max-[920px]:hidden'
                        )}
                      >
                        Left
                      </span>
                    ) : isDisconnected ? (
                      <span
                        className={cn(
                          'ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-amber-700',
                          !membersExpanded && 'max-[920px]:hidden'
                        )}
                      >
                        <WifiOff className="size-3" aria-hidden="true" /> Disconnected
                      </span>
                    ) : member.isOwner ? (
                      <Crown
                        className={cn('size-3.5 shrink-0 text-[#d69e16]', !membersExpanded && 'max-[920px]:hidden')}
                        aria-label="Room owner"
                      />
                    ) : (
                      <span
                        className={cn(
                          'mr-1 size-1.75 rounded-full bg-[#35b87f]',
                          !membersExpanded && 'max-[920px]:hidden'
                        )}
                        role="img"
                        aria-label="Connected"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {!isClosed ? (
              <div
                className={cn(
                  'rounded-[12px_9px_14px_10px] bg-[#e9eef8] p-3.5 text-[#627087] max-[760px]:hidden',
                  !membersExpanded && 'max-[920px]:hidden'
                )}
              >
                <UsersRound className="size-4.25 text-[#3155d9]" aria-hidden="true" />
                <p className="mt-2 mb-2.5 text-[11px] leading-[1.45]">
                  Share the room link to bring more people to the sheet.
                </p>
                <button
                  className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-[760] text-[#3155d9]"
                  type="button"
                  onClick={copyRoomLink}
                >
                  {copied ? 'Link copied' : 'Copy invite link'}
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      </main>

      {notice ? (
        <button
          className="fixed right-5.5 bottom-5.5 z-10 flex max-w-[min(440px,calc(100vw-44px))] cursor-pointer items-center gap-4 rounded-[10px] border-0 bg-[#17203a] py-3.25 pr-3.5 pl-4 text-left text-xs text-white shadow-[0_14px_34px_rgb(23_32_58/25%)]"
          type="button"
          onClick={() => setNotice(null)}
          aria-label="Dismiss message"
        >
          {notice}
          <span className="text-xl leading-none" aria-hidden="true">
            ×
          </span>
        </button>
      ) : null}

      {confirmation ? (
        <RoomActionDialog
          action={confirmation}
          ownerIsLeaving={confirmation === 'leave' && session.isOwner}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmation === 'leave' ? handleLeave : handleClose}
        />
      ) : null}
    </div>
  );
}

function RoomActionDialog({
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
  const title = isClosing ? 'Close this room?' : ownerIsLeaving ? 'Leave and close the room?' : 'Leave this room?';
  const detail = isClosing
    ? 'The drawing stays visible, but nobody will be able to add another mark.'
    : ownerIsLeaving
      ? 'You created this room, so leaving will close it for everyone. The drawing will become read only.'
      : 'You can rejoin from this browser later, as long as the room is still open.';
  const confirmLabel = isClosing ? 'Close room' : ownerIsLeaving ? 'Leave & close' : 'Leave room';

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
            <AlertDialogCancel className="min-h-11 cursor-pointer rounded-[11px_9px_12px_10px] border border-[#c7d0de] bg-[#f5f7fb] px-4 text-xs font-[760] text-[#4d5a72] transition-[transform,box-shadow,background] duration-150 hover:-translate-y-px hover:bg-[#e9eef6] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgb(49_85_217/28%)] motion-reduce:transition-none max-[520px]:order-2">
              Keep drawing
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 cursor-pointer rounded-[11px_9px_12px_10px] border border-[#d84d42] bg-[#ff685b] px-4 text-xs font-[760] text-white shadow-[3px_3px_0_#17203a] transition-[transform,box-shadow,background] duration-150 hover:-translate-y-px hover:bg-[#f55b50] hover:shadow-[4px_4px_0_#17203a] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[rgb(49_85_217/28%)] motion-reduce:transition-none"
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function memberColor(index: number) {
  return COLORS[index % COLORS.length];
}
