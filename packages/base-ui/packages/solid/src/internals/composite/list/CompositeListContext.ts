import { createContext, useContext } from 'solid-js';

export interface CompositeListRegistration<Metadata> {
  metadata: Metadata | null;
  index: number | null;
  label: string | null | undefined;
  /**
   * Reads the item's text element. The list calls it when it builds labels, as React reads its
   * `textRef` object at flush: the text element (an ItemText part's ref) can attach after the
   * item registered.
   */
  textRef: (() => HTMLElement | null | undefined) | undefined;
}

/**
 * Where the list delivers an item's index: `current` is the index the item holds, and `set` is
 * called only when a flush gives it another one.
 */
export interface CompositeListIndexSink {
  current: number;
  set: (index: number) => void;
}

export interface CompositeListContextValue<Metadata> {
  /**
   * Solid: `owner` identifies the registering item. Nested items that share one DOM node keep the
   * outer (first-attached) registration; React gets the same result from ref attachment order.
   * Solid: `sink` receives the item's index when a flush changes it (React re-renders each item
   * from its map subscription).
   */
  register: (
    node: Element,
    registration: CompositeListRegistration<Metadata>,
    owner: object,
    sink?: CompositeListIndexSink,
  ) => void;
  unregister: (node: Element, owner: object) => void;
  /** Called with the whole map after every flush that changed it (lists that filter their items). */
  subscribeMapChange: (fn: (map: Map<Element, Metadata>) => void) => () => void;
  nextIndexRef: { current: number };
}

export const CompositeListContext = createContext<CompositeListContextValue<any>>({
  register: () => {},
  unregister: () => {},
  subscribeMapChange: () => () => {},
  nextIndexRef: { current: 0 },
});

export function useCompositeListContext() {
  return useContext(CompositeListContext);
}
