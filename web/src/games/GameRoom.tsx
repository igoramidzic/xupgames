import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import TriviaRoom from '@/games/official/trivia/TriviaRoom';
import TypeRacerRoom from '@/games/official/type-racer/TypeRacerRoom';
import type { GuestIdentity } from '@/lib/guest';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;

/** The single web routing boundary from shared room chrome into game-owned UI. */
export default function GameRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  switch (session.gameType) {
    case 'trivia':
      return <TriviaRoom guest={guest} session={session} />;
    case 'typeRacer':
      return <TypeRacerRoom guest={guest} session={session} />;
    default: {
      const unsupportedGameType: never = session.gameType;
      throw new Error(`Unsupported game type: ${unsupportedGameType}`);
    }
  }
}
