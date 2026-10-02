import { createEffect, createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { FloatingFocusManager, useHoverFloatingInteraction } from '../../floating-ui-solid';
import { splitComponentProps } from '../../solid-helpers';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import type { Align, Side } from '../../utils/useAnchorPositioning';
import type { InteractionType } from '../../utils/useEnhancedClickHandler';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import type { MenuRoot } from '../root/MenuRoot';
import { useMenuRootContext } from '../root/MenuRootContext';

const stateAttributesMapping: StateAttributesMapping<MenuPopup.State> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the menu items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuPopup(componentProps: MenuPopup.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['finalFocus']);

  const { store } = useMenuRootContext();
  const { side, align } = useMenuPositionerContext();
  const toolbarRootContext = useToolbarRootContext(true);
  const insideToolbar = () => toolbarRootContext != null;

  const open = store.useState('open');
  const transitionStatus = store.useState('transitionStatus');
  const popupProps = store.useState('popupProps');
  const mounted = store.useState('mounted');
  const instantType = store.useState('instantType');
  const triggerElement = store.useState('activeTriggerElement');
  const parent = store.useState('parent');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');
  const rootId = store.useState('rootId');
  const floatingContext = store.context.floatingRootContext;
  const floatingTreeRoot = store.useState('floatingTreeRoot');
  const closeDelay = store.useState('closeDelay');
  const activeTriggerElement = store.useState('activeTriggerElement');
  const openMethod = store.useState('openMethod');

  const isContextMenu = () => parent().type === 'context-menu';

  useOpenChangeComplete({
    onComplete() {
      if (open()) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
    open,
    ref: () => store.context.popupRef.current,
  });

  function handleClose(event: { domEvent: Event | undefined; reason: MenuRoot.ChangeEventReason }) {
    store.setOpen(false, createChangeEventDetails(event.reason, event.domEvent));
  }

  createEffect(
    () => floatingTreeRoot().events,
    (events) => {
      events.on('close', handleClose);
      return () => {
        events.off('close', handleClose);
      };
    },
  );

  const hoverEnabled = store.useState('hoverEnabled');
  const disabled = store.useState('disabled');

  useHoverFloatingInteraction({
    context: floatingContext,
    parameters: {
      get closeDelay() {
        return closeDelay();
      },
      get enabled() {
        return hoverEnabled() && !disabled() && !isContextMenu() && parent().type !== 'menubar';
      },
    },
  });

  const setPopupElement = store.useStateSetter('popupElement');

  const state: MenuPopup.State = {
    get align() {
      return align();
    },
    get instant() {
      return instantType();
    },
    get nested() {
      return parent().type === 'menu';
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

  const element = useRenderElement('div', componentProps, {
    get props() {
      return [
        popupProps(),
        {
          onKeyDown(event: KeyboardEvent) {
            if (insideToolbar() && COMPOSITE_KEYS.has(event.key)) {
              event.stopPropagation();
            }
          },
        },
        getDisabledMountTransitionStyles(transitionStatus()),
        elementProps,
        {
          get ['data-rootownerid' as string]() {
            return rootId();
          },
        },
      ];
    },
    ref: [store.context.popupRef, setPopupElement],
    state,
    stateAttributesMapping,
  });

  const shouldReturnFocus = createMemo(() => {
    if (
      triggerElement() ||
      (parent().type === 'menubar' && lastOpenChangeReason() !== REASONS.outsidePress)
    ) {
      return true;
    }
    return parent().type === undefined || isContextMenu();
  });

  const resolvedReturnFocus = createMemo(() =>
    local.finalFocus === undefined ? shouldReturnFocus() : local.finalFocus,
  );

  const initialFocus = createMemo(() => parent().type !== 'menu');

  return (
    <FloatingFocusManager
      context={floatingContext}
      openInteractionType={openMethod()}
      modal={isContextMenu()}
      disabled={!mounted()}
      returnFocus={resolvedReturnFocus()}
      initialFocus={initialFocus()}
      restoreFocus
      externalTree={parent().type !== 'menubar' ? floatingTreeRoot() : undefined}
      previousFocusableElement={activeTriggerElement() as HTMLElement | null}
      nextFocusableElement={
        parent().type === undefined ? store.context.triggerFocusTargetRef.current : undefined
      }
      beforeContentFocusGuardRef={
        parent().type === undefined ? store.context.beforeContentFocusGuardRef : undefined
      }
    >
      {element()}
    </FloatingFocusManager>
  );
}

export interface MenuPopupProps extends BaseUIComponentProps<'div', MenuPopup.State> {
  children?: JSX.Element;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Determines the element to focus when the menu is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | (
        | boolean
        | HTMLElement
        | null
        | ((closeType: InteractionType) => boolean | HTMLElement | null | undefined | void)
      )
    | undefined;
}

export type MenuPopupState = {
  transitionStatus: TransitionStatus;
  side: Side;
  align: Align;
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  nested: boolean;
  instant: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
};

export namespace MenuPopup {
  export type Props = MenuPopupProps;
  export type State = MenuPopupState;
}
