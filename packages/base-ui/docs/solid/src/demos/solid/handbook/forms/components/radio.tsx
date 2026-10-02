import { omit } from 'solid-js';

import clsx from 'clsx';
import { Radio } from '@solidports/base-ui/radio';

export function Root(props: Radio.Root.Props) {
  const others = omit(props, 'class');
  return (
    <Radio.Root
      class={clsx(
        'flex size-4 shrink-0 items-center justify-center rounded-full border border-neutral-950 bg-white p-0 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 dark:focus-visible:outline-white data-checked:bg-neutral-950 data-checked:text-white dark:border-white dark:bg-neutral-950 dark:text-neutral-950 dark:data-checked:bg-white dark:data-checked:text-neutral-950',
        props.class,
      )}
      {...others}
    />
  );
}

export function Indicator(props: Radio.Indicator.Props) {
  const others = omit(props, 'class');
  return (
    <Radio.Indicator
      class={clsx(
        'flex items-center justify-center data-unchecked:hidden before:size-2 before:rounded-full before:bg-current',
        props.class,
      )}
      {...others}
    />
  );
}
