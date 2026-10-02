import { useHoverFloatingInteraction } from '../../floating-ui-solid';
import { splitComponentProps } from '../../solid-helpers';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import type { Align, Side } from '../../utils/useAnchorPositioning';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { useTooltipPositionerContext } from '../positioner/TooltipPositionerContext';
import { useTooltipRootContext } from '../root/TooltipRootContext';

const stateAttributesMapping: StateAttributesMapping<TooltipPopup.State> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the tooltip contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipPopup(componentProps: TooltipPopup.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { store } = useTooltipRootContext();
  const { side, align } = useTooltipPositionerContext();

  const open = store.useState('open');
  const instantType = store.useState('instantType');
  const transitionStatus = store.useState('transitionStatus');
  const popupProps = store.useState('popupProps');
  const popupElement = store.useState('popupElement');

  useOpenChangeComplete({
    onComplete() {
      if (open()) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
    open,
    ref: popupElement,
  });

  const disabled = store.useState('disabled');
  const closeDelay = store.useState('closeDelay');

  useHoverFloatingInteraction({
    get context() {
      return store.context.floatingRootContext;
    },
    parameters: {
      get closeDelay() {
        return closeDelay();
      },
      get enabled() {
        return !disabled();
      },
    },
  });

  const state: TooltipPopup.State = {
    get align() {
      return align();
    },
    get instant() {
      return instantType();
    },
    get open() {
      return open();
    },
    get side() {
      return side();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const setPopupElement = store.useStateSetter('popupElement');

  const element = useRenderElement('div', componentProps, {
    get props() {
      return [popupProps(), getDisabledMountTransitionStyles(transitionStatus()), elementProps];
    },
    ref: [store.context.popupRef, setPopupElement],
    state,
    stateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface TooltipPopupState {
  /**
   * Whether the tooltip is currently open.
   */
  open: boolean;
  side: Side;
  align: Align;
  instant: 'delay' | 'focus' | 'dismiss' | undefined;
  transitionStatus: TransitionStatus;
}

export interface TooltipPopupProps extends BaseUIComponentProps<'div', TooltipPopup.State> {}

export namespace TooltipPopup {
  export type State = TooltipPopupState;
  export type Props = TooltipPopupProps;
}
