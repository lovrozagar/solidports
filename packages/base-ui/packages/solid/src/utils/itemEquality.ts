/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { areArraysEqual } from './areArraysEqual';

export type ItemEqualityComparer<Item = any, Value = Item> = (
  itemValue: Item,
  selectedValue: Value,
) => boolean;

export const defaultItemEquality: ItemEqualityComparer = (itemValue, selectedValue) =>
  Object.is(itemValue, selectedValue);

export function compareItemEquality<Item, Value>(
  itemValue: Item,
  selectedValue: Value,
  comparer: ItemEqualityComparer<Item, Value>,
): boolean {
  if (itemValue == null || selectedValue == null) {
    return Object.is(itemValue, selectedValue);
  }
  return comparer(itemValue, selectedValue);
}

export function selectedValueIncludes<Item, Value>(
  selectedValues: readonly Item[] | undefined | null,
  itemValue: Value,
  comparer: ItemEqualityComparer<Value, Item>,
): boolean {
  if (!selectedValues || selectedValues.length === 0) {
    return false;
  }
  return selectedValues.some((selectedValue) => {
    if (selectedValue === undefined) {
      return false;
    }
    return compareItemEquality(itemValue, selectedValue, comparer);
  });
}

export function findItemIndex<Item, Value>(
  itemValues: readonly Item[] | undefined | null,
  selectedValue: Value,
  comparer: ItemEqualityComparer<Item, Value>,
): number {
  if (!itemValues || itemValues.length === 0) {
    return -1;
  }
  return itemValues.findIndex((itemValue) => {
    if (itemValue === undefined) {
      return false;
    }
    return compareItemEquality(itemValue, selectedValue, comparer);
  });
}

export function isSelectedValueDirty(
  currentValue: unknown,
  initialValue: unknown,
  comparer: ItemEqualityComparer,
): boolean {
  if (Array.isArray(currentValue) && Array.isArray(initialValue)) {
    return !areArraysEqual(currentValue, initialValue, (itemValue, initialItemValue) =>
      compareItemEquality(itemValue, initialItemValue, comparer),
    );
  }

  return currentValue !== initialValue;
}

function createSelectionMatcher<Item, Value>(
  selectedValues: readonly Value[],
  comparer: ItemEqualityComparer<Item, Value>,
): (itemValue: Item) => boolean {
  if (comparer !== defaultItemEquality) {
    return (itemValue) => selectedValueIncludes(selectedValues, itemValue, comparer);
  }
  const index = new Set<unknown>(selectedValues);
  index.delete(undefined);
  return (itemValue) =>
    index.has(itemValue) &&
    (itemValue !== 0 || selectedValues.some((v) => Object.is(itemValue, v)));
}

export function findSelectionIndex<Item, Value>(
  itemValues: readonly Item[],
  selectedValue: Value | readonly Value[] | null | undefined,
  comparer: ItemEqualityComparer<Item, Value>,
  multiple: boolean,
): number | null {
  const index =
    multiple && Array.isArray(selectedValue)
      ? itemValues.findIndex(createSelectionMatcher(selectedValue, comparer))
      : findItemIndex(itemValues, selectedValue as Value, comparer);
  return index === -1 ? null : index;
}

export function resolveSelectedIndex<Item, Value>(
  index: number,
  itemValue: Item,
  registry: readonly Item[],
  selectedValues: readonly Value[],
  comparer: ItemEqualityComparer<Item, Value>,
  currentIndex: number | null,
): number | null {
  if (selectedValueIncludes(selectedValues, itemValue, comparer)) {
    return currentIndex != null &&
      index > currentIndex &&
      selectedValueIncludes(selectedValues, registry[currentIndex], comparer)
      ? currentIndex
      : index;
  }
  return index === currentIndex
    ? findSelectionIndex(registry, selectedValues, comparer, true)
    : currentIndex;
}

export function removeItem<Item, Value>(
  selectedValues: readonly Item[],
  itemValue: Value,
  comparer: ItemEqualityComparer<Value, Item>,
): Item[] {
  return selectedValues.filter(
    (selectedValue) => !compareItemEquality(itemValue, selectedValue, comparer),
  );
}
