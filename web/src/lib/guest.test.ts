import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeDisplayName, readGuest, saveGuest, validateDisplayName } from './guest';

describe('guest identity', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('normalizes and validates display names', () => {
    expect(normalizeDisplayName('  Maya   Chen  ')).toBe('Maya Chen');
    expect(validateDisplayName('   ')).toBe('Enter your name to continue.');
    expect(validateDisplayName('a'.repeat(25))).toBe('Keep your name to 24 characters or fewer.');
  });

  it('keeps the same opaque browser session while the name changes', () => {
    const first = saveGuest('Maya');
    const renamed = saveGuest('Maya C');

    expect(first.sessionToken).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(renamed.sessionToken).toBe(first.sessionToken);
    expect(readGuest()).toEqual(renamed);
  });
});
