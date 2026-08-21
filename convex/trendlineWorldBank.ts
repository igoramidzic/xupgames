const WORLD_BANK_BASE_URL = 'https://api.worldbank.org/v2';
const WORLD_BANK_SOURCE_ID = 2;
const POINT_COUNT = 24;
const COUNTRY_SAMPLE_SIZE = 24;
const REQUEST_YEAR_COUNT = 36;
const MAX_MISSING_YEARS = 2;

// These codes only curate for coverage and geographic variety. Country names,
// year ranges, and every playable value still come from the live API.
const PREFERRED_COUNTRY_CODES = new Set([
  'ARG',
  'AUS',
  'BRA',
  'CAN',
  'CHL',
  'CHN',
  'COL',
  'DEU',
  'EGY',
  'ESP',
  'FRA',
  'GBR',
  'GHA',
  'IDN',
  'IND',
  'ITA',
  'JPN',
  'KEN',
  'KOR',
  'MAR',
  'MEX',
  'MYS',
  'NGA',
  'NOR',
  'NZL',
  'PER',
  'PHL',
  'POL',
  'SWE',
  'THA',
  'TUR',
  'USA',
  'VNM',
  'ZAF',
]);

export type TrendlineRoundSnapshot = {
  sourceKey: string;
  countryCode: string;
  countryName: string;
  indicatorCode: string;
  indicatorName: string;
  category: string;
  unitLabel: string;
  valueDecimals: number;
  axisMin: number;
  axisMax: number;
  startYear: number;
  endYear: number;
  values: number[];
  sourceName: string;
  sourceOrganization: string;
  sourceUrl: string;
  licenseName: string;
  retrievedAt: number;
};

type IndicatorRecipe = {
  code: string;
  name: string;
  category: string;
  unitLabel: string;
  valueDecimals: number;
  axisMin: number;
  axisMax: number;
};

export const TRENDLINE_INDICATORS: readonly IndicatorRecipe[] = [
  {
    code: 'IT.NET.USER.ZS',
    name: 'Individuals using the Internet',
    category: 'Technology',
    unitLabel: '% of population',
    valueDecimals: 0,
    axisMin: 0,
    axisMax: 100,
  },
  {
    code: 'EG.ELC.ACCS.ZS',
    name: 'Access to electricity',
    category: 'Infrastructure',
    unitLabel: '% of population',
    valueDecimals: 0,
    axisMin: 0,
    axisMax: 100,
  },
  {
    code: 'SP.URB.TOTL.IN.ZS',
    name: 'Urban population',
    category: 'Population',
    unitLabel: '% of population',
    valueDecimals: 0,
    axisMin: 0,
    axisMax: 100,
  },
  {
    code: 'AG.LND.FRST.ZS',
    name: 'Forest area',
    category: 'Environment',
    unitLabel: '% of land area',
    valueDecimals: 0,
    axisMin: 0,
    axisMax: 100,
  },
  {
    code: 'EG.FEC.RNEW.ZS',
    name: 'Renewable energy consumption',
    category: 'Energy',
    unitLabel: '% of total final energy use',
    valueDecimals: 0,
    axisMin: 0,
    axisMax: 100,
  },
  {
    code: 'SP.DYN.LE00.IN',
    name: 'Life expectancy at birth',
    category: 'Health',
    unitLabel: 'years',
    valueDecimals: 1,
    axisMin: 40,
    axisMax: 90,
  },
  {
    code: 'SP.DYN.TFRT.IN',
    name: 'Fertility rate',
    category: 'Population',
    unitLabel: 'births per woman',
    valueDecimals: 1,
    axisMin: 0,
    axisMax: 8,
  },
  {
    code: 'SL.UEM.TOTL.ZS',
    name: 'Unemployment rate',
    category: 'Economy',
    unitLabel: '% of labor force',
    valueDecimals: 1,
    axisMin: 0,
    axisMax: 30,
  },
] as const;

type Country = { code: string; name: string };
export type WorldBankObservation = {
  countryCode: string;
  countryName: string;
  indicatorCode: string;
  year: number;
  value: number;
};

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function responseRows(payload: unknown): unknown[] {
  return Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
}

function worldBankError(payload: unknown): string | null {
  if (!Array.isArray(payload) || payload.length !== 1) return null;
  const envelope = asRecord(payload[0]);
  const messages = envelope?.message;
  if (!Array.isArray(messages)) return null;
  const details = messages.flatMap((message) => {
    const record = asRecord(message);
    return typeof record?.value === 'string' ? [record.value] : [];
  });
  return details.length > 0 ? details.join('; ') : 'The World Bank returned an error response.';
}

export function parseWorldBankCountries(payload: unknown): Country[] {
  return responseRows(payload).flatMap((row) => {
    const record = asRecord(row);
    const region = asRecord(record?.region);
    if (
      record === null ||
      typeof record.id !== 'string' ||
      typeof record.name !== 'string' ||
      region === null ||
      typeof region.id !== 'string' ||
      region.id === 'NA'
    ) {
      return [];
    }
    return [{ code: record.id, name: record.name }];
  });
}

export function parseWorldBankObservations(payload: unknown): WorldBankObservation[] {
  return responseRows(payload).flatMap((row) => {
    const record = asRecord(row);
    const indicator = asRecord(record?.indicator);
    const country = asRecord(record?.country);
    const year = typeof record?.date === 'string' ? Number.parseInt(record.date, 10) : Number.NaN;
    if (
      record === null ||
      indicator === null ||
      country === null ||
      typeof indicator.id !== 'string' ||
      typeof country.value !== 'string' ||
      typeof record.countryiso3code !== 'string' ||
      typeof record.value !== 'number' ||
      !Number.isFinite(record.value) ||
      !Number.isInteger(year) ||
      (typeof record.obs_status === 'string' && record.obs_status.length > 0)
    ) {
      return [];
    }
    return [
      {
        countryCode: record.countryiso3code,
        countryName: country.value,
        indicatorCode: indicator.id,
        year,
        value: record.value,
      },
    ];
  });
}

function normalizeValues(values: number[]): number[] {
  if (values.length !== POINT_COUNT || values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error('World Bank series could not be normalized for Trendline.');
  }
  return values.map((value) => Math.round(value * 10_000) / 10_000);
}

function interpolateSeries(values: Array<number | null>): number[] | null {
  const observedCount = values.filter((value) => value !== null).length;
  if (observedCount < POINT_COUNT - MAX_MISSING_YEARS || values[0] === null || values[values.length - 1] === null) {
    return null;
  }
  const result = [...values];
  for (let index = 0; index < result.length; index += 1) {
    if (result[index] !== null) continue;
    const gapStart = index;
    while (index < result.length && result[index] === null) index += 1;
    const gapLength = index - gapStart;
    if (gapLength > MAX_MISSING_YEARS || index >= result.length || gapStart === 0) return null;
    const previous = result[gapStart - 1];
    const next = result[index];
    if (previous === null || next === null) return null;
    for (let offset = 0; offset < gapLength; offset += 1) {
      result[gapStart + offset] = previous + ((next - previous) * (offset + 1)) / (gapLength + 1);
    }
  }
  return result as number[];
}

export function buildTrendlineCandidates(
  observations: WorldBankObservation[],
  recipes: readonly IndicatorRecipe[],
  retrievedAt: number
): TrendlineRoundSnapshot[] {
  const recipeByCode = new Map(recipes.map((recipe) => [recipe.code, recipe]));
  const groups = new Map<string, WorldBankObservation[]>();
  for (const observation of observations) {
    if (!recipeByCode.has(observation.indicatorCode)) continue;
    const key = `${observation.countryCode}:${observation.indicatorCode}`;
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  const candidates: TrendlineRoundSnapshot[] = [];
  for (const observationsForSeries of groups.values()) {
    const first = observationsForSeries[0];
    const recipe = recipeByCode.get(first.indicatorCode);
    if (recipe === undefined) continue;
    const byYear = new Map(observationsForSeries.map((observation) => [observation.year, observation.value]));
    const years = [...byYear.keys()].sort((left, right) => left - right);
    const endYear = years[years.length - 1];
    if (endYear === undefined) continue;
    const startYear = endYear - POINT_COUNT + 1;
    const values = interpolateSeries(
      Array.from({ length: POINT_COUNT }, (_, index) => byYear.get(startYear + index) ?? null)
    );
    if (values === null || values.some((value) => value < recipe.axisMin || value > recipe.axisMax)) continue;
    const normalized = values.map((value) => (value - recipe.axisMin) / (recipe.axisMax - recipe.axisMin));
    const range = Math.max(...normalized) - Math.min(...normalized);
    const movement = normalized.slice(1).reduce((sum, value, index) => sum + Math.abs(value - normalized[index]), 0);
    if (range < 0.07 && movement < 0.2) continue;
    candidates.push({
      sourceKey: `${first.countryCode}:${recipe.code}:${startYear}:${endYear}`,
      countryCode: first.countryCode,
      countryName: first.countryName,
      indicatorCode: recipe.code,
      indicatorName: recipe.name,
      category: recipe.category,
      unitLabel: recipe.unitLabel,
      valueDecimals: recipe.valueDecimals,
      axisMin: recipe.axisMin,
      axisMax: recipe.axisMax,
      startYear,
      endYear,
      values: normalizeValues(normalized),
      sourceName: 'World Development Indicators',
      sourceOrganization: 'World Bank',
      sourceUrl: `https://data.worldbank.org/indicator/${recipe.code}?locations=${first.countryCode}`,
      licenseName: 'CC BY 4.0',
      retrievedAt,
    });
  }
  return candidates;
}

export function selectTrendlineRounds(
  candidates: readonly TrendlineRoundSnapshot[],
  count: number,
  random: () => number = Math.random
): TrendlineRoundSnapshot[] {
  const randomized = shuffled(candidates, random);
  const selected: TrendlineRoundSnapshot[] = [];
  const usedCountries = new Set<string>();
  const usedIndicators = new Set<string>();
  for (const candidate of randomized) {
    if (usedCountries.has(candidate.countryCode) || usedIndicators.has(candidate.indicatorCode)) continue;
    selected.push(candidate);
    usedCountries.add(candidate.countryCode);
    usedIndicators.add(candidate.indicatorCode);
    if (selected.length === count) return selected;
  }
  for (const candidate of randomized) {
    if (selected.some((round) => round.sourceKey === candidate.sourceKey)) continue;
    selected.push(candidate);
    if (selected.length === count) break;
  }
  return selected;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`World Bank request failed with status ${response.status}.`);
  const payload = (await response.json()) as unknown;
  const providerError = worldBankError(payload);
  if (providerError !== null) throw new Error(`World Bank rejected the request: ${providerError}`);
  return payload;
}

export async function fetchWorldBankTrendlineRounds(
  count: number,
  now: number = Date.now(),
  random: () => number = Math.random
): Promise<TrendlineRoundSnapshot[]> {
  const countryCatalog = parseWorldBankCountries(
    await fetchJson(`${WORLD_BANK_BASE_URL}/country?format=json&per_page=400`)
  );
  const preferredCountries = countryCatalog.filter((country) => PREFERRED_COUNTRY_CODES.has(country.code));
  const countries = shuffled(
    preferredCountries.length >= COUNTRY_SAMPLE_SIZE ? preferredCountries : countryCatalog,
    random
  ).slice(0, COUNTRY_SAMPLE_SIZE);
  if (countries.length < count) throw new Error('The World Bank country catalog returned too few countries.');
  const latestYear = new Date(now).getUTCFullYear();
  const countryCodes = countries.map((country) => country.code).join(';');
  const indicatorCodes = TRENDLINE_INDICATORS.map((indicator) => indicator.code).join(';');
  const url = `${WORLD_BANK_BASE_URL}/country/${countryCodes}/indicator/${indicatorCodes}?source=${WORLD_BANK_SOURCE_ID}&date=${latestYear - REQUEST_YEAR_COUNT + 1}:${latestYear}&format=json&per_page=10000`;
  const observations = parseWorldBankObservations(await fetchJson(url));
  const rounds = selectTrendlineRounds(
    buildTrendlineCandidates(observations, TRENDLINE_INDICATORS, now),
    count,
    random
  );
  if (rounds.length < count) throw new Error('The World Bank response contained too few playable trendlines.');
  return rounds;
}
