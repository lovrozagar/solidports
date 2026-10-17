import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { provideContext } from '../../solid-helpers';

interface GroupCollectionContext {
  items: Accessor<readonly any[]>;
}

const GroupCollectionContext = createContext<GroupCollectionContext | null>(null);

export function useGroupCollectionContext() {
  return useContext(GroupCollectionContext);
}

export function GroupCollectionProvider(props: GroupCollectionProvider.Props) {
  const contextValue = {
    items: () => props.items,
  };

  return provideContext(GroupCollectionContext, contextValue, () => <>{props.children}</>);
}

namespace GroupCollectionProvider {
  export interface Props {
    children: JSX.Element;
    items: readonly any[];
  }
}
