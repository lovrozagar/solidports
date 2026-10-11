import { createMemo, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../utils/types';
import { ItemIndicator } from '../../utils/ItemIndicator';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { useSelectItemContext } from '../item/SelectItemContext';

/**
 * Indicates whether the select item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemIndicator(componentProps: SelectItemIndicator.Props) {
  const { selected } = useSelectItemContext();
  const rendered = createMemo(() => Boolean(componentProps.keepMounted) || selected());

  // Mount the shared indicator only while selected or kept mounted, so an unselected item does
  // not pay for the transition hooks.
  return (
    <Show when={rendered()}>
      <ItemIndicator {...componentProps} selected={selected()} />
    </Show>
  );
}

export interface SelectItemIndicatorState {
  selected: boolean;
  transitionStatus: TransitionStatus;
}

export interface SelectItemIndicatorProps extends BaseUIComponentProps<
  'span',
  SelectItemIndicator.State
> {
  children?: JSX.Element;
  /** Whether to keep the HTML element in the DOM when the item is not selected. */
  keepMounted?: boolean | undefined;
}

export namespace SelectItemIndicator {
  export type State = SelectItemIndicatorState;
  export type Props = SelectItemIndicatorProps;
}
