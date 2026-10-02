import { createSignal } from 'solid-js';
import { createDepsEffect, type MaybeAccessor, access } from '../solid-helpers';
import { ownerDocument } from './owner';
import { useScrollLock } from './useScrollLock';

/* Touch-opened popups normally avoid scroll locking so users can still swipe outside to dismiss.
 * Re-enable scroll lock only when the popup is effectively full-width.
 * Up to 20px total horizontal gutter still counts as full-width (common ~10px side padding). */
const VIEWPORT_WIDTH_TOLERANCE_PX = 20;

export function useAnchoredPopupScrollLock(params: {
  enabled: MaybeAccessor<boolean>;
  touchOpen: MaybeAccessor<boolean>;
  positionerElement: MaybeAccessor<HTMLElement | null | undefined>;
  referenceElement: MaybeAccessor<Element | null | undefined>;
}) {
  const [touchOpenShouldLockScroll, setTouchOpenShouldLockScroll] = createSignal(false);

  createDepsEffect(
    () => ({
      enabled: access(params.enabled),
      touchOpen: access(params.touchOpen),
      positionerEl: access(params.positionerElement) ?? null,
    }),
    ({ enabled, touchOpen, positionerEl }) => {
      if (!enabled || !touchOpen || positionerEl == null) {
        setTouchOpenShouldLockScroll(false);
        return;
      }

      const viewportWidth = ownerDocument(positionerEl).documentElement.clientWidth;
      const popupWidth = positionerEl.offsetWidth;

      setTouchOpenShouldLockScroll(
        viewportWidth > 0 &&
          popupWidth > 0 &&
          popupWidth >= viewportWidth - VIEWPORT_WIDTH_TOLERANCE_PX,
      );
    },
  );

  useScrollLock({
    enabled: () => {
      const enabled = access(params.enabled);
      const touchOpen = access(params.touchOpen);
      return enabled && (!touchOpen || touchOpenShouldLockScroll());
    },
    referenceElement: () => access(params.referenceElement) ?? null,
  });
}
