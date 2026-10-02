import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { safePolygon, useClick, useHoverReferenceInteraction } from '../../floating-ui-solid';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { createDepsRenderEffect, splitComponentProps } from '../../solid-helpers';
import { isIOS, isMac } from '../../utils/detectBrowser';
import { EMPTY_OBJECT } from '../../utils/empty';
import { isElementDisabled } from '../../utils/isElementDisabled';
import { useTriggerRegistration } from '../../utils/popups';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { warn } from '../../utils/warn';
import { useMenuItem } from '../item/useMenuItem';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';

// Solid: React reads `platform.screenReader.voiceOver`, which is true on any Apple platform.
const isVoiceOverPlatform = isMac || isIOS;

/**
 * A menu item that opens a submenu.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuSubmenuTrigger(componentProps: MenuSubmenuTrigger.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'label',
    'id',
    'nativeButton',
    'openOnHover',
    'delay',
    'closeDelay',
    'disabled',
  ]);
  const idProp = () => local.id;
  const nativeButton = () => local.nativeButton ?? false;
  const openOnHover = () => local.openOnHover ?? true;
  const delay = () => local.delay ?? 100;
  const closeDelay = () => local.closeDelay ?? 0;
  const disabledProp = () => local.disabled ?? false;

  const submenuRootContext = useMenuSubmenuRootContext();
  if (!submenuRootContext?.parentMenu) {
    throw new Error('Base UI: <Menu.SubmenuTrigger> must be placed in <Menu.SubmenuRoot>.');
  }

  // Solid: no `guess`; Solid has no extra post-mount render for it to avoid.
  const listItem = useCompositeListItem({ label: () => local.label });
  const menuPositionerContext = useMenuPositionerContext();

  const { store } = useMenuRootContext();

  const thisTriggerId = useBaseUiId(idProp);
  const open = store.useState('open');
  const floatingRootContext = store.context.floatingRootContext;
  const floatingTreeRoot = store.useState('floatingTreeRoot');
  const popupId = store.useState('triggerPopupId', thisTriggerId);

  const baseRegisterTrigger = useTriggerRegistration(thisTriggerId, store);
  // Stable, so the merged ref on the rendered element keeps its identity for the trigger's whole
  // lifetime; the latest `closeDelay` is read when it runs.
  const registerTrigger = (element: Element | null | undefined) =>
    untrack(() => {
      baseRegisterTrigger(element);

      if (element != null && store.select('open') && store.select('activeTriggerId') == null) {
        store.update({
          activeTriggerId: thisTriggerId() ?? null,
          activeTriggerElement: element,
          closeDelay: closeDelay(),
        });
      }
    });

  const triggerElementRef = { current: null as HTMLElement | null | undefined };
  // Solid: a signal mirror so the hover hook re-attaches its listeners once the element exists.
  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null | undefined>(null);
  const handleTriggerElementRef = (el: HTMLElement | null | undefined) => {
    triggerElementRef.current = el;
    setTriggerElement(el);
    store.set('activeTriggerElement', el);
  };

  // A stable ref does not re-fire when the id changes, so register the rendered element here
  // instead.
  createDepsRenderEffect(
    () => [thisTriggerId(), store],
    () => {
      registerTrigger(triggerElementRef.current);
      return () => registerTrigger(null);
    },
  );

  store.useSyncedValue('closeDelay', closeDelay);

  const parentMenuStore = submenuRootContext.parentMenu;
  const rootDisabled = store.useState('disabled');
  const parentDisabled = parentMenuStore.useState('disabled');
  const disabled = createMemo(() => disabledProp() || rootDisabled() || parentDisabled());

  if (process.env.NODE_ENV !== 'production') {
    // Solid: React checks after every render; check whenever `disabled` changes.
    createEffect(disabled, (isDisabled) => {
      const element = triggerElementRef.current;
      if (element && isElementDisabled(element) && !isDisabled) {
        warn(
          'A disabled element was detected on <Menu.SubmenuTrigger>. To properly disable the trigger, use the `disabled` prop on the component instead of setting it on the rendered element.',
        );
      }
    });
  }

  const itemProps = parentMenuStore.useState('itemProps');
  const highlighted = parentMenuStore.useState('isActive', listItem.index);

  const itemMetadata = () => ({
    type: 'submenu-trigger' as const,
    setActive() {
      if (parentMenuStore.select('highlightItemOnHover')) {
        parentMenuStore.set('activeIndex', untrack(listItem.index));
      }
    },
  });

  const { getItemProps, setItemRef } = useMenuItem({
    closeOnClick: false,
    disabled,
    highlighted,
    id: thisTriggerId,
    store,
    typingRef: parentMenuStore.context.typingRef,
    nativeButton,
    itemMetadata,
    nodeId: () => menuPositionerContext?.context.nodeId(),
  });

  const hoverEnabled = store.useState('hoverEnabled');

  const hoverProps = useHoverReferenceInteraction({
    context: floatingRootContext,
    props: {
      get enabled() {
        return hoverEnabled() && openOnHover() && !disabled();
      },
      handleClose: safePolygon({ blockPointerEvents: true }),
      mouseOnly: true,
      move: true,
      get restMs() {
        return delay();
      },
      get delay() {
        return { open: delay(), close: closeDelay() };
      },
      get shouldOpen() {
        return delay() > 0 ? () => parentMenuStore.select('allowMouseEnter') : undefined;
      },
      get triggerElementRef() {
        return triggerElement();
      },
      get externalTree() {
        return floatingTreeRoot();
      },
      isClosing: () => store.select('transitionStatus') === 'ending',
      // Chrome can drop the trigger's `mouseleave` during a fast pointer sweep,
      // leaving a stale submenu open (see #5152) — cancel from `mouseout` too.
      guardStaleOpen: true,
    },
  });

  const click = useClick({
    context: floatingRootContext,
    props: {
      get enabled() {
        return !disabled();
      },
      event: 'mousedown',
      get toggle() {
        return !openOnHover();
      },
      get ignoreMouse() {
        return openOnHover();
      },
      stickIfOpen: false,
    },
  });

  const localInteractionProps = () => click.reference ?? EMPTY_OBJECT;

  const rootTriggerProps = createMemo(() => {
    const { id: _id, ...rest } = store.select('triggerProps', () => true) as HTMLProps;
    return rest;
  });

  const state: MenuSubmenuTrigger.State = {
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
    get open() {
      return open();
    },
  };

  const openMethod = store.useState('openMethod');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');
  // Arrow keys open the submenu through list navigation without dispatching a click, so
  // `openMethod` stays null there; Enter and Space do dispatch one and report `keyboard`.
  const openedByKeyboard = () =>
    lastOpenChangeReason() === REASONS.listNavigation || openMethod() === 'keyboard';
  const shouldOmitExpanded = () => open() && openedByKeyboard() && isVoiceOverPlatform;

  const element = useRenderElement('div', componentProps, {
    state,
    stateAttributesMapping: triggerOpenStateMapping,
    get props() {
      const expandedProps = rootTriggerProps();
      return [
        localInteractionProps(),
        hoverProps,
        // Opening a submenu changes the trigger's expanded state while the trigger still holds
        // focus, and VoiceOver announces that state change instead of the submenu item that focus
        // moves to a moment later, so the first item is never announced. Dropping the state while
        // the submenu is open avoids the announcement without claiming the submenu is collapsed;
        // `aria-haspopup` still conveys that the item opens a submenu.
        // Solid: a later `undefined` would not remove the key, so it is omitted instead.
        shouldOmitExpanded() ? omitExpanded(expandedProps) : expandedProps,
        itemProps(),
        {
          'aria-controls': popupId(),
          tabindex: open() || highlighted() ? 0 : -1,
          onBlur() {
            if (highlighted()) {
              parentMenuStore.set('activeIndex', null);
            }
          },
        },
        elementProps,
        getItemProps,
      ];
    },
    ref: [listItem.setRef, setItemRef, registerTrigger, handleTriggerElementRef],
  });

  return <>{element()}</>;
}

function omitExpanded(props: HTMLProps) {
  const { 'aria-expanded': _expanded, ...rest } = props;
  return rest;
}

export interface MenuSubmenuTriggerState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
}

export interface MenuSubmenuTriggerProps
  extends NonNativeButtonProps, BaseUIComponentProps<'div', MenuSubmenuTriggerState> {
  onClick?: BaseUIComponentProps<'div', MenuSubmenuTriggerState>['onClick'] | undefined;
  /**
   * Overrides the text label to use when the item is matched during keyboard text navigation.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * How long to wait before the menu may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the menu that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * Whether the menu should also open when the trigger is hovered.
   * @default true
   */
  openOnHover?: boolean | undefined;
}

export namespace MenuSubmenuTrigger {
  export type Props = MenuSubmenuTriggerProps;
  export type State = MenuSubmenuTriggerState;
}
