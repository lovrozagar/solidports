/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createEffect, createMemo, Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { stopEvent } from '../../floating-ui-solid/utils';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { withCaptureListeners } from '../../utils/withCaptureListeners';
import { ComboboxCollection } from '../collection/ComboboxCollection';
import { clickHighlightedItem } from '../utils/parts';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import {
  useComboboxDerivedItemsContext,
  useComboboxFloatingContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';

/**
 * A list container for the items.
 * Renders a `<div>` element.
 */
export function ComboboxList(componentProps: ComboboxList.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['children', 'id']);

  const store = useComboboxRootContext();
  const floatingRootContext = useComboboxFloatingContext();
  const hasPositionerContext = Boolean(useComboboxPositionerContext(true));
  const { filteredItems, hasItems } = useComboboxDerivedItemsContext();

  const selectionMode = store.useState('selectionMode');
  const grid = store.useState('grid');
  const readOnly = store.useState('readOnly');
  const listProps = store.useState('listProps');
  const virtualized = store.useState('virtualized');
  const forceMounted = store.useState('forceMounted');

  const multiple = () => selectionMode() === 'multiple';
  const empty = () => filteredItems().length === 0;

  const setPositionerElement = (element: HTMLElement | null | undefined) => {
    store.set('positionerElement', element);
  };

  const setListElement = (element: HTMLElement | null | undefined) => {
    store.set('listElement', element);
  };

  type ItemRenderFunction = (item: any, index: Accessor<number>) => JSX.Element;

  const state: ComboboxList.State = {
    get empty() {
      return empty();
    },
  };

  const floatingId = floatingRootContext.useState('floatingId');
  // Solid: the element's `id` attribute is not reactive, so the list publishes it for the
  // `aria-controls` of the combobox element (see `State.listId`).
  const listId = () => local.id ?? floatingId();

  createEffect(listId, (id) => {
    store.set('listId', id);
  });

  // Solid: the element (and its children) are created inside `CompositeList`, so the items they
  // instantiate register with it.
  function ListElement() {
    // Support "closed template" API: if children is a function, implicitly wrap it
    // with a Combobox.Collection that reads items from context/root.
    // Ensures this component's `listProps` subscription does not cause <Combobox.Item>
    // to re-render on every active index change.
    // Solid: children are resolved once per change of the prop, as React's `useMemo([children])`;
    // reading a JSX `children` getter instantiates its elements.
    const resolvedChildren = createMemo(() => {
      const children = local.children as unknown;
      // A render function with parameters (not an accessor) is the closed-template API.
      if (typeof children === 'function' && children.length > 0) {
        return <ComboboxCollection>{children as ItemRenderFunction}</ComboboxCollection>;
      }
      return children as JSX.Element;
    });

    const element = useRenderElement('div', componentProps, {
      state,
      ref: (el) => {
        setListElement(el);
        if (!hasPositionerContext) {
          setPositionerElement(el);
        }
      },
      get children() {
        return resolvedChildren();
      },
      get props() {
        return [
          listProps(),
          {
            tabindex: -1,
            id: listId(),
            role: (grid() ? 'grid' : 'listbox') as 'grid' | 'listbox',
            'aria-multiselectable': multiple() ? ('true' as const) : undefined,
            // On a grid the attribute describes cell editability, not selection, so it's left to the
            // combobox element in that mode.
            'aria-readonly': !grid() && readOnly() ? ('true' as const) : undefined,
            // Solid: capture-phase listeners have no JSX prop form.
            ref: withCaptureListeners({
              keydown: () => {
                store.context.keyboardActiveRef.current = true;
              },
              pointermove: () => {
                store.context.keyboardActiveRef.current = false;
              },
            }),
            onKeyDown(event: KeyboardEvent) {
              if (store.state.disabled || store.state.readOnly) {
                return;
              }

              if (event.key === 'Enter') {
                const activeIndex = store.state.activeIndex;

                if (activeIndex == null) {
                  // Allow form submission when no item is highlighted.
                  return;
                }

                stopEvent(event);
                clickHighlightedItem(store, activeIndex, event);
              }
            },
          },
          elementProps,
        ];
      },
    });

    return element();
  }

  // With the `items` prop, typeahead labels are derived from the items so they survive the list
  // unmounting (unmounting clears the registered labels). Rendered labels only need to be
  // registered when the list is force-mounted to match browser autofill against rendered text.
  const labelsRef = () => (hasItems() && !forceMounted() ? undefined : store.context.labelsRef);

  return (
    <Show when={!virtualized()} fallback={<ListElement />}>
      <CompositeList
        refs={{
          elements: store.context.listRef.current,
          labels: labelsRef()?.current,
        }}
      >
        <ListElement />
      </CompositeList>
    </Show>
  );
}

export interface ComboboxListState {
  /**
   * Whether the list is empty.
   */
  empty: boolean;
}

export interface ComboboxListProps extends Omit<
  BaseUIComponentProps<'div', ComboboxList.State>,
  'children'
> {
  children?: JSX.Element | ((item: any, index: Accessor<number>) => JSX.Element);
}

export namespace ComboboxList {
  export type State = ComboboxListState;
  export type Props = ComboboxListProps;
}
