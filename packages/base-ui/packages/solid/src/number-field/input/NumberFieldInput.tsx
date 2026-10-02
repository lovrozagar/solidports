import { createEffect, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useValueChanged } from '../../internals/useValueChanged';
import { useFormContext } from '../../form/FormContext';
import { splitComponentProps } from '../../solid-helpers';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../utils/createBaseUIEventDetails';
import { formatNumber } from '../../utils/formatNumber';
import { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps, BaseUIHTMLProps, HTMLProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { warn } from '../../utils/warn';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import {
  getNumberLocaleDetails,
  isNumeralChar,
  parseNumber,
  ANY_MINUS_RE,
  ANY_PLUS_RE,
  ANY_MINUS_DETECT_RE,
  ANY_PLUS_DETECT_RE,
  FORMAT_CONTROL_DETECT_RE,
} from '../utils/parse';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { hasNumberFormatRoundingOptions, removeFloatingPointErrors } from '../utils/validate';

const NAVIGATE_KEYS = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Enter',
  'Escape',
]);

/**
 * The native input control in the number field.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldInput(componentProps: NumberFieldInput.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const {
    allowInputSyncRef,
    formatOptionsRef,
    getAllowedNonNumericKeys,
    getStepAmount,
    id,
    incrementValue,
    inputMode,
    max,
    min,
    name,
    nameProp,
    setValue,
    state,
    setInputValue,
    locale,
    inputRef,
    onValueCommitted,
    lastChangedValueRef,
    hasPendingCommitRef,
    valueRef,
  } = useNumberFieldRootContext();
  // Solid: `state` getters stand in for React's per-render destructure.
  const disabled = () => state.disabled;
  const readOnly = () => state.readOnly;
  const value = () => state.value;
  const inputValue = () => state.inputValue;

  const { clearErrors } = useFormContext();
  const { validationMode, setTouched, setFocused, invalid, shouldValidateOnChange, validation } =
    useFieldRootContext();
  const { labelId } = useLabelableContext();

  let blockRevalidationRef = false;
  let pendingCaretRef: number | null = null;

  useRegisterFieldControl(inputRef, id, value, undefined, () => !disabled(), nameProp);

  // After a paste splices text into the controlled value, the browser would otherwise drop the
  // caret at the end of the new value. Restore it just after the inserted text.
  // Solid: runs after the displayed text is written to the DOM (React runs it after every render).
  createEffect(inputValue, () => {
    if (pendingCaretRef != null) {
      const caret = pendingCaretRef;
      pendingCaretRef = null;
      inputRef.current?.setSelectionRange(caret, caret);
    }
  });

  // Solid: React's callback is a stable callback reading the latest values, so read them untracked.
  useValueChanged(value, () =>
    untrack(() => {
      clearErrors(name());

      if (blockRevalidationRef && !shouldValidateOnChange()) {
        blockRevalidationRef = false;
        return;
      }

      validation.change(value());
    }),
  );

  const inputProps: JSX.InputHTMLAttributes<HTMLInputElement> = {
    get id() {
      return id();
    },
    get required() {
      return state.required;
    },
    get disabled() {
      return disabled();
    },
    get readonly() {
      return readOnly();
    },
    get inputmode() {
      return inputMode();
    },
    type: 'text',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-roledescription': 'Number field',
    get 'aria-invalid'() {
      return !disabled() && invalid() ? 'true' : undefined;
    },
    get 'aria-labelledby'() {
      return labelId();
    },
    onFocus(event) {
      // Read-only inputs are still focusable; only the value-changing handlers stay gated on it.
      if (event.defaultPrevented || disabled()) {
        return;
      }

      setFocused(true);
    },
    onBlur(event) {
      if (event.defaultPrevented || disabled()) {
        return;
      }

      setTouched(true);
      setFocused(false);

      if (readOnly()) {
        return;
      }

      const hadManualInput = !allowInputSyncRef.current;
      const hadPendingProgrammaticChange = hasPendingCommitRef.current;

      allowInputSyncRef.current = true;

      const currentInputValue = inputValue();
      const currentValue = value();

      if (currentInputValue.trim() === '') {
        const clearDetails = createChangeEventDetails(REASONS.inputClear, event);
        setValue(null, clearDetails);
        // Respect a canceled clear, mirroring the non-empty blur path below.
        if (clearDetails.isCanceled) {
          return;
        }
        if (validationMode() === 'onBlur') {
          validation.commit(null);
        }
        // Don't report a commit when blurring an already-empty field that the user never
        // interacted with: nothing was cleared and no programmatic change is pending.
        if (hadManualInput || hadPendingProgrammaticChange || currentValue !== null) {
          onValueCommitted(null, createGenericEventDetails(REASONS.inputClear, event));
        }
        return;
      }

      const formatOptions = formatOptionsRef.current;
      const parsedValue = parseNumber(currentInputValue, locale(), formatOptions);
      if (parsedValue === null) {
        return;
      }

      // Avoid applying Intl's default precision unless the format opts into rounding.
      const hasRoundingOptions = hasNumberFormatRoundingOptions(formatOptions);

      let committed: number | null;
      if (!hadManualInput && !hasRoundingOptions) {
        // No rounding options and no manual edit: the visible text is purely formatted
        // display, so keep the authoritative numeric value as-is rather than re-parsing the
        // rounded text and discarding precision (e.g. focus/blur with no edits, or blur after
        // a programmatic change).
        committed = currentValue;
      } else if (hasRoundingOptions) {
        // Explicit rounding options apply to the committed value, whether typed or external.
        committed = removeFloatingPointErrors(parsedValue, formatOptions);
      } else {
        committed = parsedValue;
      }

      const nextEventDetails = createGenericEventDetails(REASONS.inputBlur, event);
      const shouldUpdateValue = currentValue !== committed;
      const shouldCommit = hadManualInput || shouldUpdateValue || hadPendingProgrammaticChange;

      // Use the stored value after `setValue` clamps it.
      let committedValue = committed;
      if (shouldUpdateValue) {
        const changeDetails = createChangeEventDetails(REASONS.inputBlur, event);
        blockRevalidationRef = true;
        setValue(committed, changeDetails);
        if (changeDetails.isCanceled) {
          blockRevalidationRef = false;
          return;
        }
        committedValue = lastChangedValueRef.current;
        // If validation normalized back to the current value, `useValueChanged` won't fire to
        // reset the flag, so reset it here or the next external change won't revalidate.
        if (committedValue === currentValue) {
          blockRevalidationRef = false;
        }
      }
      if (validationMode() === 'onBlur') {
        validation.commit(committedValue);
      }
      if (shouldCommit) {
        onValueCommitted(committedValue, nextEventDetails);
      }

      // Normalize only the displayed text
      const canonicalText = formatNumber(committedValue, locale(), formatOptions);
      if (currentInputValue !== canonicalText) {
        setInputValue(canonicalText);
      }
    },
    // Solid: React's `onChange` on a text input is the native `input` event.
    onInput(event) {
      // Workaround for https://github.com/facebook/react/issues/9023
      if (event.defaultPrevented) {
        // Solid: a controlled React input restores its value on re-render; restore it here.
        event.currentTarget.value = inputValue();
        return;
      }

      allowInputSyncRef.current = false;
      const targetValue = event.currentTarget.value;

      if (targetValue.trim() === '') {
        setInputValue(targetValue);
        setValue(null, createChangeEventDetails(REASONS.inputClear, event));
        return;
      }

      // Update the input text immediately and only fire onValueChange if the typed value is
      // currently parseable into a number. This preserves good UX for IME
      // composition/partial input while still providing live numeric updates when possible.
      const allowedNonNumericKeys = getAllowedNonNumericKeys();
      const isValidCharacterString = Array.from(targetValue).every(
        (ch) =>
          isNumeralChar(ch) ||
          ANY_MINUS_DETECT_RE.test(ch) ||
          allowedNonNumericKeys.has(ch) ||
          // Bidi/format controls are stripped by `parseNumber`; don't let them reject the string
          // (RTL locales insert them around exponent/currency signs, e.g. scientific notation).
          FORMAT_CONTROL_DETECT_RE.test(ch),
      );

      if (!isValidCharacterString) {
        // Solid: a controlled React input restores its value on re-render; restore it here.
        event.currentTarget.value = inputValue();
        return;
      }

      const parsedValue = parseNumber(targetValue, locale(), formatOptionsRef.current);

      setInputValue(targetValue);

      if (parsedValue !== null) {
        setValue(parsedValue, createChangeEventDetails(REASONS.inputChange, event));
      }
    },
    onKeyDown(event) {
      if (event.defaultPrevented || readOnly() || disabled()) {
        return;
      }

      // Snapshot the dirty state without clearing it: navigation/allowed keys (ArrowLeft, Tab,
      // Enter, Escape, …) return early without changing the value, so marking the input synced
      // here would wrongly discard dirty-input authority. Only the value-changing branches below
      // mark it synced.
      const hadManualInput = !allowInputSyncRef.current;

      const allowedNonNumericKeys = getAllowedNonNumericKeys();

      let isAllowedNonNumericKey = allowedNonNumericKeys.has(event.key);

      const { decimal, currency, percentSign } = getNumberLocaleDetails(
        locale(),
        formatOptionsRef.current,
      );

      const currentInputValue = inputValue();
      const selectionStart = event.currentTarget.selectionStart;
      const selectionEnd = event.currentTarget.selectionEnd;
      const isAllSelected = selectionStart === 0 && selectionEnd === currentInputValue.length;

      const selectionContainsIndex = (index: number) =>
        selectionStart != null &&
        selectionEnd != null &&
        index >= selectionStart &&
        index < selectionEnd;

      // Only allow a single sign character: permit it when there is no existing sign of either
      // kind, when all text is selected, or when the selection covers the existing sign so it's
      // being replaced.
      const signGroups = [
        [ANY_MINUS_DETECT_RE, ANY_MINUS_RE],
        [ANY_PLUS_DETECT_RE, ANY_PLUS_RE],
      ] as const;
      signGroups.forEach(([detectRe, globalRe]) => {
        if (
          detectRe.test(event.key) &&
          Array.from(allowedNonNumericKeys).some((k) => detectRe.test(k))
        ) {
          const existingIndex = currentInputValue.search(globalRe);
          const isReplacingExisting = existingIndex !== -1 && selectionContainsIndex(existingIndex);
          isAllowedNonNumericKey =
            !(
              ANY_MINUS_DETECT_RE.test(currentInputValue) ||
              ANY_PLUS_DETECT_RE.test(currentInputValue)
            ) ||
            isAllSelected ||
            isReplacingExisting;
        }
      });

      // Only allow one of each symbol.
      [decimal, currency, percentSign].forEach((symbol) => {
        if (event.key === symbol) {
          const symbolIndex = currentInputValue.indexOf(symbol);
          const isSymbolHighlighted = selectionContainsIndex(symbolIndex);
          isAllowedNonNumericKey = symbolIndex === -1 || isAllSelected || isSymbolHighlighted;
        }
      });

      const isNavigateKey = NAVIGATE_KEYS.has(event.key);
      // Alt+ArrowUp/ArrowDown selects smallStep, so don't treat it as a bypass modifier.
      const isStepKey = event.key === 'ArrowUp' || event.key === 'ArrowDown';

      if (
        // Allow composition events (e.g., pinyin)
        // event.nativeEvent.isComposing does not work in Safari:
        // https://bugs.webkit.org/show_bug.cgi?id=165004
        event.which === 229 ||
        (event.altKey && !isStepKey) ||
        event.ctrlKey ||
        event.metaKey ||
        isAllowedNonNumericKey ||
        isNumeralChar(event.key) ||
        isNavigateKey
      ) {
        return;
      }

      // Home/End jump to the corresponding bound, but only when that bound is defined.
      const minValue = min();
      const maxValue = max();
      let boundaryValue: number | null = null;
      if (event.key === 'Home' && minValue != null) {
        boundaryValue = minValue;
      } else if (event.key === 'End' && maxValue != null) {
        boundaryValue = maxValue;
      }

      // Let the browser handle multi-character keys we don't act on (PageUp, Insert, F-keys,
      // Home/End without min/max); invalid single characters are still blocked below.
      if (event.key.length > 1 && !isStepKey && boundaryValue === null) {
        return;
      }

      // Step from the authoritative numeric value unless the input has unsaved manual edits.
      // When the text is already synced, parsing the rounded display would collapse precision,
      // so pass no `currentValue` and let `incrementValue` fall back to the numeric state
      // (mirrors the button path).
      const currentValue = hadManualInput
        ? parseNumber(currentInputValue, locale(), formatOptionsRef.current)
        : null;

      const amount = getStepAmount(event);

      // Prevent insertion of text or caret from moving.
      event.preventDefault();
      event.stopPropagation();

      const commitDetails = createGenericEventDetails(REASONS.keyboard, event);

      let changed = false;
      if (isStepKey || boundaryValue !== null) {
        allowInputSyncRef.current = true;
      }
      if (isStepKey) {
        // When stepping from the synced numeric state, refresh the commit ref to the current
        // value so a canceled step can't commit a stale `lastChangedValueRef` left over from an
        // earlier change (mirrors the button path).
        if (!hadManualInput) {
          lastChangedValueRef.current = valueRef.current;
        }

        changed = incrementValue(amount, {
          direction: event.key === 'ArrowUp' ? 1 : -1,
          currentValue,
          event,
          reason: REASONS.keyboard,
        });
      } else if (boundaryValue !== null) {
        changed = setValue(boundaryValue, createChangeEventDetails(REASONS.keyboard, event));
      }

      // `changed` is only true when `setValue` applied the change, which records the stored
      // (clamped/snapped) value, so commit that rather than the pre-validation input.
      if (changed) {
        onValueCommitted(lastChangedValueRef.current, commitDetails);
      }
    },
    onPaste(event) {
      if (event.defaultPrevented || readOnly() || disabled()) {
        return;
      }

      let pastedData = '';

      try {
        pastedData = event.clipboardData?.getData('text/plain') ?? '';
      } catch {
        /* istanbul ignore else -- `process.env.NODE_ENV` is a build-time constant under test */
        if (process.env.NODE_ENV !== 'production') {
          // Solid: there is no owner stack to append.
          warn('<NumberField.Input> could not read clipboard text during paste handling.');
        }

        return;
      }

      // Prevent `onChange` from being called.
      event.preventDefault();

      // Insert the pasted text at the caret/selection instead of replacing the entire value,
      // matching native input behavior (e.g. pasting "5" into "123|" yields "1235").
      // The component renders `type="text"`, which always reports a selection range. Overriding
      // `type` with a selection-less one (`email`, `number`) is unsupported either way: the caret
      // restore above throws on those, so there is no working behavior to preserve here.
      const input = event.currentTarget;
      const selectionStart = input.selectionStart!;
      const selectionEnd = input.selectionEnd!;
      const currentInputValue = inputValue();
      const nextText =
        currentInputValue.slice(0, selectionStart) +
        pastedData +
        currentInputValue.slice(selectionEnd);

      const parsedValue = parseNumber(nextText, locale(), formatOptionsRef.current);

      if (parsedValue !== null) {
        allowInputSyncRef.current = false;
        pendingCaretRef = selectionStart + pastedData.length;
        setValue(parsedValue, createChangeEventDetails(REASONS.inputPaste, event));
        setInputValue(nextText);
      }
    },
  };

  // Solid: `prop:value` writes `input.value` only when the text changes, as React does; a plain
  // `value` is re-assigned on every spread update, which moves the caret. Solid's JSX types lock
  // `prop:value` to `never`, so the entry is typed as plain props.
  const valueProps = {
    get 'prop:value'() {
      return inputValue();
    },
  } as BaseUIHTMLProps;

  const element = useRenderElement('input', componentProps, {
    ref: (el) => {
      inputRef.current = el;
    },
    state,
    props: [
      inputProps as BaseUIHTMLProps,
      valueProps,
      elementProps,
      (props: HTMLProps) => validation.getValidationProps(disabled(), props),
    ],
    stateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface NumberFieldInputState extends NumberFieldRootState {}

export interface NumberFieldInputProps extends BaseUIComponentProps<
  'input',
  NumberFieldInput.State,
  JSX.InputHTMLAttributes<HTMLInputElement>
> {
  /**
   * A user-friendly description of the input's role for assistive tech. This is a role
   * description, not an accessible name — use `Field.Label` or `aria-label` to name the control.
   * @default 'Number field'
   */
  'aria-roledescription'?: JSX.AriaAttributes['aria-roledescription'] | undefined;
}

export namespace NumberFieldInput {
  export type State = NumberFieldInputState;
  export type Props = NumberFieldInputProps;
}
