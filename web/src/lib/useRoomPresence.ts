import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useRef, useState } from 'react';

const HEARTBEAT_INTERVAL_MS = 2_000;

export function useRoomPresence({ roomId, sessionToken }: { roomId: Id<'rooms'>; sessionToken: string }) {
  const convex = useConvex();
  const heartbeat = useMutation(api.roomPresence.heartbeat);
  const disconnect = useMutation(api.roomPresence.disconnect);
  const presenceTokenRef = useRef<string | null>(null);
  const [roomToken, setRoomToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const presenceSessionId = crypto.randomUUID();

    const sendHeartbeat = async () => {
      try {
        const tokens = await heartbeat({
          roomId,
          sessionToken,
          presenceSessionId,
        });
        if (cancelled) {
          void disconnect({ sessionToken: tokens.sessionToken });
          return;
        }
        presenceTokenRef.current = tokens.sessionToken;
        setRoomToken(tokens.roomToken);
      } catch {
        // A later heartbeat retries transient failures. The server marks the session offline after its timeout.
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void sendHeartbeat();
      }
    };
    const handleUnload = () => {
      const token = presenceTokenRef.current;
      if (token === null || typeof navigator.sendBeacon !== 'function') {
        return;
      }
      const body = new Blob([JSON.stringify({ path: 'roomPresence:disconnect', args: { sessionToken: token } })], {
        type: 'application/json',
      });
      navigator.sendBeacon(`${convex.url}/api/mutation`, body);
    };

    void sendHeartbeat();
    const heartbeatInterval = window.setInterval(() => void sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      const token = presenceTokenRef.current;
      presenceTokenRef.current = null;
      if (token !== null) {
        void disconnect({ sessionToken: token });
      }
    };
  }, [convex.url, disconnect, heartbeat, roomId, sessionToken]);

  const states = useQuery(api.roomPresence.list, roomToken === null ? 'skip' : { roomToken });
  const onlineByMemberId = useMemo(
    () => new Map((states ?? []).map((state) => [state.memberId, state.online])),
    [states]
  );

  return { onlineByMemberId };
}
