import { merge, omit } from 'solid-js';
import { Menu } from '@solidports/base-ui/menu';
import clsx from 'clsx';
import './Menu.css';

export const Root = Menu.Root;
export const Trigger = Menu.Trigger;
export function Popup(_props: Menu.Positioner.Props) {
  const props = merge(
    {
      sideOffset: 8,
    },
    _props,
  );
  const rest = omit(props, 'children', 'class', 'sideOffset');
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={props.sideOffset} class="MenuPositioner" {...rest}>
        <Menu.Popup class={clsx('MenuPopup', props.class)}>{props.children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}
export function Item(props: Menu.Item.Props) {
  const rest = omit(props, 'children', 'class');
  return (
    <Menu.Item class={clsx('MenuItem', props.class)} {...rest}>
      {props.children}
    </Menu.Item>
  );
}
export function LinkItem(props: Menu.LinkItem.Props) {
  const rest = omit(props, 'children', 'class');
  return (
    <Menu.LinkItem class={clsx('MenuItem', props.class)} {...rest}>
      {props.children}
    </Menu.LinkItem>
  );
}
export function Separator(props: Menu.Separator.Props) {
  const rest = omit(props, 'class');
  return <Menu.Separator class={clsx('MenuSeparator', props.class)} {...rest} />;
}
