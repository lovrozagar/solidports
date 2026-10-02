import { createContext, useContext } from 'solid-js';
import type { UseAnchorPositioningReturnValue } from '../../utils/useAnchorPositioning';

export type MenuPositionerContext = Pick<
  UseAnchorPositioningReturnValue,
  'side' | 'align' | 'arrowRef' | 'arrowUncentered' | 'arrowStyles' | 'context'
>;

export const MenuPositionerContext = createContext<MenuPositionerContext | null>(null);

export function useMenuPositionerContext(optional?: false): MenuPositionerContext;
export function useMenuPositionerContext(optional: true): MenuPositionerContext | null;
export function useMenuPositionerContext(optional?: boolean) {
  const context = useContext(MenuPositionerContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: MenuPositionerContext is missing. MenuPositioner parts must be placed within <Menu.Positioner>.',
    );
  }
  return context;
}
