import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type CursorPoint = {
  x: number;
  y: number;
};

export type RemoteCursor = CursorPoint & {
  memberId: Id<'roomMembers'>;
  displayName: string;
};

const HEARTBEAT_INTERVAL_MS = 10_000;
const CURSOR_SEND_INTERVAL_MS = 50;

type PendingCursor = CursorPoint | null | undefined;

export function useCursorPresence({
  roomId,
  memberId,
  sessionToken,
}: {
  roomId: Id<'rooms'>;
  memberId: Id<'roomMembers'>;
  sessionToken: string;
}) {
  const convex = useConvex();
  const heartbeat = useMutation(api.cursorPresence.heartbeat);
  const disconnect = useMutation(api.cursorPresence.disconnect);
  const sendCursor = useMutation(api.cursorPresence.updateCursor);
  const presenceSessionIdRef = useRef(crypto.randomUUID());
  const presenceTokenRef = useRef<string | null>(null);
  const roomTokenRef = useRef<string | null>(null);
  const [roomToken, setRoomToken] = useState<string | null>(null);

  const pendingCursorRef = useRef<PendingCursor>(undefined);
  const cursorInFlightRef = useRef(false);
  const cursorTimeoutRef = useRef<number | null>(null);
  const lastCursorSentAtRef = useRef(0);
  const flushCursorRef = useRef<() => void>(() => undefined);

  flushCursorRef.current = () => {
    if (cursorInFlightRef.current || pendingCursorRef.current === undefined || roomTokenRef.current === null) {
      return;
    }

    const elapsed = Date.now() - lastCursorSentAtRef.current;
    const delay = Math.max(0, CURSOR_SEND_INTERVAL_MS - elapsed);
    if (delay > 0) {
      if (cursorTimeoutRef.current === null) {
        cursorTimeoutRef.current = window.setTimeout(() => {
          cursorTimeoutRef.current = null;
          flushCursorRef.current();
        }, delay);
      }
      return;
    }

    const cursor = pendingCursorRef.current;
    pendingCursorRef.current = undefined;
    cursorInFlightRef.current = true;
    lastCursorSentAtRef.current = Date.now();
    void sendCursor({ roomId, sessionToken, cursor })
      .catch(() => undefined)
      .finally(() => {
        cursorInFlightRef.current = false;
        flushCursorRef.current();
      });
  };

  const updateCursor = useCallback((cursor: CursorPoint | null) => {
    pendingCursorRef.current = cursor;
    flushCursorRef.current();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let heartbeatInterval: number | null = null;
    roomTokenRef.current = null;
    setRoomToken(null);

    const sendHeartbeat = async (clearCursor: boolean) => {
      try {
        const tokens = await heartbeat({
          roomId,
          sessionToken,
          presenceSessionId: presenceSessionIdRef.current,
          clearCursor,
        });
        if (cancelled) {
          void disconnect({ sessionToken: tokens.sessionToken });
          return;
        }
        presenceTokenRef.current = tokens.sessionToken;
        roomTokenRef.current = tokens.roomToken;
        setRoomToken(tokens.roomToken);
        flushCursorRef.current();
      } catch {
        // A later heartbeat retries transient failures without interrupting gameplay.
      }
    };

    const startHeartbeats = (clearCursor: boolean) => {
      void sendHeartbeat(clearCursor);
      if (heartbeatInterval !== null) {
        window.clearInterval(heartbeatInterval);
      }
      heartbeatInterval = window.setInterval(() => void sendHeartbeat(false), HEARTBEAT_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (heartbeatInterval !== null) {
          window.clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        const token = presenceTokenRef.current;
        if (token !== null) {
          void disconnect({ sessionToken: token });
        }
        roomTokenRef.current = null;
        setRoomToken(null);
        return;
      }
      startHeartbeats(true);
    };

    const handleUnload = () => {
      const token = presenceTokenRef.current;
      if (token === null || typeof navigator.sendBeacon !== 'function') {
        return;
      }
      const body = new Blob([JSON.stringify({ path: 'cursorPresence:disconnect', args: { sessionToken: token } })], {
        type: 'application/json',
      });
      navigator.sendBeacon(`${convex.url}/api/mutation`, body);
    };

    startHeartbeats(true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      cancelled = true;
      if (heartbeatInterval !== null) {
        window.clearInterval(heartbeatInterval);
      }
      if (cursorTimeoutRef.current !== null) {
        window.clearTimeout(cursorTimeoutRef.current);
        cursorTimeoutRef.current = null;
      }
      pendingCursorRef.current = undefined;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      const token = presenceTokenRef.current;
      presenceTokenRef.current = null;
      roomTokenRef.current = null;
      if (token !== null) {
        void disconnect({ sessionToken: token });
      }
    };
  }, [convex.url, disconnect, heartbeat, roomId, sessionToken]);

  const states = useQuery(api.cursorPresence.list, roomToken === null ? 'skip' : { roomToken });
  const remoteCursors = useMemo(
    () =>
      (states ?? []).flatMap((state): RemoteCursor[] => {
        if (!state.online || state.memberId === memberId || state.cursor === null) {
          return [];
        }
        return [{ memberId: state.memberId, ...state.cursor }];
      }),
    [memberId, states]
  );

  return { remoteCursors, updateCursor };
}
