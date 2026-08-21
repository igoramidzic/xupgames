import { v } from 'convex/values';

export const phaseValidator = v.union(
  v.literal('lobby'),
  v.literal('preparing'),
  v.literal('countdown'),
  v.literal('drawing'),
  v.literal('reveal'),
  v.literal('complete')
);

export const roundSnapshotValidator = v.object({
  sourceKey: v.string(),
  countryCode: v.string(),
  countryName: v.string(),
  indicatorCode: v.string(),
  indicatorName: v.string(),
  category: v.string(),
  unitLabel: v.string(),
  valueDecimals: v.number(),
  axisMin: v.number(),
  axisMax: v.number(),
  startYear: v.number(),
  endYear: v.number(),
  values: v.array(v.number()),
  sourceName: v.string(),
  sourceOrganization: v.string(),
  sourceUrl: v.string(),
  licenseName: v.string(),
  retrievedAt: v.number(),
});

export const memberValidator = v.object({ memberId: v.string(), displayName: v.string() });
