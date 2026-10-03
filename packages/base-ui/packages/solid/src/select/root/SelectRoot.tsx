/* eslint-disable typescript/no-explicit-any -- generic Value type erased at root level */
import { createEffect, createMemo, For, onSettled, Show, snapshot, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useField } from '../../field/useField';
import {
  useClick,
  useDismiss,
  useFloatingRootContext,
  useInteractions,
  useListNavigation,
  useTypeahead,
} from '../../floating-ui-solid';
import { useFormContext } from '../../form/FormContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { mergeProps } from '../../merge-props';
import { createDepsEffect, createDepsMemo, useRef, type ReactLikeRef } from '../../solid-helpers';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../utils/constants';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../utils/createBaseUIEventDetails';
import {
  defaultItemEquality,
  findSelectionIndex,
  isSelectedValueDirty,
} from '../../utils/itemEquality';
import { REASONS } from '../../utils/reasons';
import { isElementDisabled } from '../../utils/isElementDisabled';
import { type Group, stringifyAsLabel, stringifyAsValue } from '../../utils/resolveValueLabel';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { useControlled } from '../../utils/useControlled';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useOpenInteractionType } from '../../utils/useOpenInteractionType';
import { usePreviousValue } from '../../utils/usePreviousValue';
import { useTransitionStatus } from '../../utils/useTransitionStatus';
import { visuallyHidden, visuallyHiddenInput } from '../../utils/visuallyHidden';
import { getMaxScrollOffset, normalizeScrollOffset } from '../../utils/scrollEdges';
import { selectors, type State as StoreState } from '../store';
import { SelectFloatingContext, SelectRootContext } from './SelectRootContext';
import { on } from '../../solid-1-compat';
import type { HTMLProps } from '../../utils/types';

/**
 * Groups all parts of the select.
 * Doesn’t render its own HTML element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectRoot<Value, Multiple extends boolean | undefined = false>(
  props: SelectRoot.Props<Value, Multiple>,
): JSX.Element {
  const valueProp = () => props.value;
  const defaultValue = () => props.defaultValue ?? null;
  const openProp = () => props.open;
  const defaultOpen = () => props.defaultOpen ?? false;
  const nameProp = () => props.name;
  const disabledProp = () => props.disabled ?? false;
  const readOnly = () => props.readOnly ?? false;
  const required = () => props.required ?? false;
  const modal = () => props.modal ?? true;
  const multiple = () => props.multiple ?? false;
  const isItemEqualToValue: typeof defaultItemEquality = (...args) =>
    (props.isItemEqualToValue ?? defaultItemEquality)(...args);
  const highlightItemOnHover = () => props.highlightItemOnHover ?? true;

  const { clearErrors } = useFormContext();
  const {
    setDirty,
    setTouched,
    setFocused,
    shouldValidateOnChange,
    registerFilledSource,
    name: fieldName,
    disabled: fieldDisabled,
    validation,
    validationMode,
    validityData,
  } = useFieldRootContext();

  const generatedId = useLabelableId({ id: () => props.id });

  const disabled = () => fieldDisabled() || disabledProp();
  const name = () => fieldName() ?? nameProp();

  const [value, setValueUnwrapped] = useControlled({
    controlled: valueProp,
    default: () =>
      multiple() ? (defaultValue() ?? ([] as ReturnType<typeof defaultValue>)) : defaultValue(),
    name: 'Select',
    state: 'value',
  });

  const [open, setOpenUnwrapped] = useControlled({
    controlled: openProp,
    default: defaultOpen,
    name: 'Select',
    state: 'open',
  });

  const listRef = useRef<Array<HTMLElement | null | undefined>>([]);
  const labelsRef = useRef<Array<string | null>>([]);
  const popupRef = useRef<HTMLDivElement | null | undefined>(null);
  const scrollHandlerRef = useRef<((el: HTMLDivElement) => void) | null>(null);
  const scrollArrowsMountedCountRef = useRef(0);
  const valueRef = useRef<HTMLSpanElement | null | undefined>(null);
  const valuesRef = useRef<Array<any>>([]);
  const typingRef = useRef(false);
  const keyboardActiveRef = useRef(false);
  const firstItemTextRef = useRef<HTMLElement | null | undefined>(null);
  const selectedItemTextRef = useRef<HTMLElement | null | undefined>(null);
  const selectionRef = useRef({
    allowSelectedMouseUp: false,
    allowUnselectedMouseUp: false,
    dragY: 0,
  });
  const alignItemWithTriggerActiveRef = useRef(false);
  const triggerPressedRef = useRef(false);
  const lastCloseReasonRef = useRef<SelectRoot.ChangeEventReason | null>(null);

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);
  const { openMethod, triggerProps: interactionTypeProps } = useOpenInteractionType(open);

  const store = SolidStore<StoreState, Record<string, never>, typeof selectors>(
    {
      activeIndex: null,
      forceMount: false,
      hasScrollArrows: false,
      get id() {
        return generatedId();
      },
      isItemEqualToValue,
      get itemToStringLabel() {
        return props.itemToStringLabel;
      },
      get itemToStringValue() {
        return props.itemToStringValue;
      },
      get items() {
        return props.items;
      },
      labelId: undefined,
      listElement: null,
      listboxId: undefined,
      get modal() {
        return modal();
      },
      get mounted() {
        return mounted();
      },
      get multiple() {
        return multiple();
      },
      get open() {
        return open();
      },
      openMethod: null,
      popupProps: {},
      popupSide: null,
      positionerElement: null,
      scrollDownArrowVisible: false,
      scrollUpArrowVisible: false,
      selectedIndex: null,
      get transitionStatus() {
        return transitionStatus();
      },
      triggerElement: null,
      triggerProps: {},
      get value() {
        return value();
      },
    },
    {},
    selectors,
  );

  const activeIndex = store.useState('activeIndex');
  const selectedIndex = store.useState('selectedIndex');
  const triggerElement = store.useState('triggerElement');
  const positionerElement = store.useState('positionerElement');

  const previousOpenMethod = usePreviousValue(openMethod);
  const renderedOpenMethod = () => openMethod() ?? previousOpenMethod();

  const serializedValue = createMemo(() => {
    // In multiple mode the shared input is nameless; per-value entries are submitted via
    // hidden inputs. Its value is therefore irrelevant, and passing the whole array to
    // `stringifyAsValue` would invoke a user `itemToStringValue` with an array it doesn't expect.
    if (multiple()) {
      return '';
    }
    return stringifyAsValue(value(), props.itemToStringValue);
  });

  const multipleHiddenValues = createMemo(() => {
    const val = value();
    return multiple() && Array.isArray(val) ? (val as Value[]) : EMPTY_ARRAY;
  });

  const fieldStringValue = createMemo(() => {
    const val = value();
    if (multiple() && Array.isArray(val)) {
      return val.map((currentValue) => stringifyAsValue(currentValue, props.itemToStringValue));
    }
    return stringifyAsValue(val, props.itemToStringValue);
  });

  // ––– AI-GENERATED FIX AND EXPLANATION –––
  // React validation receives the raw selected value directly from state.
  // In Solid, values can cross signal/store boundaries as proxies, so we snapshot them before
  // validation and autofill bookkeeping to keep equality checks and field serialization stable.
  const fieldRawValue = createMemo(() => snapshot(value()));

  useField({
    commit: validation.commit,
    controlRef: () => store.state.triggerElement,
    getValue: fieldStringValue,
    id: generatedId,
    name,
    value: fieldRawValue,
  });

  const initialValueRef = useRef(untrack(() => value()));

  // ––– AI-GENERATED FIX AND EXPLANATION –––
  // React naturally clears this bookkeeping as the popup rerenders around a null single value.
  // In Solid, the previous selected index can survive longer because setup does not rerun,
  // so we clear it explicitly when an empty single-select opens.
  createDepsEffect(
    () => ({ open: open(), multiple: multiple(), value: value() }),
    (deps) => {
      if (deps.open && !deps.multiple && deps.value == null) {
        store.set('selectedIndex', null);
      }
    },
  );

  // Mirror the `hasSelectedValue` store selector so the Field's filled state agrees with the
  // trigger/value placeholder semantics (a value serializing to `''` counts as empty).
  const hasSelectedValue = createMemo(() => {
    const val = value();
    return multiple()
      ? Array.isArray(val) && val.length > 0
      : val != null && serializedValue() !== '';
  });

  // React sets `filled` from a layout effect; the field derives it from this source.
  registerFilledSource(hasSelectedValue);

  createDepsEffect(
    () => ({
      multiple: multiple(),
      open: open(),
      value: value(),
      isItemEqualToValue: props.isItemEqualToValue ?? defaultItemEquality,
    }),
    function syncSelectedIndex(deps) {
      const nextIndex = findSelectionIndex(
        untrack(() => valuesRef.current),
        deps.value,
        deps.isItemEqualToValue,
        deps.multiple,
      );

      if (nextIndex === null) {
        selectedItemTextRef.current = null;
      }

      if (deps.open) {
        return;
      }

      store.set('selectedIndex', nextIndex);
    },
  );

  createEffect(
    ...on(
      value,
      () => {
        clearErrors(name());
        setDirty(isSelectedValueDirty(value(), validityData.initialValue, isItemEqualToValue));

        if (shouldValidateOnChange()) {
          validation.commit(fieldRawValue());
        } else {
          validation.commit(fieldRawValue(), true);
        }
      },
      { defer: true },
    ),
  );

  const handleUnmount = () => {
    setOpenUnwrapped(false);
    setMounted(false);
    store.update({ activeIndex: null, openMethod: null });
    props.onOpenChangeComplete?.(false);
  };

  const setOpen = (nextOpen: boolean, eventDetails: SelectRoot.ChangeEventDetails) => {
    if (nextOpen !== open()) {
      lastCloseReasonRef.current = nextOpen ? null : eventDetails.reason;
    }

    props.onOpenChange?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setOpenUnwrapped(nextOpen);

    if (
      !nextOpen &&
      (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)
    ) {
      setTouched(true);
      setFocused(false);

      if (validationMode() === 'onBlur') {
        validation.commit(fieldRawValue());
      }
    }

    // The active index will sync to the last selected index on the next open.
    // Workaround `enableFocusInside` in Floating UI setting `tabindex=0` of a non-highlighted
    // option upon close when tabbing out due to `keepMounted=true`:
    // https://github.com/floating-ui/floating-ui/pull/3004/files#diff-962a7439cdeb09ea98d4b622a45d517bce07ad8c3f866e089bda05f4b0bbd875R194-R199
    // This otherwise causes options to retain `tabindex=0` incorrectly when the popup is closed
    // when tabbing outside.
    if (!nextOpen && store.state.activeIndex !== null) {
      const activeOption = listRef.current[store.state.activeIndex];
      // Wait for Floating UI's focus effect to have fired
      queueMicrotask(() => {
        activeOption?.setAttribute('tabindex', '-1');
      });
    }

    if (!nextOpen && !props.actionsRef && popupRef.current == null) {
      // ––– AI-GENERATED FIX AND EXPLANATION –––
      // The normal close path waits for the popup element to finish its exit transition before
      // clearing `mounted`. In this composition there is no `<Select.Popup>`, so no popup ref ever
      // exists and the completion hook has nothing to observe. We fall back to the same unmount
      // cleanup immediately instead of leaving the positioner mounted forever.
      handleUnmount();
    }
  };

  useOpenChangeComplete({
    enabled: () => !props.actionsRef,
    onComplete() {
      if (!open()) {
        handleUnmount();
      }
    },
    open,
    ref: () => popupRef.current,
  });

  onSettled(() => {
    if (props.actionsRef) {
      props.actionsRef.current = { unmount: handleUnmount };
    }
  });

  const setValue = (nextValue: any, eventDetails: SelectRoot.ChangeEventDetails) => {
    props.onValueChange?.(nextValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(nextValue);
  };

  // Solid: callers may omit the scroller, which defaults to the one every React caller passes.
  const handleScrollArrowVisibility = (
    scroller: HTMLElement | null | undefined = store.state.listElement || popupRef.current,
  ) => {
    if (!scroller) {
      return;
    }

    const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
    const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
    const shouldShowUp = scrollTop > 0;
    const shouldShowDown = scrollTop < maxScrollTop;

    store.set('scrollUpArrowVisible', shouldShowUp);
    store.set('scrollDownArrowVisible', shouldShowDown);
  };

  const floatingContext = useFloatingRootContext({
    elements: {
      get floating() {
        return positionerElement();
      },
      get reference() {
        return triggerElement();
      },
    },
    onOpenChange(nextOpen, eventDetails) {
      setOpen(nextOpen, eventDetails as SelectRoot.ChangeEventDetails);
    },
    get open() {
      return open();
    },
  });

  createEffect(
    () => triggerElement(),
    (ref) => {
      if (
        ref !== undefined &&
        floatingContext.select('floatingElement') == null &&
        floatingContext.state.positionReference === floatingContext.state.referenceElement
      ) {
        floatingContext.update({ positionReference: ref });
      }
    },
  );

  // `readOnly` locks the value, not the interaction: the popup can be opened and browsed so the
  // user can see the available options and which one is selected. Committing a value is blocked
  // separately in `SelectItem` and in the hidden input's autofill handler.
  const click = useClick({
    get context() {
      return floatingContext;
    },
    props: {
      get enabled() {
        return !disabled();
      },
      event: 'mousedown',
    },
  });

  const dismiss = useDismiss({
    get context() {
      return floatingContext;
    },
  });

  const listNavigation = useListNavigation({
    get context() {
      return floatingContext;
    },
    props: {
      get enabled() {
        return !disabled();
      },
      get listRef() {
        return listRef.current;
      },
      get activeIndex() {
        return activeIndex();
      },
      get selectedIndex() {
        return selectedIndex();
      },
      disabledIndices: EMPTY_ARRAY as number[],
      onNavigate(nextActiveIndex) {
        // Retain the highlight while transitioning out.
        if (nextActiveIndex === null && !open()) {
          return;
        }

        store.set('activeIndex', nextActiveIndex);
      },
      // Implement our own listeners since `onPointerLeave` on each option fires while scrolling with
      // the `alignItemWithTrigger=true`, causing a performance issue on Chrome.
      get focusItemOnHover() {
        return highlightItemOnHover();
      },
    },
  });

  const typeahead = useTypeahead({
    get context() {
      return floatingContext;
    },
    props: {
      get activeIndex() {
        return activeIndex();
      },
      // Typeahead on an open popup only moves the highlight, so it remains available while
      // `readOnly`. The closed-trigger variant commits a value instead, so it doesn't.
      get enabled() {
        return !disabled() && (open() || (!readOnly() && !multiple()));
      },
      // Skip disabled items while matching so typeahead advances to the next selectable item
      // (a click can never select a disabled item and native `<select>` skips them too). Resolve
      // the disabled state from the element via the attribute-only `isElementDisabled` so the
      // hidden, force-mounted items used for closed-trigger typeahead aren't dropped by the
      // `elementsRef`/visibility filter that `disabledIndices` deliberately sidesteps.
      disabledIndices: (index: number) => isElementDisabled(listRef.current[index]),
      get listRef() {
        return labelsRef.current;
      },
      onMatch(index) {
        if (open()) {
          store.set('activeIndex', index);
        } else {
          setValue(valuesRef.current[index], createChangeEventDetails('none'));
        }
      },
      onTyping(typing) {
        // FIXME: Floating UI doesn't support allowing space to select an item while the popup is
        // closed and the trigger isn't a native <button>.
        typingRef.current = typing;
      },
      get selectedIndex() {
        return selectedIndex();
      },
    },
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    listNavigation,
    typeahead,
  ]);

  // The interaction getters return live views, so each is created once.
  const referenceProps = getReferenceProps();
  const popupProps = getFloatingProps();

  const mergedTriggerProps = createMemo(() =>
    mergeProps(
      referenceProps,
      interactionTypeProps,
      generatedId() ? { id: generatedId() } : EMPTY_OBJECT,
    ),
  );

  // React writes these into the store together in a layout effect whenever any of them changes.
  // The store's getters keep most keys live; the plain keys are derived from the same snapshot, so a
  // change to any value re-syncs them all in the same flush.
  const synced = createDepsMemo(() => ({
    id: generatedId(),
    isItemEqualToValue,
    itemToStringLabel: props.itemToStringLabel,
    itemToStringValue: props.itemToStringValue,
    items: props.items,
    modal: modal(),
    mounted: mounted(),
    multiple: multiple(),
    open: open(),
    openMethod: renderedOpenMethod(),
    popupProps,
    transitionStatus: transitionStatus(),
    triggerProps: mergedTriggerProps(),
    value: value(),
  }));
  store.useSyncedValue('isItemEqualToValue', () => synced().isItemEqualToValue);
  store.useSyncedValue('openMethod', () => synced().openMethod);
  store.useSyncedValue('popupProps', () => synced().popupProps);
  store.useSyncedValue('triggerProps', () => synced().triggerProps);

  const contextValue: SelectRootContext = {
    store,
    name,
    required,
    disabled,
    readOnly,
    multiple,
    // @ts-expect-error TODO: fix this
    get itemToStringLabel() {
      return props.itemToStringLabel;
    },
    get itemToStringValue() {
      return props.itemToStringValue;
    },
    highlightItemOnHover,
    setValue,
    setOpen,
    listRef,
    popupRef,
    scrollHandlerRef,
    handleScrollArrowVisibility,
    scrollArrowsMountedCountRef,
    getItemProps,
    get events() {
      return floatingContext.context.events;
    },
    valueRef,
    valuesRef,
    labelsRef,
    typingRef,
    selectionRef,
    firstItemTextRef,
    selectedItemTextRef,
    validation,
    get onOpenChangeComplete() {
      return props.onOpenChangeComplete;
    },
    keyboardActiveRef,
    alignItemWithTriggerActiveRef,
    initialValueRef,
    lastCloseReasonRef,
    triggerPressedRef,
  };

  const hasMultipleSelection = () => {
    const val = value();
    return multiple() && Array.isArray(val) && val.length > 0;
  };

  const hiddenInputName = () => (multiple() ? undefined : name());

  return (
    <SelectRootContext value={contextValue}>
      <SelectFloatingContext value={floatingContext}>
        {props.children}
        <input
          {...(validation.getValidationProps(disabled(), {
            onFocus() {
              // Move focus to the trigger element when the hidden input is focused.
              store.state.triggerElement?.focus({
                // Supported in Chrome from 144 (January 2026)
                focusVisible: true,
              } as FocusOptions);
            },
            // Handle browser autofill.
            onInput(
              event: InputEvent & { currentTarget: HTMLInputElement; target: HTMLInputElement },
            ) {
              // Workaround for https://github.com/facebook/react/issues/9023
              if (event.defaultPrevented || disabled() || readOnly()) {
                // Solid: inputs are not controlled, so restore the value React's controlled
                // hidden input keeps when the change is ignored.
                event.currentTarget.value = serializedValue();
                return;
              }

              const nextValue = event.currentTarget.value;
              const details = createChangeEventDetails(REASONS.none, event);

              function handleChange() {
                if (multiple()) {
                  // Browser autofill only writes a single scalar value.
                  return;
                }

                // Preserve the original serialized matching, then fall back to rendered text,
                // which browsers can autofill for primitive values like
                // `value="US">United States`.
                const nextValueLower = nextValue.toLowerCase();
                let matchingIndex = valuesRef.current.findIndex(
                  (candidate) =>
                    stringifyAsValue(candidate, props.itemToStringValue).toLowerCase() ===
                      nextValueLower ||
                    stringifyAsLabel(candidate, props.itemToStringLabel).toLowerCase() ===
                      nextValueLower,
                );

                if (matchingIndex === -1) {
                  matchingIndex = valuesRef.current.findIndex((_, index) => {
                    const renderedLabel = labelsRef.current[index];
                    return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
                  });
                }

                const matchingValue = valuesRef.current[matchingIndex];
                if (matchingValue != null) {
                  // `setValue` may be canceled by `onValueChange`; rely on the value-change
                  // effect to mark the field dirty and run validation only when the value
                  // actually changes.
                  setValue(matchingValue, details);
                }
              }

              store.set('forceMount', true);
              queueMicrotask(handleChange);
            },
          }) as HTMLProps<HTMLInputElement>)}
          id={
            generatedId() && hiddenInputName() == null ? `${generatedId()}-hidden-input` : undefined
          }
          form={props.form}
          name={hiddenInputName()}
          autocomplete={props.autoComplete}
          value={serializedValue()}
          disabled={disabled()}
          required={required() && !hasMultipleSelection()}
          readonly={readOnly()}
          ref={(el) => {
            if (props.inputRef) {
              props.inputRef.current = el;
            }
            validation.inputRef.current = el;
          }}
          style={name() ? visuallyHiddenInput : visuallyHidden}
          tabindex={-1}
          aria-hidden="true"
        />

        {/* hidden inputs */}
        <Show when={multipleHiddenValues().length > 0}>
          <For each={multipleHiddenValues()}>
            {(v) => (
              <input
                type="hidden"
                form={props.form}
                name={name()}
                value={stringifyAsValue(v, props.itemToStringValue)}
                disabled={disabled()}
              />
            )}
          </For>
        </Show>
      </SelectFloatingContext>
    </SelectRootContext>
  );
}

type SelectValueType<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? Value[]
  : Value;

export interface SelectRootProps<Value, Multiple extends boolean | undefined = false> {
  children?: JSX.Element;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: ReactLikeRef<HTMLInputElement | null> | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the select is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Provides a hint to the browser for autofill.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  autoComplete?: string | undefined;
  /**
   * The id of the Select.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the select popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether multiple items can be selected.
   * @default false
   */
  multiple?: Multiple | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether the select popup is initially open.
   *
   * To render a controlled select popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Event handler called when the select popup is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: SelectRootChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the select popup is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the select popup is currently open.
   */
  open?: boolean | undefined;
  /**
   * Determines if the select enters a modal state when open.
   * - `true`: user interaction is limited to the select: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: When specified, the select will not be unmounted when closed.
   * Instead, the `unmount` function must be called to unmount the select manually.
   * Useful when the select's animation is controlled by an external library.
   */
  actionsRef?: ReactLikeRef<SelectRootActions | null> | undefined;
  /**
   * Data structure of the items rendered in the select popup.
   * When specified, `<Select.Value>` renders the label of the selected item instead of the raw value.
   * @example
   * ```tsx
   * const items = {
   *   sans: 'Sans-serif',
   *   serif: 'Serif',
   *   mono: 'Monospace',
   *   cursive: 'Cursive',
   * };
   * <Select.Root items={items} />
   * ```
   */
  items?:
    | Record<string, JSX.Element>
    | ReadonlyArray<{ label: JSX.Element; value: any }>
    | ReadonlyArray<Group<any>>
    | undefined;
  /**
   * When the item values are objects (`<Select.Item value={object}>`), this function converts the object value to a string representation for display in the trigger.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringLabel?: ((itemValue: Value) => string) | undefined;
  /**
   * When the item values are objects (`<Select.Item value={object}>`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: Value) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a select item value matches the current selected value. Useful when item values are objects without matching referentially.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: Value, value: Value) => boolean) | undefined;
  /**
   * The uncontrolled value of the select when it’s initially rendered.
   *
   * To render a controlled select, use the `value` prop instead.
   */
  defaultValue?: (SelectValueType<Value, Multiple> | null) | undefined;
  /**
   * The value of the select. Use when controlled.
   */
  value?: (SelectValueType<Value, Multiple> | null) | undefined;
  /**
   * Event handler called when the value of the select changes.
   */
  onValueChange?:
    | ((
        value: SelectValueType<Value, Multiple> | (Multiple extends true ? never : null),
        eventDetails: SelectRootChangeEventDetails,
      ) => void)
    | undefined;
}

export interface SelectRootState {}

export interface SelectRootActions {
  unmount: () => void;
}

export type SelectRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.windowResize
  | typeof REASONS.itemPress
  | typeof REASONS.focusOut
  | typeof REASONS.listNavigation
  | typeof REASONS.cancelOpen
  | typeof REASONS.none;

export type SelectRootChangeEventDetails = BaseUIChangeEventDetails<SelectRootChangeEventReason>;

export namespace SelectRoot {
  export type Props<Value, Multiple extends boolean | undefined = false> = SelectRootProps<
    Value,
    Multiple
  >;
  export type State = SelectRootState;
  export type Actions = SelectRootActions;
  export type ChangeEventReason = SelectRootChangeEventReason;
  export type ChangeEventDetails = SelectRootChangeEventDetails;
}
