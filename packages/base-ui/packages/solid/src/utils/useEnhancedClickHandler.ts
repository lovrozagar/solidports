export type InteractionType = 'mouse' | 'touch' | 'pen' | 'keyboard' | '';

const POINTER_TYPES = new Set(['mouse', 'touch', 'pen']);

/**
 * Provides a cross-browser way to determine the type of the pointer used to click.
 * Safari and Firefox do not provide the PointerEvent to the click handler (they use MouseEvent) yet.
 * Additionally, this implementation detects if the click was triggered by the keyboard.
 *
 * @param handler The function to be called when the button is clicked. The first parameter is the original event and the second parameter is the pointer type.
 */
export function useEnhancedClickHandler(
  handler: (event: MouseEvent | PointerEvent, interactionType: InteractionType) => void,
) {
  let lastClickInteractionTypeRef: InteractionType = '';

  const handlePointerDown = (event: PointerEvent) => {
    if (event.defaultPrevented) {
      return;
    }

    lastClickInteractionTypeRef = event.pointerType as InteractionType;
    handler(event, event.pointerType as InteractionType);
  };

  const handleClick = (event: MouseEvent | PointerEvent) => {
    // event.detail has the number of clicks performed on the element. 0 means it was triggered by the keyboard.
    if (event.detail === 0) {
      handler(event, 'keyboard');
      return;
    }

    // Solid: the handler sees the native event. React's synthetic click is a MouseEvent without
    // `pointerType`, so it always reports the pointerdown type; prefer that too. A native
    // PointerEvent click (Chrome and Edge) only fills in when no pointerdown was seen, and only
    // with a real pointer type (synthetic clicks can carry an empty or bogus one).
    const nativePointerType = 'pointerType' in event ? event.pointerType : '';
    handler(
      event,
      lastClickInteractionTypeRef ||
        (POINTER_TYPES.has(nativePointerType) ? (nativePointerType as InteractionType) : ''),
    );

    lastClickInteractionTypeRef = '';
  };

  return { onClick: handleClick, onPointerDown: handlePointerDown };
}
