import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { normalizeDisplayName, normalizePoint, normalizeRoomCode, validateSessionToken } from './domain';

describe('room domain validation', () => {
  it('normalizes public room values', () => {
    expect(normalizeRoomCode(' abcd2345 ')).toBe('ABCD2345');
    expect(normalizeDisplayName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
  });

  it('rejects weak session tokens', () => {
    expect(() => validateSessionToken('short')).toThrowError(
      expect.objectContaining({
        data: {
          code: 'INVALID_SESSION_TOKEN',
          message: 'Your browser session is invalid. Refresh the page and try again.',
        },
      })
    );
  });

  it('uses a structured Convex error contract', () => {
    try {
      normalizeRoomCode('not-a-code');
      throw new Error('Expected normalizeRoomCode to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      expect((error as ConvexError<{ code: string; message: string }>).data).toEqual({
        code: 'INVALID_ROOM_CODE',
        message: 'That room code is invalid.',
      });
    }
  });

  it('normalizes cursor coordinates used by shared presence', () => {
    expect(normalizePoint({ x: 0.1234567, y: 1 })).toEqual({ x: 0.12346, y: 1 });
    expect(() => normalizePoint({ x: -0.01, y: 0.5 })).toThrow();
  });
});
