import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { useScrollAreaScrollbarContext } from '../scrollbar/ScrollAreaScrollbarContext';
import { ScrollAreaScrollbarCssVars } from '../scrollbar/ScrollAreaScrollbarCssVars';

/**
 * The draggable part of the the scrollbar that indicates the current scroll position.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaThumb(componentProps: ScrollAreaThumb.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const {
    thumbYRef,
    thumbXRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    scrollingX,
    scrollingY,
    hasMeasuredScrollbar,
  } = useScrollAreaRootContext();

  const { orientation } = useScrollAreaScrollbarContext();
  const vertical = () => orientation() === 'vertical';

  const state: ScrollAreaThumbState = {
    get scrolling() {
      return vertical() ? scrollingY() : scrollingX();
    },
    get orientation() {
      return orientation();
    },
  };

  const element = useRenderElement('div', componentProps, {
    // Solid: one callback stands in for React's `vertical ? thumbYRef : thumbXRef`.
    ref: (el: HTMLDivElement | null) => {
      (vertical() ? thumbYRef : thumbXRef).current = el;
    },
    state,
    props: [
      {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
        get style(): JSX.CSSProperties {
          return {
            ...(!hasMeasuredScrollbar() && { visibility: 'hidden' }),
            ...(vertical()
              ? { height: `var(${ScrollAreaScrollbarCssVars.scrollAreaThumbHeight})` }
              : { width: `var(${ScrollAreaScrollbarCssVars.scrollAreaThumbWidth})` }),
          };
        },
      },
      elementProps,
    ],
  });

  return <>{element()}</>;
}

export interface ScrollAreaThumbState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The component orientation.
   */
  orientation: 'horizontal' | 'vertical';
}

export interface ScrollAreaThumbProps extends BaseUIComponentProps<'div', ScrollAreaThumbState> {}

export namespace ScrollAreaThumb {
  export type State = ScrollAreaThumbState;
  export type Props = ScrollAreaThumbProps;
}
