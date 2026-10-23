import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import type { NavigationMenuItemContextValue } from '../item/NavigationMenuItemContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { NavigationMenuRootContext } from '../root/NavigationMenuRootContext';

const SPAN = { tag: 'span', create: () => (<span />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set();
const ICON: Record<string, unknown> = { 'aria-hidden': 'true' };
const ARROW = () => '▼';
const writeIconState = compileStateWriter(['open'], triggerOpenStateMapping);

/** The icon's state: open while its item is the open one. One object per icon, no closures. */
class NativeIconState implements NavigationMenuIcon.State {
  declare private readonly root: NavigationMenuRootContext;
  declare private readonly item: NavigationMenuItemContextValue;

  constructor(root: NavigationMenuRootContext, item: NavigationMenuItemContextValue) {
    this.root = root;
    this.item = item;
  }

  get open() {
    return this.root.open() && this.root.value() === this.item.value();
  }
}

const iconState = (state: NativeIconState) => state;

/**
 * An icon that indicates that the trigger button opens a menu.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuIcon(componentProps: NavigationMenuIcon.Props): JSX.Element {
  const item = useNavigationMenuItemContext();
  const root = useNavigationMenuRootContext();

  // Native fast path (`context/architecture/render-pipeline.md`): a `<span aria-hidden>` with its
  // open state and the default arrow unless the consumer passes children (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    const state = new NativeIconState(root, item);
    return renderNativeElement(SPAN, componentProps, {
      own: OWN_KEYS,
      literal: ICON,
      state: iconState,
      stateView: state,
      stateWriter: writeIconState,
      handlerTarget: state,
      reactive: true,
      children: 'children' in componentProps ? undefined : ARROW,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { value: itemValue } = item;
  const { open, value } = root;

  const isActiveItem = () => open() && value() === itemValue();

  const state: NavigationMenuIcon.State = {
    get open() {
      return isActiveItem();
    },
  };

  const element = useRenderElement('span', componentProps, {
    props: [{ 'aria-hidden': 'true', children: '▼' }, elementProps],
    state,
    stateAttributesMapping: triggerOpenStateMapping,
  });

  return element() as JSX.Element;
}

export interface NavigationMenuIconState {
  /**
   * Whether the navigation menu is open and the item is active.
   */
  open: boolean;
}

export interface NavigationMenuIconProps extends BaseUIComponentProps<
  'span',
  NavigationMenuIcon.State
> {}

export namespace NavigationMenuIcon {
  export type State = NavigationMenuIconState;
  export type Props = NavigationMenuIconProps;
}
