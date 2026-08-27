import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const GAME_SURFACE_FADE_OUT_MS = 280;

type TransitionPhase = 'game' | 'game-out' | 'results';
type SurfaceTransitionPhase = 'surface' | 'surface-out' | 'surface-in';
type ResultsRenderProps = { playIntro: boolean };
type GameSurfaceTransitionProps = {
  showResults: boolean;
  children: ReactNode;
  results: ReactNode | ((props: ResultsRenderProps) => ReactNode);
  surfaceKey?: string;
};

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ResultsOnlyTransition({ showResults, children, results }: GameSurfaceTransitionProps) {
  const lastGameSurface = useRef(children);
  const previousShowResults = useRef(showResults);
  const [phase, setPhase] = useState<TransitionPhase>(showResults ? 'results' : 'game');
  const [playResultsIntro, setPlayResultsIntro] = useState(false);

  useLayoutEffect(() => {
    if (!showResults) {
      lastGameSurface.current = children;
    }
  }, [children, showResults]);

  useEffect(() => {
    if (previousShowResults.current === showResults) {
      return;
    }
    previousShowResults.current = showResults;

    if (!showResults) {
      setPlayResultsIntro(false);
      setPhase('game');
      return;
    }

    if (prefersReducedMotion()) {
      setPlayResultsIntro(false);
      setPhase('results');
      return;
    }

    setPlayResultsIntro(true);
    setPhase('game-out');
    const timeout = window.setTimeout(() => setPhase('results'), GAME_SURFACE_FADE_OUT_MS);
    return () => window.clearTimeout(timeout);
  }, [showResults]);

  const visiblePhase = showResults ? phase : 'game';
  const resultsContent = typeof results === 'function' ? results({ playIntro: playResultsIntro }) : results;

  return (
    <div
      className="min-w-0 opacity-100 transition-opacity duration-280 ease-in data-[transition=game-out]:opacity-0 motion-reduce:transition-none"
      data-transition={visiblePhase}
    >
      {visiblePhase === 'results' ? resultsContent : showResults ? lastGameSurface.current : children}
    </div>
  );
}

function KeyedSurfaceTransition({
  showResults,
  children,
  results,
  surfaceKey,
}: GameSurfaceTransitionProps & { surfaceKey: string }) {
  const desiredKey = showResults ? '__game-results__' : surfaceKey;
  const [displayedKey, setDisplayedKey] = useState(desiredKey);
  const [phase, setPhase] = useState<SurfaceTransitionPhase>('surface');
  const [playResultsIntro, setPlayResultsIntro] = useState(false);
  const resultsContent = typeof results === 'function' ? results({ playIntro: playResultsIntro }) : results;
  const desiredContent = showResults ? resultsContent : children;
  const previousDesiredKey = useRef(desiredKey);
  const lastVisibleContent = useRef(desiredContent);
  const outgoingContent = useRef(desiredContent);

  useLayoutEffect(() => {
    if (phase === 'surface' && displayedKey === desiredKey) {
      lastVisibleContent.current = desiredContent;
    }
  }, [desiredContent, desiredKey, displayedKey, phase]);

  useEffect(() => {
    if (previousDesiredKey.current === desiredKey) return;
    previousDesiredKey.current = desiredKey;

    if (prefersReducedMotion()) {
      setDisplayedKey(desiredKey);
      setPlayResultsIntro(false);
      setPhase('surface');
      return;
    }

    outgoingContent.current = lastVisibleContent.current;
    setPhase('surface-out');
    let animationFrame: number | null = null;
    const timeout = window.setTimeout(() => {
      setDisplayedKey(desiredKey);
      setPlayResultsIntro(showResults);
      setPhase('surface-in');
      animationFrame = window.requestAnimationFrame(() => setPhase('surface'));
    }, GAME_SURFACE_FADE_OUT_MS);
    return () => {
      window.clearTimeout(timeout);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, [desiredKey, showResults]);

  const visibleContent =
    phase === 'surface-out'
      ? outgoingContent.current
      : displayedKey !== desiredKey
        ? lastVisibleContent.current
        : desiredContent;

  return (
    <div
      className="min-w-0 opacity-100 transition-opacity duration-280 ease-in-out data-[transition=surface-in]:opacity-0 data-[transition=surface-out]:opacity-0 motion-reduce:transition-none"
      data-transition={phase}
    >
      {visibleContent}
    </div>
  );
}

export default function GameSurfaceTransition(props: GameSurfaceTransitionProps) {
  return props.surfaceKey === undefined ? (
    <ResultsOnlyTransition {...props} />
  ) : (
    <KeyedSurfaceTransition {...props} surfaceKey={props.surfaceKey} />
  );
}
