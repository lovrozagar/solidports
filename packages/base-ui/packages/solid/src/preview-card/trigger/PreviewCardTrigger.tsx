import { createMemo, createSignal, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { safePolygon, useFocus, useHoverReferenceInteraction } from '../../floating-ui-solid';
import { live, splitComponentProps, type ReactLikeRef } from '../../solid-helpers';
import {
  getInlineRectTriggerProps,
  usePopupHandleStore,
  useTriggerDataForwarding,
} from '../../utils/popups';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { PreviewCardHandle } from '../store/PreviewCardHandle';
import type { PreviewCardHandleStore } from '../store/PreviewCardStore';
import { CLOSE_DELAY, OPEN_DELAY } from '../utils/constants';

/**
 * A link that opens the preview card.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardTrigger<Payload>(componentProps: PreviewCardTrigger.Props<Payload>) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'delay',
    'closeDelay',
    'id',
    'payload',
    'handle',
  ]);
  const idProp = () => local.id;

  const rootContext = usePreviewCardRootContext(true);
  const handleStore = usePopupHandleStore(() => local.handle);
  const store = createMemo(
    () => (handleStore() ?? rootContext?.store) as PreviewCardHandleStore<unknown> | undefined,
  );
  if (!untrack(store)) {
    throw new Error(
      'Base UI: <PreviewCard.Trigger> must be either used within a <PreviewCard.Root> component or provided with a handle.',
    );
  }
  // Live: handlers, refs and effect callbacks read the latest store imperatively.
  const currentStore = live(() => store()!);

  const thisTriggerId = useBaseUiId(idProp);
  const isTriggerActive = () => currentStore().select('isTriggerActive', thisTriggerId);
  const isOpenedByThisTrigger = () => currentStore().select('isOpenedByTrigger', thisTriggerId);
  const floatingRootContext = () => currentStore().context.floatingRootContext;
  const inlineRectCoordsRef = () => currentStore().context.inlineRectCoordsRef;

  const triggerElementRef: ReactLikeRef<Element | null> = { current: null };
  // Solid: a signal as well, so the hover hook re-attaches its listeners once the element exists.
  const [triggerElement, setTriggerElement] = createSignal<Element | null>(null);

  const delayWithDefault = () => local.delay ?? OPEN_DELAY;
  const closeDelayWithDefault = () => local.closeDelay ?? CLOSE_DELAY;

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElementRef,
    currentStore,
    {
      get payload() {
        return local.payload;
      },
      get closeDelay() {
        return closeDelayWithDefault();
      },
    },
  );

  const hoverProps = useHoverReferenceInteraction({
    get context() {
      return floatingRootContext();
    },
    props: {
      mouseOnly: true,
      move: false,
      handleClose: safePolygon(),
      delay: () => ({ open: untrack(delayWithDefault), close: untrack(closeDelayWithDefault) }),
      get triggerElementRef() {
        return triggerElement();
      },
      get isActiveTrigger() {
        return isTriggerActive();
      },
      isClosing: () => currentStore().select('transitionStatus') === 'ending',
    },
  });

  const focusProps = useFocus({
    get context() {
      return floatingRootContext();
    },
    props: {
      get delay() {
        return delayWithDefault();
      },
    },
  });

  const state: PreviewCardTrigger.State = {
    get open() {
      return isOpenedByThisTrigger();
    },
  };

  const rootTriggerProps = () => currentStore().select('triggerProps', isMountedByThisTrigger);
  // Rebuilt when the open state changes, as React rebuilds it on render.
  const inlineRectTriggerProps = createMemo(
    () => getInlineRectTriggerProps(inlineRectCoordsRef(), isOpenedByThisTrigger()) as HTMLProps,
  );

  // Read per key by the element props: a change does not rebuild the props chain.
  const rootTriggerSource = propsSourceAccessor(() => rootTriggerProps());
  const inlineRectSource = propsSourceAccessor(() => inlineRectTriggerProps());
  const element = useRenderElement('a', componentProps, {
    state,
    ref: (el: Element | null) => {
      triggerElementRef.current = el;
      registerTrigger(el);
      setTriggerElement(el);
    },
    props: [
      hoverProps,
      propsSourceAccessor(() => focusProps.reference as HTMLProps),
      rootTriggerSource,
      inlineRectSource,
      {
        get id() {
          return thisTriggerId();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: triggerOpenStateMapping,
  });

  return <>{element()}</>;
}

export interface PreviewCardTriggerState {
  /**
   * Whether the preview card is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface PreviewCardTriggerProps<Payload = unknown> extends BaseUIComponentProps<
  'a',
  PreviewCardTrigger.State,
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>
> {
  /**
   * A handle to associate the trigger with a preview card.
   */
  handle?: PreviewCardHandle<Payload> | undefined;
  /**
   * A payload to pass to the preview card when it is opened.
   */
  // Inferred from `handle` (React gets this from method bivariance), so the payload must match it.
  payload?: NoInfer<Payload> | undefined;
  /**
   * How long to wait before the preview card opens. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the preview card. Specified in milliseconds.
   * @default 300
   */
  closeDelay?: number | undefined;
}

export namespace PreviewCardTrigger {
  export type State = PreviewCardTriggerState;
  export type Props<Payload = unknown> = PreviewCardTriggerProps<Payload>;
}
