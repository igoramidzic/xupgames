import { api } from '@convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { LoaderCircle, LockKeyhole, UsersRound } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import TriviaRoom from '@/components/TriviaRoom';
import TypeRacerRoom from '@/components/TypeRacerRoom';
import { type GuestIdentity, readGuest, saveGuest, validateDisplayName } from '@/lib/guest';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

type PreviewResult = FunctionReturnType<typeof api.rooms.preview>;
type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;

const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
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
    return <ActiveRoom guest={guest} session={session} />;
  }

  return <JoinRoom preview={preview} code={code} guest={guest} onJoined={setGuest} />;
}

function ActiveRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  useEffect(() => {
    if (!session.isOwner || session.ownershipReason === 'created') {
      return;
    }
    const toastKey = `xup-owner-toast:${session.roomId}:${session.ownershipVersion}`;
    if (window.sessionStorage.getItem(toastKey) !== null) {
      return;
    }
    window.sessionStorage.setItem(toastKey, 'shown');
    toast.success("You're the room owner now", {
      description: 'The previous owner left. You can close the room and choose what everyone plays next.',
      duration: 7_000,
    });
  }, [session.isOwner, session.ownershipReason, session.ownershipVersion, session.roomId]);

  if (session.gameType === 'trivia') {
    return <TriviaRoom guest={guest} session={session} />;
  }
  if (session.gameType === 'typeRacer') {
    return <TypeRacerRoom guest={guest} session={session} />;
  }
  const unsupportedGameType: never = session.gameType;
  throw new Error(`Unsupported game type: ${unsupportedGameType}`);
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
              ? isTypeRacer
                ? 'The type race is finished'
                : 'The trivia room is finished'
              : preview.ownerName
                ? `${preview.ownerName} invited you`
                : 'This room is waiting for an owner'}
          </p>
          <h1 className="m-0 font-display text-[clamp(40px,6vw,58px)] leading-[0.98] font-[820] tracking-[-0.055em] text-[#17203a]">
            {isClosed
              ? 'This room is closed.'
              : isTypeRacer
                ? 'Take your place on the line.'
                : 'Take your place at the table.'}
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
                    ? isTypeRacer
                      ? 'No more progress can be added.'
                      : 'No more answers can be added.'
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
                    ? isTypeRacer
                      ? 'Rejoin the race'
                      : 'Rejoin the quiz'
                    : isTypeRacer
                      ? 'Join the race'
                      : 'Join the quiz'}
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
