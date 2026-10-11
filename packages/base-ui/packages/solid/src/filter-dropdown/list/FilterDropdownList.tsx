import type { JSX } from '@solidjs/web';
import { provideContext, type ReactLikeRef } from '../../solid-helpers';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { getTarget } from '../../utils/shadowDom';
import { useRenderedId } from '../../utils/resolveRenderedId';
import { FilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import { refocusOwner } from '../utils/refocusOwner';
import { useFilterDropdownRootContext } from '../root/FilterDropdownRootContext';

/**
 * The list whose items the query filters. Groups inside it belong to this root.
 */
export function FilterDropdownList(componentProps: FilterDropdownList.Props) {
  const context = useFilterDropdownRootContext();
  const [id, registerIdRef] = useRenderedId(
    componentProps,
    context.defaultListId,
    context.setRenderedListId,
  );

  const groupedChildren = provideContext(
    FilterDropdownGroupContext,
    null,
    () => componentProps.children as JSX.Element,
  );

  const element = useRenderElement('div', componentProps, {
    ref: [registerIdRef],
    props: [
      {
        tabindex: -1,
        get id() {
          return id();
        },
        onFocus(event: FocusEvent) {
          const owner = context.focusOwnerRef.current;
          if (
            owner &&
            event.relatedTarget === owner &&
            getTarget(event) === event.currentTarget
          ) {
            refocusOwner(owner);
          }
        },
        onPointerMove() {
          context.setKeyboardModality(false);
        },
        onPointerDown() {
          context.setKeyboardModality(false);
        },
      } satisfies HTMLProps,
      {
        children: groupedChildren,
      },
    ],
  });

  return <>{element()}</>;
}

export interface FilterDropdownListState {}

export interface FilterDropdownListProps extends BaseUIComponentProps<
  'div',
  FilterDropdownListState
> {
  id?: string | undefined;
}

export namespace FilterDropdownList {
  export type Props = FilterDropdownListProps;
  export type State = FilterDropdownListState;
}

export type { ReactLikeRef };
