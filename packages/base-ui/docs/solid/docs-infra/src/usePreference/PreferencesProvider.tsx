import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';

export interface PreferencesContext {
  prefix?: string;
}
export const PreferencesContext = createContext<Accessor<PreferencesContext | undefined>>(
  () => undefined,
);
export function usePreferences() {
  return useContext(PreferencesContext);
}
