import { DOODLE_DASH_COLORS } from '@convex/doodleDashEngine';
import { Eraser, PaintBucket, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { floodFillDoodleDashCanvas } from './DoodleDashFloodFill';

export type DoodleDashPoint = { x: number; y: number };
export type DoodleDashTool = 'pen' | 'eraser' | 'fill';
export type DoodleDashStroke = {
  strokeId: string;
  sequence: number;
  actionId: string;
  tool: DoodleDashTool;
  color: string;
  width: number;
  points: DoodleDashPoint[];
};

type DoodleDashStrokePayload = Omit<DoodleDashStroke, 'strokeId' | 'sequence'>;
type PendingDoodleDashStroke = DoodleDashStrokePayload & {
  localId: number;
  sequence: number | null;
};

const WIDTHS = [5, 10, 18] as const;
const MAX_BATCH_POINTS = 48;

function renderStroke(
  context: CanvasRenderingContext2D,
  stroke: DoodleDashStrokePayload,
  width: number,
  height: number
) {
  if (stroke.points.length === 0) return;
  const first = stroke.points[0];
  if (stroke.tool === 'fill') {
    floodFillDoodleDashCanvas(context, first.x, first.y, stroke.color);
    return;
  }
  context.save();
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (stroke.points.length === 1) {
    context.beginPath();
    context.arc(first.x * width, first.y * height, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  context.beginPath();
  context.moveTo(first.x * width, first.y * height);
  for (const point of stroke.points.slice(1)) {
    context.lineTo(point.x * width, point.y * height);
  }
  context.stroke();
  context.restore();
}

export default function DoodleDashCanvas({
  strokes,
  canDraw,
  showTools,
  canUndo,
  canRedo,
  onAppend,
  onUndo,
  onRedo,
  onClear,
  onError,
}: {
  strokes: DoodleDashStroke[];
  canDraw: boolean;
  showTools: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAppend: (stroke: {
    actionId: string;
    tool: DoodleDashTool;
    color: string;
    width: number;
    points: DoodleDashPoint[];
  }) => Promise<{ sequence: number }>;
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  onClear: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const activePointsRef = useRef<DoodleDashPoint[]>([]);
  const activeActionIdRef = useRef<string | null>(null);
  const nextPendingIdRef = useRef(1);
  const nextActionIdRef = useRef(1);
  const appendChainRef = useRef(Promise.resolve());
  const historyPendingRef = useRef(false);
  const [tool, setTool] = useState<DoodleDashTool>('pen');
  const [color, setColor] = useState<(typeof DOODLE_DASH_COLORS)[number]>(DOODLE_DASH_COLORS[0]);
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[1]);
  const [pendingStrokes, setPendingStrokes] = useState<PendingDoodleDashStroke[]>([]);
  const [historyPending, setHistoryPending] = useState(false);

  const authoritativeSequences = useMemo(() => new Set(strokes.map((stroke) => stroke.sequence)), [strokes]);
  const authoritativeSequencesRef = useRef(authoritativeSequences);
  authoritativeSequencesRef.current = authoritativeSequences;
  const visiblePendingStrokes = useMemo(
    () => pendingStrokes.filter((stroke) => stroke.sequence === null || !authoritativeSequences.has(stroke.sequence)),
    [authoritativeSequences, pendingStrokes]
  );

  const activeStroke = useCallback(
    (points: DoodleDashPoint[], actionId: string): DoodleDashStrokePayload => ({
      actionId,
      tool,
      color: tool === 'eraser' ? '#ffffff' : color,
      width: tool === 'fill' ? 0 : tool === 'eraser' ? 36 : width,
      points,
    }),
    [color, tool, width]
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(bounds.width * ratio);
    const pixelHeight = Math.round(bounds.height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const context = canvas.getContext('2d');
    if (context === null) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    for (const stroke of strokes) renderStroke(context, stroke, bounds.width, bounds.height);
    for (const stroke of visiblePendingStrokes) renderStroke(context, stroke, bounds.width, bounds.height);
    if (activePointsRef.current.length > 0 && activeActionIdRef.current !== null) {
      renderStroke(
        context,
        activeStroke(activePointsRef.current, activeActionIdRef.current),
        bounds.width,
        bounds.height
      );
    }
  }, [activeStroke, strokes, visiblePendingStrokes]);

  useEffect(() => {
    redraw();
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  useEffect(() => {
    if (authoritativeSequences.size === 0) return;
    setPendingStrokes((current) => {
      const pendingOnly = current.filter(
        (stroke) => stroke.sequence === null || !authoritativeSequences.has(stroke.sequence)
      );
      return pendingOnly.length === current.length ? current : pendingOnly;
    });
  }, [authoritativeSequences]);

  useEffect(() => {
    if (canDraw) return;
    pointerIdRef.current = null;
    activePointsRef.current = [];
    activeActionIdRef.current = null;
    setPendingStrokes([]);
  }, [canDraw]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>): DoodleDashPoint {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function createActionId() {
    const generated = globalThis.crypto?.randomUUID?.();
    if (generated !== undefined) return generated;
    const fallback = `${Date.now()}_${nextActionIdRef.current}`;
    nextActionIdRef.current += 1;
    return fallback;
  }

  function queueStroke(stroke: DoodleDashStrokePayload) {
    const localId = nextPendingIdRef.current;
    nextPendingIdRef.current += 1;
    setPendingStrokes((current) => [...current, { ...stroke, localId, sequence: null }]);
    appendChainRef.current = appendChainRef.current.then(async () => {
      try {
        const result = await onAppend(stroke);
        setPendingStrokes((current) =>
          authoritativeSequencesRef.current.has(result.sequence)
            ? current.filter((pending) => pending.localId !== localId)
            : current.map((pending) =>
                pending.localId === localId ? { ...pending, sequence: result.sequence } : pending
              )
        );
      } catch (error) {
        setPendingStrokes((current) => current.filter((pending) => pending.localId !== localId));
        onError(error);
      }
    });
  }

  function flushPoints() {
    const points = activePointsRef.current;
    const actionId = activeActionIdRef.current;
    if (points.length === 0 || actionId === null) return;
    activePointsRef.current = points.length > 1 ? [points[points.length - 1]] : [];
    queueStroke(activeStroke(points, actionId));
  }

  function drawLatestSegment() {
    const canvas = canvasRef.current;
    const points = activePointsRef.current;
    if (canvas === null || points.length === 0) return;
    const bounds = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    if (context === null) return;
    if (activeActionIdRef.current === null) return;
    renderStroke(context, activeStroke(points.slice(-2), activeActionIdRef.current), bounds.width, bounds.height);
  }

  function finishPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    flushPoints();
    pointerIdRef.current = null;
    activePointsRef.current = [];
    activeActionIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const runHistoryAction = useCallback(
    async (action: () => Promise<void>) => {
      if (historyPendingRef.current) return;
      historyPendingRef.current = true;
      setHistoryPending(true);
      try {
        await appendChainRef.current;
        setPendingStrokes([]);
        await action();
      } catch (error) {
        onError(error);
      } finally {
        historyPendingRef.current = false;
        setHistoryPending(false);
      }
    },
    [onError]
  );

  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      if (!canDraw || event.repeat || event.altKey || (!event.metaKey && !event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'z') return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const isRedo = event.shiftKey;
      if ((isRedo && !canRedo) || (!isRedo && !canUndo)) return;
      event.preventDefault();
      void runHistoryAction(isRedo ? onRedo : onUndo);
    }
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [canDraw, canRedo, canUndo, onRedo, onUndo, runHistoryAction]);

  return (
    <div className="grid min-h-0 gap-3" data-slot="doodle-dash-canvas-stack">
      {showTools ? (
        <div
          className="flex min-h-10 flex-wrap items-center gap-2 rounded-[12px_7px_13px_8px] border border-[#c8b9a6] bg-[#fffdf7] p-2 shadow-[4px_5px_0_#ded2c2]"
          role="toolbar"
          aria-label="Drawing tools"
          data-slot="doodle-dash-tools-card"
        >
          <div className="grid grid-cols-6 items-center gap-1.5 p-0.5">
            {DOODLE_DASH_COLORS.map((swatch) => (
              <button
                className={cn(
                  'size-6 cursor-pointer rounded-full border-2 border-white shadow-[0_0_0_1px_#b9ad9c] outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-[#3155d9]/25 disabled:cursor-not-allowed disabled:opacity-45',
                  color === swatch && 'scale-110 shadow-[0_0_0_2px_#142747]'
                )}
                type="button"
                key={swatch}
                style={{ backgroundColor: swatch }}
                aria-label={`Use ${swatch} marker`}
                aria-pressed={color === swatch}
                disabled={!canDraw}
                onClick={() => {
                  if (tool === 'eraser') setTool('pen');
                  setColor(swatch);
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 border-l border-[#e4d9ca] py-0.5 pl-2">
            {WIDTHS.map((strokeWidth) => (
              <button
                className={cn(
                  'grid size-8 cursor-pointer place-items-center rounded-[7px_4px_8px_5px] border border-transparent bg-transparent outline-none hover:bg-[#f1ece2] focus-visible:ring-3 focus-visible:ring-[#3155d9]/25 disabled:cursor-not-allowed disabled:opacity-45',
                  tool === 'pen' && width === strokeWidth && 'border-[#b6a894] bg-[#ece6db]'
                )}
                type="button"
                key={strokeWidth}
                aria-label={`Use ${strokeWidth === 5 ? 'fine' : strokeWidth === 10 ? 'medium' : 'bold'} marker`}
                aria-pressed={tool === 'pen' && width === strokeWidth}
                disabled={!canDraw}
                onClick={() => {
                  setTool('pen');
                  setWidth(strokeWidth);
                }}
              >
                <span className="rounded-full bg-[#142747]" style={{ width: strokeWidth, height: strokeWidth }} />
              </button>
            ))}
            <button
              className={cn(
                'grid size-8 cursor-pointer place-items-center rounded-[7px_4px_8px_5px] border border-transparent text-[#62594c] outline-none hover:bg-[#f1ece2] focus-visible:ring-3 focus-visible:ring-[#3155d9]/25 disabled:cursor-not-allowed disabled:opacity-45',
                tool === 'eraser' && 'border-[#b6a894] bg-[#ece6db]'
              )}
              type="button"
              aria-label="Use eraser"
              aria-pressed={tool === 'eraser'}
              disabled={!canDraw}
              onClick={() => setTool('eraser')}
            >
              <Eraser className="size-4" />
            </button>
            <button
              className={cn(
                'grid size-8 cursor-pointer place-items-center rounded-[7px_4px_8px_5px] border border-transparent text-[#62594c] outline-none hover:bg-[#f1ece2] focus-visible:ring-3 focus-visible:ring-[#3155d9]/25 disabled:cursor-not-allowed disabled:opacity-45',
                tool === 'fill' && 'border-[#b6a894] bg-[#ece6db]'
              )}
              type="button"
              aria-label="Use paint bucket"
              aria-pressed={tool === 'fill'}
              disabled={!canDraw}
              onClick={() => setTool('fill')}
            >
              <PaintBucket className="size-4" />
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              variant="paper"
              size="icon"
              aria-label="Undo last action"
              title="Undo (Cmd/Ctrl+Z)"
              disabled={!canDraw || !canUndo || historyPending}
              onClick={() => void runHistoryAction(onUndo)}
            >
              <RotateCcw />
            </Button>
            <Button
              type="button"
              variant="paper"
              size="icon"
              aria-label="Redo last action"
              title="Redo (Cmd/Ctrl+Shift+Z)"
              disabled={!canDraw || !canRedo || historyPending}
              onClick={() => void runHistoryAction(onRedo)}
            >
              <RotateCw />
            </Button>
            <Button
              type="button"
              variant="destructive-soft"
              size="icon"
              aria-label="Clear canvas"
              disabled={!canDraw || !canUndo || historyPending}
              onClick={() => void runHistoryAction(onClear)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="flex min-h-10 items-center justify-between rounded-[12px_7px_13px_8px] border border-[#c8b9a6] bg-[#fffdf7] px-3 text-[10px] font-[820] tracking-[0.1em] text-[#8d816f] uppercase shadow-[4px_5px_0_#ded2c2]"
          data-slot="doodle-dash-tools-card"
        >
          <span>Live canvas</span>
          <span className="normal-case tracking-normal text-[#a19584]">Watching the drawer</span>
        </div>
      )}
      <div
        className="relative min-h-0 overflow-hidden rounded-[11px_17px_10px_15px] border border-[#c9bdab] bg-white shadow-[5px_6px_0_#e2d7c7]"
        data-slot="doodle-dash-canvas-card"
      >
        <canvas
          ref={canvasRef}
          className={cn(
            'block aspect-[4/3] h-auto w-full min-h-75 [touch-action:none]',
            canDraw ? (tool === 'fill' ? 'cursor-cell' : 'cursor-crosshair') : 'cursor-default'
          )}
          aria-label={canDraw ? 'Drawing canvas. Use pointer or touch to draw.' : 'Current drawing'}
          onPointerDown={(event) => {
            if (!canDraw) return;
            const point = pointFromEvent(event);
            const actionId = createActionId();
            if (tool === 'fill') {
              const stroke = activeStroke([point], actionId);
              const context = event.currentTarget.getContext('2d');
              const bounds = event.currentTarget.getBoundingClientRect();
              if (context !== null) renderStroke(context, stroke, bounds.width, bounds.height);
              queueStroke(stroke);
              return;
            }
            pointerIdRef.current = event.pointerId;
            activeActionIdRef.current = actionId;
            activePointsRef.current = [point];
            event.currentTarget.setPointerCapture(event.pointerId);
            drawLatestSegment();
          }}
          onPointerMove={(event) => {
            if (!canDraw || pointerIdRef.current !== event.pointerId) return;
            activePointsRef.current.push(pointFromEvent(event));
            drawLatestSegment();
            if (activePointsRef.current.length >= MAX_BATCH_POINTS) flushPoints();
          }}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
        />
        {!canDraw && strokes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-sm font-[720] text-[#a49988]">
            The first line will appear here.
          </div>
        ) : null}
      </div>
    </div>
  );
}
