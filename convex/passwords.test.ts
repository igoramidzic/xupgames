import { describe, expect, it } from 'vitest';
import { normalizeRoomPassword } from './domain';
import { createPasswordCredential, verifyPasswordCredential } from './passwords';

describe('room passwords', () => {
  it('normalizes room passwords and rejects short values', () => {
    expect(normalizeRoomPassword('  secret phrase  ')).toBe('secret phrase');
    expect(() => normalizeRoomPassword('abc')).toThrow();
  });

  it('stores a salted derivation and verifies the matching password', async () => {
    const first = await createPasswordCredential('correct horse');
    const second = await createPasswordCredential('correct horse');

    expect(first.hash).not.toContain('correct horse');
    expect(first.salt).not.toBe(second.salt);
    await expect(verifyPasswordCredential('correct horse', first)).resolves.toBe(true);
    await expect(verifyPasswordCredential('wrong horse', first)).resolves.toBe(false);
  });
});
