export type ComparableTypeRacerProgress = {
  status: 'waiting' | 'racing' | 'finished';
  finishedAt: number | null;
  correctChars: number;
  wpm: number;
  accuracy: number;
  updatedAt: number;
};

export function calculateTypeRacerAccuracy(totalKeystrokes: number, errorKeystrokes: number): number {
  if (totalKeystrokes < 1) {
    return 100;
  }
  return Math.max(0, Math.min(100, ((totalKeystrokes - errorKeystrokes) / totalKeystrokes) * 100));
}

export function calculateTypeRacerWpm(correctChars: number, elapsedMs: number): number {
  if (correctChars < 1 || elapsedMs < 1) {
    return 0;
  }
  return (correctChars / 5) * (60_000 / elapsedMs);
}

export function compareTypeRacerProgress(
  first: ComparableTypeRacerProgress,
  second: ComparableTypeRacerProgress
): number {
  if (first.status === 'finished' && second.status !== 'finished') {
    return -1;
  }
  if (second.status === 'finished' && first.status !== 'finished') {
    return 1;
  }
  if (first.finishedAt !== null && second.finishedAt !== null) {
    return first.finishedAt - second.finishedAt;
  }
  return (
    second.correctChars - first.correctChars ||
    second.wpm - first.wpm ||
    second.accuracy - first.accuracy ||
    first.updatedAt - second.updatedAt
  );
}
