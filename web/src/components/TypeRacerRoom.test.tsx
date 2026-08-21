import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TypeRacerRoom from './TypeRacerRoom';

const mocks = vi.hoisted(() => ({
  game: null as Record<string, unknown> | null,
  mutationIndex: 0,
  startRace: vi.fn(),
  reportProgress: vi.fn(),
  leaveRoom: vi.fn(),
  closeRoom: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useQuery: () => mocks.game,
  useMutation: () => {
    const mutations = [mocks.startRace, mocks.reportProgress, mocks.leaveRoom, mocks.closeRoom];
    const mutation = mutations[mocks.mutationIndex % mutations.length];
    mocks.mutationIndex += 1;
    return mutation;
  },
}));

vi.mock('@/lib/useRoomPresence', () => ({
  useRoomPresence: () => ({ onlineByMemberId: new Map([['member-1', true]]) }),
}));

vi.mock('@/lib/environment', () => ({ isLocalhost: () => false }));

const guest = { sessionToken: 'a'.repeat(32), displayName: 'Ada' };
const session = {
  kind: 'session' as const,
  roomId: 'room-1',
  code: 'ABCDEFGH',
  gameType: 'typeRacer' as const,
  status: 'open' as const,
  activeMemberCount: 1,
  maxPlayers: 50,
  isOwner: true,
  currentMember: { memberId: 'member-1', displayName: 'Ada', isActive: true, joinedAt: 1, leftAt: null },
  members: [
    {
      memberId: 'member-1',
      displayName: 'Ada',
      isOwner: true,
      isActive: true,
      joinedAt: 1,
      leftAt: null,
    },
  ],
};

function racer() {
  return {
    rank: 1,
    memberId: 'member-1',
    displayName: 'Ada',
    status: 'racing',
    correctChars: 0,
    typedChars: 0,
    totalChars: 16,
    progress: 0,
    wpm: 0,
    accuracy: 100,
    startedAt: Date.now() - 1_000,
    finishedAt: null,
    finishTimeMs: null,
    isCurrentPlayer: true,
    isActive: true,
  };
}

describe('TypeRacerRoom', () => {
  beforeEach(() => {
    mocks.mutationIndex = 0;
    mocks.startRace.mockReset().mockResolvedValue({ raceNumber: 1, startsAt: Date.now() + 4_000 });
    mocks.reportProgress.mockReset().mockResolvedValue({ wpm: 60, accuracy: 95, finished: false });
    mocks.leaveRoom.mockReset();
    mocks.closeRoom.mockReset();
  });

  it('starts a race from the owner lobby', async () => {
    mocks.game = {
      raceNumber: 0,
      phase: 'lobby',
      phaseStartedAt: null,
      startsAt: null,
      phaseEndsAt: null,
      participantCount: 0,
      finishedCount: 0,
      winnerMemberId: null,
      passage: null,
      racers: [{ ...racer(), status: 'waiting', totalChars: 0 }],
      currentPlayer: { ...racer(), status: 'waiting', totalChars: 0 },
    };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Start the countdown' }));
    expect(mocks.startRace).toHaveBeenCalledWith({ roomId: 'room-1', sessionToken: guest.sessionToken });
  });

  it('re-enables the race action after a successful start', async () => {
    mocks.game = {
      raceNumber: 0,
      phase: 'lobby',
      phaseStartedAt: null,
      startsAt: null,
      phaseEndsAt: null,
      participantCount: 0,
      finishedCount: 0,
      winnerMemberId: null,
      passage: null,
      racers: [{ ...racer(), status: 'waiting', totalChars: 0 }],
      currentPlayer: { ...racer(), status: 'waiting', totalChars: 0 },
    };
    const user = userEvent.setup();
    const view = render(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Start the countdown' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start the countdown' })).toBeEnabled());

    const current = {
      ...racer(),
      status: 'finished',
      wpm: 72,
      accuracy: 95,
      finishTimeMs: 12_345,
      finishedAt: Date.now(),
    };
    mocks.game = {
      raceNumber: 1,
      phase: 'complete',
      phaseStartedAt: Date.now() - 12_345,
      startsAt: Date.now() - 12_345,
      phaseEndsAt: Date.now(),
      participantCount: 1,
      finishedCount: 1,
      winnerMemberId: 'member-1',
      passage: {
        id: 'ishmael',
        text: 'Call me Ishmael.',
        title: 'Moby-Dick',
        author: 'Herman Melville',
        kind: 'phrase',
      },
      racers: [current],
      currentPlayer: current,
    };
    view.rerender(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Race again' })).toBeEnabled();
  });

  it('shows wrong letters and requires backtracking', async () => {
    const current = racer();
    mocks.game = {
      raceNumber: 1,
      phase: 'racing',
      phaseStartedAt: Date.now() - 1_000,
      startsAt: Date.now() - 1_000,
      phaseEndsAt: Date.now() + 60_000,
      participantCount: 1,
      finishedCount: 0,
      winnerMemberId: null,
      passage: {
        id: 'ishmael',
        text: 'Call me Ishmael.',
        title: 'Moby-Dick',
        author: 'Herman Melville',
        kind: 'phrase',
      },
      racers: [current],
      currentPlayer: current,
    };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Type the passage'), 'Call mx');
    expect(screen.getByText('Backspace to the first red letter.')).toBeInTheDocument();
    const passage = screen.getByTestId('race-passage');
    expect(passage.querySelectorAll('[data-passage-word]').length).toBeGreaterThan(1);
    const wrongCharacter = passage.querySelector('[data-character-state="wrong"]');
    expect(wrongCharacter).toHaveTextContent('e');
    expect(wrongCharacter).toHaveClass('text-[#e04d5b]');
    expect(wrongCharacter).not.toHaveClass('bg-[#ff5c57]');
    expect(wrongCharacter).not.toHaveClass('underline');
    expect(passage.querySelector('[data-caret="true"]')).toHaveClass('before:absolute');

    await user.keyboard('{Backspace}{Backspace}mexyz');
    const insertedCharacters = Array.from(passage.querySelectorAll('[data-inserted-character="true"]'));
    expect(insertedCharacters.map((element) => element.textContent).join('')).toBe('xyz');
    expect(insertedCharacters.at(-1)).not.toHaveClass('underline');
    expect(insertedCharacters.at(-1)?.nextElementSibling).toHaveAttribute('data-caret', 'true');
    expect(insertedCharacters.at(-1)?.nextElementSibling?.nextElementSibling).toHaveAttribute(
      'data-expected-space',
      'true'
    );
    expect(screen.getByLabelText('Type the passage')).toHaveValue('Call mexyz');
  });

  it('focuses the typing surface and keeps the first key when a race is active', async () => {
    const current = racer();
    mocks.game = {
      raceNumber: 1,
      phase: 'racing',
      phaseStartedAt: Date.now() - 1_000,
      startsAt: Date.now() - 1_000,
      phaseEndsAt: Date.now() + 60_000,
      participantCount: 1,
      finishedCount: 0,
      winnerMemberId: null,
      passage: {
        id: 'ishmael',
        text: 'Call me Ishmael.',
        title: 'Moby-Dick',
        author: 'Herman Melville',
        kind: 'phrase',
      },
      racers: [current],
      currentPlayer: current,
    };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );
    const input = screen.getByLabelText('Type the passage');
    input.blur();

    await user.keyboard('C');

    expect(input).toHaveFocus();
    expect(input).toHaveValue('C');
  });

  it('lets a late-arriving member join the active race and appear in the standings', async () => {
    const lateArrival = {
      ...racer(),
      rank: 2,
      memberId: 'member-2',
      displayName: 'Grace',
      startedAt: Date.now(),
      isCurrentPlayer: true,
    };
    const originalRacer = { ...racer(), isCurrentPlayer: false, correctChars: 5, progress: 5 / 16 };
    mocks.game = {
      raceNumber: 1,
      phase: 'racing',
      phaseStartedAt: Date.now() - 10_000,
      startsAt: Date.now() - 10_000,
      phaseEndsAt: Date.now() + 60_000,
      participantCount: 2,
      finishedCount: 0,
      winnerMemberId: null,
      passage: {
        id: 'ishmael',
        text: 'Call me Ishmael.',
        title: 'Moby-Dick',
        author: 'Herman Melville',
        kind: 'phrase',
      },
      racers: [originalRacer, lateArrival],
      currentPlayer: lateArrival,
    };
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const standings = within(screen.getByRole('list', { name: 'Racer standings' }));
    expect(standings.getByText('Grace')).toBeInTheDocument();
    const input = screen.getByLabelText('Type the passage');
    expect(input).toBeEnabled();
    await user.type(input, 'C');
    expect(input).toHaveValue('C');
  });

  it('keeps names, speed, accuracy, and finish times readable in the standings', () => {
    const current = {
      ...racer(),
      status: 'finished',
      wpm: 72,
      accuracy: 95,
      finishTimeMs: 12_345,
      finishedAt: Date.now(),
    };
    mocks.game = {
      raceNumber: 1,
      phase: 'complete',
      phaseStartedAt: Date.now() - 12_345,
      startsAt: Date.now() - 12_345,
      phaseEndsAt: Date.now(),
      participantCount: 1,
      finishedCount: 1,
      winnerMemberId: 'member-1',
      passage: {
        id: 'ishmael',
        text: 'Call me Ishmael.',
        title: 'Moby-Dick',
        author: 'Herman Melville',
        kind: 'phrase',
      },
      racers: [current],
      currentPlayer: current,
    };
    render(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const standings = within(screen.getByRole('list', { name: 'Racer standings' }));
    expect(standings.getByText('Ada')).toHaveClass('text-sm');
    expect(standings.getByText('72', { exact: false }).closest('span')).toHaveClass('text-sm');
    expect(standings.getByText('12.35s').parentElement).toHaveClass('text-[11px]');
  });
});
