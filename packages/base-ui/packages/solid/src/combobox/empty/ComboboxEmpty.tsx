import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useInitialLiveRegionTextMutation } from '../../internals/useInitialLiveRegionTextMutation';
import {
  useComboboxDerivedItemsContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';

/**
 * Renders its children only when the list is empty.
 * Requires the `items` prop on the root component.
 * Announces changes politely to screen readers.
 * This component's root element must remain mounted in the DOM to announce
 * changes consistently across screen readers. Avoid hiding or removing the
 * component itself with `display: none`, `hidden`, `aria-hidden`, or conditional
 * rendering. Prefer updating or conditionally rendering its children instead.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxEmpty(componentProps: ComboboxEmpty.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['children']);

  const { filteredItems } = useComboboxDerivedItemsContext();
  const store = useComboboxRootContext();
  const emptyRef = useInitialLiveRegionTextMutation<HTMLDivElement>();

  const element = useRenderElement('div', componentProps, {
    get children() {
      return filteredItems().length === 0 ? local.children : false;
    },
    props: [
      {
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': 'true',
      },
      elementProps,
    ],
    ref: (el) => {
      store.context.emptyRef.current = el;
      emptyRef.current = el;
    },
  });

  return element();
}

export interface ComboboxEmptyState {}

export interface ComboboxEmptyProps extends BaseUIComponentProps<'div', ComboboxEmpty.State> {}

export namespace ComboboxEmpty {
  export type State = ComboboxEmptyState;
  export type Props = ComboboxEmptyProps;
}
