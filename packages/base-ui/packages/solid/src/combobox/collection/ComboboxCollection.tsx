/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createMemo, For } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useComboboxDerivedItemsContext } from '../root/ComboboxRootContext';
import { useGroupCollectionContext } from './GroupCollectionContext';

/**
 * Renders filtered list items.
 * Doesn't render its own HTML element.
 *
 * If rendering a flat list, pass a function child to the `List` component instead, which implicitly wraps it.
 */
export function ComboboxCollection(props: ComboboxCollection.Props) {
  const { filteredItems } = useComboboxDerivedItemsContext();
  const groupContext = useGroupCollectionContext();

  const itemsToRender = createMemo(() => (groupContext ? groupContext.items() : filteredItems()));

  // Solid: `For` keys rows by item, so a new filtered array keeps the still-matching items
  // mounted, as React reconciles `itemsToRender.map(children)` by key.
  return <For each={itemsToRender()}>{props.children}</For>;
}

export interface ComboboxCollectionProps {
  children: (item: any, index: Accessor<number>) => JSX.Element;
}

export namespace ComboboxCollection {
  export type Props = ComboboxCollectionProps;
}
