import { createContext, createSignal, useContext } from 'solid-js';
import { createLayoutEffect } from '../solid-helpers';

interface ClosePartContextValue {
  register: () => () => void;
}

export const ClosePartContext = createContext<ClosePartContextValue | null>(null);

export function useClosePartCount() {
  // Solid: close parts register from a render effect and unregister from its cleanup, both of
  // which run in owned scopes.
  const [closePartCount, setClosePartCount] = createSignal(0, { ownedWrite: true });

  const register = () => {
    setClosePartCount((count) => count + 1);

    return () => {
      setClosePartCount((count) => Math.max(0, count - 1));
    };
  };

  const context: ClosePartContextValue = { register };

  return {
    context,
    hasClosePart: () => closePartCount() > 0,
  };
}

export function useClosePartRegistration() {
  const context = useContext(ClosePartContext);

  // Layout-effect timing, as React's `useIsoLayoutEffect`.
  createLayoutEffect(
    () => context,
    (currentContext) => currentContext?.register(),
  );
}
