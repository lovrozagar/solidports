import { omit } from 'solid-js';

import clsx from 'clsx';
import { RadioGroup as BaseRadioGroup } from '@solidports/base-ui/radio-group';

export function RadioGroup<Value>(props: BaseRadioGroup.Props<Value>) {
  const others = omit(props, 'class');
  return (
    <BaseRadioGroup
      class={clsx(
        'flex w-full flex-row items-start gap-1 text-neutral-950 dark:text-white',
        props.class,
      )}
      {...others}
    />
  );
}
