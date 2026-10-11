import { createSignal } from 'solid-js';
import { Show } from 'solid-js';
import { useInitialLiveRegionTextMutation } from '../../combobox/utils/useInitialLiveRegionTextMutation';
import { createLayoutEffect } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';

/**
 * Announces that the query matched nothing. Hidden until items have registered, so it is absent
 * from server HTML and does not flash on open.
 */
export function FilterDropdownEmpty(componentProps: FilterDropdownEmpty.Props) {
  const { store } = useFilterDropdownItemContext();
  const isEmpty = store.useState('isEmpty');

  const [ready, setReady] = createSignal(false, { ownedWrite: true });
  createLayoutEffect(
    () => true,
    () => {
      // After the first read, so server HTML and the first client paint omit the message.
      queueMicrotask(() => setReady(true));
    },
  );

  return (
    <Show when={ready() && isEmpty()}>
      <EmptyMessage {...componentProps} />
    </Show>
  );
}

function EmptyMessage(componentProps: FilterDropdownEmpty.Props) {
  const emptyRef = useInitialLiveRegionTextMutation<HTMLDivElement>();

  const element = useRenderElement('div', componentProps, {
    ref: [emptyRef],
    props: [
      {
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': 'true',
      },
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
