import { createSignal, untrack } from 'solid-js';
import { useFilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import type { FilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import { DETACHED_OWNER } from '../store';
import { access, createLayoutEffect, useRef } from '../../solid-helpers';
import type { MaybeAccessor } from '../../solid-helpers';

/**
 * Text of the rendered children, for when the element is filtered out and has no DOM node.
 * Solid: children resolve to strings, accessors and DOM nodes rather than element descriptions,
 * so a node reports the text it renders.
 */
function childrenText(children: unknown): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(childrenText).join('');
  }
  if (typeof children === 'function') {
    return childrenText((children as () => unknown)());
  }
  if (typeof Node !== 'undefined' && children instanceof Node) {
    return children.textContent ?? '';
  }
  // A `render` config object carries its element's children.
  if (children != null && typeof children === 'object' && 'children' in children) {
    return childrenText((children as { children?: unknown }).children);
  }
  return '';
}

export interface UseFilterDropdownItemParameters {
  /** A text representation of the item used for filtering. Falls back to the rendered text. */
  label?: MaybeAccessor<string | undefined> | undefined;
  /** Keeps the nearest group visible while this filtered-out item must remain mounted. */
  retainGroup?: MaybeAccessor<boolean | undefined> | undefined;
  /** The item's children, watched so a changed label re-registers against the active query. */
  children?: MaybeAccessor<unknown> | undefined;
  /** The item's `render` prop, watched like `children` since its element can carry the text. */
  render?: unknown;
  /**
   * The dropdown that owns this item, when it isn't the nearest one. Pass `null` for none.
   * Omit the property to use the nearest dropdown.
   */
  context?: FilterDropdownItemContext | null | undefined;
}

/**
 * Registers an item with the enclosing filter root and reports whether the query keeps it.
 *
 * The item renders once before it is registered so its rendered text can be read and cached: a
 * popup can open with a query that already excludes the item, and a hidden item has no text left
 * to match against.
 *
 * @internal
 */
export function useFilterDropdownItem(params: UseFilterDropdownItemParameters) {
  const nearestContext = useFilterDropdownItemContext(true);
  const groupContext = useFilterDropdownGroupContext();

  if (!('context' in params) && nearestContext == null) {
    throw new Error(
      'Base UI: Filter parts are missing their filter context and cannot access the query or items. Wrap the component root in its filter provider.',
    );
  }

  const owner = 'context' in params ? params.context : nearestContext;
  const { registerItem, store } = owner ?? DETACHED_OWNER;
  const registerGroupItem = groupContext?.registerItem;

  const itemId = Symbol('filter-dropdown-item');
  const ref = useRef<HTMLElement | null>(null);
  let registeredText: string | undefined;

  const matched = store.useState('isItemVisible', itemId);

  // An initial item is visible before registration (`visibleItemIds` is null), so start
  // registered and skip the mount update. A late item under an active filter starts
  // unregistered and renders once so its text can be captured.
  const [registered, setRegistered] = createSignal(untrack(matched), { ownedWrite: true });

  // Solid: the item resolves its children once and renders those nodes, so their text is what the
  // item renders, and reading them while it is filtered out creates nothing.
  const childrenTextNow = () => {
    const children = access(params.children);
    if (children != null) {
      return childrenText(children);
    }
    // A render function is opaque: only a render element (config object) carries text.
    const render = params.render;
    return typeof render === 'function' ? '' : childrenText(render);
  };

  // What the item renders now: its element while it is in the document, else its children. A
  // descendant can change its text without the item updating, so this is read when filtering.
  const currentText = () => {
    const label = untrack(() => access(params.label));
    if (label != null) {
      return label;
    }
    const element = ref.current;
    if (element?.isConnected) {
      return element.textContent || '';
    }
    return untrack(childrenTextNow);
  };

  const register = () =>
    registerItem(itemId, {
      getText() {
        registeredText = currentText();
        return registeredText;
      },
    });

  createLayoutEffect(
    () => access(params.label),
    () => {
      const unregister = register();
      setRegistered(true);
      return unregister;
    },
  );

  createLayoutEffect(
    () => Boolean(access(params.retainGroup)),
    (retainGroup) => registerGroupItem?.(itemId, retainGroup),
  );

  // Re-register when the children's text changes, so the active query runs again, as React's
  // effect does when the item's children change.
  createLayoutEffect(childrenTextNow, (text) => {
    if (
      registeredText !== undefined &&
      text !== registeredText &&
      untrack(() => access(params.label)) == null
    ) {
      registeredText = text;
      register();
    }
  });

  return {
    visible: () => !registered() || matched(),
    ref,
  };
}
