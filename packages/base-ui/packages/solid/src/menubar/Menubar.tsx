/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createMemo, createSignal, onSettled, untrack } from 'solid-js';
import type { ParentProps } from 'solid-js';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { FloatingNode, FloatingTree, useFloatingNodeId } from '../floating-ui-solid';
import { type MenuRoot } from '../menu/root/MenuRoot';
import { splitComponentProps, useRef } from '../solid-helpers';
import { StateAttributesMapping } from '../utils/getStateAttributesProps';
import { BaseUIComponentProps } from '../utils/types';
import { useBaseUiId } from '../utils/useBaseUiId';
import { REASONS } from '../utils/reasons';
import { MenubarContext, type MenubarMenu } from './MenubarContext';
import { MenubarDataAttributes } from './MenubarDataAttributes';

const menubarStateAttributesMapping: StateAttributesMapping<Menubar.State> = {
  hasSubmenuOpen(value) {
    return value ? { [MenubarDataAttributes.hasSubmenuOpen]: '' } : null;
  },
};

/**
 * The container for menus.
 *
 * Documentation: [Base UI Menubar](https://base-ui.com/react/components/menubar)
 */
export function Menubar(props: Menubar.Props) {
  const [renderProps, local, elementProps] = splitComponentProps(props, [
    'orientation',
    'loopFocus',
    'modal',
    'disabled',
    'id',
    'children',
  ]);
  const orientation = () => local.orientation ?? 'horizontal';
  const loopFocus = () => local.loopFocus ?? true;
  const modal = () => local.modal ?? true;
  const disabled = () => Boolean(local.disabled);
  const idProp = () => local.id;

  const [contentElement, setContentElement] = createSignal<HTMLElement | null | undefined>();
  // Solid: derived from the top-level menus, which register themselves. React sets it from the
  // `menuopenchange` tree events its menus emit from effects. A menu opening sets it; a close
  // clears it unless the close hands over to another menu (moving along the bar).
  const [menus, setMenus] = createSignal<readonly MenubarMenu[]>([], { ownedWrite: true });
  function registerMenu(menu: MenubarMenu) {
    onSettled(() => {
      setMenus((current) => [...current, menu]);
      return () => setMenus((current) => current.filter((item) => item !== menu));
    });
  }
  const submenuState = createMemo<{ open: boolean; openMenus: readonly MenubarMenu[] }>((prev) => {
    const openMenus = menus().filter((menu) => menu.open());
    if (openMenus.length > 0) {
      return { open: true, openMenus };
    }
    const closed = prev?.openMenus ?? [];
    const handedOver = closed.every((menu) => {
      const reason = untrack(menu.lastOpenChangeReason);
      return reason === REASONS.siblingOpen || reason === REASONS.listNavigation;
    });
    return { open: handedOver ? (prev?.open ?? false) : false, openMenus };
  });
  const hasSubmenuOpen = createMemo(() => submenuState().open);
  const allowMouseUpTriggerRef = useRef(false);

  const id = useBaseUiId(idProp);

  const state: Menubar.State = {
    get hasSubmenuOpen() {
      return hasSubmenuOpen();
    },
    get modal() {
      return modal();
    },
    get orientation() {
      return orientation();
    },
  };

  const context: MenubarContext = {
    allowMouseUpTriggerRef,
    contentElement,
    disabled,
    hasSubmenuOpen,
    modal,
    orientation,
    registerMenu,
    rootId: id,
    setContentElement,
  };

  return (
    <MenubarContext value={context}>
      <FloatingTree>
        <MenubarContent>
          <CompositeRoot
            render={renderProps.render}
            class={renderProps.class}
            state={state}
            stateAttributesMapping={menubarStateAttributesMapping}
            refs={[
              (el) => {
                if (typeof props.ref === 'function') {
                  props.ref(el as HTMLDivElement);
                } else {
                  // eslint-disable-next-line solid/reactivity
                  props.ref = el as any;
                }
              },
              setContentElement,
            ]}
            props={[{ role: 'menubar', id: id(), 'aria-orientation': orientation() }, elementProps]}
            orientation={orientation()}
            loopFocus={loopFocus()}
            enableHomeAndEndKeys
            highlightItemOnHover={hasSubmenuOpen()}
          >
            {local.children}
          </CompositeRoot>
        </MenubarContent>
      </FloatingTree>
    </MenubarContext>
  );
}

function MenubarContent(props: ParentProps) {
  const nodeId = useFloatingNodeId();
  return <FloatingNode id={nodeId()}>{props.children}</FloatingNode>;
}

export interface MenubarState {
  /**
   * The orientation of the menubar.
   */
  orientation: MenuRoot.Orientation;
  /**
   * Whether the menubar is modal.
   */
  modal: boolean;
  /**
   * Whether any submenu within the menubar is open.
   */
  hasSubmenuOpen: boolean;
}

export interface MenubarProps extends BaseUIComponentProps<'div', Menubar.State> {
  /**
   * Whether the menubar is modal.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Whether the whole menubar is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The orientation of the menubar.
   * @default 'horizontal'
   */
  orientation?: MenuRoot.Orientation | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace Menubar {
  export type State = MenubarState;
  export type Props = MenubarProps;
}
