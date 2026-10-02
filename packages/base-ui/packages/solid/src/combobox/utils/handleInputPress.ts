import { isElement } from '@floating-ui/utils/dom';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { getTarget, isInteractiveElement } from '../../floating-ui-solid/utils';
import type { ComboboxStore } from '../store';

export function handleInputPress(
  event: MouseEvent & { baseUIHandlerPrevented?: boolean | undefined },
  store: ComboboxStore,
  disabled: boolean,
  shouldIgnoreTarget?: ((target: Element | null) => boolean) | undefined,
) {
  if (event.baseUIHandlerPrevented) {
    return;
  }

  const target = getTarget(event);
  const targetElement = isElement(target) ? target : null;
  if (
    targetElement !== event.currentTarget &&
    (shouldIgnoreTarget?.(targetElement) || isInteractiveElement(targetElement))
  ) {
    return;
  }

  event.preventDefault();

  if (disabled) {
    return;
  }

  store.context.inputRef.current?.focus();

  if (store.state.openOnInputClick) {
    store.context.setOpen(true, createChangeEventDetails(REASONS.inputPress, event));
  }
}
