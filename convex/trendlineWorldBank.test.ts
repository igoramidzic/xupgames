import { describe, expect, it } from 'vitest';
import {
  buildTrendlineCandidates,
  parseWorldBankCountries,
  parseWorldBankObservations,
  selectTrendlineRounds,
  TRENDLINE_INDICATORS,
} from './trendlineWorldBank';

describe('World Bank Trendline preparation', () => {
  it('uses only indicator codes currently accepted by WDI source 2', () => {
    expect(TRENDLINE_INDICATORS.map((indicator) => indicator.code)).not.toContain('EN.ATM.CO2E.PC');
  });

  it('keeps actual countries and excludes aggregate regions', () => {
    expect(
      parseWorldBankCountries([
        {},
        [
          { id: 'USA', name: 'United States', region: { id: 'NAC' } },
          { id: 'WLD', name: 'World', region: { id: 'NA' } },
        ],
      ])
    ).toEqual([{ code: 'USA', name: 'United States' }]);
  });

  it('rejects forecasts and builds a normalized 24-year series with a small interpolated gap', () => {
    const recipe = TRENDLINE_INDICATORS[0];
    const rows = Array.from({ length: 24 }, (_, index) => ({
      indicator: { id: recipe.code },
      country: { value: 'Testland' },
      countryiso3code: 'TST',
      date: String(2000 + index),
      value: index === 8 ? null : 2 + index * 3.5,
      obs_status: '',
    }));
    rows.push({ ...rows[0], date: '2024', value: 99, obs_status: 'F' });
    const observations = parseWorldBankObservations([{}, rows]);
    const candidates = buildTrendlineCandidates(observations, [recipe], 123_000);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      countryCode: 'TST',
      indicatorCode: recipe.code,
      startYear: 2000,
      endYear: 2023,
      retrievedAt: 123_000,
    });
    expect(candidates[0].values).toHaveLength(24);
    expect(candidates[0].values[8]).toBeCloseTo(0.3, 3);
  });

  it('selects diverse countries and indicators before allowing repeats', () => {
    const base = {
      countryName: 'One',
      indicatorName: 'Indicator',
      category: 'Test',
      unitLabel: '%',
      valueDecimals: 0,
      axisMin: 0,
      axisMax: 100,
      startYear: 2000,
      endYear: 2023,
      values: Array.from({ length: 24 }, (_, index) => index / 23),
      sourceName: 'WDI',
      sourceOrganization: 'World Bank',
      sourceUrl: 'https://example.com',
      licenseName: 'CC BY 4.0',
      retrievedAt: 1,
    };
    const candidates = [
      { ...base, sourceKey: 'A:X', countryCode: 'A', indicatorCode: 'X' },
      { ...base, sourceKey: 'B:Y', countryCode: 'B', indicatorCode: 'Y' },
      { ...base, sourceKey: 'C:Z', countryCode: 'C', indicatorCode: 'Z' },
    ];
    expect(selectTrendlineRounds(candidates, 3, () => 0.99).map((round) => round.sourceKey)).toEqual([
      'A:X',
      'B:Y',
      'C:Z',
    ]);
  });
});
