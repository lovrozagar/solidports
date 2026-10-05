import * as React from 'react';

/** Setters for fixture state the scenarios drive (`lib.set(key, value)`). */
export const setters: Record<string, (value: unknown) => void> = {};

/** Controlled state a scenario can set from outside, registered under `key`. */
export function useExposed<T>(key: string, initial: T): T {
  const [value, setValue] = React.useState(initial);
  setters[key] = setValue as (value: unknown) => void;
  return value;
}
