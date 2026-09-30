/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { Show, splitProps, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useFloatingPortalNode, type FloatingPortal } from '../floating-ui-solid';

/**
 * `FloatingPortal` includes tabbable logic handling for focus management.
 * For components that don't need tabbable logic, use `FloatingPortalLite`.
 * @internal
 */
export function FloatingPortalLite(componentProps: FloatingPortalLite.Props<any>): JSX.Element {
  const [local, , elementProps] = splitProps(
    componentProps,
    ['container', 'class', 'render', 'style'],
    ['children'],
  );

  const { portalNode, portalSubtree } = useFloatingPortalNode({
    componentProps: local,
    get container() {
      return local.container;
    },
    elementProps,
    ref: (el) => {
      if (typeof componentProps.ref === 'function') {
        componentProps.ref(el);
      } else if (
        componentProps.ref !== null &&
        typeof componentProps.ref === 'object' &&
        'current' in componentProps.ref
      ) {
        (componentProps.ref as { current: unknown }).current = el;
      }
    },
  });

  return (
    <>
      {portalSubtree()}
      <Show when={portalNode()} keyed>
        {(node) => <Portal mount={node}>{componentProps.children}</Portal>}
      </Show>
    </>
  );
}

export interface FloatingPortalLiteState {}

export interface FloatingPortalLiteProps<TState> extends FloatingPortal.Props<TState> {}

export namespace FloatingPortalLite {
  export type State = FloatingPortalLiteState;
  export type Props<TState> = FloatingPortalLiteProps<TState>;
}
