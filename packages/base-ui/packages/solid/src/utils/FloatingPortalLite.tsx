/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Portal } from '@solidjs/web';
import { useFloatingPortalNode, type FloatingPortal } from '../floating-ui-solid';

/**
 * `FloatingPortal` includes tabbable logic handling for focus management.
 * For components that don't need tabbable logic, use `FloatingPortalLite`.
 * @internal
 */
export function FloatingPortalLite(componentProps: FloatingPortalLite.Props<any>): JSX.Element {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'children',
    'container',
    'ref',
  );

  const { node: portalNode, subtree: portalSubtree } = useFloatingPortalNode({
    get container() {
      return componentProps.container;
    },
    componentProps,
    elementProps,
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
