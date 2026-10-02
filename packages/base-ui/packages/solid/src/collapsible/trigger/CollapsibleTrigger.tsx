import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { CollapsibleRoot } from '../root/CollapsibleRoot';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';

const stateAttributesMapping: StateAttributesMapping<CollapsibleRoot.State> = {
  ...triggerOpenStateMapping,
  ...transitionStatusMapping,
};

/**
 * A button that opens and closes the collapsible panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export function CollapsibleTrigger(componentProps: CollapsibleTrigger.Props): JSX.Element {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'id',
    'nativeButton',
  ]);
  const {
    panelId,
    open,
    handleTrigger,
    disabled: contextDisabled,
    state,
  } = useCollapsibleRootContext();
  const nativeButton = () => Boolean(local.nativeButton ?? true);
  const disabled = () => local.disabled ?? contextDisabled();

  const button = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
  });

  const props: HTMLProps = {
    get 'aria-controls'() {
      return open() ? panelId() : undefined;
    },
    get 'aria-expanded'() {
      return open() ? 'true' : 'false';
    },
    onClick: handleTrigger,
  };

  const element = useRenderElement('button', componentProps, {
    props: [props, elementProps, button.getButtonProps],
    ref: button.buttonRef,
    state,
    stateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface CollapsibleTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', CollapsibleRoot.State> {}

export namespace CollapsibleTrigger {
  export type Props = CollapsibleTriggerProps;
}
