/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { access, type MaybeAccessor, type ReactLikeRef } from '../../solid-helpers';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../utils/createBaseUIEventDetails';
import type { HTMLProps } from '../../utils/types';
import {
  DEFAULT_STEP,
  CHANGE_VALUE_TICK_DELAY,
  START_AUTO_CHANGE_DELAY,
  SCROLLING_POINTER_MOVE_DISTANCE,
} from '../utils/constants';
import { parseNumber } from '../utils/parse';
import { REASONS } from '../../utils/reasons';
import type {
  Direction,
  DirectionalChangeReason,
  EventWithOptionalKeyState,
  IncrementValueParameters,
} from '../utils/types';
import type { NumberFieldRoot } from './NumberFieldRoot';
import { usePressAndHold } from '../../internals/usePressAndHold';

// Treat pen as touch-like to avoid forcing the software keyboard on stylus taps.
// Linux Chrome may emit "pen" historically for mouse usage due to a bug, but the touch path
// still works with minor behavioral differences.
function isTouchLikePointerType(pointerType: string) {
  return pointerType === 'touch' || pointerType === 'pen';
}

export function useNumberFieldButton(params: UseNumberFieldButtonParameters) {
  const disabled = () => access(params.disabled);
  const id = () => access(params.id);
  const inputValue = () => access(params.inputValue);
  const isIncrement = () => access(params.isIncrement);
  const locale = () => access(params.locale);
  const readOnly = () => access(params.readOnly);

  const pressReason = (): NumberFieldRoot.ChangeEventReason =>
    isIncrement() ? REASONS.incrementPress : REASONS.decrementPress;

  function commitValue(nativeEvent: MouseEvent | PointerEvent) {
    params.allowInputSyncRef.current = true;

    /* The input may be dirty but not yet blurred — commit it before incrementing. */
    const parsedValue = parseNumber(inputValue(), locale(), params.formatOptionsRef.current);

    if (parsedValue !== null) {
      params.valueRef.current = parsedValue;
      params.setValue(
        parsedValue,
        createChangeEventDetails<
          NumberFieldRoot.ChangeEventReason,
          { direction?: Direction | undefined }
        >(pressReason(), nativeEvent, undefined, {
          direction: isIncrement() ? 1 : -1,
        }),
      );
    }
  }

  const { pointerHandlers, shouldSkipClick } = usePressAndHold({
    get disabled() {
      return disabled() || readOnly();
    },
    elementRef: params.inputRef,
    onStop(nativeEvent) {
      const committed = params.lastChangedValueRef.current ?? params.valueRef.current;
      params.onValueCommitted(committed, createGenericEventDetails(pressReason(), nativeEvent));
    },
    scrollDistance: SCROLLING_POINTER_MOVE_DISTANCE,
    startDelay: START_AUTO_CHANGE_DELAY,
    tick(triggerEvent) {
      const amount =
        params.getStepAmount(triggerEvent as EventWithOptionalKeyState) ?? DEFAULT_STEP;
      return params.incrementValue(amount, {
        direction: isIncrement() ? 1 : -1,
        event: triggerEvent,
        reason: pressReason() as DirectionalChangeReason,
      });
    },
    tickDelay: CHANGE_VALUE_TICK_DELAY,
  });

  const props: HTMLProps & { disabled?: boolean } = {
    get disabled() {
      return disabled();
    },
    get 'aria-readonly'() {
      return readOnly() ? 'true' : undefined;
    },
    get 'aria-label'() {
      return isIncrement() ? 'Increase' : 'Decrease';
    },
    get 'aria-controls'() {
      return id();
    },
    /* Keyboard users use the input directly; `tabIndex: -1` keeps buttons out of tab order. */
    tabindex: -1,
    style: {
      '--webkit-user-select': 'none',
      'user-select': 'none',
    },
    onTouchStart: pointerHandlers.onTouchStart,
    onTouchEnd: pointerHandlers.onTouchEnd,
    onClick(event) {
      const isDisabled = disabled() || readOnly();
      if (event.defaultPrevented || isDisabled || shouldSkipClick(event)) {
        return;
      }

      commitValue(event);

      const amount = params.getStepAmount(event) ?? DEFAULT_STEP;
      const prev = params.valueRef.current;

      params.incrementValue(amount, {
        direction: isIncrement() ? 1 : -1,
        event,
        reason: pressReason() as any,
      });

      const committed = params.lastChangedValueRef.current ?? params.valueRef.current;
      if (committed !== prev) {
        params.onValueCommitted(committed, createGenericEventDetails(pressReason(), event));
      }
    },
    onPointerDown(event) {
      const isMainButton = !event.button || event.button === 0;
      if (event.defaultPrevented || readOnly() || !isMainButton || disabled()) {
        return;
      }

      /* Sync dirty input value before starting the hold sequence. */
      commitValue(event);

      if (!isTouchLikePointerType(event.pointerType)) {
        /* Focus the input so the user can continue with keyboard interactions. */
        params.inputRef.current?.focus();
      }

      pointerHandlers.onPointerDown(event);
    },
    onPointerUp: pointerHandlers.onPointerUp,
    onPointerMove: pointerHandlers.onPointerMove,
    onMouseEnter: pointerHandlers.onMouseEnter,
    onMouseLeave: pointerHandlers.onMouseLeave,
    onMouseUp: pointerHandlers.onMouseUp,
  };

  return { props };
}

export interface UseNumberFieldButtonParameters {
  inputRef: ReactLikeRef<HTMLInputElement | null | undefined>;
  allowInputSyncRef: ReactLikeRef<boolean | null>;
  formatOptionsRef: ReactLikeRef<Intl.NumberFormatOptions | undefined>;
  valueRef: ReactLikeRef<number | null>;
  lastChangedValueRef: ReactLikeRef<number | null>;
  disabled: MaybeAccessor<boolean>;
  getStepAmount: (event?: EventWithOptionalKeyState) => number | undefined;
  id: MaybeAccessor<string | undefined>;
  incrementValue: (amount: number, params: IncrementValueParameters) => boolean;
  inputValue: MaybeAccessor<string>;
  isIncrement: MaybeAccessor<boolean>;
  locale?: MaybeAccessor<Intl.LocalesArgument | undefined>;
  readOnly: MaybeAccessor<boolean>;
  setValue: (value: number | null, details: NumberFieldRoot.ChangeEventDetails) => boolean;
  onValueCommitted: (
    value: number | null,
    eventDetails: NumberFieldRoot.CommitEventDetails,
  ) => void;
}

export interface UseNumberFieldButtonReturnValue {
  props: HTMLProps;
}
