import { createEffect, createSignal, onSettled, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';

import { callEventHandler, splitComponentProps, provideContext } from '../solid-helpers';
import type { ReactLikeRef } from '../solid-helpers';
import { EMPTY_OBJECT } from '../utils/constants';
import { createGenericEventDetails } from '../utils/createBaseUIEventDetails';
import type { BaseUIGenericEventDetails } from '../utils/createBaseUIEventDetails';
import { REASONS } from '../utils/reasons';
import type { BaseUIComponentProps } from '../utils/types';
import { useRenderElement } from '../utils/useRenderElement';
import { canRenderNative } from '../utils/native';
import { provideNativeContext } from '../utils/native/context';
import { renderNativeElement } from '../utils/native/element';
import type { HandlerRecord } from '../utils/native/consumer';
import { FormContext } from './FormContext';
import type { Errors } from './FormContext';

const FORM = { tag: 'form', create: () => (<form />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set([
  'onSubmit',
  'validationMode',
  'errors',
  'onFormSubmit',
  'actionsRef',
]);
const FORM_LITERAL = { novalidate: true };

/**
 * The form's submit handler: the form calls the consumer's `onSubmit` itself, once its fields are
 * valid, so the handler dispatches to the form alone.
 */
const FORM_HANDLERS = {
  onSubmit: (record: HandlerRecord<{ onSubmit: (event: SubmitEvent) => void }>, event: Event) =>
    record.target.onSubmit(event as SubmitEvent),
};

/**
 * A native form element with consolidated error handling.
 * Renders a `<form>` element.
 *
 * Documentation: [Base UI Form](https://base-ui.com/react/components/form)
 */
export function Form<FormValues extends Record<string, any> = Record<string, any>>(
  componentProps: Form.Props<FormValues>,
) {
  const local = componentProps;
  const validationMode = () => local.validationMode ?? 'onSubmit';

  const externalErrors = () => local.errors;
  const formRef: FormContext['formRef'] = { fields: new Map() };
  const elementRef: FormContext['elementRef'] = { current: null };
  let submittedRef = false;
  const submitCountRef: FormContext['submitCountRef'] = { current: 0 };

  const focusFirstInvalid = () => {
    // A field can be invalid without a focusable control (for example a checkbox group whose
    // custom validation failed while every checkbox is unmounted, disabled, or reassociated).
    // Keep submission blocked, but move focus to the first invalid field that has a usable control.
    // Registration order can diverge from DOM order (keyed fields reordered without
    // remounting, portals), so pick the first control by document position. For controls
    // in disconnected trees (e.g. separate shadow roots), where document position is
    // implementation-specific, keep registration order.
    let hasInvalid = false;
    let firstControl: HTMLElement | null = null;
    for (const field of formRef.fields.values()) {
      if (field.validityData.state.valid !== false) {
        continue;
      }
      hasInvalid = true;
      const control = field.controlRef.current;
      if (control && (!firstControl || comesBeforeInSameTree(control, firstControl))) {
        firstControl = control;
      }
    }
    if (firstControl) {
      firstControl.focus();
      if (firstControl.tagName === 'INPUT') {
        (firstControl as HTMLInputElement).select();
      }
      return true;
    }
    return hasInvalid;
  };

  // React keeps `errors` in state and resets it whenever the `errors` prop changes
  // (`useValueChanged`). A writable derived signal models the same reset-on-prop-change state.
  const [errors, setErrors] = createSignal<Errors | undefined>(() => externalErrors());

  createEffect(errors, () => {
    if (!submittedRef) {
      return;
    }

    submittedRef = false;
    // React runs child effects before parent effects, so its fields have registered their new
    // validity by the time this runs. Solid runs this parent effect first, so wait for the
    // fields' registration effects in the same flush before reading their validity.
    queueMicrotask(() => {
      untrack(focusFirstInvalid);
    });
  });

  const handleImperativeValidate = (fieldName?: string | undefined) => {
    if (fieldName) {
      Array.from(formRef.fields.values())
        .find((field) => field.name === fieldName)
        ?.validate();
    } else {
      formRef.fields.forEach((field) => {
        field.validate();
      });
    }
  };

  onSettled(() => {
    if (local.actionsRef) {
      local.actionsRef.current = { validate: handleImperativeValidate };
    }
  });

  function handleSubmit(event: SubmitEvent) {
    submitCountRef.current += 1;

    // Async validation isn't supported to stop the submit event.
    formRef.fields.forEach((field) => {
      field.validate();
    });

    if (focusFirstInvalid()) {
      event.preventDefault();
      return;
    }

    submittedRef = true;
    callEventHandler(local.onSubmit, event as any);

    if (local.onFormSubmit) {
      event.preventDefault();

      const formValues = {} as FormValues;
      formRef.fields.forEach((field) => {
        if (field.name) {
          (formValues as Record<string, any>)[field.name] = field.getValue();
        }
      });

      local.onFormSubmit(formValues, createGenericEventDetails(REASONS.none, event));
    }
  }

  const clearErrors = (name: string | undefined) => {
    if (!name) {
      return;
    }
    setErrors((previousErrors) => {
      if (!previousErrors || !Object.hasOwn(previousErrors, name)) {
        return previousErrors;
      }
      const nextErrors = { ...previousErrors };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const contextValue: FormContext = {
    clearErrors,
    errors: () => errors() ?? EMPTY_OBJECT,
    elementRef,
    formRef,
    submitCountRef,
    validationMode,
  };

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<form>` with its submit
  // handler, no props view (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    return provideNativeContext(FormContext, contextValue, () =>
      renderNativeElement(FORM, componentProps, {
        own: OWN_KEYS,
        state: EMPTY_OBJECT,
        stateAttributes: false,
        literal: FORM_LITERAL,
        handlers: FORM_HANDLERS,
        handlerTarget: { onSubmit: handleSubmit },
        reactive: false,
        refs: [
          (el: HTMLFormElement | null) => {
            elementRef.current = el;
          },
        ],
      }),
    ) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, [
    'onSubmit',
    'validationMode',
    'errors',
    'onFormSubmit',
    'actionsRef',
  ]);

  const element = useRenderElement('form', componentProps, {
    ref: elementRef,
    props: [
      {
        novalidate: true,
        onSubmit: handleSubmit,
      },
      elementProps,
    ],
  });

  return provideContext(FormContext, contextValue, element);
}

/* eslint-disable no-bitwise */
function comesBeforeInSameTree(element: Node, reference: Node) {
  const position = element.compareDocumentPosition(reference);
  return (
    (position & Node.DOCUMENT_POSITION_DISCONNECTED) === 0 &&
    (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}

export type FormSubmitEventReason = typeof REASONS.none;
export type FormSubmitEventDetails = BaseUIGenericEventDetails<Form.SubmitEventReason>;

export type FormValidationMode = 'onSubmit' | 'onBlur' | 'onChange';

export interface FormActions {
  validate: (fieldName?: string | undefined) => void;
}

export interface FormState {}

export interface FormProps<
  FormValues extends Record<string, any> = Record<string, any>,
> extends BaseUIComponentProps<'form', FormState, JSX.FormHTMLAttributes<HTMLFormElement>> {
  /**
   * Determines when the form should be validated.
   * The `validationMode` prop on `<Field.Root>` takes precedence over this.
   *
   * - `onSubmit` (default): validates the field when the form is submitted, afterwards fields will re-validate on change.
   * - `onBlur`: validates a field when it loses focus.
   * - `onChange`: validates the field on every change to its value.
   *
   * @default 'onSubmit'
   */
  validationMode?: FormValidationMode | undefined;
  /**
   * Validation errors returned externally, typically after submission by a server or a form action.
   * This should be an object where keys correspond to the `name` attribute on `<Field.Root>`,
   * and values correspond to error(s) related to that field.
   */
  errors?: Errors | undefined;
  /**
   * Event handler called when the form is submitted.
   * `preventDefault()` is called on the native submit event when used.
   */
  onFormSubmit?:
    ((formValues: FormValues, eventDetails: Form.SubmitEventDetails) => void) | undefined;
  /**
   * A ref to imperative actions.
   * - `validate`: Validates all fields when called. Optionally pass a field name to validate a single field.
   * @example
   * ```tsx
   * // validate all fields
   * actionsRef.current?.validate();
   *
   * // validate one field
   * actionsRef.current?.validate('email');
   * ```
   */
  actionsRef?: ReactLikeRef<Form.Actions | null> | undefined;
}

export namespace Form {
  export type Props<FormValues extends Record<string, any> = Record<string, any>> =
    FormProps<FormValues>;
  export type State = FormState;
  export type Actions = FormActions;
  export type ValidationMode = FormValidationMode;
  export type SubmitEventReason = FormSubmitEventReason;
  export type SubmitEventDetails = FormSubmitEventDetails;

  export type Values<FormValues extends Record<string, any> = Record<string, any>> = FormValues;
}
