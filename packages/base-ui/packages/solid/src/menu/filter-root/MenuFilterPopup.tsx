import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { mergeProps } from '../../merge-props';
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

  const openedByHover = createMemo(() => open() && lastOpenChangeReason() === REASONS.triggerHover);
  const mayFocusInput = createMemo(
    () =>
      parent().type !== 'menu' ||
      (open() &&
        (openMethod() === 'keyboard' ||
          lastOpenChangeReason() === REASONS.listNavigation ||
          lastOpenChangeReason() === REASONS.triggerHover ||
          lastOpenChangeReason() === REASONS.triggerPress)),
  );

  // The input holds real focus; the popup is never the focus target.
  const initialFocus = createMemo<MenuPopup.Props['initialFocus']>(() => {
    if (!mayFocusInput()) {
      return false;
    }
    const hoverOpen = openedByHover();
    const method = openMethod();
    return () => {
      // A tap would raise the on-screen keyboard, but a screen reader press (such as an iOS
      // VoiceOver double-tap) still reports a touch and needs the input focused.
      const touchOpen = (method === 'touch' || method === 'pen') && !store.context.virtualPress;
      if (hoverOpen || touchOpen) {
        return false;
      }
      return store.context.virtualFocusRef?.current ?? false;
    };
  });

  const popupProps = mergeProps(interactionProps, props) as MenuPopup.Props;

  return <MenuPopupPlain {...popupProps} role="dialog" initialFocus={initialFocus()} />;
}
