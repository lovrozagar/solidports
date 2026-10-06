/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { access, MaybeAccessor, useRef } from '../../solid-helpers';
import { useButton } from '../../internals/use-button';
import type { UseButtonSources } from '../../internals/use-button/useButton';
import { MenuStore } from '../store/MenuStore';
import { useMenuItemCommonProps } from './useMenuItemCommonProps';

export const REGULAR_ITEM = {
  type: 'regular-item' as const,
};

export function useMenuItem(params: useMenuItem.Parameters): useMenuItem.ReturnValue {
  const closeOnClick = () => access(params.closeOnClick);
  const disabled = () => access(params.disabled) ?? false;
  const highlighted = () => access(params.highlighted);
  const id = () => access(params.id);
  const nativeButton = () => access(params.nativeButton);
  const itemMetadata = () => access(params.itemMetadata);
  const nodeId = () => access(params.nodeId);
  const typingRef = () => access(params.typingRef) ?? params.store.context.typingRef;

  const itemRef = useRef<HTMLElement | null | undefined>(null);

  const { buttonSources, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
    composite: true,
  });

  const commonProps = useMenuItemCommonProps({
    get closeOnClick() {
      return closeOnClick();
    },
    get highlighted() {
      return highlighted();
    },
    get id() {
      return id();
    },
    get itemMetadata() {
      return itemMetadata();
    },
    get itemRef() {
      return itemRef;
    },
    get nodeId() {
      return nodeId();
    },
    get store() {
      return params.store;
    },
    get typingRef() {
      return typingRef();
    },
  });

  // Plain sources (plan 7 step 3.4): the button's attributes and the item's common props below the
  // part's props, the button's handlers above them (wrapping, as `getButtonProps` did).
  const itemSources: useMenuItem.Sources = {
    attributes: [
      ...buttonSources.attributes,
      commonProps,
      {
        onMouseEnter() {
          const metadata = itemMetadata();
          if (metadata.type !== 'submenu-trigger') {
            return;
          }

          metadata.setActive();
        },
      },
    ],
    handlers: buttonSources.handlers,
  };

  return {
    itemSources,
    setItemRef: (el) => {
      itemRef.current = el;
      buttonRef(el);
    },
  };
}

export interface UseMenuItemParameters {
  /**
   * Whether to close the menu when the item is clicked.
   */
  closeOnClick: MaybeAccessor<boolean>;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: MaybeAccessor<boolean>;
  /**
   * Determines if the menu item is highlighted.
   */
  highlighted: MaybeAccessor<boolean>;
  /**
   * The id of the menu item.
   */
  id: MaybeAccessor<string | undefined>;
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `false` if the rendered element is not a button (e.g. `<div>`).
   * @default false
   */
  nativeButton: MaybeAccessor<boolean>;
  /**
   * Additional data specific to the item type.
   */
  itemMetadata: MaybeAccessor<UseMenuItemMetadata>;
  /**
   * The node id of the menu positioner.
   */
  nodeId: MaybeAccessor<string | undefined>;
  /**
   * Whether a typeahead session is in progress.
   * @default store.context.typingRef
   */
  typingRef?: MaybeAccessor<import('../../solid-helpers').ReactLikeRef<boolean> | undefined>;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
}

export type UseMenuItemMetadata =
  | typeof REGULAR_ITEM
  | {
      type: 'submenu-trigger';
      setActive: () => void;
    };

export interface UseMenuItemSources {
  /** Sources below the part's own props. */
  attributes: readonly object[];
  /** The button's handlers, above the part's props (they wrap the lower-priority handlers). */
  handlers: UseButtonSources['handlers'];
}

export interface UseMenuItemReturnValue {
  /**
   * The root slot's props as sources: `attributes` first, then the part's props, then `handlers`.
   */
  itemSources: UseMenuItemSources;
  /**
   * The ref to the component's root DOM element.
   */
  setItemRef: (el: HTMLElement | null | undefined) => void;
}

export namespace useMenuItem {
  export type Parameters = UseMenuItemParameters;
  export type Metadata = UseMenuItemMetadata;
  export type ReturnValue = UseMenuItemReturnValue;
  export type Sources = UseMenuItemSources;
}
