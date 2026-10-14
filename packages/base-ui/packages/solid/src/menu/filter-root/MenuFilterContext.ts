import { createContext, untrack, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { ReactLikeRef } from '../../solid-helpers';
import type { HTMLProps } from '../../utils/types';
import { MenuRootContext } from '../root/MenuRootContext';
import type { MenuParent } from '../root/MenuRoot';
import type { MenuStore } from '../store/MenuStore';
import type { MenuFilterPopup } from './MenuFilterPopup';
import type { MenuFilterGroup, MenuFilterRadioGroup } from './MenuFilterGroup';
import type { MenuFilterList } from './MenuFilterList';

export interface MenuFilterItemParams {
  label?: Accessor<string | undefined> | string | undefined;
  children?: Accessor<unknown> | unknown;
  render?: Accessor<unknown> | unknown;
}

export interface MenuFilterItemResult {
  /** Whether the item matches the query. A hidden item renders nothing. */
  visible: Accessor<boolean>;
  /** Registers the element with the filter. */
  ref: ReactLikeRef<HTMLElement | null> | null;
  /** Props the filter needs on the element, merged under the consumer's. */
  props?: HTMLProps | undefined;
  /**
   * The item's children, resolved once and owned by the item. Solid: reading JSX children creates
   * them, so the item renders these and the filter reads a filtered-out item's text from them.
   */
  children?: Accessor<unknown> | undefined;
}

/**
 * The item's props with the children its filter resolved, when the item filters. Only `children`
 * is overridden; every other key keeps its own descriptor.
 */
export function withFilterChildren<P extends object>(
  props: P,
  filterItem: MenuFilterItemResult,
): P {
  const resolved = filterItem.children;
  if (!resolved) {
    return props;
  }
  return new Proxy(props, {
    get(target, key, receiver) {
      return key === 'children' ? resolved() : Reflect.get(target, key, receiver);
    },
    has(target, key) {
      return key === 'children' || Reflect.has(target, key);
    },
    getOwnPropertyDescriptor(target, key) {
      if (key === 'children') {
        return { configurable: true, enumerable: true, get: resolved };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
    ownKeys(target) {
      const keys = Reflect.ownKeys(target);
      return keys.includes('children') ? keys : [...keys, 'children'];
    },
  });
}

/**
 * The filter implementation that a filterable root hands to the parts below it. Only the roots
 * `Menu.FilterProvider` renders import it, so a plain menu never bundles it.
 */
export interface MenuFilterImpl {
  Popup: typeof MenuFilterPopup;
  List: typeof MenuFilterList;
  Group: typeof MenuFilterGroup;
  RadioGroup: typeof MenuFilterRadioGroup;
  useItem: (params: MenuFilterItemParams) => MenuFilterItemResult;
  useSubmenuTrigger: (params: MenuFilterItemParams) => MenuFilterItemResult;
  useParentHandoff: (
    store: MenuStore<unknown>,
    parent: Accessor<MenuParent>,
    open: Accessor<boolean>,
    virtualFocus: Accessor<boolean>,
  ) => MenuFilterParentHandoff;
}

export interface MenuFilterParentHandoff {
  /** The filterable parent's input, which the closing submenu returns focus to. */
  parentVirtualFocusRef: ReactLikeRef<HTMLElement | null> | undefined;
  handleFocus: (() => void) | undefined;
}

/** Static below a filter root: the implementation never changes. */
export const MenuFilterImplContext = createContext<MenuFilterImpl | null>(null);

export type MenuFilterPartScope =
  /** The part belongs to the nearest root. */
  | 'root'
  /** The part is an item of the parent list but renders inside its own submenu root. */
  | 'submenu-trigger';

/**
 * The filter implementation when the menu this part belongs to is filterable, otherwise `null`.
 * `virtualFocus` marks a filter root; a plain `Menu.Root` never sets it. The result is fixed for
 * a mounted part: a filter root can't appear above it without remounting it.
 */
export function useMenuFilterImpl(scope: MenuFilterPartScope = 'root'): MenuFilterImpl | null {
  const impl = useContext(MenuFilterImplContext);
  const root = useContext(MenuRootContext);

  if (impl === null || root == null) {
    return null;
  }

  // Fixed for a mounted part. Read once so the component body does not subscribe.
  const filterable = untrack(() =>
    scope === 'submenu-trigger'
      ? root.virtualFocus() || root.parentVirtualFocus()
      : root.virtualFocus(),
  );
  return filterable ? impl : null;
}

/**
 * Throws unless the menu this part renders in is filterable, naming the part and the provider.
 */
export function useMenuFilterPart(part: string) {
  if (useMenuFilterImpl() === null) {
    throw new Error(
      `Base UI: <Menu.${part}> must be placed in a menu wrapped in <Menu.FilterProvider>. ` +
        'It reads the filter query and the matching items from the provider, which a plain menu ' +
        'does not have. Wrap the <Menu.Root> or <Menu.SubmenuRoot> it belongs to in ' +
        '<Menu.FilterProvider>. See https://base-ui.com/react/components/menu#filtering',
    );
  }
}

const UNFILTERED: MenuFilterItemResult = { visible: () => true, ref: null };

function useUnfilteredItem(): MenuFilterItemResult {
  return UNFILTERED;
}

/**
 * Registers an item part with the filter of the menu it belongs to. A plain menu's items are
 * always visible.
 */
export function useMenuFilterItem(
  props: MenuFilterItemParams,
  scope: MenuFilterPartScope = 'root',
): MenuFilterItemResult {
  const impl = useMenuFilterImpl(scope);
  const useItem =
    (scope === 'submenu-trigger' ? impl?.useSubmenuTrigger : impl?.useItem) ?? useUnfilteredItem;
  return useItem(props);
}
