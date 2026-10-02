import { createContext, useContext } from 'solid-js';
import { PreviewCardStore } from '../store/PreviewCardStore';

export type PreviewCardRootContext<Payload = unknown> = {
  store: PreviewCardStore<Payload>;
};

export const PreviewCardRootContext = createContext<PreviewCardRootContext | null>(null);

export function usePreviewCardRootContext(optional?: false): PreviewCardRootContext;
export function usePreviewCardRootContext(optional: true): PreviewCardRootContext | null;
export function usePreviewCardRootContext(optional?: boolean) {
  const context = useContext(PreviewCardRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: PreviewCardRootContext is missing. PreviewCard parts must be placed within <PreviewCard.Root>.',
    );
  }

  return context;
}
