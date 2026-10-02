import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ReactLikeRef } from '../../solid-helpers';
import type { Align, Side } from '../../utils/useAnchorPositioning';

export interface ComboboxPositionerContext {
  side: Accessor<Side>;
  align: Accessor<Align>;
  arrowRef: ReactLikeRef<Element | null | undefined>;
  arrowUncentered: Accessor<boolean>;
  arrowStyles: JSX.CSSProperties;
  anchorHidden: Accessor<boolean>;
  isPositioned: Accessor<boolean>;
}

export const ComboboxPositionerContext = createContext<ComboboxPositionerContext | null>(null);

export function useComboboxPositionerContext(optional?: false): ComboboxPositionerContext;
export function useComboboxPositionerContext(optional: true): ComboboxPositionerContext | null;
export function useComboboxPositionerContext(optional?: boolean) {
  const context = useContext(ComboboxPositionerContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: <Combobox.Popup> and <Combobox.Arrow> must be used within the <Combobox.Positioner> component',
    );
  }
  return context;
}
