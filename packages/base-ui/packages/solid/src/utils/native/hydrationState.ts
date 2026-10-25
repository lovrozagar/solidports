/*
 * A hydrating native element's reconcile helpers (`HydratingWriter` in `element.ts`): the one shared
 * microtask after `hydrate()` returns, the attribute keys of a write, and the development check of
 * the server's attributes.
 */
import { FORM_STATE_ATTRIBUTES, isFormControl } from '../releaseServerFormState';
import { warn } from '../warn';
import { isHandlerKey } from './consumer';

/** Keys a write renders as another attribute: a control's default state is its `value`/`checked`. */
const ATTRIBUTE_OF: Record<string, string> = { defaultvalue: 'value', defaultchecked: 'checked' };

let pendingReconciles: Array<[Element, () => void]> | undefined;

/**
 * Runs `reconcile` once the current `hydrate()` call has returned (a microtask), in one shared
 * microtask for every element that needs it. An element disconnected by then (its part was
 * disposed) is skipped.
 */
export function afterHydration(el: Element, reconcile: () => void): void {
  if (pendingReconciles === undefined) {
    pendingReconciles = [];
    queueMicrotask(() => {
      const pending = pendingReconciles!;
      pendingReconciles = undefined;
      for (const [element, run] of pending) {
        if (element.isConnected) {
          run();
        }
      }
    });
  }
  pendingReconciles.push([el, reconcile]);
}

/** The keys of a write that are element attributes: no refs, children, handlers or functions. */
export function attributesOf(written: Record<string, unknown>): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const key in written) {
    if (
      key !== 'ref' &&
      key !== 'children' &&
      !isHandlerKey(key) &&
      typeof written[key] !== 'function'
    ) {
      attributes[key] = written[key];
    }
  }
  return attributes;
}

/**
 * Dev only: the attributes a hydrated element holds (the server's markup) against the ones the
 * client's first write expected it to hold. A difference means the two sides computed the part's
 * attributes from different inputs, which the post-hydration diff would not see. `scripted` names
 * attributes a prehydration script may already have changed, which the check skips.
 */
export function checkHydratedAttributes(
  el: Element,
  scripted: readonly string[] | undefined,
  ...expected: Record<string, unknown>[]
) {
  const rendered = new Set<string>();
  for (const attributes of expected) {
    for (const key of Object.keys(attributes)) {
      const value = attributes[key];
      if (value != null && value !== false) {
        const name = key.toLowerCase();
        rendered.add(ATTRIBUTE_OF[name] ?? name);
      }
    }
  }
  // A control's form state is the server's to print and the client's to hold as a property
  // (released after hydration), so a server-only `value`, `checked` or `selected` is expected.
  const keepsFormState = isFormControl(el);
  const skipped = (name: string) => scripted !== undefined && scripted.includes(name);
  const server = el.getAttributeNames().filter((name) => name !== '_hk' && name !== 'data-hk');
  const extra = server.filter(
    (name) =>
      !rendered.has(name) &&
      !(keepsFormState && FORM_STATE_ATTRIBUTES.has(name)) &&
      !skipped(name),
  );
  const missing = [...rendered].filter((name) => !el.hasAttribute(name) && !skipped(name));
  if (extra.length > 0 || missing.length > 0) {
    warn(
      `The server rendered <${el.localName}> with attributes the hydrating client did not compute (server only: ${extra.join(', ') || 'none'}; client only: ${missing.join(', ') || 'none'}).`,
      'Hydration keeps the server markup and corrects only what changes after it, so these stay wrong.',
      'Render the part from the same props and state on the server and the client.',
    );
  }
}
