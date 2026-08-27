import type { NormalizedPoint } from '../../shared';

type LegacyMapPoint = NormalizedPoint & { name?: string; latitude: number; longitude: number };

export function normalizedPointToCoordinates(point: NormalizedPoint) {
  return { latitude: 90 - point.y * 180, longitude: point.x * 360 - 180 };
}

function haversineDistanceKm(
  first: Pick<LegacyMapPoint, 'latitude' | 'longitude'>,
  second: Pick<LegacyMapPoint, 'latitude' | 'longitude'>
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const startLatitude = radians(first.latitude);
  const endLatitude = radians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function scoreMapPoint(answer: LegacyMapPoint, guess: NormalizedPoint) {
  const distanceKm = haversineDistanceKm(answer, normalizedPointToCoordinates(guess));
  return { error: Math.round(distanceKm), score: Math.round(1_000 * Math.exp(-distanceKm / 3_000)) };
}
