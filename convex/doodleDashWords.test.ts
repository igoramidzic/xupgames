import { describe, expect, it } from 'vitest';
import { DOODLE_DASH_CATEGORIES, DOODLE_DASH_WORDS, selectDoodleDashWordOptions } from './doodleDashWords';

describe('Doodle Dash word bank', () => {
  it('ships a substantial unique bank across every configured category', () => {
    expect(DOODLE_DASH_WORDS.length).toBeGreaterThanOrEqual(140);
    expect(new Set(DOODLE_DASH_WORDS.map((entry) => entry.word)).size).toBe(DOODLE_DASH_WORDS.length);
    for (const category of DOODLE_DASH_CATEGORIES) {
      expect(DOODLE_DASH_WORDS.filter((entry) => entry.category === category)).toHaveLength(20);
    }
  });

  it('returns three unique options only from selected categories', () => {
    const options = selectDoodleDashWordOptions(['Animals'], new Set(), () => 0.25);
    expect(options).toHaveLength(3);
    expect(new Set(options.map((entry) => entry.word)).size).toBe(3);
    expect(options.every((entry) => entry.category === 'Animals')).toBe(true);
  });

  it('avoids already played words while enough fresh options remain', () => {
    const excluded = new Set(
      DOODLE_DASH_WORDS.filter((entry) => entry.category === 'Food')
        .slice(0, 4)
        .map((entry) => entry.word)
    );
    expect(selectDoodleDashWordOptions(['Food'], excluded, () => 0).every((entry) => !excluded.has(entry.word))).toBe(
      true
    );
  });
});
