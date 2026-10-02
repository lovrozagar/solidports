import { createEffect, onCleanup, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { FieldValidityData } from '../../field/root/FieldRoot';
import { getCombinedFieldValidityData } from '../../field/utils/getCombinedFieldValidityData';
import { useFormContext } from '../../form/FormContext';
import type { ReactLikeRef } from '../../solid-helpers';

export interface FieldControlRegistration {
  controlRef: ReactLikeRef<any>;
  id: string | undefined;
  name?: string | undefined;
  getValue?: (() => unknown) | undefined;
  value: unknown;
}

export function useFieldControlRegistration(params: UseFieldControlRegistrationParameters) {
  const {
    change,
    commit,
    invalid,
    markedDirtyRef,
    name,
    setRegisteredFieldName,
    registeredFieldIdRef,
    setValidityData,
    validityData,
  } = params;

  const { formRef } = useFormContext();

  let activeFieldControlSourceRef: symbol | null = null;
  let registrationRef: FieldControlRegistration | null = null;
  let initialValueCapturedRef = false;

  const getValueForForm = () => {
    const registration = registrationRef;
    if (!registration) {
      return undefined;
    }

    if (registration.getValue) {
      return registration.getValue();
    }

    return registration.value;
  };

  function getRegistrationValue(registration: FieldControlRegistration) {
    return registration.value === undefined ? getValueForForm() : registration.value;
  }

  const validate = () => {
    const registration = registrationRef;
    markedDirtyRef.current = true;

    if (!registration) {
      commit(untrack(() => validityData.value));
      return;
    }

    commit(getRegistrationValue(registration));
  };

  function refreshRegistration() {
    const registration = registrationRef;
    if (!registration || !registration.id) {
      return;
    }

    const fieldName = untrack(name);
    formRef.fields.set(registration.id, {
      getValue: getValueForForm,
      name: fieldName ?? registration.name,
      controlRef: registration.controlRef,
      validityData: untrack(() => getCombinedFieldValidityData(validityData, invalid())),
      validate,
    });
  }

  function deleteRegistration(id = registrationRef?.id) {
    if (id) {
      formRef.fields.delete(id);
    }
  }

  // The baseline belongs to the field, not to a control instance: registration re-runs on every
  // value change, and a control that unmounts and remounts (or is swapped for another one) comes
  // back as a brand new registration. Capturing more than once would turn whichever value the
  // control happens to hold at that point into the initial value, so a modified field would read
  // pristine and its real initial value would read dirty. Consumers that want a fresh baseline
  // remount or key `<Field.Root>` itself.
  function captureInitialValue(registration: FieldControlRegistration) {
    if (initialValueCapturedRef) {
      return;
    }

    initialValueCapturedRef = true;
    const initialValue = getRegistrationValue(registration);

    setValidityData((prev) =>
      prev.initialValue === initialValue ? prev : { ...prev, initialValue },
    );
  }

  createEffect(
    () => ({
      invalid: invalid(),
      name: name(),
      // A fresh snapshot each time validity changes, as React's deps see a new object.
      validityData: getCombinedFieldValidityData(validityData, invalid()),
    }),
    (deps) => {
      const registration = registrationRef;
      if (!registration || !registration.id) {
        return;
      }

      setRegisteredFieldName(deps.name ? undefined : registration.name);

      formRef.fields.set(registration.id, {
        getValue: getValueForForm,
        name: deps.name ?? registration.name,
        controlRef: registration.controlRef,
        validityData: deps.validityData,
        validate,
      });
    },
  );

  const fields = formRef.fields;
  onCleanup(() => {
    const id = registrationRef?.id;
    if (id) {
      fields.delete(id);
    }
  });

  const register = (source: symbol, registration: FieldControlRegistration | undefined) => {
    if (!registration) {
      if (activeFieldControlSourceRef === source) {
        activeFieldControlSourceRef = null;
        change(undefined, true);
        deleteRegistration();
        registrationRef = null;
        setRegisteredFieldName(undefined);
        registeredFieldIdRef.current = undefined;
      }
      return;
    }

    const previousId = registrationRef?.id;
    const previousSource = activeFieldControlSourceRef;

    // Drop work owned by a replaced control, but not on first registration.
    if (previousSource && previousSource !== source) {
      change(undefined, true);
    }

    activeFieldControlSourceRef = source;
    registrationRef = registration;
    if (!untrack(name)) {
      setRegisteredFieldName(registration.name);
    }
    registeredFieldIdRef.current = registration.id;

    if (previousId && previousId !== registration.id) {
      deleteRegistration(previousId);
    }

    captureInitialValue(registration);
    refreshRegistration();
  };

  return [validate, register] as const;
}

export interface UseFieldControlRegistrationParameters {
  change: (value: unknown, cancelPending?: boolean) => void;
  commit: (value: unknown) => void;
  invalid: Accessor<boolean>;
  markedDirtyRef: ReactLikeRef<boolean>;
  name: Accessor<string | undefined>;
  setRegisteredFieldName: (name: string | undefined) => void;
  registeredFieldIdRef: ReactLikeRef<string | undefined>;
  setValidityData: (
    value: FieldValidityData | ((prev: FieldValidityData) => FieldValidityData),
  ) => void;
  validityData: FieldValidityData;
}
