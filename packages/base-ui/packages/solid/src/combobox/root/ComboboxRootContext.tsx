/* eslint-disable typescript/no-explicit-any -- generic item values erased at the context boundary, mirrors React */
import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { FloatingRootContext } from '../../floating-ui-solid';
import type { ComboboxStore } from '../store';

// Solid: the derived values are accessors so consumers track them.
export interface ComboboxDerivedItemsContext {
  query: Accessor<string>;
  hasItems: Accessor<boolean>;
  filteredItems: Accessor<any[]>;
  /**
   * `filteredItems` flattened across groups and projected to selection values. Identical to the
   * items themselves unless `items` is a `createItems()` collection.
   */
  flatFilteredValues: Accessor<any[]>;
}

export const ComboboxRootContext = createContext<ComboboxStore | null>(null);
export const ComboboxFloatingContext = createContext<FloatingRootContext | null>(null);
export const ComboboxDerivedItemsContext = createContext<ComboboxDerivedItemsContext | null>(null);
export const ComboboxHasItemsContext = createContext<Accessor<boolean>>(() => false);
// `inputValue` can't be placed in the store.
// https://github.com/mui/base-ui/issues/2703
export const ComboboxInputValueContext = createContext<Accessor<ComponentProps<'input'>['value']>>(
  () => '',
);

export function useComboboxRootContext() {
  const context = useContext(ComboboxRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: ComboboxRootContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    );
  }
  return context;
}

export function useComboboxFloatingContext() {
  const context = useContext(ComboboxFloatingContext);
  if (context == null) {
    throw new Error(
      'Base UI: ComboboxFloatingContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    );
  }
  return context;
}

export function useComboboxDerivedItemsContext() {
  const context = useContext(ComboboxDerivedItemsContext);
  if (context == null) {
    throw new Error(
      'Base UI: ComboboxItemsContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    );
  }
  return context;
}

export function useComboboxInputValueContext() {
  return useContext(ComboboxInputValueContext);
}

export function useComboboxHasItemsContext() {
  return useContext(ComboboxHasItemsContext);
}
