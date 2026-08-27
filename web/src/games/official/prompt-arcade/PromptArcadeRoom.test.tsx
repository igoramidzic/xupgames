import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  standings: [
    {
      rank: 1,
      memberId: 'member-1',
      displayName: 'Igor',
      totalScore: 0,
      roundsFinished: 0,
      isCurrentPlayer: true,
      isActive: true,
    },
    {
      rank: 2,
      memberId: 'member-2',
      displayName: 'Maya',
      totalScore: 0,
      roundsFinished: 0,
      isCurrentPlayer: false,
      isActive: true,
    },
    {
      rank: 3,
      memberId: 'member-3',
      displayName: 'Theo',
      totalScore: 0,
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

  it('shows honest player stages and sends every player prompt, including emoji', async () => {
    const user = userEvent.setup();
    renderRoom();

    expect(screen.getByRole('heading', { name: 'What should everyone play?' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Prompt Arcade players' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '1 of 3 player-made games are ready' })).toBeInTheDocument();
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

  it('keeps the final standings visible beside the post-game board', () => {
    mocks.game = {
      ...baseGame,
      phase: 'complete',
      playlistStarted: true,
      summary: { ...baseGame.summary, writing: 0, generating: 0, ready: 0, played: 3 },
      standings: [
        { ...baseGame.standings[1], rank: 1, totalScore: 2_400 },
        { ...baseGame.standings[0], rank: 2, totalScore: 1_900 },
        { ...baseGame.standings[2], rank: 3, totalScore: 1_250 },
      ],
    };

    renderRoom();

    expect(screen.getByRole('heading', { name: 'Maya wins the arcade.' })).toBeInTheDocument();
    const standings = screen.getByRole('complementary', { name: 'Prompt Arcade standings' });
    expect(standings).toHaveTextContent('Maya');
    expect(standings).toHaveTextContent('2,400');
    expect(standings).toHaveClass('h-[calc(100dvh-104px)]', 'max-[860px]:h-auto');
  });
});
