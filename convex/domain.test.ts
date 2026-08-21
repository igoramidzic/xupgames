import { describe, expect, it } from 'vitest';
import { normalizeDisplayName, normalizePoint, normalizeRoomCode, validateSessionToken } from './domain';

describe('room domain validation', () => {
  it('normalizes public room values', () => {
    expect(normalizeRoomCode(' abcd2345 ')).toBe('ABCD2345');
    expect(normalizeDisplayName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
  });

  it('rejects weak session tokens', () => {
    expect(() => validateSessionToken('short')).toThrow();
  });

  it('normalizes cursor coordinates used by shared presence', () => {
    expect(normalizePoint({ x: 0.1234567, y: 1 })).toEqual({ x: 0.12346, y: 1 });
    expect(() => normalizePoint({ x: -0.01, y: 0.5 })).toThrow();
  });
});
