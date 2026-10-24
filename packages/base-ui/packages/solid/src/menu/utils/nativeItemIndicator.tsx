/*
 * Menu's CheckboxItemIndicator and RadioItemIndicator on the shared native item indicator
 * (`utils/native/itemIndicator.tsx`, D32's sweep). Checkbox.Indicator's own element writes the
 * checkbox root's state (indeterminate, the Field validity, read-only, required), so only the lazy
 * transition is shared with it.
 */
import type { Accessor } from 'solid-js';
import type { LazyTransitionHandle } from '../../utils/createLazyTransitionStatus';
import { compileStateWriter } from '../../utils/native/element';
import type {
  NativeItemIndicatorKind,
  NativeItemIndicatorState,
} from '../../utils/native/itemIndicator';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { itemMapping } from './stateAttributesMapping';

/** What an indicator reads from its item's context (the native item's model or the slow value). */
export interface ItemIndicatorSource {
  checked: Accessor<boolean>;
  disabled: Accessor<boolean>;
  highlighted: Accessor<boolean>;
}

/** The indicator's state: prototype getters over its item and its transition. */
class MenuItemIndicatorState implements NativeItemIndicatorState {
  declare private readonly item: ItemIndicatorSource;
  declare private readonly transition: LazyTransitionHandle;
  declare indicator: HTMLElement | null;

  constructor(item: ItemIndicatorSource, transition: LazyTransitionHandle) {
    this.item = item;
    this.transition = transition;
    this.indicator = null;
  }

  get checked() {
    return this.item.checked();
  }

  get disabled() {
    return this.item.disabled();
  }

  get highlighted() {
    return this.item.highlighted();
  }

  get transitionStatus(): TransitionStatus {
    return this.transition.transitionStatus();
  }
}

/** Menu's checked-item indicator, shown while its item is checked. */
export const MENU_ITEM_INDICATOR_KIND = Object.freeze<NativeItemIndicatorKind<ItemIndicatorSource>>(
  {
    shown: (item) => item.checked,
    State: MenuItemIndicatorState,
    writeState: compileStateWriter(
      ['checked', 'disabled', 'highlighted', 'transitionStatus'],
      itemMapping,
    ),
  },
);
