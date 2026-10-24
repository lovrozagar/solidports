import { createEffect, createSignal, onSettled, untrack } from 'solid-js';
import { isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { activeElement } from '../../floating-ui-solid/utils';
import { useFormContext } from '../../form/FormContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useValueChanged } from '../../internals/useValueChanged';
import { splitComponentProps, useRef } from '../../solid-helpers';
import { canRenderNative, partHandler } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import type { BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useControlled } from '../../utils/useControlled';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../root/FieldRootContext';
import { useSetFieldFocused } from '../root/useSetFieldFocused';
import { fieldValidityMapping } from '../utils/constants';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

const INPUT = { tag: 'input', create: () => (<input />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set([
  'id',
  'name',
  'value',
  'disabled',
  'onValueChange',
  'defaultValue',
  'autofocus',
  // Merged with the field's own: the description ids and the invalid state.
  'aria-describedby',
  'aria-invalid',
]);
const writeControlState = compileStateWriter(
  ['disabled', 'touched', 'dirty', 'valid', 'filled', 'focused'],
  fieldValidityMapping,
);

/** What the native control's attributes and handlers read: one object per control. */
interface FieldControlModel {
  id: () => string | undefined;
  disabled: () => boolean;
  name: () => string | undefined;
  labelId: () => string | undefined;
  autofocus: () => boolean | string;
  valueProps: () => { value?: unknown; defaultValue?: unknown };
  validation: { readonly 'aria-describedby'?: unknown; readonly 'aria-invalid'?: unknown };
  onInput: (event: InputEvent) => void;
  onFocus: () => void;
  onBlur: (event: FocusEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

/** The control's attributes, as its slow path's props merge produces them. */
function writeControlAttributes(w: SetAttribute, model: FieldControlModel) {
  w.set('id', model.id());
  w.set('disabled', model.disabled() || undefined);
  w.set('name', model.name());
  w.set('aria-labelledby', model.labelId());
  const autofocus = model.autofocus();
  w.set('autofocus', autofocus === false ? undefined : autofocus);
  const valueProps = model.valueProps();
  if ('value' in valueProps) {
    w.set('value', valueProps.value);
  } else {
    w.set('defaultValue', valueProps.defaultValue);
  }
  w.set('aria-describedby', model.validation['aria-describedby']);
  w.set('aria-invalid', model.validation['aria-invalid']);
}

const CONTROL_HANDLERS = {
  onInput: partHandler<FieldControlModel, InputEvent>('onInput', (model, event) =>
    model.onInput(event),
  ),
  onFocus: partHandler<FieldControlModel>('onFocus', (model) => model.onFocus()),
  onBlur: partHandler<FieldControlModel, FocusEvent>('onBlur', (model, event) =>
    model.onBlur(event),
  ),
  onKeyDown: partHandler<FieldControlModel, KeyboardEvent>('onKeyDown', (model, event) =>
    model.onKeyDown(event),
  ),
};

/**
 * The form control to label and validate.
 * Renders an `<input>` element.
 *
 * You can omit this part and use any Base UI input component instead. For example,
 * [Input](https://base-ui.com/react/components/input), [Checkbox](https://base-ui.com/react/components/checkbox),
 * or [Select](https://base-ui.com/react/components/select), among others, will work with Field out of the box.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldControl(componentProps: FieldControl.Props): JSX.Element {
  const local = componentProps;
  // Solid: JSX attribute types allow `false` to remove the attribute; it means unset here.
  const idProp = () => (local.id === false ? undefined : local.id);
  const nameProp = () => (local.name === false ? undefined : local.name);
  const valueProp = () => local.value;
  const disabledProp = () => local.disabled ?? false;
  const autofocus = () => local.autofocus ?? false;

  const {
    state: fieldState,
    name: fieldName,
    disabled: fieldDisabled,
    setTouched,
    registerDirtySource,
    setDirty,
    validityData,
    registerFilledSource,
    validationMode,
    validation,
  } = useFieldRootContext();
  const { clearErrors, elementRef: formElementRef, submitCountRef } = useFormContext();

  const disabled = () => Boolean(fieldDisabled() || disabledProp());
  const name = () => fieldName() ?? nameProp();

  const state: FieldControlState = solidMergeProps(fieldState, {
    get disabled() {
      return disabled();
    },
  });

  const { labelId } = useLabelableContext();

  const id = useLabelableId({ id: idProp });

  // `defaultValue` is forwarded to the input. Tracking it here would warn when it changes,
  // which is how an untouched control picks up a new default.
  const initialDefaultValue = untrack(() => local.defaultValue);
  const [valueUnwrapped] = useControlled({
    controlled: valueProp,
    default: initialDefaultValue,
    name: 'FieldControl',
    state: 'value',
  });

  const isControlled = () => valueProp() !== undefined;
  const value = () => (isControlled() ? valueUnwrapped() : undefined);
  // The DOM value is always a string, so dirty comparisons must serialize the controlled value.
  const serializedValue = () => {
    const currentValue = value();
    return currentValue == null ? undefined : String(currentValue);
  };

  const getValueFromInput = () => validation.inputRef.current?.value;

  useRegisterFieldControl(
    validation.inputRef,
    id,
    serializedValue,
    getValueFromInput,
    () => !disabled(),
    nameProp,
  );

  // A controlled value derives `filled`; an uncontrolled input reports its DOM value at mount and
  // on input.
  const [inputFilled, setInputFilled] = createSignal(false, { ownedWrite: true });
  // Likewise `dirty`: a controlled value derives it; an uncontrolled input reports it on input.
  const [inputDirty, setInputDirty] = createSignal(false, { ownedWrite: true });
  registerDirtySource(() => {
    const currentValue = serializedValue();
    return currentValue !== undefined
      ? currentValue !== (validityData.initialValue ?? '')
      : inputDirty();
  });
  registerFilledSource(() => {
    const currentValue = serializedValue();
    return currentValue !== undefined ? currentValue !== '' : inputFilled();
  });
  onSettled(() => {
    const inputValue = validation.inputRef.current?.value;
    if (inputValue !== undefined) {
      setInputFilled(inputValue !== '');
    }
  });
  // A later `defaultValue` updates the DOM value only while the user has not edited it.
  // Refresh `filled` from that DOM value either way. Solid: the compute also re-runs when the
  // merged props it reads through change, so act only on a new `defaultValue`.
  let lastDefaultValue = initialDefaultValue;
  createEffect(
    () => local.defaultValue,
    (nextDefaultValue) => {
      if (nextDefaultValue === lastDefaultValue) {
        return;
      }
      lastDefaultValue = nextDefaultValue;
      if (untrack(isControlled)) {
        return;
      }
      const inputValue = validation.inputRef.current?.value;
      if (inputValue !== undefined) {
        setInputFilled(inputValue !== '');
      }
    },
  );

  useValueChanged(serializedValue, () => {
    const nextSerializedValue = untrack(serializedValue);
    if (nextSerializedValue === undefined) {
      return;
    }

    clearErrors(untrack(name));
    setDirty(nextSerializedValue !== (validityData.initialValue ?? ''));

    validation.change(nextSerializedValue);
  });

  const inputRef = useRef<HTMLInputElement | null | undefined>(null);
  const setFocused = useSetFieldFocused(disabled, inputRef);
  const enterValidationTimeout = useTimeout();

  // Solid: a replacement control can attach before the outgoing one's unmount runs, so only
  // clear the shared input ref while it still points at this control's element.
  const setValidationInputRef = (element: HTMLInputElement | null) => {
    if (element) {
      validation.inputRef.current = element;
    } else if (validation.inputRef.current === inputRef.current) {
      validation.inputRef.current = null;
    }
  };

  createEffect(autofocus, (shouldAutofocus) => {
    if (
      shouldAutofocus &&
      inputRef.current === activeElement(ownerDocument(inputRef.current ?? null))
    ) {
      setFocused(true);
    }
  });

  // Solid re-applies an input's `value` property on every spread update (like a React controlled
  // input), so uncontrolled inputs must only pass `defaultValue`. The server renders it as the
  // `value` attribute, as React does (a `defaultValue` prop has none).
  const valueProps = () => {
    if (isControlled()) {
      return { value: value() };
    }
    return isServer ? { value: local.defaultValue } : { defaultValue: local.defaultValue };
  };

  const handlers = {
    onInput(event: InputEvent) {
      const inputValue = (event.currentTarget as HTMLInputElement).value;
      const details = createChangeEventDetails(REASONS.none, event);
      local.onValueChange?.(inputValue, details);

      // Controlled values sync from the `value` prop instead, so that a value the consumer
      // rejects or rewrites never reaches the field state.
      if (untrack(isControlled)) {
        return;
      }

      // `validation.change` reads `markedDirtyRef`, so update dirty before validating.
      setDirty(inputValue !== (validityData.initialValue ?? ''));
      setInputDirty(inputValue !== (validityData.initialValue ?? ''));
      setInputFilled(inputValue !== '');

      // Workaround for https://github.com/facebook/react/issues/9023
      if (!event.defaultPrevented && !details.isCanceled) {
        clearErrors(untrack(name));
        validation.change(inputValue);
      }
    },
    onFocus() {
      setFocused(true);
    },
    onBlur(event: FocusEvent) {
      setTouched(true);
      setFocused(false);

      if (untrack(validationMode) === 'onBlur') {
        const inputValue = (event.currentTarget as HTMLInputElement).value;
        validation.commit(inputValue);

        if (untrack(isControlled)) {
          // Controlled blur handlers can normalize the value before this microtask runs.
          // A rewrite back to the initial value is a programmatic reset: the field looks
          // pristine, so committing it would only surface `valueMissing` noise.
          queueMicrotask(() => {
            const nextValue = validation.inputRef.current?.value;
            if (
              nextValue !== undefined &&
              nextValue !== inputValue &&
              nextValue !== (validityData.initialValue ?? '')
            ) {
              validation.commit(nextValue);
            }
          });
        }
      }
    },
    onKeyDown(event: KeyboardEvent) {
      const target = event.currentTarget as HTMLInputElement;
      if (target.tagName === 'INPUT' && event.key === 'Enter') {
        setTouched(true);
        const inputValue = target.value;
        const form = target.form;
        if (form && form === formElementRef.current && !event.defaultPrevented) {
          const input = target;
          const submitCount = submitCountRef.current;

          // Implicit submission runs after keydown. Fall back unless Form handles it first.
          enterValidationTimeout.start(0, () => {
            if (submitCountRef.current === submitCount) {
              validation.commit(input.value);
            }
          });
        } else {
          validation.commit(inputValue);
        }
      }
    },
  };

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<input>` with the
  // field's attributes, validation and handlers, no props view (D32), on the server and while
  // hydrating too: the server prints the value as the `value` attribute, and the kit hands a
  // control's form state over after hydration as the slow path does.
  if (canRenderNative(componentProps, undefined, true)) {
    const model: FieldControlModel = {
      id,
      disabled: () => Boolean(disabled()),
      name,
      labelId,
      autofocus,
      valueProps,
      validation: validation.getValidationSource(disabled, componentProps as Record<string, unknown>),
      ...handlers,
    };
    return renderNativeElement(INPUT, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeControlState,
      mapping: fieldValidityMapping,
      attributes: writeControlAttributes,
      handlers: CONTROL_HANDLERS,
      handlerTarget: model,
      reactive: true,
      refs: [
        setValidationInputRef,
        (el: HTMLInputElement | null) => {
          inputRef.current = el;
        },
      ],
      consumerChildren: false,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, [
    'id',
    'name',
    'value',
    'disabled',
    'onValueChange',
    'defaultValue',
    'autofocus',
  ]);

  const element = useRenderElement('input', componentProps, {
    ref: [setValidationInputRef, inputRef],
    state,
    get props() {
      return [
        {
          get id() {
            return id();
          },
          get disabled() {
            return disabled();
          },
          get name() {
            return name();
          },
          get 'aria-labelledby'() {
            return labelId();
          },
          get autofocus() {
            return autofocus();
          },
          ...handlers,
        },
        valueProps(),
        elementProps,
        (props: HTMLProps) => validation.getValidationProps(disabled(), props),
      ];
    },
    stateAttributesMapping: fieldValidityMapping,
  });

  return element();
}

export interface FieldControlState extends FieldRootState {}

export interface FieldControlProps extends BaseUIComponentProps<'input', FieldControlState> {
  /**
   * Callback fired when the `value` changes. Use when controlled.
   */
  onValueChange?:
    ((value: string, eventDetails: FieldControl.ChangeEventDetails) => void) | undefined;
  defaultValue?: JSX.InputHTMLAttributes<HTMLInputElement>['value'] | undefined;
}

export type FieldControlChangeEventReason = typeof REASONS.none;

export type FieldControlChangeEventDetails =
  BaseUIChangeEventDetails<FieldControl.ChangeEventReason>;

export namespace FieldControl {
  export type State = FieldControlState;
  export type Props = FieldControlProps;
  export type ChangeEventReason = FieldControlChangeEventReason;
  export type ChangeEventDetails = FieldControlChangeEventDetails;
}
