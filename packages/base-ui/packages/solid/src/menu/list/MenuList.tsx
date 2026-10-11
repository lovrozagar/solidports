import { untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createLayoutEffect, splitComponentProps } from '../../solid-helpers';
import { resolvePopupLabel } from '../../utils/resolvePopupLabel';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';

function MenuListPlain(componentProps: MenuList.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, ['id']);
  const idProp = () => componentProps.id;
  const { store, orientation } = useMenuRootContext();
  const activeTriggerId = store.useState('activeTriggerId');
  const activeTriggerElement = store.useState('activeTriggerElement');
  const setListElement = store.useStateSetter('listElement');
  const id = useBaseUiId(idProp);

  let renderedId = untrack(id);
  createLayoutEffect(id, (nextId) => {
    if (renderedId !== nextId) {
      renderedId = nextId;
      const element = store.select('listElement');
      if (element) {
        store.set('listElement', element);
      }
    }
  });

  const ariaLabelledBy = () =>
    resolvePopupLabel(
      {
        'aria-label':
          typeof componentProps['aria-label'] === 'string' ? componentProps['aria-label'] : undefined,
        'aria-labelledby':
          typeof componentProps['aria-labelledby'] === 'string'
            ? componentProps['aria-labelledby']
            : undefined,
        render: componentProps.render,
      },
      activeTriggerElement() ?? null,
      activeTriggerId(),
    );

  const element = useRenderElement('div', componentProps, {
    ref: [setListElement],
    props: [
      {
        get id() {
          return id();
        },
        role: 'menu' as const,
        tabindex: -1 as const,
        get 'aria-orientation'() {
          return orientation() === 'horizontal' ? 'horizontal' : undefined;
        },
        get 'aria-labelledby'() {
          return ariaLabelledBy();
        },
      },
      elementProps,
    ],
  });

  return element() as JSX.Element;
}

/**
 * Groups menu items so other content, such as a filter input, can share the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuList(props: MenuList.Props) {
  const List = useMenuFilterImpl()?.List ?? MenuListPlain;
  return <List {...props} />;
}

export interface MenuListState {}

export interface MenuListProps extends BaseUIComponentProps<'div', MenuListState> {}

export namespace MenuList {
  export type Props = MenuListProps;
  export type State = MenuListState;
}
