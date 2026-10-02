import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ReactLikeRef } from '../../solid-helpers';
import type { Align, Side } from '../../utils/useAnchorPositioning';

export interface ToastPositionerContext {
  side: Accessor<Side>;
  align: Accessor<Align>;
  arrowRef: ReactLikeRef<Element | null | undefined>;
  anchorHidden: Accessor<boolean>;
  arrowUncentered: Accessor<boolean>;
  arrowStyles: JSX.CSSProperties;
}

export const ToastPositionerContext = createContext<ToastPositionerContext | null>(null);

export function useToastPositionerContext() {
  const context = useContext(ToastPositionerContext);
  if (context == null) {
    throw new Error(
      'Base UI: ToastPositionerContext is missing. ToastPositioner parts must be placed within <Toast.Positioner>.',
    );
  }
  return context;
}
