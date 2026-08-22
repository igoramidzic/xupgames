import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DoodleDashCanvas from './DoodleDashCanvas';

const context = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  fill: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
};

class MockResizeObserver {
  observe() {}
  disconnect() {}
}

describe('DoodleDashCanvas', () => {
  beforeEach(() => {
    for (const method of Object.values(context)) {
      if (typeof method === 'function' && 'mockClear' in method) method.mockClear();
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 400,
      top: 0,
      width: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
    HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('streams a live chunk while deferring the durable stroke until pointer-up', async () => {
    vi.useFakeTimers();
    const onAppend = vi.fn(async () => ({ sequence: 1 }));
    const onStream = vi.fn(async () => {});
    render(
      <DoodleDashCanvas
        strokes={[]}
        liveStrokes={[]}
        canDraw
        showTools
        canUndo={false}
        canRedo={false}
        onAppend={onAppend}
        onStream={onStream}
        onUndo={vi.fn(async () => {})}
        onRedo={vi.fn(async () => {})}
        onClear={vi.fn(async () => {})}
        onError={vi.fn()}
      />
    );
    const canvas = screen.getByLabelText('Drawing canvas. Use pointer or touch to draw.');

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 30, clientY: 20 });
    await act(async () => vi.advanceTimersByTime(79));
    expect(onStream).not.toHaveBeenCalled();
    expect(onAppend).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1));
    expect(onStream).toHaveBeenCalledTimes(1);
    expect(onAppend).not.toHaveBeenCalled();
    expect(onStream).toHaveBeenCalledWith(
      expect.objectContaining({
        chunkIndex: 0,
        points: [
          { x: 0.025, y: 1 / 30 },
          { x: 0.075, y: 1 / 15 },
        ],
      })
    );
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 30, clientY: 20 });
    await act(async () => Promise.resolve());
    expect(onAppend).toHaveBeenCalledTimes(1);
  });

  it('sends up to four live chunks concurrently without blocking pointer input', async () => {
    vi.useFakeTimers();
    const streamResolvers: Array<() => void> = [];
    const onStream = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          streamResolvers.push(resolve);
        })
    );
    render(
      <DoodleDashCanvas
        strokes={[]}
        liveStrokes={[]}
        canDraw
        showTools
        canUndo={false}
        canRedo={false}
        onAppend={vi.fn(async () => ({ sequence: 1 }))}
        onStream={onStream}
        onUndo={vi.fn(async () => {})}
        onRedo={vi.fn(async () => {})}
        onClear={vi.fn(async () => {})}
        onError={vi.fn()}
      />
    );
    const canvas = screen.getByLabelText('Drawing canvas. Use pointer or touch to draw.');

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    for (let index = 1; index <= 5; index += 1) {
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 10 + index * 10, clientY: 10 + index * 5 });
      await act(async () => vi.advanceTimersByTime(80));
    }
    expect(onStream).toHaveBeenCalledTimes(4);

    await act(async () => streamResolvers.shift()?.());
    expect(onStream).toHaveBeenCalledTimes(5);
    for (const resolve of streamResolvers) resolve();
  });

  it('plays incoming spectator chunks across animation frames instead of painting them all at once', async () => {
    vi.useFakeTimers();
    render(
      <DoodleDashCanvas
        strokes={[]}
        liveStrokes={[
          {
            chunkId: 'chunk-1',
            actionId: 'action-1',
            actionStartedAt: 1,
            chunkIndex: 0,
            tool: 'pen',
            color: '#142747',
            width: 10,
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.2, y: 0.2 },
              { x: 0.3, y: 0.1 },
              { x: 0.4, y: 0.2 },
            ],
          },
        ]}
        canDraw={false}
        showTools={false}
        canUndo={false}
        canRedo={false}
        onAppend={vi.fn(async () => ({ sequence: 1 }))}
        onStream={vi.fn(async () => {})}
        onUndo={vi.fn(async () => {})}
        onRedo={vi.fn(async () => {})}
        onClear={vi.fn(async () => {})}
        onError={vi.fn()}
      />
    );
    context.arc.mockClear();
    context.lineTo.mockClear();
    context.quadraticCurveTo.mockClear();

    await act(async () => vi.advanceTimersByTime(49));
    expect(context.arc).not.toHaveBeenCalled();
    expect(context.lineTo).not.toHaveBeenCalled();
    expect(context.quadraticCurveTo).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(20));
    expect(context.arc).toHaveBeenCalledTimes(1);
    expect(context.lineTo).not.toHaveBeenCalled();
    expect(context.quadraticCurveTo).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(35));
    expect(context.lineTo).toHaveBeenCalledTimes(1);
    expect(context.quadraticCurveTo).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(35));
    expect(context.quadraticCurveTo.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('flushes a short stroke immediately when the pointer lifts', async () => {
    const onAppend = vi.fn(async () => ({ sequence: 1 }));
    render(
      <DoodleDashCanvas
        strokes={[]}
        liveStrokes={[]}
        canDraw
        showTools
        canUndo={false}
        canRedo={false}
        onAppend={onAppend}
        onStream={vi.fn(async () => {})}
        onUndo={vi.fn(async () => {})}
        onRedo={vi.fn(async () => {})}
        onClear={vi.fn(async () => {})}
        onError={vi.fn()}
      />
    );
    const canvas = screen.getByLabelText('Drawing canvas. Use pointer or touch to draw.');

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 40, clientY: 60 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 40, clientY: 60 });

    await waitFor(() => expect(onAppend).toHaveBeenCalledTimes(1));
    expect(onAppend).toHaveBeenCalledWith(expect.objectContaining({ points: [{ x: 0.1, y: 0.2 }] }));
  });

  it('keeps coalesced pointer samples for smoother pen and touch input', async () => {
    const onAppend = vi.fn(async () => ({ sequence: 1 }));
    render(
      <DoodleDashCanvas
        strokes={[]}
        liveStrokes={[]}
        canDraw
        showTools
        canUndo={false}
        canRedo={false}
        onAppend={onAppend}
        onStream={vi.fn(async () => {})}
        onUndo={vi.fn(async () => {})}
        onRedo={vi.fn(async () => {})}
        onClear={vi.fn(async () => {})}
        onError={vi.fn()}
      />
    );
    const canvas = screen.getByLabelText('Drawing canvas. Use pointer or touch to draw.');
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    const moveEvent = new Event('pointermove', { bubbles: true });
    Object.defineProperties(moveEvent, {
      clientX: { value: 30 },
      clientY: { value: 30 },
      getCoalescedEvents: {
        value: () => [
          { clientX: 20, clientY: 20 },
          { clientX: 30, clientY: 30 },
        ],
      },
      pointerId: { value: 1 },
    });
    fireEvent(canvas, moveEvent);
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 30, clientY: 30 });

    await waitFor(() => expect(onAppend).toHaveBeenCalledTimes(1));
    expect(onAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        points: [
          { x: 0.025, y: 1 / 30 },
          { x: 0.05, y: 1 / 15 },
          { x: 0.075, y: 0.1 },
        ],
      })
    );
  });

  it('renders consecutive server chunks from one action as one smoothed path', () => {
    render(
      <DoodleDashCanvas
        strokes={[
          {
            strokeId: 'stroke-1',
            sequence: 1,
            actionId: 'action-1',
            tool: 'pen',
            color: '#142747',
            width: 10,
            points: [
              { x: 0.1, y: 0.1 },
              { x: 0.2, y: 0.2 },
            ],
          },
          {
            strokeId: 'stroke-2',
            sequence: 2,
            actionId: 'action-1',
            tool: 'pen',
            color: '#142747',
            width: 10,
            points: [
              { x: 0.2, y: 0.2 },
              { x: 0.3, y: 0.1 },
            ],
          },
        ]}
        liveStrokes={[]}
        canDraw={false}
        showTools={false}
        canUndo={false}
        canRedo={false}
        onAppend={vi.fn(async () => ({ sequence: 1 }))}
        onStream={vi.fn(async () => {})}
        onUndo={vi.fn(async () => {})}
        onRedo={vi.fn(async () => {})}
        onClear={vi.fn(async () => {})}
        onError={vi.fn()}
      />
    );

    expect(context.moveTo).toHaveBeenCalledTimes(1);
    expect(context.quadraticCurveTo).toHaveBeenCalled();
  });

  it('keeps a flushed chunk visible while its mutation is still in flight', async () => {
    let resolveAppend: ((result: { sequence: number }) => void) | undefined;
    const onAppend = vi.fn(
      () =>
        new Promise<{ sequence: number }>((resolve) => {
          resolveAppend = resolve;
        })
    );
    const props = {
      liveStrokes: [],
      canDraw: true,
      showTools: true,
      canUndo: true,
      canRedo: true,
      onAppend,
      onStream: vi.fn(async () => {}),
      onUndo: vi.fn(async () => {}),
      onRedo: vi.fn(async () => {}),
      onClear: vi.fn(async () => {}),
      onError: vi.fn(),
    };
    const { rerender } = render(<DoodleDashCanvas {...props} strokes={[]} />);
    const canvas = screen.getByLabelText('Drawing canvas. Use pointer or touch to draw.');

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    for (let index = 1; index < 48; index += 1) {
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 10 + index * 2, clientY: 10 + index });
    }
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 104, clientY: 57 });
    await waitFor(() => expect(onAppend).toHaveBeenCalledTimes(1));

    context.lineTo.mockClear();
    rerender(<DoodleDashCanvas {...props} strokes={[]} />);
    await waitFor(() => expect(context.lineTo).toHaveBeenCalled());

    await act(async () => resolveAppend?.({ sequence: 1 }));
  });

  it('keeps the full active gesture visible when the previous quick stroke becomes authoritative', async () => {
    vi.useFakeTimers();
    const onAppend = vi.fn(async (_stroke: { actionId: string }) => ({ sequence: 1 }));
    const props = {
      liveStrokes: [],
      canDraw: true,
      showTools: true,
      canUndo: true,
      canRedo: true,
      onAppend,
      onStream: vi.fn(async () => {}),
      onUndo: vi.fn(async () => {}),
      onRedo: vi.fn(async () => {}),
      onClear: vi.fn(async () => {}),
      onError: vi.fn(),
    };
    const { rerender } = render(<DoodleDashCanvas {...props} strokes={[]} />);
    const canvas = screen.getByLabelText('Drawing canvas. Use pointer or touch to draw.');

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    await act(async () => Promise.resolve());
    const firstStroke = onAppend.mock.calls[0]?.[0];
    expect(firstStroke).toBeDefined();

    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 40, clientY: 40 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 60, clientY: 60 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 80, clientY: 40 });
    await act(async () => vi.advanceTimersByTime(80));

    context.lineTo.mockClear();
    context.quadraticCurveTo.mockClear();
    rerender(
      <DoodleDashCanvas
        {...props}
        strokes={[
          {
            strokeId: 'stroke-1',
            sequence: 1,
            actionId: firstStroke?.actionId ?? 'action-1',
            tool: 'pen',
            color: '#142747',
            width: 10,
            points: [{ x: 0.025, y: 1 / 30 }],
          },
        ]}
      />
    );

    expect(context.lineTo).toHaveBeenCalled();
    expect(context.quadraticCurveTo).toHaveBeenCalled();
  });

  it('supports keyboard undo and redo without taking over text input history', async () => {
    const onUndo = vi.fn(async () => {});
    const onRedo = vi.fn(async () => {});
    render(
      <>
        <input aria-label="Editable text" />
        <DoodleDashCanvas
          strokes={[]}
          liveStrokes={[]}
          canDraw
          showTools
          canUndo
          canRedo
          onAppend={vi.fn(async () => ({ sequence: 1 }))}
          onStream={vi.fn(async () => {})}
          onUndo={onUndo}
          onRedo={onRedo}
          onClear={vi.fn(async () => {})}
          onError={vi.fn()}
        />
      </>
    );

    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    await waitFor(() => expect(onUndo).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(onRedo).toHaveBeenCalledTimes(1));

    const input = screen.getByLabelText('Editable text');
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('offers the expanded color palette and paint bucket', () => {
    render(
      <DoodleDashCanvas
        strokes={[]}
        liveStrokes={[]}
        canDraw
        showTools
        canUndo={false}
        canRedo={false}
        onAppend={vi.fn(async () => ({ sequence: 1 }))}
        onStream={vi.fn(async () => {})}
        onUndo={vi.fn(async () => {})}
        onRedo={vi.fn(async () => {})}
        onClear={vi.fn(async () => {})}
        onError={vi.fn()}
      />
    );

    expect(screen.getAllByRole('button', { name: /^Use #[0-9a-f]{6} marker$/iu })).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Use paint bucket' })).toBeInTheDocument();
  });
});
