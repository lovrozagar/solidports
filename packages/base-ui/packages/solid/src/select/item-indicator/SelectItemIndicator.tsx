import { getOwner } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../utils/types';
import { ItemIndicator, SELECTED_ITEM_INDICATOR_KIND } from '../../utils/ItemIndicator';
import { canRenderNative } from '../../utils/native';
import { renderNativeItemIndicator } from '../../utils/native/itemIndicator';
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
  const item = useSelectItemContext();
  // Native fast path (`context/architecture/render-pipeline.md`): the shared item indicator
  // (`utils/native/itemIndicator.tsx`, D32's sweep).
  if (canRenderNative(componentProps)) {
    return renderNativeItemIndicator(componentProps, item, SELECTED_ITEM_INDICATOR_KIND);
  }
  const { selected } = item;

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
