import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { isJSDOM } from '../../utils/detectBrowser';
import { activeElement, contains, getTarget } from '../../utils/shadowDom';
import { type PopupTriggerMap } from '../../utils/popups';
import { FOCUSABLE_ATTRIBUTE, TYPEABLE_SELECTOR } from './constants';
import { createAttribute } from './createAttribute';

const interactiveSelector = `button,a,[role="button"],select,[tabindex]:not([tabindex="-1"]),${TYPEABLE_SELECTOR}`;

export function isInteractiveElement(element: Element | null | undefined) {
  return element ? Boolean(element.closest(interactiveSelector)) : false;
}

export { activeElement, contains, getTarget };

export function isTargetInsideEnabledTrigger(
  target: EventTarget | null | undefined,
  triggerElements: PopupTriggerMap,
) {
  if (!isElement(target)) {
    return false;
  }

  const targetElement = target as Element;

  if (triggerElements.hasElement(targetElement)) {
    return !targetElement.hasAttribute('data-trigger-disabled');
  }

  for (const [, trigger] of triggerElements.entries()) {
    if (contains(trigger, targetElement)) {
      return !trigger.hasAttribute('data-trigger-disabled');
    }
  }

  return false;
}

export function isEventTargetWithin(event: Event, node: Node | null | undefined) {
  if (node == null) {
    return false;
  }

  if ('composedPath' in event) {
    return event.composedPath().includes(node);
  }

  // TS thinks `event` is of type never as it assumes all browsers support composedPath, but browsers without shadow dom don't
  const eventAgain = event as Event;
  return eventAgain.target != null && node.contains(eventAgain.target as Node);
}

export function isRootElement(element: Element): boolean {
  return element.matches('html,body');
}

export function isTypeableElement(element: unknown): boolean {
  return isHTMLElement(element) && element.matches(TYPEABLE_SELECTOR);
}

export function isTypeableCombobox(element: Element | null | undefined) {
  if (!element) {
    return false;
  }
  return element.getAttribute('role') === 'combobox' && isTypeableElement(element);
}

export function matchesFocusVisible(element: Element | null) {
  // We don't want to block focus from working with `visibleOnly`
  // (JSDOM doesn't match `:focus-visible` when the element has `:focus`)
  if (!element || isJSDOM) {
    return true;
  }
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

export function getFloatingFocusElement(
  floatingElement: HTMLElement | null | undefined,
): HTMLElement | null {
  if (!floatingElement) {
    return null;
  }
  // Try to find the element that has `{...getFloatingProps()}` spread on it.
  // This indicates the floating element is acting as a positioning wrapper, and
  // so focus should be managed on the child element with the event handlers and
  // aria props.
  return floatingElement.hasAttribute(FOCUSABLE_ATTRIBUTE)
    ? floatingElement
    : floatingElement.querySelector(`[${FOCUSABLE_ATTRIBUTE}]`) || floatingElement;
}

/**
 * Solid adaptation for React's portal event bubbling: whether `node` is a render-tree descendant of
 * `ancestor`, following Solid portals (`_$host`) back to where they are rendered.
 */
export function isRenderTreeDescendant(
  ancestor: Node | null | undefined,
  node: Node | null | undefined,
): boolean {
  if (!ancestor) {
    return false;
  }

  let current: Node | null | undefined = node;
  while (current) {
    if (current === ancestor) {
      return true;
    }
    current =
      (current as Node & { _$host?: Node | null })._$host ||
      current.parentNode ||
      (current as Partial<ShadowRoot>).host;
  }

  return false;
}

export function isEventTargetInsidePortal<E extends Event>(event: E) {
  return !!(event.target as HTMLElement)?.closest(`[${createAttribute('portal')}]`);
}
