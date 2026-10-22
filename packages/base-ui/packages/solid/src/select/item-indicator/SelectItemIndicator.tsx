import { getOwner } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../utils/types';
import { ItemIndicator } from '../../utils/ItemIndicator';
import { createNativeConditional } from '../../utils/native/conditional';
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

  // Mount the shared indicator only while selected or kept mounted, so an unselected item does
  // not pay for the transition hooks. A conditional branch the parent's insert tracks: no
  // condition or children memo (D32).
  return createNativeConditional(
    getOwner(),
    () => Boolean(componentProps.keepMounted) || selected(),
    () => <ItemIndicator {...componentProps} selected={selected()} />,
  ) as unknown as JSX.Element;
}

export interface SelectItemIndicatorState {
  selected: boolean;
  transitionStatus: TransitionStatus;
}

export interface SelectItemIndicatorProps extends BaseUIComponentProps<
  'span',
  SelectItemIndicator.State
> {
  children?: JSX.Element | undefined;
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   */
  keepMounted?: boolean | undefined;
}

export namespace SelectItemIndicator {
  export type State = SelectItemIndicatorState;
  export type Props = SelectItemIndicatorProps;
}
