import { createContext, createSignal, onCleanup, useContext } from 'solid-js';

interface ClosePartContextValue {
  register: () => void;
  unregister: () => void;
}

export const ClosePartContext = createContext<ClosePartContextValue | undefined>(undefined);

export function useClosePartCount() {
  const [closePartCount, setClosePartCount] = createSignal(0);

  const register = () => setClosePartCount((c) => c + 1);
  const unregister = () => setClosePartCount((c) => Math.max(0, c - 1));

  const context: ClosePartContextValue = { register, unregister };

  return {
    context,
    hasClosePart: () => closePartCount() > 0,
  };
}

export function useClosePartRegistration() {
  const context = useContext(ClosePartContext);

  if (context) {
    context.register();
    onCleanup(context.unregister);
  }
}
