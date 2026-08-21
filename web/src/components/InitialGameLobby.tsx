import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Check, Copy, DoorOpen, LoaderCircle, LockKeyhole, UsersRound, Vote } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { GuestIdentity } from '@/lib/guest';
import { getRoomMembers } from '@/lib/roomSession';
import { useRoomPresence } from '@/lib/useRoomPresence';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';
import NextGameVoting from './NextGameVoting';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;

export default function InitialGameLobby({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  const navigate = useNavigate();
  const leaveRoom = useMutation(api.rooms.leave);
  const closeRoom = useMutation(api.rooms.close);
  const { onlineByMemberId } = useRoomPresence({ roomId: session.roomId, sessionToken: guest.sessionToken });
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'leave' | 'close' | null>(null);
  const [pendingAction, setPendingAction] = useState<'leave' | 'close' | null>(null);
  const isClosed = session.status === 'closed';
  const members = getRoomMembers(session);

  useEffect(() => {
    if (!copied) {
      return;
    }
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

  async function handleLeave() {
    setConfirmation(null);
    setPendingAction('leave');
    try {
      await leaveRoom({ code: session.code, sessionToken: guest.sessionToken });
      navigate('/');
    } catch (error) {
      setNotice(userFacingError(error, 'The room could not be left.'));
      setPendingAction(null);
    }
  }

  async function handleClose() {
    setConfirmation(null);
    setPendingAction('close');
    try {
      await closeRoom({ code: session.code, sessionToken: guest.sessionToken });
      setNotice('Room closed. Make a new room when you are ready to play.');
    } catch (error) {
      setNotice(userFacingError(error, 'The room could not be closed.'));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="min-h-dvh bg-[#eef3fa] bg-[radial-gradient(circle_at_16%_18%,rgb(49_85_217/10%)_0_13rem,transparent_29rem),linear-gradient(rgb(52_76_119/6%)_1px,transparent_1px),linear-gradient(90deg,rgb(52_76_119/6%)_1px,transparent_1px)] bg-size-[auto,40px_40px,40px_40px,auto] text-[#17203a]">
      <header className="sticky top-0 z-10 grid h-19 grid-cols-[1fr_auto_1fr] items-center border-b border-[#c3cedd] bg-[rgb(248_250_253/92%)] px-5.5 backdrop-blur-[15px] max-[760px]:h-17 max-[760px]:grid-cols-[auto_1fr_auto] max-[760px]:px-3">
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

        <ButtonLikeRoomCode copied={copied} code={session.code} onCopy={copyRoomLink} />

        <div className="flex items-center justify-end gap-2">
          <span className="mr-1 inline-flex items-center gap-2 text-xs font-bold text-[#4d5a72] max-[760px]:hidden">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                isClosed
                  ? 'bg-[#8b95a7] shadow-[0_0_0_4px_rgb(139_149_167/13%)]'
                  : 'bg-[#35b87f] shadow-[0_0_0_4px_rgb(53_184_127/13%)]'
              )}
            />
            {isClosed ? 'Closed' : 'Live'}
          </span>
          {session.isOwner && !isClosed ? (
            <Button
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#bdc8d8] bg-white px-3 text-[11px] font-[760] text-[#34415b] shadow-[2px_2px_0_rgb(23_32_58/8%)] transition-transform hover:-translate-y-0.5 disabled:opacity-55 max-[760px]:w-8.5 max-[760px]:px-0 [&_svg]:size-3.75"
              type="button"
              onClick={() => setConfirmation('close')}
              disabled={pendingAction !== null}
              variant="paper"
              size="sm"
            >
              {pendingAction === 'close' ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}
              <span className="max-[760px]:hidden">Close room</span>
            </Button>
          ) : null}
          <Button
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#bdc8d8] bg-white px-3 text-[11px] font-[760] text-[#34415b] shadow-[2px_2px_0_rgb(23_32_58/8%)] transition-transform hover:-translate-y-0.5 disabled:opacity-55 max-[760px]:w-8.5 max-[760px]:px-0 [&_svg]:size-3.75"
            type="button"
            onClick={() => setConfirmation('leave')}
            disabled={pendingAction !== null}
            variant="paper"
            size="sm"
          >
            {pendingAction === 'leave' ? <LoaderCircle className="animate-spin" /> : <DoorOpen />}
            <span className="max-[760px]:hidden">Leave</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100dvh-76px)] w-[min(1120px,calc(100%-36px))] grid-cols-[minmax(0,1fr)_280px] items-start gap-4.5 py-8 max-[820px]:w-[min(720px,calc(100%-24px))] max-[820px]:grid-cols-1 max-[760px]:min-h-[calc(100dvh-68px)] max-[760px]:py-4">
        <section className="min-w-0">
          <div className="mb-5 rounded-[22px_15px_24px_17px] border border-[#c1ccdc] bg-[rgb(255_255_255/86%)] p-6 shadow-[7px_8px_0_rgb(23_32_58/8%)] max-[620px]:p-4.5">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-[820] tracking-[0.13em] text-[#3155d9] uppercase">
              <Vote className="size-3.5" aria-hidden="true" /> The room is open
            </p>
            <h1 className="m-0 font-display text-[clamp(34px,5vw,58px)] leading-[0.94] font-[850] tracking-[-0.06em]">
              Invite everyone. Then pick together.
            </h1>
            <p className="mt-3.5 mb-0 max-w-165 text-sm leading-[1.6] text-[#657087]">
              Anyone who joins can vote for the first game. The room owner closes the round and starts the final pick.
            </p>
          </div>

          {isClosed ? (
            <div className="rounded-[20px_13px_22px_15px] border border-[#c7d1e0] bg-white p-8 text-center shadow-[6px_7px_0_rgb(23_32_58/10%)] max-[620px]:p-5">
              <LockKeyhole className="mx-auto mb-4 size-9 text-[#657087]" aria-hidden="true" />
              <h2 className="m-0 font-display text-3xl font-[830] tracking-[-0.045em]">This room is closed.</h2>
              <p className="mx-auto mt-3 mb-5 max-w-105 text-sm leading-[1.55] text-[#657087]">
                No game was started. Make a new room when the group is ready.
              </p>
              <Link className="text-sm font-[780] text-[#3155d9]" to="/">
                Make a new room
              </Link>
            </div>
          ) : (
            <NextGameVoting
              roomId={session.roomId}
              currentGameId={null}
              currentGameType={null}
              sessionToken={guest.sessionToken}
              isOwner={session.isOwner}
            />
          )}
        </section>

        <aside className="min-h-0 overflow-hidden rounded-[16px_10px_18px_12px] border border-[#c1ccdc] bg-[rgb(255_255_255/94%)] shadow-[5px_6px_0_rgb(23_32_58/8%)]">
          <div className="flex items-center justify-between border-b border-[#d5dde8] px-4 py-4">
            <div>
              <p className="mb-0.5 text-[9px] font-[820] tracking-[0.12em] text-[#3155d9] uppercase">In the room</p>
              <h2 className="m-0 font-display text-xl font-[800] tracking-[-0.035em]">Players</h2>
            </div>
            <span className="inline-flex items-center gap-1.25 rounded-full bg-[#edf1f7] px-2.5 py-1.5 text-xs font-[760] text-[#536079]">
              <UsersRound className="size-3.5" aria-hidden="true" /> {session.activeMemberCount}
            </span>
          </div>
          <ol className="m-0 flex max-h-[calc(100dvh-190px)] list-none flex-col gap-1.5 overflow-y-auto p-3 max-[820px]:max-h-80">
            {members.map((member) => {
              const isCurrentPlayer = member.memberId === session.currentMember.memberId;
              const isDisconnected = member.isActive && onlineByMemberId.get(member.memberId) === false;
              return (
                <li
                  className={cn(
                    'flex min-h-12 items-center gap-2.5 rounded-[10px_7px_11px_8px] px-2.5 py-2',
                    isCurrentPlayer && 'bg-[#edf1ff]',
                    !member.isActive && 'opacity-45 grayscale'
                  )}
                  key={member.memberId}
                >
                  <span className="grid size-8.5 shrink-0 place-items-center rounded-[11px_8px_12px_9px] border border-[#17203a] bg-[#f3cb42] font-display text-sm font-[850] text-[#17203a] shadow-[2px_2px_0_rgb(23_32_58/14%)]">
                    {member.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <strong className="overflow-hidden text-sm text-ellipsis whitespace-nowrap text-[#27344e]">
                      {member.displayName} {isCurrentPlayer ? '(you)' : ''}
                    </strong>
                    <small className="text-[10px] font-[650] text-[#7b8699]">
                      {!member.isActive
                        ? 'Left'
                        : isDisconnected
                          ? 'Disconnected'
                          : member.isOwner
                            ? 'Room owner'
                            : 'Ready to vote'}
                    </small>
                  </span>
                </li>
              );
            })}
          </ol>
          <Button
            className="m-3 mt-0 inline-flex h-10 w-[calc(100%-24px)] items-center justify-center gap-2 rounded-lg border border-[#bdc8d8] bg-[#f8fafd] px-3 text-xs font-[760] text-[#34415b] hover:bg-white [&_svg]:size-4"
            type="button"
            onClick={copyRoomLink}
            variant="paper"
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? 'Link copied' : 'Invite more players'}
          </Button>
        </aside>
      </main>

      {notice ? (
        <Button
          className="fixed right-5.5 bottom-5.5 z-20 flex max-w-[min(440px,calc(100vw-44px))] items-center gap-4 rounded-xl border border-[#d2b14d] bg-[#fff3c8] px-4 py-3 text-left text-xs font-[680] text-[#654d0b] shadow-lg"
          type="button"
          onClick={() => setNotice(null)}
          aria-label="Dismiss message"
          variant="notice"
        >
          {notice}
          <span className="text-xl leading-none" aria-hidden="true">
            ×
          </span>
        </Button>
      ) : null}

      {confirmation ? (
        <InitialLobbyActionDialog
          action={confirmation}
          ownerIsLeaving={confirmation === 'leave' && session.isOwner}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmation === 'leave' ? handleLeave : handleClose}
        />
      ) : null}
    </div>
  );
}

function ButtonLikeRoomCode({ copied, code, onCopy }: { copied: boolean; code: string; onCopy: () => void }) {
  return (
    <Button
      className="inline-flex h-9 -rotate-1 items-center gap-2 rounded-[8px_11px_7px_10px] border border-[#bfc9d9] bg-white px-4 text-[10px] font-[820] tracking-[0.12em] text-[#17203a] shadow-[3px_3px_0_#dbe2ec] max-[760px]:w-fit max-[760px]:justify-self-center max-[760px]:px-2.5 max-[760px]:text-[8px] [&_svg]:size-3.25"
      type="button"
      onClick={onCopy}
      aria-label="Copy room link"
      variant="paper"
      size="sm"
    >
      <span>ROOM {code}</span>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  );
}

function InitialLobbyActionDialog({
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
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="box-border w-[min(420px,calc(100vw-32px))] max-w-105 rounded-[22px_16px_24px_18px] border border-[#bfc9d9] bg-white p-0 text-[#17203a] shadow-[9px_10px_0_rgb(23_32_58/16%),0_28px_80px_rgb(23_32_58/28%)] motion-reduce:animate-none">
        <div className="px-8.5 pt-8.5 pb-7.5 text-center max-[520px]:px-5.5 max-[520px]:pt-7.5 max-[520px]:pb-5.5">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-[18px_14px_20px_15px] border-2 border-[#17203a] bg-[#f3cb42] shadow-[4px_4px_0_#17203a] [&_svg]:size-6">
            {isClosing ? <LockKeyhole /> : <DoorOpen />}
          </div>
          <p className="mb-1.75 text-[9px] font-[780] tracking-[0.12em] text-[#3155d9] uppercase">Before you go</p>
          <AlertDialogTitle asChild>
            <h2 className="m-0 font-display text-[clamp(28px,5vw,36px)] tracking-[-0.05em]">
              {isClosing ? 'Close this room?' : 'Leave this room?'}
            </h2>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <p className="mx-auto mt-3.5 mb-6.5 max-w-85 text-[13px] leading-[1.55] text-[#657087]">
              {isClosing
                ? 'Voting stops and this room cannot start a game.'
                : ownerIsLeaving
                  ? 'The room stays open and ownership passes to the next active player.'
                  : 'You can rejoin from this browser while the room remains open.'}
            </p>
          </AlertDialogDescription>
          <div className="grid grid-cols-2 gap-2.5 max-[520px]:grid-cols-1">
            <AlertDialogCancel variant="paper" className="min-h-11 text-xs font-[760] max-[520px]:order-2">
              Stay in the room
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
