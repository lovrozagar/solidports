import { createSignal, untrack } from 'solid-js';
import { access, type MaybeAccessor } from '../solid-helpers';
import { isIOS } from './detectBrowser';
import { InteractionType, useEnhancedClickHandler } from './useEnhancedClickHandler';

export function useOpenMethodTriggerProps(
  open: MaybeAccessor<boolean>,
  setOpenMethod: (interactionType: InteractionType | null) => void,
) {
  // Solid: a plain handler reads the latest `open` (React's stable callback).
  const handleTriggerClick = (_: MouseEvent, interactionType: InteractionType) => {
    const isOpen = untrack(() => access(open));

    if (!isOpen) {
      setOpenMethod(
        interactionType ||
          // On iOS Safari, the hitslop around touch targets means tapping outside an element's
          // bounds does not fire `pointerdown` but does fire `mousedown`. The `interactionType`
          // will be "" in that case.
          (isIOS ? 'touch' : ''),
      );
    }
  };

  const { onClick, onPointerDown } = useEnhancedClickHandler(handleTriggerClick);

  return {
    onClick,
    onPointerDown,
  };
}

/**
 * Determines the interaction type (keyboard, mouse, touch, etc.) that opened the component.
 *
 * @param open The open state of the component.
 */
export function useOpenInteractionType(open: MaybeAccessor<boolean>) {
  // React clears the method in an effect once closed. Solid derives it: the trigger's write stands
  // while open, and closing resets it in the same flush.
  const [openMethod, setOpenMethod] = createSignal<InteractionType | null>((prev) =>
    access(open) ? (prev ?? null) : null,
  );

  const triggerProps = useOpenMethodTriggerProps(open, (method) => setOpenMethod(method));

  return {
    openMethod,
    triggerProps,
  };
}
