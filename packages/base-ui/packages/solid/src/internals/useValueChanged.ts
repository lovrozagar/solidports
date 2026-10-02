import { createRenderEffect, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useRef } from '../solid-helpers';

export function useValueChanged<T>(value: Accessor<T>, onChange: (previousValue: T) => void) {
  const valueRef = useRef(untrack(value));

  // Layout-effect timing, as React's `useIsoLayoutEffect`.
  createRenderEffect(value, (current) => {
    if (valueRef.current !== current) {
      onChange(valueRef.current);
    }

    valueRef.current = current;
  });
}
