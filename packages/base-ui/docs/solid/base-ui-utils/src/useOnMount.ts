import { createEffect, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { EMPTY_ARRAY } from './empty';

/**
 * A React.useEffect equivalent that runs once, when the component is mounted.
 */
export function useOnMount(fn: Accessor<() => void | (() => void)>) {
  createEffect(() => EMPTY_ARRAY, untrack(fn));
}
