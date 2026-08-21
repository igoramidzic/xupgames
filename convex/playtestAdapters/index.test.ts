import { describe, expect, it } from 'vitest';
import { gameBotRunCompletionReason } from './index';

describe('playtest run completion', () => {
  it('keeps trivia players until the owner removes them', () => {
    expect(gameBotRunCompletionReason({ gameType: 'trivia' }, { endsAt: 1_000 }, 2_000)).toBeNull();
    expect(gameBotRunCompletionReason({ gameType: 'trivia' }, { endsAt: null }, 2_000)).toBeNull();
  });

  it('still ends drawing playtests at their selected duration', () => {
    expect(gameBotRunCompletionReason({ gameType: 'drawing' }, { endsAt: 1_000 }, 999)).toBeNull();
    expect(gameBotRunCompletionReason({ gameType: 'drawing' }, { endsAt: 1_000 }, 1_000)).toBe(
      'Completed the selected duration.'
    );
  });
});
