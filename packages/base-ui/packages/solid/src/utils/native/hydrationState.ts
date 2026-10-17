/*
 * A native element's hydration state (`renderClientElement`), created only for an element created
 * while hydrating: the first write, which stands for the server's markup, the one reconcile after
 * `hydrate()` returns, and the development check of the server's attributes. Its own module so a
 * test can count its constructions (a client render creates none).
 */
import { untrack } from 'solid-js';
import { assign } from '@solidjs/web';
import { warn } from '../warn';
import { isHandlerKey } from './consumer';

/** The element's attribute writer (`createClientWriter`'s `write`). */
type Write = (into: Record<string, unknown>, keepUndefined: boolean) => Record<string, unknown>;

let pendingReconciles: Array<[Element, () => void]> | undefined;

/**
 * Runs `reconcile` once the current `hydrate()` call has returned (a microtask), in one shared
 * microtask for every element that needs it. An element disconnected by then (its part was
 * disposed) is skipped.
 */
function afterHydration(el: Element, reconcile: () => void): void {
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
function attributesOf(written: Record<string, unknown>): Record<string, unknown> {
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
function checkHydratedAttributes(el: Element, ...expected: Record<string, unknown>[]) {
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

/**
 * A hydrating element's reconcile state (see `renderClientElement`): its first write, which stands
 * for the server's markup, and the one reconcile after `hydrate()` returns when its effect applied
 * again while hydrating. Solid: the members are prototype methods, so the state is one object.
 */
export class HydrationState {
  declare firstWrite: Record<string, unknown> | undefined;
  declare private scheduled: boolean;
  declare private readonly el: Element;
  declare private readonly templateAttributes: Record<string, unknown>;
  declare private readonly literal: Record<string, unknown>;
  declare private readonly write: Write;
  declare private readonly needsEffect: boolean;
  declare private readonly previous: Record<string, unknown>;

  constructor(
    el: Element,
    templateAttributes: Record<string, unknown>,
    literal: Record<string, unknown>,
    write: Write,
    needsEffect: boolean,
    previous: Record<string, unknown>,
  ) {
    this.firstWrite = undefined;
    this.scheduled = false;
    this.el = el;
    this.templateAttributes = templateAttributes;
    this.literal = literal;
    this.write = write;
    this.needsEffect = needsEffect;
    this.previous = previous;
  }

  takeFirstWrite(written: Record<string, unknown>) {
    this.firstWrite = written;
    if (process.env.NODE_ENV !== 'production') {
      // Now, while the element still holds the server markup.
      checkHydratedAttributes(this.el, this.templateAttributes, {
        ...attributesOf(this.literal),
        ...attributesOf(written),
      });
    }
  }

  scheduleReconcile() {
    if (!this.scheduled) {
      this.scheduled = true;
      afterHydration(this.el, () => this.reconcile());
    }
  }

  private reconcile() {
    const written = this.needsEffect ? attributesOf(untrack(() => this.write({}, true))) : {};
    const hydratedWrite = { ...attributesOf(this.literal), ...attributesOf(this.firstWrite ?? {}) };
    assign(this.el, { ...attributesOf(this.literal), ...written }, true, hydratedWrite, true);
    Object.assign(this.previous, written);
  }
}
