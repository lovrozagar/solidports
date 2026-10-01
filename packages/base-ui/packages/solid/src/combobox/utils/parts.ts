import { createMemo } from 'solid-js';
import { useComboboxDerivedItemsContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';
import type { Side } from '../../utils/useAnchorPositioning';

/**
 * The popup side is only meaningful while the positioner is mounted, as the store retains the
 * last resolved side after the popup unmounts.
 */
export function usePopupSide(store: ComboboxStore) {
  const mounted = store.useSelector('mounted');
  const popupSide = store.useState('popupSide');
  const positionerElement = store.useState('positionerElement');

  return createMemo(() => (mounted() && positionerElement() ? popupSide() : null) as Side | null);
}

/**
 * Whether the filtered list has no items to show.
 */
export function useListEmpty() {
  const { filteredItems } = useComboboxDerivedItemsContext();
  return createMemo(() => filteredItems().length === 0);
}

/**
 * The arrow keys that move the chip highlight backwards and forwards, in that order.
 */
export function getChipNavigationKeys(direction: 'ltr' | 'rtl') {
  return direction === 'rtl'
    ? (['ArrowRight', 'ArrowLeft'] as const)
    : (['ArrowLeft', 'ArrowRight'] as const);
}

/**
 * Where the highlight lands once the chip at `index` is removed, or `undefined` for no highlight.
 */
export function getIndexAfterChipRemoval(index: number, chipCount: number) {
  const nextIndex = index >= chipCount - 1 ? chipCount - 2 : index;
  return nextIndex >= 0 ? nextIndex : undefined;
}

/**
 * Commits the highlighted item by clicking it, tagging the originating event so the item's
 * handler can attribute the selection to it.
 */
export function clickHighlightedItem(
  store: ComboboxStore,
  activeIndex: number,
  nativeEvent: KeyboardEvent,
) {
  const listItem = store.context.listRef[activeIndex];

  if (listItem) {
    store.set('selectionEventRef', nativeEvent);
    listItem.click();
    store.set('selectionEventRef', null);
  }
}
