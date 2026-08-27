export type NormalizedPoint = { x: number; y: number };
export type ViewportPoint = { x: number; y: number };
export type LngLatPoint = readonly [longitude: number, latitude: number];
export type MapViewport = { width: number; height: number };

const MAX_MERCATOR_LATITUDE = 85.051129;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizedPointToLngLat(point: NormalizedPoint): LngLatPoint {
  return [point.x * 360 - 180, 90 - point.y * 180];
}

export function lngLatToNormalizedPoint(longitude: number, latitude: number): NormalizedPoint {
  return {
    x: clamp((longitude + 180) / 360, 0, 1),
    y: clamp((90 - latitude) / 180, 0, 1),
  };
}

export function lngLatToFallbackViewport([longitude, latitude]: LngLatPoint, viewport: MapViewport): ViewportPoint {
  const clampedLatitude = clamp(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
  const latitudeRadians = (clampedLatitude * Math.PI) / 180;
  const mercatorY = (1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2;
  return {
    x: ((longitude + 180) / 360) * viewport.width,
    y: mercatorY * viewport.width - (viewport.width - viewport.height) / 2,
  };
}

export function clientPointToMapPixel(
  clientX: number,
  clientY: number,
  bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  viewport: MapViewport
) {
  return {
    x: ((clientX - bounds.left) * viewport.width) / Math.max(1, bounds.width),
    y: ((clientY - bounds.top) * viewport.height) / Math.max(1, bounds.height),
  };
}

export function fallbackPixelToNormalizedPoint(localX: number, localY: number, viewport: MapViewport): NormalizedPoint {
  const mapSize = Math.max(1, viewport.width);
  const worldY = localY + (mapSize - viewport.height) / 2;
  const longitude = (localX / mapSize) * 360 - 180;
  const mercatorY = clamp(worldY / mapSize, 0, 1);
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - 2 * mercatorY))) * 180) / Math.PI;
  return lngLatToNormalizedPoint(longitude, latitude);
}

type Vector3 = readonly [x: number, y: number, z: number];

function lngLatToVector([longitude, latitude]: LngLatPoint): Vector3 {
  const longitudeRadians = (longitude * Math.PI) / 180;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const latitudeRadius = Math.cos(latitudeRadians);
  return [
    latitudeRadius * Math.cos(longitudeRadians),
    latitudeRadius * Math.sin(longitudeRadians),
    Math.sin(latitudeRadians),
  ];
}

function vectorToLngLat([x, y, z]: Vector3): LngLatPoint {
  return [(Math.atan2(y, x) * 180) / Math.PI, (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI];
}

export function greatCircleCoordinates(start: NormalizedPoint, end: NormalizedPoint, sampleCount = 64): LngLatPoint[] {
  const startLngLat = normalizedPointToLngLat(start);
  const endLngLat = normalizedPointToLngLat(end);
  const startVector = lngLatToVector(startLngLat);
  const endVector = lngLatToVector(endLngLat);
  const dotProduct = clamp(
    startVector[0] * endVector[0] + startVector[1] * endVector[1] + startVector[2] * endVector[2],
    -1,
    1
  );
  const angle = Math.acos(dotProduct);
  const angleSine = Math.sin(angle);
  const steps = Math.max(2, sampleCount);

  if (angle < 1e-7 || Math.abs(angleSine) < 1e-7) return [startLngLat, endLngLat];

  return Array.from({ length: steps + 1 }, (_, index) => {
    if (index === 0) return startLngLat;
    if (index === steps) return endLngLat;
    const progress = index / steps;
    const startWeight = Math.sin((1 - progress) * angle) / angleSine;
    const endWeight = Math.sin(progress * angle) / angleSine;
    return vectorToLngLat([
      startVector[0] * startWeight + endVector[0] * endWeight,
      startVector[1] * startWeight + endVector[1] * endWeight,
      startVector[2] * startWeight + endVector[2] * endWeight,
    ]);
  });
}

export function splitRouteAtAntimeridian(coordinates: LngLatPoint[]): LngLatPoint[][] {
  const first = coordinates[0];
  if (first === undefined) return [];
  const segments: LngLatPoint[][] = [[first]];

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    if (previous === undefined || current === undefined) continue;
    const longitudeDelta = current[0] - previous[0];
    const segment = segments.at(-1);
    if (segment === undefined) continue;

    if (Math.abs(longitudeDelta) <= 180) {
      segment.push(current);
      continue;
    }

    const crossesEastEdge = longitudeDelta < -180;
    const unwrappedLongitude = current[0] + (crossesEastEdge ? 360 : -360);
    const boundaryLongitude = crossesEastEdge ? 180 : -180;
    const oppositeBoundaryLongitude = -boundaryLongitude;
    const crossingLongitudeDelta = unwrappedLongitude - previous[0];
    const crossingProgress =
      (boundaryLongitude - previous[0]) / (Math.abs(crossingLongitudeDelta) < 1e-9 ? 1e-9 : crossingLongitudeDelta);
    const crossingLatitude = previous[1] + (current[1] - previous[1]) * crossingProgress;
    segment.push([boundaryLongitude, crossingLatitude]);
    segments.push([[oppositeBoundaryLongitude, crossingLatitude], current]);
  }

  return segments.filter((segment) => segment.length >= 2);
}

export function greatCircleRouteSegments(start: NormalizedPoint, end: NormalizedPoint) {
  return splitRouteAtAntimeridian(greatCircleCoordinates(start, end));
}
