import { createSignal, untrack } from 'solid-js';
import { access, createLayoutEffect, type MaybeAccessor } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import type { FilterDropdownRoot } from './FilterDropdownRootContext';

interface UseFilterDropdownCloseQueryParameters {
  open: MaybeAccessor<boolean>;
  mounted: MaybeAccessor<boolean>;
  value: MaybeAccessor<string>;
  onValueChange: (value: string, details: FilterDropdownRoot.ChangeEventDetails) => void;
}

/**
 * Clears the committed value when a filter popup closes while retaining the displayed query and
 * filtered items until the exit transition completes.
 */
export function useFilterDropdownCloseQuery(parameters: UseFilterDropdownCloseQueryParameters) {
  const [closeQuery, setCloseQuery] = createSignal<string | null>(null);
  let previousOpen = untrack(() => access(parameters.open));

  createLayoutEffect(
    () => ({
      open: access(parameters.open),
      mounted: access(parameters.mounted),
      value: access(parameters.value),
      closeQuery: closeQuery(),
    }),
    (deps) => {
      const wasOpen = previousOpen;
      previousOpen = deps.open;
      if (wasOpen && !deps.open && deps.value !== '') {
        setCloseQuery(deps.value);
        parameters.onValueChange('', createChangeEventDetails(REASONS.popupClose));
      } else if ((deps.open || !deps.mounted) && deps.closeQuery !== null) {
        setCloseQuery(null);
      }
    },
  );

  return () => (!access(parameters.open) && closeQuery() !== null ? closeQuery()! : access(parameters.value));
}
