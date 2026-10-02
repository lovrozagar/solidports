import { createContext, useContext } from 'solid-js';
import { type MaybeAccessor } from '../../solid-helpers';

export const PreviewCardPortalContext = createContext<MaybeAccessor<boolean> | null>(null);

export function usePreviewCardPortalContext() {
  const value = useContext(PreviewCardPortalContext);
  if (value == null) {
    throw new Error('Base UI: <PreviewCard.Portal> is missing.');
  }
  return value;
}
