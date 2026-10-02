import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ReactLikeRef } from '../../solid-helpers';
import type { Align, Side } from '../../utils/useAnchorPositioning';

export interface PreviewCardPositionerContext {
  side: Accessor<Side>;
  align: Accessor<Align>;
  arrowRef: ReactLikeRef<Element | null | undefined>;
  arrowUncentered: Accessor<boolean>;
  arrowStyles: Accessor<JSX.CSSProperties>;
}

export const PreviewCardPositionerContext = createContext<PreviewCardPositionerContext | null>(null);

export function usePreviewCardPositionerContext() {
  const context = useContext(PreviewCardPositionerContext);
  if (context == null) {
    throw new Error(
      'Base UI: <PreviewCard.Popup> and <PreviewCard.Arrow> must be used within the <PreviewCard.Positioner> component',
    );
  }

  return context;
}
