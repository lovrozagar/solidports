import { createMemo, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isStaticKey, splitComponentProps, provideContext } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { provideNativeContext } from '../../utils/native/context';
import { renderNativeElement } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { createBaseUiId, useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import type { NavigationMenuItemContextValue } from './NavigationMenuItemContext';
import { NavigationMenuItemContext } from './NavigationMenuItemContext';

const LI = { tag: 'li', create: () => (<li />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set(['value']);

/**
 * An individual navigation menu item.
 * Renders a `<li>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuItem(componentProps: NavigationMenuItem.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<li>` that provides its
  // value, no props view (D32). A static `value` (absent or literal) is read once: a constant
  // accessor, no memo. The generated id is taken either way, as the slow path's is, so hydration
  // ids stay aligned.
  if (canRenderNative(componentProps, undefined, true)) {
    const fallbackValue = createBaseUiId();
    let value: () => unknown;
    if (!('value' in componentProps) || isStaticKey(componentProps, 'value')) {
      const staticValue = untrack(() => componentProps.value) ?? fallbackValue;
      value = () => staticValue;
    } else {
      value = createMemo(() => componentProps.value ?? fallbackValue);
    }
    const contextValue: NavigationMenuItemContextValue = { value };
    return provideNativeContext(NavigationMenuItemContext, contextValue, () =>
      renderNativeElement(LI, componentProps, { own: OWN_KEYS, reactive: false }),
    ) as unknown as JSX.Element;
  }

  const [, local, elementProps] = splitComponentProps(componentProps, ['value']);
  const valueProp = () => local.value;

  const fallbackValue = useBaseUiId();
  const value = createMemo(() => valueProp() ?? fallbackValue());

  const contextValue: NavigationMenuItemContextValue = { value };

  const element = useRenderElement('li', componentProps, { props: elementProps });

  return provideContext(NavigationMenuItemContext, contextValue, element);
}

export interface NavigationMenuItemState {}

export interface NavigationMenuItemProps extends BaseUIComponentProps<
  'li',
  NavigationMenuItem.State
> {
  /**
   * A unique value that identifies this navigation menu item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the navigation menu programmatically.
   */
  value?: any;
}

export namespace NavigationMenuItem {
  export type State = NavigationMenuItemState;
  export type Props = NavigationMenuItemProps;
}
