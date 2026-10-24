import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { NativeElementTemplate } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import type { Align, Side } from '../../utils/useAnchorPositioning';
import { useRenderElement } from '../../utils/useRenderElement';
import { useToastPositionerContext } from '../positioner/ToastPositionerContext';
import type { ToastPositionerContext } from '../positioner/ToastPositionerContext';

const DIV: NativeElementTemplate = {
  tag: 'div',
  attributes: { 'aria-hidden': 'true' },
  create: () => (<div aria-hidden="true" />) as unknown as Element,
};
const NO_OWN_KEYS: ReadonlySet<string> = new Set();
/** The state's `data-*` attributes, in the slow path's key order. */
const writeArrowState = compileStateWriter(['align', 'side', 'uncentered'], undefined);

/** The arrow's state and part refs: prototype getters over its positioner. */
class NativeToastArrowState {
  declare private readonly positioner: ToastPositionerContext;

  constructor(positioner: ToastPositionerContext) {
    this.positioner = positioner;
  }

  get align() {
    return this.positioner.align();
  }

  get side() {
    return this.positioner.side();
  }

  get uncentered() {
    return this.positioner.arrowUncentered();
  }

  /** The positioner's arrow styles, below the consumer's style. */
  styles(): JSX.CSSProperties {
    return this.positioner.arrowStyles;
  }

  setArrow(el: Element | null) {
    this.positioner.arrowRef.current = el;
  }
}

const arrowState = (state: NativeToastArrowState) => state;

/**
 * Displays an element positioned against the toast anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastArrow(componentProps: ToastArrow.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div aria-hidden>` with
  // the positioner's side, align and arrow styles (D32's sweep).
  if (canRenderNative(componentProps)) {
    const state = new NativeToastArrowState(useToastPositionerContext());
    return renderNativeElement(DIV, componentProps, {
      own: NO_OWN_KEYS,
      state: arrowState,
      stateWriter: writeArrowState,
      stateView: state,
      reactive: true,
      handlerTarget: state,
      partStyle: state.styles.bind(state),
      refs: [state.setArrow.bind(state)],
    }) as unknown as JSX.Element;
  }
  return SlowToastArrow(componentProps);
}

function SlowToastArrow(componentProps: ToastArrow.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const positionerContext = useToastPositionerContext();
  const { arrowRef, side, align, arrowUncentered } = positionerContext;

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
    props: [
      {
        // Solid: the context exposes the arrow styles as a live getter.
        get style() {
          return positionerContext.arrowStyles;
        },
        'aria-hidden': 'true',
      },
      elementProps,
    ],
    ref: (el) => {
      arrowRef.current = el;
    },
    state,
  });

  return element();
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
