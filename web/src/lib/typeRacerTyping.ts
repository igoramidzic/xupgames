export type TypeRacerCharacterState = 'pending' | 'correct' | 'wrong';

export type TypeRacerInsertion = {
  character: string;
  key: string;
};

export type TypeRacerInputAlignment = {
  targetStates: TypeRacerCharacterState[];
  insertionsByTargetIndex: ReadonlyMap<number, readonly TypeRacerInsertion[]>;
  targetIndex: number;
  correctChars: number;
  errorCount: number;
  hasError: boolean;
  isExact: boolean;
};

/**
 * Aligns append-only keyboard input to the passage. A non-space typed while a
 * space is expected is an insertion before that space, so the target cursor
 * stays at the same boundary and additional mistakes remain visible.
 */
export function alignTypeRacerInput(typedText: string, passage: string): TypeRacerInputAlignment {
  const targetStates: TypeRacerCharacterState[] = Array.from({ length: passage.length }, () => 'pending');
  const insertionsByTargetIndex = new Map<number, TypeRacerInsertion[]>();
  let targetIndex = 0;
  let correctChars = 0;
  let errorCount = 0;
  let prefixIsClean = true;

  function addInsertion(character: string, typedIndex: number) {
    const insertions = insertionsByTargetIndex.get(targetIndex) ?? [];
    insertions.push({ character, key: `${typedIndex}-${character}` });
    insertionsByTargetIndex.set(targetIndex, insertions);
    errorCount += 1;
    prefixIsClean = false;
  }

  for (let typedIndex = 0; typedIndex < typedText.length; typedIndex += 1) {
    const typedCharacter = typedText[typedIndex];
    const targetCharacter = passage[targetIndex];
    if (typedCharacter === undefined) {
      continue;
    }
    if (targetCharacter === undefined || (targetCharacter === ' ' && typedCharacter !== ' ')) {
      addInsertion(typedCharacter, typedIndex);
      continue;
    }

    const isCorrect = typedCharacter === targetCharacter;
    targetStates[targetIndex] = prefixIsClean && isCorrect ? 'correct' : 'wrong';
    if (prefixIsClean && isCorrect) {
      correctChars += 1;
    } else {
      prefixIsClean = false;
      if (!isCorrect) {
        errorCount += 1;
      }
    }
    targetIndex += 1;
  }

  return {
    targetStates,
    insertionsByTargetIndex,
    targetIndex,
    correctChars,
    errorCount,
    hasError: errorCount > 0,
    isExact: typedText === passage,
  };
}

export function correctPrefixLength(typedText: string, passage: string): number {
  return alignTypeRacerInput(typedText, passage).correctChars;
}

export function typingAccuracy(totalKeystrokes: number, errorKeystrokes: number): number {
  if (totalKeystrokes < 1) {
    return 100;
  }
  return Math.max(0, ((totalKeystrokes - errorKeystrokes) / totalKeystrokes) * 100);
}
