export const PROMPT_ARCADE_PROVIDER_MAX_ATTEMPTS = 3;
export const PROMPT_ARCADE_PROVIDER_MAX_RETRY_DELAY_MS = 5_000;

const TRANSIENT_SERVER_STATUSES = new Set([500, 502, 503, 504]);
const BASE_RETRY_DELAY_MS = 500;

export function isRetryableProviderStatus(status: number): boolean {
  return status === 429 || TRANSIENT_SERVER_STATUSES.has(status);
}

function clampRetryDelay(delayMs: number): number {
  return Math.max(0, Math.min(PROMPT_ARCADE_PROVIDER_MAX_RETRY_DELAY_MS, Math.round(delayMs)));
}

export function parseRetryAfterMs(value: string | null, nowMs: number): number | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) {
    return clampRetryDelay(Number(normalized) * 1_000);
  }
  if (!/[A-Za-z]/.test(normalized)) return null;
  const dateMs = Date.parse(normalized);
  if (!Number.isFinite(dateMs)) return null;
  return clampRetryDelay(dateMs - nowMs);
}

export function providerRetryDelayMs(
  failedAttempt: number,
  retryAfterHeader: string | null,
  nowMs: number,
  random: () => number = Math.random
): number {
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader, nowMs);
  if (retryAfterMs !== null) return retryAfterMs;
  const exponentialCap = Math.min(
    PROMPT_ARCADE_PROVIDER_MAX_RETRY_DELAY_MS,
    BASE_RETRY_DELAY_MS * 2 ** Math.max(0, failedAttempt - 1)
  );
  const jitter = Math.max(0, Math.min(1, random()));
  return clampRetryDelay(exponentialCap / 2 + (exponentialCap / 2) * jitter);
}
