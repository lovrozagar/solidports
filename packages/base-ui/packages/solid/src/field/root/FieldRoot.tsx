import { createMemo, createRenderEffect, createSignal, onSettled, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useFieldsetRootContext } from '../../fieldset/root/FieldsetRootContext';
import type { Form } from '../../form';
import { useFormContext } from '../../form/FormContext';
import { useFieldControlRegistration } from '../../internals/field-register-control/useFieldControlRegistration';
import { LabelableProvider } from '../../internals/labelable-provider';
import {
  live,
  splitComponentProps,
  useRef,
  type ReactLikeRef,
  provideContext,
} from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { DEFAULT_VALIDITY_STATE, fieldValidityMapping } from '../utils/constants';
import { FieldRootContext } from './FieldRootContext';
import { useFieldValidation } from './useFieldValidation';

/**
 * @internal
 */
function FieldRootInner(componentProps: FieldRoot.Props) {
  const { errors, validationMode: formValidationMode, submitCountRef } = useFormContext();

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'validate',
    'validationDebounceTime',
    'validationMode',
    'name',
    'disabled',
    'invalid',
    'dirty',
    'touched',
    'actionsRef',
  ]);
  const validationDebounceTime = () => local.validationDebounceTime ?? 0;
  const validationMode = () => local.validationMode ?? formValidationMode();
  const name = () => local.name;
  const disabledProp = () => local.disabled ?? false;
  const invalidProp = () => local.invalid;
  const dirtyProp = () => local.dirty;
  const touchedProp = () => local.touched;

  const fieldsetContext = useFieldsetRootContext(true);
  const disabledFieldset = () => fieldsetContext?.disabled() ?? false;

  const validate: UseValidate = (value, formValues) =>
    local.validate ? local.validate(value, formValues) : null;

  const disabled = () => disabledFieldset() || disabledProp();

  // Solid: `ownedWrite` because controls reset these from their unmount cleanups.
  const [touchedState, setTouchedUnwrapped] = createSignal(false, { ownedWrite: true });
  const [dirtyState, setDirtyUnwrapped] = createSignal(false, { ownedWrite: true });
  const [filledState, setFilled] = createSignal(false, { ownedWrite: true });
  // Solid: a control whose filled or dirty state follows reactive values registers it as a source,
  // so the field derives it in the same flush (React's controls set them from layout effects).
  const [filled, registerFilledSource] = createSourcedState(filledState, setFilled);
  const [sourcedDirty, registerDirtySource] = createSourcedState(dirtyState, setDirtyUnwrapped);
  const [focused, setFocused] = createSignal(false, { ownedWrite: true });

  const dirty = () => dirtyProp() ?? sourcedDirty();
  const touched = () => touchedProp() ?? touchedState();

  const markedDirtyRef = useRef(untrack(dirty));
  const registeredFieldIdRef = useRef<string | undefined>(undefined);
  const [registeredFieldName, setRegisteredFieldName] = createSignal<string | undefined>(
    undefined,
    { ownedWrite: true },
  );
  const effectiveName = () => name() ?? registeredFieldName();

  createRenderEffect(dirtyProp, (value) => {
    if (value !== undefined) {
      markedDirtyRef.current = value;
    }
  });

  const setDirty: typeof setDirtyUnwrapped = ((value: Parameters<typeof setDirtyUnwrapped>[0]) => {
    if (untrack(dirtyProp) !== undefined) {
      return undefined;
    }

    if (value) {
      markedDirtyRef.current = true;
    }
    return setDirtyUnwrapped(value);
  }) as typeof setDirtyUnwrapped;

  const setTouched: typeof setTouchedUnwrapped = ((
    value: Parameters<typeof setTouchedUnwrapped>[0],
  ) => {
    if (untrack(touchedProp) !== undefined) {
      return undefined;
    }
    return setTouchedUnwrapped(value);
  }) as typeof setTouchedUnwrapped;

  const shouldValidateOnChange = () =>
    untrack(validationMode) === 'onChange' ||
    (untrack(validationMode) === 'onSubmit' && submitCountRef.current > 0);

  const invalid = createMemo(() => {
    const fieldName = effectiveName();
    const formErrors = errors();
    const formError =
      fieldName && Object.hasOwn(formErrors, fieldName) ? formErrors[fieldName] : null;
    const hasFormError = !!(Array.isArray(formError) ? formError.length : formError);
    return invalidProp() === true || hasFormError;
  });

  const [validityDataState, setValidityData] = createSignal<FieldValidityData>(
    {
      state: DEFAULT_VALIDITY_STATE,
      error: '',
      errors: [],
      value: null,
      initialValue: null,
    },
    { ownedWrite: true },
  );
  // Solid: a live view so parts read `validityData.state` like React's object, tracked in
  // computations and untracked in handlers.
  const readValidityData = live(validityDataState);
  const validityData: FieldValidityData = {
    get state() {
      return readValidityData().state;
    },
    get error() {
      return readValidityData().error;
    },
    get errors() {
      return readValidityData().errors;
    },
    get value() {
      return readValidityData().value;
    },
    get initialValue() {
      return readValidityData().initialValue;
    },
  };

  // App-controlled invalidity (the `invalid` prop and `<Form>` errors) keeps the field marked
  // invalid even while disabled. Only computed validity (native constraints and `validate`)
  // is suppressed when disabled, matching `:disabled` not participating in constraint validation.
  const valid = createMemo(() => !invalid() && (disabled() ? null : validityData.state.valid));

  const readDisabled = live(disabled);
  const readTouched = live(touched);
  const readDirty = live(dirty);
  const readValid = live(valid);
  const readFilled = live(filled);
  const readFocused = live(focused);

  const state: FieldRootState = {
    get disabled() {
      return readDisabled();
    },
    get touched() {
      return readTouched();
    },
    get dirty() {
      return readDirty();
    },
    get valid() {
      return readValid();
    },
    get filled() {
      return readFilled();
    },
    get focused() {
      return readFocused();
    },
  };

  const validation = useFieldValidation({
    setValidityData,
    validate,
    validityData,
    validationDebounceTime,
    invalid,
    markedDirtyRef,
    state,
    shouldValidateOnChange,
    validationMode,
    registeredFieldIdRef,
    name: effectiveName,
  });

  const [validateFieldControl, registerFieldControl] = useFieldControlRegistration({
    change: validation.change,
    commit: validation.commit,
    invalid,
    markedDirtyRef,
    name,
    setRegisteredFieldName,
    registeredFieldIdRef,
    setValidityData,
    validityData,
  });

  // Solid: a render effect so the handle exists before descendant and sibling user effects run,
  // as React's `useImperativeHandle` does.
  createRenderEffect(
    () => local.actionsRef,
    (actionsRef) => {
      if (!actionsRef) {
        return undefined;
      }
      actionsRef.current = { validate: validateFieldControl };
      return () => {
        actionsRef.current = null;
      };
    },
  );

  const contextValue: FieldRootContext = {
    invalid,
    name: effectiveName,
    validityData,
    setValidityData,
    disabled,
    setTouched,
    setDirty,
    setFilled,
    registerFilledSource,
    registerDirtySource,
    setFocused,
    validationMode,
    shouldValidateOnChange,
    state,
    registerFieldControl,
    validation,
    touched,
    dirty,
    filled,
    focused,
  };

  const element = useRenderElement('div', componentProps, {
    state,
    props: elementProps,
    stateAttributesMapping: fieldValidityMapping,
  });

  return provideContext(FieldRootContext, contextValue, element);
}

type UseValidate = (
  value: unknown,
  formValues: Form.Values,
) => string | string[] | null | void | Promise<string | string[] | null | void>;

/**
 * Groups all parts of the field.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldRoot(componentProps: FieldRoot.Props) {
  return (
    <LabelableProvider>
      <FieldRootInner {...componentProps} />
    </LabelableProvider>
  );
}

export interface FieldValidityData {
  state: {
    badInput: boolean;
    customError: boolean;
    patternMismatch: boolean;
    rangeOverflow: boolean;
    rangeUnderflow: boolean;
    stepMismatch: boolean;
    tooLong: boolean;
    tooShort: boolean;
    typeMismatch: boolean;
    valueMissing: boolean;
    valid: boolean | null;
  };
  error: string;
  errors: string[];
  value: unknown;
  initialValue: unknown;
}

export interface FieldRootActions {
  validate: () => void;
}

export interface FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the field has been touched.
   */
  touched: boolean;
  /**
   * Whether the field value has changed from its initial value.
   */
  dirty: boolean;
  /**
   * Whether the field is valid.
   */
  valid: boolean | null;
  /**
   * Whether the field has a value.
   */
  filled: boolean;
  /**
   * Whether the field is focused.
   */
  focused: boolean;
}

export interface FieldRootProps extends BaseUIComponentProps<'div', FieldRootState> {
  /**
   * Whether the component should ignore user interaction.
   * Takes precedence over the `disabled` prop on the `<Field.Control>` component.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   * Takes precedence over the `name` prop on the `<Field.Control>` component.
   */
  name?: string | undefined;
  /**
   * A function for custom validation. Return a string or an array of strings with
   * the error message(s) if the value is invalid. Returning nothing, `null`, an empty
   * string, or an empty array means the value is valid.
   * Asynchronous functions are supported, but they do not prevent form submission
   * when using `validationMode="onSubmit"`.
   */
  validate?:
    | ((
        value: unknown,
        formValues: Form.Values,
      ) => string | string[] | null | void | Promise<string | string[] | null | void>)
    | undefined;
  /**
   * Determines when the field should be validated.
   * This takes precedence over the `validationMode` prop on `<Form>`.
   *
   * - `onSubmit`: triggers validation when the form is submitted, and re-validates on change after submission.
   * - `onBlur`: triggers validation when the control loses focus.
   * - `onChange`: triggers validation on every change to the control value.
   *
   * @default 'onSubmit'
   */
  validationMode?: Form.ValidationMode | undefined;
  /**
   * How long to wait between `validate` callbacks if
   * `validationMode="onChange"` is used. Specified in milliseconds.
   * @default 0
   */
  validationDebounceTime?: number | undefined;
  /**
   * Whether the field is invalid.
   * Useful when the field state is controlled by an external library.
   */
  invalid?: boolean | undefined;
  /**
   * Whether the field's value has been changed from its initial value.
   * Useful when the field state is controlled by an external library.
   */
  dirty?: boolean | undefined;
  /**
   * Whether the field has been touched.
   * Useful when the field state is controlled by an external library.
   */
  touched?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `validate`: Validates the field when called.
   */
  actionsRef?: ReactLikeRef<FieldRoot.Actions | null> | undefined;
}

export namespace FieldRoot {
  export type State = FieldRootState;
  export type Props = FieldRootProps;
  export type Actions = FieldRootActions;
}

/**
 * A field state that a control can derive: `register(source)` makes `source` the value once the
 * control is mounted, until it unmounts (keeping the last value). Registered after mounting, since a
 * control can be created inside a computation that reads the state (a render prop), where writing
 * the source during setup would re-run that computation.
 */
function createSourcedState(
  state: Accessor<boolean>,
  setState: (value: boolean) => void,
): [Accessor<boolean>, (source: Accessor<boolean>) => void] {
  const [source, setSource] = createSignal<Accessor<boolean> | undefined>(undefined, {
    ownedWrite: true,
  });
  const value = createMemo(() => {
    const current = source();
    return current ? current() : state();
  });
  function register(nextSource: Accessor<boolean>) {
    onSettled(() => {
      setSource(() => nextSource);
      return () => {
        if (untrack(source) === nextSource) {
          // Keep the value: a control replaced by a new instance (a render prop re-run) hands
          // over without the state changing in between.
          setState(untrack(nextSource));
          setSource(undefined);
        }
      };
    });
  }
  return [value, register];
}
