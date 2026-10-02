import { onSettled } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useToastRootContext } from '../root/ToastRootContext';

/**
 * A container for the contents of a toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastContent(componentProps: ToastContent.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { visibleIndex, expanded, recalculateHeight } = useToastRootContext();

  let contentRef: HTMLDivElement | null | undefined;

  onSettled(() => {
    const node = contentRef;
    if (!node) {
      return undefined;
    }

    recalculateHeight();

    if (typeof ResizeObserver !== 'function' || typeof MutationObserver !== 'function') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => recalculateHeight(true));
    const mutationObserver = new MutationObserver(() => recalculateHeight(true));

    resizeObserver.observe(node);
    mutationObserver.observe(node, { characterData: true, childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  });

  const behind = () => visibleIndex() > 0;

  const state: ToastContent.State = {
    get behind() {
      return behind();
    },
    get expanded() {
      return expanded();
    },
  };

  const element = useRenderElement('div', componentProps, {
    props: elementProps,
    ref: (el) => {
      contentRef = el;
    },
    state,
  });

  return <>{element()}</>;
}

export interface ToastContentState {
  /**
   * Whether the toast viewport is expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast is behind the frontmost toast in the stack.
   */
  behind: boolean;
}

export interface ToastContentProps extends BaseUIComponentProps<'div', ToastContent.State> {}

export namespace ToastContent {
  export type State = ToastContentState;
  export type Props = ToastContentProps;
}
