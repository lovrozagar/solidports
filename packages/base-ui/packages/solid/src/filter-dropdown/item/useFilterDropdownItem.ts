import { createSignal, untrack } from 'solid-js';
import { useFilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import {
  useFilterDropdownItemContext,
  type FilterDropdownItemContext,
} from '../root/FilterDropdownRootContext';
import { DETACHED_OWNER } from '../store';
import { access, createLayoutEffect, useRef, type MaybeAccessor } from '../../solid-helpers';

/** Text of the rendered children, for when the element is filtered out and has no DOM node. */
function childrenText(children: unknown): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(childrenText).join('');
  }
  if (children != null && typeof children === 'object' && 'children' in children) {
    return childrenText((children as { children?: unknown }).children);
  }
  return '';
}

export interface UseFilterDropdownItemParameters {
  /** A text representation of the item used for filtering. Falls back to the rendered text. */
  label?: MaybeAccessor<string | undefined>;
  /** Keeps the nearest group visible while this filtered-out item must remain mounted. */
  retainGroup?: MaybeAccessor<boolean | undefined>;
  /** The item's children, watched so a changed label re-registers against the active query. */
  children?: MaybeAccessor<unknown>;
  /** The item's `render` prop, watched like `children` since its element can carry the text. */
  render?: MaybeAccessor<unknown>;
  /**
   * The dropdown that owns this item, when it isn't the nearest one. Pass `null` for none.
   * Omit the property to use the nearest dropdown.
   */
  context?: FilterDropdownItemContext | null;
}

/**
 * Registers an item with the enclosing filter root and reports whether the query keeps it.
 *
 * The item renders once before it is registered so its rendered text can be read and cached.
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
  let previousChildrenText: string | undefined;

  const matched = store.useState('isItemVisible', itemId);

  // An initial item is visible before registration (`visibleItemIds` is null), so start
  // registered and skip the mount update. A late item under an active filter starts
  // unregistered and renders once so its DOM text can be captured.
  const [registered, setRegistered] = createSignal(untrack(matched), { ownedWrite: true });

  const resolveText = () => {
    const label = untrack(() => access(params.label));
    if (label != null) {
      return label;
    }
    const fromChildren = childrenText(
      untrack(() => access(params.children) ?? access(params.render)),
    );
    const previous = previousChildrenText;
    previousChildrenText = fromChildren;
    if (ref.current !== null) {
      return ref.current.textContent || '';
    }
    if (registeredText !== undefined && fromChildren === previous) {
      return registeredText;
    }
    return fromChildren;
  };

  const register = (resolvedText?: string) => {
    const text = resolvedText ?? resolveText();
    if (text) {
      registeredText = text;
    }
    return registerItem(itemId, {
      getText() {
        const label = untrack(() => access(params.label));
        if (label == null && ref.current) {
          registeredText = ref.current.textContent || '';
        }
        return registeredText;
      },
    });
  };

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

  // Re-register when the item's text changes, so the active query runs again.
  createLayoutEffect(
    () => ({
      label: access(params.label),
      children: access(params.children),
      render: access(params.render),
    }),
    () => {
      const text = resolveText();
      if (text !== registeredText) {
        registeredText = text;
        register(text);
      }
    },
  );

  return {
    visible: () => !registered() || matched(),
    ref,
  };
}
