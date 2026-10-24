import { isHydrating } from 'solid-js';

const FORM_STATE: Array<[attribute: string, property: 'value' | 'checked' | 'selected']> = [
  ['value', 'value'],
  ['checked', 'checked'],
  ['selected', 'selected'],
];

/**
 * A form control's default state: the server prints its current value, checked or selected state
 * as these attributes, while the client sets the properties (an uncontrolled `defaultValue`, a
 * `prop:value`, a part's value effect). Removing one after hydration resets an untouched control,
 * so hydration never reconciles them away; `releaseFormStateAttributes` hands them over.
 */
export const FORM_STATE_ATTRIBUTES: ReadonlySet<string> = new Set(['value', 'checked', 'selected']);

/** The elements whose state the server prints as `FORM_STATE_ATTRIBUTES`. */
export const isFormControl = (el: Element) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLOptionElement;

/**
 * The form-state attributes a client render of these props keeps, so the release leaves them: a
 * `defaultValue` renders as `value` and a `defaultChecked` as `checked`; the rest are properties.
 */
export function clientFormStateAttributes(props: Record<string, unknown>): Set<string> {
  const keep = new Set<string>();
  if (props.defaultValue != null) {
    keep.add('value');
  }
  if (props.defaultChecked != null) {
    keep.add('checked');
  }
  return keep;
}

/**
 * Gives a hydrated form control the attributes a client render gives it, keeping its live state.
 *
 * The server renders a control's state as attributes (`value`, `checked`, `selected`); a client
 * render sets the properties. Hydration keeps the server's attributes next to the properties it
 * sets, and browsers read an input whose value equals its `value` attribute as prefilled by the
 * page: Chrome's autofill skips it. After hydration, each attribute is removed and its property
 * written back when that changed it. Where the property writes the attribute (a checkbox's or a
 * hidden input's `value`), it comes back, as a client render has it.
 */
export function releaseServerFormState(el: Element | null | undefined) {
  if (!el || !isHydrating()) {
    return;
  }
  queueMicrotask(() => releaseFormStateAttributes(el));
}

/** Removes a control's form-state attributes and writes their properties back (see above). */
export function releaseFormStateAttributes(el: Element, keep?: ReadonlySet<string>) {
  const control = el as unknown as Record<'value' | 'checked' | 'selected', unknown>;
  for (const [attribute, property] of FORM_STATE) {
    if (keep?.has(attribute) || !el.hasAttribute(attribute) || !(property in el)) {
      continue;
    }
    const state = control[property];
    el.removeAttribute(attribute);
    // Written back only when removing the attribute changed it, so a control a client render
    // leaves at its default gets no attribute back.
    if (control[property] !== state) {
      control[property] = state;
    }
  }
}
