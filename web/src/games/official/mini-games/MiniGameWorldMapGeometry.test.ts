import { describe, expect, it } from 'vitest';
import {
  clientPointToMapPixel,
  fallbackPixelToNormalizedPoint,
  greatCircleRouteSegments,
  lngLatToFallbackViewport,
  lngLatToNormalizedPoint,
  normalizedPointToLngLat,
} from './MiniGameWorldMapGeometry';

describe('MiniGameWorldMapGeometry', () => {
  it('round-trips city coordinates through the map viewport', () => {
    const viewport = { width: 1_000, height: 500 };
    const buenosAires = lngLatToNormalizedPoint(-58.3816, -34.6037);
    const projected = lngLatToFallbackViewport(normalizedPointToLngLat(buenosAires), viewport);
    const restored = fallbackPixelToNormalizedPoint(projected.x, projected.y, viewport);

    expect(projected.x).toBeCloseTo(337.8, 0);
    expect(projected.y).toBeGreaterThan(viewport.height / 2);
    expect(restored.x).toBeCloseTo(buenosAires.x, 6);
    expect(restored.y).toBeCloseTo(buenosAires.y, 6);
  });

  it('converts transformed client coordinates into the map canvas coordinate space', () => {
    expect(
      clientPointToMapPixel(
        1_100,
        550,
        { left: 100, top: 50, width: 2_000, height: 1_000 },
        { width: 1_000, height: 500 }
      )
    ).toEqual({ x: 500, y: 250 });
  });

  it('splits the shortest Vancouver-to-Singapore route at the antimeridian', () => {
    const vancouver = lngLatToNormalizedPoint(-123.1207, 49.2827);
    const singapore = lngLatToNormalizedPoint(103.8198, 1.3521);
    const segments = greatCircleRouteSegments(vancouver, singapore);

    expect(segments).toHaveLength(2);
    expect(segments[0]?.[0]).toEqual(normalizedPointToLngLat(vancouver));
    expect(segments[0]?.at(-1)?.[0]).toBe(-180);
    expect(segments[1]?.[0]?.[0]).toBe(180);
    expect(segments[1]?.at(-1)).toEqual(normalizedPointToLngLat(singapore));
  });

  it('keeps routes that do not cross the date line in one continuous segment', () => {
    const buenosAires = lngLatToNormalizedPoint(-58.3816, -34.6037);
    const london = lngLatToNormalizedPoint(-0.1276, 51.5072);
    const segments = greatCircleRouteSegments(buenosAires, london);

    expect(segments).toHaveLength(1);
    expect(segments[0]?.[0]).toEqual(normalizedPointToLngLat(buenosAires));
    expect(segments[0]?.at(-1)).toEqual(normalizedPointToLngLat(london));
  });
});
