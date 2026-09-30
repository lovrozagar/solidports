import { splitProps } from 'solid-js';
import clsx from 'clsx';
import { Radio } from '@solidports/base-ui/radio';

export function Root(props: Radio.Root.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Radio.Root
      class={clsx(
        'flex size-5 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 data-[checked]:bg-gray-900 data-[unchecked]:border data-[unchecked]:border-gray-300',
        local.class,
      )}
      {...others}
    />
  );
}

export function Indicator(props: Radio.Indicator.Props) {
  const [local, others] = splitProps(props, ['class']);
  return (
    <Radio.Indicator
      class={clsx(
        'flex before:size-2 before:rounded-full before:bg-gray-50 data-[unchecked]:hidden',
        local.class,
      )}
      {...others}
    />
  );
}
