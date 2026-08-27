import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GeneratedGameFrame, { parseGeneratedGameMessage } from './GeneratedGameFrame';

const SCOPE = 'xup-prompt-arcade-v1';

describe('GeneratedGameFrame', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses only the bounded result contract', () => {
    expect(
      parseGeneratedGameMessage({
        scope: SCOPE,
        nonce: 'frame-nonce',
        kind: 'finish',
        quality: 4,
        metricLabel: '  circles hit  ',
        metricValue: 7,
        forgedScore: 999_999,
      })
    ).toEqual({
      kind: 'finish',
      nonce: 'frame-nonce',
      quality: 1,
      metricLabel: 'circles hit',
      metricValue: 7,
    });
    expect(
      parseGeneratedGameMessage({ scope: 'another-app', nonce: 'frame-nonce', kind: 'finish', quality: 1 })
    ).toBeNull();
    expect(
      parseGeneratedGameMessage({ scope: SCOPE, nonce: 'frame-nonce', kind: 'finish', quality: Number.NaN })
    ).toBeNull();
  });

  it('uses an opaque script-only frame and accepts a finish only from that frame with its nonce', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('window.registerPromptArcadeGame({ mount() {} });'))
    );
    const onFinish = vi.fn();
    render(
      <GeneratedGameFrame
        title="Perfect circle"
        codeUrl="https://storage.example/game.js"
        playEndsAt={Date.now() + 60_000}
        onFinish={onFinish}
      />
    );

    const frame = screen.getByTitle('Perfect circle game') as HTMLIFrameElement;
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
    expect(frame).not.toHaveAttribute('allow-same-origin');
    expect(frame.getAttribute('srcdoc')).toContain("connect-src 'none'");
    expect(frame.getAttribute('srcdoc')).toContain("form-action 'none'");
    expect(frame.getAttribute('allow')).toContain("camera 'none'");

    const frameWindow = frame.contentWindow;
    if (frameWindow === null) throw new Error('Expected the generated game iframe to have a window.');
    const postMessage = vi.spyOn(frameWindow, 'postMessage');
    fireEvent.load(frame);
    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    const bootstrap = postMessage.mock.calls
      .map(([message]) => message)
      .find(
        (message): message is { scope: string; kind: string; nonce: string } =>
          typeof message === 'object' && message !== null && 'kind' in message && message.kind === 'bootstrap'
      );
    if (bootstrap === undefined) throw new Error('Expected the parent to send a bootstrap nonce.');

    window.dispatchEvent(
      new MessageEvent('message', {
        source: window,
        data: { scope: SCOPE, nonce: bootstrap.nonce, kind: 'finish', quality: 0.8 },
      })
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        source: frameWindow,
        data: { scope: SCOPE, nonce: 'wrong-nonce', kind: 'finish', quality: 0.8 },
      })
    );
    expect(onFinish).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        source: frameWindow,
        data: { scope: SCOPE, nonce: bootstrap.nonce, kind: 'finish', quality: 0.8, metricLabel: 'accuracy' },
      })
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        source: frameWindow,
        data: { scope: SCOPE, nonce: bootstrap.nonce, kind: 'finish', quality: 0.2 },
      })
    );
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({ quality: 0.8, metricLabel: 'accuracy' });
  });
});
