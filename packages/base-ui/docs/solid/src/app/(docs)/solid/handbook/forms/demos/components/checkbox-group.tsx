import { omit } from 'solid-js';
import clsx from 'clsx';
import { CheckboxGroup as BaseCheckboxGroup } from '@solidports/base-ui/checkbox-group';

export function CheckboxGroup(props: BaseCheckboxGroup.Props) {
  const rest = omit(props, 'class');
  return (
    <BaseCheckboxGroup
      class={clsx('flex flex-col items-start gap-1 text-neutral-950 dark:text-white', props.class)}
      {...rest}
    />
  );
}
