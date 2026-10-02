/* eslint-disable typescript/no-explicit-any -- generic item type for filter callback */
import { createCollatorItemFilter, createSingleSelectionCollatorFilter } from './index';
import {
  type Filter,
  type GetFilterParameters as UseFilterOptions,
  getFilter,
} from '../../../internals/filter';
import { splitProps } from '../../../solid-1-compat';

export type { Filter, UseFilterOptions };

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 */
export const useCoreFilter = getFilter;

export interface UseComboboxFilterOptions extends UseFilterOptions {
  /**
   * Whether the combobox is in multiple selection mode.
   * @default false
   */
  multiple?: boolean | undefined;
  /**
   * The current value of the combobox, used to keep every item visible while the query still
   * matches the selection.
   */
  value?: any;
}

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 */
export function useComboboxFilter(options: UseComboboxFilterOptions = {}): Filter {
  const [local, collatorOptions] = splitProps(options, ['multiple', 'value']);

  // Solid: the hook runs once, so the (cached) collator filter is resolved per call to pick up
  // option changes the way React's per-render `getFilter` call does.
  const coreFilter = () => getFilter(collatorOptions);

  const contains: Filter['contains'] = (
    item: any,
    query: string,
    itemToString?: (item: any) => string,
  ) => {
    if (local.multiple ?? false) {
      return createCollatorItemFilter(coreFilter(), itemToString)(item, query);
    }
    return createSingleSelectionCollatorFilter(
      coreFilter(),
      itemToString,
      local.value,
    )(item, query);
  };

  return {
    contains,
    startsWith: (item, query, itemToString) => coreFilter().startsWith(item, query, itemToString),
    endsWith: (item, query, itemToString) => coreFilter().endsWith(item, query, itemToString),
  };
}
