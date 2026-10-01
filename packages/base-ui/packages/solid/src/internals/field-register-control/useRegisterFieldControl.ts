import { useField } from '../../field/useField';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import type { FieldControlRegistration } from './useFieldControlRegistration';

export function useRegisterFieldControl(
  controlRef: FieldControlRegistration['controlRef'],
  id: FieldControlRegistration['id'] | (() => FieldControlRegistration['id']),
  value: FieldControlRegistration['value'] | (() => FieldControlRegistration['value']),
  getFormValueOverride?: FieldControlRegistration['getValue'],
  enabled: boolean | (() => boolean) = true,
  name?: FieldControlRegistration['name'] | (() => FieldControlRegistration['name']),
) {
  const { validation } = useFieldRootContext();

  useField({
    commit: validation.commit,
    controlRef: () => {
      if (typeof controlRef === 'function') {
        return undefined;
      }
      return controlRef && typeof controlRef === 'object' && 'current' in controlRef
        ? controlRef.current
        : controlRef;
    },
    enabled: () => (typeof enabled === 'function' ? enabled() : enabled),
    getValue: getFormValueOverride,
    id: () => (typeof id === 'function' ? id() : id),
    name: () => (typeof name === 'function' ? name() : name),
    value: () => (typeof value === 'function' ? value() : value),
  });
}
