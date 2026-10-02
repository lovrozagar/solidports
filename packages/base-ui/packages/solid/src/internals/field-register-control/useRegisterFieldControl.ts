import { createEffect, onCleanup } from 'solid-js';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { access, type MaybeAccessor } from '../../solid-helpers';
import type { FieldControlRegistration } from './useFieldControlRegistration';

export function useRegisterFieldControl(
  controlRef: FieldControlRegistration['controlRef'],
  id: MaybeAccessor<FieldControlRegistration['id']>,
  value: MaybeAccessor<FieldControlRegistration['value']>,
  getFormValueOverride?: FieldControlRegistration['getValue'],
  enabled: MaybeAccessor<boolean | undefined> = true,
  name?: MaybeAccessor<FieldControlRegistration['name']>,
) {
  const { registerFieldControl } = useFieldRootContext();
  const source = Symbol('field-control');

  // Re-register without unregistering first: re-registration with the same id updates the
  // form's fields Map entry in place, while a delete + re-add would move the field to the
  // end of the Map every time its value changes.
  createEffect(
    () => ({
      enabled: access(enabled) ?? true,
      id: access(id),
      name: access(name),
      value: access(value),
    }),
    (deps) => {
      if (!deps.enabled) {
        registerFieldControl(source, undefined);
        return;
      }

      const registration: FieldControlRegistration = {
        controlRef,
        getValue: getFormValueOverride,
        id: deps.id,
        name: deps.name,
        value: deps.value,
      };

      registerFieldControl(source, registration);
    },
  );

  onCleanup(() => {
    registerFieldControl(source, undefined);
  });
}
