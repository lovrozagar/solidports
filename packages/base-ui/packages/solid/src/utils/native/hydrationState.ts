/*
 * A hydrating native element's reconcile helpers (`HydratingWriter` in `element.ts`): the one shared
 * microtask after `hydrate()` returns, the attribute keys of a write, and the development check of
 * the server's attributes.
 */
import { warn } from '../warn';
import { isHandlerKey } from './consumer';

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
 * attributes from different inputs, which the post-hydration diff would not see.
 */
export function checkHydratedAttributes(el: Element, ...expected: Record<string, unknown>[]) {
  const rendered = new Set<string>();
  for (const attributes of expected) {
    for (const key of Object.keys(attributes)) {
      const value = attributes[key];
      if (value != null && value !== false) {
        rendered.add(key.toLowerCase());
      }
    }
  }
  const server = el.getAttributeNames().filter((name) => name !== '_hk' && name !== 'data-hk');
  const extra = server.filter((name) => !rendered.has(name));
  const missing = [...rendered].filter((name) => !el.hasAttribute(name));
  if (extra.length > 0 || missing.length > 0) {
    warn(
      `The server rendered <${el.localName}> with attributes the hydrating client did not compute (server only: ${extra.join(', ') || 'none'}; client only: ${missing.join(', ') || 'none'}).`,
      'Hydration keeps the server markup and corrects only what changes after it, so these stay wrong.',
      'Render the part from the same props and state on the server and the client.',
    );
  }
}
