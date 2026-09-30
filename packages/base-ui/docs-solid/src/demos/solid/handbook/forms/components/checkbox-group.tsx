import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { CheckboxGroup as BaseCheckboxGroup } from '@solidports/base-ui/checkbox-group';

export function CheckboxGroup(props: BaseCheckboxGroup.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <BaseCheckboxGroup
      class={clsx('flex flex-col items-start gap-1 text-gray-900', local.class)}
      {...others}
    />
  );
}
