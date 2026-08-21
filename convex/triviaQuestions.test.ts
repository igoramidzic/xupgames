import { describe, expect, it } from 'vitest';
import { selectTriviaQuestions, TRIVIA_CATEGORIES, TRIVIA_QUESTIONS } from './triviaQuestions';

describe('trivia question bank', () => {
  it('ships a large, structurally valid launch bank', () => {
    expect(TRIVIA_QUESTIONS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(TRIVIA_QUESTIONS.map((question) => question.id)).size).toBe(TRIVIA_QUESTIONS.length);

    for (const question of TRIVIA_QUESTIONS) {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options).size).toBe(4);
      expect(question.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctOptionIndex).toBeLessThan(4);
      expect(question.answer).toBe(question.options[question.correctOptionIndex]);
    }
  });

  it('covers several kinds of knowledge', () => {
    const categories = new Set(TRIVIA_QUESTIONS.map((question) => question.category));
    expect(categories).toEqual(new Set(TRIVIA_CATEGORIES));
  });

  it('selects the requested number of questions only from the configured categories', () => {
    const selected = selectTriviaQuestions(['Science', 'Nature'], 15, () => 0.25);

    expect(selected).toHaveLength(15);
    expect(new Set(selected.map((question) => question.id)).size).toBe(15);
    expect(selected.every((question) => question.category === 'Science' || question.category === 'Nature')).toBe(true);
  });

  it('refuses configurations with too few questions', () => {
    expect(() => selectTriviaQuestions(['Nature'], 15)).toThrow(
      'The selected categories do not contain enough trivia questions.'
    );
  });
});
