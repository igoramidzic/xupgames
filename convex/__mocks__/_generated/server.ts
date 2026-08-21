// Stub for convex/_generated/server used in tests (generated dir is gitignored)
export type ActionCtx = {
  runMutation: (...args: unknown[]) => Promise<unknown>;
  runQuery: (...args: unknown[]) => Promise<unknown>;
  runAction: (...args: unknown[]) => Promise<unknown>;
};

export type MutationCtx = {
  db: Record<string, unknown>;
  auth: Record<string, unknown>;
  runMutation: (...args: unknown[]) => Promise<unknown>;
  runQuery: (...args: unknown[]) => Promise<unknown>;
};

export type QueryCtx = {
  db: Record<string, unknown>;
  auth: Record<string, unknown>;
  runQuery: (...args: unknown[]) => Promise<unknown>;
};

function registerFunction<T>(definition: T): T {
  return definition;
}

export const internalMutation = registerFunction;
export const internalQuery = registerFunction;
export const mutation = registerFunction;
export const query = registerFunction;
export const action = registerFunction;
