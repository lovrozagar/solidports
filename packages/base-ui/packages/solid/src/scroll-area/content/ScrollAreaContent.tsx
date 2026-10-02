import { onSettled, untrack } from 'solid-js';
import { splitComponentProps, useRef } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import { useScrollAreaViewportContext } from '../viewport/ScrollAreaViewportContext';

/**
 * A container for the content of the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaContent(componentProps: ScrollAreaContent.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { computeThumbPosition } = useScrollAreaViewportContext();
  const { hasMeasuredScrollbar, viewportState } = useScrollAreaRootContext();

  const contentWrapperRef = useRef<HTMLDivElement | null>(null);
  const computeOnInitialResize = untrack(hasMeasuredScrollbar);

  onSettled(() => {
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    let hasInitialized = false;
    const resizeObserver = new ResizeObserver(() => {
      if (!hasInitialized) {
        hasInitialized = true;

        // ResizeObserver fires once upon observing. Skip that initial call to avoid
        // double-calculating the thumb position on mount, unless the content mounted
        // after the viewport's initial measurement (in which case this fire is what
        // brings the overflow state in sync).
        if (!computeOnInitialResize) {
          return;
        }
      }

      computeThumbPosition();
    });

    if (contentWrapperRef.current) {
      resizeObserver.observe(contentWrapperRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  });

  const element = useRenderElement('div', componentProps, {
    ref: contentWrapperRef,
    state: viewportState,
    stateAttributesMapping: scrollAreaStateAttributesMapping,
    props: [
      {
        role: 'presentation',
        style: {
          'min-width': 'fit-content',
        },
      },
      elementProps,
    ],
  });

  return <>{element()}</>;
}

export interface ScrollAreaContentState extends ScrollAreaRootState {}

export interface ScrollAreaContentProps extends BaseUIComponentProps<
  'div',
  ScrollAreaContent.State
> {}

export namespace ScrollAreaContent {
  export type State = ScrollAreaContentState;
  export type Props = ScrollAreaContentProps;
}
