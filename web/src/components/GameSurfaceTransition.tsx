import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const GAME_SURFACE_FADE_OUT_MS = 280;

type TransitionPhase = 'game' | 'game-out' | 'results';

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function GameSurfaceTransition({
  showResults,
  children,
  results,
}: {
  showResults: boolean;
  children: ReactNode;
  results: ReactNode;
}) {
  const lastGameSurface = useRef(children);
  const previousShowResults = useRef(showResults);
  const [phase, setPhase] = useState<TransitionPhase>(showResults ? 'results' : 'game');

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
      setPhase('game');
      return;
    }

    if (prefersReducedMotion()) {
      setPhase('results');
      return;
    }

    setPhase('game-out');
    const timeout = window.setTimeout(() => setPhase('results'), GAME_SURFACE_FADE_OUT_MS);
    return () => window.clearTimeout(timeout);
  }, [showResults]);

  const visiblePhase = showResults ? phase : 'game';

  return (
    <div
      className="min-w-0 opacity-100 transition-opacity duration-280 ease-in data-[transition=game-out]:opacity-0 motion-reduce:transition-none"
      data-transition={visiblePhase}
    >
      {visiblePhase === 'results' ? results : showResults ? lastGameSurface.current : children}
    </div>
  );
}
