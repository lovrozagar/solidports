/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createMemo, createSignal } from 'solid-js';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { FieldRootContext, useFieldRootContext } from '../../field/root/FieldRootContext';
import { DEFAULT_FIELD_STATE_ATTRIBUTES } from '../../field/utils/constants';
import { stopEvent } from '../../floating-ui-solid/utils';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { splitComponentProps, createLayoutEffect } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { isAndroid, isFirefox } from '../../utils/detectBrowser';
import { REASONS } from '../../utils/reasons';
import { BaseUIComponentProps, type HTMLProps } from '../../utils/types';
import type { Side } from '../../utils/useAnchorPositioning';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import { useComboboxInputValueContext, useComboboxRootContext } from '../root/ComboboxRootContext';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
import { ComboboxInternalDismissButton } from '../utils/ComboboxInternalDismissButton';
import {
  clickHighlightedItem,
  getChipNavigationKeys,
  getIndexAfterChipRemoval,
  useListEmpty,
  usePopupSide,
} from '../utils/parts';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * A text input to search for items in the list.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxInput(componentProps: ComboboxInput.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['disabled', 'id']);
  const disabledProp = () => local.disabled ?? false;
  const idProp = () => local.id;

  const {
    state: fieldState,
    disabled: fieldDisabled,
    setTouched,
    setFocused,
    validationMode,
    validation,
  } = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const comboboxChipsContext = useComboboxChipsContext();
  const positioning = useComboboxPositionerContext(true);
  const hasPositionerParent = Boolean(positioning);
  const store = useComboboxRootContext();
  // `inputValue` can't be placed in the store.
  // https://github.com/mui/base-ui/issues/2703
  const inputValue = useComboboxInputValueContext();
  const direction = useDirection();

  const required = store.useState('required');
  const comboboxDisabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');
  const name = store.useState('name');
  const form = store.useState('form');
  const selectionMode = store.useState('selectionMode');
  const autoHighlightMode = store.useState('autoHighlight');
  const inputProps = store.useState('inputProps');
  const triggerProps = store.useState('triggerProps');
  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const selectedValue = store.useState('selectedValue');
  const rootId = store.useState('id');
  const inline = store.useState('inline');
  const modal = store.useState('modal');
  const inputElement = store.useState('inputElement');

  const autoHighlightEnabled = () => Boolean(autoHighlightMode());
  const popupSide = usePopupSide(store);
  const disabled = () => fieldDisabled() || comboboxDisabled() || disabledProp();
  const listEmpty = useListEmpty();

  const isInsidePopup = () => hasPositionerParent || inline();
  const focusManagerModal = () => !isInsidePopup() || modal();
  const id = useBaseUiId(() => idProp() ?? (!isInsidePopup() ? rootId() : undefined));
  const fieldStateForInput = hasPositionerParent ? DEFAULT_FIELD_STATE_ATTRIBUTES : fieldState;

  const [composingValue, setComposingValue] = createSignal<string | null>(null);
  // Solid: React re-renders a controlled input after every change and restores its value; count
  // native input events so the DOM value sync below re-runs even when the value is unchanged.
  const [inputEventCount, setInputEventCount] = createSignal(0);
  let isComposingRef = false;
  let lastActiveIndexRef = null as number | null;
  let shouldRestoreActiveIndexRef = false;
  // Solid: a `value` prop overrides the controlled input value, as React's prop order does.
  const renderedValue = () =>
    String(componentProps.value ?? composingValue() ?? inputValue() ?? '');

  const inputOwnsFormValue = () => selectionMode() === 'none' && !hasPositionerParent;

  const setInputElement = (element: HTMLInputElement | null | undefined) => {
    const nextIsInsidePopup = hasPositionerParent || store.state.inline;

    // Solid: React's stable ref callback runs once per element; skip repeated calls.
    if (store.state.inputElement !== element && nextIsInsidePopup && !store.state.hasInputValue) {
      store.context.setInputValue('', createChangeEventDetails(REASONS.none));
    }

    // `inputOwnsFormValue` is derived by the root from `inputInsidePopup` (a store getter).
    store.update({
      inputElement: element,
      inputInsidePopup: nextIsInsidePopup,
    });
  };

  const validationProps = createMemo(() =>
    hasPositionerParent
      ? elementProps
      : validation.getValidationProps(disabled(), elementProps as HTMLProps),
  );

  function clearHighlight() {
    store.context.setIndices({
      activeIndex: null,
      selectedIndex: null,
      type: store.context.keyboardActiveRef.current ? REASONS.keyboard : REASONS.pointer,
    });
  }

  function markPointerActive() {
    store.context.keyboardActiveRef.current = false;
  }

  const state: ComboboxInput.State = solidMergeProps(fieldStateForInput, {
    get open() {
      return open();
    },
    get disabled() {
      return disabled();
    },
    get readOnly() {
      return readOnly();
    },
    get popupSide() {
      return popupSide();
    },
    get listEmpty() {
      return listEmpty();
    },
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (!comboboxChipsContext) {
      return undefined;
    }

    let nextIndex: number | undefined;

    const highlightedChipIndex = comboboxChipsContext.highlightedChipIndex();
    const renderedChipsCount = comboboxChipsContext.chipsRef.current.length;
    const [previousChipKey, nextChipKey] = getChipNavigationKeys(direction());
    const currentSelectedValue = selectedValue();

    if (highlightedChipIndex !== undefined) {
      if (event.key === previousChipKey) {
        event.preventDefault();
        if (highlightedChipIndex > 0) {
          nextIndex = highlightedChipIndex - 1;
        } else {
          nextIndex = undefined;
        }
      } else if (event.key === nextChipKey) {
        event.preventDefault();
        if (highlightedChipIndex < renderedChipsCount - 1) {
          nextIndex = highlightedChipIndex + 1;
        } else {
          nextIndex = undefined;
        }
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        // Move highlight appropriately after removal.
        nextIndex = getIndexAfterChipRemoval(highlightedChipIndex, currentSelectedValue.length);
        clearHighlight();
      }
      return nextIndex;
    }

    // Handle navigation when no chip is highlighted
    if (
      event.key === previousChipKey &&
      ((event.currentTarget as HTMLInputElement).selectionStart ?? 0) === 0 &&
      currentSelectedValue.length > 0
    ) {
      event.preventDefault();
      nextIndex = renderedChipsCount > 0 ? renderedChipsCount - 1 : undefined;
    }

    return nextIndex;
  }

  const element = useRenderElement('input', componentProps, {
    state,
    ref: (el) => {
      store.context.inputRef.current = el;
      setInputElement(el);
    },
    // Static sources with per-key getters: a prop read tracks only what that prop uses.
    props: [
      propsSourceAccessor(inputProps),
      propsSourceAccessor(triggerProps),
      {
        get 'aria-readonly'() {
          return readOnly() ? 'true' : undefined;
        },
        get 'aria-required'() {
          return required() ? 'true' : undefined;
        },
        get 'aria-labelledby'() {
          return fieldLabelId();
        },
        get disabled() {
          return disabled();
        },
        get readonly() {
          return readOnly();
        },
        get required() {
          return selectionMode() === 'none' ? required() : undefined;
        },
        get form() {
          return form();
        },
        get name() {
          return inputOwnsFormValue() ? name() || undefined : undefined;
        },
        get id() {
          return id();
        },
        onFocus() {
          setFocused(true);

          if (!inline() || !shouldRestoreActiveIndexRef) {
            return;
          }

          shouldRestoreActiveIndexRef = false;
          const nextActiveIndex = lastActiveIndexRef;

          if (
            nextActiveIndex == null ||
            // `valuesRef` can be sparse, so guard against restoring a removed slot.
            !Object.hasOwn(store.context.valuesRef.current, nextActiveIndex)
          ) {
            return;
          }

          store.context.setIndices({ activeIndex: nextActiveIndex });
        },
        onBlur() {
          setTouched(true);
          setFocused(false);

          const activeIndex = store.state.activeIndex;
          if (inline() && activeIndex !== null && autoHighlightMode() !== 'always') {
            lastActiveIndexRef = activeIndex;
            shouldRestoreActiveIndexRef = true;
            store.context.setIndices({ activeIndex: null });
          }

          if (validationMode() === 'onBlur') {
            const valueToValidate = selectionMode() === 'none' ? inputValue() : selectedValue();
            validation.commit(valueToValidate);
          }
        },
        onCompositionStart(event: CompositionEvent) {
          if (isAndroid) {
            return;
          }
          isComposingRef = true;
          setComposingValue((event.currentTarget as HTMLInputElement).value);
        },
        onCompositionEnd(event: CompositionEvent) {
          isComposingRef = false;
          const next = (event.currentTarget as HTMLInputElement).value;
          setComposingValue(null);
          store.context.setInputValue(next, createChangeEventDetails(REASONS.inputChange, event));
        },
        // Solid: `input` is the per-keystroke event React exposes as `onChange`.
        onInput(event: InputEvent) {
          setInputEventCount((count) => count + 1);
          const nativeEvent = event;
          const input = event.currentTarget as HTMLInputElement;
          // Autofill may not provide `inputType` (Chrome) or may report
          // `insertReplacementText` (Firefox).
          const inputType = nativeEvent.inputType;
          const autofillLikeInput = !inputType || inputType === 'insertReplacementText';
          // During composition the input is always considered typed into.
          const shouldOpenOnInput = isComposingRef || !autofillLikeInput;

          function maybeOpenOnInput(trimmed: string) {
            if (readOnly() || disabled() || !trimmed || !shouldOpenOnInput) {
              return;
            }

            store.context.setOpen(true, createChangeEventDetails(REASONS.inputChange, nativeEvent));
            // When autoHighlight is enabled, keep the highlight (will be set to 0 in root).
            if (!autoHighlightEnabled()) {
              clearHighlight();
            }
          }

          // During IME composition, avoid propagating controlled updates to prevent
          // filtering the options prematurely so `Empty` won't show incorrectly.
          // We can't rely on this check for Android due to how it handles composition
          // events with some keyboards (e.g. Samsung keyboard with predictive text on
          // treats all text as always-composing).
          // https://github.com/mui/base-ui/issues/2942
          if (isComposingRef) {
            const nextVal = input.value;
            setComposingValue(nextVal);

            if (nextVal === '' && !store.state.openOnInputClick && !store.state.inputInsidePopup) {
              store.context.setOpen(
                false,
                createChangeEventDetails(REASONS.inputClear, nativeEvent),
              );
            }

            const trimmed = nextVal.trim();
            const shouldMaintainHighlight = autoHighlightEnabled() && trimmed !== '';

            maybeOpenOnInput(trimmed);

            if (open() && store.state.activeIndex !== null && !shouldMaintainHighlight) {
              clearHighlight();
            }

            return;
          }

          const inputChangeDetails = createChangeEventDetails(REASONS.inputChange, nativeEvent);
          store.context.setInputValue(input.value, inputChangeDetails);

          if (inputChangeDetails.isCanceled) {
            return;
          }

          const empty = input.value === '';
          const clearDetails = createChangeEventDetails(REASONS.inputClear, nativeEvent);

          if (empty && !store.state.inputInsidePopup) {
            if (selectionMode() === 'single') {
              store.context.setSelectedValue(null, clearDetails);
            }

            if (!store.state.openOnInputClick) {
              store.context.setOpen(false, clearDetails);
            }
          }

          maybeOpenOnInput(input.value.trim());

          // When the user types, ensure the list resets its highlight so that
          // virtual focus returns to the input (aria-activedescendant is
          // cleared).
          if (open() && store.state.activeIndex !== null && !autoHighlightEnabled()) {
            clearHighlight();
          }
        },
        onKeyDown(event: KeyboardEvent) {
          if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
            return;
          }

          // Tracked before the guards so `readOnly` browsing reports keyboard highlight reasons.
          store.context.keyboardActiveRef.current = true;

          if (disabled() || readOnly()) {
            // Browsing can highlight an item, and Enter there must not submit the form.
            if (readOnly() && event.key === 'Enter' && open() && store.state.activeIndex !== null) {
              stopEvent(event);
            }
            return;
          }

          const input = event.currentTarget as HTMLInputElement;
          const scrollAmount = input.scrollWidth - input.clientWidth;
          const isRTL = direction() === 'rtl';

          if (event.key === 'Home') {
            stopEvent(event);
            const cursor = isFirefox && isRTL ? input.value.length : 0;
            input.setSelectionRange(cursor, cursor);
            input.scrollLeft = 0;
            return;
          }

          if (event.key === 'End') {
            stopEvent(event);
            const cursor = isFirefox && isRTL ? 0 : input.value.length;
            input.setSelectionRange(cursor, cursor);
            input.scrollLeft = isRTL ? -scrollAmount : scrollAmount;
            return;
          }

          const currentSelectedValue = selectedValue();

          if (!mounted() && event.key === 'Escape') {
            const isClear =
              selectionMode() === 'multiple' && Array.isArray(currentSelectedValue)
                ? currentSelectedValue.length === 0
                : currentSelectedValue === null;

            const details = createChangeEventDetails(REASONS.escapeKey, event);
            const value = selectionMode() === 'multiple' ? [] : null;
            store.context.setInputValue('', details);
            store.context.setSelectedValue(value, details);

            if (!isClear && !store.state.inline && !details.isPropagationAllowed) {
              event.stopPropagation();
            }

            return;
          }

          // Handle deletion when no chip is highlighted and the input is empty.
          if (
            comboboxChipsContext &&
            event.key === 'Backspace' &&
            input.value === '' &&
            comboboxChipsContext.highlightedChipIndex() === undefined &&
            Array.isArray(currentSelectedValue) &&
            currentSelectedValue.length > 0
          ) {
            const renderedChipsCount = comboboxChipsContext.chipsRef.current.length;
            const removalIndex =
              renderedChipsCount > 0 ? renderedChipsCount - 1 : currentSelectedValue.length - 1;

            const newValue = currentSelectedValue.filter(
              (_: any, index: number) => index !== removalIndex,
            );
            // If the removed item was also the active (highlighted) item, clear highlight
            clearHighlight();
            store.context.setSelectedValue(newValue, createChangeEventDetails(REASONS.none, event));
            return;
          }

          const hadHighlightedChip = comboboxChipsContext?.highlightedChipIndex() !== undefined;
          const nextIndex = handleKeyDown(event);

          comboboxChipsContext?.setHighlightedChipIndex(nextIndex);

          if (nextIndex !== undefined) {
            comboboxChipsContext?.chipsRef.current[nextIndex]?.focus();
          } else if (hadHighlightedChip) {
            store.context.inputRef.current?.focus();
          }

          // event.isComposing
          if (event.which === 229) {
            return;
          }

          if (event.key === 'Enter' && open()) {
            const activeIndex = store.state.activeIndex;

            if (activeIndex === null) {
              if (inline()) {
                return;
              }

              // Allow form submission when no item is highlighted.
              store.context.setOpen(false, createChangeEventDetails(REASONS.none, event));
              return;
            }

            stopEvent(event);
            clickHighlightedItem(store, activeIndex, event);
          }
        },
        onPointerMove: markPointerActive,
        onPointerDown: markPointerActive,
      },
      propsSourceAccessor(validationProps),
    ],
    stateAttributesMapping: triggerStateAttributesMapping,
  });

  // Solid: avoid redundant DOM value writes so the browser can preserve the current
  // selection while a controlled input is being edited in the middle.
  createLayoutEffect(
    () => {
      inputEventCount();
      const input = inputElement();
      const nextValue = renderedValue();
      return { input, nextValue };
    },
    ({ input, nextValue }) => {
      if (input && input.value !== nextValue) {
        input.value = nextValue;
      }
    },
  );

  const renderedInput = () =>
    hasPositionerParent ? (
      <FieldRootContext value={FieldRootContext.defaultValue!}>{element()}</FieldRootContext>
    ) : (
      element()
    );

  return (
    <>
      {/* Solid: the button stays mounted and is hidden while inactive. Mounting it next to the
          focused input would make Solid's reconciler re-insert (and blur) the input. */}
      <ComboboxInternalDismissButton
        hidden={!(open() && focusManagerModal())}
        ref={(el) => {
          store.context.startDismissRef.current = el;
        }}
      />
      {renderedInput()}
    </>
  );
}

export interface ComboboxInputState extends FieldRoot.State {
  /**
   * Whether the corresponding popup is open.
   */
  open: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
}

export interface ComboboxInputProps extends BaseUIComponentProps<'input', ComboboxInput.State> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ComboboxInput {
  export type State = ComboboxInputState;
  export type Props = ComboboxInputProps;
}
