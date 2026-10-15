import { createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';

const UNINITIALIZED = {};

/**
 * A React.useRef() that is initialized with a function. Note that it accepts an optional
 * initialization argument, so the initialization function doesn't need to be an inline closure.
 *
 * @usage
 *   const ref = useRefWithInit(sortColumns, columns)
 */
export function useRefWithInit<T>(init: Accessor<() => T>): Accessor<{
  current: T;
}>;
export function useRefWithInit<T, U>(
  init: Accessor<(arg: U) => T>,
  initArg: Accessor<U>,
): Accessor<{
  current: T;
}>;
export function useRefWithInit(
  init: Accessor<(arg?: unknown) => unknown>,
  initArg?: Accessor<unknown | undefined>,
) {
  const ref = {
    current: UNINITIALIZED as any,
  };
  return createMemo(() => {
    if (ref.current === UNINITIALIZED) {
      ref.current = init()(initArg?.());
    }
    return ref;
  });
}
