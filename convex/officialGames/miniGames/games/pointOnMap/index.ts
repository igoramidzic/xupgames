import type { NormalizedPoint } from '../../shared';
import { chooseCity, haversineDistanceKm, type MapPlace, mapPlace } from '../shared/mapPlaces';

export function createMapPointChallenge(random: () => number = Math.random): MapPlace {
  return mapPlace(chooseCity(random));
}

export function normalizedPointToCoordinates(point: NormalizedPoint) {
  return { latitude: 90 - point.y * 180, longitude: point.x * 360 - 180 };
}

export function scoreMapPoint(answer: MapPlace, guess: NormalizedPoint) {
  const distanceKm = haversineDistanceKm(answer, normalizedPointToCoordinates(guess));
  return { error: Math.round(distanceKm), score: Math.round(1_000 * Math.exp(-distanceKm / 3_000)) };
}
