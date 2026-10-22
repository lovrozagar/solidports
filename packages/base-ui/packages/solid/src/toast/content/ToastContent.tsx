import { onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useToastRootContext } from '../root/ToastRootContext';
import type { ToastRootContext } from '../root/ToastRootContext';

const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set();
const writeContentState = compileStateWriter(['behind', 'expanded'], undefined);

/** The content's element and state: one object per toast content. */
class ToastContentModel {
  declare readonly root: ToastRootContext;
  declare node: HTMLDivElement | null | undefined;
  declare readonly setRef: (el: HTMLDivElement | null | undefined) => void;

  constructor(root: ToastRootContext) {
    this.root = root;
    this.node = null;
    this.setRef = (el) => {
      this.node = el;
    };
  }

  get behind() {
    return this.root.visibleIndex() > 0;
  }

  get expanded() {
    return this.root.expanded();
  }
}

/** The state `class` and `style` functions receive, built on first use. */
const contentStateOf = (model: ToastContentModel): ToastContent.State => ({
  get behind() {
    return model.behind;
  },
  get expanded() {
    return model.expanded;
  },
});

/**
 * A container for the contents of a toast.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastContent(componentProps: ToastContent.Props): JSX.Element {
  const root = useToastRootContext();
  const { recalculateHeight } = root;
  const model = new ToastContentModel(root);

  onSettled(() => {
    const node = model.node;
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

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div>` with the
  // content's state attributes, no props view (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state: contentStateOf,
      stateView: model,
      stateWriter: writeContentState,
      handlerTarget: model,
      reactive: true,
      refs: [model.setRef],
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

  const element = useRenderElement('div', componentProps, {
    props: elementProps,
    ref: model.setRef,
    state: contentStateOf(model),
  });

  return element();
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
