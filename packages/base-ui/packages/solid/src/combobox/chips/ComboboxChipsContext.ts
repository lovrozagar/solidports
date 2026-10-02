import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { ReactLikeRef } from '../../solid-helpers';

export interface ComboboxChipsContext {
  highlightedChipIndex: Accessor<number | undefined>;
  setHighlightedChipIndex: Setter<number | undefined>;
  chipsRef: ReactLikeRef<Array<HTMLButtonElement | null | undefined>>;
}

export const ComboboxChipsContext = createContext<ComboboxChipsContext | null>(null);

export function useComboboxChipsContext() {
  return useContext(ComboboxChipsContext);
}
