import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { LazyTransitionHandle } from './createLazyTransitionStatus';
import { compileStateWriter } from './native/element';
import type { NativeItemIndicatorKind } from './native/itemIndicator';
import { splitComponentProps } from '../solid-helpers';
import { transitionStatusMapping } from './stateAttributesMapping';
import type { BaseUIComponentProps } from './types';
import { useOpenChangeComplete } from './useOpenChangeComplete';
import { useRenderElement } from './useRenderElement';
import { useTransitionStatus } from './useTransitionStatus';
import type { TransitionStatus } from './useTransitionStatus';

/**
 * Shared selected-item indicator. Public wrappers mount it only when the item is selected or
 * kept mounted, so unselected items do not pay for the transition hooks.
 */
export function ItemIndicator(componentProps: ItemIndicator.Props) {
  const keepMounted = () => componentProps.keepMounted ?? false;
  const selected = () => componentProps.selected;
  const shouldRender = () => keepMounted() || selected();

  return (
    <Show when={shouldRender()}>
      <Inner {...componentProps} />
    </Show>
  );
}

function Inner(componentProps: ItemIndicator.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, ['keepMounted', 'selected']);
  const selected = () => componentProps.selected;

  let indicatorRef = null as HTMLSpanElement | null | undefined;

  const { transitionStatus, setMounted } = useTransitionStatus(selected);

  const state: ItemIndicator.State = {
    get selected() {
      return selected();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const element = useRenderElement('span', componentProps, {
    props: [
      {
        'aria-hidden': 'true',
        children: '✔️',
      },
      elementProps,
    ],
    ref: (el) => {
      indicatorRef = el;
    },
    state,
    stateAttributesMapping: transitionStatusMapping,
  });

  useOpenChangeComplete({
    batch: true,
    enabled: () => !selected(),
    onComplete() {
      if (!selected()) {
        setMounted(false);
      }
    },
    open: selected,
    ref: () => indicatorRef,
  });

  return element();
}

/** What a selected-item indicator reads from its item's context. */
export interface SelectedItemSource {
  selected: Accessor<boolean>;
}

/** The native indicator's state: prototype getters over its item and its transition. */
class SelectedItemIndicatorState {
  declare private readonly item: SelectedItemSource;
  declare private readonly transition: LazyTransitionHandle;

  constructor(item: SelectedItemSource, transition: LazyTransitionHandle) {
    this.item = item;
    this.transition = transition;
  }

  get selected() {
    return this.item.selected();
  }

  get transitionStatus(): TransitionStatus {
    return this.transition.transitionStatus();
  }
}

const DEFAULT_CHILDREN = () => '✔️';

/**
 * Select's and Combobox's indicator on the native path (`utils/native/itemIndicator.tsx`, D32's
 * sweep): mounted while its item is selected or `keepMounted`, as upstream's wrappers gate it.
 */
export const SELECTED_ITEM_INDICATOR_KIND = Object.freeze<
  NativeItemIndicatorKind<SelectedItemSource>
>({
  shown: (item) => item.selected,
  keepsExit: false,
  State: SelectedItemIndicatorState,
  writeState: compileStateWriter(['selected', 'transitionStatus'], transitionStatusMapping),
  children: DEFAULT_CHILDREN,
});

export interface ItemIndicatorProps extends BaseUIComponentProps<'span', ItemIndicator.State> {
  keepMounted?: boolean | undefined;
  selected: boolean;
}

export interface ItemIndicatorState {
  selected: boolean;
  transitionStatus: TransitionStatus;
}

export namespace ItemIndicator {
  export type Props = ItemIndicatorProps;
  export type State = ItemIndicatorState;
}
