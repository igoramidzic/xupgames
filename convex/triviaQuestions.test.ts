import { describe, expect, it } from 'vitest';
import { TRIVIA_QUESTIONS } from './triviaQuestions';

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
    expect(categories).toEqual(
      new Set(['Science', 'History', 'Geography', 'Arts & Literature', 'Technology', 'Nature', 'Games & Culture'])
    );
  });
});
