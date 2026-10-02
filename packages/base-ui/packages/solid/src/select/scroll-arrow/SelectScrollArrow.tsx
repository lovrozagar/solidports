import { onSettled, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { Side } from '../../utils/useAnchorPositioning';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import { type TransitionStatus, useTransitionStatus } from '../../utils/useTransitionStatus';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useSelectRootContext } from '../root/SelectRootContext';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import {
  getMaxScrollOffset,
  normalizeScrollOffset,
  SCROLL_EDGE_TOLERANCE_PX,
} from '../../utils/scrollEdges';

/**
 * @internal
 */
export function SelectScrollArrow(componentProps: SelectScrollArrow.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['direction', 'keepMounted']);
  const keepMounted = () => componentProps.keepMounted ?? false;
  const isUp = () => local.direction === 'up';

  const { store, popupRef, listRef, handleScrollArrowVisibility, scrollArrowsMountedCountRef } =
    useSelectRootContext();
  const { side, scrollDownArrowRef, scrollUpArrowRef } = useSelectPositionerContext();

  const stateVisible = () =>
    local.direction === 'up'
      ? store.useState('scrollUpArrowVisible')()
      : store.useState('scrollDownArrowVisible')();
  const openMethod = store.useState('openMethod');

  // Scroll arrows are disabled for touch modality as they are a hover-only element.
  const visible = () => stateVisible() && openMethod() !== 'touch';

  const timeout = useTimeout();

  const scrollArrowRef = () =>
    local.direction === 'up' ? scrollUpArrowRef.current : scrollDownArrowRef.current;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(visible);

  onSettled(() => {
    scrollArrowsMountedCountRef.current += 1;
    if (!store.state.hasScrollArrows) {
      store.set('hasScrollArrows', true);
    }

    return () => {
      scrollArrowsMountedCountRef.current = Math.max(0, scrollArrowsMountedCountRef.current - 1);
      if (scrollArrowsMountedCountRef.current === 0 && store.state.hasScrollArrows) {
        store.set('hasScrollArrows', false);
      }
    };
  });

  useOpenChangeComplete({
    onComplete() {
      if (!visible()) {
        setMounted(false);
      }
    },
    open: visible,
    ref: scrollArrowRef,
  });

  const state: SelectScrollArrow.State = {
    get direction() {
      return local.direction;
    },
    get side() {
      return side();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get visible() {
      return visible();
    },
  };

  const defaultProps = {
    'aria-hidden': 'true',
    get children() {
      return <>{local.direction === 'up' ? '▲' : '▼'}</>;
    },
    onMouseLeave() {
      timeout.clear();
    },
    onMouseMove(event) {
      if ((event.movementX === 0 && event.movementY === 0) || timeout.isStarted()) {
        return;
      }

      store.set('activeIndex', null);

      function scrollNextItem() {
        const scroller = store.state.listElement ?? popupRef.current;
        if (!scroller) {
          return;
        }

        store.set('activeIndex', null);
        handleScrollArrowVisibility(scroller);

        const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
        const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
        const isScrolledToEdge = scrollTop === (isUp() ? 0 : maxScrollTop);
        const items = listRef.current;

        if (scrollTop !== scroller.scrollTop) {
          scroller.scrollTop = scrollTop;
        }

        if (isScrolledToEdge) {
          timeout.clear();
          return;
        }

        if (items.length > 0) {
          const scrollArrowHeight = scrollArrowRef()?.offsetHeight || 0;
          scroller.scrollTop = getTargetScrollTop(
            items,
            isUp(),
            scrollTop,
            scroller.clientHeight,
            scrollArrowHeight,
            maxScrollTop,
          );
        }

        timeout.start(40, scrollNextItem);
      }

      timeout.start(40, scrollNextItem);
    },
    style: {
      position: 'absolute',
    },
  } satisfies JSX.HTMLAttributes<HTMLDivElement>;

  const shouldRender = () => mounted() || keepMounted();

  const element = useRenderElement('div', componentProps, {
    props: [defaultProps, elementProps],
    ref: (el) => {
      if (local.direction === 'up') {
        scrollUpArrowRef.current = el;
      } else {
        scrollDownArrowRef.current = el;
      }
    },
    state,
    stateAttributesMapping: transitionStatusMapping,
  });

  return <Show when={shouldRender()}>{element()}</Show>;
}

export interface SelectScrollArrowState {
  direction: 'up' | 'down';
  visible: boolean;
  side: Side | 'none';
  transitionStatus: TransitionStatus;
}

export interface SelectScrollArrowProps extends BaseUIComponentProps<
  'div',
  SelectScrollArrow.State
> {
  direction: 'up' | 'down';
  /**
   * Whether to keep the HTML element in the DOM while the select popup is not scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace SelectScrollArrow {
  export type State = SelectScrollArrowState;
  export type Props = SelectScrollArrowProps;
}

function getTargetScrollTop(
  items: Array<HTMLElement | null | undefined>,
  isUp: boolean,
  scrollTop: number,
  clientHeight: number,
  scrollArrowHeight: number,
  maxScrollTop: number,
) {
  if (isUp) {
    let firstVisibleIndex = 0;
    const visibleTop = scrollTop + scrollArrowHeight - SCROLL_EDGE_TOLERANCE_PX;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.offsetTop >= visibleTop) {
        firstVisibleIndex = i;
        break;
      }
    }

    const targetIndex = Math.max(0, firstVisibleIndex - 1);
    const targetItem = items[targetIndex];
    return targetIndex < firstVisibleIndex && targetItem
      ? normalizeScrollOffset(targetItem.offsetTop - scrollArrowHeight, maxScrollTop)
      : 0;
  }

  let lastVisibleIndex = items.length - 1;
  const visibleBottom = scrollTop + clientHeight - scrollArrowHeight + SCROLL_EDGE_TOLERANCE_PX;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item && item.offsetTop + item.offsetHeight > visibleBottom) {
      lastVisibleIndex = Math.max(0, i - 1);
      break;
    }
  }

  const targetIndex = Math.min(items.length - 1, lastVisibleIndex + 1);
  const targetItem = items[targetIndex];
  return targetIndex > lastVisibleIndex && targetItem
    ? normalizeScrollOffset(
        targetItem.offsetTop + targetItem.offsetHeight - clientHeight + scrollArrowHeight,
        maxScrollTop,
      )
    : maxScrollTop;
}
