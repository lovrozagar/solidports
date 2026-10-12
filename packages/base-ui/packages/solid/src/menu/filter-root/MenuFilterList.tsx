import { isHTMLElement } from '@floating-ui/utils/dom';
import { useDirection } from '../../direction-provider/DirectionContext';
import { ownerDocument } from '../../utils/owner';
import { activeElement, contains, getTarget } from '../../utils/shadowDom';
import { FilterDropdownList } from '../../filter-dropdown/list/FilterDropdownList';
import { mergeProps } from '../../merge-props';
import { isMainOrientationKey } from '../../floating-ui-solid/hooks/useListNavigation';
import { useCompositeListContext } from '../../internals/composite/list/CompositeListContext';
import { createLayoutEffect, useRef } from '../../solid-helpers';
import { resolvePopupLabel } from '../../utils/resolvePopupLabel';
import {
  useFilterDropdownItemContext,
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from '../../filter-dropdown/root/FilterDropdownRootContext';
import { refocusOwner } from '../../filter-dropdown/utils/refocusOwner';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuList } from '../list/MenuList';
import { useMenuFilterKeyDown } from './useMenuFilterKeyDown';
import { moveHighlightFrom } from './moveHighlightFrom';

/**
 * The list of a filterable menu: it takes the `menu` role while the popup is a dialog holding
 * the input, and it forwards keys that land on it to the input.
 */
export function MenuFilterList(props: MenuList.Props) {
  const { store, orientation, loopFocus, allowEscape } = useMenuRootContext();
  const direction = useDirection();
  const { onItemsChange, focusOwnerRef, triggerId } = useFilterDropdownRootContext();
  const { listRef } = useFilterDropdownItemContext();
  const { subscribeMapChange } = useCompositeListContext();
  const value = useFilterDropdownValueContext();
  const handleInputKeyDown = useMenuFilterKeyDown(() => value() !== '');
  const previousItemsRef = useRef<readonly (HTMLElement | null)[] | null>(null);

  function handleKeyDown(event: KeyboardEvent) {
    const owner = focusOwnerRef.current;
    const target = getTarget(event) as Element | null;
    const currentTarget = event.currentTarget as HTMLElement;
    const ownerFocused = owner != null && activeElement(ownerDocument(owner)) === owner;
    const fromNestedPopup = target != null && !contains(currentTarget, target);
    if (owner == null || ownerFocused || fromNestedPopup) {
      if (
        event.which !== 229 &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        isMainOrientationKey(event.key, orientation())
      ) {
        event.stopPropagation();
        const trigger =
          fromNestedPopup && ownerFocused && target ? getNestedPopupTrigger(target) : undefined;
        if (trigger) {
          moveHighlightFrom(store, trigger, event, {
            orientation: orientation(),
            rtl: direction() === 'rtl',
            loopFocus: loopFocus(),
            allowEscape: allowEscape(),
          });
        }
      }
      return;
    }

    if (event.defaultPrevented) {
      return;
    }

    refocusOwner(owner);
    handleInputKeyDown(event);
  }

  function getNestedPopupTrigger(target: Element) {
    const root = target.getRootNode() as Document | ShadowRoot;
    return listRef.current.find((item): item is HTMLElement => {
      const popupId = item?.getAttribute('aria-controls');
      return (
        popupId != null && isHTMLElement(item) && contains(root.getElementById(popupId), target)
      );
    });
  }

  const handleItemMapChange = () => {
    const items = [...listRef.current];
    const previousItems = previousItemsRef.current;
    const changed =
      previousItems === null ||
      previousItems.length !== items.length ||
      items.some((item, index) => item !== previousItems[index]);

    if (changed && previousItems !== null) {
      onItemsChange(previousItems);
    }
    previousItemsRef.current = items;
  };

  createLayoutEffect(
    () => true,
    () => subscribeMapChange(handleItemMapChange),
  );

  const listProps = mergeProps(
    {
      role: 'menu',
      get 'aria-labelledby'() {
        return resolvePopupLabel(
          {
            'aria-label': typeof props['aria-label'] === 'string' ? props['aria-label'] : undefined,
            'aria-labelledby':
              typeof props['aria-labelledby'] === 'string' ? props['aria-labelledby'] : undefined,
            render: props.render,
          },
          null,
          triggerId() ?? null,
        );
      },
      get 'aria-orientation'() {
        return orientation() === 'horizontal' ? 'horizontal' : undefined;
      },
      onKeyDown: handleKeyDown,
    },
    props,
  ) as FilterDropdownList.Props;

  return <FilterDropdownList {...listProps} />;
}
