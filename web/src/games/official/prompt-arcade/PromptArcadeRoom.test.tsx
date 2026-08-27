import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PromptArcadeRoom from './PromptArcadeRoom';

const mocks = vi.hoisted(() => ({
  game: undefined as unknown,
  mutation: vi.fn(async () => undefined),
}));

vi.mock('convex/react', () => ({
  useQuery: () => mocks.game,
  useMutation: () => mocks.mutation,
  useAction: () => mocks.mutation,
}));

vi.mock('@/components/GameModeControl', () => ({
  default: () => null,
  GameModeContent: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/NextGameVoting', () => ({
  default: () => null,
}));

vi.mock('@/lib/useRoomPresence', () => ({
  useRoomPresence: () => ({ onlineByMemberId: new Map() }),
}));

const guest = { sessionToken: 'a'.repeat(32), displayName: 'Igor' };
const session = {
  kind: 'session',
  roomId: 'room-1',
  currentGameId: 'room-game-1',
  gameType: 'promptArcade',
  code: 'FACTORY',
  status: 'open',
  isOwner: true,
  memberId: 'member-1',
  currentMember: {
    memberId: 'member-1',
    displayName: 'Igor',
    isOwner: true,
    isActive: true,
    leftAt: null,
  },
  activeMemberCount: 3,
  members: [
    { memberId: 'member-1', displayName: 'Igor', isOwner: true, isActive: true, leftAt: null },
    { memberId: 'member-2', displayName: 'Maya', isOwner: false, isActive: true, leftAt: null },
    { memberId: 'member-3', displayName: 'Theo', isOwner: false, isActive: true, leftAt: null },
  ],
};

const baseGame = {
  gameNumber: 1,
  phase: 'prompting',
  phaseStartedAt: Date.now(),
  phaseEndsAt: null,
  currentRoundNumber: 0,
  participantCount: 3,
  requiredReadyCount: 3,
  playlistStarted: false,
  isOwner: true,
  canStartPlaylist: true,
  summary: {
    total: 3,
    writing: 1,
    queued: 0,
    generating: 1,
    validating: 0,
    repairing: 0,
    ready: 1,
    needsRevision: 0,
    withdrawn: 0,
    played: 0,
  },
  entries: [
    {
      entryId: 'entry-1',
      memberId: 'member-1',
      displayName: 'Igor',
      prompt: null,
      status: 'writing',
      order: 0,
      attempt: 0,
      errorMessage: null,
      submittedAt: null,
      readyAt: null,
      statusUpdatedAt: Date.now(),
      retryAvailableAt: null,
      artifactTitle: null,
      isCurrentPlayer: true,
      isActive: true,
    },
    {
      entryId: 'entry-2',
      memberId: 'member-2',
      displayName: 'Maya',
      prompt: 'Catch the blue dot',
      status: 'generating',
      order: 1,
      attempt: 1,
      errorMessage: null,
      submittedAt: Date.now(),
      readyAt: null,
      statusUpdatedAt: Date.now(),
      retryAvailableAt: Date.now() + 120_000,
      artifactTitle: null,
      isCurrentPlayer: false,
      isActive: true,
    },
    {
      entryId: 'entry-3',
      memberId: 'member-3',
      displayName: 'Theo',
      prompt: 'Make a tiny asteroid field',
      status: 'ready',
      order: 2,
      attempt: 1,
      errorMessage: null,
      submittedAt: Date.now(),
      readyAt: Date.now(),
      statusUpdatedAt: Date.now(),
      retryAvailableAt: null,
      artifactTitle: 'Asteroid Pocket',
      isCurrentPlayer: false,
      isActive: true,
    },
  ],
  round: null,
  currentResult: null,
  roundResults: [],
  currentGameRating: {
    rating: null,
    canRate: false,
    ratingCount: 0,
    eligibleRaterCount: 0,
  },
  gameRankings: [],
  standings: [
    {
      rank: 1,
      memberId: 'member-1',
      displayName: 'Igor',
      totalScore: 0,
      creatorBonus: 0,
      roundsFinished: 0,
      isCurrentPlayer: true,
      isActive: true,
    },
    {
      rank: 2,
      memberId: 'member-2',
      displayName: 'Maya',
      totalScore: 0,
      creatorBonus: 0,
      roundsFinished: 0,
      isCurrentPlayer: false,
      isActive: true,
    },
    {
      rank: 3,
      memberId: 'member-3',
      displayName: 'Theo',
      totalScore: 0,
      creatorBonus: 0,
      roundsFinished: 0,
      isCurrentPlayer: false,
      isActive: true,
    },
  ],
};

function renderRoom() {
  return render(
    <MemoryRouter>
      <PromptArcadeRoom guest={guest} session={session as never} />
    </MemoryRouter>
  );
}

describe('PromptArcadeRoom', () => {
  beforeEach(() => {
    mocks.game = baseGame;
    mocks.mutation.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows honest player stages and sends every player prompt, including emoji', async () => {
    const user = userEvent.setup();
    renderRoom();

    expect(screen.getByRole('heading', { name: 'What should everyone play?' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Prompt Arcade players' })).toBeInTheDocument();
    const buildRoster = screen.getByRole('list', { name: 'Build status for 3 players' });
    expect(within(buildRoster).getAllByRole('listitem')).toHaveLength(3);
    expect(within(buildRoster).getByRole('listitem', { name: '2. Maya: Building the game' })).toBeInTheDocument();
    expect(within(buildRoster).getByRole('listitem', { name: '3. Theo: Ready to play' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Maya: Building the game' })).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByText('Asteroid Pocket')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Mini-game prompt'), 'Tap every 🍊 before it rolls away');
    await user.click(screen.getByRole('button', { name: 'Build my game' }));
    expect(mocks.mutation).toHaveBeenCalledWith({
      roomId: 'room-1',
      sessionToken: guest.sessionToken,
      prompt: 'Tap every 🍊 before it rolls away',
    });
  });

  it('offers only the owner an early-start override once one game is ready', () => {
    renderRoom();
    expect(screen.getByRole('button', { name: 'Start early with 1 ready' })).toBeEnabled();
  });

  it('shows owners both shared room actions and keeps only leave with a final-score banner after closing', () => {
    const view = renderRoom();

    expect(screen.getByRole('button', { name: 'Leave room' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Close room' })).toBeEnabled();

    mocks.game = {
      ...baseGame,
      phase: 'complete',
      summary: { ...baseGame.summary, writing: 0, generating: 0, ready: 0, withdrawn: 3 },
    };
    view.rerender(
      <MemoryRouter>
        <PromptArcadeRoom guest={guest} session={{ ...session, status: 'closed' } as never} />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Leave room' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Close room' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Final score' })).toHaveTextContent('Igor · 0 points');
    expect(screen.getByRole('heading', { name: 'Igor wins the arcade.' })).toBeInTheDocument();
  });

  it('removes the close action immediately after the close mutation succeeds', async () => {
    const user = userEvent.setup();
    renderRoom();

    await user.click(screen.getByRole('button', { name: 'Close room' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close room' }));

    expect(mocks.mutation).toHaveBeenCalledWith({ code: 'FACTORY', sessionToken: guest.sessionToken });
    expect(screen.queryByRole('button', { name: 'Close room' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave room' })).toBeEnabled();
    expect(screen.getByRole('status', { name: 'Final score' })).toBeInTheDocument();
  });

  it('keeps the player rail visible while games are still building', () => {
    const fourthEntry = {
      ...baseGame.entries[2],
      entryId: 'entry-4',
      memberId: 'member-4',
      displayName: 'June',
      prompt: 'Balance a falling tower',
      artifactTitle: 'Tower Tilter',
      isCurrentPlayer: false,
    };
    mocks.game = {
      ...baseGame,
      participantCount: 4,
      requiredReadyCount: 4,
      canStartPlaylist: true,
      summary: { ...baseGame.summary, total: 4, writing: 0, generating: 1, ready: 3 },
      entries: [
        { ...baseGame.entries[0], prompt: 'Draw a circle', status: 'ready', artifactTitle: 'Circle Lab' },
        baseGame.entries[1],
        baseGame.entries[2],
        fourthEntry,
      ],
    };
    renderRoom();
    expect(screen.getByRole('button', { name: 'Start early with 3 ready' })).toBeEnabled();
    expect(screen.getByText('1 building')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite more players' })).toBeInTheDocument();
  });

  it('reveals the creator before the game title and instructions', () => {
    const now = Date.now();
    const round = {
      roundId: 'round-1',
      roundNumber: 1,
      status: 'countdown',
      countdownStartedAt: now,
      playStartsAt: now + 8_000,
      playEndsAt: now + 28_000,
      resultsStartedAt: null,
      entry: {
        entryId: 'entry-2',
        memberId: 'member-2',
        displayName: 'Maya',
        prompt: 'Catch the blue dot',
      },
      artifact: {
        artifactId: 'artifact-1',
        title: 'Dot Catcher',
        interpretation: 'Catch a moving target before time runs out.',
        instructions: 'Tap the blue dot five times.',
        durationMs: 20_000,
        scoringMode: 'speed',
        codeUrl: null,
      },
    };
    mocks.game = {
      ...baseGame,
      phase: 'countdown',
      phaseStartedAt: now,
      phaseEndsAt: now + 8_000,
      currentRoundNumber: 1,
      playlistStarted: true,
      round,
      currentResult: null,
    };
    const view = renderRoom();

    expect(document.querySelector('[data-reveal-stage="author"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Maya' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dot Catcher' })).not.toBeInTheDocument();

    mocks.game = {
      ...(mocks.game as typeof baseGame),
      round: { ...round, countdownStartedAt: now - 3_000 },
    };
    view.rerender(
      <MemoryRouter>
        <PromptArcadeRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(document.querySelector('[data-reveal-stage="game"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dot Catcher' })).toBeInTheDocument();
    expect(screen.getByText('Tap the blue dot five times.')).toBeInTheDocument();

    mocks.game = {
      ...(mocks.game as typeof baseGame),
      round: { ...round, countdownStartedAt: now - 6_000 },
    };
    view.rerender(
      <MemoryRouter>
        <PromptArcadeRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(document.querySelector('[data-reveal-stage="countdown"]')).toBeInTheDocument();
    expect(document.querySelector('[data-countdown-content]')).toHaveClass('flex');
    for (const section of document.querySelectorAll('[data-countdown-section]')) {
      expect(section).not.toHaveClass('absolute');
    }
    expect(document.querySelector('[data-countdown-section="timer"]')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText(/Starts in \d/)).toBeInTheDocument();
  });

  it('keeps standings lanes fixed during play, shows points gained, then applies the final order', () => {
    const now = Date.now();
    const round = {
      roundId: 'round-1',
      roundNumber: 1,
      status: 'playing',
      countdownStartedAt: now - 8_000,
      playStartsAt: now - 4_000,
      playEndsAt: now + 16_000,
      resultsStartedAt: null,
      entry: {
        entryId: 'entry-2',
        memberId: 'member-2',
        displayName: 'Maya',
        prompt: 'Catch the blue dot',
      },
      artifact: {
        artifactId: 'artifact-1',
        title: 'Dot Catcher',
        interpretation: 'Catch a moving target before time runs out.',
        instructions: 'Tap the blue dot five times.',
        durationMs: 20_000,
        scoringMode: 'speed',
        codeUrl: null,
      },
    };
    const waitingResults = baseGame.standings.map((standing) => ({
      memberId: standing.memberId,
      displayName: standing.displayName,
      status: 'waiting',
      quality: null,
      elapsedMs: null,
      score: 0,
      metricLabel: null,
      metricValue: null,
      isCurrentPlayer: standing.isCurrentPlayer,
      isActive: true,
    }));
    mocks.game = {
      ...baseGame,
      phase: 'playing',
      phaseStartedAt: now - 4_000,
      phaseEndsAt: now + 16_000,
      currentRoundNumber: 1,
      playlistStarted: true,
      round,
      currentResult: waitingResults[0],
      roundResults: waitingResults,
      standings: [
        { ...baseGame.standings[0], rank: 1, totalScore: 1_000 },
        { ...baseGame.standings[1], rank: 2, totalScore: 900 },
        { ...baseGame.standings[2], rank: 3, totalScore: 800 },
      ],
    };
    let view = renderRoom();
    const namesInOrder = () =>
      within(screen.getByRole('list', { name: 'Player standings' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent);

    expect(namesInOrder()).toEqual([
      expect.stringContaining('Igor'),
      expect.stringContaining('Maya'),
      expect.stringContaining('Theo'),
    ]);

    const mayaFinished = {
      ...waitingResults[1],
      status: 'finished',
      quality: 1,
      elapsedMs: 4_000,
      score: 500,
    };
    mocks.game = {
      ...(mocks.game as typeof baseGame),
      currentResult: waitingResults[0],
      roundResults: [waitingResults[0], mayaFinished, waitingResults[2]],
      standings: [
        { ...baseGame.standings[1], rank: 1, totalScore: 1_400, roundsFinished: 1 },
        { ...baseGame.standings[0], rank: 2, totalScore: 1_000 },
        { ...baseGame.standings[2], rank: 3, totalScore: 800 },
      ],
    };
    view.rerender(
      <MemoryRouter>
        <PromptArcadeRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(namesInOrder()).toEqual([
      expect.stringContaining('Igor'),
      expect.stringContaining('Maya'),
      expect.stringContaining('Theo'),
    ]);
    const mayaLiveRow = within(screen.getByRole('list', { name: 'Player standings' }))
      .getByText('Maya')
      .closest('li');
    expect(mayaLiveRow).toHaveAttribute('data-display-rank', '2');
    expect(mayaLiveRow).toHaveAttribute('data-authoritative-rank', '1');
    expect(mayaLiveRow).toHaveTextContent('+500 points gained this round');

    view.unmount();
    view = renderRoom();
    expect(namesInOrder()).toEqual([
      expect.stringContaining('Igor'),
      expect.stringContaining('Maya'),
      expect.stringContaining('Theo'),
    ]);

    mocks.game = {
      ...(mocks.game as typeof baseGame),
      phase: 'roundResults',
      phaseStartedAt: now,
      phaseEndsAt: now + 8_000,
      round: { ...round, status: 'results', resultsStartedAt: now },
    };
    view.rerender(
      <MemoryRouter>
        <PromptArcadeRoom guest={guest} session={session as never} />
      </MemoryRouter>
    );

    expect(namesInOrder()).toEqual([
      expect.stringContaining('Maya'),
      expect.stringContaining('Igor'),
      expect.stringContaining('Theo'),
    ]);
  });

  it('replaces the full round list with a top-three recap and one tough break', () => {
    const now = Date.now();
    const juneStanding = {
      rank: 3,
      memberId: 'member-4',
      displayName: 'June',
      totalScore: 1_050,
      roundsFinished: 1,
      isCurrentPlayer: false,
      isActive: true,
    };
    const standings = [
      { ...baseGame.standings[1], rank: 1, totalScore: 1_500, roundsFinished: 1 },
      { ...baseGame.standings[2], rank: 2, totalScore: 1_200, roundsFinished: 1 },
      juneStanding,
      { ...baseGame.standings[0], rank: 4, totalScore: 1_000, roundsFinished: 1 },
    ];
    const results = [
      { standing: standings[0], score: 600, elapsedMs: 3_000, status: 'finished' },
      { standing: standings[1], score: 400, elapsedMs: 5_000, status: 'finished' },
      { standing: standings[2], score: 350, elapsedMs: 6_000, status: 'finished' },
      { standing: standings[3], score: 0, elapsedMs: 20_000, status: 'timedOut' },
    ].map(({ standing, score, elapsedMs, status }) => ({
      memberId: standing.memberId,
      displayName: standing.displayName,
      status,
      quality: status === 'finished' ? 1 : null,
      elapsedMs,
      score,
      metricLabel: null,
      metricValue: null,
      isCurrentPlayer: standing.isCurrentPlayer,
      isActive: true,
    }));
    mocks.game = {
      ...baseGame,
      phase: 'roundResults',
      phaseStartedAt: now,
      phaseEndsAt: now + 8_000,
      currentRoundNumber: 1,
      playlistStarted: true,
      round: {
        roundId: 'round-1',
        roundNumber: 1,
        status: 'results',
        countdownStartedAt: now - 28_000,
        playStartsAt: now - 20_000,
        playEndsAt: now,
        resultsStartedAt: now,
        entry: {
          entryId: 'entry-2',
          memberId: 'member-2',
          displayName: 'Maya',
          prompt: 'Catch the blue dot',
        },
        artifact: {
          artifactId: 'artifact-1',
          title: 'Dot Catcher',
          interpretation: 'Catch a moving target before time runs out.',
          instructions: 'Tap the blue dot five times.',
          durationMs: 20_000,
          scoringMode: 'speed',
          codeUrl: null,
        },
      },
      currentResult: results[3],
      roundResults: results,
      standings,
    };

    renderRoom();

    const podium = screen.getByRole('list', { name: 'Top scorers this round' });
    expect(within(podium).getAllByRole('listitem')).toHaveLength(3);
    expect(within(podium).getByText('Maya')).toBeInTheDocument();
    expect(within(podium).getByText('Theo')).toBeInTheDocument();
    expect(within(podium).getByText('June')).toBeInTheDocument();
    expect(screen.getByText('Tough break')).toBeInTheDocument();
    expect(screen.getByText('Moved from position 1 to 4')).toBeInTheDocument();
  });

  it('gives every non-author player five seconds to submit a one-to-five star rating', async () => {
    const user = userEvent.setup();
    const now = Date.now();
    const results = baseGame.standings.map((standing, index) => ({
      memberId: standing.memberId,
      displayName: standing.displayName,
      status: 'finished',
      quality: 1,
      elapsedMs: 3_000 + index * 500,
      score: 700 - index * 100,
      metricLabel: null,
      metricValue: null,
      isCurrentPlayer: standing.isCurrentPlayer,
      isActive: true,
    }));
    mocks.game = {
      ...baseGame,
      phase: 'roundResults',
      phaseStartedAt: now,
      phaseEndsAt: now + 5_000,
      currentRoundNumber: 1,
      playlistStarted: true,
      round: {
        roundId: 'round-1',
        roundNumber: 1,
        status: 'results',
        countdownStartedAt: now - 28_000,
        playStartsAt: now - 20_000,
        playEndsAt: now,
        resultsStartedAt: now,
        entry: {
          entryId: 'entry-2',
          memberId: 'member-2',
          displayName: 'Maya',
          prompt: 'Catch the blue dot',
        },
        artifact: {
          artifactId: 'artifact-1',
          title: 'Dot Catcher',
          interpretation: 'Catch a moving target before time runs out.',
          instructions: 'Tap the blue dot five times.',
          durationMs: 20_000,
          scoringMode: 'speed',
          codeUrl: null,
        },
      },
      currentResult: results[0],
      roundResults: results,
      currentGameRating: {
        rating: null,
        canRate: true,
        ratingCount: 1,
        eligibleRaterCount: 2,
      },
    };

    renderRoom();

    expect(screen.getByRole('heading', { name: 'How was Dot Catcher?' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Rating time remaining' })).toHaveAttribute('aria-valuemax', '5000');
    await user.click(screen.getByRole('radio', { name: '5 out of 5 stars' }));
    expect(mocks.mutation).toHaveBeenCalledWith({
      roomId: 'room-1',
      sessionToken: guest.sessionToken,
      roundId: 'round-1',
      rating: 5,
    });
    expect(screen.getByText('5 out of 5 selected. You can change it while the booth is open.')).toBeInTheDocument();
  });

  it('starts automatically when everyone is ready and hides the manual control', () => {
    mocks.game = {
      ...baseGame,
      summary: { ...baseGame.summary, writing: 0, generating: 0, ready: 3 },
      entries: baseGame.entries.map((entry, index) => ({
        ...entry,
        prompt: entry.prompt ?? `Game ${index + 1}`,
        status: 'ready',
        artifactTitle: entry.artifactTitle ?? `Ready game ${index + 1}`,
      })),
    };
    renderRoom();

    expect(screen.getByRole('status')).toHaveTextContent('Everyone is ready. Starting automatically…');
    expect(screen.queryByRole('button', { name: /Start early/ })).not.toBeInTheDocument();
  });

  it('does not show non-owners a start-playing control while the factory is working', () => {
    mocks.game = { ...baseGame, isOwner: false };
    renderRoom();

    expect(screen.queryByRole('button', { name: /Start early/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('The playlist starts automatically when every player-made game is ready.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Start playing while the factory keeps working.')).not.toBeInTheDocument();
  });

  it('uses the shared player sidebar in the pregame lobby', () => {
    mocks.game = {
      ...baseGame,
      gameNumber: 0,
      phase: 'lobby',
      participantCount: 0,
      requiredReadyCount: 0,
      canStartPlaylist: false,
      entries: [],
    };
    renderRoom();

    expect(screen.getByRole('button', { name: 'Start game' })).toBeInTheDocument();
    const players = screen.getByRole('complementary', { name: 'Players in the room' });
    expect(players).toHaveClass('max-h-[clamp(640px,calc(100dvh-112px),768px)]');
    expect(players).toHaveTextContent('Igor (you)');
    expect(players).toHaveTextContent('Room owner');
    expect(screen.getByRole('button', { name: 'Invite more players' })).toBeInTheDocument();
    expect(screen.queryByText(/configure/i)).not.toBeInTheDocument();
  });

  it('restores an editable prompt when generation needs revision', () => {
    mocks.game = {
      ...baseGame,
      summary: { ...baseGame.summary, writing: 0, needsRevision: 1 },
      entries: [
        {
          ...baseGame.entries[0],
          prompt: 'make something fun',
          status: 'needsRevision',
          errorMessage: 'Add a clear action and win condition.',
        },
        ...baseGame.entries.slice(1),
      ],
    };
    renderRoom();
    expect(screen.getByRole('heading', { name: 'Give the builder a clearer idea.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Mini-game prompt')).toHaveValue('make something fun');
    expect(screen.getByRole('button', { name: 'Rebuild my game' })).toBeInTheDocument();
    expect(screen.getByText('Add a clear action and win condition.')).toBeInTheDocument();
  });

  it('lets the owner confirm finishing after every playable game is done and only unfinished prompts remain', async () => {
    const user = userEvent.setup();
    mocks.game = {
      ...baseGame,
      phase: 'generating',
      playlistStarted: true,
      canStartPlaylist: false,
      summary: {
        ...baseGame.summary,
        writing: 1,
        queued: 0,
        generating: 0,
        validating: 0,
        repairing: 0,
        ready: 0,
        needsRevision: 1,
        played: 1,
      },
      round: null,
    };
    renderRoom();

    expect(screen.getByRole('heading', { name: 'All playable games are done.' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Finish without unfinished prompts' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'The remaining unfinished prompts will be marked withdrawn so the room can continue to final scores.'
    );
    await user.click(screen.getByRole('button', { name: 'Withdraw and finish' }));
    expect(mocks.mutation).toHaveBeenCalledWith({ roomId: 'room-1', sessionToken: guest.sessionToken });
  });

  it.each([
    ['generation is still live', { generating: 1, ready: 0 }],
    ['a ready game remains', { generating: 0, ready: 1 }],
  ])('does not offer to finish while %s', (_label, activeSummary) => {
    mocks.game = {
      ...baseGame,
      phase: 'generating',
      playlistStarted: true,
      canStartPlaylist: false,
      summary: {
        ...baseGame.summary,
        writing: 1,
        queued: 0,
        validating: 0,
        repairing: 0,
        needsRevision: 1,
        played: 0,
        ...activeSummary,
      },
      round: null,
    };
    renderRoom();
    expect(screen.queryByRole('button', { name: 'Finish without unfinished prompts' })).not.toBeInTheDocument();
  });

  it('reveals the top-rated games before fading into the final player scores', () => {
    vi.useFakeTimers();
    mocks.game = {
      ...baseGame,
      phase: 'complete',
      playlistStarted: true,
      summary: { ...baseGame.summary, writing: 0, generating: 0, ready: 0, played: 3 },
      standings: [
        { ...baseGame.standings[1], rank: 1, totalScore: 2_400, creatorBonus: 500 },
        { ...baseGame.standings[0], rank: 2, totalScore: 1_900 },
        { ...baseGame.standings[2], rank: 3, totalScore: 1_250 },
      ],
      gameRankings: [
        {
          rank: 1,
          entryId: 'entry-2',
          memberId: 'member-2',
          displayName: 'Maya',
          title: 'Dot Catcher',
          interpretation: 'Catch a moving target before time runs out.',
          averageRating: 4.8,
          ratingCount: 2,
          isWinner: true,
          creatorBonus: 500,
          isCurrentPlayer: false,
        },
        {
          rank: 2,
          entryId: 'entry-3',
          memberId: 'member-3',
          displayName: 'Theo',
          title: 'Asteroid Pocket',
          interpretation: 'Thread a ship through a tiny asteroid field.',
          averageRating: 4.4,
          ratingCount: 2,
          isWinner: false,
          creatorBonus: 0,
          isCurrentPlayer: false,
        },
        {
          rank: 3,
          entryId: 'entry-1',
          memberId: 'member-1',
          displayName: 'Igor',
          title: 'Circle Lab',
          interpretation: 'Draw the cleanest circle you can.',
          averageRating: 4.1,
          ratingCount: 2,
          isWinner: false,
          creatorBonus: 0,
          isCurrentPlayer: true,
        },
      ],
    };

    renderRoom();

    expect(screen.getByRole('heading', { name: 'The arcade has spoken.' })).toBeInTheDocument();
    expect(screen.getByText('Third place · Circle Lab by Igor')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Maya wins the arcade.' })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3_000));
    expect(screen.getByText('Top-rated game · Dot Catcher by Maya')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3_500));
    act(() => vi.advanceTimersByTime(280));
    expect(screen.getByRole('heading', { name: 'Maya wins the arcade.' })).toBeInTheDocument();
    const standings = screen.getByRole('complementary', { name: 'Prompt Arcade standings' });
    expect(standings).toHaveTextContent('Maya');
    expect(standings).toHaveTextContent('2,400');
    expect(standings).toHaveTextContent('Top-rated creator · +500 bonus');
    expect(standings).toHaveClass('h-[calc(100dvh-104px)]', 'max-[860px]:h-auto');
  });
});
