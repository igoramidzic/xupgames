import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { Hand, Maximize2, Minus, Pencil, Plus } from 'lucide-react';
import {
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { type RemoteCursor, useCursorPresence } from '@/lib/useCursorPresence';

export type DrawingPoint = {
  x: number;
  y: number;
};

export type CanvasStroke = {
  strokeId: Id<'drawingStrokes'>;
  sequence: number;
  author: {
    memberId: Id<'roomMembers'>;
    displayName: string;
  };
  color: string;
  width: number;
  status: 'drawing' | 'finished';
  points: DrawingPoint[];
  pointCount: number;
};

type ActiveStroke = {
  localId: string;
  strokeId: Id<'drawingStrokes'> | null;
  sequence: number;
  points: DrawingPoint[];
  sentCount: number;
  sending: boolean;
  ended: boolean;
  finishing: boolean;
  serverFinished: boolean;
  color: string;
  width: number;
};

export type Camera = {
  centerX: number;
  centerY: number;
  zoom: number;
};

export type CanvasSize = {
  width: number;
  height: number;
  pixelRatio: number;
};

type PanGesture = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCamera: Camera;
};

type RenderableStroke = {
  sequence: number;
  color: string;
  width: number;
  points: DrawingPoint[];
};

type DrawingCanvasProps = {
  roomId: Id<'rooms'>;
  sessionToken: string;
  memberId: Id<'roomMembers'>;
  displayName: string;
  memberColors: Record<string, string>;
  strokes: CanvasStroke[];
  color: string;
  width: number;
  drawingControls: ReactNode;
  disabled?: boolean;
  onError: (message: string) => void;
};

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1000;
const GRID_SIZE = 40;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 4;
const MAX_POINTS_PER_STROKE = 1000;
const POINTS_PER_BATCH = 48;

function messageFromError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'The mark could not be saved.';
  }

  const convexPayload = error.message.match(/\{.*"message":"([^"]+)".*\}/)?.[1];
  return convexPayload ?? error.message.replace(/^Uncaught Error:\s*/, '');
}

export default function DrawingCanvas({
  roomId,
  sessionToken,
  memberId,
  displayName,
  memberColors,
  strokes,
  color,
  width,
  drawingControls,
  disabled = false,
  onError,
}: DrawingCanvasProps) {
  const startStroke = useMutation(api.drawing.start);
  const appendPoints = useMutation(api.drawing.append);
  const finishStroke = useMutation(api.drawing.finish);
  const { remoteCursors, updateCursor } = useCursorPresence({ roomId, memberId, sessionToken });
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef<ActiveStroke | null>(null);
  const panRef = useRef<PanGesture | null>(null);
  const cameraInitializedRef = useRef(false);
  const spacePanningRef = useRef(false);
  const [, setRevision] = useState(0);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 1, height: 1, pixelRatio: 1 });
  const [camera, setCamera] = useState<Camera>({
    centerX: WORLD_WIDTH / 2,
    centerY: WORLD_HEIGHT / 2,
    zoom: 1,
  });
  const [tool, setTool] = useState<'draw' | 'pan'>(disabled ? 'pan' : 'draw');
  const [spacePanning, setSpacePanning] = useState(false);
  const [pointerPanning, setPointerPanning] = useState(false);

  const redrawActive = useCallback(() => {
    setRevision((revision) => revision + 1);
  }, []);

  const abandonActiveStroke = useCallback(
    (error: unknown) => {
      activeRef.current = null;
      redrawActive();
      onError(messageFromError(error));
    },
    [onError, redrawActive]
  );

  const pumpPoints = useCallback(() => {
    const active = activeRef.current;
    if (!active?.strokeId || active.sending || active.finishing || active.serverFinished) {
      return;
    }

    if (active.sentCount < active.points.length) {
      const expectedPointCount = active.sentCount;
      const points = active.points.slice(expectedPointCount, expectedPointCount + POINTS_PER_BATCH);
      active.sending = true;

      void appendPoints({
        strokeId: active.strokeId,
        sessionToken,
        expectedPointCount,
        points,
      })
        .then(({ pointCount }) => {
          if (activeRef.current !== active) {
            return;
          }
          active.sentCount = pointCount;
          active.sending = false;
          pumpPoints();
        })
        .catch(abandonActiveStroke);
      return;
    }

    if (active.ended) {
      active.finishing = true;
      void finishStroke({ strokeId: active.strokeId, sessionToken })
        .then(() => {
          if (activeRef.current !== active) {
            return;
          }
          active.finishing = false;
          active.serverFinished = true;
          redrawActive();
        })
        .catch(abandonActiveStroke);
    }
  }, [abandonActiveStroke, appendPoints, finishStroke, redrawActive, sessionToken]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const syncSize = () => {
      const rect = frame.getBoundingClientRect();
      setCanvasSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      });
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (canvasSize.width < 100 || canvasSize.height < 100) {
      return;
    }

    if (!cameraInitializedRef.current) {
      cameraInitializedRef.current = true;
      setCamera({
        centerX: WORLD_WIDTH / 2,
        centerY: WORLD_HEIGHT / 2,
        zoom: fitZoom(canvasSize),
      });
      return;
    }

    setCamera((current) => clampCamera(current, canvasSize));
  }, [canvasSize]);

  useEffect(() => {
    if (disabled) {
      setTool('pan');
    }
  }, [disabled]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      spacePanningRef.current = true;
      setSpacePanning(true);
    };

    const releaseSpace = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return;
      }
      spacePanningRef.current = false;
      setSpacePanning(false);
    };

    const handleBlur = () => {
      spacePanningRef.current = false;
      setSpacePanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', releaseSpace);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', releaseSpace);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const active = activeRef.current;
    if (!active?.strokeId || !active.serverFinished) {
      return;
    }

    const savedStroke = strokes.find((stroke) => stroke.strokeId === active.strokeId);
    if (savedStroke?.status === 'finished' && savedStroke.pointCount >= active.points.length) {
      activeRef.current = null;
      redrawActive();
    }
  }, [redrawActive, strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const { width: cssWidth, height: cssHeight, pixelRatio } = canvasSize;
    const pixelWidth = Math.round(cssWidth * pixelRatio);
    const pixelHeight = Math.round(cssHeight * pixelRatio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const renderableStrokes = getRenderableStrokes(strokes, activeRef.current, memberId, displayName);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    context.fillStyle = '#e7ecf5';
    context.fillRect(0, 0, cssWidth, cssHeight);
    context.save();
    context.translate(cssWidth / 2, cssHeight / 2);
    context.scale(camera.zoom, camera.zoom);
    context.translate(-camera.centerX, -camera.centerY);
    drawWorld(context, renderableStrokes, camera.zoom);
    context.restore();

    const minimap = minimapRef.current;
    if (minimap) {
      drawMinimap(minimap, renderableStrokes, camera, canvasSize);
    }
  });

  function pointFromPointer(event: ReactPointerEvent<HTMLCanvasElement>): DrawingPoint | null {
    const rect = event.currentTarget.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldX = camera.centerX + (screenX - canvasSize.width / 2) / camera.zoom;
    const worldY = camera.centerY + (screenY - canvasSize.height / 2) / camera.zoom;

    if (worldX < 0 || worldX > WORLD_WIDTH || worldY < 0 || worldY > WORLD_HEIGHT) {
      return null;
    }

    return {
      x: worldX / WORLD_WIDTH,
      y: worldY / WORLD_HEIGHT,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    updateCursor(pointFromPointer(event));
    const wantsToPan = tool === 'pan' || spacePanningRef.current || event.button === 1;
    if (wantsToPan && !activeRef.current) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCamera: camera,
      };
      setPointerPanning(true);
      return;
    }

    if (disabled || activeRef.current || event.button !== 0) {
      return;
    }

    const point = pointFromPointer(event);
    if (!point) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const active: ActiveStroke = {
      localId: crypto.randomUUID(),
      strokeId: null,
      sequence: Number.MAX_SAFE_INTEGER,
      points: [point],
      sentCount: 0,
      sending: false,
      ended: false,
      finishing: false,
      serverFinished: false,
      color,
      width,
    };
    activeRef.current = active;
    redrawActive();

    void startStroke({ roomId, sessionToken, color, width, point })
      .then(({ strokeId, sequence }) => {
        if (activeRef.current !== active) {
          return;
        }
        active.strokeId = strokeId;
        active.sequence = sequence;
        active.sentCount = 1;
        redrawActive();
        pumpPoints();
      })
      .catch(abandonActiveStroke);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const pointerPoint = pointFromPointer(event);
    updateCursor(pointerPoint);

    const pan = panRef.current;
    if (pan?.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      const deltaX = event.clientX - pan.startClientX;
      const deltaY = event.clientY - pan.startClientY;
      setCamera(
        clampCamera(
          {
            ...pan.startCamera,
            centerX: pan.startCamera.centerX - deltaX / pan.startCamera.zoom,
            centerY: pan.startCamera.centerY - deltaY / pan.startCamera.zoom,
          },
          canvasSize
        )
      );
      return;
    }

    const active = activeRef.current;
    if (!active || active.ended || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const nextPoint = pointerPoint;
    const previousPoint = active.points.at(-1);
    if (!nextPoint || !previousPoint) {
      return;
    }

    const distance = Math.hypot(
      (nextPoint.x - previousPoint.x) * WORLD_WIDTH * camera.zoom,
      (nextPoint.y - previousPoint.y) * WORLD_HEIGHT * camera.zoom
    );
    if (distance < 2.5) {
      return;
    }

    active.points.push(nextPoint);
    if (active.points.length >= MAX_POINTS_PER_STROKE) {
      active.ended = true;
    }
    redrawActive();
    pumpPoints();
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
      setPointerPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    const active = activeRef.current;
    if (!active) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    active.ended = true;
    redrawActive();
    pumpPoints();
  }

  function handleWheel(event: ReactWheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;

    if (event.ctrlKey || event.metaKey) {
      zoomAt(screenX, screenY, camera.zoom * Math.exp(-event.deltaY * 0.008));
      return;
    }

    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvasSize.height : 1;
    const horizontalDelta = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
    setCamera((current) =>
      clampCamera(
        {
          ...current,
          centerX: current.centerX + (horizontalDelta * unit) / current.zoom,
          centerY: current.centerY + (event.shiftKey ? 0 : event.deltaY * unit) / current.zoom,
        },
        canvasSize
      )
    );
  }

  function zoomAt(screenX: number, screenY: number, requestedZoom: number) {
    setCamera((current) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, requestedZoom));
      const worldX = current.centerX + (screenX - canvasSize.width / 2) / current.zoom;
      const worldY = current.centerY + (screenY - canvasSize.height / 2) / current.zoom;
      return clampCamera(
        {
          centerX: worldX - (screenX - canvasSize.width / 2) / nextZoom,
          centerY: worldY - (screenY - canvasSize.height / 2) / nextZoom,
          zoom: nextZoom,
        },
        canvasSize
      );
    });
  }

  function zoomFromCenter(factor: number) {
    zoomAt(canvasSize.width / 2, canvasSize.height / 2, camera.zoom * factor);
  }

  function fitView() {
    setCamera({
      centerX: WORLD_WIDTH / 2,
      centerY: WORLD_HEIGHT / 2,
      zoom: fitZoom(canvasSize),
    });
  }

  function moveFromMinimap(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH;
    const centerY = ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT;
    setCamera((current) => clampCamera({ ...current, centerX, centerY }, canvasSize));
  }

  function handleMinimapPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    moveFromMinimap(event);
  }

  function handleMinimapPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      moveFromMinimap(event);
    }
  }

  const panningEnabled = tool === 'pan' || spacePanning;
  const showMinimap = cameraInitializedRef.current && !isEntireWorldVisible(camera, canvasSize);

  return (
    <>
      <div className="drawing-toolbar" role="toolbar" aria-label="Drawing and canvas tools">
        {drawingControls}
        <span className="toolbar-divider toolbar-view-divider" />
        <div className="canvas-navigation">
          <span className="tool-label">View</span>
          <div className="canvas-tool-toggle">
            <button
              type="button"
              data-active={tool === 'draw' && !spacePanning}
              onClick={() => setTool('draw')}
              disabled={disabled}
              aria-label="Draw on the canvas"
              aria-pressed={tool === 'draw'}
              title="Draw"
            >
              <Pencil aria-hidden="true" />
            </button>
            <button
              type="button"
              data-active={tool === 'pan' || spacePanning}
              onClick={() => setTool('pan')}
              aria-label="Move around the canvas"
              aria-pressed={tool === 'pan'}
              title="Hand tool (or hold Space)"
            >
              <Hand aria-hidden="true" />
            </button>
          </div>
          <span className="canvas-navigation-divider" />
          <button type="button" onClick={() => zoomFromCenter(0.8)} aria-label="Zoom out" title="Zoom out">
            <Minus aria-hidden="true" />
          </button>
          <output className="canvas-zoom-value" aria-label="Current zoom">
            {Math.round(camera.zoom * 100)}%
          </output>
          <button type="button" onClick={() => zoomFromCenter(1.25)} aria-label="Zoom in" title="Zoom in">
            <Plus aria-hidden="true" />
          </button>
          <button type="button" onClick={fitView} aria-label="Fit drawing in view" title="Fit drawing in view">
            <Maximize2 aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="drawing-frame" ref={frameRef}>
        <canvas
          ref={canvasRef}
          className={`drawing-canvas${panningEnabled ? ' is-pan-tool' : ''}${pointerPanning ? ' is-panning' : ''}`}
          aria-label={disabled ? 'Shared drawing canvas, read only' : 'Shared drawing canvas'}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={() => updateCursor(null)}
          onWheel={handleWheel}
        />

        <div className="remote-cursors" aria-hidden="true">
          {remoteCursors.map((cursor) => {
            const position = cursorScreenPosition(cursor, camera, canvasSize);
            return (
              <RemoteCursorMarker
                color={cursorColor(cursor.memberId, memberColors)}
                cursor={cursor}
                key={cursor.memberId}
                target={position}
              />
            );
          })}
        </div>

        {strokes.length === 0 && !activeRef.current ? (
          <div className="canvas-empty" aria-hidden="true">
            <span>Make the first mark</span>
            <svg viewBox="0 0 86 54">
              <title>Arrow pointing to the canvas</title>
              <path d="M4 14 C 24 0, 45 42, 80 18" />
              <path d="m72 10 10 7-7 10" />
            </svg>
          </div>
        ) : null}

        {showMinimap ? (
          <div className="canvas-minimap">
            <span>Map</span>
            <canvas
              ref={minimapRef}
              aria-label="Canvas minimap. Drag to move around the drawing."
              onPointerDown={handleMinimapPointerDown}
              onPointerMove={handleMinimapPointerMove}
            />
          </div>
        ) : null}

        {!disabled ? (
          <div className="canvas-shortcut-hint">
            Hold <kbd>Space</kbd> and drag to move · Pinch or <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + scroll to zoom
          </div>
        ) : null}
      </div>
    </>
  );
}

function RemoteCursorMarker({
  color,
  cursor,
  target,
}: {
  color: string;
  cursor: RemoteCursor;
  target: { x: number; y: number };
}) {
  const markerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef(target);
  const targetRef = useRef(target);
  const lastFrameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animateRef = useRef<(time: number) => void>(() => undefined);

  targetRef.current = target;
  animateRef.current = (time: number) => {
    const marker = markerRef.current;
    if (marker === null) {
      animationFrameRef.current = null;
      return;
    }

    const previousTime = lastFrameRef.current ?? time;
    const elapsed = Math.min(64, time - previousTime);
    const interpolation = cursorInterpolation(elapsed);
    const next = {
      x: currentRef.current.x + (targetRef.current.x - currentRef.current.x) * interpolation,
      y: currentRef.current.y + (targetRef.current.y - currentRef.current.y) * interpolation,
    };
    currentRef.current = next;
    lastFrameRef.current = time;
    marker.style.transform = `translate3d(${next.x - 3}px, ${next.y - 2}px, 0)`;

    if (Math.hypot(targetRef.current.x - next.x, targetRef.current.y - next.y) < 0.1) {
      currentRef.current = targetRef.current;
      marker.style.transform = `translate3d(${targetRef.current.x - 3}px, ${targetRef.current.y - 2}px, 0)`;
      animationFrameRef.current = null;
      lastFrameRef.current = null;
      return;
    }
    animationFrameRef.current = window.requestAnimationFrame(animateRef.current);
  };

  useEffect(() => {
    if (animationFrameRef.current === null) {
      animationFrameRef.current = window.requestAnimationFrame(animateRef.current);
    }
  });

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        lastFrameRef.current = null;
      }
    },
    []
  );

  return (
    <div
      className="remote-cursor"
      ref={markerRef}
      style={
        {
          '--remote-cursor-color': color,
          transform: `translate3d(${currentRef.current.x - 3}px, ${currentRef.current.y - 2}px, 0)`,
        } as CSSProperties
      }
    >
      <svg viewBox="0 0 24 30" aria-hidden="true">
        <path d="M3 2 20 17l-8 .8-4.2 8.4z" />
      </svg>
      <span>{cursor.displayName}</span>
    </div>
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName);
}

export function fitZoom(size: CanvasSize) {
  const horizontalRoom = Math.max(1, size.width - 56);
  const verticalRoom = Math.max(1, size.height - 56);
  return Math.min(1, Math.max(MIN_ZOOM, Math.min(horizontalRoom / WORLD_WIDTH, verticalRoom / WORLD_HEIGHT)));
}

export function isEntireWorldVisible(camera: Camera, size: CanvasSize) {
  return size.width / camera.zoom >= WORLD_WIDTH && size.height / camera.zoom >= WORLD_HEIGHT;
}

export function clampCamera(camera: Camera, size: CanvasSize): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom));
  const visibleWidth = size.width / zoom;
  const visibleHeight = size.height / zoom;
  const centerX =
    visibleWidth >= WORLD_WIDTH
      ? WORLD_WIDTH / 2
      : Math.min(WORLD_WIDTH - visibleWidth / 2, Math.max(visibleWidth / 2, camera.centerX));
  const centerY =
    visibleHeight >= WORLD_HEIGHT
      ? WORLD_HEIGHT / 2
      : Math.min(WORLD_HEIGHT - visibleHeight / 2, Math.max(visibleHeight / 2, camera.centerY));

  return { centerX, centerY, zoom };
}

export function cursorScreenPosition(point: DrawingPoint, camera: Camera, size: CanvasSize) {
  return {
    x: (point.x * WORLD_WIDTH - camera.centerX) * camera.zoom + size.width / 2,
    y: (point.y * WORLD_HEIGHT - camera.centerY) * camera.zoom + size.height / 2,
  };
}

export function cursorInterpolation(elapsedMs: number) {
  return 1 - Math.exp(-Math.max(0, elapsedMs) / 85);
}

export function cursorColor(memberId: string, memberColors: Record<string, string> = {}) {
  const assignedColor = memberColors[memberId];
  if (assignedColor !== undefined) {
    return assignedColor;
  }

  const colors = ['#3155d9', '#e94f45', '#1f9b69', '#7a4ed3', '#c57d11', '#187ca3'];
  let hash = 0;
  for (const character of memberId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return colors[hash % colors.length];
}

function getRenderableStrokes(
  strokes: CanvasStroke[],
  active: ActiveStroke | null,
  memberId: Id<'roomMembers'>,
  displayName: string
): RenderableStroke[] {
  const visibleStrokes: Array<CanvasStroke | (Omit<CanvasStroke, 'strokeId' | 'status'> & { strokeId: string })> =
    active?.strokeId ? strokes.filter((stroke) => stroke.strokeId !== active.strokeId) : [...strokes];

  if (active) {
    visibleStrokes.push({
      strokeId: active.strokeId ?? active.localId,
      sequence: active.sequence,
      author: { memberId, displayName },
      color: active.color,
      width: active.width,
      points: active.points,
      pointCount: active.points.length,
    });
  }

  return visibleStrokes.sort((first, second) => first.sequence - second.sequence);
}

function drawWorld(context: CanvasRenderingContext2D, strokes: RenderableStroke[], zoom: number) {
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  context.beginPath();
  for (let x = GRID_SIZE; x < WORLD_WIDTH; x += GRID_SIZE) {
    context.moveTo(x, 0);
    context.lineTo(x, WORLD_HEIGHT);
  }
  for (let y = GRID_SIZE; y < WORLD_HEIGHT; y += GRID_SIZE) {
    context.moveTo(0, y);
    context.lineTo(WORLD_WIDTH, y);
  }
  context.strokeStyle = '#e2e7ef';
  context.lineWidth = 1 / zoom;
  context.stroke();

  for (const stroke of strokes) {
    drawStroke(context, stroke.points, stroke.color, stroke.width);
  }

  context.strokeStyle = '#c6d0df';
  context.lineWidth = 1.5 / zoom;
  context.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawMinimap(canvas: HTMLCanvasElement, strokes: RenderableStroke[], camera: Camera, canvasSize: CanvasSize) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return;
  }

  const pixelRatio = canvasSize.pixelRatio;
  const pixelWidth = Math.round(rect.width * pixelRatio);
  const pixelHeight = Math.round(rect.height * pixelRatio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const scaleX = rect.width / WORLD_WIDTH;
  const scaleY = rect.height / WORLD_HEIGHT;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, rect.width, rect.height);
  context.save();
  context.scale(scaleX, scaleY);
  for (const stroke of strokes) {
    drawStroke(context, stroke.points, stroke.color, Math.max(stroke.width, 1.4 / Math.min(scaleX, scaleY)));
  }
  context.restore();

  const visibleWorldWidth = Math.min(WORLD_WIDTH, canvasSize.width / camera.zoom);
  const visibleWorldHeight = Math.min(WORLD_HEIGHT, canvasSize.height / camera.zoom);
  const viewportLeft = Math.max(0, camera.centerX - visibleWorldWidth / 2) * scaleX;
  const viewportTop = Math.max(0, camera.centerY - visibleWorldHeight / 2) * scaleY;
  const viewportWidth = visibleWorldWidth * scaleX;
  const viewportHeight = visibleWorldHeight * scaleY;

  context.fillStyle = 'rgb(23 32 58 / 12%)';
  context.fillRect(0, 0, rect.width, viewportTop);
  context.fillRect(0, viewportTop + viewportHeight, rect.width, rect.height - viewportTop - viewportHeight);
  context.fillRect(0, viewportTop, viewportLeft, viewportHeight);
  context.fillRect(
    viewportLeft + viewportWidth,
    viewportTop,
    rect.width - viewportLeft - viewportWidth,
    viewportHeight
  );
  context.strokeStyle = '#3155d9';
  context.lineWidth = 2;
  context.strokeRect(
    viewportLeft + 1,
    viewportTop + 1,
    Math.max(0, viewportWidth - 2),
    Math.max(0, viewportHeight - 2)
  );
}

function drawStroke(context: CanvasRenderingContext2D, points: DrawingPoint[], color: string, width: number) {
  if (points.length === 0) {
    return;
  }

  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0].x * WORLD_WIDTH, points[0].y * WORLD_HEIGHT, width / 2, 0, Math.PI * 2);
    context.fill();
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x * WORLD_WIDTH, points[0].y * WORLD_HEIGHT);
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midpointX = ((current.x + next.x) / 2) * WORLD_WIDTH;
    const midpointY = ((current.y + next.y) / 2) * WORLD_HEIGHT;
    context.quadraticCurveTo(current.x * WORLD_WIDTH, current.y * WORLD_HEIGHT, midpointX, midpointY);
  }
  const finalPoint = points.at(-1);
  if (finalPoint) {
    context.lineTo(finalPoint.x * WORLD_WIDTH, finalPoint.y * WORLD_HEIGHT);
  }
  context.stroke();
}
