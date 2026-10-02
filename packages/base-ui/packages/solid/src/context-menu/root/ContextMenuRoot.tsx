import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Menu } from '../../menu';
import type { MenuRoot } from '../../menu/root/MenuRoot';
import { MenuRootContext } from '../../menu/root/MenuRootContext';
import { useRef } from '../../solid-helpers';
import type { BaseUIChangeEventDetails } from '../../types';
import { useId } from '../../utils/useId';
import { ContextMenuRootContext } from './ContextMenuRootContext';

/**
 * A component that creates a context menu activated by right clicking or long pressing.
 * Doesn’t render its own HTML element.
 *
 * Documentation: [Base UI Context Menu](https://base-ui.com/react/components/context-menu)
 */
export function ContextMenuRoot(props: ContextMenuRoot.Props) {
  /* anchor must be a signal so each right-click produces a new reference — Solid's reactivity won't refire the floating-ui positioning effects on object mutation alone, only on identity change. Mirrors React's `useState` anchor. */
  const [anchor, setAnchor] = createSignal<{ getBoundingClientRect: () => DOMRect }>({
    getBoundingClientRect() {
      return DOMRect.fromRect({ height: 0, width: 0, x: 0, y: 0 });
    },
  });

  const backdropRef = useRef<HTMLDivElement | null | undefined>(null);
  const internalBackdropRef = useRef<HTMLDivElement | null | undefined>(null);
  const actionsRef = useRef<{
    setOpen: (nextOpen: boolean, eventDetails: ContextMenuRoot.ChangeEventDetails) => void;
  } | null>(null);
  const positionerRef = useRef<HTMLElement | null | undefined>(null);
  const allowMouseUpTriggerRef = useRef<boolean>(true);
  const initialCursorPointRef = useRef<{ x: number; y: number } | null>(null);

  const id = useId();

  const contextValue: ContextMenuRootContext = {
    actionsRef,
    allowMouseUpTriggerRef,
    anchor,
    backdropRef,
    initialCursorPointRef,
    internalBackdropRef,
    positionerRef,
    rootId: id,
    setAnchor,
  };

  return (
    <ContextMenuRootContext value={contextValue}>
      <MenuRootContext value={null}>
        <Menu.Root {...props} />
      </MenuRootContext>
    </ContextMenuRootContext>
  );
}

export interface ContextMenuRootState {}

export interface ContextMenuRootProps extends Omit<
  Menu.Root.Props,
  // Context Menu has no detached-trigger support (it opens from a right-click/long-press
  // area, not a registered trigger), so these inherited props are not applicable.
  | 'handle'
  | 'triggerId'
  | 'defaultTriggerId'
  | 'modal'
  | 'openOnHover'
  | 'delay'
  | 'closeDelay'
  | 'closeParentOnEsc'
  | 'onOpenChange'
  // Context Menu opens from a pointer position rather than a registered trigger, so the
  // render-function form of `children` (which receives the active trigger's payload) is not applicable.
  | 'children'
> {
  /**
   * Event handler called when the menu is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: ContextMenuRoot.ChangeEventDetails) => void) | undefined;
  /**
   * @ignore
   * @deprecated This prop has no effect on Context Menu.
   */
  closeParentOnEsc?: Menu.Root.Props['closeParentOnEsc'] | undefined;
  children?: JSX.Element | undefined;
}

export type ContextMenuRootActions = MenuRoot.Actions;
export type ContextMenuRootChangeEventReason = MenuRoot.ChangeEventReason;
export type ContextMenuRootChangeEventDetails =
  BaseUIChangeEventDetails<ContextMenuRoot.ChangeEventReason>;

export namespace ContextMenuRoot {
  export type State = ContextMenuRootState;
  export type Props = ContextMenuRootProps;
  export type Actions = ContextMenuRootActions;
  export type ChangeEventReason = ContextMenuRootChangeEventReason;
  export type ChangeEventDetails = ContextMenuRootChangeEventDetails;
}
