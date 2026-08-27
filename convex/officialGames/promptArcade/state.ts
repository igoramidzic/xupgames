import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { requireRoomMember } from '../../roomAccess';
import { PROMPT_ARCADE_MAX_PLAYERS } from './engine';

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

export function promptArcadeFail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

export async function findPromptArcadeState(ctx: DatabaseReaderContext, roomId: Id<'rooms'>) {
  return await ctx.db
    .query('promptArcadeGameStates')
    .withIndex('by_roomId', (index) => index.eq('roomId', roomId))
    .unique();
}

export async function requirePromptArcadeMember(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  sessionToken: string,
  requireActive: boolean
) {
  return await requireRoomMember(ctx, roomId, sessionToken, {
    gameType: 'promptArcade',
    requireActive,
    allowPlaytestBots: false,
  });
}

export async function listPromptArcadeEntries(ctx: DatabaseReaderContext, roomId: Id<'rooms'>, gameNumber: number) {
  const entries = await ctx.db
    .query('promptArcadeEntries')
    .withIndex('by_roomId_and_gameNumber', (index) => index.eq('roomId', roomId).eq('gameNumber', gameNumber))
    .take(PROMPT_ARCADE_MAX_PLAYERS + 1);
  if (entries.length > PROMPT_ARCADE_MAX_PLAYERS) {
    throw new Error('Prompt Arcade participant capacity invariant violated.');
  }
  return entries.sort((first, second) => first.order - second.order);
}

export async function findPromptArcadeEntry(
  ctx: DatabaseReaderContext,
  roomId: Id<'rooms'>,
  gameNumber: number,
  memberId: Id<'roomMembers'>
) {
  return await ctx.db
    .query('promptArcadeEntries')
    .withIndex('by_roomId_and_gameNumber_and_memberId', (index) =>
      index.eq('roomId', roomId).eq('gameNumber', gameNumber).eq('memberId', memberId)
    )
    .unique();
}

export async function withdrawInactiveUnusablePromptEntries(
  ctx: MutationCtx,
  entries: Doc<'promptArcadeEntries'>[],
  now: number
): Promise<Doc<'promptArcadeEntries'>[]> {
  const normalized: Doc<'promptArcadeEntries'>[] = [];
  for (const entry of entries) {
    if (entry.status !== 'writing' && entry.status !== 'needsRevision') {
      normalized.push(entry);
      continue;
    }
    const member = await ctx.db.get('roomMembers', entry.memberId);
    if (member?.isActive !== false) {
      normalized.push(entry);
      continue;
    }
    await ctx.db.patch('promptArcadeEntries', entry._id, { status: 'withdrawn', statusUpdatedAt: now });
    normalized.push({ ...entry, status: 'withdrawn', statusUpdatedAt: now });
  }
  return normalized;
}
