import { describe, expect, it } from 'vitest';
import { chooseTypeRacerPassage, TYPE_RACER_PASSAGES } from './typeRacerPassages';

describe('type racer passage bank', () => {
  it('contains a broad set of long phrases, sentences, and paragraphs with keyboard-safe punctuation', () => {
    expect(new Set(TYPE_RACER_PASSAGES.map((passage) => passage.kind))).toEqual(
      new Set(['phrase', 'sentence', 'paragraph'])
    );
    expect(TYPE_RACER_PASSAGES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(TYPE_RACER_PASSAGES.map((passage) => passage.id)).size).toBe(TYPE_RACER_PASSAGES.length);
    expect(new Set(TYPE_RACER_PASSAGES.map((passage) => passage.title)).size).toBeGreaterThanOrEqual(35);

    const minimumLength = { phrase: 150, sentence: 150, paragraph: 180 } as const;
    for (const passage of TYPE_RACER_PASSAGES) {
      expect(passage.text).toMatch(/^[\x20-\x7E]+$/);
      expect(passage.text.length).toBeGreaterThanOrEqual(minimumLength[passage.kind]);
      expect(passage.text.length).toBeLessThanOrEqual(420);
    }
  });

  it('does not immediately repeat the previous passage', () => {
    const previous = TYPE_RACER_PASSAGES[0];
    expect(chooseTypeRacerPassage(previous.id, () => 0).id).not.toBe(previous.id);
  });
});
