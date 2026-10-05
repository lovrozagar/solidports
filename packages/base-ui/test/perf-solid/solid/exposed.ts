import { createSignal } from 'solid-js';

/** Setters for fixture state the scenarios drive (`lib.set(key, value)`). */
export const setters: Record<string, (value: unknown) => void> = {};

/** Controlled state a scenario can set from outside, registered under `key`. */
export function useExposed<T>(key: string, initial: T): () => T {
  const [value, setValue] = createSignal<T>(initial as Exclude<T, Function>);
  setters[key] = (next) => setValue(() => next as Exclude<T, Function>);
  return value;
}
