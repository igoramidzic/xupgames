export type MapPlace = { name: string; latitude: number; longitude: number; x: number; y: number };

const CITY_COORDINATES = [
  { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207 },
  { name: 'Mexico City', latitude: 19.4326, longitude: -99.1332 },
  { name: 'New York City', latitude: 40.7128, longitude: -74.006 },
  { name: 'Rio de Janeiro', latitude: -22.9068, longitude: -43.1729 },
  { name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816 },
  { name: 'London', latitude: 51.5072, longitude: -0.1276 },
  { name: 'Cairo', latitude: 30.0444, longitude: 31.2357 },
  { name: 'Cape Town', latitude: -33.9221, longitude: 18.4231 },
  { name: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  { name: 'Singapore', latitude: 1.3521, longitude: 103.8198 },
  { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093 },
] as const;

export function mapPlace(city: (typeof CITY_COORDINATES)[number]): MapPlace {
  return { ...city, x: (city.longitude + 180) / 360, y: (90 - city.latitude) / 180 };
}

export function chooseCity(random: () => number) {
  return (
    CITY_COORDINATES[Math.min(CITY_COORDINATES.length - 1, Math.floor(random() * CITY_COORDINATES.length))] ??
    CITY_COORDINATES[0]
  );
}

export function cityAfter(city: (typeof CITY_COORDINATES)[number], offset: number) {
  return CITY_COORDINATES[(CITY_COORDINATES.indexOf(city) + offset) % CITY_COORDINATES.length] ?? CITY_COORDINATES[0];
}

export function haversineDistanceKm(
  first: Pick<MapPlace, 'latitude' | 'longitude'>,
  second: Pick<MapPlace, 'latitude' | 'longitude'>
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
