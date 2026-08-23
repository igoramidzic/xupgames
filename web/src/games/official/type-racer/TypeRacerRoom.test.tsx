import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TypeRacerRoom from './TypeRacerRoom';

const mocks = vi.hoisted(() => ({
  game: null as Record<string, unknown> | null,
  onlineByMemberId: new Map<string, boolean>(),
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
  useRoomPresence: () => ({ onlineByMemberId: mocks.onlineByMemberId }),
}));

vi.mock('@/components/PostGameBoard', () => ({
  default: ({ title, currentGameType }: { title: string; currentGameType: string }) => (
    <section>
      <h1>{title}</h1>
      <button type="button">{currentGameType === 'typeRacer' ? 'Race Again' : 'Play Again'}</button>
      <div>Next game ballot</div>
    </section>
  ),
  PostGamePodium: () => <ol aria-label="Final podium" />,
}));

vi.mock('@/components/GameModeControl', () => ({
  default: () => <button type="button">Change game</button>,
  GameModeContent: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/environment', () => ({ isLocalhost: () => false }));

const guest = { sessionToken: 'a'.repeat(32), displayName: 'Ada' };
const session = {
  kind: 'session' as const,
  roomId: 'room-1',
  code: 'ABCDEFGH',
  gameType: 'typeRacer' as const,
  currentGameId: 'room-game-1',
  status: 'open' as const,
  activeMemberCount: 1,
  maxPlayers: 50,
  isOwner: true,
  ownershipVersion: 0,
  ownershipReason: 'created' as const,
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
    finishedAt: null as number | null,
    finishTimeMs: null as number | null,
    isCurrentPlayer: true,
    isActive: true,
  };
}

function activeRace(racers: ReturnType<typeof racer>[], phase: 'countdown' | 'racing' | 'complete' = 'racing') {
  return {
    raceNumber: 1,
    phase,
    phaseStartedAt: Date.now() - 1_000,
    startsAt: Date.now() - 1_000,
    phaseEndsAt: phase === 'complete' ? null : Date.now() + 60_000,
    participantCount: racers.length,
    finishedCount: racers.filter((entry) => entry.status === 'finished').length,
    winnerMemberId: phase === 'complete' ? (racers[0]?.memberId ?? null) : null,
    passage: {
      id: 'ishmael',
      text: 'Call me Ishmael.',
      title: 'Moby-Dick',
      author: 'Herman Melville',
      kind: 'phrase',
    },
    racers,
    currentPlayer: racers.find((entry) => entry.isCurrentPlayer) ?? null,
  };
}

function racerRowOrder() {
  return within(screen.getByRole('list', { name: 'Racer standings' }))
    .getAllByRole('listitem')
    .map((row) => row.dataset.memberId);
}

function displayedRacerColor(displayName: string) {
  const row = screen.getByText(displayName).closest('li');
  const track = row?.querySelector<HTMLElement>('[data-progress-track="true"]');
  if (track === null || track === undefined) {
    throw new Error(`Progress track for ${displayName} was not rendered.`);
  }
  return track.style.getPropertyValue('--racer-color');
}

describe('TypeRacerRoom', () => {
  beforeEach(() => {
    mocks.onlineByMemberId.clear();
    mocks.onlineByMemberId.set('member-1', true);
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

    expect(screen.getByRole('button', { name: 'Copy room link' })).toHaveClass(
      'max-[760px]:w-fit',
      'max-[760px]:justify-self-center'
    );
    expect(screen.getByRole('main')).toHaveClass('max-w-345', 'grid-cols-[minmax(0,1fr)_300px]', 'gap-4.5');
    const players = screen.getByRole('complementary', { name: 'Players in the room' });
    expect(players).toHaveClass('max-h-[clamp(640px,calc(100dvh-112px),768px)]');
    expect(players.style.getPropertyValue('--lobby-sidebar-background')).toBe('#2b1b45');
    expect(within(players).getByText('Ada (you)')).toBeInTheDocument();
    expect(within(players).getByText('Room owner')).toBeInTheDocument();
    expect(within(players).getByRole('button', { name: 'Invite more players' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start the countdown' }));
    expect(mocks.startRace).toHaveBeenCalledWith({ roomId: 'room-1', sessionToken: guest.sessionToken });
  });

  it('fades the finished race before showing the round-over board', () => {
    vi.useFakeTimers();
    try {
      const current = racer();
      mocks.game = activeRace([current]);
      const view = render(
        <MemoryRouter>
          <TypeRacerRoom guest={guest} session={session as never} />
        </MemoryRouter>
      );

      expect(screen.getByLabelText('Type the passage')).toBeInTheDocument();

      const finished = {
        ...current,
        status: 'finished',
        progress: 1,
        correctChars: 16,
        typedChars: 16,
        wpm: 72,
        accuracy: 95,
        finishTimeMs: 12_345,
        finishedAt: Date.now(),
      };
      mocks.game = activeRace([finished], 'complete');
      view.rerender(
        <MemoryRouter>
          <TypeRacerRoom guest={guest} session={session as never} />
        </MemoryRouter>
      );

      expect(screen.getByLabelText('Type the passage')).toBeInTheDocument();
      expect(screen.queryByText('Next game ballot')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Type the passage').closest('[data-transition]')).toHaveAttribute(
        'data-transition',
        'game-out'
      );

      act(() => vi.advanceTimersByTime(280));

      expect(screen.getByText('Next game ballot')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Race Again' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Type the passage')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

    await user.type(screen.getByLabelText('Type the passage'), 'Call mx Is');
    expect(screen.getByText('Backspace to the first red letter.')).toBeInTheDocument();
    const passage = screen.getByTestId('race-passage');
    expect(passage.querySelectorAll('[data-passage-word]').length).toBeGreaterThan(1);
    const wrongCharacters = Array.from(passage.querySelectorAll('[data-character-state="wrong"]'));
    expect(wrongCharacters.map((element) => element.textContent).join('')).toBe('e Is');
    expect(wrongCharacters).toHaveLength(4);
    for (const wrongCharacter of wrongCharacters) {
      expect(wrongCharacter).toHaveClass('text-[#e04d5b]');
      expect(wrongCharacter).not.toHaveClass('bg-[#ff5c57]');
      expect(wrongCharacter).not.toHaveClass('underline');
    }
    expect(passage.querySelector('[data-caret="true"]')).toHaveClass('before:absolute');

    await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}exyz');
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
    expect(screen.getByRole('list', { name: 'Racer standings' }).closest('aside')).toHaveClass(
      'h-[calc(100dvh-104px)]',
      'max-[820px]:h-auto'
    );
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

  it('labels and dims racers who disconnected or stopped playing without presence dots', () => {
    mocks.onlineByMemberId.set('member-1', false);
    const disconnected = racer();
    const inactive = {
      ...racer(),
      rank: 2,
      memberId: 'member-2',
      displayName: 'Grace',
      isCurrentPlayer: false,
      isActive: false,
    };
    mocks.game = {
      raceNumber: 1,
      phase: 'racing',
      phaseStartedAt: Date.now() - 1_000,
      startsAt: Date.now() - 1_000,
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
      racers: [disconnected, inactive],
      currentPlayer: disconnected,
    };

    render(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const standings = within(screen.getByRole('list', { name: 'Racer standings' }));
    const disconnectedCard = standings.getByText('Ada').closest('li');
    const inactiveCard = standings.getByText('Grace').closest('li');
    expect(standings.getByText('Disconnected')).toBeInTheDocument();
    expect(standings.getByText('No longer playing')).toBeInTheDocument();
    expect(disconnectedCard).toHaveAttribute('data-player-state', 'disconnected');
    expect(disconnectedCard).toHaveClass('data-[player-state=disconnected]:opacity-55');
    expect(inactiveCard).toHaveAttribute('data-player-state', 'inactive');
    expect(inactiveCard).toHaveClass('data-[player-state=inactive]:opacity-40');
    expect(disconnectedCard?.querySelector('span[class*="rounded-full"]')).toBeNull();
  });

  it('uses a continuous high-contrast progress lane without an end cap', () => {
    const current = { ...racer(), progress: 0.73, isCurrentPlayer: false };
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
      currentPlayer: null,
    };

    render(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const track = screen.getByRole('img', { name: /Ada: 73 percent/ });
    expect(track).toHaveClass('bg-[#120d1f]');
    expect(track.className).not.toContain('background-image');
    const fill = track.querySelector('[data-progress-fill="true"]');
    expect(fill).toHaveClass('opacity-75');
    expect(track.children).toHaveLength(2);
  });

  it('keeps racers in fixed lanes with the current player first while live ranks change', () => {
    const ada = { ...racer(), rank: 2 };
    const grace = {
      ...racer(),
      rank: 1,
      memberId: 'member-2',
      displayName: 'Grace',
      isCurrentPlayer: false,
      correctChars: 8,
      progress: 0.5,
    };
    const linus = {
      ...racer(),
      rank: 3,
      memberId: 'member-3',
      displayName: 'Linus',
      isCurrentPlayer: false,
      correctChars: 4,
      progress: 0.25,
    };
    mocks.game = activeRace([grace, ada, linus]);

    const view = render(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(racerRowOrder()).toEqual(['member-1', 'member-2', 'member-3']);

    const updatedLinus = { ...linus, rank: 1, correctChars: 12, progress: 0.75 };
    const updatedGrace = { ...grace, rank: 2, correctChars: 10, progress: 0.625 };
    const updatedAda = { ...ada, rank: 3 };
    mocks.game = activeRace([updatedLinus, updatedGrace, updatedAda]);
    view.rerender(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(racerRowOrder()).toEqual(['member-1', 'member-2', 'member-3']);
    const standings = within(screen.getByRole('list', { name: 'Racer standings' }));
    expect(standings.getByText('Ada').closest('li')?.querySelector('strong')?.textContent).toBe('3');
    expect(standings.getByText('Grace').closest('li')?.querySelector('strong')?.textContent).toBe('2');
    expect(standings.getByText('Linus').closest('li')?.querySelector('strong')?.textContent).toBe('1');
    expect(within(standings.getByText('Linus').closest('li') as HTMLElement).getByLabelText('Leader')).toBeVisible();
  });

  it('appends racers who join after the fixed race order is established', () => {
    const ada = racer();
    const grace = {
      ...racer(),
      rank: 2,
      memberId: 'member-2',
      displayName: 'Grace',
      isCurrentPlayer: false,
    };
    mocks.game = activeRace([ada, grace]);
    const view = render(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    const lateRacer = {
      ...racer(),
      rank: 1,
      memberId: 'member-3',
      displayName: 'Linus',
      isCurrentPlayer: false,
      correctChars: 12,
      progress: 0.75,
    };
    mocks.game = activeRace([lateRacer, { ...ada, rank: 2 }, { ...grace, rank: 3 }]);
    view.rerender(
      <MemoryRouter>
        <TypeRacerRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(racerRowOrder()).toEqual(['member-1', 'member-2', 'member-3']);
  });

  it('animates fixed lanes into authoritative final standings when the race completes', () => {
    const animate = vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve() }) as unknown as Animation);
    const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const top = Number(this.dataset.displayPosition ?? 0) * 100;
      return {
        x: 0,
        y: top,
        top,
        right: 300,
        bottom: top + 80,
        left: 0,
        width: 300,
        height: 80,
        toJSON: () => ({}),
      };
    });
    try {
      const ada = { ...racer(), rank: 3 };
      const grace = {
        ...racer(),
        rank: 1,
        memberId: 'member-2',
        displayName: 'Grace',
        isCurrentPlayer: false,
      };
      const linus = {
        ...racer(),
        rank: 2,
        memberId: 'member-3',
        displayName: 'Linus',
        isCurrentPlayer: false,
      };
      mocks.game = activeRace([grace, linus, ada]);
      const view = render(
        <MemoryRouter>
          <TypeRacerRoom guest={guest} session={session as never} />
        </MemoryRouter>
      );
      expect(racerRowOrder()).toEqual(['member-1', 'member-2', 'member-3']);
      const adaColor = displayedRacerColor('Ada');

      mocks.game = activeRace([grace, linus, ada], 'complete');
      view.rerender(
        <MemoryRouter>
          <TypeRacerRoom guest={guest} session={session as never} />
        </MemoryRouter>
      );

      expect(racerRowOrder()).toEqual(['member-2', 'member-3', 'member-1']);
      expect(displayedRacerColor('Ada')).toBe(adaColor);
      expect(animate).toHaveBeenCalledTimes(3);
      expect(animate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ transform: expect.stringContaining('translate3d') }),
          { transform: 'translate3d(0, 0, 0)' },
        ]),
        { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    } finally {
      rectSpy.mockRestore();
      if (originalAnimate) {
        Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'animate');
      }
    }
  });

  it('moves immediately to final standings when reduced motion is requested', () => {
    const animate = vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve() }) as unknown as Animation);
    const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
    const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const top = Number(this.dataset.displayPosition ?? 0) * 100;
      return {
        x: 0,
        y: top,
        top,
        right: 300,
        bottom: top + 80,
        left: 0,
        width: 300,
        height: 80,
        toJSON: () => ({}),
      };
    });
    try {
      const ada = { ...racer(), rank: 2 };
      const grace = {
        ...racer(),
        rank: 1,
        memberId: 'member-2',
        displayName: 'Grace',
        isCurrentPlayer: false,
      };
      mocks.game = activeRace([grace, ada]);
      const view = render(
        <MemoryRouter>
          <TypeRacerRoom guest={guest} session={session as never} />
        </MemoryRouter>
      );
      expect(racerRowOrder()).toEqual(['member-1', 'member-2']);

      mocks.game = activeRace([grace, ada], 'complete');
      view.rerender(
        <MemoryRouter>
          <TypeRacerRoom guest={guest} session={session as never} />
        </MemoryRouter>
      );

      expect(racerRowOrder()).toEqual(['member-2', 'member-1']);
      expect(animate).not.toHaveBeenCalled();
    } finally {
      rectSpy.mockRestore();
      if (originalAnimate) {
        Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'animate');
      }
      if (originalMatchMedia) {
        Object.defineProperty(window, 'matchMedia', originalMatchMedia);
      } else {
        Reflect.deleteProperty(window, 'matchMedia');
      }
    }
  });
});
