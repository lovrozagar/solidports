import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps, provideContext } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import { MenuGroupContext } from './MenuGroupContext';

/**
 * Groups related menu items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 *
 * @internal
 */
export function MenuGroupPlain(componentProps: MenuGroup.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const element = useRenderElement('div', componentProps, {
    props: [
      {
        get 'aria-labelledby'() {
          return labelId();
        },
        role: 'group',
        get hidden() {
          return componentProps.hidden || undefined;
        },
      },
      elementProps,
    ],
  });

  return provideContext(MenuGroupContext, setLabelId, element);
}

/**
 * Groups related menu items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuGroup(props: MenuGroup.Props) {
  const Group = useMenuFilterImpl()?.Group ?? MenuGroupPlain;
  return <Group {...props} />;
}

export interface MenuGroupProps extends BaseUIComponentProps<'div', MenuGroup.State> {
  /**
   * The content of the component.
   */
  children?: JSX.Element | undefined;
}

export interface MenuGroupState {}

export namespace MenuGroup {
  export type Props = MenuGroupProps;
  export type State = MenuGroupState;
}
