import type { api } from '@convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';
import { BatteryCharging, Crosshair, Route } from 'lucide-react';
import {
  type ComponentProps,
  lazy,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  Suspense,
  useMemo,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const miniGameWorldMapModule = import('./MiniGameWorldMap');
const MiniGameWorldMap = lazy(() => miniGameWorldMapModule);

type GameView = FunctionReturnType<typeof api.miniGames.getGame>;
type MiniGameRound = NonNullable<GameView['round']>;
type Point = { x: number; y: number };

const CHART_COLORS = {
  coral: { fill: '#ee6b4d', label: 'coral' },
  gold: { fill: '#f5c84b', label: 'gold' },
  mint: { fill: '#63c99a', label: 'mint' },
  blue: { fill: '#5b82e8', label: 'blue' },
} as const;

function WorldMapSurface(props: ComponentProps<typeof MiniGameWorldMap>) {
  return (
    <Suspense
      fallback={
        <div
          className={cn('grid place-items-end bg-[#dff3f5] p-3', props.className)}
          role="status"
          aria-label="Loading world map"
        >
          <span className="rounded-full border border-[#17203a]/20 bg-white/90 px-2.5 py-1 text-[9px] font-[760] text-[#53627a]">
            Loading map…
          </span>
        </div>
      }
    >
      <MiniGameWorldMap {...props} />
    </Suspense>
  );
}

function pointFromPointer(event: ReactPointerEvent<HTMLElement>): Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(1, bounds.width))),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / Math.max(1, bounds.height))),
  };
}

function movePoint(point: Point, event: ReactKeyboardEvent<HTMLElement>) {
  const change = event.shiftKey ? 0.05 : 0.015;
  const direction =
    event.key === 'ArrowLeft'
      ? { x: -change, y: 0 }
      : event.key === 'ArrowRight'
        ? { x: change, y: 0 }
        : event.key === 'ArrowUp'
          ? { x: 0, y: -change }
          : event.key === 'ArrowDown'
            ? { x: 0, y: change }
            : null;
  if (direction === null) return null;
  event.preventDefault();
  return {
    x: Math.min(1, Math.max(0, point.x + direction.x)),
    y: Math.min(1, Math.max(0, point.y + direction.y)),
  };
}

function EstimateControl({
  kind,
  unit,
  disabled,
  onSubmit,
}: {
  kind: 'percentage' | 'distance';
  unit: string;
  disabled: boolean;
  onSubmit: (guess: number) => void;
}) {
  const [guess, setGuess] = useState('');
  const isPercentage = kind === 'percentage';
  const maximum = isPercentage ? 100 : 25_000;
  const numericGuess = guess === '' ? null : Number(guess);
  const hasValidGuess =
    numericGuess !== null && Number.isFinite(numericGuess) && numericGuess >= 0 && numericGuess <= maximum;
  return (
    <form
      className="mx-auto mt-5 grid w-full max-w-xl grid-cols-[minmax(132px,1fr)_auto] items-end gap-3 rounded-[18px_12px_20px_14px] border-2 border-[#17203a] bg-white p-4 shadow-[5px_5px_0_#b8c8e5] max-[520px]:grid-cols-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && hasValidGuess) onSubmit(numericGuess);
      }}
    >
      <div className="grid gap-2 text-[10px] font-[850] tracking-[0.12em] text-[#53627a] uppercase">
        <label htmlFor={`mini-game-estimate-${kind}`}>Your estimate</label>
        <span className="relative block">
          <input
            className={cn(
              'h-16 w-full rounded-lg border-2 border-[#17203a] bg-[#fffdf5] px-4 font-display font-[850] text-[#17203a] tabular-nums outline-none [appearance:textfield] focus:border-[#3155d9] focus:ring-3 focus:ring-[#3155d9]/20 [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
              isPercentage ? 'min-w-33 pr-12 text-3xl' : 'min-w-0 pr-28 text-2xl'
            )}
            type="number"
            id={`mini-game-estimate-${kind}`}
            min="0"
            max={maximum}
            step="1"
            inputMode="numeric"
            value={guess}
            autoComplete="off"
            required
            disabled={disabled}
            onChange={(event) => setGuess(event.currentTarget.value)}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-[760] tracking-normal text-[#68758b] normal-case">
            {isPercentage ? '%' : unit}
          </span>
        </span>
      </div>
      <Button className="h-16 min-w-30" type="submit" variant="brand" disabled={disabled || !hasValidGuess}>
        Lock it in
      </Button>
    </form>
  );
}

function PercentageChallenge({
  round,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onSubmit: (guess: number) => void;
}) {
  let cursor = 0;
  const gradient = round.percentageSegments
    .map((segment) => {
      const start = cursor;
      cursor += segment.percentage;
      return `${CHART_COLORS[segment.color].fill} ${start}% ${cursor}%`;
    })
    .join(', ');
  const target = round.percentageTargetColor === null ? CHART_COLORS.coral : CHART_COLORS[round.percentageTargetColor];
  return (
    <div className="grid min-h-[420px] place-content-center rounded-[20px_13px_22px_15px] border-2 border-[#17203a] bg-[#f7f1ff] p-5 shadow-[5px_5px_0_#cab9ef]">
      <div className="mx-auto grid w-full max-w-2xl grid-cols-[minmax(180px,280px)_minmax(0,1fr)] items-center gap-[clamp(24px,6vw,70px)] max-[620px]:grid-cols-1">
        <div
          className="aspect-square w-full rotate-[-4deg] rounded-full border-[10px] border-white shadow-[0_0_0_3px_#17203a,10px_11px_0_#17203a]"
          style={{ background: `conic-gradient(from -18deg, ${gradient})` }}
          role="img"
          aria-label="A three-color pie chart"
        />
        <div className="text-center max-[620px]:pt-2">
          <span className="text-[10px] font-[850] tracking-[0.15em] text-[#685693] uppercase">
            Estimate the share of
          </span>
          <strong className="mt-2 flex items-center justify-center gap-2 font-display text-[clamp(34px,7vw,62px)] leading-none font-[900] tracking-[-0.06em] capitalize">
            <span className="size-5 rounded-full border-2 border-[#17203a]" style={{ backgroundColor: target.fill }} />
            {target.label}
          </strong>
          <EstimateControl kind="percentage" unit="percent" disabled={disabled} onSubmit={onSubmit} />
        </div>
      </div>
    </div>
  );
}

function BatteryChallenge({
  round,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onSubmit: (guess: number) => void;
}) {
  const fill = round.batteryPercentage ?? 50;
  return (
    <div className="grid min-h-[420px] place-content-center overflow-hidden rounded-[20px_13px_22px_15px] border-2 border-[#17203a] bg-[#dff7e8] p-5 shadow-[5px_5px_0_#88c7a5]">
      <div className="w-[min(82vw,650px)] text-center">
        <BatteryCharging className="mx-auto mb-3 size-8 text-[#16815f]" aria-hidden="true" />
        <div className="relative mx-auto h-40 w-[min(78vw,490px)] rounded-[30px_20px_32px_22px] border-[7px] border-[#17203a] bg-white p-2 shadow-[10px_11px_0_#17203a] before:absolute before:top-1/2 before:-right-8 before:h-17 before:w-7 before:-translate-y-1/2 before:rounded-r-xl before:border-[6px] before:border-l-0 before:border-[#17203a] before:bg-[#f4f7fb]">
          <div className="relative h-full overflow-hidden rounded-[18px_10px_20px_12px] bg-[#e6ebf2]">
            <div
              className="absolute inset-y-0 left-0 bg-[#53d889] bg-[linear-gradient(110deg,transparent_25%,rgb(255_255_255/35%)_26%,transparent_48%)] transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${fill}%` }}
            />
          </div>
        </div>
        <p className="mt-6 mb-0 font-display text-2xl font-[850] tracking-[-0.04em]">How much charge is left?</p>
        <EstimateControl kind="percentage" unit="percent" disabled={disabled} onSubmit={onSubmit} />
      </div>
    </div>
  );
}

function CircleChallenge({
  round,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onSubmit: (point: Point) => void;
}) {
  const [marker, setMarker] = useState<Point>({ x: 0.5, y: 0.5 });
  const target = round.circleTarget;
  if (target === null) return null;
  return (
    <button
      type="button"
      className="relative block aspect-[16/9] min-h-86 w-full touch-none overflow-hidden rounded-[20px_13px_22px_15px] border-2 border-[#17203a] bg-[#fff6da] shadow-[5px_5px_0_#e2bf56] outline-none focus-visible:ring-4 focus-visible:ring-[#3155d9]/30"
      aria-label="Place a marker at the center of the broken circle"
      disabled={disabled}
      onPointerDown={(event) => {
        if (!disabled) onSubmit(pointFromPointer(event));
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        const next = movePoint(marker, event);
        if (next !== null) setMarker(next);
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSubmit(marker);
        }
      }}
    >
      <span className="absolute top-4 left-4 flex items-center gap-2 rounded-full border border-[#d3b547] bg-white/80 px-3 py-1.5 text-[10px] font-[820] tracking-[0.1em] text-[#796116] uppercase">
        <Crosshair className="size-3.5" /> Tap the center to lock
      </span>
      <svg className="absolute inset-0 size-full" viewBox="0 0 1000 562" aria-hidden="true">
        <circle
          cx={target.center.x * 1000}
          cy={target.center.y * 562}
          r={target.radius * 562}
          fill="none"
          stroke="#17203a"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray="420 82 115 48"
          transform={`rotate(${target.gapRotation} ${target.center.x * 1000} ${target.center.y * 562})`}
        />
        <circle
          cx={target.center.x * 1000 + 5}
          cy={target.center.y * 562 - 3}
          r={target.radius * 562 - 18}
          fill="none"
          stroke="#e65d3d"
          strokeWidth="3"
          strokeDasharray="70 28"
          opacity=".45"
        />
      </svg>
      <span
        className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#3155d9] shadow-[0_0_0_3px_#17203a] transition-[left,top] motion-reduce:transition-none"
        style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
      />
    </button>
  );
}

function DistanceChallenge({
  round,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onSubmit: (guess: number) => void;
}) {
  const places = round.distancePlaces;
  const mapPoints = useMemo(() => (places === null ? [] : [places.first, places.second]), [places]);
  if (places === null) return null;
  return (
    <div>
      <div className="relative aspect-[2/1] min-h-72 overflow-hidden rounded-[20px_13px_22px_15px] border-2 border-[#17203a] shadow-[5px_5px_0_#7eb6c0]">
        <WorldMapSurface className="absolute inset-0" labeledPoints={mapPoints} showRoute />
        <span className="absolute top-3 left-3 flex items-center gap-2 rounded-full border border-[#17203a] bg-white px-3 py-1.5 text-[10px] font-[820] tracking-[0.1em] uppercase">
          <Route className="size-3.5 text-[#e85d2a]" /> Great-circle distance
        </span>
      </div>
      <EstimateControl kind="distance" unit={places.unit} disabled={disabled} onSubmit={onSubmit} />
    </div>
  );
}

function MapPointChallenge({
  round,
  disabled,
  onSubmit,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onSubmit: (point: Point) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-3 text-center">
        <span className="text-[10px] font-[850] tracking-[0.14em] text-[#53627a] uppercase">Drop your pin on</span>
        <strong className="font-display text-[clamp(28px,6vw,46px)] font-[900] tracking-[-0.055em] text-[#17203a]">
          {round.mapTargetName}
        </strong>
      </div>
      <WorldMapSurface
        className="relative aspect-[2/1] min-h-72 touch-none overflow-hidden rounded-[20px_13px_22px_15px] border-2 border-[#17203a] shadow-[5px_5px_0_#7eb6c0] outline-none focus-visible:ring-4 focus-visible:ring-[#3155d9]/30"
        ariaLabel={`Place a pin near ${round.mapTargetName ?? 'the named city'}`}
        disabled={disabled}
        onPick={onSubmit}
      />
      <p className="mt-3 mb-0 text-center text-xs font-[720] text-[#53627a]">Tap or click once to drop your pin.</p>
    </div>
  );
}

export default function MiniGameChallenge({
  round,
  disabled,
  onEstimate,
  onCirclePoint,
  onMapPoint,
}: {
  round: MiniGameRound;
  disabled: boolean;
  onEstimate: (guess: number) => void;
  onCirclePoint: (point: Point) => void;
  onMapPoint: (point: Point) => void;
}) {
  switch (round.miniGame.id) {
    case 'guessPercentage':
      return <PercentageChallenge round={round} disabled={disabled} onSubmit={onEstimate} />;
    case 'batteryPercentage':
      return <BatteryChallenge round={round} disabled={disabled} onSubmit={onEstimate} />;
    case 'circleCenter':
      return <CircleChallenge round={round} disabled={disabled} onSubmit={onCirclePoint} />;
    case 'guessDistance':
      return <DistanceChallenge round={round} disabled={disabled} onSubmit={onEstimate} />;
    case 'pointOnMap':
      return <MapPointChallenge round={round} disabled={disabled} onSubmit={onMapPoint} />;
    case 'straightLine':
    case 'orangeEmojis':
      return null;
    default:
      return null;
  }
}

export type { Point as MiniGamePoint };
