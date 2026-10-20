import { createEffect } from 'solid-js';
import { activeElement, contains } from '../../floating-ui-solid/utils';
import { useCompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { shallowEqual } from '../../solid-helpers';
import { ownerDocument } from '../../utils/owner';
import { useTabsRootContext } from '../root/TabsRootContext';
import { useTabsListContext } from './TabsListContext';

interface SyncDeps {
  index: number;
  disabled: boolean;
  highlighted: number;
  list: HTMLElement | null;
}

/**
 * Keeps the list's highlight on the selected tab when the value changes from outside (a controlled
 * value, an automatic fallback): upstream runs this in every tab, against the tab's own index; one
 * effect for the list does the same work, so a tab carries no effect and no listener of its own.
 * Focus inside the list keeps the roving highlight where it is, a disabled selected tab is never
 * highlighted, and a keyboard move (seen in the capture phase, before the composite handles the key)
 * is not undone: React's `onKeyDownCapture` on each tab.
 */
export function TabsHighlightSync(): null {
  const { selectedTab } = useTabsRootContext();
  const { highlightedIndex, onHighlightedIndexChange } = useCompositeRootContext();
  const { tabsListElement } = useTabsListContext();

  let isNavigating = false;
  const markNavigating = () => {
    isNavigating = true;
  };
  createEffect(tabsListElement, (list) => {
    if (list == null) {
      return undefined;
    }
    list.addEventListener('keydown', markNavigating, true);
    return () => list.removeEventListener('keydown', markNavigating, true);
  });

  let previous: SyncDeps | undefined;
  createEffect(
    (): SyncDeps => {
      const selected = selectedTab();
      return {
        index: selected?.index ?? -1,
        disabled: selected?.disabled ?? false,
        highlighted: highlightedIndex(),
        list: tabsListElement(),
      };
    },
    (deps) => {
      if (previous && shallowEqual(previous, deps)) {
        return;
      }
      previous = deps;

      if (isNavigating) {
        isNavigating = false;
        return;
      }

      if (!(deps.index > -1 && deps.highlighted !== deps.index)) {
        return;
      }

      // Focus inside the list keeps the roving highlight: keyboard navigation stays relative to the
      // focused tab after an external or asynchronous selection change.
      if (deps.list != null) {
        const focused = activeElement(ownerDocument(deps.list));
        if (focused && contains(deps.list, focused)) {
          return;
        }
      }

      // A disabled selected tab is not highlighted: the tab stop stays on an enabled tab.
      if (!deps.disabled) {
        onHighlightedIndexChange(deps.index);
      }
    },
  );

  return null;
}
