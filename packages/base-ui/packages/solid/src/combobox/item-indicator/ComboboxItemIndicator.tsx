import { createMemo, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../utils/types';
import { ItemIndicator, SELECTED_ITEM_INDICATOR_KIND } from '../../utils/ItemIndicator';
import { canRenderNative } from '../../utils/native';
import { renderNativeItemIndicator } from '../../utils/native/itemIndicator';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { useComboboxItemContext } from '../item/ComboboxItemContext';

/**
 * Indicates whether the item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxItemIndicator(componentProps: ComboboxItemIndicator.Props) {
  // Native fast path (`context/architecture/render-pipeline.md`): the shared item indicator
  // (`utils/native/itemIndicator.tsx`, D32's sweep).
  if (canRenderNative(componentProps)) {
    return renderNativeItemIndicator(
      componentProps,
      useComboboxItemContext(),
      SELECTED_ITEM_INDICATOR_KIND,
    );
  }
  return SlowComboboxItemIndicator(componentProps);
}

function SlowComboboxItemIndicator(componentProps: ComboboxItemIndicator.Props) {
  const { selected } = useComboboxItemContext();
  const rendered = createMemo(() => Boolean(componentProps.keepMounted) || selected());

  // Mount the shared indicator only while selected or kept mounted, so an unselected item does
  // not pay for the transition hooks.
  return (
    <Show when={rendered()}>
      <ItemIndicator {...componentProps} selected={selected()} />
    </Show>
  );
}

export interface ComboboxItemIndicatorProps extends BaseUIComponentProps<
  'span',
  ComboboxItemIndicator.State
> {
  children?: JSX.Element | undefined;
  /**
   * Whether to keep the HTML element in the DOM when the item is not selected.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface ComboboxItemIndicatorState {
  selected: boolean;
  transitionStatus: TransitionStatus;
}

export namespace ComboboxItemIndicator {
  export type Props = ComboboxItemIndicatorProps;
  export type State = ComboboxItemIndicatorState;
}
