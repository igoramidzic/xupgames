import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DoodleDashCanvas from './DoodleDashCanvas';

const context = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  fill: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
      canDraw: true,
      showTools: true,
      canUndo: true,
      canRedo: true,
      onAppend,
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
    await waitFor(() => expect(onAppend).toHaveBeenCalledTimes(1));

    context.lineTo.mockClear();
    rerender(<DoodleDashCanvas {...props} strokes={[]} />);
    await waitFor(() => expect(context.lineTo).toHaveBeenCalled());

    await act(async () => resolveAppend?.({ sequence: 1 }));
  });

  it('supports keyboard undo and redo without taking over text input history', async () => {
    const onUndo = vi.fn(async () => {});
    const onRedo = vi.fn(async () => {});
    render(
      <>
        <input aria-label="Editable text" />
        <DoodleDashCanvas
          strokes={[]}
          canDraw
          showTools
          canUndo
          canRedo
          onAppend={vi.fn(async () => ({ sequence: 1 }))}
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
        canDraw
        showTools
        canUndo={false}
        canRedo={false}
        onAppend={vi.fn(async () => ({ sequence: 1 }))}
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
