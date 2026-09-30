/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createContext, useContext, type Accessor } from 'solid-js';
import type { MaybeAccessor } from '../../../solid-helpers';
import type { CompositeMetadata } from './CompositeList';

export interface CompositeListContextValue<Metadata> {
  register: (node: Element, metadata: MaybeAccessor<Metadata>) => void;
  unregister: (node: Element) => void;
  subscribeMapChange: (fn: (map: Map<Element, CompositeMetadata<Metadata> | null>) => void) => void;
  unsubscribeMapChange: (
    fn: (map: Map<Element, CompositeMetadata<Metadata> | null>) => void,
  ) => void;
  refs: {
    elements: Array<HTMLElement | null | undefined>;
    labels?: Array<string | null> | undefined;
  };
  nextIndex: Accessor<number>;
  setNextIndex: (nextIndex: number) => void;
}

export const CompositeListContext = createContext<CompositeListContextValue<any>>({
  nextIndex: () => 0,
  refs: {
    elements: [],
  },
  register: () => {},
  setNextIndex: () => {},
  subscribeMapChange: () => {
    return () => {};
  },
  unregister: () => {},
  unsubscribeMapChange: () => {
    return () => {};
  },
});

export function useCompositeListContext() {
  return useContext(CompositeListContext);
}
