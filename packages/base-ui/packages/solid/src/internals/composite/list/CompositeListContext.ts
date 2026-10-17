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

export interface CompositeListContextValue<Metadata> {
  /**
   * Solid: `owner` identifies the registering item. Nested items that share one DOM node keep the
   * outer (first-attached) registration; React gets the same result from ref attachment order.
   */
  register: (
    node: Element,
    registration: CompositeListRegistration<Metadata>,
    owner: object,
  ) => void;
  unregister: (node: Element, owner: object) => void;
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
