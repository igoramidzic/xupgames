import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GameRoom from './GameRoom';

vi.mock('@/games/official/trivia/TriviaRoom', () => ({ default: () => <div>Trivia room</div> }));
vi.mock('@/games/official/doodle-dash/DoodleDashRoom', () => ({ default: () => <div>Doodle Dash room</div> }));
vi.mock('@/games/official/type-racer/TypeRacerRoom', () => ({ default: () => <div>Type racer room</div> }));
vi.mock('@/games/community/trendline/TrendlineRoom', () => ({ default: () => <div>Trendline room</div> }));

describe('GameRoom routing', () => {
  it('routes Doodle Dash through its official room module', () => {
    render(
      <GameRoom
        guest={{ sessionToken: 'a'.repeat(32), displayName: 'Igor' }}
        session={{ kind: 'session', gameType: 'doodleDash' } as never}
      />
    );
    expect(screen.getByText('Doodle Dash room')).toBeInTheDocument();
  });

  it('routes the community Trendline game through its own room module', () => {
    render(
      <GameRoom
        guest={{ sessionToken: 'a'.repeat(32), displayName: 'Igor' }}
        session={{ kind: 'session', gameType: 'trendline' } as never}
      />
    );
    expect(screen.getByText('Trendline room')).toBeInTheDocument();
  });
});
