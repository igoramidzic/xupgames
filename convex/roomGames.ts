import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { type MutationCtx, mutation, type QueryCtx, query } from './_generated/server';
import { fail, MAX_PLAYERS, validateSessionToken } from './domain';
import { gameStateIsComplete, prepareGameState } from './gameRouter';
import { type GameType, gameTypeValidator, listAvailableGameTypes, requireAvailableGame } from './games';
import { resolveVotingRound } from './nextGameVoting';
import { listActiveHumanRoomMembers } from './roomMembers';

const pollStatusValidator = v.union(
  v.literal('round1'),
  v.literal('round2'),
  v.literal('awaitingOwner'),
  v.literal('closed')
);

const pollViewValidator = v.union(
  v.null(),
  v.object({
    pollId: v.id('nextGamePolls'),
    roomGameId: v.id('roomGames'),
    status: pollStatusValidator,
    roundId: v.id('nextGamePollRounds'),
    roundNumber: v.number(),
    roundStatus: v.union(v.literal('open'), v.literal('closed')),
    options: v.array(gameTypeValidator),
    eligibleVoterCount: v.number(),
    votesCast: v.number(),
    isEligible: v.boolean(),
    selectedGameType: v.union(gameTypeValidator, v.null()),
    tallies: v.union(
      v.null(),
      v.array(
        v.object({
          gameType: gameTypeValidator,
          votes: v.number(),
          percentage: v.number(),
        })
      )
    ),
    recommendedGameType: v.union(gameTypeValidator, v.null()),
    chosenGameType: v.union(gameTypeValidator, v.null()),
  })
);

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

async function findGuestByToken(ctx: DatabaseReaderContext, sessionToken: string) {
  return await ctx.db
    .query('guestSessions')
    .withIndex('by_sessionToken', (index) => index.eq('sessionToken', sessionToken))
    .unique();
}

async function findMembership(ctx: DatabaseReaderContext, roomId: Id<'rooms'>, guestId: Id<'guestSessions'>) {
  return await ctx.db
    .query('roomMembers')
    .withIndex('by_roomId_and_guestId', (index) => index.eq('roomId', roomId).eq('guestId', guestId))
    .unique();
}

async function requireRoomPlayer(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  rawSessionToken: string,
  requireOwner: boolean
): Promise<{ room: Doc<'rooms'>; membership: Doc<'roomMembers'> }> {
  const sessionToken = validateSessionToken(rawSessionToken);
  const room = await ctx.db.get('rooms', roomId);
  if (room === null) {
    fail('ROOM_NOT_FOUND', 'Room not found.');
  }
  const guest = await findGuestByToken(ctx, sessionToken);
  if (guest === null) {
    fail('NOT_A_MEMBER', 'You are not a member of this room.');
  }
  const membership = await findMembership(ctx, room._id, guest._id);
  if (membership === null) {
    fail('NOT_A_MEMBER', 'You are not a member of this room.');
  }
  if (!membership.isActive) {
    fail('MEMBER_INACTIVE', 'Rejoin the room before voting.');
  }
  if (membership.memberKind === 'playtestBot') {
    fail('NEXT_GAME_NOT_ELIGIBLE', 'Playtest bots cannot vote for the next game.');
  }
  if (requireOwner && room.ownerGuestId !== guest._id) {
    fail('NOT_ROOM_OWNER', 'Only the room owner can manage next-game voting.');
  }
  return { room, membership };
}

async function getCurrentRoomGame(ctx: DatabaseReaderContext, room: Doc<'rooms'>): Promise<Doc<'roomGames'> | null> {
  if (room.currentGameId === undefined) {
    return null;
  }
  const roomGame = await ctx.db.get('roomGames', room.currentGameId);
  if (roomGame === null || roomGame.roomId !== room._id) {
    throw new Error('The room current-game pointer is invalid.');
  }
  return roomGame;
}

async function createPollForRoomGame(
  ctx: MutationCtx,
  roomGame: Doc<'roomGames'>,
  now: number
): Promise<Id<'nextGamePolls'>> {
  const existing = await ctx.db
    .query('nextGamePolls')
    .withIndex('by_roomGameId', (index) => index.eq('roomGameId', roomGame._id))
    .unique();
  if (existing !== null) {
    return existing._id;
  }

  const eligibleMembers = await listActiveHumanRoomMembers(ctx, roomGame.roomId);
  const availableGameTypes = await listAvailableGameTypes(ctx);
  if (availableGameTypes.length < 2) {
    fail('NEXT_GAME_NOT_AVAILABLE', 'At least two games must be enabled before starting a next-game vote.');
  }
  const pollId = await ctx.db.insert('nextGamePolls', {
    roomId: roomGame.roomId,
    roomGameId: roomGame._id,
    status: 'round1',
    currentRoundId: null,
    recommendedGameType: null,
    chosenGameType: null,
    createdAt: now,
    resolvedAt: null,
    closedAt: null,
  });
  const roundId = await ctx.db.insert('nextGamePollRounds', {
    pollId,
    roundNumber: 1,
    status: 'open',
    options: availableGameTypes,
    eligibleMemberIds: eligibleMembers.map((member) => member._id),
    openedAt: now,
    closedAt: null,
  });
  await ctx.db.patch('nextGamePolls', pollId, { currentRoundId: roundId });
  return pollId;
}

export async function createInitialRoomGame(
  ctx: MutationCtx,
  roomId: Id<'rooms'>,
  gameType: GameType,
  now: number
): Promise<Doc<'roomGames'>> {
  const status = 'lobby';
  const roomGameId = await ctx.db.insert('roomGames', {
    roomId,
    gameType,
    sequence: 1,
    status,
    createdAt: now,
    startedAt: null,
    completedAt: null,
  });
  const roomGame = await ctx.db.get('roomGames', roomGameId);
  if (roomGame === null) {
    throw new Error('The initial room game could not be loaded.');
  }
  return roomGame;
}

async function ensureCurrentRoomGame(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  status: 'lobby' | 'active' | 'complete',
  now: number
): Promise<Doc<'roomGames'>> {
  const existing = await getCurrentRoomGame(ctx, room);
  if (existing !== null) {
    return existing;
  }
  const roomGameId = await ctx.db.insert('roomGames', {
    roomId: room._id,
    gameType: room.gameType,
    sequence: 1,
    status,
    createdAt: room.createdAt,
    startedAt: status === 'lobby' ? null : room.createdAt,
    completedAt: status === 'complete' ? now : null,
  });
  await ctx.db.patch('rooms', room._id, { currentGameId: roomGameId });
  const roomGame = await ctx.db.get('roomGames', roomGameId);
  if (roomGame === null) {
    throw new Error('The current room game could not be loaded.');
  }
  return roomGame;
}

export async function activateCurrentRoomGame(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  expectedGameType: GameType,
  now: number
): Promise<void> {
  if (room.gameType !== expectedGameType) {
    fail('WRONG_GAME_TYPE', 'This room is running a different game.');
  }
  const roomGame = await ensureCurrentRoomGame(ctx, room, 'active', now);
  if (roomGame.gameType !== expectedGameType) {
    fail('STALE_ROOM_GAME', 'The room changed games before this action completed.');
  }
  if (roomGame.status === 'complete') {
    fail('STALE_ROOM_GAME', 'Choose the next room game before starting another round.');
  }
  if (roomGame.status !== 'active') {
    await ctx.db.patch('roomGames', roomGame._id, {
      status: 'active',
      startedAt: roomGame.startedAt ?? now,
      completedAt: null,
    });
  }
}

export async function completeCurrentRoomGame(
  ctx: MutationCtx,
  room: Doc<'rooms'>,
  expectedGameType: GameType,
  now: number
): Promise<void> {
  if (room.gameType !== expectedGameType) {
    return;
  }
  const roomGame = await ensureCurrentRoomGame(ctx, room, 'complete', now);
  if (roomGame.gameType !== expectedGameType) {
    return;
  }
  if (roomGame.status !== 'complete') {
    await ctx.db.patch('roomGames', roomGame._id, {
      status: 'complete',
      completedAt: now,
    });
  }
  await createPollForRoomGame(ctx, { ...roomGame, status: 'complete', completedAt: now }, now);
}

export const openNextGameVoting = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room } = await requireRoomPlayer(ctx, args.roomId, args.sessionToken, false);
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'This room is closed.');
    }
    const roomGame = await getCurrentRoomGame(ctx, room);
    if (roomGame?.status !== 'complete' && !(await gameStateIsComplete(ctx, room))) {
      fail('ROOM_GAME_NOT_COMPLETE', 'Finish the current game before opening the vote.');
    }
    await completeCurrentRoomGame(ctx, room, room.gameType, Date.now());
    return null;
  },
});

export const getNextGamePoll = query({
  args: { roomId: v.id('rooms'), sessionToken: v.string() },
  returns: pollViewValidator,
  handler: async (ctx, args) => {
    const { room, membership } = await requireRoomPlayer(ctx, args.roomId, args.sessionToken, false);
    const roomGame = await getCurrentRoomGame(ctx, room);
    if (roomGame === null || roomGame.status !== 'complete') {
      return null;
    }
    const poll = await ctx.db
      .query('nextGamePolls')
      .withIndex('by_roomGameId', (index) => index.eq('roomGameId', roomGame._id))
      .unique();
    if (poll === null || poll.currentRoundId === null) {
      return null;
    }
    const round = await ctx.db.get('nextGamePollRounds', poll.currentRoundId);
    if (round === null || round.pollId !== poll._id) {
      throw new Error('The next-game poll round is missing.');
    }
    const votes = await ctx.db
      .query('nextGameVotes')
      .withIndex('by_pollRoundId', (index) => index.eq('pollRoundId', round._id))
      .take(MAX_PLAYERS + 1);
    if (votes.length > MAX_PLAYERS) {
      throw new Error('Next-game vote capacity invariant violated.');
    }
    const selectedVote = votes.find((vote) => vote.memberId === membership._id) ?? null;
    const talliesVisible = round.status === 'closed' || selectedVote !== null;
    const voteCounts = new Map<GameType, number>();
    for (const vote of votes) {
      voteCounts.set(vote.gameType, (voteCounts.get(vote.gameType) ?? 0) + 1);
    }
    return {
      pollId: poll._id,
      roomGameId: roomGame._id,
      status: poll.status,
      roundId: round._id,
      roundNumber: round.roundNumber,
      roundStatus: round.status,
      options: round.options,
      eligibleVoterCount: round.eligibleMemberIds.length,
      votesCast: votes.length,
      isEligible: round.eligibleMemberIds.length === 0 || round.eligibleMemberIds.includes(membership._id),
      selectedGameType: selectedVote?.gameType ?? null,
      tallies: talliesVisible
        ? round.options.map((gameType) => ({
            gameType,
            votes: voteCounts.get(gameType) ?? 0,
            percentage: votes.length === 0 ? 0 : Math.round(((voteCounts.get(gameType) ?? 0) / votes.length) * 100),
          }))
        : null,
      recommendedGameType: poll.recommendedGameType,
      chosenGameType: poll.chosenGameType,
    };
  },
});

export const castNextGameVote = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), gameType: gameTypeValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { room, membership } = await requireRoomPlayer(ctx, args.roomId, args.sessionToken, false);
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'This room is closed.');
    }
    const roomGame = await getCurrentRoomGame(ctx, room);
    if (roomGame === null || roomGame.status !== 'complete') {
      fail('ROOM_GAME_NOT_COMPLETE', 'Finish the current game before voting for the next one.');
    }
    const poll = await ctx.db
      .query('nextGamePolls')
      .withIndex('by_roomGameId', (index) => index.eq('roomGameId', roomGame._id))
      .unique();
    if (poll === null || poll.currentRoundId === null) {
      fail('NEXT_GAME_POLL_NOT_FOUND', 'The next-game vote is not available yet.');
    }
    const round = await ctx.db.get('nextGamePollRounds', poll.currentRoundId);
    if (round === null || round.status !== 'open') {
      fail('NEXT_GAME_VOTING_CLOSED', 'Voting for this round has closed.');
    }
    if (!round.options.includes(args.gameType)) {
      fail('NEXT_GAME_INVALID_OPTION', 'That game is not an option in this round.');
    }
    if (!round.eligibleMemberIds.includes(membership._id)) {
      if (round.eligibleMemberIds.length !== 0) {
        fail('NEXT_GAME_NOT_ELIGIBLE', 'You joined after this voting round began.');
      }
      const activeMembers = await listActiveHumanRoomMembers(ctx, room._id);
      const eligibleMemberIds = activeMembers.map((member) => member._id);
      if (!eligibleMemberIds.includes(membership._id)) {
        fail('NEXT_GAME_NOT_ELIGIBLE', 'You are not eligible for this voting round.');
      }
      await ctx.db.patch('nextGamePollRounds', round._id, { eligibleMemberIds });
    }
    const existingVote = await ctx.db
      .query('nextGameVotes')
      .withIndex('by_pollRoundId_and_memberId', (index) =>
        index.eq('pollRoundId', round._id).eq('memberId', membership._id)
      )
      .unique();
    const now = Date.now();
    if (existingVote === null) {
      await ctx.db.insert('nextGameVotes', {
        pollRoundId: round._id,
        memberId: membership._id,
        gameType: args.gameType,
        createdAt: now,
        updatedAt: now,
      });
    } else if (existingVote.gameType !== args.gameType) {
      await ctx.db.patch('nextGameVotes', existingVote._id, { gameType: args.gameType, updatedAt: now });
    }
    return null;
  },
});

export const closeNextGameVotingRound = mutation({
  args: { roomId: v.id('rooms'), sessionToken: v.string(), roundId: v.id('nextGamePollRounds') },
  returns: v.object({ status: pollStatusValidator, roundNumber: v.number() }),
  handler: async (ctx, args) => {
    const { room } = await requireRoomPlayer(ctx, args.roomId, args.sessionToken, true);
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'This room is closed.');
    }
    const roomGame = await getCurrentRoomGame(ctx, room);
    if (roomGame === null || roomGame.status !== 'complete') {
      fail('ROOM_GAME_NOT_COMPLETE', 'Finish the current game before closing the vote.');
    }
    const poll = await ctx.db
      .query('nextGamePolls')
      .withIndex('by_roomGameId', (index) => index.eq('roomGameId', roomGame._id))
      .unique();
    if (poll === null || poll.currentRoundId !== args.roundId) {
      fail('NEXT_GAME_POLL_NOT_FOUND', 'This voting round is no longer current.');
    }
    const round = await ctx.db.get('nextGamePollRounds', args.roundId);
    if (round === null || round.status !== 'open') {
      fail('NEXT_GAME_VOTING_CLOSED', 'Voting for this round has already closed.');
    }
    const votes = await ctx.db
      .query('nextGameVotes')
      .withIndex('by_pollRoundId', (index) => index.eq('pollRoundId', round._id))
      .take(MAX_PLAYERS + 1);
    if (votes.length === 0) {
      fail('NEXT_GAME_NO_VOTES', 'At least one player must vote before closing the round.');
    }
    if (votes.length > MAX_PLAYERS) {
      throw new Error('Next-game vote capacity invariant violated.');
    }
    const resolution = resolveVotingRound(
      round.options,
      votes.map((vote) => vote.gameType),
      round.roundNumber
    );
    const now = Date.now();
    await ctx.db.patch('nextGamePollRounds', round._id, { status: 'closed', closedAt: now });

    if (resolution.kind === 'runoff') {
      const eligibleMembers = await listActiveHumanRoomMembers(ctx, room._id);
      const secondRoundId = await ctx.db.insert('nextGamePollRounds', {
        pollId: poll._id,
        roundNumber: 2,
        status: 'open',
        options: resolution.finalists,
        eligibleMemberIds: eligibleMembers.map((member) => member._id),
        openedAt: now,
        closedAt: null,
      });
      await ctx.db.patch('nextGamePolls', poll._id, {
        status: 'round2',
        currentRoundId: secondRoundId,
      });
      return { status: 'round2' as const, roundNumber: 2 };
    }

    await ctx.db.patch('nextGamePolls', poll._id, {
      status: 'awaitingOwner',
      recommendedGameType: resolution.recommendation,
      resolvedAt: now,
    });
    return { status: 'awaitingOwner' as const, roundNumber: round.roundNumber };
  },
});

export const chooseNextGame = mutation({
  args: {
    roomId: v.id('rooms'),
    sessionToken: v.string(),
    expectedRoomGameId: v.id('roomGames'),
    gameType: gameTypeValidator,
  },
  returns: v.object({ roomGameId: v.id('roomGames'), gameType: gameTypeValidator }),
  handler: async (ctx, args) => {
    const { room } = await requireRoomPlayer(ctx, args.roomId, args.sessionToken, true);
    if (room.status === 'closed') {
      fail('ROOM_CLOSED', 'This room is closed.');
    }
    const currentRoomGame = await getCurrentRoomGame(ctx, room);
    if (currentRoomGame === null || currentRoomGame._id !== args.expectedRoomGameId) {
      fail('STALE_ROOM_GAME', 'The room already moved to another game.');
    }
    if (currentRoomGame.status !== 'complete') {
      fail('ROOM_GAME_NOT_COMPLETE', 'Finish the current game before choosing another.');
    }
    const poll = await ctx.db
      .query('nextGamePolls')
      .withIndex('by_roomGameId', (index) => index.eq('roomGameId', currentRoomGame._id))
      .unique();
    if (poll === null || poll.status !== 'awaitingOwner') {
      fail('NEXT_GAME_VOTING_CLOSED', 'Finish next-game voting before choosing.');
    }
    const activePlaytest = await ctx.db
      .query('playtestRuns')
      .withIndex('by_roomId_and_isActive', (index) => index.eq('roomId', room._id).eq('isActive', true))
      .unique();
    if (activePlaytest !== null) {
      fail('PLAYTEST_ALREADY_RUNNING', 'Stop the current playtest before changing games.');
    }
    await requireAvailableGame(ctx, args.gameType);

    const now = Date.now();
    const status = 'lobby';
    const roomGameId = await ctx.db.insert('roomGames', {
      roomId: room._id,
      gameType: args.gameType,
      sequence: currentRoomGame.sequence + 1,
      status,
      createdAt: now,
      startedAt: null,
      completedAt: null,
    });
    await prepareGameState(ctx, room, args.gameType);
    await ctx.db.patch('rooms', room._id, {
      gameType: args.gameType,
      currentGameId: roomGameId,
    });
    await ctx.db.patch('nextGamePolls', poll._id, {
      status: 'closed',
      chosenGameType: args.gameType,
      closedAt: now,
    });
    return { roomGameId, gameType: args.gameType };
  },
});
