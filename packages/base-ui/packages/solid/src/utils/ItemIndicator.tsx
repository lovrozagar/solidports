import { Show } from 'solid-js';
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
