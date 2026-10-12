import { createContext, useContext, type Accessor, type Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ReactLikeRef } from '../../solid-helpers';
import type { BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import type { REASONS } from '../../utils/reasons';
import type { FilterDropdownStore } from '../store';

export interface FilterDropdownItemRegistration {
  getText: () => string | undefined;
}

export type FilterDropdownFilter = (text: string, query: string) => boolean;

export interface FilterDropdownRootContext {
  open: Accessor<boolean>;
  disabled: Accessor<boolean>;
  inputFocusVisible: Accessor<boolean>;
  setInputFocusVisible: Setter<boolean>;
  keyboardModality: Accessor<boolean>;
  setKeyboardModality: Setter<boolean>;
  autoHighlight: Accessor<boolean | 'always'>;
  triggerId: Accessor<string | undefined>;
  defaultListId: Accessor<string | undefined>;
  listId: Accessor<string | undefined>;
  /** Records the id the list rendered with, when it differs from `defaultListId`. */
  setRenderedListId: (id: string | undefined) => void;
  /** The input, which owns real focus while the host uses virtual list navigation. */
  focusOwnerRef: ReactLikeRef<HTMLElement | null>;
  /** Moves the host's highlight. */
  setActiveIndex: (index: number | null) => void;
  /** Called with the previous items when the host's list changes after it first registered. */
  onItemsChange: (previousItems: readonly (HTMLElement | null)[]) => void;
  /** Reports a query edit and resets the highlight it invalidates. */
  onValueChange: (value: string, eventDetails: FilterDropdownRoot.ChangeEventDetails) => void;
}

export interface FilterDropdownItemContext {
  /** The enclosing dropdown when this root is nested. */
  parent: FilterDropdownItemContext | null;
  store: FilterDropdownStore;
  registerItem: (id: symbol, registration: FilterDropdownItemRegistration) => () => void;
  listRef: ReactLikeRef<Array<HTMLElement | null>>;
}

function throwMissingFilterRoot(): never {
  throw new Error(
    'Base UI: Filter parts are missing their filter context and cannot access the query or items. Wrap the component root in its filter provider.',
  );
}

export const FilterDropdownItemContext = createContext<FilterDropdownItemContext | null>(null);

export function useFilterDropdownItemContext(optional?: false): FilterDropdownItemContext;
export function useFilterDropdownItemContext(optional: true): FilterDropdownItemContext | null;
export function useFilterDropdownItemContext(optional?: boolean): FilterDropdownItemContext | null {
  const context = useContext(FilterDropdownItemContext);
  if (context == null && !optional) {
    throwMissingFilterRoot();
  }
  return context;
}

export const FilterDropdownRootContext = createContext<FilterDropdownRootContext | null>(null);

export function useFilterDropdownRootContext(optional?: false): FilterDropdownRootContext;
export function useFilterDropdownRootContext(optional: true): FilterDropdownRootContext | null;
export function useFilterDropdownRootContext(optional?: boolean): FilterDropdownRootContext | null {
  const context = useContext(FilterDropdownRootContext);
  if (context == null && !optional) {
    throwMissingFilterRoot();
  }
  return context;
}

/**
 * Finds the dropdown that owns the given item list, walking out through nested roots.
 */
export function useFilterContextForList(listRef: ReactLikeRef<Array<HTMLElement | null>> | null) {
  let context = useContext(FilterDropdownItemContext);
  if (listRef === null) {
    return null;
  }

  while (context != null && context.listRef !== listRef) {
    context = context.parent;
  }
  return context;
}

// `value` controls a native input and can't be placed in the store without breaking the caret
// position when the input is controlled.
export const FilterDropdownValueContext = createContext<Accessor<string>>(() => '');

export function useFilterDropdownValueContext() {
  return useContext(FilterDropdownValueContext);
}

export type FilterDropdownRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.clearPress
  | typeof REASONS.popupClose;

export type FilterDropdownRootChangeEventDetails =
  BaseUIChangeEventDetails<FilterDropdownRootChangeEventReason>;

export namespace FilterDropdownRoot {
  export type ChangeEventReason = FilterDropdownRootChangeEventReason;
  export type ChangeEventDetails = FilterDropdownRootChangeEventDetails;
}

export type FilterDropdownChildren = JSX.Element;
