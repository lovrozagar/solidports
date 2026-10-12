import { createEffect, createMemo, useContext } from 'solid-js';
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
import { propsSourceAccessor } from '../../utils/propsView';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { resolvePopupLabel } from '../../utils/resolvePopupLabel';
import { useRenderedId } from '../../utils/resolveRenderedId';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import type { MenuRoot } from '../root/MenuRoot';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import { MenuFilterImplContext, useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import { useNoParentHandoff } from '../filter-root/useVirtualFocusParentHandoff';

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
export function MenuPopupPlain(componentProps: MenuPopup.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'finalFocus',
    'initialFocus',
    'id',
  ]);

  const { store, orientation, virtualFocus, defaultFloatingId, setRenderedFloatingId } =
    useMenuRootContext();
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
  const listElement = store.useState('listElement');
  const activeTriggerId = store.useState('activeTriggerId');
  const inheritedSubmenuRootContext = useMenuSubmenuRootContext();
  // A dialog's menu can render under a submenu provider; only the actual submenu inherits it.
  // The parent type is fixed for the popup's lifetime.
  const submenuRootContext = parent().type === 'menu' ? inheritedSubmenuRootContext : undefined;

  const [id, registerIdRef] = useRenderedId(
    {
      get id() {
        return local.id;
      },
      get render() {
        return componentProps.render;
      },
    },
    defaultFloatingId,
    setRenderedFloatingId,
  );
  // Only a menu under a filter root bundles the handoff to a filterable parent, including a plain
  // submenu of one. Whether one is above is fixed for a mounted popup.
  const handoff = (useContext(MenuFilterImplContext)?.useParentHandoff ?? useNoParentHandoff)(
    store,
    parent,
    open,
    virtualFocus,
  );

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

  // Read per key by the element props: a change does not rebuild the props chain.
  const popupPropsSource = propsSourceAccessor(() => popupProps());
  const transitionStyles = propsSourceAccessor(() =>
    getDisabledMountTransitionStyles(transitionStatus()),
  );
  const element = useRenderElement('div', componentProps, {
    props: [
      popupPropsSource,
      {
        get id() {
          return id();
        },
        get role() {
          return listElement() ? 'presentation' : 'menu';
        },
        get 'aria-orientation'() {
          return listElement() || orientation() === 'vertical' ? undefined : 'horizontal';
        },
        get 'aria-labelledby'() {
          if (listElement()) {
            return undefined;
          }
          return resolvePopupLabel(
            {
              'aria-label':
                typeof componentProps['aria-label'] === 'string'
                  ? componentProps['aria-label']
                  : undefined,
              'aria-labelledby':
                typeof componentProps['aria-labelledby'] === 'string'
                  ? componentProps['aria-labelledby']
                  : undefined,
              render: componentProps.render,
            },
            activeTriggerElement() ?? null,
            activeTriggerId(),
          );
        },
        onKeyDown(event: KeyboardEvent) {
          submenuRootContext?.onPopupKeyDown?.(event);
          if (insideToolbar() && COMPOSITE_KEYS.has(event.key)) {
            event.stopPropagation();
          }
        },
        // Solid: React's `onFocus` is `focusin`, which also sees focus entering an item.
        onFocusIn() {
          handoff.handleFocus?.();
        },
      },
      transitionStyles,
      elementProps,
      {
        get ['data-rootownerid' as string]() {
          return rootId();
        },
      },
    ],
    ref: [store.context.popupRef, setPopupElement, registerIdRef],
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

  // Internal defaults rather than consumer targets, so focus that already moved is respected.
  const dynamicReturnFocus = submenuRootContext?.getReturnElement ?? handoff.parentVirtualFocusRef;

  const resolvedReturnFocus = createMemo(
    () => local.finalFocus ?? dynamicReturnFocus ?? shouldReturnFocus(),
  );

  const initialFocus = createMemo(() => {
    if (local.initialFocus !== undefined) {
      return local.initialFocus;
    }
    const list = listElement();
    if (list && parent().type !== 'menu') {
      return () => (store.select('activeIndex') !== null ? false : list);
    }
    return parent().type !== 'menu';
  });

  return (
    <FloatingFocusManager
      context={floatingContext}
      openInteractionType={openMethod()}
      modal={isContextMenu()}
      disabled={!mounted()}
      returnFocus={resolvedReturnFocus()}
      explicitReturnFocus={local.finalFocus === undefined && dynamicReturnFocus ? false : undefined}
      initialFocus={initialFocus()}
      restoreFocus
      getInsideElements={
        parent().type === undefined
          ? () => [store.context.beforeTriggerFocusGuardRef.current]
          : undefined
      }
      externalTree={parent().type !== 'menubar' ? floatingTreeRoot() : undefined}
      previousFocusableElement={activeTriggerElement() as HTMLElement | null}
      nextFocusableElement={
        parent().type === undefined ? store.context.triggerFocusTargetRef.current : undefined
      }
      beforeContentFocusGuardRef={store.context.beforeContentFocusGuardRef}
    >
      {element()}
    </FloatingFocusManager>
  );
}

/**
 * A container for the menu items.
 * Renders a `<div>` element.
 */
export function MenuPopup(props: MenuPopup.Props) {
  const Popup = useMenuFilterImpl()?.Popup ?? MenuPopupPlain;
  return <Popup {...props} />;
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
  /**
   * The element to focus when the menu opens. `false` leaves focus where it is.
   */
  initialFocus?:
    boolean | HTMLElement | null | (() => boolean | HTMLElement | null | undefined) | undefined;
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
