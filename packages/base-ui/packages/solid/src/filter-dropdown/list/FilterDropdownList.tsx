import type { JSX } from '@solidjs/web';
import { provideContext, splitComponentProps, type ReactLikeRef } from '../../solid-helpers';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { getTarget } from '../../utils/shadowDom';
import { useRenderedId } from '../../utils/resolveRenderedId';
import { FilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import { refocusOwner } from '../utils/refocusOwner';
import { useFilterDropdownRootContext } from '../root/FilterDropdownRootContext';

/**
 * @internal
 */
export function FilterDropdownList(componentProps: FilterDropdownList.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, ['id', 'children']);
  const context = useFilterDropdownRootContext();
  const [id, registerIdRef] = useRenderedId(
    componentProps,
    context.defaultListId,
    context.setRenderedListId,
  );

  const element = useRenderElement('div', componentProps, {
    ref: [registerIdRef],
    // Groups inside the list belong to this root, not to a group the list is nested in.
    get children() {
      return provideContext(
        FilterDropdownGroupContext,
        null,
        () => componentProps.children as JSX.Element,
      );
    },
    props: [
      {
        tabindex: -1,
        get id() {
          return id();
        },
        onFocus(event: FocusEvent) {
          const owner = context.focusOwnerRef.current;
          if (owner && event.relatedTarget === owner && getTarget(event) === event.currentTarget) {
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
      elementProps,
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
