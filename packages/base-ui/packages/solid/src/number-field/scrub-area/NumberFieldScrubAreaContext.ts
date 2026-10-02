import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { ReactLikeRef } from '../../solid-helpers';

export interface NumberFieldScrubAreaContext {
  isScrubbing: Accessor<boolean>;
  isTouchInput: Accessor<boolean>;
  isPointerLockDenied: Accessor<boolean>;
  scrubAreaCursorRef: ReactLikeRef<HTMLSpanElement | null>;
}

export const NumberFieldScrubAreaContext = createContext<NumberFieldScrubAreaContext | null>(null);

export function useNumberFieldScrubAreaContext() {
  const context = useContext(NumberFieldScrubAreaContext);
  if (context == null) {
    throw new Error(
      'Base UI: NumberFieldScrubAreaContext is missing. NumberFieldScrubArea parts must be placed within <NumberField.ScrubArea>.',
    );
  }
  return context;
}
