import { AlertTriangle, Gamepad2, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MESSAGE_SCOPE = 'xup-prompt-arcade-v1';

export type GeneratedGameFinish = {
  quality: number;
  metricLabel?: string;
  metricValue?: number;
};

type FrameState = 'fetching' | 'booting' | 'ready' | 'expired' | 'error';
const generatedCodeCache = new Map<string, Promise<string>>();
const MAX_GENERATED_CODE_BYTES = 60_000;

function loadGeneratedGameCode(codeUrl: string) {
  const cached = generatedCodeCache.get(codeUrl);
  if (cached !== undefined) return cached;
  const download = fetch(codeUrl, { credentials: 'omit', referrerPolicy: 'no-referrer' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Game download failed (${response.status}).`);
      const code = await response.text();
      if (code.trim() === '') throw new Error('The generated game was empty.');
      if (new TextEncoder().encode(code).byteLength > MAX_GENERATED_CODE_BYTES) {
        throw new Error('The generated game was larger than the runner allows.');
      }
      return code;
    })
    .catch((error: unknown) => {
      generatedCodeCache.delete(codeUrl);
      throw error;
    });
  generatedCodeCache.set(codeUrl, download);
  if (generatedCodeCache.size > 30) {
    const oldestUrl = generatedCodeCache.keys().next().value;
    if (oldestUrl !== undefined && oldestUrl !== codeUrl) generatedCodeCache.delete(oldestUrl);
  }
  return download;
}

export function prefetchGeneratedGame(codeUrl: string) {
  void loadGeneratedGameCode(codeUrl).catch(() => undefined);
}

const RUNNER_DOCUMENT = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; child-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'" />
    <title>Prompt Arcade game</title>
    <style>
      * { box-sizing: border-box; }
      html, body, #game-root { width: 100%; height: 100%; margin: 0; overflow: hidden; }
      body { background: #fffdf7; color: #17203a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      button, input, textarea { font: inherit; }
      :focus-visible { outline: 3px solid rgba(70, 63, 211, .42); outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main id="game-root" aria-label="Generated mini-game"></main>
    <script>
      (() => {
        'use strict';
        const SCOPE = '${MESSAGE_SCOPE}';
        const root = document.getElementById('game-root');
        let sessionNonce = null;
        let definition = null;
        let codeLoaded = false;
        let finished = false;
        let dispose = null;

        const send = (kind, payload = {}) => {
          if (sessionNonce === null) return;
          parent.postMessage({ scope: SCOPE, nonce: sessionNonce, kind, ...payload }, '*');
        };

        const fail = (message) => {
          const safeMessage = typeof message === 'string' ? message.slice(0, 240) : 'The generated game stopped.';
          send('runtime-error', { message: safeMessage });
        };

        window.registerPromptArcadeGame = (candidate) => {
          if (definition !== null) throw new Error('A game can only register once.');
          if (!candidate || typeof candidate.mount !== 'function') {
            throw new Error('The game must register a mount(root, api) function.');
          }
          definition = candidate;
        };

        const api = Object.freeze({
          finish(payload) {
            if (finished) return;
            if (!payload || typeof payload.quality !== 'number' || !Number.isFinite(payload.quality)) {
              fail('The game returned an invalid quality score.');
              return;
            }
            finished = true;
            const metricLabel = typeof payload.metricLabel === 'string'
              ? payload.metricLabel.trim().slice(0, 80)
              : undefined;
            const metricValue = typeof payload.metricValue === 'number' && Number.isFinite(payload.metricValue)
              ? payload.metricValue
              : undefined;
            send('finish', {
              quality: Math.max(0, Math.min(1, payload.quality)),
              ...(metricLabel ? { metricLabel } : {}),
              ...(metricValue === undefined ? {} : { metricValue }),
            });
          },
        });

        const mountRegisteredGame = async () => {
          if (definition === null) throw new Error('The generated code did not register a game.');
          const maybeDispose = await definition.mount(root, api);
          if (typeof maybeDispose === 'function') dispose = maybeDispose;
          send('game-ready');
        };

        addEventListener('message', (event) => {
          if (event.source !== parent || !event.data || event.data.scope !== SCOPE) return;
          if (event.data.kind === 'bootstrap' && typeof event.data.nonce === 'string') {
            if (sessionNonce === null) sessionNonce = event.data.nonce;
            if (event.data.nonce === sessionNonce) send('runner-ready');
            return;
          }
          if (event.data.nonce !== sessionNonce || event.data.kind !== 'load-game' || codeLoaded) return;
          if (typeof event.data.code !== 'string' || event.data.code.length === 0) {
            fail('The generated game code was empty.');
            return;
          }
          codeLoaded = true;
          const sourceUrl = URL.createObjectURL(new Blob([event.data.code], { type: 'text/javascript' }));
          const script = document.createElement('script');
          script.src = sourceUrl;
          script.addEventListener('load', () => {
            URL.revokeObjectURL(sourceUrl);
            Promise.resolve(mountRegisteredGame()).catch((error) => fail(error instanceof Error ? error.message : String(error)));
          }, { once: true });
          script.addEventListener('error', () => {
            URL.revokeObjectURL(sourceUrl);
            fail('The generated game could not be loaded.');
          }, { once: true });
          document.head.append(script);
        });

        addEventListener('click', (event) => {
          if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
        }, true);
        addEventListener('submit', (event) => event.preventDefault(), true);
        addEventListener('error', (event) => fail(event.message), true);
        addEventListener('unhandledrejection', (event) => {
          fail(event.reason instanceof Error ? event.reason.message : String(event.reason));
        });
        addEventListener('pagehide', () => {
          if (dispose !== null) {
            try { dispose(); } catch { /* frame is already stopping */ }
          }
        }, { once: true });
      })();
    </script>
  </body>
</html>`;

function createNonce() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function parseGeneratedGameMessage(
  value: unknown
):
  | { kind: 'runner-ready'; nonce: string }
  | { kind: 'game-ready'; nonce: string }
  | { kind: 'runtime-error'; nonce: string; message: string }
  | ({ kind: 'finish'; nonce: string } & GeneratedGameFinish)
  | null {
  if (typeof value !== 'object' || value === null || !('scope' in value) || value.scope !== MESSAGE_SCOPE) return null;
  if (!('kind' in value) || !('nonce' in value) || typeof value.nonce !== 'string') return null;
  if (value.kind === 'runner-ready' || value.kind === 'game-ready') return { kind: value.kind, nonce: value.nonce };
  if (value.kind === 'runtime-error' && 'message' in value && typeof value.message === 'string') {
    return { kind: value.kind, nonce: value.nonce, message: value.message.slice(0, 240) };
  }
  if (
    value.kind !== 'finish' ||
    !('quality' in value) ||
    typeof value.quality !== 'number' ||
    !Number.isFinite(value.quality)
  ) {
    return null;
  }
  const metricLabel =
    'metricLabel' in value && typeof value.metricLabel === 'string' ? value.metricLabel.trim().slice(0, 80) : undefined;
  const metricValue =
    'metricValue' in value && typeof value.metricValue === 'number' && Number.isFinite(value.metricValue)
      ? value.metricValue
      : undefined;
  return {
    kind: 'finish',
    nonce: value.nonce,
    quality: Math.max(0, Math.min(1, value.quality)),
    ...(metricLabel ? { metricLabel } : {}),
    ...(metricValue === undefined ? {} : { metricValue }),
  };
}

export default function GeneratedGameFrame({
  title,
  codeUrl,
  playEndsAt,
  onFinish,
  onRuntimeError,
}: {
  title: string;
  codeUrl: string;
  playEndsAt: number;
  onFinish: (result: GeneratedGameFinish) => void;
  onRuntimeError?: (message: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const nonceRef = useRef(createNonce());
  const codeRef = useRef<string | null>(null);
  const runnerReadyRef = useRef(false);
  const finishSentRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const onRuntimeErrorRef = useRef(onRuntimeError);
  const [state, setState] = useState<FrameState>('fetching');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onFinishRef.current = onFinish;
    onRuntimeErrorRef.current = onRuntimeError;
  }, [onFinish, onRuntimeError]);

  useEffect(() => {
    let cancelled = false;
    setState('fetching');
    setError(null);
    codeRef.current = null;
    runnerReadyRef.current = false;
    finishSentRef.current = false;
    loadGeneratedGameCode(codeUrl)
      .then((code) => {
        if (cancelled) return;
        codeRef.current = code;
        setState('booting');
        if (runnerReadyRef.current) {
          iframeRef.current?.contentWindow?.postMessage(
            { scope: MESSAGE_SCOPE, kind: 'load-game', nonce: nonceRef.current, code },
            '*'
          );
        }
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        const message =
          fetchError instanceof Error ? fetchError.message : 'The generated game could not be downloaded.';
        setError(message);
        setState('error');
        onRuntimeErrorRef.current?.(message);
      });
    return () => {
      cancelled = true;
    };
  }, [codeUrl]);

  useEffect(() => {
    const remainingMs = Math.max(0, playEndsAt - Date.now());
    const timeout = window.setTimeout(() => setState('expired'), remainingMs);
    return () => window.clearTimeout(timeout);
  }, [playEndsAt]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = parseGeneratedGameMessage(event.data);
      if (message === null || message.nonce !== nonceRef.current) return;
      if (message.kind === 'runner-ready') {
        runnerReadyRef.current = true;
        const code = codeRef.current;
        if (code !== null) {
          iframeRef.current?.contentWindow?.postMessage(
            { scope: MESSAGE_SCOPE, kind: 'load-game', nonce: nonceRef.current, code },
            '*'
          );
        }
        return;
      }
      if (message.kind === 'game-ready') {
        setState('ready');
        return;
      }
      if (message.kind === 'runtime-error') {
        setError(message.message);
        setState('error');
        onRuntimeErrorRef.current?.(message.message);
        return;
      }
      if (finishSentRef.current) return;
      finishSentRef.current = true;
      onFinishRef.current({
        quality: message.quality,
        ...(message.metricLabel === undefined ? {} : { metricLabel: message.metricLabel }),
        ...(message.metricValue === undefined ? {} : { metricValue: message.metricValue }),
      });
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const postBootstrap = () => {
      if (runnerReadyRef.current) return;
      iframeRef.current?.contentWindow?.postMessage(
        { scope: MESSAGE_SCOPE, kind: 'bootstrap', nonce: nonceRef.current },
        '*'
      );
    };
    postBootstrap();
    const interval = window.setInterval(postBootstrap, 250);
    return () => window.clearInterval(interval);
  }, []);

  if (state === 'expired') {
    return (
      <div className="grid min-h-100 place-content-center bg-[#fff9ea] px-6 text-center" role="status">
        <Gamepad2 className="mx-auto mb-3 size-9 text-[#ef7543]" aria-hidden="true" />
        <strong className="font-display text-2xl font-[850] tracking-[-0.04em] text-[#17203a]">Time&apos;s up.</strong>
        <span className="mt-2 text-sm text-[#69758a]">The server is closing this round.</span>
      </div>
    );
  }

  return (
    <div className="relative min-h-100 overflow-hidden bg-[#fffdf7]" data-generated-game-frame>
      <iframe
        ref={iframeRef}
        className="block min-h-100 w-full border-0 bg-[#fffdf7]"
        sandbox="allow-scripts"
        allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
        referrerPolicy="no-referrer"
        srcDoc={RUNNER_DOCUMENT}
        title={`${title} game`}
        onLoad={() => {
          iframeRef.current?.contentWindow?.postMessage(
            { scope: MESSAGE_SCOPE, kind: 'bootstrap', nonce: nonceRef.current },
            '*'
          );
        }}
      />
      {state === 'fetching' || state === 'booting' ? (
        <div className="absolute inset-0 grid place-content-center bg-[#fffdf7] text-center" role="status">
          <LoaderCircle
            className="mx-auto mb-3 size-7 animate-spin text-[#4d46d7] motion-reduce:animate-none"
            aria-hidden="true"
          />
          <strong className="font-display text-lg font-[820] text-[#17203a]">Loading the game cartridge…</strong>
        </div>
      ) : null}
      {state === 'error' ? (
        <div className="absolute inset-0 grid place-content-center bg-[#fff6f0] px-6 text-center" role="alert">
          <AlertTriangle className="mx-auto mb-3 size-8 text-[#c75335]" aria-hidden="true" />
          <strong className="font-display text-xl font-[850] text-[#17203a]">This cartridge stopped.</strong>
          <span className="mt-2 max-w-md text-sm leading-[1.5] text-[#78594f]">{error}</span>
        </div>
      ) : null}
    </div>
  );
}
