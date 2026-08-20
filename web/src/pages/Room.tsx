import { api } from '@convex/_generated/api';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Beaker, Check, Copy, Crown, DoorOpen, LoaderCircle, LockKeyhole, UsersRound } from 'lucide-react';
import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DrawingCanvas from '@/components/DrawingCanvas';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { type GuestIdentity, readGuest, saveGuest, validateDisplayName } from '@/lib/guest';

type PreviewResult = FunctionReturnType<typeof api.rooms.preview>;
type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;

const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const COLORS = ['#3155d9', '#ff685b', '#f3cb42', '#35b87f', '#8d5cf6', '#17203a'];
const WIDTHS = [4, 10, 22];

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const convexPayload = error.message.match(/\{.*"message":"([^"]+)".*\}/)?.[1];
  return convexPayload ?? error.message.replace(/^Uncaught Error:\s*/, '');
}

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
    return <CanvasRoom guest={guest} session={session} />;
  }

  return <JoinRoom preview={preview} code={code} guest={guest} onJoined={setGuest} />;
}

function RoomLoading() {
  return (
    <main className="room-loading">
      <div className="wordmark-mark" aria-hidden="true">
        X
      </div>
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>Unrolling the shared sheet…</p>
    </main>
  );
}

function RoomUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="room-unavailable">
      <Link className="wordmark" to="/">
        <span className="wordmark-mark" aria-hidden="true">
          X
        </span>
        <span>Xup Games</span>
      </Link>
      <div className="unavailable-mark">?</div>
      <p className="eyebrow">Room unavailable</p>
      <h1>{title}</h1>
      <p>{detail}</p>
      <Link className="primary-action" to="/">
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
      setError(errorMessage(joinError, 'The room could not be joined. Try again.'));
      setJoining(false);
    }
  }

  return (
    <div className="join-shell">
      <header className="site-header">
        <Link className="wordmark" to="/">
          <span className="wordmark-mark" aria-hidden="true">
            X
          </span>
          <span>Xup Games</span>
        </Link>
        <span className="join-room-code">ROOM {preview.code}</span>
      </header>

      <main className="join-main">
        <section className="join-card">
          <div className="join-room-sketch" aria-hidden="true">
            <svg viewBox="0 0 240 110">
              <title>Decorative overlapping lines</title>
              <path className="stroke-coral" d="M8 76 C 55 10, 105 105, 155 38 S 215 30, 232 18" />
              <path className="stroke-blue" d="M18 26 C 83 12, 108 94, 220 70" />
            </svg>
          </div>
          <p className="eyebrow">{isClosed ? 'The drawing is finished' : `${preview.ownerName} invited you`}</p>
          <h1>{isClosed ? 'This room is closed.' : 'Step up to the canvas.'}</h1>
          <div className="join-meta">
            <span>
              <UsersRound aria-hidden="true" /> {preview.activeMemberCount} / {preview.maxPlayers} people
            </span>
            {preview.isPasswordProtected ? (
              <span className="password-protected">
                <LockKeyhole aria-hidden="true" /> Password protected
              </span>
            ) : null}
            <span className={isClosed ? 'status-closed' : 'status-open'}>{isClosed ? 'Closed' : 'Live now'}</span>
          </div>

          {isClosed || isFull ? (
            <div className="join-blocked">
              <LockKeyhole aria-hidden="true" />
              <div>
                <strong>{isClosed ? 'No more marks can be added.' : 'Every seat is taken.'}</strong>
                <p>{isClosed ? 'Ask the owner to make a new room.' : 'Try this link again after someone leaves.'}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleJoin}>
              <label htmlFor="join-name">Your name</label>
              <input
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
                  <label htmlFor="join-password">Room password</label>
                  <input
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
              <button className="primary-action" type="submit" disabled={joining}>
                {joining ? <LoaderCircle className="spin" aria-hidden="true" /> : null}
                {joining ? 'Joining…' : guest ? 'Rejoin the canvas' : 'Join the canvas'}
              </button>
              {error ? (
                <p className="form-error" id="join-error" role="alert">
                  {error}
                </p>
              ) : (
                <p className="form-hint" id="join-hint">
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
  const navigate = useNavigate();
  const leaveRoom = useMutation(api.rooms.leave);
  const closeRoom = useMutation(api.rooms.close);
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
      Object.fromEntries(session.activeMembers.map((member, index) => [member.memberId, memberColor(index)])) as Record<
        string,
        string
      >,
    [session.activeMembers]
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
      setNotice(errorMessage(leaveError, 'The room could not be left.'));
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
      setNotice(errorMessage(closeError, 'The room could not be closed.'));
      setActionPending(null);
    }
  }

  return (
    <div className="room-shell">
      <header className="room-header">
        <Link className="wordmark" to="/" aria-label="Xup Games home">
          <span className="wordmark-mark" aria-hidden="true">
            X
          </span>
          <span>Xup Games</span>
        </Link>

        <button className="room-code-tape" type="button" onClick={copyRoomLink} aria-label="Copy room link">
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
            <button
              className="room-action"
              type="button"
              onClick={() => setConfirmation('close')}
              disabled={actionPending !== null}
            >
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
            {actionPending === 'leave' ? (
              <LoaderCircle className="spin" aria-hidden="true" />
            ) : (
              <DoorOpen aria-hidden="true" />
            )}
            <span>Leave</span>
          </button>
        </div>
      </header>

      <main className="room-workspace">
        <section className="canvas-column">
          {strokeHistoryStatus === 'LoadingFirstPage' ? (
            <div className="canvas-loading">
              <LoaderCircle className="spin" aria-hidden="true" /> Loading every mark…
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
                  <div className="tool-group">
                    <span className="tool-label">Ink</span>
                    <div className="color-list">
                      {COLORS.map((option) => (
                        <button
                          className="color-swatch"
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
                  <span className="toolbar-divider" />
                  <div className="tool-group">
                    <span className="tool-label">Brush</span>
                    <div className="size-list">
                      {WIDTHS.map((option) => (
                        <button
                          className="size-button"
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
                  <p className="toolbar-tip">Hold Space to move</p>
                </>
              }
              disabled={isClosed}
              onError={setNotice}
            />
          )}
        </section>

        <aside className="members-panel" ref={membersPanelRef} data-expanded={membersExpanded}>
          <button
            className="members-panel-toggle"
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
            <span>{session.activeMemberCount}</span>
          </button>

          <div className="members-panel-content" id="room-members-content">
            <div className="members-heading">
              <div>
                <p className="eyebrow">At the table</p>
                <h2>People</h2>
              </div>
              <span>
                {session.activeMemberCount}/{session.maxPlayers}
              </span>
            </div>
            <div className="member-list">
              {session.activeMembers.map((member) => (
                <div className="member-row" key={member.memberId}>
                  <span className="member-avatar" style={{ background: memberColors[member.memberId] }}>
                    {Array.from(member.displayName)[0]?.toUpperCase()}
                  </span>
                  <span className="member-name">
                    {member.displayName}
                    {member.memberId === session.currentMember.memberId ? <small>You</small> : null}
                  </span>
                  {member.isOwner ? (
                    <Crown aria-label="Room owner" />
                  ) : (
                    <span className="member-online" role="img" aria-label="In room" />
                  )}
                </div>
              ))}
            </div>
            {!isClosed ? (
              <div className="members-share">
                <UsersRound aria-hidden="true" />
                <p>Share the room link to bring more people to the sheet.</p>
                <button type="button" onClick={copyRoomLink}>
                  {copied ? 'Link copied' : 'Copy invite link'}
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      </main>

      {notice ? (
        <button className="room-notice" type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
          {notice}
          <span aria-hidden="true">×</span>
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
            <AlertDialogCancel className="room-confirm-cancel">Keep drawing</AlertDialogCancel>
            <AlertDialogAction className="room-confirm-submit" onClick={onConfirm}>
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
