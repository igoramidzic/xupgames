import {
  isRetryableProviderStatus,
  PROMPT_ARCADE_PROVIDER_BUDGET_MS,
  PROMPT_ARCADE_PROVIDER_MAX_ATTEMPTS,
  providerRetryDelayMs,
} from './providerRetry';

export class GenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractResponseText(response: unknown): string | null {
  if (!isRecord(response) || !Array.isArray(response.output)) return null;
  const chunks: string[] = [];
  for (const output of response.output) {
    if (!isRecord(output) || !Array.isArray(output.content)) continue;
    for (const content of output.content) {
      if (isRecord(content) && content.type === 'output_text' && typeof content.text === 'string') {
        chunks.push(content.text);
      }
    }
  }
  return chunks.length === 0 ? null : chunks.join('');
}

// One deadline includes all retries, backoff, and response-body reads. The lease
// watchdog must outlive this budget; the optional repair gets a fresh budget.
export async function requestPromptArcadeArtifact(
  apiKey: string,
  body: { model: string } & Record<string, unknown>
): Promise<{ rawText: string; parsed: unknown }> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROMPT_ARCADE_PROVIDER_BUDGET_MS);
  let requestId: string | null = null;
  let clientRequestId = '';
  try {
    for (let attempt = 1; attempt <= PROMPT_ARCADE_PROVIDER_MAX_ATTEMPTS; attempt += 1) {
      controller.signal.throwIfAborted();
      clientRequestId = crypto.randomUUID();
      requestId = null;
      console.info('Prompt Arcade OpenAI request started.', { model: body.model, attempt, clientRequestId });
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Client-Request-Id': clientRequestId,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      requestId = response.headers.get('x-request-id');
      console.info('Prompt Arcade OpenAI response received.', {
        model: body.model,
        attempt,
        clientRequestId,
        requestId,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
      });
      if (!response.ok) {
        // Do not log provider bodies: they can echo player prompts or credentials.
        await response.body?.cancel();
        const retryable = isRetryableProviderStatus(response.status);
        if (retryable && attempt < PROMPT_ARCADE_PROVIDER_MAX_ATTEMPTS) {
          const delayMs = providerRetryDelayMs(attempt, response.headers.get('retry-after'), Date.now());
          const remainingMs = PROMPT_ARCADE_PROVIDER_BUDGET_MS - (Date.now() - startedAt);
          await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, Math.min(delayMs, remainingMs))));
          continue;
        }
        throw new GenerationRequestError(
          retryable
            ? `The game generator remained temporarily unavailable after ${attempt} attempts (${response.status}). You can try again.`
            : `The game generator returned an error (${response.status}). You can try again.`
        );
      }
      const payload: unknown = await response.json();
      if (isRecord(payload) && payload.status === 'incomplete') {
        console.warn('Prompt Arcade OpenAI response incomplete.', { requestId, clientRequestId });
        throw new GenerationRequestError(
          'The game generator reached its output limit before finishing. Try a simpler game.'
        );
      }
      const rawText = extractResponseText(payload);
      if (rawText === null) throw new GenerationRequestError('The game generator returned no game. You can try again.');
      console.info('Prompt Arcade OpenAI request completed.', {
        model: body.model,
        requestId,
        clientRequestId,
        elapsedMs: Date.now() - startedAt,
      });
      try {
        return { rawText, parsed: JSON.parse(rawText) as unknown };
      } catch {
        return { rawText, parsed: null };
      }
    }
    throw new GenerationRequestError('The game generator remained temporarily unavailable. You can try again.');
  } catch (error) {
    console.error('Prompt Arcade OpenAI request failed.', {
      model: body.model,
      requestId,
      clientRequestId,
      elapsedMs: Date.now() - startedAt,
      timedOut: controller.signal.aborted,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    if (controller.signal.aborted) {
      throw new GenerationRequestError(
        'Game generation took too long. Please retry; you do not need to change your prompt.'
      );
    }
    if (error instanceof GenerationRequestError) throw error;
    throw new GenerationRequestError('The game generator could not be reached. You can try again.');
  } finally {
    clearTimeout(timeout);
  }
}
