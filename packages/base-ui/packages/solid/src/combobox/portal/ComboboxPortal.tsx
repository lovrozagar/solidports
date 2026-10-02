import { Show } from 'solid-js';
import { FloatingPortal } from '../../floating-ui-solid';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { ComboboxPortalContext } from './ComboboxPortalContext';
import { splitProps } from '../../solid-1-compat';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 */
export function ComboboxPortal(props: ComboboxPortal.Props) {
  const [local, portalProps] = splitProps(props, ['keepMounted']);
  const keepMounted = () => local.keepMounted ?? false;

  const store = useComboboxRootContext();

  const mounted = store.useState('mounted');
  const forceMounted = store.useState('forceMounted');

  const shouldRender = () => mounted() || keepMounted() || forceMounted();

  return (
    <Show when={shouldRender()}>
      <ComboboxPortalContext value={keepMounted}>
        <FloatingPortal {...portalProps} ref={props.ref} />
      </ComboboxPortalContext>
    </Show>
  );
}

export namespace ComboboxPortal {
  export interface State {}
}

export interface ComboboxPortalProps extends FloatingPortal.Props<ComboboxPortal.State> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace ComboboxPortal {
  export type Props = ComboboxPortalProps;
}
