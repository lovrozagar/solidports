/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createContext, useContext, type Accessor, type JSX } from 'solid-js';

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

  return (
    <GroupCollectionContext.Provider value={contextValue}>
      {props.children}
    </GroupCollectionContext.Provider>
  );
}

namespace GroupCollectionProvider {
  export interface Props {
    children: JSX.Element;
    items: readonly any[];
  }
}
