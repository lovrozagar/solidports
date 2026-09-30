import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { RadioGroup as BaseRadioGroup } from '@solidports/base-ui/radio-group';

export function RadioGroup(props: BaseRadioGroup.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <BaseRadioGroup
      class={clsx('w-full flex flex-row items-start gap-1 text-gray-900', local.class)}
      {...others}
    />
  );
}
