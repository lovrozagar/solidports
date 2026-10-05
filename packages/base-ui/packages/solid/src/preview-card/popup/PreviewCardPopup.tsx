import { useHoverFloatingInteraction } from '../../floating-ui-solid';
import { splitComponentProps } from '../../solid-helpers';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import type { Align, Side } from '../../utils/useAnchorPositioning';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { usePreviewCardPositionerContext } from '../positioner/PreviewCardPositionerContext';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';

const stateAttributesMapping: StateAttributesMapping<PreviewCardPopup.State> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the preview card contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardPopup(componentProps: PreviewCardPopup.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { store } = usePreviewCardRootContext();
  const { side, align } = usePreviewCardPositionerContext();

  const open = store.useState('open');
  const instantType = store.useState('instantType');
  const transitionStatus = store.useState('transitionStatus');
  const popupProps = store.useState('popupProps');
  const closeDelay = store.useState('closeDelay');

  useOpenChangeComplete({
    onComplete() {
      if (open()) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
    open,
    ref: () => store.context.popupRef.current,
  });

  useHoverFloatingInteraction({
    get context() {
      return store.context.floatingRootContext;
    },
    parameters: {
      get closeDelay() {
        return closeDelay();
      },
    },
  });

  const state: PreviewCardPopup.State = {
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

  // Read per key by the element props: a change does not rebuild the props chain.
  const popupPropsSource = propsSourceAccessor(() => popupProps());
  const transitionStyles = propsSourceAccessor(() =>
    getDisabledMountTransitionStyles(transitionStatus()),
  );
  const element = useRenderElement('div', componentProps, {
    props: [popupPropsSource, transitionStyles, elementProps],
    ref: [store.context.popupRef, setPopupElement],
    state,
    stateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface PreviewCardPopupState {
  /**
   * Whether the preview card is currently open.
   */
  open: boolean;
  side: Side;
  align: Align;
  instant: 'dismiss' | 'focus' | undefined;
  transitionStatus: TransitionStatus;
}

export interface PreviewCardPopupProps extends BaseUIComponentProps<
  'div',
  PreviewCardPopup.State
> {}

export namespace PreviewCardPopup {
  export type State = PreviewCardPopupState;
  export type Props = PreviewCardPopupProps;
}
