import { untrack } from 'solid-js';
import { useRegisterFieldControl } from '../internals/field-register-control/useRegisterFieldControl';
import { access, type MaybeAccessor } from '../solid-helpers';

/**
 * Solid: the 1.0 field registration hook, kept for parts not yet ported to 1.8.0.
 * It forwards to `useRegisterFieldControl`, which 1.8.0 parts call directly.
 * @deprecated Use `useRegisterFieldControl`.
 */
export function useField(params: UseFieldParameters) {
  const controlRef = {
    get current() {
      return untrack(() => access(params.controlRef)) ?? null;
    },
  };

  useRegisterFieldControl(
    controlRef,
    () => access(params.id) || undefined,
    () => access(params.value),
    params.getValue,
    () => access(params.enabled) ?? true,
    () => access(params.name) || undefined,
  );
}

export interface UseFieldParameters {
  enabled?: MaybeAccessor<boolean | undefined>;
  value: MaybeAccessor<unknown>;
  getValue?: (() => unknown) | undefined;
  id: MaybeAccessor<string | false | undefined>;
  name?: MaybeAccessor<string | false | undefined>;
  /**
   * Unused: registration validates through the field's own `commit`.
   */
  commit?: ((value: unknown) => void) | undefined;
  /**
   * A ref to a focusable element that receives focus when the field fails
   * validation during form submission.
   */
  controlRef: MaybeAccessor<any>;
}
