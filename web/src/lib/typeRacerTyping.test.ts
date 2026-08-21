import { describe, expect, it } from 'vitest';
import { alignTypeRacerInput, correctPrefixLength, typingAccuracy } from './typeRacerTyping';

describe('type racer input alignment', () => {
  it('inserts repeated wrong letters before an expected space', () => {
    const alignment = alignTypeRacerInput('Call mexyz', 'Call me Ishmael.');

    expect(alignment.targetIndex).toBe(7);
    expect(alignment.correctChars).toBe(7);
    expect(alignment.insertionsByTargetIndex.get(7)?.map((entry) => entry.character)).toEqual(['x', 'y', 'z']);
    expect(alignment.hasError).toBe(true);
  });

  it('keeps insertions attached to the boundary after the space is typed', () => {
    const alignment = alignTypeRacerInput('Call mexyz ', 'Call me Ishmael.');

    expect(alignment.targetIndex).toBe(8);
    expect(alignment.targetStates[7]).toBe('correct');
    expect(alignment.insertionsByTargetIndex.get(7)?.map((entry) => entry.character)).toEqual(['x', 'y', 'z']);
    expect(alignment.correctChars).toBe(7);
  });

  it('still consumes a visible target character when the typed character is wrong', () => {
    const alignment = alignTypeRacerInput('Call mx', 'Call me Ishmael.');

    expect(alignment.targetIndex).toBe(7);
    expect(alignment.targetStates[6]).toBe('wrong');
    expect(alignment.insertionsByTargetIndex.size).toBe(0);
    expect(correctPrefixLength('Call mx', 'Call me Ishmael.')).toBe(6);
  });

  it('calculates accuracy from all attempted keys', () => {
    expect(typingAccuracy(20, 2)).toBe(90);
  });
});
