import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useInitialLiveRegionTextMutation } from '../utils/useInitialLiveRegionTextMutation';

/**
 * Displays a status message whose content changes are announced politely to screen readers.
 * Useful for conveying the status of an asynchronously loaded list.
 * Renders a `<div>` element.
 */
export function ComboboxStatus(componentProps: ComboboxStatus.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const statusRef = useInitialLiveRegionTextMutation<HTMLDivElement>();

  const element = useRenderElement('div', componentProps, {
    ref: (el) => {
      statusRef.current = el;
    },
    props: [
      {
        'aria-atomic': 'true',
        'aria-live': 'polite',
        role: 'status',
      },
      elementProps,
    ],
  });

  return <>{element()}</>;
}

export interface ComboboxStatusState {}

export interface ComboboxStatusProps extends BaseUIComponentProps<'div', ComboboxStatus.State> {}

export namespace ComboboxStatus {
  export type State = ComboboxStatusState;
  export type Props = ComboboxStatusProps;
}
