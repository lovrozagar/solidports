import { createMemo } from 'solid-js';
import { useItemRegistry } from '../../internals/useItemRegistry';
import { createLayoutEffect } from '../../solid-helpers';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import type { State as StoreState } from '../store';
import {
  FilterDropdownGroupContext,
  useFilterDropdownGroupContext,
} from './FilterDropdownGroupContext';
import type { FilterDropdownGroupContext as FilterDropdownGroupContextValue } from './FilterDropdownGroupContext';

function isGroupHidden(
  visibleItemIds: ReadonlySet<symbol> | null,
  items: ReadonlyMap<symbol, boolean>,
) {
  // A group with no members hasn't been filtered out, it hasn't registered yet.
  if (visibleItemIds === null || items.size === 0) {
    return false;
  }
  for (const [id, retained] of items) {
    if (retained || visibleItemIds.has(id)) {
      return false;
    }
  }
  return true;
}

export interface UseFilterDropdownGroupReturnValue {
  /** Whether the query filtered out every item in the group. */
  hidden: () => boolean;
  /** Provider value that collects the group's items. */
  context: FilterDropdownGroupContextValue;
}

/**
 * Tracks which items belong to a group and hides the group once none of them match.
 *
 * @internal
 */
export function useFilterDropdownGroup(): UseFilterDropdownGroupReturnValue {
  const { store } = useFilterDropdownItemContext();
  const parentContext = useFilterDropdownGroupContext();

  const registry = useItemRegistry<symbol, boolean>();
  const visibleItemIds = store.useState('visibleItemIds');
  const hidden = createMemo(() => isGroupHidden(visibleItemIds(), registry.items));

  // A nested container collects its own items, so the enclosing one only ever sees this
  // registration. Report visibility upward or a group of groups would look empty.
  const groupId = Symbol('filter-dropdown-group');
  const registerInParent = parentContext?.registerItem;

  createLayoutEffect(
    () => hidden(),
    (isHidden) => registerInParent?.(groupId, !isHidden),
  );

  const context: FilterDropdownGroupContextValue = {
    registerItem: registry.registerItem,
  };

  return { hidden, context };
}

export type { StoreState };
