import { omit } from 'solid-js';
import { Select } from '@solidports/base-ui/select';
import clsx from 'clsx';
import { CaretSortIcon } from '../icons/CaretSortIcon';
import { CheckIcon } from '../icons/CheckIcon';
import './Select.css';

export const Root = Select.Root;
interface TriggerProps extends Omit<Select.Trigger.Props, 'children'> {
  children?: Select.Value.Props['children'];
}
export function Trigger(props: TriggerProps) {
  const rest = omit(props, 'class', 'children');
  return (
    // Implicitly relying on <GhostButton>, keep it in sync
    <Select.Trigger data-layout="text" class="GhostButton" type={undefined} {...rest}>
      <Select.Value>{props.children}</Select.Value>
      <Select.Icon
        render={{
          component: CaretSortIcon,
          class: 'bui-ml--0.5',
        }}
      />
    </Select.Trigger>
  );
}
export function Popup(props: Select.Positioner.Props) {
  const rest = omit(props, 'children', 'class');
  return (
    <Select.Portal>
      <Select.Positioner align="center" sideOffset={7} class="SelectPositioner" {...rest}>
        <Select.Popup class={clsx('SelectPopup', props.class)}>{props.children}</Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}
export function Item(props: Select.Item.Props) {
  const rest = omit(props, 'children', 'class');
  return (
    <Select.Item class={clsx('SelectItem', props.class)} {...rest}>
      <Select.ItemIndicator
        class="SelectItemIndicator"
        render={{
          component: CheckIcon,
        }}
      />
      <Select.ItemText class="SelectItemText">{props.children}</Select.ItemText>
    </Select.Item>
  );
}
