import { createEffect, createMemo, createSignal, getObserver, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { access } from '../solid-helpers';
import type { MaybeAccessor } from '../solid-helpers';
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
  /**
   * Solid: `controlled` and `default` read plain (static) props, so neither can change after the
   * first render. The dev checks only report changes, so they are skipped and cost no node.
   */
  staticInputs?: boolean | undefined;
  /**
   * Solid: read a controlled value straight from `controlled` instead of through a memo. For a
   * value that is cheap to read (a prop), the memo is a node per part that saves nothing.
   */
  direct?: boolean | undefined;
}

export type ControlledSetter<T> = (newValue: T | ((prevValue: T) => T)) => void;

// A defined default guarantees a defined value. Otherwise, preserve `undefined`,
// including when callers pass an explicit generic argument.
export function useControlled<T = unknown>(
  props: Omit<UseControlledProps<T>, 'default'> & { default: MaybeAccessor<T> },
): [Accessor<T>, ControlledSetter<T>];
export function useControlled<T = unknown>(
  props: UseControlledProps<T>,
): [Accessor<T | undefined>, ControlledSetter<T | undefined>];
export function useControlled<T = unknown>(
  props: UseControlledProps<T>,
): [Accessor<T | undefined>, ControlledSetter<T | undefined>] {
  const controlledProp = () => access(props.controlled);
  const defaultProp = () => access(props.default);
  const state = () => props.state ?? 'value';

  // The mode and the initial value are fixed by the first render, as in React.
  const isControlled = untrack(() => controlledProp() !== undefined);
  // `createSignal(fn)` is a derived signal. A function value (a tab value) must be stored, not
  // called, so only that case pays for the derived node.
  const initialValue = untrack(defaultProp);
  const [valueState, setValue] = createSignal(
    (typeof initialValue === 'function' ? () => initialValue : initialValue) as Exclude<
      T,
      Function
    >,
  );
  // Keep the initial mode, but use the initial default if a controlled value disappears. A
  // controlled value goes through one memo (a derived value, such as a group's membership, then
  // reaches readers only when it changes); an uncontrolled one is the signal itself.
  const readControlled = () => {
    const controlled = controlledProp();
    return controlled !== undefined ? controlled : valueState();
  };
  const committedValue: Accessor<T> = isControlled
    ? ((props.direct ? readControlled : createMemo(readControlled)) as Accessor<T>)
    : (valueState as Accessor<T>);

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

  if (process.env.NODE_ENV !== 'production' && !props.staticInputs) {
    // One effect for both checks, so a controlled part pays one dev-only node rather than two.
    const initialDefault = serializeToDevModeString(untrack(defaultProp));
    let previousDefault: string | undefined;
    createEffect(
      () => ({ controlled: controlledProp(), defaultValue: defaultProp() }),
      ({ controlled, defaultValue }) => {
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

        const nextDefault = serializeToDevModeString(defaultValue);
        // Only a change of the default warns, not a change of the controlled value.
        if (
          !isControlled &&
          nextDefault !== (previousDefault ?? initialDefault) &&
          nextDefault !== initialDefault
        ) {
          error(
            [
              `A component is changing the default ${state()} state of an uncontrolled ${props.name} after being initialized. ` +
                `To suppress this warning opt to use a controlled ${props.name}.`,
            ].join('\n'),
          );
        }
        previousDefault = nextDefault;
      },
    );
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

  return [value, setValueIfUncontrolled as ControlledSetter<T | undefined>];
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
