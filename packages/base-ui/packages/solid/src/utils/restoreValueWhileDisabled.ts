/**
 * Keeps a controlled hidden input's value when an `input` event reaches it while it is disabled
 * (a programmatic write; browsers do not dispatch input to disabled controls). React restores every
 * controlled input after an input event, disabled or not. Solid skips delegated handlers on
 * disabled elements, so the part's own `onInput` never runs there: a native listener restores it.
 */
export function restoreValueWhileDisabled(
  input: HTMLInputElement,
  disabled: () => boolean,
  value: () => string,
) {
  input.addEventListener('input', () => {
    if (disabled()) {
      input.value = value();
    }
  });
}
