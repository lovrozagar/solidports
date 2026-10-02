import { omit } from 'solid-js';

import clsx from 'clsx';
import { Fieldset } from '@solidports/base-ui/fieldset';

export function Root(props: Fieldset.Root.Props) {
  return <Fieldset.Root {...props} />;
}

export function Legend(props: Fieldset.Legend.Props) {
  const others = omit(props, 'class');
  return (
    <Fieldset.Legend
      class={clsx('text-sm font-bold text-neutral-950 dark:text-white', props.class)}
      {...others}
    />
  );
}
