import { DOODLE_DASH_COLORS, DOODLE_DASH_MAX_STROKE_POINTS } from '@convex/doodleDashEngine';
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
export type DoodleDashLiveStroke = Omit<DoodleDashStroke, 'strokeId' | 'sequence'> & {
  chunkId: string;
  actionStartedAt: number;
  chunkIndex: number;
  tool: Exclude<DoodleDashTool, 'fill'>;
};

type DoodleDashStrokePayload = Omit<DoodleDashStroke, 'strokeId' | 'sequence'>;
type PendingDoodleDashStroke = DoodleDashStrokePayload & {
  localId: number;
  sequence: number | null;
};

const WIDTHS = [5, 10, 18] as const;
const MAX_BATCH_POINTS = 96;
const STROKE_FLUSH_INTERVAL_MS = 80;
const MAX_CONCURRENT_LIVE_SENDS = 4;
const LIVE_PLAYBACK_DELAY_MS = 50;
const LIVE_PLAYBACK_DURATION_MS = 70;

type LiveStrokeSend = Omit<DoodleDashLiveStroke, 'chunkId'>;

type LiveStrokeAnimation = {
  stroke: DoodleDashLiveStroke;
  receivedAt: number;
  renderedPointCount: number;
  startedAt: number | null;
};

function samePoint(left: DoodleDashPoint, right: DoodleDashPoint) {
  return left.x === right.x && left.y === right.y;
}

function midpoint(left: DoodleDashPoint, right: DoodleDashPoint): DoodleDashPoint {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function limitStrokePoints(points: readonly DoodleDashPoint[]): DoodleDashPoint[] {
  if (points.length <= DOODLE_DASH_MAX_STROKE_POINTS) return [...points];
  const limited: DoodleDashPoint[] = [];
  const lastIndex = points.length - 1;
  for (let index = 0; index < DOODLE_DASH_MAX_STROKE_POINTS; index += 1) {
    const sourceIndex = Math.round((index * lastIndex) / (DOODLE_DASH_MAX_STROKE_POINTS - 1));
    const point = points[sourceIndex];
    if (point !== undefined) limited.push(point);
  }
  return limited;
}

function applyStrokeStyle(context: CanvasRenderingContext2D, stroke: DoodleDashStrokePayload) {
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
}

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
  applyStrokeStyle(context, stroke);
  if (stroke.points.length === 1) {
    context.beginPath();
    context.arc(first.x * width, first.y * height, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  context.beginPath();
  context.moveTo(first.x * width, first.y * height);
  const second = stroke.points[1];
  if (second !== undefined) {
    const firstMidpoint = midpoint(first, second);
    context.lineTo(firstMidpoint.x * width, firstMidpoint.y * height);
    for (let index = 1; index < stroke.points.length - 1; index += 1) {
      const point = stroke.points[index];
      const nextPoint = stroke.points[index + 1];
      if (point === undefined || nextPoint === undefined) continue;
      const nextMidpoint = midpoint(point, nextPoint);
      context.quadraticCurveTo(point.x * width, point.y * height, nextMidpoint.x * width, nextMidpoint.y * height);
    }
    const last = stroke.points[stroke.points.length - 1];
    if (last !== undefined) {
      context.quadraticCurveTo(last.x * width, last.y * height, last.x * width, last.y * height);
    }
  }
  context.stroke();
  context.restore();
}

function renderStrokeList(
  context: CanvasRenderingContext2D,
  strokes: readonly DoodleDashStrokePayload[],
  width: number,
  height: number
) {
  let activeStroke: DoodleDashStrokePayload | null = null;

  const flushActiveStroke = () => {
    if (activeStroke === null) return;
    renderStroke(context, activeStroke, width, height);
    activeStroke = null;
  };

  for (const stroke of strokes) {
    if (stroke.tool === 'fill') {
      flushActiveStroke();
      renderStroke(context, stroke, width, height);
      continue;
    }
    if (
      activeStroke !== null &&
      activeStroke.actionId === stroke.actionId &&
      activeStroke.tool === stroke.tool &&
      activeStroke.color === stroke.color &&
      activeStroke.width === stroke.width
    ) {
      const firstPoint = stroke.points[0];
      const lastPoint = activeStroke.points[activeStroke.points.length - 1];
      activeStroke.points.push(
        ...(firstPoint !== undefined && lastPoint !== undefined && samePoint(firstPoint, lastPoint)
          ? stroke.points.slice(1)
          : stroke.points)
      );
      continue;
    }
    flushActiveStroke();
    activeStroke = { ...stroke, points: [...stroke.points] };
  }
  flushActiveStroke();
}

function renderStrokeProgress(
  context: CanvasRenderingContext2D,
  stroke: DoodleDashStrokePayload,
  fromPointCount: number,
  toPointCount: number,
  width: number,
  height: number,
  closeStroke: boolean
) {
  const points = stroke.points;
  let renderedPointCount = fromPointCount;
  if (renderedPointCount === 0) {
    const firstPoint = points[0];
    if (firstPoint !== undefined) renderStroke(context, { ...stroke, points: [firstPoint] }, width, height);
    renderedPointCount = Math.min(1, toPointCount);
  }
  for (let index = Math.max(1, renderedPointCount); index < toPointCount; index += 1) {
    const currentPoint = points[index];
    const previousPoint = points[index - 1];
    if (currentPoint === undefined || previousPoint === undefined) continue;
    context.save();
    applyStrokeStyle(context, stroke);
    context.beginPath();
    if (index === 1) {
      const nextMidpoint = midpoint(previousPoint, currentPoint);
      context.moveTo(previousPoint.x * width, previousPoint.y * height);
      context.lineTo(nextMidpoint.x * width, nextMidpoint.y * height);
    } else {
      const pointBeforePrevious = points[index - 2];
      if (pointBeforePrevious === undefined) {
        context.restore();
        continue;
      }
      const previousMidpoint = midpoint(pointBeforePrevious, previousPoint);
      const nextMidpoint = midpoint(previousPoint, currentPoint);
      context.moveTo(previousMidpoint.x * width, previousMidpoint.y * height);
      context.quadraticCurveTo(
        previousPoint.x * width,
        previousPoint.y * height,
        nextMidpoint.x * width,
        nextMidpoint.y * height
      );
    }
    context.stroke();
    context.restore();
  }
  if (closeStroke && toPointCount === points.length && points.length > 1) {
    const lastPoint = points[points.length - 1];
    const previousPoint = points[points.length - 2];
    if (lastPoint !== undefined && previousPoint !== undefined) {
      const previousMidpoint = midpoint(previousPoint, lastPoint);
      context.save();
      applyStrokeStyle(context, stroke);
      context.beginPath();
      context.moveTo(previousMidpoint.x * width, previousMidpoint.y * height);
      context.quadraticCurveTo(lastPoint.x * width, lastPoint.y * height, lastPoint.x * width, lastPoint.y * height);
      context.stroke();
      context.restore();
    }
  }
  return toPointCount;
}

export default function DoodleDashCanvas({
  strokes,
  liveStrokes,
  canDraw,
  showTools,
  canUndo,
  canRedo,
  onAppend,
  onStream,
  onUndo,
  onRedo,
  onClear,
  onError,
}: {
  strokes: DoodleDashStroke[];
  liveStrokes: DoodleDashLiveStroke[];
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
  onStream: (stroke: LiveStrokeSend) => Promise<void>;
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  onClear: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const committedStrokesRef = useRef<DoodleDashStroke[]>([]);
  const pointerIdRef = useRef<number | null>(null);
  const activePointsRef = useRef<DoodleDashPoint[]>([]);
  const gesturePointsRef = useRef<DoodleDashPoint[]>([]);
  const renderedGesturePointCountRef = useRef(0);
  const drawFrameRef = useRef<number | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);
  const hasUnsentPointsRef = useRef(false);
  const activeActionIdRef = useRef<string | null>(null);
  const activeActionStartedAtRef = useRef<number | null>(null);
  const activeChunkIndexRef = useRef(0);
  const nextPendingIdRef = useRef(1);
  const nextActionIdRef = useRef(1);
  const appendChainRef = useRef(Promise.resolve());
  const liveSendQueueRef = useRef<LiveStrokeSend[]>([]);
  const liveSendInFlightRef = useRef(0);
  const liveSendIdleResolversRef = useRef<Array<() => void>>([]);
  const onStreamRef = useRef(onStream);
  const seenLiveChunkIdsRef = useRef(new Set<string>());
  const completedLiveStrokesRef = useRef<DoodleDashLiveStroke[]>([]);
  const liveAnimationQueueRef = useRef<LiveStrokeAnimation[]>([]);
  const liveAnimationFrameRef = useRef<number | null>(null);
  const animateLiveStrokesRef = useRef<(timestamp: number) => void>(() => undefined);
  const historyPendingRef = useRef(false);
  const [tool, setTool] = useState<DoodleDashTool>('pen');
  const [color, setColor] = useState<(typeof DOODLE_DASH_COLORS)[number]>(DOODLE_DASH_COLORS[0]);
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(WIDTHS[1]);
  const [pendingStrokes, setPendingStrokes] = useState<PendingDoodleDashStroke[]>([]);
  const [historyPending, setHistoryPending] = useState(false);

  const authoritativeSequences = useMemo(() => new Set(strokes.map((stroke) => stroke.sequence)), [strokes]);
  const authoritativeActionIds = useMemo(() => new Set(strokes.map((stroke) => stroke.actionId)), [strokes]);
  const authoritativeSequencesRef = useRef(authoritativeSequences);
  const authoritativeActionIdsRef = useRef(authoritativeActionIds);
  authoritativeSequencesRef.current = authoritativeSequences;
  authoritativeActionIdsRef.current = authoritativeActionIds;
  onStreamRef.current = onStream;
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

  const syncCommittedCanvas = useCallback(
    (bounds: DOMRect, ratio: number) => {
      const pixelWidth = Math.round(bounds.width * ratio);
      const pixelHeight = Math.round(bounds.height * ratio);
      const committedCanvas = committedCanvasRef.current ?? document.createElement('canvas');
      committedCanvasRef.current = committedCanvas;
      const resized = committedCanvas.width !== pixelWidth || committedCanvas.height !== pixelHeight;
      if (resized) {
        committedCanvas.width = pixelWidth;
        committedCanvas.height = pixelHeight;
      }
      const context = committedCanvas.getContext('2d');
      if (context === null) return committedCanvas;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const previousStrokes = committedStrokesRef.current;
      const isAppendOnly =
        !resized &&
        previousStrokes.length <= strokes.length &&
        previousStrokes.every(
          (stroke, index) =>
            stroke.strokeId === strokes[index]?.strokeId && stroke.sequence === strokes[index]?.sequence
        );
      if (!isAppendOnly) {
        context.clearRect(0, 0, bounds.width, bounds.height);
        renderStrokeList(context, strokes, bounds.width, bounds.height);
      } else if (previousStrokes.length < strokes.length) {
        const additions = strokes.slice(previousStrokes.length);
        const previousStroke = previousStrokes[previousStrokes.length - 1];
        const firstAddition = additions[0];
        const needsJunctionReplay =
          previousStroke !== undefined &&
          firstAddition !== undefined &&
          previousStroke.tool !== 'fill' &&
          previousStroke.actionId === firstAddition.actionId;
        renderStrokeList(
          context,
          needsJunctionReplay ? [previousStroke, ...additions] : additions,
          bounds.width,
          bounds.height
        );
      }
      committedStrokesRef.current = strokes;
      return committedCanvas;
    },
    [strokes]
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
    const committedCanvas = syncCommittedCanvas(bounds, ratio);
    context.drawImage(committedCanvas, 0, 0, bounds.width, bounds.height);
    const displayStrokes: DoodleDashStrokePayload[] = [
      ...completedLiveStrokesRef.current.filter((stroke) => !authoritativeActionIds.has(stroke.actionId)),
      ...liveAnimationQueueRef.current.flatMap((animation) =>
        animation.renderedPointCount > 0 && !authoritativeActionIds.has(animation.stroke.actionId)
          ? [{ ...animation.stroke, points: animation.stroke.points.slice(0, animation.renderedPointCount) }]
          : []
      ),
      ...visiblePendingStrokes,
    ];
    if (gesturePointsRef.current.length > 0 && activeActionIdRef.current !== null) {
      displayStrokes.push(activeStroke(gesturePointsRef.current, activeActionIdRef.current));
    }
    renderStrokeList(context, displayStrokes, bounds.width, bounds.height);
    renderedGesturePointCountRef.current = gesturePointsRef.current.length;
  }, [activeStroke, authoritativeActionIds, syncCommittedCanvas, visiblePendingStrokes]);

  useEffect(() => {
    redraw();
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const scheduleLiveAnimation = useCallback(() => {
    if (liveAnimationFrameRef.current !== null) return;
    liveAnimationFrameRef.current = window.requestAnimationFrame((timestamp) =>
      animateLiveStrokesRef.current(timestamp)
    );
  }, []);

  animateLiveStrokesRef.current = (timestamp: number) => {
    liveAnimationFrameRef.current = null;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = canvas.getContext('2d');
    if (context === null) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;

    while (liveAnimationQueueRef.current.length > 0) {
      const animation = liveAnimationQueueRef.current[0];
      if (animation === undefined) break;
      if (authoritativeActionIdsRef.current.has(animation.stroke.actionId)) {
        liveAnimationQueueRef.current.shift();
        continue;
      }
      if (timestamp < animation.receivedAt + LIVE_PLAYBACK_DELAY_MS) break;
      animation.startedAt ??= timestamp;
      const backlog = liveAnimationQueueRef.current.length;
      const duration = backlog > 3 ? 24 : backlog > 1 ? 45 : LIVE_PLAYBACK_DURATION_MS;
      const progress = Math.min(1, (timestamp - animation.startedAt) / duration);
      const targetPointCount = Math.min(
        animation.stroke.points.length,
        Math.max(1, Math.ceil(animation.stroke.points.length * progress))
      );
      animation.renderedPointCount = renderStrokeProgress(
        context,
        animation.stroke,
        animation.renderedPointCount,
        targetPointCount,
        bounds.width,
        bounds.height,
        progress === 1
      );
      if (progress < 1) break;
      completedLiveStrokesRef.current.push(animation.stroke);
      liveAnimationQueueRef.current.shift();
    }

    if (liveAnimationQueueRef.current.length > 0) scheduleLiveAnimation();
  };

  useEffect(() => {
    completedLiveStrokesRef.current = completedLiveStrokesRef.current.filter(
      (stroke) => !authoritativeActionIds.has(stroke.actionId)
    );
    liveAnimationQueueRef.current = liveAnimationQueueRef.current.filter(
      (animation) => !authoritativeActionIds.has(animation.stroke.actionId)
    );
  }, [authoritativeActionIds]);

  useEffect(() => {
    if (canDraw) return;
    const unseen = liveStrokes
      .filter((stroke) => {
        if (seenLiveChunkIdsRef.current.has(stroke.chunkId)) return false;
        seenLiveChunkIdsRef.current.add(stroke.chunkId);
        return !authoritativeActionIdsRef.current.has(stroke.actionId);
      })
      .sort(
        (left, right) =>
          left.actionStartedAt - right.actionStartedAt ||
          left.chunkIndex - right.chunkIndex ||
          left.chunkId.localeCompare(right.chunkId)
      );
    if (unseen.length === 0) return;

    const animateFromIndex = Math.max(0, unseen.length - 4);
    if (animateFromIndex > 0) {
      completedLiveStrokesRef.current.push(...unseen.slice(0, animateFromIndex));
      redraw();
    }
    const receivedAt = performance.now();
    for (const stroke of unseen.slice(animateFromIndex)) {
      liveAnimationQueueRef.current.push({ stroke, receivedAt, renderedPointCount: 0, startedAt: null });
    }
    scheduleLiveAnimation();
  }, [canDraw, liveStrokes, redraw, scheduleLiveAnimation]);

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
    if (drawFrameRef.current !== null) {
      window.cancelAnimationFrame(drawFrameRef.current);
      drawFrameRef.current = null;
    }
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    pointerIdRef.current = null;
    activePointsRef.current = [];
    gesturePointsRef.current = [];
    renderedGesturePointCountRef.current = 0;
    hasUnsentPointsRef.current = false;
    activeActionIdRef.current = null;
    activeActionStartedAtRef.current = null;
    activeChunkIndexRef.current = 0;
    liveSendQueueRef.current = [];
    setPendingStrokes((current) => (current.length === 0 ? current : []));
  }, [canDraw]);

  useEffect(
    () => () => {
      if (drawFrameRef.current !== null) window.cancelAnimationFrame(drawFrameRef.current);
      if (liveAnimationFrameRef.current !== null) window.cancelAnimationFrame(liveAnimationFrameRef.current);
      if (flushTimeoutRef.current !== null) window.clearTimeout(flushTimeoutRef.current);
      liveSendQueueRef.current = [];
    },
    []
  );

  function pointsFromEvent(event: React.PointerEvent<HTMLCanvasElement>): DoodleDashPoint[] {
    const bounds = event.currentTarget.getBoundingClientRect();
    const nativeEvent = event.nativeEvent;
    const coalescedEvents = nativeEvent.getCoalescedEvents?.() ?? [];
    const samples = coalescedEvents.length > 0 ? coalescedEvents : [nativeEvent];
    const points: DoodleDashPoint[] = [];
    let previousPoint = gesturePointsRef.current[gesturePointsRef.current.length - 1];
    for (const sample of samples) {
      const point = {
        x: Math.min(1, Math.max(0, (sample.clientX - bounds.left) / bounds.width)),
        y: Math.min(1, Math.max(0, (sample.clientY - bounds.top) / bounds.height)),
      };
      if (previousPoint !== undefined && samePoint(previousPoint, point)) continue;
      points.push(point);
      previousPoint = point;
    }
    return points;
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

  function pumpLiveSends() {
    while (liveSendInFlightRef.current < MAX_CONCURRENT_LIVE_SENDS) {
      const stroke = liveSendQueueRef.current.shift();
      if (stroke === undefined) {
        if (liveSendInFlightRef.current === 0) {
          for (const resolve of liveSendIdleResolversRef.current.splice(0)) resolve();
        }
        return;
      }
      liveSendInFlightRef.current += 1;
      void onStreamRef
        .current(stroke)
        .catch(() => {
          // The durable pointer-up write remains authoritative when a transient live update fails.
        })
        .finally(() => {
          liveSendInFlightRef.current -= 1;
          pumpLiveSends();
        });
    }
  }

  const waitForLiveSends = useCallback(async () => {
    if (liveSendQueueRef.current.length === 0 && liveSendInFlightRef.current === 0) return;
    await new Promise<void>((resolve) => liveSendIdleResolversRef.current.push(resolve));
  }, []);

  function queueLiveStroke(stroke: DoodleDashStrokePayload, actionStartedAt: number, chunkIndex: number) {
    if (stroke.tool === 'fill') return;
    liveSendQueueRef.current.push({
      actionId: stroke.actionId,
      actionStartedAt,
      chunkIndex,
      tool: stroke.tool,
      color: stroke.color,
      width: stroke.width,
      points: stroke.points,
    });
    pumpLiveSends();
  }

  function clearFlushTimeout() {
    if (flushTimeoutRef.current === null) return;
    window.clearTimeout(flushTimeoutRef.current);
    flushTimeoutRef.current = null;
  }

  function schedulePointFlush() {
    if (flushTimeoutRef.current !== null || pointerIdRef.current === null) return;
    flushTimeoutRef.current = window.setTimeout(() => {
      flushTimeoutRef.current = null;
      flushPoints();
      schedulePointFlush();
    }, STROKE_FLUSH_INTERVAL_MS);
  }

  function flushPoints() {
    const points = activePointsRef.current;
    const actionId = activeActionIdRef.current;
    const actionStartedAt = activeActionStartedAtRef.current;
    if (!hasUnsentPointsRef.current || points.length === 0 || actionId === null || actionStartedAt === null) return;
    const lastPoint = points[points.length - 1];
    activePointsRef.current = lastPoint === undefined ? [] : [lastPoint];
    hasUnsentPointsRef.current = false;
    queueLiveStroke(activeStroke(points, actionId), actionStartedAt, activeChunkIndexRef.current);
    activeChunkIndexRef.current += 1;
  }

  function drawGestureProgress(closeStroke = false) {
    const canvas = canvasRef.current;
    const points = gesturePointsRef.current;
    if (canvas === null || points.length === 0) return;
    const bounds = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    if (context === null) return;
    const actionId = activeActionIdRef.current;
    if (actionId === null) return;
    const stroke = activeStroke(points, actionId);
    renderedGesturePointCountRef.current = renderStrokeProgress(
      context,
      stroke,
      renderedGesturePointCountRef.current,
      points.length,
      bounds.width,
      bounds.height,
      closeStroke
    );
  }

  function scheduleGestureDraw() {
    if (drawFrameRef.current !== null) return;
    drawFrameRef.current = window.requestAnimationFrame(() => {
      drawFrameRef.current = null;
      drawGestureProgress();
    });
  }

  function finishPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pointerIdRef.current !== event.pointerId) return;
    if (event.type === 'pointerup') {
      for (const point of pointsFromEvent(event)) {
        activePointsRef.current.push(point);
        gesturePointsRef.current.push(point);
        hasUnsentPointsRef.current = true;
        if (activePointsRef.current.length >= MAX_BATCH_POINTS) flushPoints();
      }
    }
    if (drawFrameRef.current !== null) {
      window.cancelAnimationFrame(drawFrameRef.current);
      drawFrameRef.current = null;
    }
    drawGestureProgress(true);
    clearFlushTimeout();
    flushPoints();
    const actionId = activeActionIdRef.current;
    if (actionId !== null && gesturePointsRef.current.length > 0) {
      queueStroke(activeStroke(limitStrokePoints(gesturePointsRef.current), actionId));
    }
    pointerIdRef.current = null;
    activePointsRef.current = [];
    gesturePointsRef.current = [];
    renderedGesturePointCountRef.current = 0;
    hasUnsentPointsRef.current = false;
    activeActionIdRef.current = null;
    activeActionStartedAtRef.current = null;
    activeChunkIndexRef.current = 0;
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
        await waitForLiveSends();
        setPendingStrokes([]);
        await action();
      } catch (error) {
        onError(error);
      } finally {
        historyPendingRef.current = false;
        setHistoryPending(false);
      }
    },
    [onError, waitForLiveSends]
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
            const point = pointsFromEvent(event)[0];
            if (point === undefined) return;
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
            activeActionStartedAtRef.current = Date.now();
            activeChunkIndexRef.current = 0;
            activePointsRef.current = [point];
            gesturePointsRef.current = [point];
            renderedGesturePointCountRef.current = 0;
            hasUnsentPointsRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            scheduleGestureDraw();
            schedulePointFlush();
          }}
          onPointerMove={(event) => {
            if (!canDraw || pointerIdRef.current !== event.pointerId) return;
            const points = pointsFromEvent(event);
            for (const point of points) {
              activePointsRef.current.push(point);
              gesturePointsRef.current.push(point);
              hasUnsentPointsRef.current = true;
              if (activePointsRef.current.length >= MAX_BATCH_POINTS) flushPoints();
            }
            if (points.length > 0) scheduleGestureDraw();
          }}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
        />
        {!canDraw && strokes.length === 0 && liveStrokes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-sm font-[720] text-[#a49988]">
            The first line will appear here.
          </div>
        ) : null}
      </div>
    </div>
  );
}
