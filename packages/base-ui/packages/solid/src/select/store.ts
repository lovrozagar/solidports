/* eslint-disable typescript/no-explicit-any -- generic Value erased at store boundary; mirrors combobox/store pattern */
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { compareItemEquality } from '../utils/itemEquality';
import { hasNullItemLabel, stringifyAsValue } from '../utils/resolveValueLabel';
import type { SolidStore } from '../utils/store/SolidStoreV2';
import type { HTMLProps } from '../utils/types';
import { type InteractionType } from '../utils/useEnhancedClickHandler';
import type { TransitionStatus } from '../utils/useTransitionStatus';

export type State = {
  id: string | undefined;
  labelId: string | undefined;
  modal: boolean;
  multiple: boolean;

  items:
    | Record<string, JSX.Element>
    | ReadonlyArray<{ label: JSX.Element; value: any }>
    | undefined;
  itemToStringLabel: ((item: any) => string) | undefined;
  itemToStringValue: ((item: any) => string) | undefined;
  isItemEqualToValue: (itemValue: any, selectedValue: any) => boolean;

  value: any;

  open: boolean;
  mounted: boolean;
  forceMount: boolean;
  transitionStatus: TransitionStatus;
  openMethod: InteractionType | null;

  activeIndex: number | null;
  selectedIndex: number | null;

  popupProps: HTMLProps;
  triggerProps: HTMLProps;
  triggerElement: HTMLElement | null | undefined;
  positionerElement: HTMLElement | null | undefined;
  listElement: HTMLDivElement | null | undefined;

  scrollUpArrowVisible: boolean;
  scrollDownArrowVisible: boolean;

  hasScrollArrows: boolean;
};

export const selectors = {
  activeIndex: (state: State) => state.activeIndex,
  forceMount: (state: State) => state.forceMount,
  hasNullItemLabel: (state: State, enabled: Accessor<boolean>) => {
    return enabled() ? hasNullItemLabel(state.items) : false;
  },
  hasScrollArrows: (state: State) => state.hasScrollArrows,

  hasSelectedValue: (state: State) => {
    if (state.value == null) {
      return false;
    }
    if (state.multiple && Array.isArray(state.value)) {
      return state.value.length > 0;
    }

    return stringifyAsValue(state.value, state.itemToStringValue) !== '';
  },
  id: (state: State) => state.id,
  isActive: (state: State, index: Accessor<number>) => state.activeIndex === index(),
  isItemEqualToValue: (state: State) => state.isItemEqualToValue,

  isSelected: (state: State, index: Accessor<number>, itemValue: Accessor<any>) => {
    const comparer = state.isItemEqualToValue;
    const storeValue = state.value;

    if (state.multiple) {
      return (
        Array.isArray(storeValue) &&
        storeValue.some((selectedItem) => compareItemEquality(itemValue(), selectedItem, comparer))
      );
    }

    // `selectedIndex` is only updated after the items mount for the first time,
    // the value check avoids a re-render for the initially selected item.
    if (state.selectedIndex === index() && state.selectedIndex !== null) {
      return true;
    }

    return compareItemEquality(itemValue(), storeValue, comparer);
  },

  isSelectedByFocus: (state: State, index: Accessor<number>) => {
    return state.selectedIndex === index();
  },

  itemToStringLabel: (state: State) => state.itemToStringLabel,

  itemToStringValue: (state: State) => state.itemToStringValue,
  items: (state: State) => state.items,
  labelId: (state: State) => state.labelId,
  listElement: (state: State) => state.listElement,
  modal: (state: State) => state.modal,

  mounted: (state: State) => state.mounted,
  multiple: (state: State) => state.multiple,
  open: (state: State) => state.open,

  openMethod: (state: State) => state.openMethod,
  popupProps: (state: State) => state.popupProps,

  positionerElement: (state: State) => state.positionerElement,
  scrollDownArrowVisible: (state: State) => state.scrollDownArrowVisible,
  scrollUpArrowVisible: (state: State) => state.scrollUpArrowVisible,
  selectedIndex: (state: State) => state.selectedIndex,
  transitionStatus: (state: State) => state.transitionStatus,

  triggerElement: (state: State) => state.triggerElement,
  triggerProps: (state: State) => state.triggerProps,

  value: (state: State) => state.value,
};

export type SelectStore = SolidStore<State, {}, typeof selectors>;
