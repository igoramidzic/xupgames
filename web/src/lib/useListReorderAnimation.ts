import { useLayoutEffect, useRef } from 'react';

type ListReorderAnimationOptions = {
  animate?: boolean;
  resetKey?: string | number;
};

const SWAP_DURATION_MS = 520;
const SWAP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function useListReorderAnimation(
  orderKey: string,
  { animate = true, resetKey }: ListReorderAnimationOptions = {}
) {
  const elements = useRef(new Map<string, HTMLElement>());
  const previousPositions = useRef(new Map<string, DOMRect>());
  const previousResetKey = useRef(resetKey);
  const activeAnimations = useRef(new Map<string, Animation>());

  useLayoutEffect(() => {
    const memberIds = orderKey === '' ? [] : orderKey.split('|');
    const nextPositions = new Map<string, DOMRect>();
    const reset = previousResetKey.current !== resetKey;
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reset || !animate || reduceMotion) {
      for (const animation of activeAnimations.current.values()) {
        animation.cancel();
      }
      activeAnimations.current.clear();
      for (const element of elements.current.values()) {
        delete element.dataset.reordering;
      }
    }

    for (const memberId of memberIds) {
      const element = elements.current.get(memberId);
      if (!element) {
        continue;
      }
      const nextPosition = element.getBoundingClientRect();
      const previousPosition = previousPositions.current.get(memberId);
      nextPositions.set(memberId, nextPosition);
      const offsetY = previousPosition ? previousPosition.top - nextPosition.top : 0;
      if (reset || !animate || reduceMotion || Math.abs(offsetY) < 1 || typeof element.animate !== 'function') {
        continue;
      }

      activeAnimations.current.get(memberId)?.cancel();
      element.dataset.reordering = 'true';
      const animation = element.animate(
        [{ transform: `translate3d(0, ${offsetY}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }],
        { duration: SWAP_DURATION_MS, easing: SWAP_EASING }
      );
      activeAnimations.current.set(memberId, animation);
      void animation.finished
        .catch(() => undefined)
        .finally(() => {
          if (activeAnimations.current.get(memberId) !== animation) {
            return;
          }
          activeAnimations.current.delete(memberId);
          delete element.dataset.reordering;
        });
    }

    previousResetKey.current = resetKey;
    previousPositions.current = nextPositions;
  }, [animate, orderKey, resetKey]);

  useLayoutEffect(
    () => () => {
      for (const animation of activeAnimations.current.values()) {
        animation.cancel();
      }
    },
    []
  );

  return (memberId: string, element: HTMLElement | null) => {
    if (element === null) {
      elements.current.delete(memberId);
      return;
    }
    elements.current.set(memberId, element);
  };
}
