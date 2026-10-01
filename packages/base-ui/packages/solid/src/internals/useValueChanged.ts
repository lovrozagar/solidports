import { createEffect, on, type Accessor } from 'solid-js';
import { useRef } from '../solid-helpers';

export function useValueChanged<T>(value: Accessor<T>, onChange: (previousValue: T) => void) {
  const valueRef = useRef(value());

  createEffect(
    on(
      value,
      (current) => {
        if (valueRef.current !== current) {
          onChange(valueRef.current);
        }
        valueRef.current = current;
      },
      { defer: true },
    ),
  );
}
