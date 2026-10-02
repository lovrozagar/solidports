/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */

import { createRenderEffect, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { warn } from '../../utils/warn';
import { stopEvent } from '../../floating-ui-solid/utils';
import {
  IndexGuessBehavior,
  useCompositeListItem,
} from '../../internals/composite/list/useCompositeListItem';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { useDirection } from '../../direction-provider/DirectionContext';
import { createDepsEffect, splitComponentProps } from '../../solid-helpers';
import { useOTPFieldRootContext, getOTPFieldInputState } from '../root/OTPFieldRootContext';
import type { OTPFieldRootState } from '../root/OTPFieldRoot';
import { inputStateAttributesMapping } from '../utils/stateAttributesMapping';
import { normalizeOTPValueWithDetails, removeOTPCharacter, replaceOTPValue } from '../utils/otp';

/**
 * An individual OTP character input.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI OTP Field](https://base-ui.com/react/components/otp-field)
 */
export function OTPFieldInput(componentProps: OTPFieldInput.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'aria-label',
    'aria-labelledby',
  ]);

  const externalAriaLabel = () => local['aria-label'];
  const externalAriaLabelledBy = () => local['aria-labelledby'];

  const {
    activeIndex,
    autoComplete,
    disabled,
    form,
    focusInput,
    queueFocusInput,
    getInputId,
    handleInputBlur,
    handleInputFocus,
    inputMode,
    inputAriaLabelledBy,
    invalid,
    length,
    mask,
    pattern,
    reportValueInvalid,
    readOnly,
    required,
    normalizeValue,
    setValue,
    state,
    validationType,
    value,
  } = useOTPFieldRootContext();

  const { setRef, index } = useCompositeListItem({
    indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
  });

  // Solid: a signal, because the spread applies the ref after this component's render effects run.
  const [inputElement, setInputElement] = createSignal<HTMLInputElement | null>(null, {
    ownedWrite: true,
  });
  const direction = useDirection();

  const slotValue = () => value()[index()] ?? '';
  const inputState = () => getOTPFieldInputState(state, slotValue(), index());
  const slotAriaLabel = () => externalAriaLabel();
  const inheritedLabel = () => externalAriaLabelledBy() ?? inputAriaLabelledBy();
  const ariaLabel = () => (index() === 0 ? undefined : slotAriaLabel());

  if (process.env.NODE_ENV !== 'production') {
    createDepsEffect(
      () => ({ index: index(), slotAriaLabel: slotAriaLabel() }),
      (deps) => {
        if (
          deps.index !== 0 ||
          deps.slotAriaLabel == null ||
          untrack(inputElement)?.labels?.length
        ) {
          return;
        }
        warn(
          '<OTPField.Input> ignores `aria-label` on the first input. Use a `<label>` or `<Field.Label>` to label the OTP field.',
          '',
        );
      },
    );
  }

  // Solid: the spread rewrites `value` on every pass (collapsing the selection) and never reverts a
  // rejected edit. Sync the slot like React's controlled input: write only when the DOM differs.
  function syncInputValue(input: HTMLInputElement | null, nextValue: string) {
    if (input && input.value !== nextValue) {
      input.value = nextValue;
    }
  }

  createRenderEffect(
    () => [inputElement(), slotValue()] as const,
    ([input, nextValue]) => {
      syncInputValue(input, nextValue);
    },
  );

  function handleInputChange(event: InputEvent & { currentTarget: HTMLInputElement }) {
    if (event.defaultPrevented || disabled() || readOnly()) {
      return;
    }

    const rawValue = (event.currentTarget as HTMLInputElement).value;
    const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
      rawValue,
      length(),
      validationType(),
      normalizeValue(),
    );

    if (didRejectCharacters) {
      reportValueInvalid(rawValue, createGenericEventDetails(REASONS.inputChange, event));
    }

    if (nextDigits === '') {
      if (rawValue === '') {
        setValue(
          removeOTPCharacter(value(), index()),
          createChangeEventDetails(REASONS.inputClear, event),
        );
      } else if (slotValue() !== '') {
        (event.currentTarget as HTMLInputElement).value = slotValue();
        (event.currentTarget as HTMLInputElement).select();
      }
      return;
    }

    const nextValue = replaceOTPValue(
      value(),
      index(),
      nextDigits,
      length(),
      validationType(),
      normalizeValue(),
    );

    const committedValue = setValue(
      nextValue,
      createChangeEventDetails(REASONS.inputChange, event),
    );

    if (committedValue != null) {
      const nextInput = Math.min(index() + nextDigits.length, length() - 1);
      queueFocusInput(nextInput, committedValue);
    }
  }

  const inputProps: JSX.InputHTMLAttributes<HTMLInputElement> = {
    get id() {
      return getInputId(index());
    },
    get type() {
      return mask() ? 'password' : 'text';
    },
    get inputmode() {
      return inputMode();
    },
    get autocomplete() {
      return index() === 0 ? autoComplete() : 'off';
    },
    autocorrect: 'off',
    spellcheck: 'false',
    get enterkeyhint() {
      return index() === length() - 1 ? 'done' : 'next';
    },
    // Only the first slot has a max length to avoid password manager bubbles appearing after later inputs.
    get maxlength() {
      return index() === 0 ? length() : undefined;
    },
    get tabindex() {
      return activeIndex() === index() ? 0 : -1;
    },
    get disabled() {
      return disabled();
    },
    get form() {
      return form();
    },
    get pattern() {
      return pattern();
    },
    get readonly() {
      return readOnly();
    },
    get required() {
      return required();
    },
    get 'aria-labelledby'() {
      return ariaLabel() == null ? inheritedLabel() : undefined;
    },
    get 'aria-invalid'() {
      return !disabled() && invalid() ? 'true' : undefined;
    },
    get 'aria-label'() {
      return ariaLabel();
    },
    onMouseDown(event) {
      if ((event as MouseEvent).defaultPrevented || disabled()) {
        return;
      }
      (event as MouseEvent).preventDefault();
      focusInput(index());
    },
    onFocus(event) {
      if ((event as FocusEvent).defaultPrevented || disabled()) {
        return;
      }
      handleInputFocus(index(), event as FocusEvent & { currentTarget: HTMLInputElement });
    },
    onBlur(event) {
      if ((event as FocusEvent).defaultPrevented) {
        return;
      }
      handleInputBlur(event as FocusEvent & { currentTarget: HTMLInputElement });
    },
    /* onInput used instead of onChange for Solid reactivity */
    onInput(event) {
      handleInputChange(event as InputEvent & { currentTarget: HTMLInputElement });
      // Solid: restore the controlled slot value after the change, as React does for controlled inputs.
      syncInputValue(event.currentTarget as HTMLInputElement, untrack(slotValue));
    },
    onKeyDown(event) {
      const kbEvent = event as KeyboardEvent & { currentTarget: HTMLInputElement };
      if (kbEvent.defaultPrevented || disabled()) {
        return;
      }

      const currentIndex = index();
      const currentLength = length();
      const currentValue = value();
      const firstIndex = 0;
      const lastIndex = Math.max(currentLength - 1, firstIndex);
      const endTargetIndex = Math.min(currentValue.length, lastIndex);
      const hasBoundaryModifier = (kbEvent.ctrlKey || kbEvent.metaKey) && !kbEvent.altKey;
      const isRtl = direction() === 'rtl';
      const previousKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
      const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';

      if (kbEvent.key === previousKey) {
        stopEvent(kbEvent);
        focusInput(hasBoundaryModifier ? firstIndex : Math.max(firstIndex, currentIndex - 1));
        return;
      }

      if (kbEvent.key === nextKey) {
        stopEvent(kbEvent);
        focusInput(hasBoundaryModifier ? endTargetIndex : Math.min(lastIndex, currentIndex + 1));
        return;
      }

      if (kbEvent.key === 'Home' || kbEvent.key === 'ArrowUp') {
        stopEvent(kbEvent);
        focusInput(firstIndex);
        return;
      }

      if (kbEvent.key === 'End' || kbEvent.key === 'ArrowDown') {
        stopEvent(kbEvent);
        focusInput(endTargetIndex);
        return;
      }

      if (readOnly()) {
        return;
      }

      function setKeyboardValue(nextValue: string, targetIndex: number) {
        const committedValue = setValue(
          nextValue,
          createChangeEventDetails(REASONS.keyboard, kbEvent),
        );

        if (committedValue != null) {
          queueFocusInput(targetIndex, committedValue);
        }
      }

      if (kbEvent.key === 'Backspace' && hasBoundaryModifier) {
        stopEvent(kbEvent);
        setKeyboardValue('', firstIndex);
        return;
      }

      if (kbEvent.key === 'Delete') {
        stopEvent(kbEvent);
        setKeyboardValue(removeOTPCharacter(currentValue, currentIndex), currentIndex);
        return;
      }

      const inputValue = kbEvent.currentTarget.value;
      const fullSelection =
        kbEvent.currentTarget.selectionStart === 0 &&
        kbEvent.currentTarget.selectionEnd === inputValue.length;

      if (kbEvent.key.length === 1 && fullSelection && slotValue() === kbEvent.key) {
        stopEvent(kbEvent);
        if (currentIndex < currentLength - 1) {
          focusInput(currentIndex + 1);
        }
        return;
      }

      if (kbEvent.key === 'Backspace') {
        stopEvent(kbEvent);
        const targetIndex = Math.max(firstIndex, currentIndex - 1);
        const deleteIndex = slotValue() === '' ? targetIndex : currentIndex;
        setKeyboardValue(removeOTPCharacter(currentValue, deleteIndex), targetIndex);
      }
    },
    onPaste(event) {
      const pevent = event as ClipboardEvent;
      if (pevent.defaultPrevented || disabled() || readOnly()) {
        return;
      }

      let rawValue = '';

      try {
        rawValue = pevent.clipboardData?.getData('text/plain') ?? '';
      } catch {
        if (process.env.NODE_ENV !== 'production') {
          warn('<OTPField.Input> could not read clipboard text during paste handling.', '');
        }
        return;
      }

      pevent.preventDefault();

      const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
        rawValue,
        length(),
        validationType(),
        normalizeValue(),
      );

      if (didRejectCharacters) {
        reportValueInvalid(rawValue, createGenericEventDetails(REASONS.inputPaste, pevent));
      }

      if (nextDigits === '') {
        return;
      }

      const committedValue = setValue(
        replaceOTPValue(value(), index(), nextDigits, length(), validationType(), normalizeValue()),
        createChangeEventDetails(REASONS.inputPaste, pevent),
      );

      if (committedValue != null) {
        const nextInput = Math.min(index() + nextDigits.length, length() - 1);
        queueFocusInput(nextInput, committedValue);
      }
    },
  };

  /* Reactive getter object so data-* state attributes update when value/index change.
     Plain inputState() snapshot would freeze attributes at mount time. */
  const liveState: OTPFieldInputState = {
    get complete() {
      return inputState().complete;
    },
    get dirty() {
      return inputState().dirty;
    },
    get disabled() {
      return inputState().disabled;
    },
    get filled() {
      return inputState().filled;
    },
    get focused() {
      return inputState().focused;
    },
    get index() {
      return inputState().index;
    },
    get length() {
      return inputState().length;
    },
    get readOnly() {
      return inputState().readOnly;
    },
    get required() {
      return inputState().required;
    },
    get touched() {
      return inputState().touched;
    },
    get valid() {
      return inputState().valid;
    },
    get value() {
      return inputState().value;
    },
  };

  const element = useRenderElement('input', componentProps, {
    props: [inputProps as any, elementProps],
    ref: (el: HTMLInputElement | null | undefined) => {
      setRef(el ?? null);
      setInputElement(el ?? null);
    },
    state: liveState,
    stateAttributesMapping: inputStateAttributesMapping,
  });

  return element();
}

export interface OTPFieldInputState extends Omit<OTPFieldRootState, 'filled' | 'value'> {
  /** Whether this input contains a character. */
  filled: boolean;
  /** The input index. */
  index: number;
  /** The character rendered in this slot. */
  value: string;
}

export interface OTPFieldInputProps extends BaseUIComponentProps<
  'input',
  OTPFieldInputState,
  JSX.InputHTMLAttributes<HTMLInputElement>
> {}

export namespace OTPFieldInput {
  export type State = OTPFieldInputState;
  export type Props = OTPFieldInputProps;
}
