import { createMemo, createSignal, Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useControlled } from '../../utils/useControlled';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { ownerWindow } from '../../utils/owner';
import { getDefaultFormSubmitter } from '../../utils/getDefaultFormSubmitter';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { useRenderElement } from '../../utils/useRenderElement';
import { useBaseUiId } from '../../utils/useBaseUiId';
import type {
  BaseUIComponentProps,
  BaseUIEvent,
  BaseUIHTMLProps,
  HTMLProps,
  NonNativeButtonProps,
} from '../../utils/types';
import { mergeProps } from '../../merge-props';
import { useButton } from '../../internals/use-button/useButton';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useFormContext } from '../../form/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useCheckboxGroupContext } from '../../checkbox-group/CheckboxGroupContext';
import { CheckboxRootContext } from './CheckboxRootContext';
import {
  BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { useValueChanged } from '../../internals/useValueChanged';
import {
  createDepsEffect,
  splitComponentProps,
  useRef,
  type ReactLikeRef,
} from '../../solid-helpers';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

export const PARENT_CHECKBOX = 'data-parent';

/**
 * Represents the checkbox itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Checkbox](https://base-ui.com/react/components/checkbox)
 */
export function CheckboxRoot(componentProps: CheckboxRoot.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'checked',
    'defaultChecked',
    'aria-labelledby',
    'disabled',
    'form',
    'id',
    'indeterminate',
    'inputRef',
    'name',
    'onCheckedChange',
    'parent',
    'readOnly',
    'required',
    'uncheckedValue',
    'value',
    'nativeButton',
  ]);
  const checkedProp = () => local.checked;
  const defaultChecked = () => local.defaultChecked ?? false;
  const ariaLabelledByProp = () => local['aria-labelledby'];
  const disabledProp = () => local.disabled ?? false;
  const form = () => local.form;
  const idProp = () => local.id;
  const indeterminate = () => local.indeterminate ?? false;
  const nameProp = () => local.name;
  const parent = () => local.parent ?? false;
  const readOnly = () => local.readOnly ?? false;
  const required = () => local.required ?? false;
  const valueProp = () => local.value;
  const nativeButton = () => local.nativeButton ?? false;

  const { clearErrors } = useFormContext();
  const {
    disabled: rootDisabled,
    name: fieldName,
    registerDirtySource,
    setDirty,
    setFilled,
    setFocused,
    setTouched,
    state: fieldState,
    validationMode,
    validityData,
    validation: localValidation,
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const { labelId, registerControlId, getDescriptionProps } = useLabelableContext();

  const groupContext = useCheckboxGroupContext();
  const parentContext = () =>
    groupContext == null || groupContext.allValues() === undefined
      ? undefined
      : groupContext.parent;
  const isGroupedWithParent = () => parentContext() !== undefined;

  const disabled = () =>
    Boolean(
      rootDisabled() || fieldItemContext.disabled() || groupContext?.disabled() || disabledProp(),
    );
  const name = () => fieldName() ?? nameProp();
  const value = () => valueProp() ?? name();

  const id = useBaseUiId();

  // A `CheckboxGroup` is the field's control and takes its name from `aria-labelledby`, so the
  // checkboxes sharing its labelable scope must not claim the field's control id: they would all
  // render that one id and collide. A `Field.Item` opens a scope the checkbox does own.
  const ownsControlId = groupContext?.registerControlId !== registerControlId;

  // `|| undefined` rather than `??`: an empty `id` falls back to the scope's control id.
  const controlId = useLabelableId({ id: () => idProp() || undefined, enabled: ownsControlId });

  const rootId = () => (nativeButton() ? controlId() : id());

  // Solid: a memo, as React derives the group props once per render.
  const groupProps = createMemo((): Partial<GroupProps> => {
    const context = parentContext();
    if (context !== undefined) {
      if (parent()) {
        return context.getParentProps();
      }
      const childValue = value();
      if (childValue !== undefined) {
        return context.getChildProps(childValue);
      }
    }
    return {};
  });

  const groupChecked = () => {
    const checked = groupProps().checked;
    return checked === undefined ? checkedProp() : checked;
  };
  const groupIndeterminate = () => {
    const groupValue = groupProps().indeterminate;
    return groupValue === undefined ? indeterminate() : groupValue;
  };
  const otherGroupProps = (): HTMLProps => {
    const ariaControls = groupProps()['aria-controls'];
    return ariaControls === undefined ? {} : { 'aria-controls': ariaControls };
  };

  const groupValue = () => groupContext?.value();

  const controlRef = useRef<HTMLButtonElement | null | undefined>(null);
  // Solid: the rendered root as a signal, so the child id registration reads the id it renders.
  const [rootElement, setRootElement] = createSignal<HTMLElement | null | undefined>(null, {
    ownedWrite: true,
  });

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const validation = groupContext?.validation ?? localValidation;

  const [checked, setCheckedState] = useControlled({
    controlled: () => {
      const childValue = value();
      const currentGroupValue = groupValue();
      return childValue !== undefined && currentGroupValue !== undefined && !parent()
        ? currentGroupValue.includes(childValue)
        : groupChecked();
    },
    default: defaultChecked,
    name: 'Checkbox',
    state: 'checked',
  });

  const computedChecked = () => (isGroupedWithParent() ? Boolean(groupChecked()) : checked());
  const computedIndeterminate = () =>
    isGroupedWithParent() ? groupIndeterminate() || indeterminate() : indeterminate();

  useRegisterFieldControl(
    controlRef,
    id,
    checked,
    undefined,
    () => !groupContext && !disabled(),
    nameProp,
  );

  const registerChildId = () => parentContext()?.registerChildId;

  const inputRef = useRef<HTMLInputElement | null | undefined>(null);
  // Solid: the hidden input as a signal, so registration and label lookup follow its mount.
  const [inputElement, setInputElement] = createSignal<HTMLInputElement | null | undefined>(null, {
    ownedWrite: true,
  });
  const registeredInputValue = () => (groupContext ? value() : undefined);
  // Solid: React registers the input through a ref callback with a cleanup; an effect keyed on
  // the same inputs registers it and unregisters it on change and unmount.
  createDepsEffect(
    () => ({ element: inputElement(), parent: parent(), value: registeredInputValue() }),
    ({ element, parent: isParent, value: inputValue }) => {
      if (!element || isParent) {
        return undefined;
      }
      return validation.registerInput(element, { controlRef, value: inputValue }) ?? undefined;
    },
  );
  const setInputRef = (element: HTMLInputElement | null | undefined) => {
    inputRef.current = element;
    setInputElement(element);
    const inputRefProp = untrack(() => local.inputRef);
    if (typeof inputRefProp === 'function') {
      inputRefProp(element ?? null);
    } else if (inputRefProp) {
      inputRefProp.current = element;
    }
  };

  const ariaLabelledBy = useAriaLabelledBy(
    ariaLabelledByProp,
    labelId,
    inputElement,
    !untrack(nativeButton),
    controlId,
  );

  createDepsEffect(
    () => ({
      checked: checked(),
      indeterminate: computedIndeterminate(),
      element: inputElement(),
    }),
    (deps) => {
      if (deps.element) {
        // Re-assert on `checked` changes too: clicking the input natively resets `indeterminate`.
        deps.element.indeterminate = deps.indeterminate;
      }
      // Inside a group, the group derives the filled state from its value.
      if (!groupContext) {
        setFilled(deps.checked);
      }
    },
  );

  // React sets `dirty` from a layout effect when the value changes; the field derives it.
  // Inside a group, the group derives the dirty state from its value.
  if (!groupContext) {
    registerDirtySource(() => checked() !== validityData.initialValue);
  }

  useValueChanged(checked, () => {
    if (groupContext) {
      return;
    }

    const currentChecked = untrack(checked);
    clearErrors(untrack(name));
    setDirty(currentChecked !== validityData.initialValue);

    validation.change(currentChecked);
  });

  let lastClickEventRef: MouseEvent | undefined;

  const inputProps = (): BaseUIHTMLProps<HTMLInputElement> =>
    mergeProps<'input'>(
      {
        checked: checked(),
        disabled: disabled(),
        form: form(),
        // parent checkboxes unset `name` to be excluded from form submission
        name: parent() ? undefined : name(),
        // Set `id` to stop Chrome warning about an unassociated input.
        // When using a native button, the `id` is applied to the button instead.
        id: nativeButton() ? undefined : controlId(),
        required: required(),
        ref: setInputRef,
        style: name() ? visuallyHiddenInput : visuallyHidden,
        tabindex: -1,
        type: 'checkbox',
        'aria-hidden': 'true',
        onChange(event) {
          const input = event.currentTarget as HTMLInputElement;
          // Workaround for https://github.com/facebook/react/issues/9023
          if (event.defaultPrevented) {
            return;
          }

          if (untrack(readOnly)) {
            event.preventDefault();
            // Solid: restore the controlled DOM state, as React does after its handlers run.
            input.checked = untrack(checked);
            return;
          }

          const nextChecked = input.checked;
          // Solid: React's checkbox `onChange` is the click event, which carries the modifier
          // keys; the native `change` event does not, so use the click that toggled the input.
          const details = createChangeEventDetails(REASONS.none, lastClickEventRef ?? event);
          lastClickEventRef = undefined;

          local.onCheckedChange?.(nextChecked, details);

          if (!details.isCanceled) {
            untrack(groupProps).onCheckedChange?.(nextChecked, details);
          }

          if (details.isCanceled) {
            // Solid: restore the controlled DOM state, as React does after its handlers run.
            input.checked = untrack(checked);
            return;
          }

          setCheckedState(nextChecked);

          const childValue = untrack(value);
          if (
            childValue !== undefined &&
            groupContext != null &&
            !untrack(parent) &&
            !untrack(isGroupedWithParent)
          ) {
            const currentGroupValue = untrack(groupContext.value);
            const nextGroupValue = nextChecked
              ? [...currentGroupValue, childValue]
              : currentGroupValue.filter((item) => item !== childValue);

            groupContext.setValue(nextGroupValue, details);
          }

          // Solid: React re-renders the controlled input after the change; re-assert the DOM
          // state once the writes apply, so a rejected change does not leave it toggled.
          queueMicrotask(() => {
            const currentChecked = untrack(checked);
            if (input.checked !== currentChecked) {
              input.checked = currentChecked;
            }
          });
        },
        onClick(event) {
          lastClickEventRef = event;
          // The click dispatched from the root's `onClick` is an implementation detail
          // and must not reach ancestors, which already receive the original click.
          event.stopPropagation();
        },
        onFocus() {
          controlRef.current?.focus();
        },
      },
      // Solid writes `undefined` to an input's `value` as '', so only set the value if defined.
      valueProp() !== undefined
        ? { value: (groupContext ? checked() && valueProp() : valueProp()) || '' }
        : {},
      getDescriptionProps,
      (props: BaseUIHTMLProps<HTMLInputElement>) =>
        validation.getValidationProps(disabled(), props),
    );

  createDepsEffect(
    () => ({ parentContext: parentContext(), disabled: disabled(), value: value() }),
    (deps) => {
      if (!deps.parentContext || deps.value === undefined) {
        return undefined;
      }

      const disabledStates = deps.parentContext.disabledStatesRef.current;
      const childValue = deps.value;
      disabledStates.set(childValue, deps.disabled);

      return () => {
        disabledStates.delete(childValue);
      };
    },
  );

  const state: CheckboxRootState = solidMergeProps(fieldState, {
    get checked() {
      return computedChecked();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get required() {
      return required();
    },
    get indeterminate() {
      return computedIndeterminate();
    },
  });

  const stateAttributesMapping = getCheckboxStateAttributesMapping(state);

  const element = useRenderElement('span', componentProps, {
    state,
    ref: [buttonRef, controlRef, setRootElement],
    get props() {
      return [
        {
          id: rootId(),
          role: 'checkbox',
          'aria-checked': computedIndeterminate() ? 'mixed' : String(computedChecked()),
          'aria-readonly': readOnly() ? 'true' : undefined,
          'aria-required': required() ? 'true' : undefined,
          'aria-labelledby': ariaLabelledBy(),
          [PARENT_CHECKBOX as string]: parent() ? '' : undefined,
          onFocus() {
            if (!untrack(disabled)) {
              setFocused(true);
            }
          },
          onBlur() {
            const inputEl = inputRef.current;
            if (!inputEl) {
              return;
            }

            setTouched(true);
            setFocused(false);

            if (untrack(validationMode) === 'onBlur') {
              validation.commit(groupContext ? untrack(groupValue) : inputEl.checked);
            }
          },
          onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
            if (event.key !== 'Enter') {
              return;
            }

            // Let consumer `preventDefault()` handlers opt out while defensively stopping
            // any remaining Base UI Enter handling from treating the checkbox as a button.
            event.preventBaseUIHandler();

            if (event.defaultPrevented) {
              return;
            }

            const formToSubmit = inputRef.current?.form ?? null;
            const currentTarget = event.currentTarget as HTMLElement;
            const originalPreventDefault = event.preventDefault;
            let preventDefaultCalledAfterPropagation = false;

            // Solid: native events have no synthetic layer, so the native `preventDefault` is
            // patched alone to detect ancestors opting out during propagation.
            event.preventDefault = () => {
              preventDefaultCalledAfterPropagation = true;
              originalPreventDefault.call(event);
            };

            // Enter should not activate/toggle the checkbox. Cancel the native button behavior.
            originalPreventDefault.call(event);

            ownerWindow(currentTarget).queueMicrotask(() => {
              event.preventDefault = originalPreventDefault;

              if (!preventDefaultCalledAfterPropagation) {
                getDefaultFormSubmitter(formToSubmit)?.click();
              }
            });
          },
          onClick(event: MouseEvent) {
            if (untrack(readOnly) || untrack(disabled)) {
              return;
            }

            event.preventDefault();

            const input = inputRef.current;
            if (!input) {
              return;
            }

            dispatchClickWithModifiers(input, event);
          },
        },
        elementProps,
        otherGroupProps(),
        getButtonProps,
        getDescriptionProps,
        (props: HTMLProps) => validation.getValidationProps(disabled(), props),
      ];
    },
    stateAttributesMapping,
  });

  // Solid: React reads the id from the rendered element's props; a `render` function can set its
  // own, so read it from the mounted element (DOM attributes apply before user effects).
  createDepsEffect(
    () => ({
      registerChildId: registerChildId(),
      parent: parent(),
      value: value(),
      element: rootElement(),
      rootId: rootId(),
    }),
    (rawDeps) => {
      const deps = {
        ...rawDeps,
        renderedId: rawDeps.element ? rawDeps.element.id || undefined : rawDeps.rootId,
      };
      if (
        !deps.registerChildId ||
        deps.parent ||
        deps.value === undefined ||
        deps.renderedId === undefined
      ) {
        return undefined;
      }

      return deps.registerChildId(deps.value, deps.renderedId);
    },
  );

  return (
    <CheckboxRootContext value={state}>
      {element()}
      <Show
        when={
          !checked() && !groupContext && name() && !parent() && local.uncheckedValue !== undefined
        }
      >
        <input
          type="hidden"
          form={form()}
          name={name()}
          value={local.uncheckedValue}
          disabled={disabled()}
        />
      </Show>
      <input {...(inputProps() as JSX.InputHTMLAttributes<HTMLInputElement>)} />
    </CheckboxRootContext>
  );
}

type GroupProps = {
  checked: boolean;
  indeterminate: boolean;
  'aria-controls': string | undefined;
  onCheckedChange: (checked: boolean, eventDetails: CheckboxRootChangeEventDetails) => void;
};

export interface CheckboxRootState extends FieldRootState {
  /**
   * Whether the checkbox is currently ticked.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   */
  required: boolean;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   */
  indeterminate: boolean;
}

export interface CheckboxRootProps
  extends
    NonNativeButtonProps,
    Omit<BaseUIComponentProps<'span', CheckboxRootState>, 'onChange' | 'value'> {
  /**
   * The id of the input element.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   * @default undefined
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the checkbox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Whether the checkbox is currently ticked.
   *
   * To render an uncontrolled checkbox, use the `defaultChecked` prop instead.
   * @default undefined
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox is initially ticked.
   *
   * To render a controlled checkbox, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Event handler called when the checkbox is ticked or unticked.
   */
  onCheckedChange?:
    ((checked: boolean, eventDetails: CheckboxRootChangeEventDetails) => void) | undefined;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   * @default false
   */
  indeterminate?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?:
    | ReactLikeRef<HTMLInputElement | null | undefined>
    | ((el: HTMLInputElement | null) => void)
    | undefined;
  /**
   * Whether the checkbox controls a group of child checkboxes.
   *
   * Must be used in a [Checkbox Group](https://base-ui.com/react/components/checkbox-group).
   * @default false
   */
  parent?: boolean | undefined;
  /**
   * The value submitted with the form when the checkbox is unchecked.
   * By default, unchecked checkboxes do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
  /**
   * The checkbox's value. Identifies it within a [Checkbox Group](https://base-ui.com/react/components/checkbox-group), falling back to `name` when omitted.
   * When submitting a form, a checked box submits `value`; with no `value`, it submits the native "on".
   */
  value?: string | undefined;
}

export type CheckboxRootChangeEventReason = typeof REASONS.none;
export type CheckboxRootChangeEventDetails =
  BaseUIChangeEventDetails<CheckboxRoot.ChangeEventReason>;

export namespace CheckboxRoot {
  export type State = CheckboxRootState;
  export type Props = CheckboxRootProps;
  export type ChangeEventReason = CheckboxRootChangeEventReason;
  export type ChangeEventDetails = CheckboxRootChangeEventDetails;
}
