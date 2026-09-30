import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROMPT_ARCADE_STALE_GENERATION_MS } from './engine';
import { requestPromptArcadeArtifact } from './provider';
import { PROMPT_ARCADE_PROVIDER_BUDGET_MS } from './providerRetry';

const request = { model: 'test-model', input: 'private player prompt', store: false };
const payload = { output: [{ content: [{ type: 'output_text', text: '{"title":"Game"}' }] }] };

function delayedResponse(delayMs: number, signal: AbortSignal, response: Response): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(response), delayMs);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

describe('Prompt Arcade OpenAI requests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('accepts a generation that takes longer than the former 45-second timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, init) =>
        delayedResponse(
          60_000,
          init.signal,
          Response.json(payload, {
            headers: { 'x-request-id': 'req-success' },
          })
        )
      )
    );
    const pending = requestPromptArcadeArtifact('private-api-key', request);
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(pending).resolves.toMatchObject({ parsed: { title: 'Game' } });
    expect(console.info).toHaveBeenCalledWith(
      'Prompt Arcade OpenAI request completed.',
      expect.objectContaining({
        requestId: 'req-success',
        elapsedMs: 60_000,
      })
    );
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain('private');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps its timeout active while reading the response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'x-request-id': 'req-stalled-body' }),
        json: () =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
              once: true,
            });
          }),
      }))
    );
    const pending = requestPromptArcadeArtifact('private-api-key', request);
    const assertion = expect(pending).rejects.toThrow('Game generation took too long');
    await vi.advanceTimersByTimeAsync(PROMPT_ARCADE_PROVIDER_BUDGET_MS);
    await assertion;
    expect(console.error).toHaveBeenCalledWith(
      'Prompt Arcade OpenAI request failed.',
      expect.objectContaining({
        requestId: 'req-stalled-body',
        timedOut: true,
        elapsedMs: PROMPT_ARCADE_PROVIDER_BUDGET_MS,
      })
    );
    expect(PROMPT_ARCADE_STALE_GENERATION_MS).toBeGreaterThan(PROMPT_ARCADE_PROVIDER_BUDGET_MS);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds all retries by one deadline instead of resetting the clock on each attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url, init) =>
        delayedResponse(
          110_000,
          init.signal,
          new Response('', {
            status: 429,
            headers: { 'retry-after': '5' },
          })
        )
      )
      .mockImplementationOnce((_url, init) => delayedResponse(60_000, init.signal, Response.json(payload)));
    vi.stubGlobal('fetch', fetchMock);
    const pending = requestPromptArcadeArtifact('private-api-key', request);
    const assertion = expect(pending).rejects.toThrow('Game generation took too long');
    await vi.advanceTimersByTimeAsync(PROMPT_ARCADE_PROVIDER_BUDGET_MS);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports HTTP errors without logging the provider body or retrying invalid credentials', async () => {
    const fetchMock = vi.fn(async () => new Response('private-api-key private player prompt', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestPromptArcadeArtifact('private-api-key', request)).rejects.toThrow('error (401)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify([...vi.mocked(console.info).mock.calls, ...vi.mocked(console.error).mock.calls])
    ).not.toContain('private');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports an incomplete response instead of attempting to repair truncated JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'incomplete', output: [] }))
    );
    await expect(requestPromptArcadeArtifact('key', request)).rejects.toThrow('output limit');
  });
});
