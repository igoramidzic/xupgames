import { clamp, MINI_GAMES_ROUND_MS, rounded } from '../../shared';
import { chooseCity, cityAfter, haversineDistanceKm, type MapPlace, mapPlace } from '../shared/mapPlaces';

export type DistanceUnit = 'kilometers' | 'miles';

export function createDistanceChallenge(random: () => number = Math.random): {
  first: MapPlace;
  second: MapPlace;
  unit: DistanceUnit;
  answer: number;
} {
  const firstCity = chooseCity(random);
  let secondCity = chooseCity(random);
  if (secondCity.name === firstCity.name) secondCity = cityAfter(firstCity, 5);
  const unit: DistanceUnit = random() >= 0.5 ? 'miles' : 'kilometers';
  const kilometers = haversineDistanceKm(firstCity, secondCity);
  return {
    first: mapPlace(firstCity),
    second: mapPlace(secondCity),
    unit,
    answer: Math.round(unit === 'miles' ? kilometers * 0.621371 : kilometers),
  };
}

export function scoreDistanceEstimate(answer: number, guess: number, timeMs: number) {
  const relativeError = Math.abs(answer - guess) / Math.max(1, answer);
  const speed = clamp(1 - timeMs / MINI_GAMES_ROUND_MS, 0, 1);
  return {
    error: rounded(relativeError * 100),
    score: Math.round(clamp(1 - relativeError, 0, 1) * 900 + speed * 100),
  };
}
