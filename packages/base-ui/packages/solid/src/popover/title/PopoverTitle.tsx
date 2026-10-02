import { createTrackedEffect, onCleanup } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { usePopoverRootContext } from '../root/PopoverRootContext';

/**
 * A heading that labels the popover.
 * Renders an `<h2>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverTitle(componentProps: PopoverTitle.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { store } = usePopoverRootContext();

  const id = useBaseUiId(() => elementProps.id);

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    store.set('titleElementId', id());
    _c.push(() => {
      store.set('titleElementId', undefined);
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  const element = useRenderElement('h2', componentProps, {
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

export interface PopoverTitleState {}

export interface PopoverTitleProps extends BaseUIComponentProps<
  'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
  PopoverTitle.State
> {}

export namespace PopoverTitle {
  export type State = PopoverTitleState;
  export type Props = PopoverTitleProps;
}
