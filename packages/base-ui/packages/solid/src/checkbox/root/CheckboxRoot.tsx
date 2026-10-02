/* eslint-disable typescript/no-explicit-any -- ref forwarding + input prop spread bridge */
import { createTrackedEffect, createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js';
import { useCheckboxGroupContext } from '../../checkbox-group/CheckboxGroupContext';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useField } from '../../field/useField';
import { useFormContext } from '../../form/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { mergeProps } from '../../merge-props';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button/useButton';
import {
  BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { NOOP } from '../../utils/noop';
import { REASONS } from '../../utils/reasons';
import type {
  BaseUIComponentProps,
  BaseUIHTMLProps,
  NonNativeButtonProps,
} from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useControlled } from '../../utils/useControlled';
import { useRenderElement } from '../../utils/useRenderElement';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { useStateAttributesMapping } from '../utils/useStateAttributesMapping';
import { CheckboxRootContext } from './CheckboxRootContext';
import { on, mergeProps as solidMergeProps, splitProps } from '../../solid-1-compat';

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
    'render',
    'required',
    'uncheckedValue',
    'value',
    'nativeButton',
  ]);
  const checkedProp = () => local.checked;
  const defaultChecked = () => local.defaultChecked ?? false;
  const ariaLabelledByProp = () => local['aria-labelledby'];
  const disabledProp = () => Boolean(local.disabled);
  const formProp = () => local.form;
  const idProp = () => local.id;
  const indeterminate = () => local.indeterminate ?? false;
  const nameProp = () => local.name;
  const parent = () => local.parent ?? false;
  const readOnly = () => local.readOnly ?? false;
  const required = () => local.required ?? false;
  const valueProp = () => local.value;
  const nativeButton = () => Boolean(local.nativeButton);

  const { clearErrors } = useFormContext();
  const {
    disabled: rootDisabled,
    name: fieldName,
    setDirty,
    setFilled,
    setFocused,
    setTouched,
    state: fieldState,
    validationMode,
    validityData,
    shouldValidateOnChange,
    validation: localValidation,
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const { labelId, controlId, registerControlId, getDescriptionProps } = useLabelableContext();

  const groupContext = useCheckboxGroupContext();
  const parentContext = () => groupContext?.parent;
  const isGroupedWithParent = createMemo(() => parentContext() && groupContext?.allValues());

  const disabled = () =>
    rootDisabled() || fieldItemContext.disabled() || groupContext?.disabled() || disabledProp();
  const name = () => fieldName() ?? nameProp();
  const value = () => valueProp() ?? name();

  const id = useBaseUiId();

  const parentId = useBaseUiId();
  const inputId = createMemo(() => {
    if (isGroupedWithParent()) {
      const ctx = parentContext();
      return parent() || !ctx ? parentId() : `${ctx.id()}-${value()}`;
    }
    if (idProp()) {
      return idProp();
    }
    return controlId();
  });

  const groupProps = createMemo(() => {
    let mainProps = {} as Partial<Omit<CheckboxRoot.Props, 'class'>>;
    const ctx = groupContext;
    if (isGroupedWithParent() && ctx) {
      if (parent()) {
        mainProps = ctx.parent.getParentProps();
      } else {
        const v = value();
        if (v) {
          mainProps = ctx.parent.getChildProps(v);
        }
      }
    }

    const [localGroup, otherGorup] = splitProps(mainProps, [
      'checked',
      'indeterminate',
      'onCheckedChange',
    ]);
    return {
      local: {
        get checked() {
          return localGroup.checked ?? checkedProp();
        },
        get indeterminate() {
          return localGroup.indeterminate ?? indeterminate();
        },
        get onCheckedChange() {
          return localGroup.onCheckedChange;
        },
      },
      other: otherGorup,
    };
  });

  const groupValue = () => groupContext?.value();
  const setGroupValue = groupContext?.setValue;
  const defaultGroupValue = () => groupContext?.defaultValue();

  const [controlRef, setControlRef] = createSignal<HTMLButtonElement | null | undefined>(null);
  const controlSourceRef = Symbol('checkbox-control');
  let hasRegisteredRef = false;

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
  });

  const validation = createMemo(() => groupContext?.validation ?? localValidation);

  const [checked, setCheckedState] = useControlled({
    controlled: () => {
      const v = value();
      const gv = groupValue();
      return v && gv && !parent() ? gv.includes(v) : groupProps().local.checked;
    },
    default: () => {
      const v = value();
      const dgv = defaultGroupValue();
      return v && dgv && !parent() ? dgv.includes(v) : defaultChecked();
    },
    name: 'Checkbox',
    state: 'checked',
  });

  // can't use useLabelableId because of optional groupContext and/or parent
  createEffect(...on([inputId, parent], () => {
      if (registerControlId === NOOP) {
        return;
      }

      hasRegisteredRef = true;
      registerControlId(controlSourceRef, inputId());
    }),
  );

  onCleanup(() => {
    if (!hasRegisteredRef || registerControlId === NOOP) {
      return;
    }

    hasRegisteredRef = false;
    registerControlId(controlSourceRef, undefined);
  });

  useField({
    commit: (...args) => validation().commit(...args),
    controlRef,
    enabled: () => !groupContext,
    getValue: () => checked(),
    id,
    name,
    value: checked,
  });

  let inputRef = null as HTMLInputElement | null | undefined;
  let lastClickEvent: PointerEvent | undefined;

  const ariaLabelledBy = useAriaLabelledBy(ariaLabelledByProp, labelId, () => inputRef, !nativeButton(), () => inputId() ?? undefined);

  createTrackedEffect(() => {
    if (inputRef) {
      inputRef.indeterminate = groupProps().local.indeterminate;
      if (checked()) {
        setFilled(true);
      }
    }
  });

  createEffect(...on(
      checked,
      () => {
        if (groupContext && !parent()) {
          return;
        }

        clearErrors(name());
        setFilled(checked());
        setDirty(checked() !== validityData.initialValue);

        if (shouldValidateOnChange()) {
          validation().commit(checked());
        } else {
          validation().commit(checked(), true);
        }
      },
      { defer: true },
    ),
  );

  const inputProps = createMemo<BaseUIHTMLProps<HTMLInputElement>>(() => {
    return mergeProps<'input'>(
      {
        get checked() {
          return checked();
        },
        get disabled() {
          return disabled();
        },
        get form() {
          return formProp();
        },
        // parent checkboxes unset `name` to be excluded from form submission
        get name() {
          return parent() ? undefined : name();
        },
        // Set `id` to stop Chrome warning about an unassociated input
        get id() {
          return nativeButton() ? undefined : (inputId() ?? undefined);
        },
        get required() {
          return required();
        },
        ref: (el) => {
          inputRef = el;
          validation().inputRef.current = el;
        },
        get style() {
          return name() ? visuallyHiddenInput : visuallyHidden;
        },
        tabindex: -1,
        type: 'checkbox',
        'aria-hidden': 'true',
        onChange(event) {
          const groupContextValue = groupContext?.value();
          // Workaround for https://github.com/facebook/react/issues/9023
          if (event.defaultPrevented) {
            return;
          }

          const nextChecked = event.target.checked;
          // Use the stored click event if available, as the native `change` event
          // doesn't carry keyboard modifier properties (shiftKey, ctrlKey, etc.)
          const details = createChangeEventDetails(REASONS.none, lastClickEvent ?? event);
          lastClickEvent = undefined;

          groupProps().local.onCheckedChange?.(nextChecked, details);
          local.onCheckedChange?.(nextChecked, details);

          if (details.isCanceled) {
            return;
          }

          setCheckedState(nextChecked);

          const v = value();
          if (v && groupContextValue && setGroupValue && !parent()) {
            const nextGroupValue = nextChecked
              ? [...groupContextValue, v]
              : groupContextValue.filter((item) => item !== v);

            setGroupValue(nextGroupValue, details);
          }
        },
        onFocus() {
          controlRef()?.focus();
        },
        // React <19 sets an empty value if `undefined` is passed explicitly
        // To avoid this, we only set the value if it's defined
        get value() {
          return valueProp() !== undefined
            ? (groupContext ? checked() && local.value : local.value) || ''
            : undefined;
        },
      },

      getDescriptionProps,
      groupContext ? validation().getValidationProps : validation().getInputValidationProps,
    );
  });
  const computedChecked = createMemo(() =>
    isGroupedWithParent() ? Boolean(groupProps().local.checked) : checked(),
  );
  const computedIndeterminate = createMemo(() =>
    isGroupedWithParent() ? groupProps().local.indeterminate || indeterminate() : indeterminate(),
  );

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    const val = value();
    const ctx = parentContext();
    if (!ctx || !val) {
      return;
    }

    const disabledStates = ctx.disabledStatesRef;
    disabledStates.set(val, disabled());

    _c.push(() => {
      disabledStates.delete(val);
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  const state: CheckboxRoot.State = solidMergeProps(fieldState, {
    get checked() {
      return computedChecked();
    },
    get disabled() {
      return disabled();
    },
    get indeterminate() {
      return computedIndeterminate();
    },
    get readOnly() {
      return readOnly();
    },
    get required() {
      return required();
    },
  });

  const stateAttributesMapping = useStateAttributesMapping(state);

  const element = useRenderElement('span', componentProps, {
    get props() {
      return [
        {
          get id() {
            return nativeButton() ? (inputId() ?? undefined) : id();
          },
          role: 'checkbox',
          get 'aria-checked'() {
            return groupProps().local.indeterminate ? 'mixed' : String(checked());
          },
          get 'aria-readonly'() {
            return readOnly() || undefined;
          },
          get 'aria-required'() {
            return required() || undefined;
          },
          get 'aria-labelledby'() {
            return ariaLabelledBy();
          },
          get [PARENT_CHECKBOX as string]() {
            return parent() ? '' : undefined;
          },
          onFocus() {
            setFocused(true);
          },
          onBlur() {
            if (!inputRef) {
              return;
            }

            {
              setTouched(true);
              setFocused(false);

              if (validationMode() === 'onBlur') {
                validation().commit(groupContext ? groupValue() : inputRef?.checked);
              }
            };
          },
          onClick(event: MouseEvent) {
            if (readOnly() || disabled()) {
              return;
            }

            event.preventDefault();

            const clickEvent = new PointerEvent('click', {
              bubbles: true,
              shiftKey: event.shiftKey,
              ctrlKey: event.ctrlKey,
              altKey: event.altKey,
              metaKey: event.metaKey,
            });
            lastClickEvent = clickEvent;
            inputRef?.dispatchEvent(clickEvent);
          },
        },
        getDescriptionProps,
        validation().getValidationProps,
        elementProps,
        mergeProps(groupProps().other),
        getButtonProps,
      ];
    },
    ref: (el) => {
      buttonRef(el);
      setControlRef(el as any);
      groupContext?.registerControlRef(el as any);
    },
    state,
    stateAttributesMapping,
  });

  const contextValue = { state };

  return (
    <CheckboxRootContext value={contextValue}>
      {element()}
      <Show
        when={
          !checked() && !groupContext && name() && !parent() && local.uncheckedValue !== undefined
        }
      >
        <input type="hidden" form={formProp()} name={name()} value={local.uncheckedValue} />
      </Show>
      <input {...(inputProps() as any)} />
    </CheckboxRootContext>
  );
}

export interface CheckboxRootState extends FieldRoot.State {
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
    Omit<BaseUIComponentProps<'span', CheckboxRoot.State>, 'onChange' | 'value'> {
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
   *
   * @param {boolean} checked The new checked state.
   * @param {Event} event The corresponding event that initiated the change.
   */
  onCheckedChange?:
    | ((checked: boolean, eventDetails: CheckboxRootChangeEventDetails) => void)
    | undefined;
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
  inputRef?: (HTMLInputElement | null) | undefined;
  /**
   * Whether the checkbox controls a group of child checkboxes.
   *
   * Must be used in a [Checkbox Group](https://base-ui.com/react/components/checkbox-group).
   * @default false
   */
  parent?: boolean;
  /**
   * The value submitted with the form when the checkbox is unchecked.
   * By default, unchecked checkboxes do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
  /**
   * The value of the selected checkbox.
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
