import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import TrendlineRoom from '@/games/community/trendline/TrendlineRoom';
import DoodleDashRoom from '@/games/official/doodle-dash/DoodleDashRoom';
import TriviaRoom from '@/games/official/trivia/TriviaRoom';
import TypeRacerRoom from '@/games/official/type-racer/TypeRacerRoom';
import type { GuestIdentity } from '@/lib/guest';

type SessionResult = FunctionReturnType<typeof api.rooms.getSession>;
type ActiveSession = Extract<SessionResult, { kind: 'session' }>;

/** The single web routing boundary from shared room chrome into game-owned UI. */
export default function GameRoom({ guest, session }: { guest: GuestIdentity; session: ActiveSession }) {
  switch (session.gameType) {
    case 'doodleDash':
      return <DoodleDashRoom guest={guest} session={session} />;
    case 'trivia':
      return <TriviaRoom guest={guest} session={session} />;
    case 'typeRacer':
      return <TypeRacerRoom guest={guest} session={session} />;
    case 'trendline':
      return <TrendlineRoom guest={guest} session={session} />;
    case null:
      throw new Error('The room must select a game before rendering a game surface.');
    default: {
      const unsupportedGameType: never = session.gameType;
      throw new Error(`Unsupported game type: ${unsupportedGameType}`);
    }
  }
}
