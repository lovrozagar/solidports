import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { Checkbox } from '@solidports/base-ui/checkbox';

export function Root(props: Checkbox.Root.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Checkbox.Root
      class={clsx(
        'flex size-5 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 data-[checked]:bg-gray-900 data-[unchecked]:border data-[unchecked]:border-gray-300',
        local.class,
      )}
      {...others}
    />
  );
}

export function Indicator(props: Checkbox.Indicator.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Checkbox.Indicator
      class={clsx('flex text-gray-50 data-[unchecked]:hidden', local.class)}
      {...others}
    />
  );
}
