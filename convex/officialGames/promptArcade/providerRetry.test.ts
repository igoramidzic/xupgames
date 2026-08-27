import { describe, expect, it } from 'vitest';
import {
  isRetryableProviderStatus,
  PROMPT_ARCADE_PROVIDER_MAX_ATTEMPTS,
  parseRetryAfterMs,
  providerRetryDelayMs,
} from './providerRetry';

describe('Prompt Arcade provider retry policy', () => {
  it('retries only rate limits and transient server statuses', () => {
    expect(PROMPT_ARCADE_PROVIDER_MAX_ATTEMPTS).toBe(3);
    for (const status of [429, 500, 502, 503, 504]) expect(isRetryableProviderStatus(status)).toBe(true);
    for (const status of [400, 401, 404, 408, 501, 505]) expect(isRetryableProviderStatus(status)).toBe(false);
  });

  it('honors seconds and HTTP-date Retry-After values with a safe clamp', () => {
    const now = Date.parse('2026-08-26T12:00:00.000Z');
    expect(parseRetryAfterMs('3', now)).toBe(3_000);
    expect(parseRetryAfterMs('60', now)).toBe(5_000);
    expect(parseRetryAfterMs('Wed, 26 Aug 2026 12:00:02 GMT', now)).toBe(2_000);
    expect(parseRetryAfterMs('Wed, 26 Aug 2026 11:59:00 GMT', now)).toBe(0);
    expect(parseRetryAfterMs('2.5', now)).toBeNull();
    expect(parseRetryAfterMs('not-a-date', now)).toBeNull();
  });

  it('uses bounded exponential equal jitter when Retry-After is unavailable', () => {
    expect(providerRetryDelayMs(1, null, 0, () => 0)).toBe(250);
    expect(providerRetryDelayMs(1, null, 0, () => 1)).toBe(500);
    expect(providerRetryDelayMs(2, null, 0, () => 0.5)).toBe(750);
    expect(providerRetryDelayMs(10, null, 0, () => 1)).toBe(5_000);
    expect(providerRetryDelayMs(2, '2', 0, () => 0)).toBe(2_000);
  });
});
