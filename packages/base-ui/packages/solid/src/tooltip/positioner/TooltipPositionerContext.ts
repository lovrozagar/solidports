import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ReactLikeRef } from '../../solid-helpers';
import type { Align, Side } from '../../utils/useAnchorPositioning';

export interface TooltipPositionerContext {
  open: Accessor<boolean>;
  side: Accessor<Side>;
  align: Accessor<Align>;
  arrowUncentered: Accessor<boolean>;
  arrowStyles: Accessor<JSX.CSSProperties>;
  anchorHidden: Accessor<boolean>;
  arrowRef: ReactLikeRef<Element | null | undefined>;
}

export const TooltipPositionerContext = createContext<TooltipPositionerContext | null>(null);

export function useTooltipPositionerContext() {
  const context = useContext(TooltipPositionerContext);
  if (context == null) {
    throw new Error(
      'Base UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>.',
    );
  }
  return context;
}
