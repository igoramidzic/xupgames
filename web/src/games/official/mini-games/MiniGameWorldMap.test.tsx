import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MiniGameWorldMap from './MiniGameWorldMap';
import { lngLatToNormalizedPoint } from './MiniGameWorldMapGeometry';

const mapMocks = vi.hoisted(() => ({
  project: vi.fn(([longitude, latitude]: readonly [number, number]) => ({
    x: ((longitude + 180) / 360) * 1_000,
    y: ((90 - latitude) / 180) * 500,
  })),
  unproject: vi.fn((_coordinates: readonly [number, number]) => ({ lng: 139.6503, lat: 35.6762 })),
  resize: vi.fn(),
}));

vi.mock('maplibre-gl', () => ({
  AttributionControl: class {},
  setWorkerUrl: vi.fn(),
  Map: class {
    private readonly canvas = document.createElement('canvas');

    constructor({ container }: { container: HTMLElement }) {
      Object.defineProperties(container, {
        clientWidth: { configurable: true, value: 1_000 },
        clientHeight: { configurable: true, value: 500 },
      });
      container.getBoundingClientRect = () =>
        ({
          left: 100,
          top: 50,
          width: 2_000,
          height: 1_000,
          right: 2_100,
          bottom: 1_050,
          x: 100,
          y: 50,
          toJSON: () => ({}),
        }) as DOMRect;
    }

    addControl() {}
    getCanvas() {
      return this.canvas;
    }
    getLayer() {
      return undefined;
    }
    getCenter() {
      return { lng: 0, lat: 0 };
    }
    on() {}
    once(event: string, callback: () => void) {
      if (event === 'load') callback();
    }
    off() {}
    remove() {}
    resize() {
      mapMocks.resize();
    }
    project(coordinates: readonly [number, number]) {
      return mapMocks.project(coordinates);
    }
    unproject(coordinates: readonly [number, number]) {
      return mapMocks.unproject(coordinates);
    }
  },
}));

describe('MiniGameWorldMap', () => {
  beforeEach(() => {
    vi.stubGlobal('WebGLRenderingContext', class {});
    mapMocks.project.mockClear();
    mapMocks.unproject.mockClear();
    mapMocks.resize.mockClear();
  });

  it('uses the same projected pixel for route endpoints and their city markers', () => {
    const buenosAires = { name: 'Buenos Aires', ...lngLatToNormalizedPoint(-58.3816, -34.6037) };
    const london = { name: 'London', ...lngLatToNormalizedPoint(-0.1276, 51.5072) };
    const view = render(<MiniGameWorldMap labeledPoints={[buenosAires, london]} showRoute />);

    const buenosAiresMarker = view.container.querySelector('[data-map-labeled-point="Buenos Aires"]');
    const route = view.container.querySelector('[data-map-route-segment] polyline');
    const markerTransform = buenosAiresMarker?.getAttribute('transform');
    const routeStart = route?.getAttribute('points')?.split(' ')[0];

    expect(markerTransform).toBe('translate(337.8288888888889 346.1213888888889)');
    expect(routeStart).toBe('337.8288888888889,346.1213888888889');
  });

  it('maps a pointer through the rendered canvas bounds before placing the picked marker', () => {
    const onPick = vi.fn();
    const view = render(<MiniGameWorldMap ariaLabel="Place a pin near Tokyo" onPick={onPick} />);
    const surface = view.getByRole('button', { name: 'Place a pin near Tokyo' });

    fireEvent.pointerDown(surface, { clientX: 1_100, clientY: 550 });

    expect(mapMocks.unproject).toHaveBeenCalledWith([500, 250]);
    expect(onPick).toHaveBeenCalledWith(lngLatToNormalizedPoint(139.6503, 35.6762));
    expect(view.container.querySelector('[data-map-picked-point]')).toHaveAttribute(
      'transform',
      'translate(887.9175 150.89944444444444)'
    );
  });
});
