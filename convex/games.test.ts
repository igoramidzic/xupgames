import { describe, expect, it } from 'vitest';
import { GAME_DEFINITIONS, GAME_TYPES, resolveCatalogEntries } from './games';

describe('game catalog manifests', () => {
  it('defines complete metadata for every routed game type', () => {
    expect(new Set(GAME_DEFINITIONS.map((definition) => definition.gameType))).toEqual(new Set(GAME_TYPES));
    for (const definition of GAME_DEFINITIONS) {
      expect(definition.name.trim()).not.toBe('');
      expect(definition.description.trim()).not.toBe('');
      expect(definition.authorName.trim()).not.toBe('');
      expect(['official', 'community']).toContain(definition.source);
      expect(Number.isFinite(definition.sortOrder)).toBe(true);
    }
  });

  it('keeps game types and display ordering unique', () => {
    expect(new Set(GAME_TYPES).size).toBe(GAME_TYPES.length);
    expect(new Set(GAME_DEFINITIONS.map((definition) => definition.sortOrder)).size).toBe(GAME_DEFINITIONS.length);
  });
});

describe('game catalog authority', () => {
  it('uses source manifests only while the catalog table is uninitialized', () => {
    expect(resolveCatalogEntries([], false, GAME_DEFINITIONS)).toEqual(GAME_DEFINITIONS);
  });

  it('honors an initialized catalog with every game disabled', () => {
    expect(resolveCatalogEntries([], true, GAME_DEFINITIONS)).toEqual([]);
  });
});
