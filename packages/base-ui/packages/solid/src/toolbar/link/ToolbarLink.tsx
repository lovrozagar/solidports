import type { JSX } from '@solidjs/web';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import type { ToolbarRoot } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';

const TOOLBAR_LINK_METADATA = {
  // Links cannot be disabled, but they still occupy a focusable composite item slot.
  disabled: false,
  focusableWhenDisabled: true,
};

/**
 * A link component.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarLink(componentProps: ToolbarLink.Props) {
  const [renderProps, local, elementProps] = splitComponentProps(componentProps, ['children']);

  const { orientation } = useToolbarRootContext();

  const state: ToolbarLink.State = {
    get orientation() {
      return orientation();
    },
  };

  return (
    <CompositeItem
      tag="a"
      render={renderProps.render}
      class={renderProps.class}
      metadata={TOOLBAR_LINK_METADATA}
      state={state}
      ref={componentProps.ref}
      props={[elementProps]}
    >
      {local.children}
    </CompositeItem>
  );
}

export interface ToolbarLinkState {
  orientation: ToolbarRoot.Orientation;
}

export interface ToolbarLinkProps extends BaseUIComponentProps<
  'a',
  ToolbarLink.State,
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>
> {}

export namespace ToolbarLink {
  export type State = ToolbarLinkState;
  export type Props = ToolbarLinkProps;
}
