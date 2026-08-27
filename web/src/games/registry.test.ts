import { describe, expect, it } from 'vitest';
import { GAME_TYPES, gamePresentation } from './registry';

describe('game presentations', () => {
  it('gives Prompt Arcade a distinct card palette from Trivia', () => {
    const promptArcade = gamePresentation('promptArcade');
    const trivia = gamePresentation('trivia');

    expect(promptArcade).toMatchObject({ color: '#b52b68', tint: '#ffe2ee' });
    expect(promptArcade.color).not.toBe(trivia.color);
    expect(promptArcade.tint).not.toBe(trivia.tint);
  });

  it('gives every game a square-safe card preview', () => {
    for (const gameType of GAME_TYPES) {
      const presentation = gamePresentation(gameType);
      expect(presentation.cardPreview).toBeTypeOf('function');
      expect(presentation.cardPreviewClassName).toContain('w-[80%]');
    }
  });
});
