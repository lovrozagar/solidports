import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import type { Align, Side } from '../../utils/useAnchorPositioning';
import { useRenderElement } from '../../utils/useRenderElement';
import { useToastPositionerContext } from '../positioner/ToastPositionerContext';

/**
 * Displays an element positioned against the toast anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastArrow(componentProps: ToastArrow.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { arrowRef, side, align, arrowUncentered, arrowStyles } = useToastPositionerContext();

  const state: ToastArrow.State = {
    get align() {
      return align();
    },
    get side() {
      return side();
    },
    get uncentered() {
      return arrowUncentered();
    },
  };

  const element = useRenderElement('div', componentProps, {
    props: [{ style: arrowStyles, 'aria-hidden': true }, elementProps],
    ref: (el) => {
      arrowRef.current = el;
    },
    state,
  });

  return <>{element()}</>;
}

export interface ToastArrowState {
  side: Side;
  align: Align;
  uncentered: boolean;
}

export interface ToastArrowProps extends BaseUIComponentProps<'div', ToastArrow.State> {}

export namespace ToastArrow {
  export type State = ToastArrowState;
  export type Props = ToastArrowProps;
}
