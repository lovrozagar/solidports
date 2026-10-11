import type { JSX } from '@solidjs/web';
import { REASONS } from '../../utils/reasons';
import { useMenuRootContext } from '../root/MenuRootContext';
import { MenuPopupPlain } from '../popup/MenuPopup';
import type { MenuPopup } from '../popup/MenuPopup';
import { useMenuFilterPopup } from './useMenuFilterPopup';

/**
 * A container for the filter input and item list.
 * Renders a `<div>` element with a `dialog` role.
 */
export function MenuFilterPopup(props: MenuPopup.Props): JSX.Element {
  const { store, orientation } = useMenuRootContext();
  const open = store.useState('open');
  const parent = store.useState('parent');
  const openMethod = store.useState('openMethod');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');
  const interactionProps = useMenuFilterPopup(orientation);

  const openedByHover = () => open() && lastOpenChangeReason() === REASONS.triggerHover;
  const mayFocusInput = () =>
    parent().type !== 'menu' ||
    (open() &&
      (openMethod() === 'keyboard' ||
        lastOpenChangeReason() === REASONS.listNavigation ||
        lastOpenChangeReason() === REASONS.triggerHover ||
        lastOpenChangeReason() === REASONS.triggerPress));

  const initialFocus = () => {
    if (!mayFocusInput()) {
      return false;
    }
    return () => {
      const touchOpen =
        (openMethod() === 'touch' || openMethod() === 'pen') && !store.context.virtualPress;
      if (openedByHover() || touchOpen) {
        return false;
      }
      return store.context.virtualFocusRef?.current ?? false;
    };
  };

  return (
    <MenuPopupPlain
      {...({
        ...interactionProps,
        ...props,
        role: 'dialog',
        initialFocus: initialFocus(),
      } as MenuPopup.Props)}
    />
  );
}
