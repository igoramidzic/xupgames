import { describe, expect, it } from 'vitest';
import {
  normalizeColor,
  normalizeDisplayName,
  normalizePoint,
  normalizePointBatch,
  normalizeRoomCode,
  pointsMatchAt,
  validateExpectedPointCount,
  validateSessionToken,
} from './domain';

describe('drawing domain validation', () => {
  it('normalizes public room and drawing values', () => {
    expect(normalizeRoomCode(' abcd2345 ')).toBe('ABCD2345');
    expect(normalizeDisplayName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
    expect(normalizeColor('#A0B1C2')).toBe('#a0b1c2');
    expect(normalizePoint({ x: 0.1234567, y: 1 })).toEqual({ x: 0.12346, y: 1 });
  });

  it('rejects weak tokens, invalid coordinates, and oversized batches', () => {
    expect(() => validateSessionToken('short')).toThrow();
    expect(() => normalizePoint({ x: -0.01, y: 0.5 })).toThrow();
    expect(() => normalizePointBatch(Array.from({ length: 65 }, () => ({ x: 0, y: 0 })))).toThrow();
    expect(() => validateExpectedPointCount(1.5)).toThrow();
  });

  it('recognizes an already-persisted append at its expected offset', () => {
    const stored = [
      { x: 0, y: 0 },
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
    ];
    expect(pointsMatchAt(stored, 1, stored.slice(1))).toBe(true);
    expect(pointsMatchAt(stored, 1, [{ x: 0.9, y: 0.9 }])).toBe(false);
  });
});
