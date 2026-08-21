import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { internalMutation, type MutationCtx, type QueryCtx, query } from './_generated/server';
import { fail } from './domain';
import {
  GAME_DEFINITIONS,
  type GameType,
  gameSourceValidator,
  gameTypeValidator,
  type StaticGameDefinition,
} from './gameRegistry';

export {
  GAME_DEFINITIONS,
  GAME_TYPES,
  type GameSource,
  type GameType,
  gameSourceValidator,
  gameTypeValidator,
  type StaticGameDefinition,
} from './gameRegistry';

const MAX_GAME_DEFINITIONS = 100;

const publicGameDefinitionValidator = v.object({
  gameType: gameTypeValidator,
  name: v.string(),
  description: v.string(),
  author: v.object({
    name: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  source: gameSourceValidator,
});

type DatabaseReaderContext = Pick<QueryCtx, 'db'>;

function findStaticDefinition(gameType: GameType): StaticGameDefinition | null {
  return GAME_DEFINITIONS.find((definition) => definition.gameType === gameType) ?? null;
}

function toPublicDefinition(definition: StaticGameDefinition | Doc<'gameDefinitions'>) {
  return {
    gameType: definition.gameType,
    name: definition.name,
    description: definition.description,
    author: {
      name: definition.authorName,
      url: definition.authorUrl ?? null,
    },
    source: definition.source,
  };
}

type StoredCatalogState = {
  isInitialized: boolean;
  enabledDefinitions: Doc<'gameDefinitions'>[];
};

export function resolveCatalogEntries<TStored, TFallback>(
  enabledStoredEntries: readonly TStored[],
  isCatalogInitialized: boolean,
  fallbackEntries: readonly TFallback[]
): readonly (TStored | TFallback)[] {
  return isCatalogInitialized ? enabledStoredEntries : fallbackEntries;
}

async function catalogHasRows(ctx: DatabaseReaderContext): Promise<boolean> {
  return (await ctx.db.query('gameDefinitions').withIndex('by_gameType').first()) !== null;
}

async function readStoredCatalog(ctx: DatabaseReaderContext): Promise<StoredCatalogState> {
  const enabledDefinitions = await ctx.db
    .query('gameDefinitions')
    .withIndex('by_isEnabled_and_sortOrder', (index) => index.eq('isEnabled', true))
    .take(MAX_GAME_DEFINITIONS + 1);
  if (enabledDefinitions.length > MAX_GAME_DEFINITIONS) {
    throw new Error(`The game catalog exceeds its supported limit of ${MAX_GAME_DEFINITIONS} enabled games.`);
  }
  return {
    isInitialized: enabledDefinitions.length > 0 || (await catalogHasRows(ctx)),
    enabledDefinitions,
  };
}

/** Returns the enabled runtime catalog used by the game picker. */
export const listAvailable = query({
  args: {},
  returns: v.array(publicGameDefinitionValidator),
  handler: async (ctx) => {
    const storedCatalog = await readStoredCatalog(ctx);
    const fallbackDefinitions = GAME_DEFINITIONS.filter((definition) => definition.isEnabled)
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder);
    return resolveCatalogEntries(
      storedCatalog.enabledDefinitions,
      storedCatalog.isInitialized,
      fallbackDefinitions
    ).map(toPublicDefinition);
  },
});

/**
 * Enforces the database availability switch at room creation and game changes.
 * An entirely uninitialized catalog temporarily falls back to source-controlled
 * manifests so deploying the schema before sync does not break rooms. Once any
 * catalog row exists, the database is authoritative, including disabled or
 * missing definitions.
 */
export async function requireAvailableGame(ctx: DatabaseReaderContext, gameType: GameType): Promise<void> {
  const storedDefinition = await ctx.db
    .query('gameDefinitions')
    .withIndex('by_gameType', (index) => index.eq('gameType', gameType))
    .unique();
  if (storedDefinition !== null) {
    if (!storedDefinition.isEnabled) {
      fail('GAME_NOT_AVAILABLE', 'That game is not currently available.');
    }
    return;
  }

  if ((await catalogHasRows(ctx)) || findStaticDefinition(gameType)?.isEnabled !== true) {
    fail('GAME_NOT_AVAILABLE', 'That game is not currently available.');
  }
}

/** Returns enabled game types for shared voting infrastructure. */
export async function listAvailableGameTypes(ctx: DatabaseReaderContext): Promise<GameType[]> {
  const storedCatalog = await readStoredCatalog(ctx);
  const fallbackDefinitions = GAME_DEFINITIONS.filter((definition) => definition.isEnabled)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder);
  return resolveCatalogEntries(storedCatalog.enabledDefinitions, storedCatalog.isInitialized, fallbackDefinitions).map(
    (definition) => definition.gameType
  );
}

async function syncStaticDefinitions(ctx: MutationCtx) {
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const now = Date.now();

  for (const definition of GAME_DEFINITIONS) {
    const existing = await ctx.db
      .query('gameDefinitions')
      .withIndex('by_gameType', (index) => index.eq('gameType', definition.gameType))
      .unique();
    const fields = {
      gameType: definition.gameType,
      name: definition.name,
      description: definition.description,
      authorName: definition.authorName,
      ...(definition.authorUrl === null ? {} : { authorUrl: definition.authorUrl }),
      source: definition.source,
      isEnabled: definition.isEnabled,
      sortOrder: definition.sortOrder,
    };
    if (existing === null) {
      await ctx.db.insert('gameDefinitions', {
        ...fields,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
      continue;
    }

    const isCurrent =
      existing.name === definition.name &&
      existing.description === definition.description &&
      existing.authorName === definition.authorName &&
      (existing.authorUrl ?? null) === definition.authorUrl &&
      existing.source === definition.source &&
      existing.isEnabled === definition.isEnabled &&
      existing.sortOrder === definition.sortOrder;
    if (isCurrent) {
      unchanged += 1;
      continue;
    }
    await ctx.db.patch('gameDefinitions', existing._id, {
      ...fields,
      authorUrl: definition.authorUrl === null ? undefined : definition.authorUrl,
      updatedAt: now,
    });
    updated += 1;
  }

  return { inserted, updated, unchanged };
}

/** Run after deploy with `npx convex run games:syncCatalog`. Safe to repeat. */
export const syncCatalog = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number(), updated: v.number(), unchanged: v.number() }),
  handler: async (ctx) => await syncStaticDefinitions(ctx),
});
