import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { canRenderNative, partHandler } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import { useButton } from '../../internals/use-button';
import { isTouchLikePointerType, usePressAndHold } from '../../internals/usePressAndHold';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { parseNumber } from '../utils/parse';
import type { EventWithOptionalKeyState } from '../utils/types';
import type { NumberFieldRoot } from './NumberFieldRoot';
import { REASONS } from '../../utils/reasons';
import { useNumberFieldRootContext } from './NumberFieldRootContext';
import { stateAttributesMapping, writeNumberFieldState } from '../utils/stateAttributesMapping';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

const SELECT_NONE_STYLE = {
  '-webkit-user-select': 'none',
  'user-select': 'none',
} as const satisfies HTMLProps['style'];

type StepperButtonProps = NativeButtonProps & BaseUIComponentProps<'button', NumberFieldRoot.State>;

const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'nativeButton']);

const BUTTON = {
  tag: 'button',
  // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the template is labelled by its `aria-label` literal
  create: () => (<button />) as unknown as Element,
};
const INCREMENT_LITERAL = { type: 'button', tabindex: -1, 'aria-label': 'Increase' };
const DECREMENT_LITERAL = { type: 'button', tabindex: -1, 'aria-label': 'Decrease' };
const selectNoneStyle = () => SELECT_NONE_STYLE;

type PressHandler = (event: Event) => void;

/** What the native stepper's attributes and handlers read: one object per stepper. */
interface StepperModel {
  disabled: () => boolean;
  /** `useButton`'s `disabled`: a read-only stepper is unavailable too. */
  buttonDisabled: () => boolean;
  id: () => string | undefined;
  onClick: (event: MouseEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  pointerHandlers: Record<string, PressHandler>;
}

function writeStepperAttributes(w: SetAttribute, model: StepperModel) {
  w.set('disabled', model.disabled() ? true : undefined);
  w.set('aria-controls', model.id());
  // `useFocusableWhenDisabled` for a native button focusable while disabled.
  w.set('aria-disabled', model.buttonDisabled() ? 'true' : 'false');
}

/** `useButton`'s gate around a click or a pointerdown: a disabled stepper cancels it. */
function preventWhileDisabled(model: StepperModel, event: Event) {
  if (model.buttonDisabled()) {
    event.preventDefault();
    return false;
  }
  return true;
}

const runWhileEnabled = (model: StepperModel) => !model.buttonDisabled();

const pressHandler = (key: string) =>
  partHandler<StepperModel>(key, (model, event) => model.pointerHandlers[key](event));

const STEPPER_HANDLERS = {
  onClick: partHandler<StepperModel, MouseEvent>(
    'onClick',
    (model, event) => model.onClick(event),
    preventWhileDisabled,
  ),
  onPointerDown: partHandler<StepperModel, PointerEvent>(
    'onPointerDown',
    (model, event) => model.onPointerDown(event),
    preventWhileDisabled,
  ),
  // `useFocusableWhenDisabled`'s keydown: a disabled stepper keeps focus but takes no key but Tab.
  onKeyDown: partHandler<StepperModel, KeyboardEvent>('onKeyDown', undefined, (model, event) => {
    if (model.buttonDisabled()) {
      if (event.key !== 'Tab') {
        event.preventDefault();
      }
      return false;
    }
    return true;
  }),
  onTouchStart: pressHandler('onTouchStart'),
  onTouchEnd: pressHandler('onTouchEnd'),
  onPointerUp: pressHandler('onPointerUp'),
  onPointerMove: pressHandler('onPointerMove'),
  onMouseEnter: pressHandler('onMouseEnter'),
  onMouseLeave: pressHandler('onMouseLeave'),
  onMouseUp: pressHandler('onMouseUp'),
};

const STEPPER_HANDLERS_IF_PASSED = {
  onKeyUp: partHandler<StepperModel>('onKeyUp', undefined, runWhileEnabled),
  onMouseDown: partHandler<StepperModel>('onMouseDown', undefined, runWhileEnabled),
};

/**
 * Shared implementation for the increment and decrement stepper buttons. They differ only in the
 * direction they step and the boundary (`max` vs `min`) at which they become disabled.
 */
export function useNumberFieldStepperButton(
  componentProps: StepperButtonProps,
  isIncrement: boolean,
) {
  const local = componentProps;
  const disabledProp = () => local.disabled ?? false;
  const nativeButton = () => local.nativeButton ?? true;

  const {
    allowInputSyncRef,
    formatOptionsRef,
    getStepAmount,
    id,
    incrementValue,
    inputRef,
    focusInput,
    maxWithDefault,
    minWithDefault,
    setValue,
    state,
    valueRef,
    locale,
    lastChangedValueRef,
    onValueCommitted,
  } = useNumberFieldRootContext();

  const isAtBoundary = () => {
    const value = state.value;
    return value != null && (isIncrement ? value >= maxWithDefault() : value <= minWithDefault());
  };
  const disabled = () => disabledProp() || state.disabled || isAtBoundary();
  const readOnly = () => state.readOnly;

  const pressReason: NumberFieldRoot.ChangeEventReason = isIncrement
    ? REASONS.incrementPress
    : REASONS.decrementPress;

  function commitValue(nativeEvent: MouseEvent | PointerEvent) {
    const shouldCommitInputValue = !allowInputSyncRef.current;
    allowInputSyncRef.current = true;

    if (!shouldCommitInputValue) {
      // The input is already synced, so step from the authoritative numeric value rather than
      // re-parsing the rounded display text. Refresh the commit ref to the current value so a
      // subsequent canceled step can't commit a stale `lastChangedValueRef` left over from an
      // earlier change (the `setValue` that used to refresh it is now skipped on this path).
      lastChangedValueRef.current = valueRef.current;
      return;
    }

    // The input is dirty but not yet blurred, so the value won't have been committed.
    const parsedValue = parseNumber(state.inputValue, locale(), formatOptionsRef.current);

    if (parsedValue !== null) {
      // Sync the dirty typed value with no direction so it isn't directionally snapped
      // (`snapOnStep`) before the real increment/decrement runs, which would otherwise emit a
      // spurious intermediate value.
      const details = createChangeEventDetails(pressReason, nativeEvent);
      setValue(parsedValue, details);

      // Only sync the ref base when the commit wasn't canceled, so a subsequent increment in the
      // same interaction steps from the value actually applied.
      if (!details.isCanceled) {
        valueRef.current = parsedValue;
      }
    }
  }

  const { pointerHandlers, shouldSkipClick } = usePressAndHold({
    get disabled() {
      return disabled() || readOnly();
    },
    elementRef: inputRef,
    tick(triggerEvent) {
      const amount = getStepAmount(triggerEvent as EventWithOptionalKeyState);
      return incrementValue(amount, {
        direction: isIncrement ? 1 : -1,
        event: triggerEvent,
        reason: pressReason,
      });
    },
    onStop(nativeEvent: PointerEvent) {
      // `onStop` fires on every release; fall back to the current value when no tick changed it.
      // Step interactions never commit `null`, so the `??` can't mask a legitimate null commit.
      const committed = lastChangedValueRef.current ?? valueRef.current;
      onValueCommitted(committed, createGenericEventDetails(pressReason, nativeEvent));
    },
  });

  const props: HTMLProps = {
    get disabled() {
      return disabled();
    },
    'aria-label': isIncrement ? 'Increase' : 'Decrease',
    get 'aria-controls'() {
      return id();
    },
    // Keyboard users shouldn't have access to the buttons, since they can use the input element
    // to change the value. On the other hand, `aria-hidden` is not applied because touch screen
    // readers should be able to use the buttons.
    tabindex: -1,
    style: SELECT_NONE_STYLE,
    ...pointerHandlers,
    onClick(event: MouseEvent) {
      const isDisabled = disabled() || readOnly();
      if (event.defaultPrevented || isDisabled || shouldSkipClick(event)) {
        return;
      }

      commitValue(event);

      const amount = getStepAmount(event);

      const prev = valueRef.current;

      incrementValue(amount, {
        direction: isIncrement ? 1 : -1,
        event,
        reason: pressReason,
      });

      const committed = lastChangedValueRef.current ?? valueRef.current;
      if (committed !== prev) {
        onValueCommitted(committed, createGenericEventDetails(pressReason, event));
      }
    },
    onPointerDown(event: PointerEvent) {
      if (event.defaultPrevented || readOnly() || event.button || disabled()) {
        return;
      }

      // Sync dirty input value before starting the hold sequence.
      commitValue(event);
      // Treat `lastChangedValueRef` as a per-hold result slot. If the first tick is a no-op or is
      // canceled, `onStop` should fall back to the current value, not a previous interaction.
      lastChangedValueRef.current = null;

      if (!isTouchLikePointerType(event.pointerType)) {
        // Focus the input so the user can continue with keyboard interactions.
        focusInput();
      }

      pointerHandlers.onPointerDown(event);
    },
  };

  const buttonState = solidMergeProps(state, {
    get disabled() {
      return disabled();
    },
  });

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<button>` with
  // `useButton`'s gates (a native button focusable while disabled) inlined, no props view (D32).
  if (
    canRenderNative(componentProps, NATIVE_STATIC_KEYS, true) &&
    // Static once `canRenderNative` passes: a plain value, read without tracking anything.
    (componentProps.nativeButton ?? true) === true
  ) {
    const model: StepperModel = {
      disabled,
      buttonDisabled: () => disabled() || readOnly(),
      id,
      onClick: props.onClick as (event: MouseEvent) => void,
      onPointerDown: props.onPointerDown as (event: PointerEvent) => void,
      pointerHandlers: pointerHandlers as unknown as Record<string, PressHandler>,
    };
    return renderNativeElement(BUTTON, componentProps, {
      own: OWN_KEYS,
      state: buttonState,
      stateWriter: writeNumberFieldState,
      mapping: stateAttributesMapping,
      literal: isIncrement ? INCREMENT_LITERAL : DECREMENT_LITERAL,
      attributes: writeStepperAttributes,
      partStyle: selectNoneStyle,
      handlers: STEPPER_HANDLERS,
      handlersIfPassed: STEPPER_HANDLERS_IF_PASSED,
      handlerTarget: model,
      reactive: true,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, ['disabled', 'nativeButton']);

  const { getButtonProps, buttonRef } = useButton({
    // Read-only steppers are exposed as unavailable through button disabled semantics, while
    // `data-readonly` (from `state`) is preserved for styling. `aria-readonly` isn't valid on the
    // `button` role, so it's intentionally not set.
    get disabled() {
      return disabled() || readOnly();
    },
    native: nativeButton,
    focusableWhenDisabled: true,
  });

  const element = useRenderElement('button', componentProps, {
    props: [props, elementProps, getButtonProps],
    ref: buttonRef,
    state: buttonState,
    stateAttributesMapping,
  });

  return element();
}
