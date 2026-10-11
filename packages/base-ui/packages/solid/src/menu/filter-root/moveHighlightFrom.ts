import { EMPTY_ARRAY } from '../../utils/empty';
import { REASONS } from '../../utils/reasons';
import {
  getMaxListIndex,
  getMinListIndex,
  getNextListIndex,
} from '../../floating-ui-solid/utils/composite';
import { isMainOrientationToEndKey } from '../../floating-ui-solid/hooks/useListNavigation';
import type { MenuRoot } from '../root/MenuRoot';
import type { MenuStore } from '../store/MenuStore';

/**
 * Moves a menu's highlight from `item` one step in the direction of a main-orientation arrow key,
 * with the same step as the menu's own list navigation, and returns the newly highlighted item.
 * A step that would leave a menu whose navigation escapes to its input keeps the highlight.
 */
export function moveHighlightFrom(
  store: MenuStore<unknown>,
  item: HTMLElement,
  event: KeyboardEvent,
  options: MoveHighlightOptions,
): HTMLElement | undefined {
  const { orientation, rtl, loopFocus, allowEscape } = options;
  const items = store.context.itemDomElements.current;
  const { index } = getNextListIndex(items, items.indexOf(item), {
    decrement: !isMainOrientationToEndKey(event.key, orientation, rtl),
    loopFocus,
    allowEscape,
    disabledIndices: EMPTY_ARRAY,
    minIndex: getMinListIndex(items, EMPTY_ARRAY),
    maxIndex: getMaxListIndex(items, EMPTY_ARRAY),
  });

  const next = items[index];
  if (next) {
    store.setActiveIndex(index, REASONS.keyboard, event);
    next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  return next ?? undefined;
}

export interface MoveHighlightOptions {
  orientation: MenuRoot.Orientation;
  rtl: boolean;
  loopFocus: boolean;
  /** Whether the menu's navigation escapes to its input at either end instead of wrapping. */
  allowEscape: boolean;
}
