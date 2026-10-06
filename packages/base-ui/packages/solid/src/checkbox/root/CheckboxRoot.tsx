import {
  createMemo,
  createRenderEffect,
  createSignal,
  getOwner,
  isStatic,
  Show,
  untrack,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import { assign, insert } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { DEFAULT_FIELD_ROOT_CONTEXT } from '../../field/root/FieldRootContext';
import { DEFAULT_LABELABLE_CONTEXT } from '../../internals/labelable-provider/LabelableContext';
import { NOOP } from '../../utils/noop';
import {
  attachNativeAttributes,
  canRenderNative,
  createNativeElement,
  elementRefs,
  consumerHas,
  createLabelFallback,
  createLayout,
  fieldAttributes,
  fieldOwnedKeys,
  fieldStateAttributes,
  finishAttributes,
  literalClassStyle,
  put,
  runConsumerHandler,
  stateAttr,
  type NativeLayout,
} from '../../utils/native';
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
import { makeEventPreventable, mergeProps } from '../../merge-props';
import { useButton } from '../../internals/use-button/useButton';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { createFieldPropSources } from '../../field/root/fieldPropSources';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { DEFAULT_FIELD_ITEM_CONTEXT, useFieldItemContext } from '../../field/item/FieldItemContext';
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
  omitComponentProps,
  provideContext,
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
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): the `<span role="checkbox">`
  // and its hidden input rendered with direct JSX. A `render` prop, spread props, a native
  // `<button>` (`nativeButton`), a reactive `parent`, the server and hydration keep the slow path.
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
    !untrack(() => componentProps.nativeButton)
  ) {
    return NativeCheckboxRoot(componentProps);
  }

  const elementProps = omitComponentProps(componentProps, [
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
  ] as const);
  const checkedProp = () => componentProps.checked;
  const defaultChecked = () => componentProps.defaultChecked ?? false;
  const ariaLabelledByProp = () => componentProps['aria-labelledby'];
  const disabledProp = () => componentProps.disabled ?? false;
  const form = () => componentProps.form;
  const idProp = () => componentProps.id;
  const indeterminate = () => componentProps.indeterminate ?? false;
  const nameProp = () => componentProps.name;
  const parent = () => componentProps.parent ?? false;
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const valueProp = () => componentProps.value;
  const nativeButton = () => componentProps.nativeButton ?? false;

  const { clearErrors } = useFormContext();
  const fieldRootContext = useFieldRootContext();
  const {
    disabled: rootDisabled,
    name: fieldName,
    registerDirtySource,
    registerFilledSource,
    setDirty,
    setFocused,
    setTouched,
    state: fieldState,
    validationMode,
    validityData,
    validation: localValidation,
  } = fieldRootContext;
  const fieldItemContext = useFieldItemContext();
  const labelableContext = useLabelableContext();
  const { labelId, registerControlId } = labelableContext;
  const fieldSources = createFieldPropSources(labelableContext, fieldRootContext);

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

  // Solid: a memo, as React derives the group props once per render. Outside a group there are
  // none (the group context is fixed for the checkbox's lifetime).
  const groupProps: Accessor<Partial<GroupProps>> = !groupContext
    ? () => NO_GROUP_PROPS
    : createMemo((): Partial<GroupProps> => {
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

  const { buttonSources, buttonRef } = useButton({
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
    const inputRefProp = untrack(() => componentProps.inputRef);
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
    },
  );

  // React sets `filled` and `dirty` from effects when the value changes; the field derives them.
  // Inside a group, the group derives both from its value.
  if (!groupContext) {
    registerFilledSource(checked);
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

  // Built once per `disabled` and value presence (what the merge's function sources and key set
  // depend on); every other key is a getter, so a checked change updates only `checked`.
  const inputProps = createMemo((): BaseUIHTMLProps<HTMLInputElement> => {
    const isDisabled = disabled();
    const hasValue = valueProp() !== undefined;
    return mergeProps<'input'>(
      {
        get checked() {
          return checked();
        },
        get disabled() {
          return disabled();
        },
        get form() {
          return form();
        },
        // parent checkboxes unset `name` to be excluded from form submission
        get name() {
          return parent() ? undefined : name();
        },
        // Set `id` to stop Chrome warning about an unassociated input.
        // When using a native button, the `id` is applied to the button instead.
        get id() {
          return nativeButton() ? undefined : controlId();
        },
        get required() {
          return required();
        },
        ref: setInputRef,
        get style() {
          return name() ? visuallyHiddenInput : visuallyHidden;
        },
        tabindex: -1,
        type: 'checkbox',
        'aria-hidden': 'true',
        onChange(event) {
          const details = inputChangeDetails(event, lastClickEventRef, checked, readOnly);
          lastClickEventRef = undefined;
          if (!details) {
            return;
          }
          const nextChecked = (event.currentTarget as HTMLInputElement).checked;

          componentProps.onCheckedChange?.(nextChecked, details);

          if (!details.isCanceled) {
            untrack(groupProps).onCheckedChange?.(nextChecked, details);
          }

          commitInputChange(event, details, nextChecked, checked, setCheckedState, groupContext, {
            value,
            parent,
            isGroupedWithParent,
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
      hasValue
        ? {
            get value() {
              return (groupContext ? checked() && valueProp() : valueProp()) || '';
            },
          }
        : {},
      ...fieldSources((props: BaseUIHTMLProps<HTMLInputElement>) =>
        validation.getValidationProps(isDisabled, props),
      ),
    );
  });

  // Group-only registrations: outside a group there is no parent to register with.
  if (groupContext) {
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
  }

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

  // Built once: every value is a getter, so a state change updates only its attribute.
  const rootProps = {
    get id() {
      return rootId();
    },
    role: 'checkbox',
    get 'aria-checked'() {
      return computedIndeterminate() ? 'mixed' : String(computedChecked());
    },
    get 'aria-readonly'() {
      return readOnly() ? 'true' : undefined;
    },
    get 'aria-required'() {
      return required() ? 'true' : undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    get [PARENT_CHECKBOX as string]() {
      return parent() ? '' : undefined;
    },
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
      submitOnEnter(event, inputRef.current);
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
  };

  const element = useRenderElement('span', componentProps, {
    state,
    ref: [buttonRef, controlRef, setRootElement],
    // Built once (plan 7 step 3.4): the button's attributes below the part's props, its handlers
    // above them (wrapping the part's and the consumer's handlers, as `getButtonProps` did).
    props: [
      ...buttonSources.attributes,
      rootProps,
      elementProps,
      ...(groupContext ? [propsSourceAccessor(otherGroupProps)] : []),
      buttonSources.handlers,
      ...fieldSources((props: HTMLProps) => validation.getValidationProps(disabled(), props)),
    ],
    stateAttributesMapping,
  });

  // Solid: React reads the id from the rendered element's props; a `render` function can set its
  // own, so read it from the mounted element (DOM attributes apply before user effects).
  if (groupContext) {
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
  }

  return (
    <CheckboxRootContext value={state}>
      {element()}
      <Show
        when={
          !checked() &&
          !groupContext &&
          name() &&
          !parent() &&
          componentProps.uncheckedValue !== undefined
        }
      >
        <input
          type="hidden"
          form={form()}
          name={name()}
          value={componentProps.uncheckedValue}
          disabled={disabled()}
        />
      </Show>
      <input {...(inputProps() as JSX.InputHTMLAttributes<HTMLInputElement>)} />
    </CheckboxRootContext>
  );
}

const NO_GROUP_PROPS: Partial<GroupProps> = {};

/** Props the native path reads once, as the slow path reads `nativeButton` (and `parent`, fixed per mount). */
const NATIVE_STATIC_KEYS = ['nativeButton', 'parent', 'inputRef'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: readonly string[] = [
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
];
const OWN_KEYS_SET: ReadonlySet<string> = new Set(OWN_KEYS);

/**
 * The hidden input's `change`: the event details for the change the input just made, or
 * `undefined` when nothing changes (a prevented event, or a read-only checkbox, whose DOM state is
 * restored). React's checkbox `onChange` is the click event, which carries the modifier keys; the
 * native `change` event does not, so the click that toggled the input (`lastClick`) is used.
 */
function inputChangeDetails(
  event: Event,
  lastClick: MouseEvent | undefined,
  checked: Accessor<boolean>,
  readOnly: Accessor<boolean>,
): CheckboxRootChangeEventDetails | undefined {
  const input = event.currentTarget as HTMLInputElement;
  // Workaround for https://github.com/facebook/react/issues/9023
  if (event.defaultPrevented) {
    return undefined;
  }
  if (untrack(readOnly)) {
    event.preventDefault();
    // Solid: restore the controlled DOM state, as React does after its handlers run.
    input.checked = untrack(checked);
    return undefined;
  }
  return createChangeEventDetails(REASONS.none, lastClick ?? event);
}

/** Commits (or rejects) the hidden input's change after the change handlers ran. */
function commitInputChange(
  event: Event,
  details: CheckboxRootChangeEventDetails,
  nextChecked: boolean,
  checked: Accessor<boolean>,
  setCheckedState: (value: boolean) => void,
  groupContext: ReturnType<typeof useCheckboxGroupContext>,
  group: {
    value: Accessor<string | undefined>;
    parent: Accessor<boolean>;
    isGroupedWithParent: Accessor<boolean>;
  },
) {
  const input = event.currentTarget as HTMLInputElement;
  if (details.isCanceled) {
    // Solid: restore the controlled DOM state, as React does after its handlers run.
    input.checked = untrack(checked);
    return;
  }

  setCheckedState(nextChecked);

  const childValue = untrack(group.value);
  if (
    childValue !== undefined &&
    groupContext != null &&
    !untrack(group.parent) &&
    !untrack(group.isGroupedWithParent)
  ) {
    const currentGroupValue = untrack(groupContext.value);
    const nextGroupValue = nextChecked
      ? [...currentGroupValue, childValue]
      : currentGroupValue.filter((item) => item !== childValue);

    groupContext.setValue(nextGroupValue, details);
  }

  // Solid: React re-renders the controlled input after the change; re-assert the DOM state once
  // the writes apply, so a rejected change does not leave it toggled.
  queueMicrotask(() => {
    const currentChecked = untrack(checked);
    if (input.checked !== currentChecked) {
      input.checked = currentChecked;
    }
  });
}

/**
 * Enter on the checkbox submits its form (the default submitter's click) instead of toggling it,
 * unless a handler prevents the event's default during propagation.
 */
function submitOnEnter(event: BaseUIEvent<KeyboardEvent>, input: HTMLInputElement | null | undefined) {
  if (event.key !== 'Enter') {
    return;
  }

  // Let consumer `preventDefault()` handlers opt out while defensively stopping
  // any remaining Base UI Enter handling from treating the checkbox as a button.
  event.preventBaseUIHandler();

  if (event.defaultPrevented) {
    return;
  }

  const formToSubmit = input?.form ?? null;
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
}

/** What the native checkbox's handlers read when an event fires. */
interface NativeCheckbox {
  props: CheckboxRoot.Props;
  input: HTMLInputElement;
  disabled: Accessor<boolean>;
  readOnly: Accessor<boolean>;
  checked: Accessor<boolean>;
  setCheckedState: (value: boolean) => void;
  groupContext: ReturnType<typeof useCheckboxGroupContext>;
  groupProps: Accessor<Partial<GroupProps>>;
  groupValue: Accessor<string[] | undefined>;
  value: Accessor<string | undefined>;
  parent: Accessor<boolean>;
  isGroupedWithParent: Accessor<boolean>;
  lastClick: MouseEvent | undefined;
  field: ReturnType<typeof useFieldRootContext>;
  labelable: ReturnType<typeof useLabelableContext>;
  labelId: Accessor<string | undefined>;
  controlId: Accessor<string | undefined>;
  required: Accessor<boolean>;
  computedChecked: Accessor<boolean>;
  computedIndeterminate: Accessor<boolean>;
}

type CheckboxEvent<T extends Event> = BaseUIEvent<T>;

const ROOT_ATTRIBUTES = { role: 'checkbox' };
const HIDDEN_CHECKBOX_INPUT = { type: 'checkbox', tabindex: '-1', 'aria-hidden': 'true' };

// Layout flags: what can never change for one element (written once) and the contexts present.
const DISABLED_STATIC = 1;
const READONLY_STATIC = 2;
const REQUIRED_STATIC = 4;
const LABELLEDBY_STATIC = 8;
const IN_FIELD = 16;
const IN_LABELABLE = 32;
const INDETERMINATE_STATIC = 64;
const IN_GROUP = 128;
const IS_PARENT = 256;

type CheckboxLayout = NativeLayout<NativeCheckbox>;

/** The part's handler for a key the consumer also passes (the tuple reads the consumer itself). */
function wrapCheckboxHandler(key: string, model: NativeCheckbox): unknown {
  switch (key.toLowerCase()) {
    case 'onclick':
      return [rootClick, model];
    case 'onkeydown':
      return [rootKeyDown, model];
    case 'onkeyup':
      return [rootKeyUp, model];
    case 'onmousedown':
      return [rootMouseDown, model];
    case 'onpointerdown':
      return [rootPointerDown, model];
    case 'onfocus':
      return [rootFocus, model];
    case 'onblur':
      return [rootBlur, model];
    default:
      return undefined;
  }
}

/**
 * The root's attributes, in the slow path's order (the button's, the part's, the state's
 * `data-*`, the consumer's, then `class`/`style`): the literal pass (`once`) writes what can
 * never change; the dynamic pass (one render effect) the rest.
 */
function checkboxAttributes(l: CheckboxLayout, target: Record<string, unknown>, once: boolean) {
  const m = l.m;
  const f = l.flags;
  if (!once) {
    // The label fallback (after the apply) follows these: read them here so a change re-runs it.
    void l.props['aria-labelledby'];
    m.labelId();
    m.controlId();
  }
  if (once === Boolean(f & DISABLED_STATIC)) {
    const isDisabled = m.disabled();
    put(l, target, once, 'tabindex', isDisabled ? -1 : 0);
    put(l, target, once, 'aria-disabled', isDisabled ? 'true' : undefined);
    put(l, target, once, 'data-disabled', stateAttr(isDisabled));
  }
  const isIndeterminate = once ? false : m.computedIndeterminate();
  const isChecked = once ? false : m.computedChecked();
  if (!once) {
    put(l, target, once, 'aria-checked', isIndeterminate ? 'mixed' : String(isChecked));
  }
  if (once === Boolean(f & READONLY_STATIC)) {
    const isReadOnly = m.readOnly();
    put(l, target, once, 'aria-readonly', isReadOnly ? 'true' : undefined);
    put(l, target, once, 'data-readonly', stateAttr(isReadOnly));
  }
  if (once === Boolean(f & REQUIRED_STATIC)) {
    const isRequired = m.required();
    put(l, target, once, 'aria-required', isRequired ? 'true' : undefined);
    put(l, target, once, 'data-required', stateAttr(isRequired));
  }
  if (once === Boolean(f & LABELLEDBY_STATIC)) {
    const explicit = l.props['aria-labelledby'];
    put(l, target, once, 'aria-labelledby', (typeof explicit === 'string' ? explicit : undefined) ?? m.labelId());
  }
  if (once) {
    if (f & IS_PARENT) {
      put(l, target, once, PARENT_CHECKBOX, '');
    }
    return target;
  }
  if (f & IN_GROUP) {
    put(l, target, false, 'aria-controls', m.groupProps()['aria-controls']);
  }
  if (f & IN_FIELD) {
    fieldStateAttributes(m.field.state, target);
  }
  // `getCheckboxStateAttributesMapping`: `data-indeterminate` stands in for both.
  put(l, target, false, 'data-checked', !isIndeterminate && isChecked ? '' : undefined);
  put(l, target, false, 'data-unchecked', !isIndeterminate && !isChecked ? '' : undefined);
  if (!(f & INDETERMINATE_STATIC) || isIndeterminate) {
    put(l, target, false, 'data-indeterminate', stateAttr(isIndeterminate));
  }
  if (f & (IN_FIELD | IN_LABELABLE)) {
    fieldAttributes(m.labelable, m.field, m.disabled(), l.props, target);
  }
  return finishAttributes(l, target);
}

/** The part's handlers for the keys the consumer does not pass. */
function checkboxHandlers(l: CheckboxLayout, literal: Record<string, unknown>) {
  const m = l.m;
  if (!consumerHas(l, 'onClick')) {
    literal.onClick = [rootClick, m];
  }
  if (!consumerHas(l, 'onKeyDown')) {
    literal.onKeyDown = [rootKeyDown, m];
  }
  if (!consumerHas(l, 'onKeyUp')) {
    literal.onKeyUp = [rootKeyUp, m];
  }
  if (!consumerHas(l, 'onMouseDown')) {
    literal.onMouseDown = [rootMouseDown, m];
  }
  if (!consumerHas(l, 'onPointerDown')) {
    literal.onPointerDown = [rootPointerDown, m];
  }
  // Focus/blur only matter to a Field (touched/focused/validation on blur).
  if (l.flags & IN_FIELD) {
    if (!consumerHas(l, 'onFocus')) {
      literal.onFocus = [rootFocus, m];
    }
    if (!consumerHas(l, 'onBlur')) {
      literal.onBlur = [rootBlur, m];
    }
  }
}

// The root's handlers, shared by every native checkbox and bound per element with Solid's
// `[handler, data]` form: `useButton`'s gates for a non-native, non-composite button around the
// consumer's handler (first, as React's `mergeProps`), then the part's own logic.
function rootClick(m: NativeCheckbox, event: MouseEvent) {
  makeEventPreventable(event as CheckboxEvent<MouseEvent>);
  if (m.disabled()) {
    event.preventDefault();
    return;
  }
  if (runConsumerHandler(m.props, 'onClick', event as CheckboxEvent<MouseEvent>)) {
    return;
  }
  if (m.readOnly()) {
    return;
  }
  event.preventDefault();
  dispatchClickWithModifiers(m.input, event);
}
function rootKeyDown(m: NativeCheckbox, event: KeyboardEvent) {
  const baseUIEvent = makeEventPreventable(event as CheckboxEvent<KeyboardEvent>);
  if (m.disabled()) {
    return;
  }
  if (runConsumerHandler(m.props, 'onKeyDown', baseUIEvent)) {
    return;
  }
  submitOnEnter(baseUIEvent, m.input);
  // `useButton` after the consumer (non-native, non-composite): Space must not scroll the page;
  // Enter was already handled above.
  if (
    !baseUIEvent.baseUIHandlerPrevented &&
    event.target === event.currentTarget &&
    event.key === ' ' &&
    !event.defaultPrevented
  ) {
    event.preventDefault();
  }
}
function rootKeyUp(m: NativeCheckbox, event: KeyboardEvent) {
  const baseUIEvent = makeEventPreventable(event as CheckboxEvent<KeyboardEvent>);
  if (m.disabled()) {
    return;
  }
  if (runConsumerHandler(m.props, 'onKeyUp', baseUIEvent)) {
    return;
  }
  // `useButton` after the consumer: Space activates a non-native button on keyup.
  if (event.target === event.currentTarget && !event.defaultPrevented && event.key === ' ') {
    baseUIEvent.preventBaseUIHandler();
    dispatchClickWithModifiers(event.currentTarget as Element, event);
  }
}
function rootMouseDown(m: NativeCheckbox, event: MouseEvent) {
  makeEventPreventable(event as CheckboxEvent<MouseEvent>);
  if (!m.disabled()) {
    runConsumerHandler(m.props, 'onMouseDown', event as CheckboxEvent<MouseEvent>);
  }
}
function rootPointerDown(m: NativeCheckbox, event: PointerEvent) {
  makeEventPreventable(event as CheckboxEvent<PointerEvent>);
  if (m.disabled()) {
    event.preventDefault();
    return;
  }
  runConsumerHandler(m.props, 'onPointerDown', event as CheckboxEvent<PointerEvent>);
}
function rootFocus(m: NativeCheckbox, event: FocusEvent) {
  makeEventPreventable(event as CheckboxEvent<FocusEvent>);
  if (runConsumerHandler(m.props, 'onFocus', event as CheckboxEvent<FocusEvent>)) {
    return;
  }
  if (!m.disabled()) {
    m.field.setFocused(true);
  }
}
function rootBlur(m: NativeCheckbox, event: FocusEvent) {
  makeEventPreventable(event as CheckboxEvent<FocusEvent>);
  if (runConsumerHandler(m.props, 'onBlur', event as CheckboxEvent<FocusEvent>)) {
    return;
  }
  m.field.setTouched(true);
  m.field.setFocused(false);
  if (untrack(m.field.validationMode) === 'onBlur') {
    const validation = m.groupContext?.validation ?? m.field.validation;
    validation.commit(m.groupContext ? untrack(m.groupValue) : m.input.checked);
  }
}
function inputChange(m: NativeCheckbox, event: Event) {
  const details = inputChangeDetails(event, m.lastClick, m.checked, m.readOnly);
  m.lastClick = undefined;
  if (!details) {
    return;
  }
  const nextChecked = (event.currentTarget as HTMLInputElement).checked;
  m.props.onCheckedChange?.(nextChecked, details);
  if (!details.isCanceled) {
    untrack(m.groupProps).onCheckedChange?.(nextChecked, details);
  }
  commitInputChange(event, details, nextChecked, m.checked, m.setCheckedState, m.groupContext, m);
}
function inputClick(m: NativeCheckbox, event: MouseEvent) {
  m.lastClick = event;
  // The click dispatched from the root's `onClick` is an implementation detail
  // and must not reach ancestors, which already receive the original click.
  event.stopPropagation();
}
function focusControl(control: { current: HTMLElement | null | undefined }) {
  control.current?.focus();
}

/**
 * The native checkbox: the slow path's hooks (controlled state, Field/labelable registration,
 * group registration) with the root and the hidden input rendered directly. Attributes that can
 * never change are written once; the rest share one render effect per element.
 */
function NativeCheckboxRoot(props: CheckboxRoot.Props): JSX.Element {
  // The body runs untracked (`createComponent`): reads here subscribe to nothing.
  const { clearErrors } = useFormContext();
  const fieldRootContext = useFieldRootContext();
  const inField = fieldRootContext !== DEFAULT_FIELD_ROOT_CONTEXT;
  const fieldItemContext = useFieldItemContext();
  const inFieldItem = fieldItemContext !== DEFAULT_FIELD_ITEM_CONTEXT;
  const labelableContext = useLabelableContext();
  const inLabelable = labelableContext !== DEFAULT_LABELABLE_CONTEXT;
  const { labelId, registerControlId } = labelableContext;
  const groupContext = useCheckboxGroupContext();
  const validation = groupContext?.validation ?? fieldRootContext.validation;
  const fieldState = fieldRootContext.state;

  const isParent = Boolean(props.parent);
  const parent = () => isParent;
  const parentContext = () =>
    groupContext == null || groupContext.allValues() === undefined
      ? undefined
      : groupContext.parent;
  const isGroupedWithParent = () => parentContext() !== undefined;

  const disabled = () =>
    Boolean(
      fieldRootContext.disabled() ||
        fieldItemContext.disabled() ||
        groupContext?.disabled() ||
        props.disabled,
    );
  const readOnly = () => props.readOnly ?? false;
  const required = () => props.required ?? false;
  const indeterminate = () => props.indeterminate ?? false;
  const name = () => fieldRootContext.name() ?? props.name;
  const value = () => props.value ?? name();

  const id = useBaseUiId();
  const ownsControlId = groupContext?.registerControlId !== registerControlId;
  // `|| undefined` rather than `??`: an empty `id` falls back to the scope's control id.
  const controlId = useLabelableId({ id: () => props.id || undefined, enabled: ownsControlId });

  const groupProps: Accessor<Partial<GroupProps>> = !groupContext
    ? () => NO_GROUP_PROPS
    : createMemo((): Partial<GroupProps> => {
        const context = parentContext();
        if (context !== undefined) {
          if (isParent) {
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
    return checked === undefined ? props.checked : checked;
  };
  const groupIndeterminate = () => {
    const groupValue = groupProps().indeterminate;
    return groupValue === undefined ? indeterminate() : groupValue;
  };
  const groupValue = () => groupContext?.value();

  const [checked, setCheckedState] = useControlled({
    controlled: () => {
      const childValue = value();
      const currentGroupValue = groupValue();
      return childValue !== undefined && currentGroupValue !== undefined && !isParent
        ? currentGroupValue.includes(childValue)
        : groupChecked();
    },
    default: () => props.defaultChecked ?? false,
    name: 'Checkbox',
    state: 'checked',
  });
  const computedChecked = () => (isGroupedWithParent() ? Boolean(groupChecked()) : checked());
  const computedIndeterminate = () =>
    isGroupedWithParent() ? groupIndeterminate() || indeterminate() : indeterminate();

  const controlRef = useRef<HTMLElement | null | undefined>(null);
  useRegisterFieldControl(
    controlRef,
    id,
    checked,
    undefined,
    () => !groupContext && !disabled(),
    () => props.name,
  );
  if (!groupContext) {
    // React sets `filled` and `dirty` from effects when the value changes; the field derives them.
    fieldRootContext.registerFilledSource(checked);
    fieldRootContext.registerDirtySource(() => checked() !== fieldRootContext.validityData.initialValue);
    // Outside a Field and a Form the change effect has nothing to do (every call is a no-op).
    if (inField || clearErrors !== NOOP) {
      useValueChanged(checked, () => {
        const currentChecked = untrack(checked);
        clearErrors(untrack(name));
        fieldRootContext.setDirty(currentChecked !== fieldRootContext.validityData.initialValue);
        validation.change(currentChecked);
      });
    }
  }

  // The hidden input: literal attributes from the template, the rest in one render effect that
  // also re-asserts `indeterminate` (a native click resets it).
  const input = createNativeElement('input', HIDDEN_CHECKBOX_INPUT);
  const hasValue = 'value' in props;
  const inputAttributes = (): Record<string, unknown> => {
    const target: Record<string, unknown> = {
      checked: checked(),
      disabled: disabled(),
      form: props.form,
      // parent checkboxes unset `name` to be excluded from form submission
      name: isParent ? undefined : name(),
      // Set `id` to stop Chrome warning about an unassociated input.
      id: controlId(),
      required: required(),
      style: name() ? visuallyHiddenInput : visuallyHidden,
    };
    if (hasValue && props.value !== undefined) {
      // Solid writes `undefined` to an input's `value` as '', so only set the value if defined.
      target.value = (groupContext ? checked() && props.value : props.value) || '';
    }
    if (inField || inLabelable) {
      fieldAttributes(labelableContext, fieldRootContext, disabled(), undefined, target);
    }
    return target;
  };
  const previousInput: Record<string, unknown> = {};
  createRenderEffect(
    () => [inputAttributes(), computedIndeterminate()] as const,
    ([attributes, isIndeterminate]) => {
      assign(input, attributes, true, previousInput, true);
      // Re-assert on `checked` changes too: clicking the input natively resets `indeterminate`.
      input.indeterminate = isIndeterminate;
    },
  );
  const inputRefProp = props.inputRef;
  if (typeof inputRefProp === 'function') {
    inputRefProp(input);
  } else if (inputRefProp) {
    inputRefProp.current = input;
  }
  // Solid: React registers the input through a ref callback with a cleanup; an effect keyed on
  // the same inputs registers it and unregisters it on change and unmount. Outside a Field there
  // is no registry.
  if (validation.registerInput !== NOOP && !isParent) {
    createDepsEffect(
      () => ({ value: groupContext ? value() : undefined }),
      ({ value: inputValue }) =>
        validation.registerInput(input, { controlRef, value: inputValue }) ?? undefined,
    );
  }

  if (groupContext) {
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
    // The root's id is the generated one (a non-native button); children report it to the parent.
    if (!isParent) {
      createDepsEffect(
        () => ({ registerChildId: parentContext()?.registerChildId, value: value() }),
        (deps) => {
          const rootId = id();
          return deps.registerChildId && deps.value !== undefined && rootId !== undefined
            ? deps.registerChildId(deps.value, rootId)
            : undefined;
        },
      );
    }
  }

  const state: CheckboxRootState = {
    get disabled() {
      return disabled();
    },
    get touched() {
      return fieldState.touched;
    },
    get dirty() {
      return fieldState.dirty;
    },
    get valid() {
      return fieldState.valid;
    },
    get filled() {
      return fieldState.filled;
    },
    get focused() {
      return fieldState.focused;
    },
    get checked() {
      return computedChecked();
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
  };

  const model: NativeCheckbox = {
    props,
    input,
    disabled,
    readOnly,
    checked,
    setCheckedState,
    groupContext,
    groupProps,
    groupValue,
    value,
    parent,
    isGroupedWithParent,
    lastClick: undefined,
    field: fieldRootContext,
    labelable: labelableContext,
    labelId,
    controlId,
    required,
    computedChecked,
    computedIndeterminate,
  };
  assign(
    input,
    {
      onChange: [inputChange, model],
      onClick: [inputClick, model],
      onFocus: [focusControl, controlRef],
    },
    true,
    {},
    true,
  );

  // The root element and its children are created inside the context provider (children read it).
  return provideContext(CheckboxRootContext, state, () => {
    const owner = getOwner();
    const fieldKeys = fieldOwnedKeys(labelableContext, fieldRootContext);
    const own = fieldKeys.length ? new Set([...OWN_KEYS, ...fieldKeys]) : OWN_KEYS_SET;
    const l = createLayout(props, own, model, state, (key) => wrapCheckboxHandler(key, model));
    const staticProp = (key: string) => !(key in props) || isStatic(props, key);
    // What can never change: a prop that is a literal and no context that could flip it.
    l.flags =
      (staticProp('disabled') && !inField && !inFieldItem && groupContext == null ? DISABLED_STATIC : 0) |
      (staticProp('readOnly') ? READONLY_STATIC : 0) |
      (staticProp('required') ? REQUIRED_STATIC : 0) |
      (staticProp('aria-labelledby') && !inLabelable ? LABELLEDBY_STATIC : 0) |
      (inField ? IN_FIELD : 0) |
      (inLabelable ? IN_LABELABLE : 0) |
      (staticProp('indeterminate') && groupContext == null ? INDETERMINATE_STATIC : 0) |
      (groupContext ? IN_GROUP : 0) |
      (isParent ? IS_PARENT : 0);

    const literal: Record<string, unknown> = { id: id() };
    checkboxAttributes(l, literal, true);
    literalClassStyle(l, literal);
    checkboxHandlers(l, literal);
    if (l.hasKeys) {
      Object.assign(literal, l.consumerLiteral);
    }
    const dynamic = () => checkboxAttributes(l, {}, false);

    const el = createNativeElement('span', ROOT_ATTRIBUTES);
    // `useAriaLabelledBy`'s DOM label fallback runs after each attribute apply (the attribute
    // effect reads the prop, the Field label id and the control id); the first time once mounted.
    attachNativeAttributes(
      el,
      literal,
      dynamic,
      owner,
      createLabelFallback(el, input, () => props['aria-labelledby'], labelId, controlId),
      elementRefs(el, [controlRef], props.ref),
    );
    if (isStatic(props, 'children')) {
      insert(el, props.children);
    } else {
      insert(el, () => props.children);
    }

    const nodes: JSX.Element[] = [el];
    if ('uncheckedValue' in props) {
      nodes.push(
        <Show
          when={
            !checked() &&
            !groupContext &&
            name() &&
            !isParent &&
            props.uncheckedValue !== undefined
          }
        >
          <input
            type="hidden"
            form={props.form}
            name={name()}
            value={props.uncheckedValue}
            disabled={disabled()}
          />
        </Show>,
      );
    }
    nodes.push(input);
    return nodes;
  });
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
