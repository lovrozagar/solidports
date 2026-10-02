/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createEffect, reconcile } from 'solid-js';
import { useFormContext } from '../form/FormContext';
import { type MaybeAccessor, access, useRef } from '../solid-helpers';
import { useFieldRootContext } from './root/FieldRootContext';
import { getCombinedFieldValidityData } from './utils/getCombinedFieldValidityData';

export function useField(params: UseFieldParameters) {
  const { setFormRef } = useFormContext();
  const { invalid, markedDirtyRef, validityData, setValidityData } = useFieldRootContext();
  const enabled = () => access(params.enabled) ?? true;
  const value = () => access(params.value);
  const id = () => access(params.id);
  const name = () => access(params.name);
  const controlRef = () => access(params.controlRef);
  const initialValueInitializedRef = useRef(false);

  createEffect(
    () => {
      if (!enabled() || initialValueInitializedRef.current) {
        return { skip: true as const };
      }

      let initialValue = value();
      if (initialValue === undefined) {
        initialValue = params.getValue?.();
      }

      return { skip: false as const, initialValue };
    },
    (payload) => {
      if (payload.skip || initialValueInitializedRef.current) {
        return;
      }
      initialValueInitializedRef.current = true;

      if (validityData.initialValue === null && payload.initialValue !== null) {
        setValidityData('initialValue', payload.initialValue);
      }
    },
  );

  createEffect(
    () => {
      const idValue = id();
      if (!enabled() || !idValue) {
        return null;
      }

      return {
        idValue,
        controlRef: controlRef(),
        name: name(),
        invalid: invalid(),
        validityData,
      };
    },
    (payload) => {
      if (!payload) {
        return;
      }

      setFormRef(
        'fields',
        payload.idValue,
        reconcile({
          controlRef: payload.controlRef,
          getValue: params.getValue ?? (() => undefined),
          name: payload.name,
          validate() {
            let nextValue = value();
            if (nextValue === undefined) {
              nextValue = params.getValue?.();
            }
            markedDirtyRef.current = true;
            // Synchronously update the validity state so the submit event can be prevented.
            params.commit(nextValue);
          },
          validityData: getCombinedFieldValidityData(payload.validityData, payload.invalid),
        }),
      );
    },
  );

  createEffect(
    () => id(),
    (idValue) => {
      return () => {
        if (!idValue) {
          return;
        }
        queueMicrotask(() => {
          setFormRef('fields', (fields: Record<string, unknown>) => {
            delete fields[idValue];
          });
        });
      };
    },
  );
}

export interface UseFieldParameters {
  enabled?: MaybeAccessor<boolean | undefined>;
  value: MaybeAccessor<unknown>;
  getValue?: (() => unknown) | undefined;
  id: MaybeAccessor<string | false | undefined>;
  name?: MaybeAccessor<string | false | undefined>;
  commit: (value: unknown) => void;
  /**
   * A ref to a focusable element that receives focus when the field fails
   * validation during form submission.
   */
  controlRef: MaybeAccessor<any>;
}
