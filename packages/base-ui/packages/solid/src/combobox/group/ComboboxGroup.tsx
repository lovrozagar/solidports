/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createSignal, Show } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { GroupCollectionProvider } from '../collection/GroupCollectionContext';
import { ComboboxGroupContext } from './ComboboxGroupContext';

/**
 * Groups related items with the corresponding label.
 * Renders a `<div>` element.
 */
export function ComboboxGroup(componentProps: ComboboxGroup.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['items']);

  const [labelId, setLabelId] = createSignal<string | undefined>();

  const contextValue = {
    items: () => local.items,
    labelId,
    setLabelId,
  };

  const element = useRenderElement('div', componentProps, {
    props: [
      {
        get 'aria-labelledby'() {
          return labelId();
        },
        role: 'group',
      },
      elementProps,
    ],
  });

  return (
    <Show
      keyed
      when={local.items}
      fallback={
        <ComboboxGroupContext value={contextValue}>
          {element()}
        </ComboboxGroupContext>
      }
    >
      {(items) => (
        <GroupCollectionProvider items={items}>
          <ComboboxGroupContext value={contextValue}>
            {element()}
          </ComboboxGroupContext>
        </GroupCollectionProvider>
      )}
    </Show>
  );
}

export interface ComboboxGroupState {}

export interface ComboboxGroupProps extends BaseUIComponentProps<'div', ComboboxGroup.State> {
  /**
   * Items to be rendered within this group.
   * When provided, child `Collection` components will use these items.
   */
  items?: readonly any[] | undefined;
}

export namespace ComboboxGroup {
  export type State = ComboboxGroupState;
  export type Props = ComboboxGroupProps;
}
