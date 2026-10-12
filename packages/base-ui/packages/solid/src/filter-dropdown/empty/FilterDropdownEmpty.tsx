import { createEffect, createMemo, createSignal } from 'solid-js';
import { useInitialLiveRegionTextMutation } from '../../internals/useInitialLiveRegionTextMutation';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';

/**
 * @internal
 */
export function FilterDropdownEmpty(componentProps: FilterDropdownEmpty.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);
  const { store } = useFilterDropdownItemContext();
  const isEmpty = store.useState('isEmpty');

  // Items mounting in the same pass register in their own effects, after this first read, and
  // don't register on the server at all. Deciding once they have keeps the children from
  // mounting for a frame on every open, and the message out of server markup.
  // A user effect runs after the render effects items register in, as React applies the state
  // update after the commit's layout effects.
  const [ready, setReady] = createSignal(false, { ownedWrite: true });
  createEffect(
    () => true,
    () => {
      setReady(true);
    },
  );

  const visible = createMemo(() => ready() && isEmpty());

  const emptyRef = useInitialLiveRegionTextMutation<HTMLDivElement>(visible);

  const element = useRenderElement('div', componentProps, {
    enabled: visible,
    ref: [emptyRef],
    props: [
      {
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': 'true',
      },
      elementProps,
    ],
  });

  return <>{element()}</>;
}

export interface FilterDropdownEmptyState {}

export interface FilterDropdownEmptyProps extends BaseUIComponentProps<
  'div',
  FilterDropdownEmptyState
> {}

export namespace FilterDropdownEmpty {
  export type Props = FilterDropdownEmptyProps;
  export type State = FilterDropdownEmptyState;
}
