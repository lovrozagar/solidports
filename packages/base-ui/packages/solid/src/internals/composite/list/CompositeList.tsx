/* eslint-disable no-bitwise */
import { createEffect, createRenderEffect, createSignal, onCleanup, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { CompositeListContext, type CompositeListRegistration } from './CompositeListContext';

export type CompositeMetadata<CustomMetadata> = {
  index?: (number | null) | undefined;
} & CustomMetadata;

interface CompositeListItem<Metadata> {
  index: number;
  element: HTMLElement;
  registration: CompositeListRegistration<Metadata>;
}

interface OwnedRegistration<Metadata> {
  owner: object;
  registration: CompositeListRegistration<Metadata>;
}

/**
 * Provides context for a list of items in a composite component.
 * @internal
 */
export function CompositeList<Metadata>(props: CompositeList.Props<Metadata>) {
  // Solid: one entry per node, ordered by attachment. The first registration owns the node and
  // later ones take over when it unregisters.
  const map = new Map<Element, OwnedRegistration<Metadata>[]>();
  const listeners = new Set<Function>();
  const nextIndexRef = { current: 0 };
  let isDirty = true;
  let items: readonly CompositeListItem<Metadata>[] | null = null;
  let mutationObserver: MutationObserver | null = null;

  // Item registrations can change without the list re-rendering. Schedule one flush for the
  // whole batch so refs are rebuilt before consumers read them. Registrations removed from an
  // unmount cleanup write it while Solid disposes the subtree.
  const [mapTick, setMapTick] = createSignal(false, { ownedWrite: true });

  function scheduleMapUpdate() {
    if (isDirty) {
      return;
    }

    isDirty = true;
    setMapTick((tick) => !tick);
  }

  function register(
    node: Element,
    registration: CompositeListRegistration<Metadata>,
    owner: object,
  ) {
    const entries = map.get(node);
    if (!entries) {
      map.set(node, [{ owner, registration }]);
    } else {
      const entry = entries.find((candidate) => candidate.owner === owner);
      if (entry) {
        entry.registration = registration;
      } else {
        entries.push({ owner, registration });
      }
    }
    scheduleMapUpdate();
  }

  function unregister(node: Element, owner: object) {
    const entries = map.get(node);
    if (!entries) {
      return;
    }

    const nextEntries = entries.filter((entry) => entry.owner !== owner);
    if (nextEntries.length === 0) {
      map.delete(node);
    } else {
      map.set(node, nextEntries);
    }
    scheduleMapUpdate();
  }

  function syncRefs(nextItems: readonly CompositeListItem<Metadata>[]) {
    const nextMap = new Map<Element, CompositeMetadata<Metadata>>();
    const elements = props.refs.elements;
    const labels = props.refs.labels;

    elements.length = 0;
    if (labels) {
      labels.length = 0;
    }

    nextItems.forEach((item) => {
      nextMap.set(item.element, {
        ...(item.registration.metadata ?? ({} as Metadata)),
        index: item.index,
      });

      elements[item.index] = item.element;

      if (labels) {
        labels[item.index] =
          item.registration.label !== undefined
            ? item.registration.label
            : (item.registration.textRef?.textContent ?? item.element.textContent);
      }
    });

    nextIndexRef.current = elements.length;

    return nextMap;
  }

  function observe(sortedNodes: HTMLElement[]) {
    mutationObserver?.disconnect();
    mutationObserver = null;

    // A single item can't reorder.
    if (typeof MutationObserver !== 'function' || sortedNodes.length < 2) {
      return;
    }

    const observer = new MutationObserver((entries) => {
      // Only verify the order after a move: a node that was removed and later
      // re-added within the same batch. Additions and removals alone can't
      // change the relative order of the remaining items, and items that mount
      // or unmount re-sort through `register`/`unregister`.
      if (!hasMovedNode(entries)) {
        return;
      }

      let previousConnectedNode: Element | null = null;

      // If any connected node now appears before the previous connected node,
      // wrappers/items moved and the index map needs to be rebuilt.
      for (const node of sortedNodes) {
        if (!node.isConnected) {
          continue;
        }

        if (previousConnectedNode && sortByDocumentPosition(previousConnectedNode, node) > 0) {
          observer.disconnect();
          scheduleMapUpdate();
          return;
        }

        previousConnectedNode = node;
      }
    });

    mutationObserver = observer;

    // A reorder that changes item indexes must invert at least one adjacent pair
    // from the previous sorted order. Observing each pair's common parent catches
    // both direct item moves and ancestor wrapper moves at the boundary.
    const roots = new Set<Element>();
    for (let i = 1; i < sortedNodes.length; i += 1) {
      const root = getCommonAncestor(sortedNodes[i - 1], sortedNodes[i]);
      if (root) {
        roots.add(root);
      }
    }

    roots.forEach((root) => observer.observe(root, { childList: true }));
  }

  function flush() {
    const [nextItems, automaticNodes] = getCompositeListSnapshot(map);
    const nextMap = syncRefs(nextItems);

    const previousItems = items;
    const changed =
      !previousItems ||
      previousItems.length !== nextItems.length ||
      nextItems.some((item, index) => {
        const previousItem = previousItems[index];
        return (
          item.index !== previousItem.index ||
          item.element !== previousItem.element ||
          item.registration.index !== previousItem.registration.index ||
          item.registration.metadata !== previousItem.registration.metadata
        );
      });

    observe(automaticNodes);
    items = nextItems;
    isDirty = false;

    if (!changed) {
      return;
    }

    listeners.forEach((listener) => listener(nextMap));
    // Solid: consumers receive the sorted items as an array instead of a Map.
    props.onMapChange?.(Array.from(nextMap, ([element, metadata]) => ({ element, metadata })));
  }

  // Solid: a user effect runs after the items' refs registered them, as React's layout effect
  // runs after its children's refs attach.
  createEffect(mapTick, () => {
    if (isDirty) {
      untrack(flush);
    }
  });

  // Layout-effect timing, as React's `useIsoLayoutEffect` keyed on the ref objects.
  createRenderEffect(
    () => props.refs,
    (refs) => {
      // Re-copy the last committed snapshot when the ref objects change.
      if (!isDirty && items) {
        untrack(() => syncRefs(items!));
      }

      return () => {
        refs.elements = [];
        if (refs.labels) {
          refs.labels = [];
        }
      };
    },
  );

  onCleanup(() => {
    mutationObserver?.disconnect();
  });

  function subscribeMapChange(fn: Function) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }

  return (
    <CompositeListContext value={{ register, unregister, subscribeMapChange, nextIndexRef }}>
      {props.children}
    </CompositeListContext>
  );
}

function getCompositeListSnapshot<Metadata>(map: Map<Element, OwnedRegistration<Metadata>[]>) {
  const reservedIndices = new Set<number>();
  const items: CompositeListItem<Metadata>[] = [];
  const automaticItems: CompositeListItem<Metadata>[] = [];

  map.forEach((entries, node) => {
    if (!node.isConnected) {
      return;
    }

    const registration = entries[0].registration;
    const index = registration.index;
    const item = {
      index: index ?? -1,
      element: node as HTMLElement,
      registration,
    };

    if (index === null) {
      automaticItems.push(item);
    } else if (index >= 0) {
      reservedIndices.add(index);
      items.push(item);
    }
  });

  let nextAutomaticIndex = 0;
  automaticItems.sort((a, b) => sortByDocumentPosition(a.element, b.element));

  automaticItems.forEach((item) => {
    while (reservedIndices.has(nextAutomaticIndex)) {
      nextAutomaticIndex += 1;
    }

    item.index = nextAutomaticIndex;
    items.push(item);
    nextAutomaticIndex += 1;
  });

  if (reservedIndices.size > 0) {
    items.sort((a, b) => a.index - b.index);
  }

  return [items, automaticItems.map((item) => item.element)] as const;
}

function getCommonAncestor(firstNode: Element, lastNode: Element) {
  let ancestor = firstNode.parentElement;

  // The `parentElement` walk cannot cross shadow boundaries, so the native
  // `contains` is sufficient here.
  while (ancestor && !ancestor.contains(lastNode)) {
    ancestor = ancestor.parentElement;
  }

  return ancestor;
}

function hasMovedNode(entries: MutationRecord[]) {
  for (const entry of entries) {
    for (let i = 0; i < entry.removedNodes.length; i += 1) {
      if (entry.removedNodes[i].isConnected) {
        return true;
      }
    }
  }

  return false;
}

function sortByDocumentPosition(a: Element, b: Element) {
  // `DOCUMENT_POSITION_CONTAINED_BY` is always reported alongside `FOLLOWING`, and `CONTAINS`
  // alongside `PRECEDING`, so testing `FOLLOWING` alone orders siblings and nested items alike.
  return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

export interface CompositeListProps<Metadata> {
  children: JSX.Element;
  /**
   * Solid: the element and label lists, filled in place (React's `elementsRef`/`labelsRef`).
   */
  refs: {
    /**
     * A ref to the list of HTML elements, ordered by their index.
     * Explicit indexes can leave empty slots in the array.
     * `useListNavigation`'s `listRef` prop.
     */
    elements: Array<HTMLElement | null | undefined>;
    /**
     * A ref to the list of element labels, ordered by their index.
     * `useTypeahead`'s `listRef` prop.
     */
    labels?: Array<string | null> | undefined;
  };
  onMapChange?:
    | ((newMap: Array<{ element: Element; metadata: CompositeMetadata<Metadata> | null }>) => void)
    | undefined;
}

export namespace CompositeList {
  export type Props<Metadata> = CompositeListProps<Metadata>;
}
