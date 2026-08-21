import { describe, expect, it } from 'vitest';
import { isLocalhost } from './environment';

describe('isLocalhost', () => {
  it.each(['localhost', 'play.localhost', '127.0.0.1', '127.1.2.3', '::1', '[::1]'])(
    'recognizes %s as local',
    (hostname) => {
      expect(isLocalhost(hostname)).toBe(true);
    }
  );

  it.each(['xup.games', 'staging.xup.games', '192.168.1.20'])('does not recognize %s as localhost', (hostname) => {
    expect(isLocalhost(hostname)).toBe(false);
  });
});
