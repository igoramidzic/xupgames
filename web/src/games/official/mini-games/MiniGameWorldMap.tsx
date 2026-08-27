import { AttributionControl, Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  clientPointToMapPixel,
  fallbackPixelToNormalizedPoint,
  greatCircleRouteSegments,
  type LngLatPoint,
  lngLatToFallbackViewport,
  lngLatToNormalizedPoint,
  type MapViewport,
  type NormalizedPoint,
  normalizedPointToLngLat,
} from './MiniGameWorldMapGeometry';

setWorkerUrl(mapLibreWorkerUrl);

type LabeledPoint = NormalizedPoint & { name: string };

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const MAP_FALLBACK_TILES = [
  'https://tiles.openfreemap.org/natural_earth/ne2sr/1/0/0.png',
  'https://tiles.openfreemap.org/natural_earth/ne2sr/1/1/0.png',
  'https://tiles.openfreemap.org/natural_earth/ne2sr/1/0/1.png',
  'https://tiles.openfreemap.org/natural_earth/ne2sr/1/1/1.png',
];
const EMPTY_LABELED_POINTS: LabeledPoint[] = [];

export default function MiniGameWorldMap({
  ariaLabel,
  className,
  disabled = false,
  labeledPoints = EMPTY_LABELED_POINTS,
  showRoute = false,
  onPick,
}: {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  labeledPoints?: LabeledPoint[];
  showRoute?: boolean;
  onPick?: (point: NormalizedPoint) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [pickedPoint, setPickedPoint] = useState<NormalizedPoint | null>(null);
  const [viewport, setViewport] = useState<MapViewport>({ width: 512, height: 256 });

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || typeof WebGLRenderingContext === 'undefined') return;

    const width = Math.max(320, container.clientWidth);
    const map = new MapLibreMap({
      container,
      style: MAP_STYLE_URL,
      center: [0, 0],
      zoom: Math.max(0, Math.log2(width / 512)),
      minZoom: 0,
      maxZoom: 4,
      interactive: false,
      renderWorldCopies: false,
      attributionControl: false,
      fadeDuration: 0,
    });
    mapRef.current = map;
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    map.getCanvas().setAttribute('aria-label', 'OpenStreetMap world map');
    map.getCanvas().setAttribute('tabindex', '-1');

    const updateViewport = () => {
      map.resize();
      setViewport({
        width: Math.max(1, container.clientWidth),
        height: Math.max(1, container.clientHeight),
      });
    };
    updateViewport();
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(container);

    const makeBackgroundTransparent = () => {
      if (map.getLayer('background') !== undefined) {
        map.setPaintProperty('background', 'background-opacity', 0);
      }
    };
    const markReady = () => {
      makeBackgroundTransparent();
      setMapReady(true);
    };
    map.on('style.load', makeBackgroundTransparent);
    map.once('load', markReady);

    return () => {
      map.off('style.load', makeBackgroundTransparent);
      map.off('load', markReady);
      mapRef.current = null;
      resizeObserver.disconnect();
      map.remove();
    };
  }, []);

  function choosePoint(event: PointerEvent<HTMLDivElement>) {
    if (disabled || onPick === undefined) return;
    if (event.target instanceof Element && event.target.closest('.maplibregl-ctrl') !== null) return;
    const container = containerRef.current;
    if (container === null) return;
    const containerBounds = container.getBoundingClientRect();
    const surfaceBounds = event.currentTarget.getBoundingClientRect();
    const renderedBounds = containerBounds.width > 0 && containerBounds.height > 0 ? containerBounds : surfaceBounds;
    const currentViewport = {
      width: Math.max(1, container.clientWidth || renderedBounds.width),
      height: Math.max(1, container.clientHeight || renderedBounds.height),
    };
    const pixel = clientPointToMapPixel(event.clientX, event.clientY, renderedBounds, currentViewport);
    const map = mapRef.current;
    const point =
      map === null
        ? fallbackPixelToNormalizedPoint(pixel.x, pixel.y, currentViewport)
        : (() => {
            map.resize();
            const location = map.unproject([pixel.x, pixel.y]);
            return lngLatToNormalizedPoint(location.lng, location.lat);
          })();
    setPickedPoint(point);
    onPick(point);
  }

  function chooseCenter(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || onPick === undefined || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    const map = mapRef.current;
    const center = map?.getCenter();
    const point = center === undefined ? { x: 0.5, y: 0.5 } : lngLatToNormalizedPoint(center.lng, center.lat);
    setPickedPoint(point);
    onPick(point);
  }

  const mapClassName = cn(
    'relative isolate overflow-hidden bg-[#dff3f5] [&_.maplibregl-ctrl-attrib]:text-[9px] [&_.maplibregl-ctrl-attrib]:leading-tight',
    onPick !== undefined &&
      'cursor-crosshair outline-none focus-visible:ring-4 focus-visible:ring-[#3155d9]/30 data-[disabled=true]:cursor-default',
    className
  );
  const projectLngLat = (coordinates: LngLatPoint) => {
    const map = mapRef.current;
    if (map === null) return lngLatToFallbackViewport(coordinates, viewport);
    const projected = map.project([coordinates[0], coordinates[1]]);
    return { x: projected.x, y: projected.y };
  };
  const displayedLabeledPoints = labeledPoints.map((point) => ({
    ...point,
    viewport: projectLngLat(normalizedPointToLngLat(point)),
  }));
  const displayedPickedPoint = pickedPoint === null ? null : projectLngLat(normalizedPointToLngLat(pickedPoint));
  const routeSegments =
    showRoute && labeledPoints.length >= 2 && labeledPoints[0] !== undefined && labeledPoints[1] !== undefined
      ? greatCircleRouteSegments(labeledPoints[0], labeledPoints[1]).map((segment) => segment.map(projectLngLat))
      : [];
  const mapContents = (
    <>
      <div
        className="pointer-events-none absolute top-1/2 left-0 z-0 grid aspect-square w-full -translate-y-1/2 grid-cols-2"
        aria-hidden="true"
      >
        {MAP_FALLBACK_TILES.map((tile) => (
          <img key={tile} src={tile} alt="" className="size-full" />
        ))}
      </div>
      <div ref={containerRef} className="absolute inset-0 z-10" />
      <svg
        className="pointer-events-none absolute inset-0 z-20 size-full overflow-hidden"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {routeSegments.map((segment) => {
          const points = segment.map((point) => `${point.x},${point.y}`).join(' ');
          return (
            <g key={points} data-map-route-segment>
              <polyline
                points={points}
                fill="none"
                stroke="#17203a"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.82"
              />
              <polyline
                points={points}
                fill="none"
                stroke="#e85d2a"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
        {displayedLabeledPoints.map((point) => {
          const labelWidth = Math.min(150, Math.max(68, point.name.length * 7 + 18));
          return (
            <g
              key={`${point.name}-${point.x}-${point.y}`}
              transform={`translate(${point.viewport.x} ${point.viewport.y})`}
              data-map-labeled-point={point.name}
            >
              <circle cx="2" cy="3" r="12" fill="#17203a" />
              <circle r="11" fill="#e85d2a" stroke="#17203a" strokeWidth="2" />
              <circle r="3" fill="white" />
              <rect x={-labelWidth / 2 + 2} y="-39" width={labelWidth} height="22" rx="6" fill="#17203a" />
              <rect
                x={-labelWidth / 2}
                y="-41"
                width={labelWidth}
                height="22"
                rx="6"
                fill="white"
                stroke="#17203a"
                strokeWidth="1.5"
              />
              <text
                x="0"
                y="-30"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#17203a"
                fontSize="10"
                fontWeight="800"
              >
                {point.name}
              </text>
            </g>
          );
        })}
        {displayedPickedPoint !== null && (
          <g transform={`translate(${displayedPickedPoint.x} ${displayedPickedPoint.y})`} data-map-picked-point>
            <circle cx="3" cy="4" r="18" fill="#17203a" />
            <circle r="17" fill="white" />
            <circle r="14" fill="#3155d9" />
            <circle r="4" fill="white" />
          </g>
        )}
      </svg>
      {!mapReady && (
        <span className="pointer-events-none absolute right-3 bottom-3 z-40 rounded-full border border-[#17203a]/20 bg-white/90 px-2.5 py-1 text-[9px] font-[760] text-[#53627a]">
          Loading map…
        </span>
      )}
    </>
  );

  if (onPick === undefined) {
    return (
      <div className={mapClassName} role="img" aria-label={ariaLabel ?? 'OpenStreetMap world map'}>
        {mapContents}
      </div>
    );
  }

  return (
    // MapLibre injects attribution controls, so an actual button here would create invalid nested controls.
    // biome-ignore lint/a11y/useSemanticElements: the button role preserves keyboard semantics without nesting buttons.
    <div
      className={mapClassName}
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={disabled ? undefined : 0}
      data-disabled={disabled}
      onPointerDown={choosePoint}
      onKeyDown={chooseCenter}
    >
      {mapContents}
    </div>
  );
}

export type { NormalizedPoint as MiniGameMapPoint } from './MiniGameWorldMapGeometry';
