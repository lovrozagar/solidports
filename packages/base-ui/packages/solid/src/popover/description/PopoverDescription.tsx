import { createTrackedEffect, onCleanup } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { usePopoverRootContext } from '../root/PopoverRootContext';

/**
 * A paragraph with additional information about the popover.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverDescription(componentProps: PopoverDescription.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { store } = usePopoverRootContext();

  const id = useBaseUiId(() => elementProps.id);

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    store.set('descriptionElementId', id());
    _c.push(() => {
      store.set('descriptionElementId', undefined);
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  const element = useRenderElement('p', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
  });

  return <>{element()}</>;
}

export interface PopoverDescriptionState {}

export interface PopoverDescriptionProps extends BaseUIComponentProps<
  'p',
  PopoverDescription.State
> {}

export namespace PopoverDescription {
  export type State = PopoverDescriptionState;
  export type Props = PopoverDescriptionProps;
}
