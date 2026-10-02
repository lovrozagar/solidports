/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createEffect, createMemo, createSignal, getObserver, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { access, type MaybeAccessor } from '../solid-helpers';
import { error } from './error';

export interface UseControlledProps<T = unknown> {
  /**
   * Holds the component value when it's controlled.
   */
  controlled: MaybeAccessor<T | undefined>;
  /**
   * The default value when uncontrolled, and the fallback if a controlled value later becomes `undefined`.
   */
  default: MaybeAccessor<T | undefined>;
  /**
   * The component name displayed in warnings.
   */
  name: string;
  /**
   * The name of the state variable displayed in warnings.
   */
  state?: string | undefined;
}

export function useControlled<T = unknown>(props: UseControlledProps<T>) {
  const controlledProp = createMemo(() => access(props.controlled));
  const defaultProp = createMemo(() => access(props.default));
  const state = () => props.state ?? 'value';

  // The mode and the initial value are fixed by the first render, as in React.
  const isControlled = untrack(() => controlledProp() !== undefined);
  const [valueState, setValue] = createSignal(untrack(defaultProp) as Exclude<T, Function>);
  // Keep the initial mode, but use the initial default if a controlled value disappears.
  const committedValue = createMemo(() => {
    const controlled = controlledProp();
    return isControlled && controlled !== undefined ? controlled : valueState();
  });

  // Solid applies writes at the next flush. Untracked reads (event handlers, effect callbacks)
  // see the latest uncontrolled write at once, as React's stable callbacks read the latest state;
  // tracked reads stay on the committed value.
  let latestWrite: { value: T } | null = null;
  const value = () => {
    if (getObserver() !== null) {
      return committedValue();
    }
    return latestWrite !== null ? latestWrite.value : untrack(committedValue);
  };

  if (process.env.NODE_ENV !== 'production') {
    createEffect(controlledProp, (controlled) => {
      if (isControlled !== (controlled !== undefined)) {
        error(
          [
            `A component is changing the ${
              isControlled ? '' : 'un'
            }controlled ${state()} state of ${props.name} to be ${isControlled ? 'un' : ''}controlled.`,
            'Elements should not switch from uncontrolled to controlled (or vice versa).',
            `Decide between using a controlled or uncontrolled ${props.name} ` +
              'element for the lifetime of the component.',
            "The nature of the state is determined during the first render. It's considered controlled if the value is not `undefined`.",
            'More info: https://fb.me/react-controlled-components',
          ].join('\n'),
        );
      }
    });

    const initialDefault = serializeToDevModeString(untrack(defaultProp));
    createEffect(defaultProp, (nextDefault) => {
      if (!isControlled && initialDefault !== serializeToDevModeString(nextDefault)) {
        error(
          [
            `A component is changing the default ${state()} state of an uncontrolled ${props.name} after being initialized. ` +
              `To suppress this warning opt to use a controlled ${props.name}.`,
          ].join('\n'),
        );
      }
    });
  }

  function setValueIfUncontrolled(newValue: T | ((prevValue: T) => T)) {
    if (!isControlled) {
      const next =
        typeof newValue === 'function'
          ? (newValue as (prevValue: T) => T)(untrack(value) as T)
          : newValue;
      latestWrite = { value: next };
      setValue(() => next as Exclude<T, Function>);
    }
  }

  return [value, setValueIfUncontrolled] as [
    Accessor<T>,
    (newValue: T | ((prevValue: T) => T)) => void,
  ];
}

/** Stable dev-only comparison of default values, so equal object literals do not warn. */
function serializeToDevModeString(input: unknown) {
  let nextId = 0;
  const seen = new WeakMap<object, number>();

  try {
    const result = JSON.stringify(input, (_key, value) => {
      if (typeof value === 'bigint') {
        return `__bigint__:${value}`;
      }

      if (value !== null && typeof value === 'object') {
        const id = seen.get(value);
        if (id !== undefined) {
          return `__object__:${id}`;
        }

        seen.set(value, nextId);
        nextId += 1;
      }

      return value;
    });

    return result ?? `__top__:${typeof input}`;
  } catch {
    return '__unserializable__';
  }
}
