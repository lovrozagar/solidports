/*
 * Parity harness for composed native parts (plan 8 step 3.2): the same tree rendered through the
 * native fast paths and through the slow path (every part given a reactive `render`), compared
 * as normalized DOM (attributes sorted, generated `base-ui-*` ids renumbered by first appearance,
 * hydration keys ignored) after mount and after each interaction.
 */
import { flush } from 'solid-js';
import { createComponent } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { expect } from 'vitest';
import { renderPathOf } from '../src/utils/renderPath';

/** The subtree as a string with sorted attributes and normalized generated ids. */
export function normalizeTree(root: Element): string {
  const ids = new Map<string, string>();
  const normalizeValue = (value: string) =>
    value.replace(/base-ui-[0-9A-Za-z:-]+/g, (id) => {
      if (!ids.has(id)) {
        ids.set(id, `base-ui-#${ids.size}`);
      }
      return ids.get(id)!;
    });
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const attributes = Array.from(el.attributes)
      .filter((attribute) => attribute.name !== '_hk')
      .map((attribute) => `${attribute.name}="${normalizeValue(attribute.value)}"`)
      .sort()
      .join(' ');
    const children = Array.from(el.childNodes).map(walk).join('');
    return `<${tag}${attributes ? ` ${attributes}` : ''}>${children}</${tag}>`;
  };
  return Array.from(root.childNodes).map(walk).join('');
}

export interface ParityPair {
  fast: HTMLElement;
  slow: HTMLElement;
  /** Asserts both trees are identical now. */
  same: () => void;
  /** Runs `action` on each tree (after a flush) and asserts both trees are identical. */
  both: (action: (root: HTMLElement) => void) => void;
  /**
   * As `both`, draining microtasks after each tree's action: both trees share one document, so a
   * deferred `focus()` (composite navigation) must settle per tree before the other tree acts.
   */
  bothAsync: (action: (root: HTMLElement) => void) => Promise<void>;
  unmount: () => void;
}

/**
 * Renders `make(slow)` twice: `make(false)` with the native paths, `make(true)` with every part
 * forced onto the slow path, in separate containers.
 */
/** The test renderer's `render` (`createRenderer().render`), structurally: this helper is not a test file. */
export type ParityRender = (ui: () => JSX.Element) => {
  container: HTMLElement;
  unmount: () => void;
};

export function mountParity(
  render: ParityRender,
  make: (slow: boolean) => JSX.Element,
): ParityPair {
  const fastResult = render(() => make(false));
  const slowResult = render(() => make(true));
  const fast = fastResult.container;
  const slow = slowResult.container;
  // Each tree took the path it stands for: a forcing that stops forcing (a reactive `render` that
  // a part learned to render natively) would compare the native path with itself.
  const paths = (root: HTMLElement) =>
    [...root.querySelectorAll('*')].map((el) => renderPathOf(el)).filter(Boolean);
  expect(paths(slow), 'the slow tree rendered an element natively').not.toContain('native');
  expect(paths(fast), 'the fast tree rendered nothing natively').toContain('native');
  const same = () => expect(normalizeTree(fast)).toBe(normalizeTree(slow));
  return {
    fast,
    slow,
    same,
    both(action) {
      action(fast);
      flush();
      action(slow);
      flush();
      same();
    },
    async bothAsync(action) {
      for (const root of [fast, slow]) {
        action(root);
        flush();
        // eslint-disable-next-line no-await-in-loop -- each tick flushes before the next one
        await Promise.resolve();
        flush();
      }
      same();
    },
    unmount() {
      fastResult.unmount();
      slowResult.unmount();
    },
  };
}

/**
 * Creates `Component` with `props` (own-property getters kept). On the slow path `ref` and
 * `render` become getters: a reactive `ref` always takes `useRenderElement`, and a reactive
 * `render` does too in every part that does not render it natively (the disclosure parts do since
 * plan 3 leaf 5.1.2b). The `render` getter returns `props.render` when the case passes one, else
 * the part's own tag; the `ref` getter returns the case's ref. A JSX spread would hand the part a
 * proxy and disable its fast path, so the props object is built by hand.
 */
export function part<P extends object>(
  Component: (props: P) => JSX.Element,
  slow: boolean,
  tag: string,
  props: P,
): JSX.Element {
  const merged = Object.defineProperties({}, Object.getOwnPropertyDescriptors(props)) as P;
  if (slow) {
    const render = 'render' in merged ? (merged as { render: unknown }).render : tag;
    Object.defineProperty(merged, 'render', {
      get: () => render,
      enumerable: true,
      configurable: true,
    });
    const ref = (merged as { ref?: unknown }).ref;
    Object.defineProperty(merged, 'ref', {
      get: () => ref,
      enumerable: true,
      configurable: true,
    });
  }
  return createComponent(Component, merged);
}
