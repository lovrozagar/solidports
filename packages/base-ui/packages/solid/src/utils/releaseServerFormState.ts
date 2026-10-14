import { isHydrating } from 'solid-js';

const FORM_STATE: Array<[attribute: string, property: 'value' | 'checked' | 'selected']> = [
  ['value', 'value'],
  ['checked', 'checked'],
  ['selected', 'selected'],
];

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
